import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { parseJsonBody } from './auth/_utils/bodyParser';
import { verifySessionToken } from './auth/_utils/crypto';
import { safeRandomUuid } from '../../src/shared/utils/uuid';

export const PLATFORMS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'Website',
  'Live Event',
  'Internal',
  'Lainnya',
] as const;

export const KONTRIBUSI_TYPES = [
  'Kamera',
  'Editing',
  'Desain Grafis',
  'Dokumentasi',
  'Live Streaming',
  'Switcher',
  'Floor Director',
  'Penulisan',
  'Publikasi',
  'Lainnya',
] as const;

export interface PortfolioItem {
  id: string;
  identity_id?: string;
  ptv_id: string;
  tanggal: string;
  platform: string;
  jenis_kontribusi: string;
  judul: string;
  link_karya?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Database portofolio belum tersedia.', code: 'service_unavailable' }));
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Optional Session Parsing
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';
  let sessionUser: any = null;
  if (sessionToken) {
    try {
      sessionUser = verifySessionToken(sessionToken, authSecret);
    } catch {
      // session invalid/expired
    }
  }

  const queryParams = new URL(req.url || '/', 'http://localhost').searchParams;
  const targetPtvId = queryParams.get('ptv_id')?.trim();
  const isMine = queryParams.get('mine') === 'true';

  // 1. GET: Ambil daftar karya
  if (req.method === 'GET') {
    let effectivePtvId = targetPtvId;
    if (isMine) {
      res.setHeader('Cache-Control', 'no-store, private');
      if (!sessionUser) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Sesi login kru diperlukan.', code: 'unauthorized' }));
        return;
      }
      effectivePtvId = sessionUser.ptv_id || sessionUser.username;
    } else {
      // Optimasi Performa: Cache publik untuk query karya portofolio publik
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    }

    if (!effectivePtvId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Parameter ptv_id atau mine=true wajib diisi.', code: 'missing_ptv_id' }));
      return;
    }

    try {
      // 1. Coba baca dari tabel ptv_kru_portofolio
      const { data: dbItems, error: dbErr } = await supabase
        .from('ptv_kru_portofolio')
        .select('*')
        .eq('ptv_id', effectivePtvId)
        .order('tanggal', { ascending: false });

      if (!dbErr && dbItems) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, items: dbItems }));
        return;
      }

      // 2. Fallback baca dari canonical_identity metadata jika tabel belum dimigrasikan
      const { data: canonData } = await supabase
        .from('canonical_identity')
        .select('id, ptv_id, metadata')
        .eq('ptv_id', effectivePtvId)
        .maybeSingle();

      const metaPortfolio = (canonData?.metadata as any)?.portofolio || [];
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, items: metaPortfolio }));
      return;
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Gagal mengambil portofolio.', code: 'server_error' }));
      return;
    }
  }

  // 2. POST: Tambah atau perbarui portofolio kru
  if (req.method === 'POST') {
    if (!sessionUser) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Sesi kru aktif diperlukan untuk mengelola portofolio.', code: 'unauthorized' }));
      return;
    }

    let body: any;
    try {
      body = await parseJsonBody(req, { maxBytes: 65536 });
    } catch (err: any) {
      res.statusCode = err.statusCode || 400;
      res.end(JSON.stringify({ error: err.message || 'Body JSON tidak valid.', code: err.code || 'invalid_json' }));
      return;
    }

    const effectivePtvId = sessionUser.ptv_id || sessionUser.username;
    if (!effectivePtvId) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Identitas kru belum memiliki PTV-ID terdaftar.', code: 'missing_ptv_id' }));
      return;
    }

    const judul = String(body.judul || '').trim();
    const platform = String(body.platform || 'Instagram').trim();
    const jenisKontribusi = String(body.jenis_kontribusi || 'Kamera').trim();
    const tanggal = String(body.tanggal || new Date().toISOString().split('T')[0]).trim();
    const linkKarya = body.link_karya ? String(body.link_karya).trim() : null;
    const itemId = body.id || `pf_${Date.now()}_${safeRandomUuid().substring(0, 8)}`;
    const nowIso = new Date().toISOString();

    if (!judul || judul.length < 3) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Judul atau deskripsi pekerjaan wajib diisi (minimal 3 karakter).', code: 'invalid_judul' }));
      return;
    }

    const itemPayload: PortfolioItem = {
      id: itemId,
      ptv_id: effectivePtvId,
      tanggal,
      platform,
      jenis_kontribusi: jenisKontribusi,
      judul,
      link_karya: linkKarya || undefined,
      updated_at: nowIso,
    };

    try {
      // Ambil canonical_identity_id
      const { data: canon } = await supabase
        .from('canonical_identity')
        .select('id, metadata')
        .eq('ptv_id', effectivePtvId)
        .maybeSingle();

      if (canon?.id) {
        itemPayload.identity_id = canon.id;
      }

      // 1. Simpan ke ptv_kru_portofolio jika tabel tersedia
      const { error: insErr } = await supabase
        .from('ptv_kru_portofolio')
        .upsert(itemPayload, { onConflict: 'id' });
      if (insErr) {
        console.warn('[Portofolio API] ptv_kru_portofolio upsert warning (fallback used):', insErr.message);
      }

      // 2. Sinkronkan ke metadata canonical_identity sebagai fallback persisten
      if (canon) {
        const existingMeta = canon.metadata || {};
        const list: PortfolioItem[] = Array.isArray(existingMeta.portofolio) ? [...existingMeta.portofolio] : [];
        const existingIdx = list.findIndex((i) => i.id === itemId);
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...itemPayload };
        } else {
          list.unshift(itemPayload);
        }
        await supabase
          .from('canonical_identity')
          .update({
            metadata: { ...existingMeta, portofolio: list },
            updated_at: nowIso,
          })
          .eq('id', canon.id);
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: 'Portofolio karya berhasil disimpan.', item: itemPayload }));
      return;
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Gagal menyimpan portofolio.', code: 'server_error' }));
      return;
    }
  }

  // 3. DELETE: Hapus item portofolio milik kru
  if (req.method === 'DELETE') {
    if (!sessionUser) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Sesi kru aktif diperlukan.', code: 'unauthorized' }));
      return;
    }

    const itemId = queryParams.get('id')?.trim();
    if (!itemId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Parameter id wajib diisi.', code: 'missing_id' }));
      return;
    }

    const effectivePtvId = sessionUser.ptv_id || sessionUser.username;

    try {
      // Hapus dari tabel ptv_kru_portofolio (dengan verifikasi kepemilikan ptv_id)
      await supabase
        .from('ptv_kru_portofolio')
        .delete()
        .eq('id', itemId)
        .eq('ptv_id', effectivePtvId);

      // Hapus dari canonical_identity metadata
      const { data: canon } = await supabase
        .from('canonical_identity')
        .select('id, metadata')
        .eq('ptv_id', effectivePtvId)
        .maybeSingle();

      if (canon) {
        const existingMeta = canon.metadata || {};
        const list: PortfolioItem[] = Array.isArray(existingMeta.portofolio) ? existingMeta.portofolio : [];
        const filtered = list.filter((i) => i.id !== itemId);
        await supabase
          .from('canonical_identity')
          .update({
            metadata: { ...existingMeta, portofolio: filtered },
            updated_at: new Date().toISOString(),
          })
          .eq('id', canon.id);
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: 'Karya portofolio berhasil dihapus.' }));
      return;
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Gagal menghapus portofolio.', code: 'server_error' }));
      return;
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${req.method} tidak didukung.`, code: 'method_not_allowed' }));
}
