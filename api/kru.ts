import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hash } from 'bcryptjs';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { resolveLiveAccess } from './auth/_utils/liveAccess';
import { isOperationalCrew, CANONICAL_OPERATIONAL_DIVISIONS } from '../src/products/hub/kru/types';
import type { CrewMember, CrewRole } from '../src/products/hub/kru/types';
import { mapLegacyKruRowToCrewMember, type RawLegacyKruDbRow } from '../src/products/hub/kru/kruMapper';
export type { RawLegacyKruDbRow };
export { mapLegacyKruRowToCrewMember };

export async function readPersonnelAccountStatuses(db: SupabaseClient, rows: RawLegacyKruDbRow[]) {
  const identities = new Set(rows.map(row => row.canonical_identity_id).filter((id): id is string => !!id));
  const statuses = new Map<string, 'active' | 'inactive'>();
  if (!identities.size) return statuses;
  const accounts = await db.from('user_account').select('identity_id,status_akun').in('identity_id', [...identities]);
  if (accounts.error || !Array.isArray(accounts.data)) throw new Error('Status akun personel tidak dapat diverifikasi.');
  for (const account of accounts.data) {
    if (!identities.has(account.identity_id)) continue;
    if (statuses.has(account.identity_id) || !['active', 'inactive'].includes(account.status_akun)) throw new Error('Relasi akun personel ambigu atau tidak valid.');
    statuses.set(account.identity_id, account.status_akun);
  }
  return statuses;
}

function normalizePersonnelAliases(value: any): any {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Payload personel tidak valid.');
  const payload = { ...value };
  for (const [alias, canonical] of [['status', 'status_kru'], ['divisi', 'division'], ['jabatan', 'position'], ['photo_url', 'foto_url'], ['telepon', 'phone']]) {
    if (payload[alias] !== undefined) {
      if (payload[canonical] !== undefined && payload[canonical] !== payload[alias]) throw new Error('Alias data personel bertentangan.');
      payload[canonical] = payload[alias]; delete payload[alias];
    }
  }
  if (payload.status_kru === 'aktif') payload.status_kru = 'Aktif';
  if (payload.status_kru === 'nonaktif') payload.status_kru = 'Nonaktif';
  return payload;
}

export interface RawLoginHistoryDbRow {
  id: number;
  user_id: string | null;
  ptv_id: string | null;
  username: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string | null;
  login_at: string;
}

