import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { normalizeAcaraColor } from '../../src/products/hub/acara/utils/acaraColors';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';
import { parseJsonBody } from './auth/_utils/bodyParser';

export interface RawAcaraDbRow {
  id: string;
  nama_acara: string;
  tanggal: string;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  lokasi?: string | null;
  deskripsi?: string | null;
  status: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  poster_url?: string | null;
  tipe?: string | null;
}

export function extractValidSqlTime(raw?: string | null): string | null {
  if (!raw) return null;
  const match = String(raw).match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
  if (!match) return null;
  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  const ss = match[3] || '00';
  const hNum = parseInt(hh, 10);
  const mNum = parseInt(mm, 10);
  if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return null;
  return `${hh}:${mm}:${ss}`;
}

export function parseAcaraDbRow(row: RawAcaraDbRow, todayStr = new Date().toISOString().slice(0, 10)) {
  const ev_id = String(row.id || '');
  let desc = String(row.deskripsi || '');
  let meta: any = {};

  if (desc.includes('<!-- PTV_META:')) {
    const match = desc.match(/<!--\s*PTV_META:\s*({[\s\S]*?})\s*-->/);
    if (match && match[1]) {
      try {
        meta = JSON.parse(match[1]);
        desc = desc.replace(match[0], '').trim();
      } catch {
        // Abaikan kesalahan parsing, pertahankan deskripsi mentah
      }
    }
  }

  // Resolusi status sesuai arsitektur legacy
  const sb_st = String(row.status || 'aktif').trim().toLowerCase();
  let status = 'Mendatang';
  if (sb_st === 'selesai') {
    status = 'Selesai';
  } else if (sb_st === 'batal' || sb_st === 'dibatalkan') {
    status = 'Dibatalkan';
  } else if (meta.status_detail && (meta.status_detail.toLowerCase() === 'berjalan' || meta.status_detail.toLowerCase() === 'ongoing')) {
    status = 'Berlangsung';
  } else {
    const evDate = String(row.tanggal || '');
    if (evDate) {
      if (evDate < todayStr) {
        status = 'Selesai';
      } else if (evDate === todayStr) {
        status = 'Berlangsung';
      } else {
        status = 'Mendatang';
      }
    }
  }

  // Normalisasi penugasan kru
  const rawCrew = Array.isArray(meta.crew) ? meta.crew : [];
  const cleanCrew = rawCrew.map((c: any) => {
    if (typeof c === 'object' && c !== null) {
      return {
        id: String(c.id || c.crew_id || c.kru_id || ''),
        name: String(c.name || c.nama || c.full_name || ''),
        photo: c.photo || '',
        division: c.division || c.divisi || '',
        role: c.role || '',
        job: String(c.job || c.tugas || c.jabatan_acara || ''),
        tugas: String(c.job || c.tugas || c.jabatan_acara || '')
      };
    } else if (typeof c === 'string' && c.trim()) {
      return {
        id: '',
        name: c.trim(),
        job: '',
        tugas: ''
      };
    }
    return null;
  }).filter(Boolean);

  // Normalisasi alokasi peralatan
  const rawGear = Array.isArray(meta.gear) ? meta.gear : [];
  const cleanGear = rawGear.map((g: any) => {
    if (typeof g === 'object' && g !== null) {
      return {
        id: String(g.id || g.item_id || ''),
        item_id: String(g.id || g.item_id || ''),
        name: String(g.name || ''),
        code: String(g.code || ''),
        photo: g.photo || g.foto_url || '',
        cat: String(g.cat || ''),
        qty: Math.max(1, parseInt(g.qty, 10) || 1),
        units: Array.isArray(g.units) ? g.units : []
      };
    }
    return null;
  }).filter(Boolean);

  // Normalisasi susunan rundown acara
  const rawRundown = Array.isArray(meta.rundown) ? meta.rundown : [];
  const cleanRundown = rawRundown.map((r: any, idx: number) => ({
    id: String(r.id || `rd-${ev_id}-${idx}`),
    acara_id: ev_id,
    jam_mulai: String(r.jam_mulai || r.start_time || r.waktu_mulai || '08:00'),
    kegiatan: String(r.kegiatan || r.agenda || r.pekerjaan || ''),
    sort_key: String(r.sort_key || r.urutan || idx + 1)
  }));

  // Format string waktu
  let timeStr = meta.time || '';
  if (!timeStr && (row.waktu_mulai || row.waktu_selesai)) {
    timeStr = `${row.waktu_mulai || '08:00'}${row.waktu_selesai ? ` – ${row.waktu_selesai}` : ' – Selesai'}`;
  }
  if (!timeStr) {
    timeStr = '08:00 – Selesai';
  }

  const name = String(row.nama_acara || 'Acara PTV');
  const date = String(row.tanggal || '');
  const loc = String(row.lokasi || meta.loc || 'Studio PTV');
  const notes = desc || meta.notes || '—';
  const type = String(meta.type || row.tipe || 'internal');
  const dresscode = String(meta.dresscode || '');

  return {
    id: ev_id,
    name,
    date,
    time: timeStr,
    loc,
    status,
    notes,
    crew: cleanCrew,
    gear: cleanGear,
    rundown: cleanRundown,
    display_color: normalizeAcaraColor(meta.display_color),
    sessions: Array.isArray(meta.sessions) ? meta.sessions : [],
    notulensi_ids: Array.isArray(meta.notulensi_ids) ? meta.notulensi_ids : [],
    type,
    dresscode,
    doc: row.poster_url || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function sanitizeAcaraCrew(crewInput: any): any[] {
  if (!Array.isArray(crewInput)) return [];
  const seenKey = new Set<string>();
  const sanitized: any[] = [];

  for (const c of crewInput) {
    if (!c || (typeof c !== 'object' && typeof c !== 'string')) continue;
    let name = '';
    let id = '';
    let ptv_id = '';
    let photo = '';
    let division = '';
    let role = '';
    let job = '';

    if (typeof c === 'string') {
      name = c.trim();
      job = 'Camera Person';
    } else {
      name = String(c.name || c.nama || c.full_name || '').trim();
      id = String(c.id || c.crew_id || c.ptv_id || '');
      ptv_id = String(c.ptv_id || '');
      photo = String(c.photo || c.foto_url || '');
      division = String(c.division || c.divisi || '');
      role = String(c.role || c.jabatan || '');
      job = String(c.job || c.tugas || 'Camera Person').trim();
    }

    if (!name) continue;
    const dedupeKey = id ? `id:${id}` : `name:${name.toLowerCase()}`;
    if (seenKey.has(dedupeKey)) continue;
    seenKey.add(dedupeKey);

    sanitized.push({
      id: id || `kru-${Date.now()}-${sanitized.length}`,
      ptv_id: ptv_id || undefined,
      name,
      photo: photo || '',
      division: division || 'Technical',
      role: role || 'Kru',
      job: job || 'Camera Person',
      tugas: job || 'Camera Person',
    });
  }

  return sanitized;
}


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
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Acara.',
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
      userCaps.includes('events.view') ||
      userCaps.includes('calendar.view');

    if (!hasViewAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Acara.',
          code: 'forbidden',
        })
      );
      return;
    }
  } else if (method === 'POST') {
    const hasCreateAccess =
      userCaps.includes('events.create') ||
      userCaps.includes('events.edit') ||
      userCaps.includes('events.manage');

    if (!hasCreateAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk membuat jadwal Acara baru.',
          code: 'forbidden',
        })
      );
      return;
    }
  } else if (method === 'DELETE') {
    const hasDeleteAccess =
      userCaps.includes('events.delete') ||
      userCaps.includes('events.manage');

    if (!hasDeleteAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk menghapus data Acara.',
          code: 'forbidden',
        })
      );
      return;
    }
  } else {
    // PATCH / PUT — Memerlukan izin edit
    const hasEditAccess =
      userCaps.includes('events.edit') ||
      userCaps.includes('events.manage');

    if (!hasEditAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk mengubah data Acara.',
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

  // 5. Connect to Supabase Staging with Server-Side Service Role Key
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

  try {
    // ========================================================
    // METHOD GET: Baca seluruh data acara
    // ========================================================
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('ptv_acara')
        .select('id, nama_acara, tanggal, waktu_mulai, waktu_selesai, lokasi, deskripsi, status, created_by, created_at, updated_at')
        .order('tanggal', { ascending: false });

      if (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Gagal mengambil data acara dari database backend Staging.' }));
        return;
      }

      const mappedEvents = (data || []).map((row: RawAcaraDbRow) => parseAcaraDbRow(row));

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, count: mappedEvents.length, events: mappedEvents }));
      return;
    }

    // ========================================================
    // METHOD POST: Buat Acara Baru di Staging
    // ========================================================
    if (method === 'POST') {
      const payload = await parseJsonBody(req);
      const name = String(payload.name || '').trim();
      const date = String(payload.date || '').trim();

      if (!name) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Nama kegiatan / acara wajib diisi.', code: 'missing_name' }));
        return;
      }

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Tanggal acara wajib berformat YYYY-MM-DD.', code: 'invalid_date' }));
        return;
      }

      const timeStr = String(payload.time || '08:00 – Selesai').trim();
      const locStr = String(payload.loc || 'Studio PTV').trim();
      const notesStr = String(payload.notes || '').trim();
      const dresscodeStr = String(payload.dresscode || '').trim();
      const typeStr = String(payload.type || 'liputan').trim();

      let waktuMulai: string | null = null;
      let waktuSelesai: string | null = null;
      if (timeStr.includes('–') || timeStr.includes('-')) {
        const parts = timeStr.split(/[–-]/).map((s: string) => s.trim());
        waktuMulai = extractValidSqlTime(parts[0]);
        if (parts[1] && !parts[1].toLowerCase().includes('selesai')) {
          waktuSelesai = extractValidSqlTime(parts[1]);
        }
      } else {
        waktuMulai = extractValidSqlTime(timeStr);
      }

      let dbStatus = 'aktif';
      const normStatus = String(payload.status || 'Mendatang').toLowerCase();
      if (normStatus === 'selesai') {
        dbStatus = 'selesai';
      } else if (normStatus === 'batal' || normStatus === 'dibatalkan') {
        dbStatus = 'batal';
      }


      const meta: any = {
        type: typeStr,
        time: timeStr,
        loc: locStr,
        notes: notesStr,
        dresscode: dresscodeStr,
        crew: sanitizeAcaraCrew(payload.crew),
        gear: Array.isArray(payload.gear) ? payload.gear : [],
        rundown: Array.isArray(payload.rundown) ? payload.rundown : [],
        display_color: normalizeAcaraColor(payload.display_color),
        sessions: Array.isArray(payload.sessions) ? payload.sessions : [],
        notulensi_ids: Array.isArray(payload.notulensi_ids) ? payload.notulensi_ids : [],
      };

      const serializedMeta = `<!-- PTV_META: ${JSON.stringify(meta)} -->`;
      const fullDeskripsi = notesStr ? `${serializedMeta}\n\n${notesStr}` : serializedMeta;
      const newId = crypto.randomUUID();

      let createdByUuid: string | null = null;
      if (session.identity_id) {
        const { data: idCheck } = await supabase
          .from('canonical_identity')
          .select('id')
          .eq('id', session.identity_id)
          .maybeSingle();
        if (idCheck?.id) {
          createdByUuid = idCheck.id;
        }
      }

      const { data: insertedRow, error: errInsert } = await supabase
        .from('ptv_acara')
        .insert({
          id: newId,
          nama_acara: name,
          tanggal: date,
          waktu_mulai: waktuMulai,
          waktu_selesai: waktuSelesai,
          lokasi: locStr,
          deskripsi: fullDeskripsi,
          status: dbStatus,
          created_by: createdByUuid,
        })
        .select()
        .single();

      if (errInsert || !insertedRow) {
        console.error('[API Acara Insert Error]:', errInsert);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan acara baru ke database backend: ${errInsert?.message || 'Unknown error'}`,
            code: 'insert_failed',
          })
        );
        return;
      }

      const mapped = parseAcaraDbRow(insertedRow);
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Acara "${mapped.name}" berhasil dibuat dan tersimpan permanen di Supabase Staging.`,
          event: mapped,
        })
      );
      return;
    }

    // ========================================================
    // METHOD DELETE: Hapus Acara di Staging
    // ========================================================
    if (method === 'DELETE') {
      let eventId = '';
      const urlObj = new URL(req.url || '', 'http://localhost');
      eventId = urlObj.searchParams.get('id') || '';

      if (!eventId) {
        const payload = await parseJsonBody(req);
        eventId = String(payload.id || '').trim();
      }

      if (!eventId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'ID Acara (UUID) wajib disertakan untuk penghapusan.', code: 'missing_id' }));
        return;
      }

      const { data: existing, error: errFind } = await supabase
        .from('ptv_acara')
        .select('id, nama_acara')
        .eq('id', eventId)
        .maybeSingle();

      if (errFind || !existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Data acara tidak ditemukan di database backend Staging.', code: 'not_found' }));
        return;
      }

      const { error: errDel } = await supabase
        .from('ptv_acara')
        .delete()
        .eq('id', eventId);

      if (errDel) {
        console.error('[API Acara Delete Error]:', errDel);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menghapus acara: ${errDel.message}`, code: 'delete_failed' }));
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Acara "${existing.nama_acara}" berhasil dihapus dari database Staging.`,
          deleted_id: eventId,
        })
      );
      return;
    }

    // ========================================================
    // METHOD PATCH / PUT: Simpan UPDATE acara existing
    // ========================================================
    const payload = await parseJsonBody(req);
    const eventId = String(payload.id || '').trim();

    if (!eventId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'ID Acara (UUID) wajib disertakan untuk melakukan pembaruan.', code: 'missing_id' }));
      return;
    }

    // Validasi field nama acara jika disertakan
    if (payload.name !== undefined && !String(payload.name).trim()) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Nama kegiatan / acara tidak boleh kosong.', code: 'invalid_name' }));
      return;
    }

    // Validasi format tanggal jika disertakan
    if (payload.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date).trim())) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Format tanggal harus YYYY-MM-DD.', code: 'invalid_date' }));
      return;
    }

    // 1. Ambil baris data acara existing dari Supabase
    const { data: existing, error: errFetch } = await supabase
      .from('ptv_acara')
      .select('*')
      .eq('id', eventId)
      .single();

    if (errFetch || !existing) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Data acara tidak ditemukan di database backend Staging.', code: 'not_found' }));
      return;
    }

    // 2. Concurrency check (optimistic lock protection)
    if (payload.expected_updated_at && existing.updated_at) {
      const expTime = new Date(payload.expected_updated_at).getTime();
      const curTime = new Date(existing.updated_at).getTime();
      if (!isNaN(expTime) && !isNaN(curTime) && Math.abs(expTime - curTime) > 2000) {
        res.statusCode = 409;
        res.end(
          JSON.stringify({
            error: 'Konflik pembaruan: Data acara telah diperbarui oleh pengguna lain. Silakan muat ulang halaman sebelum menyimpan.',
            code: 'concurrency_conflict',
          })
        );
        return;
      }
    }

    // 3. Ekstrak metadata legacy PTV_META dan deskripsi plain text existing
    let existingMeta: Record<string, any> = {};
    let existingDescText = String(existing.deskripsi || '');
    const metaMatch = existingDescText.match(/<!--\s*PTV_META:\s*({[\s\S]*?})\s*-->/);
    if (metaMatch && metaMatch[1]) {
      try {
        existingMeta = JSON.parse(metaMatch[1]);
        existingDescText = existingDescText.replace(metaMatch[0], '').trim();
      } catch {
        // Pertahankan jika parsing gagal
      }
    }

    // 4. Merge metadata: pertahankan field yang tidak diedit dan simpan field baru
    const mergedMeta: Record<string, any> = { ...existingMeta };

    if (payload.time !== undefined) mergedMeta.time = String(payload.time).trim();
    if (payload.loc !== undefined) mergedMeta.loc = String(payload.loc).trim();
    if (payload.type !== undefined) mergedMeta.type = String(payload.type).trim();
    if (payload.dresscode !== undefined) mergedMeta.dresscode = String(payload.dresscode).trim();
    if (payload.display_color !== undefined) mergedMeta.display_color = normalizeAcaraColor(payload.display_color);
    if (payload.status !== undefined) mergedMeta.status_detail = String(payload.status).trim();
    if (payload.notes !== undefined) mergedMeta.notes = String(payload.notes).trim();
    if (Array.isArray(payload.crew)) mergedMeta.crew = sanitizeAcaraCrew(payload.crew);
    if (Array.isArray(payload.gear)) mergedMeta.gear = payload.gear;
    if (Array.isArray(payload.rundown)) mergedMeta.rundown = payload.rundown;
    if (Array.isArray(payload.sessions)) mergedMeta.sessions = payload.sessions;
    if (Array.isArray(payload.notulensi_ids)) mergedMeta.notulensi_ids = payload.notulensi_ids;

    const finalNotes = payload.notes !== undefined ? String(payload.notes).trim() : existingDescText;
    const serializedDeskripsi = `<!-- PTV_META: ${JSON.stringify(mergedMeta)} -->\n${finalNotes}`.trim();

    // 5. Tentukan status tabel fisik
    let nextStatus = existing.status || 'aktif';
    if (payload.status) {
      const sNorm = String(payload.status).toLowerCase();
      if (sNorm === 'selesai') {
        nextStatus = 'selesai';
      } else if (sNorm === 'batal' || sNorm === 'dibatalkan') {
        nextStatus = 'batal';
      } else {
        nextStatus = 'aktif';
      }
    }

    const nextNama = payload.name !== undefined ? String(payload.name).trim() : existing.nama_acara;
    const nextTanggal = payload.date !== undefined ? String(payload.date).trim() : existing.tanggal;
    const nextLokasi = payload.loc !== undefined ? String(payload.loc).trim() : existing.lokasi;

    // 6. Jalankan UPDATE ke Supabase Staging
    const { data: updatedRow, error: errUpdate } = await supabase
      .from('ptv_acara')
      .update({
        nama_acara: nextNama,
        tanggal: nextTanggal,
        lokasi: nextLokasi,
        deskripsi: serializedDeskripsi,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .select()
      .single();

    if (errUpdate || !updatedRow) {
      console.error('[API Acara Update Error]:', errUpdate);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Gagal memperbarui data acara di database backend: ${errUpdate?.message || 'Unknown error'}`,
          code: 'update_failed',
        })
      );
      return;
    }

    // 7. Parse kanonikal dan kembalikan hasil
    const mapped = parseAcaraDbRow(updatedRow);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: `Perubahan acara "${mapped.name}" berhasil disimpan ke database Staging.`,
        event: mapped,
      })
    );
  } catch (err: any) {
    console.error('[API Acara Fatal Error]:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Terjadi kesalahan internal server saat memproses data acara.' }));
  }
}
