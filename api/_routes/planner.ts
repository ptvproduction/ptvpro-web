import type { ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { verifyAccountStatusLive } from './auth/_utils/identity';
import { parseJsonBody } from './auth/_utils/bodyParser';
import { withAuth, type AuthenticatedRequest } from './auth/_utils/middleware';
import { parsePlannerDbRow, RawPlannerDbRow } from '../../src/products/hub/kalender/kalenderService';

export { parsePlannerDbRow };
export type { RawPlannerDbRow };


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function plannerHandler(req: AuthenticatedRequest, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  const method = req.method || 'GET';
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: `Metode HTTP ${method} tidak didukung.` }));
    return;
  }

  const { session, userCaps } = req;

  if (method === 'GET') {
    const hasViewAccess =
      userCaps.includes('calendar.view') ||
      userCaps.includes('events.view');

    if (!hasViewAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Kalender & Momentum.',
          code: 'forbidden',
        })
      );
      return;
    }
  } else {
    // Write operations: POST, PATCH, PUT, DELETE
    const hasWriteAccess =
      userCaps.includes('calendar.edit') ||
      userCaps.includes('events.edit') ||
      userCaps.includes('events.manage');

    if (!hasWriteAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk menambah, mengedit, atau menghapus Content Planner.',
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

  const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost:5174'}`);

  try {
    // ========================================================
    // METHOD GET: Baca seluruh data planner
    // ========================================================
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('ptv_content_planner')
        .select('id, judul, platform, status, target_tayang, pic_id, catatan, created_at, updated_at')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[API Planner GET Error]:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Gagal mengambil data momentum dari database backend Staging.' }));
        return;
      }

      const mappedPlanners = (data || []).map((row: RawPlannerDbRow) => parsePlannerDbRow(row));

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, count: mappedPlanners.length, planners: mappedPlanners }));
      return;
    }

    // ========================================================
    // Parse JSON Request Body for Write Operations
    // ========================================================
    let body: any = {};
    try {
      body = await parseJsonBody(req);
    } catch (parseErr: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: parseErr.message || 'Format JSON tidak valid.' }));
      return;
    }

    // ========================================================
    // METHOD POST: Tambah momentum baru
    // ========================================================
    if (method === 'POST') {
      const judul = String(body.judul_momentum || body.judul || '').trim();
      if (!judul) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Judul momentum / acara konten wajib diisi.' }));
        return;
      }

      const kategori = String(body.kategori || 'Event Masehi').trim();
      const subkategori = body.subkategori ? String(body.subkategori).trim() : '';
      const platform = subkategori || body.bulan_hijriah || kategori;
      const targetTayang = body.tanggal_mulai ? String(body.tanggal_mulai).trim() : null;
      const recurrenceType = String(body.recurrence_type || 'sekali_tayang').trim();
      const recurrenceRule = typeof body.recurrence_rule === 'object' && body.recurrence_rule !== null ? body.recurrence_rule : {};

      const recMeta: any = {
        type: recurrenceType,
        rule: recurrenceRule,
        kategori,
        subkategori: subkategori || undefined,
        bulan_hijriah: body.bulan_hijriah || undefined,
        tanggal_hijriah: body.tanggal_hijriah !== null && body.tanggal_hijriah !== undefined ? Number(body.tanggal_hijriah) : undefined,
        daftar_konten: Array.isArray(body.daftar_konten) ? body.daftar_konten.map((s: any) => String(s).trim()).filter(Boolean) : undefined,
        referensi_url: body.referensi_url ? String(body.referensi_url).trim() : undefined,
      };

      const rawDeskripsi = String(body.deskripsi || '').replace(/<!--\s*PTV_RECURRENCE:[\s\S]*?-->/g, '').trim();
      const finalCatatan = `<!-- PTV_RECURRENCE: ${JSON.stringify(recMeta)} -->${rawDeskripsi ? '\n' + rawDeskripsi : ''}`;

      const newId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const insertPayload = {
        id: newId,
        judul,
        platform,
        status: 'draft',
        target_tayang: targetTayang,
        pic_id: null,
        catatan: finalCatatan,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('ptv_content_planner')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        console.error('[API Planner POST Error]:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menyimpan momentum ke Supabase Staging: ${error.message}` }));
        return;
      }

      const createdItem = parsePlannerDbRow(data as RawPlannerDbRow);
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: 'Data Content Planner berhasil disimpan ke Supabase Staging.',
          planner: createdItem,
        })
      );
      return;
    }

    // ========================================================
    // METHOD PATCH / PUT: Perbarui momentum existing
    // ========================================================
    if (method === 'PATCH' || method === 'PUT') {
      const id = String(body.id || urlObj.searchParams.get('id') || '').trim();
      if (!id || !UUID_REGEX.test(id)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'ID momentum valid (UUID) wajib disertakan untuk pembaruan.' }));
        return;
      }

      // Pastikan record ada di Supabase Staging
      const { data: existing, error: findError } = await supabase
        .from('ptv_content_planner')
        .select('*')
        .eq('id', id)
        .single();

      if (findError || !existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Data momentum tidak ditemukan di database backend Staging.' }));
        return;
      }

      const updateFields: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.judul_momentum !== undefined || body.judul !== undefined) {
        const j = String(body.judul_momentum || body.judul || '').trim();
        if (!j) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Judul momentum tidak boleh kosong.' }));
          return;
        }
        updateFields.judul = j;
      }

      if (body.subkategori !== undefined || body.kategori !== undefined || body.bulan_hijriah !== undefined) {
        const sub = body.subkategori !== undefined ? String(body.subkategori).trim() : '';
        const kat = body.kategori !== undefined ? String(body.kategori).trim() : '';
        const bh = body.bulan_hijriah !== undefined ? String(body.bulan_hijriah).trim() : '';
        updateFields.platform = sub || bh || kat || existing.platform;
      }

      if (body.tanggal_mulai !== undefined) {
        updateFields.target_tayang = body.tanggal_mulai ? String(body.tanggal_mulai).trim() : null;
      }

      // Re-synthesize catatan jika ada pembaruan konten/recurrence
      let existingRecMeta: any = {};
      let existingDesc = String(existing.catatan || '');
      const match = existingDesc.match(/<!--\s*PTV_RECURRENCE:\s*(\{[\s\S]*?\})\s*-->/);
      if (match && match[1]) {
        try {
          existingRecMeta = JSON.parse(match[1]);
          existingDesc = existingDesc.replace(match[0], '').trim();
        } catch (_err) {
          void _err;
        }
      }

      const updatedRecMeta = {
        ...existingRecMeta,
        type: body.recurrence_type !== undefined ? String(body.recurrence_type).trim() : existingRecMeta.type,
        rule: body.recurrence_rule !== undefined ? body.recurrence_rule : existingRecMeta.rule,
        kategori: body.kategori !== undefined ? String(body.kategori).trim() : existingRecMeta.kategori,
        subkategori: body.subkategori !== undefined ? String(body.subkategori).trim() : existingRecMeta.subkategori,
        bulan_hijriah: body.bulan_hijriah !== undefined ? body.bulan_hijriah : existingRecMeta.bulan_hijriah,
        tanggal_hijriah: body.tanggal_hijriah !== undefined ? body.tanggal_hijriah : existingRecMeta.tanggal_hijriah,
        daftar_konten: body.daftar_konten !== undefined
          ? (Array.isArray(body.daftar_konten) ? body.daftar_konten.map((s: any) => String(s).trim()).filter(Boolean) : [])
          : existingRecMeta.daftar_konten,
        referensi_url: body.referensi_url !== undefined ? String(body.referensi_url).trim() : existingRecMeta.referensi_url,
      };

      const finalDeskripsi = body.deskripsi !== undefined
        ? String(body.deskripsi).replace(/<!--\s*PTV_RECURRENCE:[\s\S]*?-->/g, '').trim()
        : existingDesc;

      updateFields.catatan = `<!-- PTV_RECURRENCE: ${JSON.stringify(updatedRecMeta)} -->${finalDeskripsi ? '\n' + finalDeskripsi : ''}`;

      const { data: updated, error: updateError } = await supabase
        .from('ptv_content_planner')
        .update(updateFields)
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('[API Planner PATCH Error]:', updateError);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal memperbarui momentum di Supabase: ${updateError.message}` }));
        return;
      }

      const updatedItem = parsePlannerDbRow(updated as RawPlannerDbRow);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: 'Data Content Planner berhasil diperbarui di Supabase Staging.',
          planner: updatedItem,
        })
      );
      return;
    }

    // ========================================================
    // METHOD DELETE: Hapus momentum
    // ========================================================
    if (method === 'DELETE') {
      const id = String(body.id || urlObj.searchParams.get('id') || '').trim();
      if (!id || !UUID_REGEX.test(id)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'ID momentum valid (UUID) wajib disertakan untuk penghapusan.' }));
        return;
      }

      // Pastikan record ada sebelum dihapus
      const { data: existing, error: findError } = await supabase
        .from('ptv_content_planner')
        .select('id, judul')
        .eq('id', id)
        .single();

      if (findError || !existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Data momentum yang akan dihapus tidak ditemukan di Staging.' }));
        return;
      }

      const { error: deleteError } = await supabase
        .from('ptv_content_planner')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[API Planner DELETE Error]:', deleteError);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menghapus momentum dari Supabase Staging: ${deleteError.message}` }));
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: 'Data Content Planner berhasil dihapus dari Supabase Staging.',
          id,
        })
      );
      return;
    }
  } catch (err: any) {
    console.error('[API Planner Unhandled Error]:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Terjadi kesalahan internal server saat memproses data momentum.' }));
  }
}



export default withAuth(plannerHandler, {
  unauthorizedMessage: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Kalender & Momentum."
});