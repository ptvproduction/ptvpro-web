import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { parseJsonBody } from './auth/_utils/bodyParser';
import { verifySessionToken } from './auth/_utils/crypto';
import { resolveLiveAccess, clearLiveAccessCache } from './auth/_utils/liveAccess';
import { accessChangeSchema, type AccessAccount } from '../../src/products/hub/akses/accessContract';
import { getPositionCapabilityMappings, savePositionCapabilityMappings, formatPositionMappingsAsArray } from './positionMapping';
import { hash } from 'bcryptjs';

export async function readAccessAccounts(db: SupabaseClient) {
  const [accounts, identities, members, profiles, overrides, catalog, registry, grants, positionMappings] = await Promise.all([
    db.from('user_account').select('id,identity_id,username,status_akun,updated_at,auth_user_id'),
    db.from('canonical_identity').select('id,ptv_id,full_name'),
    db.from('organization_membership').select('identity_id,position_title,division_id,status_organisasi').eq('organization_id', 'ptv_studio').eq('is_current', true),
    db.from('account_profiles').select('account_id,profile_id'),
    db.from('account_capability_overrides').select('account_id,capability_key,override_type'),
    db.from('access_profile').select('id,name,description').order('id'),
    db.from('capability_registry').select('key,description,is_sensitive,is_mutation').order('key'),
    db.from('profile_capabilities').select('profile_id,capability_key'),
    getPositionCapabilityMappings(db),
  ]);

  if ([accounts, identities, members, profiles, overrides, catalog, registry, grants].some(r => r.error)) {
    throw new Error('Gagal membaca data akun dan akses dari Staging.');
  }

  const rows: AccessAccount[] = (accounts.data || [])
    .filter(a => {
      const identity = identities.data?.find(i => i.id === a.identity_id);
      const uname = (a.username || '').toLowerCase();
      const ptv = (identity?.ptv_id || '').toLowerCase();
      const name = (identity?.full_name || '').toLowerCase();
      // Exclude non-operational testing / fixture accounts
      if (
        uname.includes('staging') ||
        uname.includes('test') ||
        ptv.includes('stg') ||
        ptv.includes('test') ||
        name.includes('staging admin') ||
        name.includes('staging kru') ||
        name.includes('tester')
      ) {
        return false;
      }
      return true;
    })
    .map(a => {
      const identity = identities.data?.find(i => i.id === a.identity_id);
      const membership = members.data?.filter(m => m.identity_id === a.identity_id) || [];
      const position = membership.length === 1 ? (membership[0].position_title || 'Kru Operasional') : 'Kru Operasional';
      const division = membership.length === 1 ? (membership[0].division_id || '') : '';

      return {
        id: a.id,
        identityId: a.identity_id,
        ptvId: identity?.ptv_id || '',
        name: identity?.full_name || '',
        username: a.username,
        position,
        division,
        status: a.status_akun as 'active' | 'inactive',
        organizationStatus: membership.length === 1 ? membership[0].status_organisasi : 'archived',
        profiles: (profiles.data || []).filter(p => p.account_id === a.id).map(p => p.profile_id),
        allowed: (overrides.data || []).filter(o => o.account_id === a.id && o.override_type === 'allow').map(o => o.capability_key),
        denied: (overrides.data || []).filter(o => o.account_id === a.id && o.override_type === 'deny').map(o => o.capability_key),
        version: a.updated_at,
      };
    });

  return {
    accounts: rows,
    profiles: catalog.data || [],
    capabilities: registry.data || [],
    grants: grants.data || [],
    positionMappings: formatPositionMappingsAsArray(positionMappings),
  };
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };

  if (!['GET', 'POST'].includes(req.method || '')) {
    return send(405, { error: 'Metode tidak didukung pada Manajemen Akun.' });
  }

  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
      throw new Error('origin');
    }
  } catch {
    return send(403, { error: 'Origin permintaan tidak diizinkan.' });
  }

  const secret = process.env.AUTH_SECRET;
  const token = parseCookies(req.headers.cookie).ptv_hub_session;
  const session = secret && token ? verifySessionToken(token, secret) : null;
  if (!session) return send(401, { error: 'Sesi login diperlukan untuk mengakses Manajemen Akun.' });

  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) {
    return send(503, { error: 'Manajemen Akun hanya tersedia di Staging terverifikasi.' });
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });

  try {
    const actor = await resolveLiveAccess(db, session);
    if (!actor.can('crew.permissions.manage')) {
      return send(403, { error: 'Akses ditolak: Izin mengelola akun & hak akses diperlukan.' });
    }

    const urlObj = new URL(req.url || '', 'http://localhost');
    const actionParam = urlObj.searchParams.get('action') || '';

    // === METHOD GET ===
    if (req.method === 'GET') {
      // Optimasi Performa: Jalankan pembacaan akun dan riwayat audit secara paralel
      const [snapshot, auditLogsRes] = await Promise.all([
        readAccessAccounts(db),
        actor.can('audit.logs.view')
          ? db
              .from('auth_audit_log')
              .select('id,event_type,created_at,metadata,actor_id')
              .in('event_type', ['account_access_changed', 'password_reset_by_root', 'position_capabilities_updated'])
              .order('created_at', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null })
      ]);

      let history: any[] = [];
      if (!auditLogsRes.error && Array.isArray(auditLogsRes.data) && auditLogsRes.data.length > 0) {
        // Reuse canonical identity mapping yang sudah dibaca dalam snapshot
        const idMap = new Map((snapshot.accounts || []).map(a => [a.identityId, { id: a.identityId, full_name: a.name, ptv_id: a.ptvId }]));

        history = auditLogsRes.data.map(h => {
          const actorObj = idMap.get(h.actor_id);
          const targetAccount = snapshot.accounts.find(a => a.id === h.metadata?.target_account_id);
          return {
            id: h.id,
            event_type: h.event_type,
            created_at: h.created_at,
            actor_name: actorObj?.full_name || 'Administrator',
            actor_ptv_id: actorObj?.ptv_id || '',
            target_username: targetAccount?.username || h.metadata?.target_username || h.metadata?.after?.username || '—',
            target_name: targetAccount?.name || h.metadata?.target_name || '—',
            target_ptv_id: targetAccount?.ptvId || h.metadata?.target_ptv_id || '',
            target_position: targetAccount?.position || h.metadata?.position || '—',
            reason: h.metadata?.after?.reason || h.metadata?.reason || (h.event_type === 'password_reset_by_root' ? 'Atur ulang password oleh ROOT' : 'Perubahan izin akses'),
            source: h.metadata?.source || 'Manajemen Akun',
            before: h.metadata?.before || null,
            after: h.metadata?.after || null,
            metadata: h.metadata,
          };
        });
      }

      return send(200, {
        ...snapshot,
        history,
        canViewHistory: actor.can('audit.logs.view'),
        isRoot: actor.profiles.includes('root_executive'),
      });
    }

    // === METHOD POST ===
    let body: any;
    try {
      body = await parseJsonBody(req, { maxBytes: 65536 });
    } catch (err: any) {
      return send(err.statusCode || 400, { error: err.message || 'Payload tidak valid.' });
    }

    const action = actionParam || body.action || '';

    // SUB-ACTION 1: Simpan Mapping Jabatan -> Izin Akses
    if (action === 'save_position_mapping') {
      if (!body.mappings || typeof body.mappings !== 'object') {
        return send(400, { error: 'Format data mapping jabatan tidak valid.' });
      }
      clearLiveAccessCache();
      await savePositionCapabilityMappings(db, body.mappings, session.account_id);
      await db.from('auth_audit_log').insert([{
        actor_id: actor.identity.id,
        event_type: 'position_capabilities_updated',
        metadata: {
          updated_by: actor.identity.full_name,
          source: 'Manajemen Akun',
          updated_at: new Date().toISOString(),
          reason: 'Pembaruan mapping jabatan dan hak akses',
        }
      }]);
      const updatedSnapshot = await readAccessAccounts(db);
      return send(200, {
        success: true,
        message: 'Mapping jabatan organisasi dan izin akses berhasil disimpan di database Staging.',
        positionMappings: updatedSnapshot.positionMappings,
      });
    }

    // SUB-ACTION 2: Atur Ulang Password oleh ROOT
    if (action === 'reset_password') {
      if (!actor.profiles.includes('root_executive')) {
        return send(403, { error: 'Akses ditolak: Fitur Atur Ulang Password hanya dapat dijalankan oleh akun ROOT.' });
      }

      const accountId = String(body.accountId || '').trim();
      const newPassword = String(body.newPassword || '').trim();

      if (!accountId) {
        return send(400, { error: 'ID akun target wajib disertakan.' });
      }
      if (!newPassword || newPassword.length < 4) {
        return send(400, { error: 'Password baru minimal 4 karakter.' });
      }
      if (Buffer.byteLength(newPassword, 'utf8') > 72) {
        return send(400, { error: 'Password baru maksimal 72 byte.' });
      }

      // Pastikan akun target ada
      const { data: targetAccount, error: accErr } = await db
        .from('user_account')
        .select('id, identity_id, username, auth_user_id')
        .eq('id', accountId)
        .maybeSingle();

      if (accErr || !targetAccount) {
        return send(404, { error: 'Akun target tidak ditemukan di database Staging.' });
      }

      // Cegah Root mereset Root lain secara sembarangan
      const { data: targetProfiles } = await db
        .from('account_profiles')
        .select('profile_id')
        .eq('account_id', targetAccount.id);

      const isTargetRoot = (targetProfiles || []).some(p => p.profile_id === 'root_executive');
      if (isTargetRoot && targetAccount.id !== session.account_id) {
        return send(403, { error: 'Perubahan akun Root dilindungi.' });
      }

      // Hash password dengan bcrypt
      const passwordHash = await hash(newPassword, 10);

      // Cari arsip kru untuk menyimpan password hash pada metadata_json
      const { data: kruRows } = await db
        .from('legacy_archive_kru')
        .select('archive_id, metadata_json')
        .eq('canonical_identity_id', targetAccount.identity_id)
        .limit(1);

      if (kruRows && kruRows.length > 0) {
        const kruRow = kruRows[0];
        const updatedMeta = {
          ...(kruRow.metadata_json || {}),
          password_hash: passwordHash,
          password_updated_at: new Date().toISOString(),
          password_updated_by: session.account_id,
        };
        await db
          .from('legacy_archive_kru')
          .update({ metadata_json: updatedMeta })
          .eq('archive_id', kruRow.archive_id);
      }

      // Jika akun terhubung ke Supabase Auth, sinkronkan juga
      if (targetAccount.auth_user_id) {
        try {
          await db.auth.admin.updateUserById(targetAccount.auth_user_id, { password: newPassword });
        } catch (e) {
          console.warn('[Akses] Supabase Auth update skipped or unavailable:', e);
        }
      }

      // Catat audit log dan batalkan sesi lama target account
      await db.from('user_account').update({ tokens_valid_after: new Date().toISOString() }).eq('id', targetAccount.id);

      await db.from('auth_audit_log').insert([{
        actor_id: actor.identity.id,
        event_type: 'password_reset_by_root',
        metadata: {
          target_account_id: targetAccount.id,
          target_username: targetAccount.username,
          executed_by: actor.identity.full_name,
          source: 'Manajemen Akun',
          reason: body.reason || 'Atur ulang password oleh ROOT',
          created_at: new Date().toISOString(),
        }
      }]);

      return send(200, {
        success: true,
        message: `Password untuk akun @${targetAccount.username} berhasil diatur ulang secara aman. Sesi lama telah dibatalkan.`,
      });
    }

    // SUB-ACTION 3: Kelola Izin Granular Akun
    const change = accessChangeSchema.parse(body);
    if (change.accountId === session.account_id) {
      return send(403, { error: 'Perubahan akses akun sendiri dilarang.' });
    }
    const snapshot = await readAccessAccounts(db);
    const target = snapshot.accounts.find(a => a.id === change.accountId);
    if (!target) return send(404, { error: 'Akun tidak ditemukan.' });
    if (target.identityId === actor.identity.id) {
      return send(403, { error: 'Perubahan akses identitas sendiri dilarang.' });
    }
    if (snapshot.accounts.some(a => a.identityId === target.identityId && a.profiles.includes('root_executive')) || change.profiles.includes('root_executive')) {
      return send(403, { error: 'Identitas Root dilindungi dan tidak dapat diubah melalui halaman ini.' });
    }
    if (target.version !== change.expectedVersion) {
      return send(409, { error: 'Akses sudah berubah. Muat ulang sebelum menyimpan.' });
    }
    if (change.profiles.some(id => !snapshot.profiles.some(p => p.id === id)) || [...change.allowed, ...change.denied].some(key => !snapshot.capabilities.some(c => c.key === key))) {
      return send(400, { error: 'Profil atau capability tidak dikenal.' });
    }

    const { data, error } = await db.rpc('rpc_manage_account_access', {
      p_actor_account_id: session.account_id,
      p_session_iat: session.iat,
      p_change: change,
    });

    if (error) {
      return send(error.code === 'PGRST202' || error.code === '42883' ? 503 : error.code === '42501' ? 403 : error.code === '40001' ? 409 : 400, {
        error: error.code === 'PGRST202' || error.code === '42883'
          ? 'Penyimpanan akses atomik belum diaktifkan. Proposal database menunggu ACC operator.'
          : 'Perubahan akses ditolak oleh database.',
        code: error.code,
      });
    }

    if (data?.success !== true) {
      return send(400, { error: 'Database tidak mengonfirmasi perubahan akses.' });
    }

    return send(200, data);
  } catch (error) {
    return send(error instanceof Error && error.message === 'forbidden' ? 403 : 400, {
      error: error instanceof Error && error.message === 'forbidden'
        ? 'Akses ditolak atau sesi telah dicabut.'
        : 'Permintaan akses tidak valid atau data tidak dapat dimuat.',
    });
  }
}
