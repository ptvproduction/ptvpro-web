import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyAccountStatusLive } from './auth/_utils/identity';
import { parseJsonBody } from './auth/_utils/bodyParser';
import { withAuth, type AuthenticatedRequest } from './auth/_utils/middleware';

export interface RawPengumumanDbRow {
  id: string;
  judul: string;
  konten: string;
  is_aktif?: boolean | null;
  prioritas?: string | null;
  status?: string | null;
  target_divisi?: string | null;
  berlaku_sampai?: string | null;
  created_at: string;
  created_by?: string | null;
  penulis_id?: string | null;
  updated_at?: string | null;
  thumbnail_url?: string | null;
}

export interface BroadcastAnnouncementDTO {
  id: string;
  title: string;
  body: string;
  prio: 'normal' | 'penting';
  by: string;
  date: string;
  created_at: number;
  target_divisi?: string;
  is_aktif?: boolean;
  berlaku_sampai?: string | null;
}

export function mapDbPengumumanToDTO(row: RawPengumumanDbRow): BroadcastAnnouncementDTO {
  const prioRaw = (row.prioritas || '').toLowerCase().trim();
  const isPenting =
    prioRaw === 'penting' ||
    prioRaw === 'urgent' ||
    prioRaw === 'high';
  const createdDate = row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const createdMs = row.created_at ? new Date(row.created_at).getTime() : Date.now();

  return {
    id: row.id,
    title: row.judul || 'Pengumuman Studio',
    body: row.konten || '',
    prio: isPenting ? 'penting' : 'normal',
    by: row.created_by || 'Redaksi PTV',
    date: createdDate,
    created_at: createdMs,
    target_divisi: row.target_divisi || 'Semua',
    is_aktif: row.is_aktif ?? true,
    berlaku_sampai: row.berlaku_sampai || null,
  };
}


