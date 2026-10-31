import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';

async function parseJsonBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body) {
    if (typeof (req as any).body === 'object') return (req as any).body;
    try {
      return JSON.parse((req as any).body);
    } catch {
      throw new Error('Format data JSON tidak valid.');
    }
  }

  if (typeof req.on !== 'function') {
    return {};
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Format data JSON tidak valid.'));
      }
    });
    req.on('error', reject);
  });
}

const COLOR_TO_KATEGORI: Record<string, string> = {
  orange: 'Penting & Prioritas',
  yellow: 'Ide & Rencana',
  green: 'Info & Pengumuman',
  purple: 'Agenda & Acara',
  rose: 'Tugas & Rundown',
  emerald: 'Info & Pengumuman',
  amber: 'Ide & Rencana',
  blue: 'Penting & Prioritas',
  slate: 'Umum',
  default: 'Umum'
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  const method = req.method || 'GET';
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: `Metode HTTP ${method} tidak didukung.` }));
    return;
  }

  // 1. Session Authentication Gate (Vercel Direct Auth HttpOnly Cookie)
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Catatan.',
        code: 'unauthorized',
      })
    );
    return;
  }

  // 2. Cryptographic Token Verification (HMAC-SHA256 & Expiration)
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== 'active') {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Sesi tidak valid atau telah kedaluwarsa.',
        code: 'invalid_session',
      })
    );
    return;
  }

  // 3. RBAC & Capability Gate
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes('hub.access')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Sesi atau izin telah dicabut.' })); return; }

  if (method === 'GET') {
    const hasViewAccess =
      userCaps.includes('notes.view');

    if (!hasViewAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk melihat Catatan Bersama.',
          code: 'forbidden',
        })
      );
      return;
    }
  } else if (method === 'POST') {
    const hasCreateAccess =
      userCaps.includes('notes.create') ||
      userCaps.includes('notes.edit') ||
      userCaps.includes('notes.manage');

    if (!hasCreateAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk membuat catatan baru.',
          code: 'forbidden',
        })
      );
      return;
    }
  } else if (method === 'DELETE') {
    const hasDeleteAccess =
      userCaps.includes('notes.delete') ||
      userCaps.includes('notes.manage');

    if (!hasDeleteAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk menghapus catatan.',
          code: 'forbidden',
        })
      );
      return;
    }
  } else {
    // PATCH / PUT — Memerlukan izin edit
    const hasEditAccess =
      userCaps.includes('notes.edit') ||
      userCaps.includes('notes.manage');

    if (!hasEditAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk mengubah data catatan.',
          code: 'forbidden',
        })
      );
      return;
    }
  }

  // 4. Live Revocation / Active Account Status Check
  const isStillActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!isStillActive) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Akun telah dinonaktifkan.',
        code: 'account_inactive',
      })
    );
    return;
  }

  // 5. Query Supabase Staging with Server-Side Service Role Key
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceKey) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Konfigurasi backend database belum terdefinisi.' }));
      return;
    }

    // Anti-prod safety barrier
    if (supabaseUrl.includes('jthzuhkblxcaohiuypqq')) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Anti-prod safety barrier: Database Production is STRICT READ-ONLY.' }));
      return;
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ========================================================
    // METHOD GET: Baca data catatan
    // ========================================================
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('ptv_catatan')
        .select('id, tipe, judul, isi, warna, tags, kategori, is_pinned, created_by_id, created_by_name, created_at, updated_at')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Gagal mengambil data catatan dari database backend.' }));
        return;
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, notes: data || [] }));
      return;
    }

    // ========================================================
    // METHOD POST: Buat Catatan atau Notulensi Baru
    // ========================================================
    if (method === 'POST') {
      const payload = await parseJsonBody(req);
      const judul = String(payload.judul || '').trim();
      let rawIsi = String(payload.isi || '').trim();

      if (!judul) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Judul catatan wajib diisi.', code: 'missing_title' }));
        return;
      }

      if (!rawIsi) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Isi catatan tidak boleh kosong.', code: 'missing_content' }));
        return;
      }

      const warna = String(payload.warna || 'orange').toLowerCase().trim();
      const tipe = (payload.tipe === 'meeting_minutes' || payload.tipe === 'notulensi')
        ? 'meeting_minutes'
        : 'shared';

      let cleanTags: string[] = [];
      if (Array.isArray(payload.tags)) {
        cleanTags = payload.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean);
      }
      if (tipe === 'meeting_minutes' && !cleanTags.includes('notulensi')) {
        cleanTags.push('notulensi');
      }

      const kategori = payload.kategori || COLOR_TO_KATEGORI[warna] || 'Umum';

      // Embed meeting_meta jika ada
      if (tipe === 'meeting_minutes' && payload.meeting_meta && typeof payload.meeting_meta === 'object') {
        const metaStr = `<!-- PTV_META: ${JSON.stringify(payload.meeting_meta)} -->`;
        if (!rawIsi.includes('<!-- PTV_META:')) {
          rawIsi = `${metaStr}\n\n${rawIsi}`;
        }
      }

      const newId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const authorName = session.full_name || 'Kru Studio';
      const authorId = session.account_id || 'PTV-001';

      const { data: inserted, error: insertErr } = await supabase
        .from('ptv_catatan')
        .insert({
          id: newId,
          judul,
          isi: rawIsi,
          warna,
          tipe,
          tags: cleanTags,
          kategori,
          is_pinned: Boolean(payload.is_pinned),
          created_by_name: authorName,
          created_by_id: authorId,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        console.error('[API Catatan Insert Error]:', insertErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan catatan baru ke database Staging: ${insertErr?.message || 'Unknown error'}`,
            code: 'insert_failed',
          })
        );
        return;
      }

      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Catatan "${inserted.judul}" berhasil disimpan ke Supabase Staging.`,
          note: inserted,
        })
      );
      return;
    }

    // ========================================================
    // METHOD DELETE: Hapus Catatan
    // ========================================================
    if (method === 'DELETE') {
      let noteId = '';
      const urlObj = new URL(req.url || '', 'http://localhost');
      noteId = urlObj.searchParams.get('id') || '';

      if (!noteId) {
        const payload = await parseJsonBody(req);
        noteId = String(payload.id || '').trim();
      }

      if (!noteId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'ID Catatan (UUID) wajib disertakan untuk penghapusan.', code: 'missing_id' }));
        return;
      }

      const { data: existing, error: errFind } = await supabase
        .from('ptv_catatan')
        .select('id, judul')
        .eq('id', noteId)
        .maybeSingle();

      if (errFind || !existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Data catatan tidak ditemukan di database backend Staging.', code: 'not_found' }));
        return;
      }

      const { error: errDel } = await supabase
        .from('ptv_catatan')
        .delete()
        .eq('id', noteId);

      if (errDel) {
        console.error('[API Catatan Delete Error]:', errDel);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menghapus catatan: ${errDel.message}`, code: 'delete_failed' }));
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Catatan "${existing.judul}" berhasil dihapus dari database Staging.`,
          deleted_id: noteId,
        })
      );
      return;
    }

    // ========================================================
    // METHOD PATCH / PUT: Update Catatan Existing
    // ========================================================
    const payload = await parseJsonBody(req);
    const noteId = String(payload.id || '').trim();

    if (!noteId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'ID Catatan (UUID) wajib disertakan untuk pembaruan.', code: 'missing_id' }));
      return;
    }

    const { data: existing, error: errFind } = await supabase
      .from('ptv_catatan')
      .select('*')
      .eq('id', noteId)
      .maybeSingle();

    if (errFind || !existing) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Catatan tidak ditemukan dalam database.', code: 'not_found' }));
      return;
    }

    let nextJudul = existing.judul;
    if (payload.judul !== undefined) {
      nextJudul = String(payload.judul).trim();
      if (!nextJudul) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Judul catatan tidak boleh kosong.', code: 'invalid_title' }));
        return;
      }
    }

    let nextIsi = existing.isi;
    if (payload.isi !== undefined) {
      nextIsi = String(payload.isi).trim();
      if (!nextIsi) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Isi catatan tidak boleh kosong.', code: 'invalid_content' }));
        return;
      }
    }

    // Update meeting_meta jika ada
    const nextTipe = payload.tipe !== undefined ? payload.tipe : existing.tipe;
    if (payload.meeting_meta && typeof payload.meeting_meta === 'object' && nextTipe === 'meeting_minutes') {
      const metaStr = `<!-- PTV_META: ${JSON.stringify(payload.meeting_meta)} -->`;
      if (nextIsi.includes('<!-- PTV_META:')) {
        nextIsi = nextIsi.replace(/<!--\s*PTV_META:[\s\S]*?-->/, metaStr);
      } else {
        nextIsi = `${metaStr}\n\n${nextIsi}`;
      }
    }

    const nextWarna = payload.warna !== undefined ? String(payload.warna).toLowerCase().trim() : existing.warna;
    const nextKategori = payload.kategori || COLOR_TO_KATEGORI[nextWarna] || existing.kategori;
    const nextIsPinned = payload.is_pinned !== undefined ? Boolean(payload.is_pinned) : existing.is_pinned;

    let nextTags = existing.tags;
    if (Array.isArray(payload.tags)) {
      nextTags = payload.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean);
    }
    if (nextTipe === 'meeting_minutes' && !nextTags.includes('notulensi')) {
      nextTags.push('notulensi');
    }

    const { data: updated, error: errUpdate } = await supabase
      .from('ptv_catatan')
      .update({
        judul: nextJudul,
        isi: nextIsi,
        warna: nextWarna,
        tipe: nextTipe,
        tags: nextTags,
        kategori: nextKategori,
        is_pinned: nextIsPinned,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single();

    if (errUpdate || !updated) {
      console.error('[API Catatan Update Error]:', errUpdate);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Gagal memperbarui catatan di database Staging: ${errUpdate?.message || 'Unknown error'}`,
          code: 'update_failed',
        })
      );
      return;
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: `Catatan "${updated.judul}" berhasil diperbarui.`,
        note: updated,
      })
    );
  } catch (err: any) {
    console.error('[API Catatan Fatal Error]:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Terjadi kesalahan internal pada server.' }));
  }
}
