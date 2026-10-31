import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';
import { PeminjamanRecord, StatusPeminjaman } from '../../src/products/hub/peminjaman/types';
import { handleLoanWrite, loanCanRead } from './loanPersistence';

export function parseLoanMetadata(rawCatatan?: string | null): any {
  if (!rawCatatan) return {};
  const match = rawCatatan.match(/<!-- PTV_META:\s*([\s\S]*?)\s*-->/);
  if (!match) return {};
  try {
    // Unescape single quotes from PHP addslashes (e.g. Rafa Putra Ro\'uf)
    const cleaned = match[1].replace(/\\'/g, "'");
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

export function computeLoanStatus(
  dbStatus: string | null | undefined,
  tenggatKembali: string | null | undefined,
  tanggalKembali: string | null | undefined
): StatusPeminjaman {
  const norm = (dbStatus || '').toLowerCase().trim();
  if (norm === 'dikembalikan' || norm === 'returned' || norm === 'selesai' || !!tanggalKembali) {
    return 'dikembalikan';
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  if (tenggatKembali && tenggatKembali.slice(0, 10) < todayIso) {
    return 'terlambat';
  }
  return 'dipinjam';
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
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Peminjaman.',
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
        error: 'Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.',
        code: 'session_expired',
      })
    );
    return;
  }

  // 2. RBAC Capability Check (Fail fast before database queries)
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes('hub.access')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Sesi atau izin telah dicabut.' })); return; }
  const hasPermission =
    userCaps.includes('loans.view');

  if (!hasPermission) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Peminjaman.',
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
    res.end(JSON.stringify({ error: 'Endpoint peminjaman dibatasi pada Staging.' }));
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
    if (req.method === 'POST') { await handleLoanWrite(req, res, supabase, session); return; }
    res.setHeader('Cache-Control', 'no-store');
    await loanCanRead(supabase, session);
    // 4 & 5. Optimasi Performa: Eksekusi query inventaris, unit, dan peminjaman secara paralel
    const [resInv, resUnit, resCanon] = await Promise.all([
      supabase
        .from('ptv_inventaris')
        .select('id, kode, nama_alat, kategori, foto_url'),
      supabase
        .from('ptv_inventaris_unit')
        .select('id, inventaris_id, kode_unit, nama_unit, status_peminjaman'),
      supabase
        .from('ptv_peminjaman')
        .select(`
          id,
          transaction_id,
          unit_id,
          peminjam_nama,
          keperluan,
          tanggal_pinjam,
          tenggat_kembali,
          tanggal_kembali,
          status,
          kondisi_kembali,
          catatan,
          actor_id,
          created_at
        `)
        .order('created_at', { ascending: false })
    ]);

    if (resInv.error) throw resInv.error;
    if (resUnit.error) throw resUnit.error;
    if (resCanon.error) throw resCanon.error;

    const invMap = new Map((resInv.data || []).map((i) => [i.id, i]));
    const unitMap = new Map((resUnit.data || []).map((u) => [u.id, u]));
    const canonicalLoans = resCanon.data;

    // 6. Query historical loans preserved in legacy_archive_unresolved
    const { data: historicalRows, error: errHist } = await supabase
      .from('legacy_archive_unresolved')
      .select('source_id, raw_payload, quarantined_at')
      .eq('source_table', 'ptv_peminjaman');

    // Non-fatal if legacy table is consolidated or empty
    if (errHist) {
      console.warn('[Peminjaman] Historical loans unavailable:', errHist.message);
    }

    const records: PeminjamanRecord[] = [];

    // Map canonical loans
    for (const c of canonicalLoans || []) {
      const unit = unitMap.get(c.unit_id);
      const inv = unit ? invMap.get(unit.inventaris_id) : invMap.get(c.unit_id);
      const status = computeLoanStatus(c.status, c.tenggat_kembali, c.tanggal_kembali);
      records.push({
        id: c.id,
        transaction_id: c.transaction_id || `TRX-${c.id.slice(0, 8)}`,
        unit_id: c.unit_id,
        kode_unit: unit?.kode_unit || (c.unit_id ? `U-${c.unit_id.slice(0, 6)}` : '-'),
        nama_alat: inv?.nama_alat || unit?.nama_unit || 'Unit Alat',
        kategori: inv?.kategori || 'Umum',
        peminjam_nama: c.peminjam_nama || 'Kru PTV',
        keperluan: c.keperluan || 'Operasional',
        tanggal_pinjam: c.tanggal_pinjam || c.created_at?.slice(0, 10),
        tenggat_kembali: c.tenggat_kembali || c.tanggal_pinjam,
        tanggal_kembali: c.tanggal_kembali || undefined,
        status,
        kondisi_kembali: (c.kondisi_kembali as any) || undefined,
        catatan: c.catatan || undefined,
        actor_id: c.actor_id || undefined,
        created_at: c.created_at,
        is_historical: false,
        foto_url: inv?.foto_url || undefined,
      });
    }

    // Map historical loans (supporting multiple equipments per transaction)
    for (const h of historicalRows || []) {
      const p = h.raw_payload || {};
      const meta = parseLoanMetadata(p.catatan);

      const borrower =
        meta.borrower_name ||
        meta.user ||
        meta.account ||
        p.peminjam_nama ||
        (p.keperluan && p.keperluan.includes('—') ? p.keperluan.split('—')[0].trim() : 'Kru Studio');

      const purpose =
        meta.purpose ||
        (p.keperluan && p.keperluan.includes('—') ? p.keperluan.split('—').slice(1).join('—').trim() : p.keperluan) ||
        'Operasional Produksi';

      const pinjamDate = meta.borrowed_at || p.tanggal_pinjam || p.created_at?.slice(0, 10) || '2026-09-01';
      const dueDate = meta.expected_return || p.tanggal_kembali || pinjamDate;
      const returnedDate = meta.returned_at || p.tanggal_kembali || (p.status === 'dikembalikan' ? dueDate : undefined);

      const rawStatus = p.status || meta.status;
      const status = computeLoanStatus(rawStatus, dueDate, returnedDate);

      const txnId =
        meta.code ||
        meta.transaction_id ||
        (p.id ? `PJM-${p.id.slice(0, 8).toUpperCase()}` : `PJM-HIST`);

      // Support multi-item transactions
      const equipmentList: string[] = Array.isArray(meta.equipment_ids) && meta.equipment_ids.length > 0
        ? meta.equipment_ids
        : [p.aset_id || p.inventaris_id || 'historical-unit'];

      equipmentList.forEach((eqId: string, idx: number) => {
        const unit = unitMap.get(eqId);
        const inv = invMap.get(unit?.inventaris_id || eqId);

        records.push({
          id: equipmentList.length > 1 ? `${p.id || h.source_id}_${idx}` : (p.id || h.source_id),
          transaction_id: txnId,
          unit_id: eqId,
          kode_unit: unit?.kode_unit || (inv?.kode ? `${inv.kode} (Master)` : '(Item Master Historis)'),
          nama_alat: inv?.nama_alat || unit?.nama_unit || 'Alat Historis (Referensi Lepas)',
          kategori: inv?.kategori || 'Inventaris Studio',
          peminjam_nama: borrower,
          keperluan: purpose,
          tanggal_pinjam: pinjamDate,
          tenggat_kembali: dueDate,
          tanggal_kembali: returnedDate ? returnedDate.slice(0, 10) : undefined,
          status,
          kondisi_kembali: 'bagus',
          catatan: meta.notes || (p.catatan && !p.catatan.includes('<!--') ? p.catatan : undefined),
          created_at: p.created_at || h.quarantined_at || new Date().toISOString(),
          is_historical: true,
          foto_url: inv?.foto_url || undefined,
        });
      });
    }

    // Sort: active/overdue first, then newest pinjam date
    records.sort((a, b) => {
      const aLate = a.status === 'terlambat';
      const bLate = b.status === 'terlambat';
      if (aLate && !bLate) return -1;
      if (!aLate && bLate) return 1;

      const aActive = a.status === 'dipinjam';
      const bActive = b.status === 'dipinjam';
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      return (b.tanggal_pinjam || '').localeCompare(a.tanggal_pinjam || '');
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        count: records.length,
        loans: records,
      })
    );
  } catch (err: any) {
    console.error('[API Peminjaman Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Terjadi kesalahan internal server saat mengambil data peminjaman.',
        detail: err.message,
      })
    );
  }
}
