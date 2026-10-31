import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';
import { LostFoundItem, LostFoundType, LostFoundStatus } from '../../src/products/hub/lost-found/types';
import { handleReportWrite, reportCanRead } from './reportPersistence';

export function normalizeLostFoundStatus(rawStatus?: string | null): LostFoundStatus {
  const norm = (rawStatus || '').toLowerCase().trim();
  if (norm.includes('dikembalikan') || norm.includes('selesai') || norm.includes('returned') || norm.includes('claimed')) {
    return 'Dikembalikan';
  }
  if (norm.includes('ditemukan') || norm.includes('found') || norm.includes('diamankan')) {
    return 'Ditemukan';
  }
  return 'Dicari';
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
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Lost & Found.',
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
    userCaps.includes('lostfound.view');

  if (!hasPermission) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Lost & Found.',
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
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });

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
      await handleReportWrite(req, res, supabase, session, 'lostfound');
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (!await reportCanRead(supabase, session, 'lostfound')) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Izin lostfound.view diperlukan.' }));
      return;
    }
    // 4. Query canonical ptv_lost_found table
    const { data: dbItems, error: errDb } = await supabase
      .from('ptv_lost_found')
      .select(`
        id,
        nama_barang,
        lokasi_ditemukan,
        deskripsi,
        foto_url,
        status,
        ditemukan_oleh,
        diklaim_oleh,
        tanggal_klaim,
        created_at,
        report_metadata
      `)
      .order('created_at', { ascending: false });

    if (errDb) {
      console.error('[API Lost & Found] Error fetching items:', errDb);
      throw errDb;
    }

    const items: LostFoundItem[] = (dbItems || []).map((row) => {
      const status = normalizeLostFoundStatus(row.status);
      const meta = row.report_metadata || {};
      const type: LostFoundType = meta.type === 'hilang' || (!meta.type && row.status?.toLowerCase().includes('hilang')) ? 'hilang' : 'temuan';

      return {
        id: row.id,
        type,
        title: row.nama_barang || 'Barang Tanpa Nama',
        category: meta.category || 'Perlengkapan',
        location: row.lokasi_ditemukan || 'Area Studio',
        date: meta.date || row.created_at?.slice(0, 10) || '',
        description: row.deskripsi || '',
        photoUrl: row.foto_url || undefined,
        reporterName: row.ditemukan_oleh || 'Kru Studio',
        reporterContact: meta.reporterContact || '',
        status,
        createdAt: row.created_at || new Date().toISOString(),
        resolvedAt: row.tanggal_klaim || undefined,
        resolvedBy: row.diklaim_oleh || undefined,
        isCurrentUser: false,
      };
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        count: items.length,
        items,
      })
    );
  } catch (err: any) {
    console.error('[API Lost & Found Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Terjadi kesalahan internal server saat mengambil data lost & found.',
        detail: err.message,
      })
    );
  }
}