async function broadcastHandler(req: AuthenticatedRequest, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  const method = req.method || 'GET';
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost:5174'}`);
  const { session, userCaps } = req;

  const canView = userCaps.includes('broadcast.view') || userCaps.includes('hub.access');
  if (!canView) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Anda tidak memiliki izin untuk melihat pengumuman studio.',
        code: 'forbidden_broadcast_access',
      })
    );
    return;
  }

  const canDispatch =
    userCaps.includes('broadcast.dispatch') ||
    userCaps.includes('system.manage') ||
    userCaps.includes('role:eksekutif') ||
    userCaps.includes('role:administrasi') ||
    userCaps.includes('role:pengelola') ||
    userCaps.includes('role:developer');

  // 3. Database connection & Account status check
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: 'Konfigurasi backend Staging Supabase belum lengkap (URL atau Service Role Key hilang).',
        code: 'server_configuration_error',
      })
    );
    return;
  }

  const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!accountActive) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Akun Anda telah dinonaktifkan dari sistem.',
        code: 'account_inactive',
      })
    );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET: Read Active Announcements from ptv_pengumuman
  // ───────────────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    try {
      const includeInactive = urlObj.searchParams.get('includeInactive') === 'true' && canDispatch;
      let query = supabase
        .from('ptv_pengumuman')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!includeInactive) {
        query = query.eq('is_aktif', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[API Broadcast Error]:', error);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memuat pengumuman dari database Staging: ${error.message}`,
            code: 'database_query_error',
          })
        );
        return;
      }

      const activeRows = (data || []).filter((row: RawPengumumanDbRow) => {
        if (includeInactive) return true;
        if (row.is_aktif === false) return false;
        if (row.berlaku_sampai) {
          return new Date(row.berlaku_sampai).getTime() > Date.now();
        }
        return true;
      });

      const announcements = activeRows.map(mapDbPengumumanToDTO);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          count: announcements.length,
          announcements,
        })
      );
    } catch (err: any) {
      console.error('[API Broadcast Exception]:', err);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Kesalahan server internal saat memuat pengumuman: ${err.message || 'Unknown error'}`,
          code: 'internal_server_error',
        })
      );
    }
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST / PUT / DELETE: Mutations (Requires broadcast.dispatch or admin)
  // ───────────────────────────────────────────────────────────────────────────
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (!canDispatch) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Izin penerbitan siaran (broadcast.dispatch) diperlukan untuk mengubah pengumuman studio.',
          code: 'forbidden_broadcast_dispatch',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req);
      const action = body.action || urlObj.searchParams.get('action') || (method === 'DELETE' ? 'delete' : 'create');
      const actorName = session.full_name || session.username || 'Redaksi PTV';
      const now = new Date().toISOString();

      // 1. CREATE ANNOUNCEMENT
      if (action === 'create' || (method === 'POST' && !body.action)) {
        const title = (body.title || body.judul || '').trim();
        const content = (body.body || body.konten || '').trim();
        const prio = body.prio === 'penting' ? 'penting' : 'normal';
        const targetDivisi = body.target_divisi || 'Semua';
        const id = body.id || randomUUID();

        if (!title || !content) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Judul dan isi pengumuman wajib diisi.', code: 'missing_fields' }));
          return;
        }

        let berlakuSampai: string | null = null;
        if (typeof body.durasi_hari === 'number' && body.durasi_hari > 0) {
          berlakuSampai = new Date(Date.now() + body.durasi_hari * 86400000).toISOString();
        } else if (body.durasi_hari && !isNaN(Number(body.durasi_hari)) && Number(body.durasi_hari) > 0) {
          berlakuSampai = new Date(Date.now() + Number(body.durasi_hari) * 86400000).toISOString();
        } else if (body.berlaku_sampai) {
          berlakuSampai = new Date(body.berlaku_sampai).toISOString();
        }

        const insertPayload: any = {
          id,
          judul: title,
          konten: content,
          prioritas: prio,
          is_aktif: true,
          target_divisi: targetDivisi,
          berlaku_sampai: berlakuSampai,
          created_by: actorName,
          penulis_id: session.account_id,
          created_at: now,
          updated_at: now,
        };

        const { error: insErr } = await supabase
          .from('ptv_pengumuman')
          .insert(insertPayload);

        if (insErr) {
          throw new Error(`Gagal menyimpan pengumuman ke cloud: ${insErr.message}`);
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: 'Pengumuman studio berhasil diterbitkan ke cloud staging.',
            announcement: {
              id,
              title,
              body: content,
              prio,
              by: actorName,
              date: now.slice(0, 10),
              created_at: Date.now(),
              target_divisi: targetDivisi,
              berlaku_sampai: berlakuSampai,
            },
          })
        );
        return;
      }

      // 2. UPDATE ANNOUNCEMENT
      if (action === 'update' || method === 'PUT') {
        const id = body.id || urlObj.searchParams.get('id');
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'ID pengumuman wajib disertakan untuk pembaruan.', code: 'missing_id' }));
          return;
        }

        const updates: any = {
          updated_at: now,
        };
        if (body.title !== undefined || body.judul !== undefined) {
          updates.judul = (body.title || body.judul).trim();
        }
        if (body.body !== undefined || body.konten !== undefined) {
          updates.konten = (body.body || body.konten).trim();
        }
        if (body.prio !== undefined || body.prioritas !== undefined) {
          updates.prioritas = (body.prio || body.prioritas) === 'penting' ? 'penting' : 'normal';
        }
        if (body.is_aktif !== undefined) {
          updates.is_aktif = Boolean(body.is_aktif);
        }
        if (body.target_divisi !== undefined) {
          updates.target_divisi = body.target_divisi;
        }
        if (body.durasi_hari !== undefined) {
          const dHari = Number(body.durasi_hari);
          if (!isNaN(dHari) && dHari > 0) {
            updates.berlaku_sampai = new Date(Date.now() + dHari * 86400000).toISOString();
          } else {
            updates.berlaku_sampai = null;
          }
        } else if (body.berlaku_sampai !== undefined) {
          updates.berlaku_sampai = body.berlaku_sampai ? new Date(body.berlaku_sampai).toISOString() : null;
        }

        const { error: updErr } = await supabase
          .from('ptv_pengumuman')
          .update(updates)
          .eq('id', id);

        if (updErr) {
          throw new Error(`Gagal memperbarui pengumuman di cloud: ${updErr.message}`);
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Pengumuman ${id} berhasil diperbarui di cloud staging.`,
          })
        );
        return;
      }

      // 3. DELETE / ARCHIVE ANNOUNCEMENT
      if (action === 'delete' || method === 'DELETE') {
        const id = body.id || urlObj.searchParams.get('id');
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'ID pengumuman wajib disertakan untuk penghapusan.', code: 'missing_id' }));
          return;
        }

        // Soft delete / deactivate or hard delete
        const permanent = urlObj.searchParams.get('permanent') === 'true' || body.permanent === true;
        if (permanent) {
          const { error: delErr } = await supabase
            .from('ptv_pengumuman')
            .delete()
            .eq('id', id);
          if (delErr) throw delErr;
        } else {
          const { error: updErr } = await supabase
            .from('ptv_pengumuman')
            .update({ is_aktif: false, updated_at: now })
            .eq('id', id);
          if (updErr) throw updErr;
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Pengumuman ${id} berhasil dihapus dari siaran aktif.`,
          })
        );
        return;
      }

      res.statusCode = 400;
      res.end(JSON.stringify({ error: `Aksi "${action}" tidak dikenali.`, code: 'unknown_action' }));
    } catch (err: any) {
      console.error('[API Broadcast Mutation Error]:', err);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Gagal memproses perubahan pengumuman: ${err.message || 'Unknown error'}`,
          code: 'broadcast_mutation_error',
        })
      );
    }
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${method} tidak didukung.`, code: 'method_not_allowed' }));
}

/**
 * Programmatic request runner for regression testing and direct controller invocation
 */
export async function handleBroadcastApiRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}): Promise<{ status: number; body: any }> {
  let statusCode = 200;
  let responseData: any = null;

  const mockReq = {
    method: options.method || 'GET',
    url: options.url || '/api/broadcast',
    headers: options.headers || {},
  } as unknown as IncomingMessage;

  const mockRes = {
    setHeader: () => {},
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    end: (chunk: string) => {
      try {
        responseData = JSON.parse(chunk);
      } catch {
        responseData = chunk;
      }
    },
  } as unknown as ServerResponse;

  await broadcastHandler(mockReq as any, mockRes);
  return { status: statusCode, body: responseData };
}


export default withAuth(broadcastHandler, {
  unauthorizedMessage: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses siaran pengumuman."
});