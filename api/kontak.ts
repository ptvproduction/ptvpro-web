import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';
import { safeRandomUuid } from '../src/shared/utils/uuid';

import {
  categorizeExternalContact,
  classifyInternalContact,
  KNOWN_BROKEN_PHOTO_PTV_IDS,
  type RawKontakEksternalDbRow,
  type EnrichedExternalContact,
  type EnrichedInternalContact,
} from '../src/products/hub/kontak/kontakMapper';

export type { RawKontakEksternalDbRow, EnrichedExternalContact, EnrichedInternalContact };
export { categorizeExternalContact, classifyInternalContact };

/**
 * Authoritative set of known synthetic/test records excluded from canonical contact directories.
 */
const KNOWN_TEST_RECORD_PTV_IDS = new Set(['PTV-UJI-2712']);


async function parseJsonBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body !== undefined && typeof (req as any).body === 'object') {
    return (req as any).body;
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload terlalu besar (maksimal 2MB).'));
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  const method = (req.method || 'GET').toUpperCase();
  // Immediately buffer stream before any async awaits to prevent race condition
  const bodyPromise = ['POST', 'PUT', 'PATCH'].includes(method) ? parseJsonBody(req) : Promise.resolve({});

  // 0. Only allow GET, POST, PUT, PATCH, DELETE
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        error: `Metode HTTP ${method} tidak didukung pada modul Kontak.`,
        code: 'method_not_allowed',
      })
    );
    return;
  }

  // 1. Session Authentication Gate
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses direktori kontak.',
        code: 'unauthorized',
      })
    );
    return;
  }

  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.',
        code: 'session_expired',
      })
    );
    return;
  }

  // 2. Database connection & Anti-Production Barrier
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

  // Anti-Production write barrier
  if (method !== 'GET' && supabaseUrl.includes('jthzuhkblxcaohiuypqq')) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Database Production (jthzuhkblxcaohiuypqq) berstatus STRICT READ-ONLY. Mutasi kontak dilarang keras.',
        code: 'production_write_forbidden',
      })
    );
    return;
  }

  // Determine request mode: 'eksternal' or 'internal'
  const urlObj = new URL(req.url || '', 'http://localhost');
  const type = (urlObj.searchParams.get('type') || 'eksternal').toLowerCase();

  // For POST, PUT, PATCH, DELETE: must be external contacts only
  if (method !== 'GET' && type !== 'eksternal') {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: 'Modul Kontak Internal bersumber dari data keanggotaan kru dan pengarah; mutasi langsung tidak diizinkan melalui endpoint ini.',
        code: 'internal_contacts_read_only',
      })
    );
    return;
  }

  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes('hub.access')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Sesi atau izin telah dicabut.' })); return; }
  const isPrivileged =
    userCaps.includes('contacts.external.manage') ||
    userCaps.includes('crew.create') ||
    (Array.isArray(session.capabilities) && session.capabilities.includes('contacts.external.manage')) ||
    (Array.isArray(session.assigned_profiles) && session.assigned_profiles.includes('root_executive'));

  // RBAC mutation permission check
  if (method !== 'GET' && !isPrivileged) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Anda tidak memiliki izin untuk mengelola Kontak Eksternal (perlu izin contacts.external.manage atau hak admin/eksekutif).',
        code: 'forbidden',
      })
    );
    return;
  }

  // 3. Active Account Check
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

  // RBAC read validation
  if (method === 'GET') {
    if (type === 'internal') {
      // Keputusan operator: Semua pengguna PTV Hub dengan sesi login valid dan aktif
      // diizinkan mengakses direktori Kontak Internal beserta nomor WhatsApp tanpa capability tambahan.
    } else {
      const canViewExternal =
        userCaps.includes('contacts.external.view') ||
        isPrivileged;

      if (!canViewExternal) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            error: 'Akses ditolak: Anda tidak memiliki izin untuk melihat direktori kontak eksternal.',
            code: 'forbidden',
          })
        );
        return;
      }
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // === METHOD GET ===
    if (method === 'GET') {
      if (type === 'eksternal') {
        const { data: rows, error: qErr } = await supabase
          .from('ptv_kontak_eksternal')
          .select('*')
          .order('created_at', { ascending: false });

        if (qErr) {
          console.error('[API Kontak] Error fetching ptv_kontak_eksternal:', qErr);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: `Gagal memuat kontak eksternal dari database Staging: ${qErr.message}`,
              code: 'database_query_error',
            })
          );
          return;
        }

        const contacts: EnrichedExternalContact[] = (rows || []).map((r: RawKontakEksternalDbRow) => {
          const cat = categorizeExternalContact(r);
          return {
            id: r.id,
            nama: r.nama_kontak || 'Tanpa Nama',
            kategori: cat.peran,
            jabatan: r.peran || '-',
            organisasi: r.instansi || 'Lembaga',
            lembaga: cat.lembaga,
            nomor_telepon: r.telepon || undefined,
            whatsapp: r.telepon || undefined,
            email: r.email || undefined,
            catatan: r.catatan || undefined,
            status: 'Aktif',
          };
        });

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            mode: 'eksternal',
            count: contacts.length,
            contacts,
          })
        );
        return;
      }

      if (type === 'internal') {
        const { data: crewRows, error: cErr } = await supabase
          .from('legacy_archive_kru')
          .select('*')
          .order('ptv_id', { ascending: true });

        if (cErr) {
          console.error('[API Kontak] Error fetching legacy_archive_kru for internal contacts:', cErr);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: `Gagal memuat kontak kru dari database Staging: ${cErr.message}`,
              code: 'database_query_error',
            })
          );
          return;
        }

        const seenPtv = new Set<string>();
        const seenCanonId = new Set<string>();
        const crewContacts: EnrichedInternalContact[] = [];

        for (const raw of (crewRows || []) as any[]) {
          if (!raw.ptv_id || seenPtv.has(raw.ptv_id)) continue;
          if (raw.metadata_json?.is_duplicate_archive === true) continue;
          if (raw.canonical_identity_id) {
            if (seenCanonId.has(raw.canonical_identity_id)) continue;
            seenCanonId.add(raw.canonical_identity_id);
          }
          seenPtv.add(raw.ptv_id);

          // 1. Exclude synthetic test records (e.g. PTV-UJI-2712) by authoritative ID and quarantine status
          if (
            KNOWN_TEST_RECORD_PTV_IDS.has(raw.ptv_id) ||
            raw.status === 'test_quarantine' ||
            raw.reconciliation_status === 'quarantined' ||
            (raw.source_key && raw.source_key.includes('test_quarantine'))
          ) {
            continue;
          }

          let fullName = raw.full_name || 'Kru PTV';
          let position = raw.jabatan || 'Kru Operasional';
          let angkatan = raw.angkatan || undefined;
          let divisi = raw.divisi || undefined;
          let fotoUrl = raw.photo_url || (raw.metadata_json && raw.metadata_json.avatar_url) || undefined;

          // 2. Reconcile PTV-017 to authentic historical identity (Muhammad Hamdan Yuwafi Sulaim)
          if (raw.ptv_id === 'PTV-017' && (fullName.includes('Testing') || fullName.includes('Uji'))) {
            fullName = 'Muhammad Hamdan Yuwafi Sulaim';
            position = 'Kru';
            angkatan = '12';
            divisi = 'Technical';
            fotoUrl = 'https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp';
          }

          // 3. Exclude known broken 404 photo URLs
          if (KNOWN_BROKEN_PHOTO_PTV_IDS.has(raw.ptv_id)) {
            fotoUrl = undefined;
          }

          const rawStatus = (raw.status || 'aktif').toLowerCase().trim();
          const isAktif =
            rawStatus === 'aktif' ||
            (!['nonaktif', 'non-aktif', 'non aktif', 'pasif', 'alumni', 'inactive'].includes(rawStatus) && rawStatus !== '');

          const adapter = {
            div: divisi || null,
            pos: position || null,
            status: isAktif ? 'Aktif' : 'Nonaktif',
            role: raw.role || (raw.metadata_json && raw.metadata_json.role_legacy) || 'kru',
            name: fullName,
            ptvId: raw.ptv_id,
          };

          const category = classifyInternalContact(adapter);
          if (!category) continue; // 43 uncategorized nonaktif crew excluded

          let title_prefix: string | undefined;
          if (/^KH\./i.test(fullName)) title_prefix = 'KH.';
          else if (/^Dr\./i.test(fullName)) title_prefix = 'Dr.';
          else if (/^Agus/i.test(fullName) || /^Gus/i.test(fullName)) title_prefix = 'Gus';
          else if (/^Ust\./i.test(fullName) || /^Ustadz/i.test(fullName)) title_prefix = 'Ust.';
          else if (/^Habib/i.test(fullName) || /^Alm\. Habib/i.test(fullName)) title_prefix = 'Habib';

          let unit = divisi ? `Divisi ${divisi}` : 'Progresif TV Studio';
          if (category === 'Pembina') {
            unit = 'Dewan Pembina PTV';
          } else if (category === 'Pengarah') {
            unit = 'Pimpinan & Pengarah Lembaga';
          }

          // 4. Resolve authentic phone/WhatsApp number directly from Staging PostgreSQL database
          let phone: string | undefined =
            (raw.metadata_json && (raw.metadata_json.telepon || raw.metadata_json.wa || raw.metadata_json.phone)) ||
            raw.telepon ||
            raw.telepon_masked ||
            undefined;

          if (raw.ptv_id === 'PTV-017') {
            phone = undefined; // PTV-017 has no authentic phone in local.sql
          }

          const email = raw.email || raw.email_masked || undefined;

          // 5. Authentic Phone Access for Authenticated PTV Hub Sessions
          // Operator policy: All authenticated PTV Hub users can view WhatsApp numbers and use communication buttons.
          // Unauthenticated requests are rejected at the session gate (HTTP 401).
          // If a crew member does not have an authentic unmasked number in the database, keep it undefined or masked.

          crewContacts.push({
            id: `int-${raw.ptv_id}`,
            full_name: fullName,
            title_prefix,
            position,
            unit,
            category,
            phone: phone || undefined,
            email: email || undefined,
            foto_url: fotoUrl,
            notes: angkatan ? `Kru Angkatan ${angkatan} PTV` : (category === 'Pembina' || category === 'Pengarah' ? 'Figur Kehormatan / Pengarah PTV' : undefined),
            crew_id: raw.archive_id || raw.ptv_id,
            ptv_id: raw.ptv_id,
            status: isAktif ? 'Aktif' : 'Nonaktif',
            angkatan,
            divisi,
          });
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            mode: 'internal',
            count: crewContacts.length,
            contacts: crewContacts,
          })
        );
        return;
      }

      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error: `Parameter 'type' tidak valid: ${type}. Gunakan 'eksternal' atau 'internal'.`,
          code: 'invalid_parameter',
        })
      );
      return;
    }

    // === METHOD POST: Tambah Kontak Eksternal ===
    if (method === 'POST') {
      const payload = await bodyPromise;
      const nama = typeof payload.nama === 'string' ? payload.nama.trim() : (typeof payload.nama_kontak === 'string' ? payload.nama_kontak.trim() : '');

      if (!nama || nama.length < 2) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Validasi gagal: Nama kontak wajib diisi (minimal 2 karakter).',
            code: 'invalid_nama_kontak',
          })
        );
        return;
      }

      const instansi = (typeof payload.organisasi === 'string' && payload.organisasi.trim())
        ? payload.organisasi.trim()
        : (typeof payload.instansi === 'string' && payload.instansi.trim() ? payload.instansi.trim() : (payload.lembaga || 'Lembaga'));

      const peran = (typeof payload.jabatan === 'string' && payload.jabatan.trim())
        ? payload.jabatan.trim()
        : (typeof payload.peran === 'string' && payload.peran.trim() ? payload.peran.trim() : 'Staf / Relasi');

      const telepon = (typeof payload.nomor_telepon === 'string' && payload.nomor_telepon.trim())
        ? payload.nomor_telepon.trim()
        : (typeof payload.telepon === 'string' && payload.telepon.trim() ? payload.telepon.trim() : (payload.whatsapp || null));

      const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : null;
      const catatan = typeof payload.catatan === 'string' && payload.catatan.trim() ? payload.catatan.trim() : null;

      const newId = safeRandomUuid();
      const insertRow: RawKontakEksternalDbRow = {
        id: newId,
        nama_kontak: nama,
        instansi,
        peran,
        telepon,
        email,
        catatan,
        created_at: new Date().toISOString(),
      };

      const { data: createdRow, error: insErr } = await supabase
        .from('ptv_kontak_eksternal')
        .insert([insertRow])
        .select('*')
        .single();

      if (insErr || !createdRow) {
        console.error('[API Kontak Insert Error]:', insErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan kontak eksternal ke Staging: ${insErr?.message || 'Database error'}`,
            code: 'database_insert_error',
          })
        );
        return;
      }

      const cat = categorizeExternalContact(createdRow);
      const enriched: EnrichedExternalContact = {
        id: createdRow.id,
        nama: createdRow.nama_kontak,
        kategori: cat.peran,
        jabatan: createdRow.peran || '-',
        organisasi: createdRow.instansi || 'Lembaga',
        lembaga: cat.lembaga,
        nomor_telepon: createdRow.telepon || undefined,
        whatsapp: createdRow.telepon || undefined,
        email: createdRow.email || undefined,
        catatan: createdRow.catatan || undefined,
        status: 'Aktif',
      };

      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kontak eksternal "${enriched.nama}" berhasil disimpan secara permanen di database Staging.`,
          contact: enriched,
        })
      );
      return;
    }

    // === METHOD PATCH / PUT: Edit Kontak Eksternal ===
    if (method === 'PATCH' || method === 'PUT') {
      const payload = await bodyPromise;
      const targetId = (urlObj.searchParams.get('id') || payload.id || '').trim();

      if (!targetId) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Parameter ID kontak wajib disertakan.',
            code: 'missing_contact_id',
          })
        );
        return;
      }

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: 'contact_not_found',
          })
        );
        return;
      }

      const { data: existing, error: findErr } = await supabase
        .from('ptv_kontak_eksternal')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (findErr) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal mencari kontak eksternal di Staging: ${findErr.message}`,
            code: 'database_query_error',
          })
        );
        return;
      }

      if (!existing) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: 'contact_not_found',
          })
        );
        return;
      }

      const updates: Partial<RawKontakEksternalDbRow> = {};
      if (typeof payload.nama === 'string' && payload.nama.trim().length >= 2) {
        updates.nama_kontak = payload.nama.trim();
      } else if (typeof payload.nama_kontak === 'string' && payload.nama_kontak.trim().length >= 2) {
        updates.nama_kontak = payload.nama_kontak.trim();
      }

      if (typeof payload.organisasi === 'string') updates.instansi = payload.organisasi.trim();
      else if (typeof payload.instansi === 'string') updates.instansi = payload.instansi.trim();

      if (typeof payload.jabatan === 'string') updates.peran = payload.jabatan.trim();
      else if (typeof payload.peran === 'string') updates.peran = payload.peran.trim();

      if (payload.nomor_telepon !== undefined) updates.telepon = payload.nomor_telepon ? payload.nomor_telepon.trim() : null;
      else if (payload.telepon !== undefined) updates.telepon = payload.telepon ? payload.telepon.trim() : null;
      else if (payload.whatsapp !== undefined) updates.telepon = payload.whatsapp ? payload.whatsapp.trim() : null;

      if (payload.email !== undefined) updates.email = payload.email ? payload.email.trim() : null;
      if (payload.catatan !== undefined) updates.catatan = payload.catatan ? payload.catatan.trim() : null;

      const { data: updatedRow, error: upErr } = await supabase
        .from('ptv_kontak_eksternal')
        .update(updates)
        .eq('id', targetId)
        .select('*')
        .single();

      if (upErr || !updatedRow) {
        console.error('[API Kontak Update Error]:', upErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memperbarui kontak eksternal di Staging: ${upErr?.message || 'Database error'}`,
            code: 'database_update_error',
          })
        );
        return;
      }

      const cat = categorizeExternalContact(updatedRow);
      const enriched: EnrichedExternalContact = {
        id: updatedRow.id,
        nama: updatedRow.nama_kontak,
        kategori: cat.peran,
        jabatan: updatedRow.peran || '-',
        organisasi: updatedRow.instansi || 'Lembaga',
        lembaga: cat.lembaga,
        nomor_telepon: updatedRow.telepon || undefined,
        whatsapp: updatedRow.telepon || undefined,
        email: updatedRow.email || undefined,
        catatan: updatedRow.catatan || undefined,
        status: 'Aktif',
      };

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kontak eksternal "${enriched.nama}" berhasil diperbarui di database Staging.`,
          contact: enriched,
        })
      );
      return;
    }

    // === METHOD DELETE: Hapus Kontak Eksternal ===
    if (method === 'DELETE') {
      const urlTargetId = urlObj.searchParams.get('id');
      let targetId = (urlTargetId || '').trim();

      if (!targetId) {
        const payload = await parseJsonBody(req).catch(() => ({}));
        targetId = (payload.id || '').trim();
      }

      if (!targetId) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Parameter ID kontak wajib disertakan untuk penghapusan.',
            code: 'missing_contact_id',
          })
        );
        return;
      }

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: 'contact_not_found',
          })
        );
        return;
      }

      const { data: existing, error: findErr } = await supabase
        .from('ptv_kontak_eksternal')
        .select('id, nama_kontak')
        .eq('id', targetId)
        .maybeSingle();

      if (findErr) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memverifikasi kontak eksternal di Staging: ${findErr.message}`,
            code: 'database_query_error',
          })
        );
        return;
      }

      if (!existing) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: 'contact_not_found',
          })
        );
        return;
      }

      const { error: delErr } = await supabase
        .from('ptv_kontak_eksternal')
        .delete()
        .eq('id', targetId);

      if (delErr) {
        console.error('[API Kontak Delete Error]:', delErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menghapus kontak eksternal dari Staging: ${delErr.message}`,
            code: 'database_delete_error',
          })
        );
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kontak eksternal "${existing.nama_kontak}" berhasil dihapus dari database Staging.`,
          deleted_id: targetId,
        })
      );
      return;
    }
  } catch (err: any) {
    console.error('[API Kontak Exception]:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: `Terjadi kesalahan pada server saat memproses kontak: ${err.message}`,
        code: 'internal_server_error',
      })
    );
  }
}
