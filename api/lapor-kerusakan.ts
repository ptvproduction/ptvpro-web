import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';
import { DamageReportItem, DamageStatus, DamageSeverity } from '../src/products/hub/lapor-kerusakan/types';
import { handleReportWrite, reportCanRead } from './reportPersistence';

export function normalizeDamageStatus(rawStatus?: string | null): DamageStatus {
  const norm = (rawStatus || '').toLowerCase().trim();
  if (norm.includes('selesai') || norm.includes('resolved') || norm.includes('closed')) return 'Selesai';
  if (norm.includes('perbaikan') || norm.includes('repair')) return 'Dalam Perbaikan';
  if (norm.includes('sedang dicek') || norm.includes('dicek') || norm.includes('investigating')) return 'Sedang Dicek';
  if (norm.includes('rusak total') || norm.includes('total')) return 'Rusak Total';
  return 'Baru';
}

export function normalizeDamageSeverity(rawSeverity?: string | null): DamageSeverity {
  const norm = (rawSeverity || '').toLowerCase().trim();
  if (norm.includes('berat') || norm.includes('high') || norm.includes('critical')) return 'Berat';
  if (norm.includes('ringan') || norm.includes('low')) return 'Ringan';
  return 'Sedang';
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Metode HTTP tidak diizinkan.' }));
    return;
  }

  // 1. Session Authentication via HttpOnly Cookie
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Lapor Kerusakan.',
        code: 'unauthorized',
      })
    );
    return;
  }

  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.',
        code: 'session_expired',
      })
    );
    return;
  }

  // 2. RBAC Capability Check (Fail fast before database queries)
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes('hub.access')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Sesi atau izin telah dicabut.' })); return; }
  const hasPermission =
    userCaps.includes('damage.view');

  if (!hasPermission) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Lapor Kerusakan.',
        code: 'forbidden',
      })
    );
    return;
  }

  // 3. Database connection & account status verification
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Konfigurasi backend Supabase Staging belum lengkap di server.',
        code: 'misconfigured_backend',
      })
    );
    return;
  }

  if (new URL(supabaseUrl).hostname !== 'swadgljnyelsjstqqxbm.supabase.co') {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Endpoint laporan hanya tersedia pada Staging.' }));
    return;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!accountActive) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Akun pengguna Anda tidak aktif di sistem.',
        code: 'account_inactive',
      })
    );
    return;
  }

  try {
    if (req.method === 'POST') {
      await handleReportWrite(req, res, supabase, session, 'damage');
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (!await reportCanRead(supabase, session, 'damage')) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Izin damage.view diperlukan.' }));
      return;
    }
    // 4. Fetch all inventaris items to map master metadata
    const { data: invItems, error: invError } = await supabase
      .from('ptv_inventaris')
      .select('id, kode, nama_alat, kategori, foto_url');
    if (invError) throw invError;
    const invMap = new Map((invItems || []).map((i) => [i.id, i]));
    const { data: units, error: unitsError } = await supabase
      .from('ptv_inventaris_unit').select('id, inventaris_id, kode_unit');
    if (unitsError) throw unitsError;
    const unitMap = new Map((units || []).map((unit) => [unit.id, unit]));

    // 5. Query canonical damage reports
    const { data: canonicalReports, error: errCanon } = await supabase
      .from('ptv_lapor_masalah')
      .select(`
        id,
        unit_id,
        pelapor_id,
        pelapor_nama,
        deskripsi_kerusakan,
        status_qc,
        biaya_reparasi,
        qc_approved_by,
        qc_approved_at,
        created_at,
        updated_at,
        report_metadata
      `)
      .order('created_at', { ascending: false });

    if (errCanon) {
      throw errCanon;
    }

    // 6. Query historical reports from legacy_archive_unresolved
    const { data: historicalRows, error: errHist } = await supabase
      .from('legacy_archive_unresolved')
      .select('source_id, raw_payload, quarantined_at')
      .eq('source_table', 'ptv_lapor_masalah');

    // Non-fatal if legacy table is consolidated or empty
    if (errHist) {
      console.warn('[LaporKerusakan] Historical reports unavailable:', errHist.message);
    }

    const reports: DamageReportItem[] = [];

    // Map canonical reports
    for (const c of canonicalReports || []) {
      const unit = unitMap.get(c.unit_id);
      const inv = unit ? invMap.get(unit.inventaris_id) : undefined;
      const meta = c.report_metadata || {};
      reports.push({
        id: c.id,
        assetId: inv?.id || c.unit_id,
        assetName: inv?.nama_alat || 'Unit Alat',
        assetCategory: inv?.kategori || 'Inventaris',
        unitId: c.unit_id,
        unitNumber: Number(unit?.kode_unit?.match(/(?:-U?)(\d+)$/)?.[1]) || 1,
        unitCode: unit?.kode_unit || `U-${c.unit_id.slice(0, 6)}`,
        title: meta.title || c.deskripsi_kerusakan.slice(0, 60),
        description: c.deskripsi_kerusakan,
        severity: normalizeDamageSeverity(meta.severity),
        photoUrl: meta.photoUrl || undefined,
        reporterContact: meta.reporterContact || undefined,
        reporterName: c.pelapor_nama || 'Kru PTV',
        reportedAt: c.created_at,
        status: normalizeDamageStatus(c.status_qc),
        qcBy: meta.qcBy || (c.qc_approved_by ? 'QC Eksekutif' : undefined),
        qcDate: meta.qcDate || c.qc_approved_at?.slice(0, 10),
        qcNotes: meta.qcNotes || (c.biaya_reparasi ? `Biaya estimasi reparasi: Rp ${c.biaya_reparasi}` : undefined),
        qcLocked: !!c.qc_approved_at,
        isCurrentUser: false,
        is_historical: false,
      });
    }

    // Map historical reports
    for (const h of historicalRows || []) {
      const p = h.raw_payload || {};
      const targetId = p.alat_id || p.inventaris_id;
      const inv = invMap.get(targetId);

      const status = normalizeDamageStatus(p.status || p.qc_status);
      const title = p.masalah || p.keterangan || 'Kendala Teknis Alat';

      reports.push({
        id: p.id || h.source_id,
        assetId: inv?.id || targetId || 'historical-asset',
        assetName: inv?.nama_alat || p.nama_alat || 'Alat Historis',
        assetCategory: inv?.kategori || 'Studio Equipment',
        unitNumber: 1,
        unitCode: inv?.kode ? `${inv.kode}-U01` : '(Unit Historis)',
        title: title.length > 80 ? title.slice(0, 77) + '...' : title,
        description: p.keterangan && p.keterangan !== '—' ? `${p.masalah}\nKeterangan: ${p.keterangan}` : p.masalah,
        severity: normalizeDamageSeverity(p.severity),
        photoUrl: p.foto_url || inv?.foto_url || undefined,
        reporterName: p.pelapor_nama || 'Kru Studio',
        reporterContact: p.pelapor_kontak || undefined,
        reportedAt: p.created_at || h.quarantined_at || new Date().toISOString(),
        status,
        qcBy: p.qc_by || undefined,
        qcDate: p.qc_date || (p.updated_at ? p.updated_at.slice(0, 10) : undefined),
        qcNotes: p.qc_notes || undefined,
        qcLocked: status === 'Selesai',
        isCurrentUser: false,
        is_historical: true,
      });
    }

    // Sort by reportedAt DESC
    reports.sort((a, b) => (b.reportedAt || '').localeCompare(a.reportedAt || ''));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        count: reports.length,
        reports,
      })
    );
  } catch (err: any) {
    console.error('[API Lapor Kerusakan Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Terjadi kesalahan internal server saat mengambil data lapor kerusakan.',
        detail: err.message,
      })
    );
  }
}