async function parseJsonBody(req: IncomingMessage): Promise<any> {
  const parsed = (req as IncomingMessage & { body?: unknown }).body;
  if (parsed !== undefined) {
    const value = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Payload personel tidak valid.');
    return value;
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
  res.setHeader('Cache-Control', 'no-store');

  const method = (req.method || 'GET').toUpperCase();
  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new Error('origin');
  } catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Origin permintaan tidak diizinkan.' })); return; }

  // 0. Only allow GET, POST, PUT, PATCH. Reject DELETE or others on Kru module
  if (!['GET', 'POST', 'PUT', 'PATCH'].includes(method)) {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        error: `Metode HTTP ${method} tidak didukung pada modul Manajemen Kru. Operasi penghapusan kru tidak diizinkan demi melindungi keutuhan data historis.`,
        code: 'method_not_allowed',
      })
    );
    return;
  }

  // 1. Session Authentication Gate (Vercel Direct Auth HttpOnly Cookie)
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Manajemen Kru.',
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

  if (!/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(supabaseUrl)) {
    res.statusCode = 503; res.end(JSON.stringify({ error: 'Manajemen Kru hanya tersedia di Staging terverifikasi.' })); return;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  let access: Awaited<ReturnType<typeof resolveLiveAccess>>;
  try { access = await resolveLiveAccess(supabase, session); }
  catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'Akses ditolak atau sesi telah dicabut.', code: 'forbidden' })); return; }
  const required = method === 'GET' ? 'crew.view' : method === 'POST' ? 'crew.create' : 'crew.edit';
  if (!access.can(required) && !((method === 'PATCH' || method === 'PUT') && access.can('crew.status.manage'))) {
    res.statusCode = 403; res.end(JSON.stringify({ error: `Akses ditolak: diperlukan ${required}.`, code: 'forbidden' })); return;
  }

  try {
    // === METHOD GET ===
    if (method === 'GET') {
      const { data: rows, error: queryErr } = await supabase
        .from('legacy_archive_kru')
        .select('*')
        .order('ptv_id', { ascending: true });

      if (queryErr) {
        console.error('[API Kru] Pembacaan personel gagal.');
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memuat data kru dari Supabase: ${queryErr.message}`,
            code: 'database_query_error',
          })
        );
        return;
      }

      // Baca canonical_identity untuk resolusi identity ID
      const { data: canonicals } = await supabase
        .from('canonical_identity')
        .select('id, ptv_id, full_name, avatar_url');
      const ciByPtv = new Map((canonicals || []).map(c => [c.ptv_id, c]));

      // Baca akun login untuk resolusi status_akun
      const { data: accounts } = await supabase
        .from('user_account')
        .select('id, identity_id, status_akun');
      const accByIdentity = new Map((accounts || []).map(a => [a.identity_id, a]));

      // Baca profil akses untuk resolusi portal role
      const accIds = (accounts || []).map(a => a.id);
      const { data: profiles } = accIds.length
        ? await supabase.from('account_profiles').select('account_id, profile_id').in('account_id', accIds)
        : { data: [] };
      const profilesByAccount = new Map<string, string[]>();
      for (const p of (profiles || [])) {
        if (!profilesByAccount.has(p.account_id)) profilesByAccount.set(p.account_id, []);
        profilesByAccount.get(p.account_id)!.push(p.profile_id);
      }

      // Mapping kru kanonikal tanpa menimpa data edit yang sudah disimpan
      const seenPtv = new Set<string>();
      const seenCanonId = new Set<string>();
      const members: CrewMember[] = [];

      for (const raw of (rows || [])) {
        if (!raw.ptv_id || seenPtv.has(raw.ptv_id)) continue;
        if (raw.source_key === 'system_position_capability_mapping' || (raw.ptv_id && raw.ptv_id.startsWith('PTV-CONFIG'))) continue;
        if (raw.metadata_json?.is_duplicate_archive === true) continue;

        const ci = ciByPtv.get(raw.ptv_id);
        const canonId = raw.canonical_identity_id || ci?.id || null;
        if (canonId) {
          if (seenCanonId.has(canonId)) continue;
          seenCanonId.add(canonId);
        }
        seenPtv.add(raw.ptv_id);
        const linkedAcc = canonId ? accByIdentity.get(canonId) : null;
        const assigned = linkedAcc ? (profilesByAccount.get(linkedAcc.id) || []) : [];
        const portalRole: CrewRole = assigned.some(p => ['root_executive', 'eksekutif'].includes(p))
          ? 'eksekutif'
          : assigned.includes('administrasi') ? 'administrasi' : 'kru';

        const rowWithRole: RawLegacyKruDbRow = {
          ...raw,
          canonical_identity_id: canonId,
          role: portalRole
        };

        members.push(mapLegacyKruRowToCrewMember(rowWithRole, linkedAcc?.status_akun ?? null));
      }

      // Compute exact category & status metrics
      const aktifCount = members.filter((c) => c.category === 'Kru' && c.status_kru === 'Aktif').length;
      const nonaktifCount = members.filter((c) => c.category === 'Kru' && c.status_kru !== 'Aktif').length;
      const pengarahCount = members.filter((c) => c.category === 'Pengarah').length;
      const pembinaCount = members.filter((c) => c.category === 'Pembina').length;

      const urlObj = new URL(req.url || '', 'http://localhost');
      const scope = urlObj.searchParams.get('scope') || urlObj.searchParams.get('filter');

      // Backend Filter Khusus: Kandidat Penugasan Acara (HANYA Kru Organisasi Berstatus Aktif)
      if (scope === 'active_crew' || scope === 'assignment') {
        const activeCandidates = members.filter(isOperationalCrew).map(c => ({
          id: c.id, ptv_id: c.ptv_id, name: c.full_name, division: c.division,
          role: 'Kru', position: c.position, photo: c.foto_url || '', status_kru: 'Aktif',
        }));

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            scope: 'active_crew',
            count: activeCandidates.length,
            crew: activeCandidates,
            candidates: activeCandidates,
          })
        );
        return;
      }

      // Optional: Query login history if requested
      let loginHistory: RawLoginHistoryDbRow[] = [];
      if (urlObj.searchParams.get('include_login_history') === 'true') {
        if (!access.can('audit.logs.view')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Izin melihat audit diperlukan.' })); return; }
        const { data: histRows } = await supabase
          .from('ptv_login_history')
          .select('*')
          .order('login_at', { ascending: false })
          .limit(50);
        loginHistory = (histRows || []) as RawLoginHistoryDbRow[];
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          count: members.length,
          stats: {
            total: members.length,
            aktif: aktifCount,
            nonaktif: nonaktifCount,
            pengarah: pengarahCount,
            pembina: pembinaCount,
          },
          crew: members,
          login_history: loginHistory,
        })
      );
      return;
    }

    // === METHOD POST: Tambah Kru Baru ===
    if (method === 'POST') {
      const payload = normalizePersonnelAliases(await parseJsonBody(req));
      const sensitive = ['username', 'role', 'status_akun', 'assigned_profiles', 'allowed_overrides', 'denied_overrides', 'password', 'oauth_uid', 'oauth_email', 'oauth_provider', 'auth_user_id', 'canonical_identity_id', 'metadata_json'];
      if (sensitive.some(key => Object.prototype.hasOwnProperty.call(payload, key))) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Pengaturan akun dan izin hanya melalui Manajemen Akses.', code: 'access_fields_forbidden' })); return; }
      if (payload.category !== undefined && !['Kru', 'Pembina', 'Pengarah'].includes(payload.category)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Kategori personel tidak valid.' })); return; }
      if (payload.status_kru !== undefined && !['Aktif', 'Nonaktif'].includes(payload.status_kru)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Status keanggotaan tidak valid.' })); return; }
      if (method === 'POST' && payload.division !== undefined && payload.category !== 'Pembina' && payload.category !== 'Pengarah' && !CANONICAL_OPERATIONAL_DIVISIONS.includes(payload.division)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Divisi aktif harus Editor, Layouter, Technical, atau Engagement.' })); return; }
      if (payload.ptv_id !== undefined && !/^PTV-[0-9]{3,}$/.test(payload.ptv_id)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'ID PTV tidak valid.' })); return; }


      const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : '';
      if (!fullName || fullName.length < 2) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Validasi gagal: Nama lengkap kru wajib diisi (minimal 2 karakter).',
            code: 'invalid_full_name',
          })
        );
        return;
      }

            // Generate ID PTV otomatis berdasarkan nomor urutan kru tertinggi terdaftar (aman terhadap duplikasi)
      const { data: ptvRows, error: sequenceError } = await supabase
        .from('legacy_archive_kru')
        .select('ptv_id');
      if (sequenceError) throw new Error('Urutan ID personel tidak dapat dibaca.');

      let maxNum = 0;
      for (const row of ptvRows || []) {
        const match = String(row.ptv_id || '').match(/^PTV-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      let nextNum = maxNum + 1;
      let targetPtvId = `PTV-${String(nextNum).padStart(3, '0')}`;

      // Verifikasi ketersediaan nomor unik
      while (true) {
        const { data: conflict } = await supabase
          .from('legacy_archive_kru')
          .select('archive_id')
          .eq('ptv_id', targetPtvId)
          .maybeSingle();
        if (!conflict) break;
        nextNum++;
        targetPtvId = `PTV-${String(nextNum).padStart(3, '0')}`;
      }

      const cleanUsername = (typeof payload.username === 'string' && payload.username.trim())
        ? payload.username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '')
        : fullName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

      const cleanCategory = (payload.category === 'Pengarah' || payload.category === 'Pembina')
        ? payload.category
        : 'Kru';

      let cleanDivisi = typeof payload.division === 'string' ? payload.division.trim() : (typeof payload.divisi === 'string' ? payload.divisi.trim() : 'Technical');
      if (cleanCategory === 'Pengarah') cleanDivisi = '';
      if (cleanCategory === 'Pembina') cleanDivisi = '';

      const cleanJabatan = typeof payload.position === 'string' ? payload.position.trim() : (typeof payload.jabatan === 'string' ? payload.jabatan.trim() : 'Kru Operasional');
      const cleanAngkatan = cleanCategory === 'Kru' ? String(payload.angkatan || '').trim() : '';
      const cleanStatusKru = (payload.status_kru === 'Nonaktif' || payload.status === 'Nonaktif') ? 'Nonaktif' : 'Aktif';
      const cleanRole = 'kru';

            const cleanPhone = typeof payload.phone === 'string' ? payload.phone.trim() : (typeof payload.telepon === 'string' ? payload.telepon.trim() : undefined);
      const cleanEmail = typeof payload.email === 'string' ? payload.email.trim() : (typeof payload.oauth_email === 'string' ? payload.oauth_email.trim() : undefined);
      const DEFAULT_AVATAR = 'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp';
      const rawFotoUrl = typeof payload.foto_url === 'string' ? payload.foto_url.trim() : (typeof payload.photo_url === 'string' ? payload.photo_url.trim() : '');
      const cleanFotoUrl = rawFotoUrl || DEFAULT_AVATAR;
      const cleanNim = typeof payload.nim === 'string' ? payload.nim.trim() : undefined;
      const cleanJurusan = typeof payload.jurusan === 'string' ? payload.jurusan.trim() : undefined;
      const cleanBirthDate = typeof payload.birth_date === 'string' ? payload.birth_date.trim() : (typeof payload.tanggal_lahir === 'string' ? payload.tanggal_lahir.trim() : undefined);
      const cleanAddress = typeof payload.address === 'string' ? payload.address.trim() : (typeof payload.alamat === 'string' ? payload.alamat.trim() : undefined);

      const newArchiveId = crypto.randomUUID();
      const insertRecord: RawLegacyKruDbRow = {
        archive_id: newArchiveId,
        source_key: `direct_kru_${targetPtvId}`,
        production_id: crypto.randomUUID(),
        ptv_id: targetPtvId,
        full_name: fullName,
        username: cleanUsername,
        divisi: cleanDivisi,
        jabatan: cleanJabatan,
        angkatan: cleanAngkatan,
        status: cleanStatusKru === 'Nonaktif' ? 'nonaktif' : 'aktif',
        role: cleanRole,
        photo_url: cleanFotoUrl,
        email_masked: cleanEmail || null,
        telepon_masked: cleanPhone || null,
        canonical_identity_id: null,
        reconciliation_status: 'unlinked',
        metadata_json: {
          category: cleanCategory,
          nim: cleanNim || null,
          jurusan: cleanJurusan || null,
          birth_date: cleanBirthDate || null,
          tanggal_lahir: cleanBirthDate || null,
          address: cleanAddress || null,
          alamat: cleanAddress || null,
          original_phone: cleanPhone || null,
          original_email: cleanEmail || null,
          avatar_url: cleanFotoUrl,
          created_by_account_id: session.account_id,
          created_at: new Date().toISOString(),
        },
        imported_at: new Date().toISOString(),
      };

      const { data: createdRow, error: insertErr } = await supabase
        .from('legacy_archive_kru')
        .insert([insertRecord])
        .select('*')
        .single();

      if (insertErr || !createdRow) {
        console.error('[API Kru] Penyimpanan personel gagal.');
        res.statusCode = insertErr?.code === '23505' ? 409 : 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan data kru baru ke database Staging: ${insertErr?.message || 'Unknown database error'}`,
            code: 'database_insert_error',
          })
        );
        return;
      }

      const createdMember = mapLegacyKruRowToCrewMember(createdRow);
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kru baru ${createdMember.full_name} (${createdMember.ptv_id}) berhasil disimpan secara permanen di database Staging.`,
          crew: createdMember,
        })
      );
      return;
    }

        // === METHOD PATCH / PUT: Edit Data Kru & Status Akun ===
    if (method === 'PATCH' || method === 'PUT') {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const action = urlObj.searchParams.get('action') || '';
      const rawBody = await parseJsonBody(req);

      // AKSI KHUSUS 1: Toggle Status Akun (Aktifkan / Nonaktifkan Akun Kru dari Manajemen Kru)
      if (action === 'toggle_account' || rawBody.action === 'toggle_account') {
        if (!access.can('crew.status.manage')) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Izin mengelola status akun diperlukan.', code: 'forbidden' }));
          return;
        }
        const targetId = (urlObj.searchParams.get('id') || rawBody.id || rawBody.archive_id || rawBody.ptv_id || '').trim();
        if (!targetId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Parameter ID kru wajib disertakan.' }));
          return;
        }
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
        const query = supabase.from('legacy_archive_kru').select('*');
        const { data: rows } = isUuid
          ? await query.or(`archive_id.eq.${targetId},production_id.eq.${targetId}`)
          : await query.eq('ptv_id', targetId);
        const crewRow = rows?.[0] as RawLegacyKruDbRow | undefined;
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Data kru tidak ditemukan di database Staging.' }));
          return;
        }

        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from('canonical_identity').select('id').eq('ptv_id', crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }

        if (!identityId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }

        const { data: accounts } = await supabase.from('user_account').select('id, username, status_akun, updated_at').eq('identity_id', identityId);
        if (!accounts || accounts.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }

        const targetAccount = accounts[0];
        const nextAccountStatus = (rawBody.status_akun === 'active' || rawBody.status_akun === 'inactive')
          ? rawBody.status_akun
          : (targetAccount.status_akun === 'active' ? 'inactive' : 'active');

        const { data: currentProfiles } = await supabase.from('account_profiles').select('profile_id').eq('account_id', targetAccount.id);
        const profileIds = currentProfiles?.map(p => p.profile_id) || ['crew'];
        if (profileIds.includes('root_executive')) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Status akun Root dilindungi dan tidak dapat diubah.' }));
          return;
        }

        const { data: currentOverrides } = await supabase.from('account_capability_overrides').select('capability_key, override_type').eq('account_id', targetAccount.id);
        const allowedCaps = (currentOverrides || []).filter(o => o.override_type === 'allow').map(o => o.capability_key);
        const deniedCaps = (currentOverrides || []).filter(o => o.override_type === 'deny').map(o => o.capability_key);

        const rpcRes = await supabase.rpc('rpc_manage_account_access', {
          p_actor_account_id: session.account_id,
          p_session_iat: session.iat,
          p_change: {
            accountId: targetAccount.id,
            expectedVersion: targetAccount.updated_at,
            status: nextAccountStatus,
            profiles: profileIds,
            allowed: allowedCaps,
            denied: deniedCaps,
            confirmed: true,
            reason: `Status akun diubah menjadi ${nextAccountStatus === 'active' ? 'Akun Aktif' : 'Akun Nonaktif'} dari Manajemen Kru`,
          }
        });

        if (rpcRes.error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Gagal memperbarui status akun: ${rpcRes.error.message}` }));
          return;
        }

        const updatedCrew = mapLegacyKruRowToCrewMember(crewRow, nextAccountStatus);
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: `Status akun ${updatedCrew.full_name} berhasil diubah menjadi ${nextAccountStatus === 'active' ? 'Akun Aktif' : 'Akun Nonaktif'}.`,
          crew: updatedCrew,
          status_akun: nextAccountStatus === 'active' ? 'Aktif' : 'Nonaktif',
        }));
        return;
      }

      // SUB-ACTION: Reset Password oleh ROOT dari Manajemen Kru
      if (action === 'reset_password' || rawBody.action === 'reset_password') {
        if (!access.profiles.includes('root_executive')) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Fitur Atur Ulang Password hanya dapat dijalankan oleh akun ROOT.' }));
          return;
        }

        const targetId = (urlObj.searchParams.get('id') || rawBody.id || rawBody.archive_id || rawBody.ptv_id || '').trim();
        const newPassword = String(rawBody.newPassword || '').trim();
        const reason = String(rawBody.reason || 'Atur ulang password oleh ROOT di Manajemen Kru').trim();

        if (!targetId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Parameter ID kru wajib disertakan.' }));
          return;
        }
        if (!newPassword || newPassword.length < 4) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Password baru minimal 4 karakter.' }));
          return;
        }
        if (Buffer.byteLength(newPassword, 'utf8') > 72) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Password baru maksimal 72 byte.' }));
          return;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
        const query = supabase.from('legacy_archive_kru').select('*');
        const { data: rows } = isUuid
          ? await query.or(`archive_id.eq.${targetId},production_id.eq.${targetId}`)
          : await query.eq('ptv_id', targetId);
        const crewRow = rows?.[0] as RawLegacyKruDbRow | undefined;
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Data kru tidak ditemukan di database Staging.' }));
          return;
        }

        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from('canonical_identity').select('id').eq('ptv_id', crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }

        if (!identityId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }

        const { data: accounts } = await supabase.from('user_account').select('id, identity_id, username, auth_user_id, status_akun').eq('identity_id', identityId);
        if (!accounts || accounts.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }

        const targetAccount = accounts[0];

        // Hash password dengan bcrypt
        const passwordHash = await hash(newPassword, 10);

        // Update password hash di auth_credentials via RPC keamanan (ACCESS-149 hardened)
        const { error: rpcErr } = await supabase.rpc('rpc_admin_set_password', {
          p_account_id: targetAccount.id,
          p_password_hash: passwordHash,
          p_actor_id: access.identity.id,
        });
        if (rpcErr) {
          console.error('[API Kru] rpc_admin_set_password warning/error:', rpcErr.message);
        }

        // Update password hash di metadata_json arsip kru
        const updatedMeta = {
          ...(crewRow.metadata_json || {}),
          password_hash: passwordHash,
          password_updated_at: new Date().toISOString(),
          password_updated_by: session.account_id,
        };
        await supabase
          .from('legacy_archive_kru')
          .update({ metadata_json: updatedMeta })
          .eq('archive_id', crewRow.archive_id);

        if (identityId) {
          const { data: ciRow } = await supabase.from('canonical_identity').select('metadata').eq('id', identityId).single();
          const ciMeta = {
            ...(ciRow?.metadata || {}),
            password_updated_at: new Date().toISOString(),
            password_updated_by: session.account_id,
          };
          await supabase.from('canonical_identity').update({ metadata: ciMeta }).eq('id', identityId);
        }

        // Sinkronkan ke Supabase Auth jika ada auth_user_id
        if (targetAccount.auth_user_id) {
          try {
            await supabase.auth.admin.updateUserById(targetAccount.auth_user_id, { password: newPassword });
          } catch (e) {
            console.warn('[API Kru] Supabase Auth update skipped or unavailable:', e);
          }
        }

        // Batalkan seluruh token sesi lama
        await supabase.from('user_account').update({ tokens_valid_after: new Date().toISOString() }).eq('id', targetAccount.id);

        // Catat ke auth audit log
        await supabase.from('auth_audit_log').insert([{
          actor_id: access.identity.id,
          event_type: 'password_reset_by_root',
          metadata: {
            target_account_id: targetAccount.id,
            target_username: targetAccount.username,
            target_ptv_id: crewRow.ptv_id,
            executed_by: access.identity.full_name,
            source: 'Manajemen Kru - Akun & Keamanan',
            reason,
            created_at: new Date().toISOString(),
          }
        }]);

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: `Password untuk akun @${targetAccount.username} (${crewRow.full_name}) berhasil diatur ulang. Sesi lama telah dibatalkan.`,
        }));
        return;
      }

      // SUB-ACTION: Ubah Username oleh ROOT dari Manajemen Kru
      if (action === 'update_username' || rawBody.action === 'update_username') {
        if (!access.profiles.includes('root_executive')) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Fitur Ubah Username hanya dapat dijalankan oleh akun ROOT.' }));
          return;
        }

        const targetId = (urlObj.searchParams.get('id') || rawBody.id || rawBody.archive_id || rawBody.ptv_id || '').trim();
        const rawNewUsername = String(rawBody.username || rawBody.newUsername || '').trim().toLowerCase();
        const cleanUsername = rawNewUsername.replace(/[^a-z0-9_.]/g, '');

        if (!targetId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Parameter ID kru wajib disertakan.' }));
          return;
        }
        if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Username baru harus berupa 3–30 karakter alfanumerik, titik, atau garis bawah.' }));
          return;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
        const query = supabase.from('legacy_archive_kru').select('*');
        const { data: rows } = isUuid
          ? await query.or(`archive_id.eq.${targetId},production_id.eq.${targetId}`)
          : await query.eq('ptv_id', targetId);
        const crewRow = rows?.[0] as RawLegacyKruDbRow | undefined;
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Data kru tidak ditemukan di database Staging.' }));
          return;
        }

        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from('canonical_identity').select('id').eq('ptv_id', crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }

        // Cek duplikasi username di user_account dan legacy_archive_kru
        const { data: existingUserAccounts } = await supabase
          .from('user_account')
          .select('id, identity_id')
          .eq('username', cleanUsername);

        if (existingUserAccounts && existingUserAccounts.some(acc => acc.identity_id !== identityId)) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: `Username @${cleanUsername} sudah digunakan oleh akun lain.` }));
          return;
        }

        const { data: existingCrewRows } = await supabase
          .from('legacy_archive_kru')
          .select('archive_id')
          .eq('username', cleanUsername)
          .neq('archive_id', crewRow.archive_id);

        if (existingCrewRows && existingCrewRows.length > 0) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: `Username @${cleanUsername} sudah terdaftar pada data personel lain.` }));
          return;
        }

        const oldUsername = crewRow.username || '';

        // Update di legacy_archive_kru
        await supabase
          .from('legacy_archive_kru')
          .update({
            username: cleanUsername,
            metadata_json: {
              ...(crewRow.metadata_json || {}),
              username_updated_at: new Date().toISOString(),
              username_updated_by: session.account_id,
            }
          })
          .eq('archive_id', crewRow.archive_id);

        // Update di user_account jika akun sudah ada
        if (identityId) {
          await supabase
            .from('user_account')
            .update({
              username: cleanUsername,
              updated_at: new Date().toISOString(),
            })
            .eq('identity_id', identityId);
        }

        // Catat ke auth audit log
        await supabase.from('auth_audit_log').insert([{
          actor_id: access.identity.id,
          event_type: 'username_updated_by_root',
          metadata: {
            target_ptv_id: crewRow.ptv_id,
            old_username: oldUsername,
            new_username: cleanUsername,
            executed_by: access.identity.full_name,
            source: 'Manajemen Kru - Akun & Keamanan',
            created_at: new Date().toISOString(),
          }
        }]);

        const updatedCrew = mapLegacyKruRowToCrewMember({ ...crewRow, username: cleanUsername });
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: `Username berhasil diubah dari @${oldUsername} menjadi @${cleanUsername}.`,
          crew: updatedCrew,
          username: cleanUsername,
        }));
        return;
      }

      // SUB-ACTION: Buat Akun oleh ROOT dari Manajemen Kru (PTV-DEV-227)
      if (action === 'create_account' || rawBody.action === 'create_account') {
        if (!access.profiles.includes('root_executive')) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Fitur Buat Akun hanya dapat dijalankan oleh akun ROOT.' }));
          return;
        }

        const targetId = (urlObj.searchParams.get('id') || rawBody.id || rawBody.archive_id || rawBody.ptv_id || '').trim();
        if (!targetId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Parameter ID kru wajib disertakan.' }));
          return;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
        const query = supabase.from('legacy_archive_kru').select('*');
        const { data: rows } = isUuid
          ? await query.or(`archive_id.eq.${targetId},production_id.eq.${targetId}`)
          : await query.eq('ptv_id', targetId);
        const crewRow = rows?.[0] as RawLegacyKruDbRow | undefined;
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Data kru tidak ditemukan di database Staging.' }));
          return;
        }

        // Cek apakah personel sudah memiliki akun aktif/terdaftar
        if (crewRow.username) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) sudah memiliki akun login (@${crewRow.username}).` }));
          return;
        }

        // 1. Kumpulkan seluruh username existing untuk mencegah collision
        const { data: allLegacyUsernames } = await supabase.from('legacy_archive_kru').select('username');
        const { data: allUserAccounts } = await supabase.from('user_account').select('username');
        const existingUsernames = new Set<string>([
          ...(allLegacyUsernames || []).map(r => (r.username || '').toLowerCase().trim()).filter(Boolean),
          ...(allUserAccounts || []).map(r => (r.username || '').toLowerCase().trim()).filter(Boolean),
        ]);

        // 2. Generate Username Awal Otomatis: Kata pertama dari nama lengkap kru, huruf kecil, tanpa spasi
        const rawFirstWord = (crewRow.full_name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'kru';
        let candidateUsername = rawFirstWord;
        let counter = 2;
        while (existingUsernames.has(candidateUsername)) {
          candidateUsername = `${rawFirstWord}${counter}`;
          counter++;
        }

        // 3. Password Awal Otomatis: Berdasarkan kata pertama nama kru (minimal 8 karakter dengan padding acak)
        const randomPin = Math.floor(1000 + Math.random() * 9000);
        const generatedPassword = `${rawFirstWord}@${randomPin}`;
        const passwordHash = await hash(generatedPassword, 10);

        // 4. Update data personel di legacy_archive_kru dan buat akun kanonikal
        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from('canonical_identity').select('id').eq('ptv_id', crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }

        // Buat akun login kanonikal secara atomik via RPC keamanan (user_account + account_profiles + auth_credentials)
        if (identityId) {
          const { error: rpcErr } = await supabase.rpc('rpc_admin_create_crew_account', {
            p_identity_id: identityId,
            p_username: candidateUsername,
            p_password_hash: passwordHash,
            p_actor_id: access.identity.id,
            p_profile_id: 'crew',
          });
          if (rpcErr) {
            console.error('[API Kru] rpc_admin_create_crew_account warning/error:', rpcErr.message);
            // Fallback manual upsert user_account & profiles
            const { data: existingAcc } = await supabase.from('user_account').select('id').eq('identity_id', identityId).maybeSingle();
            if (existingAcc) {
              await supabase.from('user_account').update({ username: candidateUsername, status_akun: 'active', updated_at: new Date().toISOString() }).eq('id', existingAcc.id);
              await supabase.from('account_profiles').upsert([{ account_id: existingAcc.id, profile_id: 'crew' }]);
            } else {
              const { data: newAcc } = await supabase.from('user_account').insert([{
                identity_id: identityId,
                username: candidateUsername,
                status_akun: 'active',
              }]).select('id').single();
              if (newAcc) {
                await supabase.from('account_profiles').upsert([{ account_id: newAcc.id, profile_id: 'crew' }]);
              }
            }
          }

          // Sinkronkan metadata di canonical_identity
          const { data: ciRow } = await supabase.from('canonical_identity').select('metadata').eq('id', identityId).single();
          const ciMeta = {
            ...(ciRow?.metadata || {}),
            must_change_password: true,
            account_created_at: new Date().toISOString(),
            account_created_by: session.account_id,
          };
          await supabase.from('canonical_identity').update({ metadata: ciMeta }).eq('id', identityId);
        }

        const updatedMeta = {
          ...(crewRow.metadata_json || {}),
          password_hash: passwordHash,
          must_change_password: true,
          initial_password_created_at: new Date().toISOString(),
          initial_password_created_by: session.account_id,
          account_created_at: new Date().toISOString(),
          account_created_by: session.account_id,
        };

        const { error: updateErr } = await supabase
          .from('legacy_archive_kru')
          .update({
            username: candidateUsername,
            metadata_json: updatedMeta,
          })
          .eq('archive_id', crewRow.archive_id);

        if (updateErr) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Gagal membuat akun login: ${updateErr.message}` }));
          return;
        }

        // 5. Catat audit log permanen
        try {
          await supabase.from('auth_audit_log').insert([{
            actor_id: access.identity.id,
            actor_ptv_id: access.identity.ptv_id || null,
            event_type: 'account_created_by_root',
            metadata: {
              target_ptv_id: crewRow.ptv_id,
              target_full_name: crewRow.full_name,
              created_username: candidateUsername,
              assigned_profile: 'kru',
              status_akun: 'active',
              must_change_password: true,
              executed_by: access.identity.full_name,
              source: 'Manajemen Kru - Buat Akun ROOT',
              created_at: new Date().toISOString(),
            }
          }]);
        } catch (auditErr) {
          console.warn('[API Kru] Gagal mencatat audit log create_account:', auditErr);
        }

        // Map data kru terbaru dengan status akun aktif
        const updatedCrew = mapLegacyKruRowToCrewMember({ ...crewRow, username: candidateUsername, metadata_json: updatedMeta }, 'active');

        res.statusCode = 201;
        res.end(JSON.stringify({
          success: true,
          message: `Akun login untuk ${crewRow.full_name} (@${candidateUsername}) berhasil dibuat.`,
          credentials: {
            username: candidateUsername,
            temporary_password: generatedPassword,
            full_name: crewRow.full_name,
            ptv_id: crewRow.ptv_id,
            must_change_password: true,
          },
          crew: updatedCrew,
        }));
        return;
      }

      const payload = normalizePersonnelAliases(rawBody);
      const sensitive = ['username', 'role', 'status_akun', 'assigned_profiles', 'allowed_overrides', 'denied_overrides', 'password', 'oauth_uid', 'oauth_email', 'oauth_provider', 'auth_user_id', 'canonical_identity_id', 'metadata_json'];
      if (sensitive.some(key => Object.prototype.hasOwnProperty.call(payload, key))) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Pengaturan akun dan izin hanya melalui Manajemen Akun.', code: 'access_fields_forbidden' })); return; }
      if (payload.category !== undefined && !['Kru', 'Pembina', 'Pengarah'].includes(payload.category)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Kategori personel tidak valid.' })); return; }
      if (payload.status_kru !== undefined && !['Aktif', 'Nonaktif'].includes(payload.status_kru)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Status keanggotaan tidak valid.' })); return; }
      if (payload.ptv_id !== undefined && !/^PTV-[0-9]{3,}$/.test(payload.ptv_id)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'ID PTV tidak valid.' })); return; }

      if (!access.can('crew.edit') && Object.keys(payload).some(key => !['version', 'id', 'archive_id', 'ptv_id', 'status_kru'].includes(key))) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Izin status tidak memberikan izin edit profil.' })); return; }
      const targetId = (urlObj.searchParams.get('id') || payload.id || payload.archive_id || payload.ptv_id || '').trim();

      if (!targetId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Parameter ID kru wajib disertakan (archive_id atau ptv_id).', code: 'missing_crew_id' }));
        return;
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      if (!isUuid && !/^PTV-[0-9]{3,}$/.test(targetId)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Identifier kru tidak valid.' })); return; }
      const query = supabase.from('legacy_archive_kru').select('*');
      const { data: existingRows, error: findErr } = isUuid
        ? await query.or(`archive_id.eq.${targetId},production_id.eq.${targetId}`)
        : await query.eq('ptv_id', targetId);

      if (findErr) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal mencari data kru di Staging: ${findErr.message}`, code: 'database_query_error' }));
        return;
      }

      const existing = (existingRows && existingRows[0]) as RawLegacyKruDbRow | undefined;
      if (existingRows && existingRows.length > 1) { res.statusCode = 409; res.end(JSON.stringify({ error: 'Identitas kru ambigu; diperlukan rekonsiliasi.' })); return; }
      if (!existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Data kru dengan identifier "${targetId}" tidak ditemukan di database Staging.`, code: 'crew_not_found' }));
        return;
      }

      if (payload.status_kru !== undefined && payload.status_kru !== mapLegacyKruRowToCrewMember(existing).status_kru && !access.can('crew.status.manage')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Izin mengelola status diperlukan.' })); return; }
      if (payload.full_name !== undefined && (typeof payload.full_name !== 'string' || payload.full_name.trim().length < 2)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Nama lengkap minimal 2 karakter.' })); return; }
      const category = payload.category || mapLegacyKruRowToCrewMember(existing).category;
      if (payload.division !== undefined && category === 'Kru' && payload.division !== existing.divisi && !CANONICAL_OPERATIONAL_DIVISIONS.includes(payload.division)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Divisi aktif tidak valid.' })); return; }

      // Siapkan update fields
      const updates: Partial<RawLegacyKruDbRow> = {};

      if (typeof payload.full_name === 'string' && payload.full_name.trim().length >= 2) {
        updates.full_name = payload.full_name.trim();
      }
      if (typeof payload.division === 'string') {
        updates.divisi = payload.division.trim();
      }
      if (typeof payload.position === 'string') {
        updates.jabatan = payload.position.trim();
      }
      if (payload.angkatan !== undefined) {
        updates.angkatan = String(payload.angkatan).trim();
      }
      if (payload.status_kru) {
        const nextStatus = payload.status_kru;
        updates.status = (nextStatus === 'Nonaktif' || nextStatus === 'nonaktif') ? 'nonaktif' : 'aktif';
      }
      if (payload.foto_url !== undefined) {
        updates.photo_url = (payload.foto_url || '').trim() || 'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp';
      }
      if (payload.phone !== undefined) {
        updates.telepon_masked = (payload.phone || '').trim() || null;
      }
      if (payload.email !== undefined) {
        updates.email_masked = (payload.email || '').trim() || null;
      }

      // Merge metadata_json
      const existingMeta = (typeof existing.metadata_json === 'object' && existing.metadata_json !== null)
        ? existing.metadata_json
        : {};

      const updatedMeta: Record<string, any> = {
        ...existingMeta,
        updated_at: new Date().toISOString(),
        updated_by_account_id: session.account_id,
      };

      if (payload.category !== undefined) updatedMeta.category = payload.category;
      if (payload.nim !== undefined) updatedMeta.nim = payload.nim ? String(payload.nim).trim() : null;
      if (payload.jurusan !== undefined) updatedMeta.jurusan = payload.jurusan ? String(payload.jurusan).trim() : null;
      if (payload.birth_date !== undefined || payload.tanggal_lahir !== undefined) {
        updatedMeta.birth_date = String(payload.birth_date || payload.tanggal_lahir || '').trim() || null;
        updatedMeta.tanggal_lahir = updatedMeta.birth_date;
      }
      if (payload.address !== undefined || payload.alamat !== undefined) {
        updatedMeta.address = String(payload.address || payload.alamat || '').trim() || null;
        updatedMeta.alamat = updatedMeta.address;
      }
      if (payload.foto_url !== undefined) {
        updatedMeta.avatar_url = payload.foto_url ? String(payload.foto_url).trim() : 'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp';
      }
      if (payload.phone !== undefined) updatedMeta.original_phone = payload.phone ? String(payload.phone).trim() : null;
      if (payload.email !== undefined) updatedMeta.original_email = payload.email ? String(payload.email).trim() : null;

      if ((payload.category || existingMeta.category) === 'Pembina' || (payload.category || existingMeta.category) === 'Pengarah') { updates.divisi = null; updates.angkatan = null; }
      updates.metadata_json = updatedMeta;

      // Update langsung di database Staging legacy_archive_kru
      const { data: updatedRow, error: updateErr } = await supabase
        .from('legacy_archive_kru')
        .update(updates)
        .eq('archive_id', existing.archive_id)
        .select('*')
        .single();

      if (updateErr || !updatedRow) {
        console.error('[API Kru] Pembaruan personel gagal:', updateErr);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal memperbarui data kru di Staging: ${updateErr?.message || 'Database update error'}`, code: 'database_update_error' }));
        return;
      }

      // Sinkronkan jabatan ke organization_membership jika kru terhubung ke canonical_identity
      let canonicalId = existing.canonical_identity_id;
      if (!canonicalId) {
        try {
          const { data: matchedCi } = await supabase.from('canonical_identity').select('id').eq('ptv_id', existing.ptv_id).maybeSingle();
          canonicalId = matchedCi?.id || null;
        } catch {
          canonicalId = null;
        }
      }

      if (canonicalId && updates.jabatan) {
        try {
          await supabase
            .from('organization_membership')
            .update({
              position_title: updates.jabatan,
              updated_at: new Date().toISOString(),
            })
            .eq('identity_id', canonicalId)
            .eq('organization_id', 'ptv_studio')
            .eq('is_current', true);
        } catch (omErr) {
          console.warn('[API Kru] Sinkronisasi membership position_title terlewati:', omErr);
        }
      }

      // Jika terhubung canonical identity, sinkronkan juga metadata jika memungkinkan
      let accountStatus: 'active' | 'inactive' | null = null;
      if (canonicalId) {
        const { data: accounts } = await supabase.from('user_account').select('status_akun').eq('identity_id', canonicalId);
        accountStatus = accounts?.[0]?.status_akun ?? null;
      }

      const updatedMember = mapLegacyKruRowToCrewMember(updatedRow, accountStatus);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Data profil kru ${updatedMember.full_name} (${updatedMember.ptv_id}) berhasil diperbarui di database Staging.`,
          crew: updatedMember,
        })
      );
      return;
    }
  } catch {
    console.error('[API Kru] Permintaan gagal diproses.');
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: 'Permintaan personel tidak valid atau tidak dapat diproses.',
        code: 'internal_server_error',
      })
    );
  }
}

/**
 * Programmatic request runner for regression testing and direct controller invocation
 */
export async function handleKruApiRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
}): Promise<{ status: number; body: any }> {
  let statusCode = 200;
  let responseData: any = null;

  const chunks: Buffer[] = [];
  if (options.body) {
    const rawStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    chunks.push(Buffer.from(rawStr));
  }

  const { Readable } = await import('node:stream');
  const mockReq = new Readable({
    read() {
      if (chunks.length > 0) {
        this.push(chunks.shift());
      } else {
        this.push(null);
      }
    },
  }) as unknown as IncomingMessage;

  mockReq.method = options.method || 'GET';
  mockReq.url = options.url || '/api/kru';
  mockReq.headers = options.headers || {};

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

  await handler(mockReq, mockRes);
  return { status: statusCode, body: responseData };
}
