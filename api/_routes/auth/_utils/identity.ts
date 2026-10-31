import { createClient } from '@supabase/supabase-js';
import type { SessionPayload } from './types';
import { resolveLiveAccess } from './liveAccess';
import { lifecycleEnabled, sessionNeedsRegistry, portalSessionValid } from './portalLifecycle';

function createStagingIdentityClient(url: string, key: string) {
  if (!/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) throw new Error('Identity backend must be verified Staging.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface ResolveIdentityResult {
  success: boolean;
  error?: string;
  code?: 'unlinked' | 'access_denied' | 'server_error';
  session?: SessionPayload;
}

interface CachedSessionCapabilities {
  capabilities: string[];
  assigned_profiles: string[];
  status_organisasi: 'active' | 'inactive' | 'archived';
  division?: string;
  position?: string;
  cachedAt: number;
}

const LIVE_SESSION_CACHE = new Map<string, CachedSessionCapabilities>();
const LIVE_SESSION_CACHE_TTL_MS = 20000; // 20s short-lived in-memory cache per worker

let cachedRegistryKeys: string[] | null = null;
let cachedRegistryAt = 0;
const REGISTRY_CACHE_TTL_MS = 300000; // 5m cache for static capability registry

interface CachedAccountStatus {
  active: boolean;
  cachedAt: number;
}
const ACCOUNT_STATUS_CACHE = new Map<string, CachedAccountStatus>();
const ACCOUNT_STATUS_CACHE_TTL_MS = 20000; // 20s
export async function refreshLiveSession(session: SessionPayload, issuingSession = false): Promise<string[]> {
  const cacheKey = `${session.account_id}:${session.iat}`;
  const now = Date.now();
  const cached = LIVE_SESSION_CACHE.get(cacheKey);
  if (!issuingSession && cached && (now - cached.cachedAt < LIVE_SESSION_CACHE_TTL_MS)) {
    session.capabilities = cached.capabilities;
    session.assigned_profiles = cached.assigned_profiles;
    session.status_organisasi = cached.status_organisasi;
    session.division = cached.division;
    session.position = cached.position;
    return session.capabilities;
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) {
    if (!process.env.VERCEL && session && Array.isArray(session.capabilities) && session.capabilities.length > 0) {
      return session.capabilities;
    }
    return [];
  }
  try {
    const db = createStagingIdentityClient(url, key);
    const live = await resolveLiveAccess(db, session, { issuingSession });
    if (session.identity_id !== live.identity.id) return [];

    let registryKeys = cachedRegistryKeys;
    if (!registryKeys || (now - cachedRegistryAt > REGISTRY_CACHE_TTL_MS)) {
      const registry = await db.from('capability_registry').select('key');
      if (registry.error || !registry.data) return [];
      registryKeys = registry.data.map(r => r.key);
      cachedRegistryKeys = registryKeys;
      cachedRegistryAt = now;
    }

    session.capabilities = registryKeys.filter(k => live.can(k as any));
    session.assigned_profiles = live.profiles;
    session.status_organisasi = live.membership.status_organisasi;
    session.division = live.membership.division_id;
    session.position = live.membership.position_title;

    LIVE_SESSION_CACHE.set(cacheKey, {
      capabilities: session.capabilities,
      assigned_profiles: session.assigned_profiles,
      status_organisasi: session.status_organisasi,
      division: session.division,
      position: session.position,
      cachedAt: now,
    });

    return session.capabilities;
  } catch {
    if (!process.env.VERCEL && session && Array.isArray(session.capabilities) && session.capabilities.length > 0) {
      return session.capabilities;
    }
    return [];
  }
}

export interface GoogleOAuthStatusResult {
  is_linked: boolean;
  oauth_provider?: 'google';
  oauth_subject_id?: string;
  oauth_email?: string;
  updated_at?: string;
}

export interface LinkGoogleResult {
  success: boolean;
  conflict?: boolean;
  error?: string;
  oauth_email?: string;
}

export interface UnlinkGoogleResult {
  success: boolean;
  error?: string;
}

/**
 * In-memory registry for linked Google accounts during test harness runs.
 */
export const LOCAL_LINKED_GOOGLE_ACCOUNTS = new Map<string, {
  accountId: string;
  googleSub: string;
  oauthEmail?: string;
}>();

/**
 * Fixture accounts mapped with Google Sub for automated CI & local test harness.
 * Only utilized when NODE_ENV === 'test' and live database credentials are absent.
 */
export const LOCAL_GOOGLE_MOCK_USERS: Record<string, {
  google_sub: string;
  ptv_id: string;
  full_name: string;
  username: string;
  status_akun: 'active' | 'inactive';
  status_organisasi: 'active' | 'inactive' | 'archived';
  division: string;
  position: string;
  profiles: string[];
  capabilities: string[];
}> = {
  'google-sub-ptv-025': {
    google_sub: 'google-sub-ptv-025',
    ptv_id: 'PTV-025',
    full_name: 'Zidna Santri',
    username: 'zidna',
    status_akun: 'active',
    status_organisasi: 'active',
    division: 'Technical',
    position: 'Crew Operator',
    profiles: ['crew'],
    capabilities: [
      'hub.access',
      'events.view',
      'calendar.view',
      'inventory.view',
      'loans.view',
      'loans.checkout',
      'loans.return',
      'damage.view',
      'damage.report',
      'lostfound.view',
      'lostfound.report',
      'crew.view',
      'id.view',
      'id.export',
      'documents.view',
      'documents.request',
      'contacts.internal.view',
      'contacts.external.view',
      'broadcast.view',
      'projecthaul.view',
      'notes.view',
      'notes.create',
      'settings.personal',
    ],
  },
  'google-sub-ptv-001': {
    google_sub: 'google-sub-ptv-001',
    ptv_id: 'PTV-001',
    full_name: 'Ahmad Executive',
    username: 'eksekutif',
    status_akun: 'active',
    status_organisasi: 'active',
    division: 'Leadership',
    position: 'Ketua Umum',
    profiles: ['eksekutif'],
    capabilities: [
      'hub.access',
      'events.view',
      'events.create',
      'events.edit',
      'events.delete',
      'events.rundown.manage',
      'calendar.view',
      'inventory.view',
      'inventory.create',
      'inventory.edit',
      'inventory.delete',
      'inventory.units.manage',
      'inventory.valuation.view',
      'inventory.valuation.manage',
      'loans.view',
      'loans.checkout',
      'loans.return',
      'loans.manage',
      'damage.view',
      'damage.report',
      'damage.qc.approve',
      'lostfound.view',
      'lostfound.report',
      'lostfound.manage',
      'crew.view',
      'crew.create',
      'crew.edit',
      'crew.status.manage',
      'crew.permissions.manage',
      'id.view',
      'id.export',
      'documents.view',
      'documents.request',
      'documents.generate',
      'documents.approve',
      'documents.archive.view',
      'documents.archive.manage',
      'finance.view',
      'finance.manage',
      'finance.operator',
      'contacts.internal.view',
      'contacts.external.view',
      'contacts.external.manage',
      'broadcast.view',
      'broadcast.dispatch',
      'projecthaul.view',
      'projecthaul.manage',
      'notes.view',
      'notes.create',
      'notes.manage',
      'settings.personal',
      'settings.system',
      'audit.logs.view',
    ],
  },
  'google-sub-inactive': {
    google_sub: 'google-sub-inactive',
    ptv_id: 'PTV-099',
    full_name: 'Inactive Crew Member',
    username: 'inactive_crew',
    status_akun: 'inactive',
    status_organisasi: 'inactive',
    division: 'Technical',
    position: 'Mantan Kru',
    profiles: ['crew'],
    capabilities: ['hub.access'],
  },
  'google-sub-no-hub-access': {
    google_sub: 'google-sub-no-hub-access',
    ptv_id: 'PTV-088',
    full_name: 'No Hub Access Member',
    username: 'no_hub',
    status_akun: 'active',
    status_organisasi: 'active',
    division: 'Support',
    position: 'Support Staff',
    profiles: [],
    capabilities: ['inventory.view'],
  },
};

/**
 * Resolves Google Subject ID via auth_credentials (oauth_provider='google', oauth_subject_id=google_sub)
 * against canonical PTVPRO database/identity model.
 * Enforces Fail-Closed security:
 * 1. Must be linked to an existing auth_credentials record (oauth_provider='google', oauth_subject_id=googleSub).
 * 2. status_akun must be 'active'.
 * 3. Must possess 'hub.access' capability.
 */
export async function resolveIdentityByGoogleSub(
  googleSub: string,
  userEmail?: string
): Promise<ResolveIdentityResult> {
  if (!googleSub) {
    return {
      success: false,
      error: 'Google Subject ID (sub) tidak ditemukan.',
      code: 'server_error',
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Live PostgreSQL Supabase Connection
  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);

      // Query auth_credentials by oauth_provider = 'google' and oauth_subject_id = googleSub,
      // joining user_account and canonical_identity (Option 2 Architecture).
      const { data: credentialRow, error: credError } = await supabase
        .from('auth_credentials')
        .select(`
          account_id,
          oauth_provider,
          oauth_subject_id,
          oauth_email,
          user_account:user_account!account_id (
            id,
            identity_id,
            username,
            status_akun,
            canonical_identity:canonical_identity!identity_id (
              id,
              ptv_id,
              full_name
            )
          )
        `)
        .eq('oauth_provider', 'google')
        .eq('oauth_subject_id', googleSub)
        .maybeSingle();

      if (credError) {
        // Table or schema error
        return {
          success: false,
          error: `Database Auth Error: Gagal memeriksa auth_credentials (${credError.message || credError.code}).`,
          code: 'server_error',
        };
      }

      if (!credentialRow || !credentialRow.user_account) {
        return {
          success: false,
          error: `Akun Google (${userEmail ? `${userEmail} [Subject ID: ${googleSub}]` : googleSub}) belum ditautkan ke akun kru resmi PTVPRO di database. Hubungi Administrator PTV untuk menautkan akun.`,
          code: 'unlinked',
        };
      }

      const userAccount = credentialRow.user_account as any;

      // Check status_akun
      if (userAccount.status_akun !== 'active') {
        const ptvId = (userAccount.canonical_identity as any)?.ptv_id || 'PTV-GUEST';
        return {
          success: false,
          error: `Akun (${ptvId}) sedang berstatus "${userAccount.status_akun}". Operasi PTV Hub membutuhkan akun berstatus "active".`,
          code: 'access_denied',
        };
      }

      // Query effective capabilities for this account
      const { data: profileRows } = await supabase
        .from('account_profiles')
        .select('profile_id')
        .eq('account_id', userAccount.id);

      const assignedProfiles = (profileRows || []).map((p: any) => p.profile_id);

      // Check capability hub.access
      const { data: capRows } = await supabase
        .from('account_capability_overrides')
        .select('capability_key, override_type')
        .eq('account_id', userAccount.id);

      const allowedOverrides = (capRows || [])
        .filter((c: any) => c.override_type === 'allow')
        .map((c: any) => c.capability_key);

      const deniedOverrides = (capRows || [])
        .filter((c: any) => c.override_type === 'deny')
        .map((c: any) => c.capability_key);

      const hasHubAccess =
        (assignedProfiles.length > 0 && !deniedOverrides.includes('hub.access')) ||
        allowedOverrides.includes('hub.access');

      if (!hasHubAccess) {
        const ptvId = (userAccount.canonical_identity as any)?.ptv_id || 'PTV-GUEST';
        return {
          success: false,
          error: `Akses Ditolak: Akun (${ptvId}) tidak memiliki izin akses PTV Hub (hub.access). Hubungi Administrator PTV.`,
          code: 'access_denied',
        };
      }

      const ptvId = (userAccount.canonical_identity as any)?.ptv_id || 'PTV-GUEST';
      const fullName = (userAccount.canonical_identity as any)?.full_name || userAccount.username;
      const now = Date.now();

      const session: SessionPayload = {
        account_id: userAccount.id,
        identity_id: userAccount.identity_id,
        ptv_id: ptvId,
        full_name: fullName,
        username: userAccount.username,
        status_akun: userAccount.status_akun,
        status_organisasi: 'active',
        assigned_profiles: assignedProfiles,
        capabilities: ['hub.access', ...allowedOverrides],
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + 7 * 24 * 3600,
      };

      if (!(await refreshLiveSession(session, true)).includes('hub.access')) {
        return { success: false, code: 'access_denied', error: 'Akses akun tidak dapat diverifikasi.' };
      }
      return { success: true, session };
    } catch (dbErr: any) {
      return {
        success: false,
        error: `Database Gateway Exception: ${dbErr?.message || 'Gagal menghubungi database PostgreSQL.'}`,
        code: 'server_error',
      };
    }
  }

  // 2. Controlled Test Harness (Only in NODE_ENV === 'test')
  if (process.env.NODE_ENV === 'test') {
    let matchedUser = LOCAL_GOOGLE_MOCK_USERS[googleSub];

    // Check dynamically linked accounts in test harness
    if (!matchedUser) {
      for (const linked of LOCAL_LINKED_GOOGLE_ACCOUNTS.values()) {
        if (linked.googleSub === googleSub) {
          const userFound = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
            (u) =>
              `acc-${u.ptv_id.toLowerCase()}` === linked.accountId ||
              u.username === linked.accountId ||
              u.ptv_id.toLowerCase() === linked.accountId.toLowerCase()
          );
          if (userFound) {
            matchedUser = userFound;
            break;
          }
        }
      }
    }

    if (!matchedUser) {
      return {
        success: false,
        error: `Akun Google (${userEmail || googleSub}) belum ditautkan ke akun kru resmi PTVPRO. Hubungi Administrator PTV untuk menautkan akun.`,
        code: 'unlinked',
      };
    }

    if (matchedUser.status_akun !== 'active') {
      return {
        success: false,
        error: `Akun (${matchedUser.ptv_id}) sedang berstatus "${matchedUser.status_akun}". Operasi PTV Hub membutuhkan akun berstatus "active".`,
        code: 'access_denied',
      };
    }

    if (!matchedUser.capabilities.includes('hub.access')) {
      return {
        success: false,
        error: `Akses Ditolak: Akun (${matchedUser.ptv_id}) tidak memiliki izin akses PTV Hub (hub.access). Hubungi Administrator PTV.`,
        code: 'access_denied',
      };
    }

    const now = Date.now();
    const session: SessionPayload = {
      account_id: `acc-${matchedUser.ptv_id.toLowerCase()}`,
      identity_id: `id-${matchedUser.ptv_id.toLowerCase()}`,
      ptv_id: matchedUser.ptv_id,
      full_name: matchedUser.full_name,
      username: matchedUser.username,
      division: matchedUser.division,
      position: matchedUser.position,
      status_akun: matchedUser.status_akun,
      status_organisasi: matchedUser.status_organisasi,
      assigned_profiles: matchedUser.profiles,
      capabilities: matchedUser.capabilities,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 7 * 24 * 3600,
    };

    return {
      success: true,
      session,
    };
  }

  // 3. Fail-Closed in production/staging if database connection is not configured
  return {
    success: false,
    error: 'Konfigurasi Server Error: Kredensial database backend (SUPABASE_SERVICE_ROLE_KEY) belum dikonfigurasi pada server Vercel. Akses ditolak fail-closed.',
    code: 'server_error',
  };
}

/**
 * Performs a live database check to verify that an account is still active and not revoked.
 */
export async function verifyAccountStatusLive(accountId: string, issuedAt?: number, verifiedSession?: SessionPayload): Promise<boolean> {
  const cacheKey = `${accountId}:${issuedAt || 0}`;
  const now = Date.now();
  const cached = ACCOUNT_STATUS_CACHE.get(cacheKey);
  if (cached && (now - cached.cachedAt < ACCOUNT_STATUS_CACHE_TTL_MS)) {
    return cached.active;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabase
        .from('user_account')
        .select('status_akun,lockout_until,tokens_valid_after')
        .eq('id', accountId)
        .maybeSingle();

      if (!error && data) {
        const active = data.status_akun === 'active'
          && (!data.lockout_until || (Number.isFinite(Date.parse(data.lockout_until)) && Date.parse(data.lockout_until) <= Date.now()))
          && Number.isSafeInteger(issuedAt) && issuedAt! > 0 && issuedAt! * 1000 <= Date.now()
          && (!data.tokens_valid_after || (Number.isFinite(Date.parse(data.tokens_valid_after)) && issuedAt! * 1000 >= Date.parse(data.tokens_valid_after)));
        if (!active) {
          ACCOUNT_STATUS_CACHE.set(cacheKey, { active: false, cachedAt: now });
          return false;
        }
        let isValid = true;
        if (lifecycleEnabled() || (verifiedSession && sessionNeedsRegistry(verifiedSession))) {
          isValid = !!verifiedSession && verifiedSession.account_id === accountId && verifiedSession.iat === issuedAt && await portalSessionValid(supabase, verifiedSession);
        }
        ACCOUNT_STATUS_CACHE.set(cacheKey, { active: isValid, cachedAt: now });
        return isValid;
      }
    } catch {
      // Lanjutkan ke pemeriksaan dev mock jika di luar Vercel
    }
  }

  if (process.env.NODE_ENV === 'test' || !process.env.VERCEL) {
    const match = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
      (u) =>
        `acc-${u.ptv_id.toLowerCase()}` === accountId ||
        `acc-${u.ptv_id.toLowerCase().replace('ptv-', '')}` === accountId
    );
    return match ? match.status_akun === 'active' : false;
  }

  return false;
}

/**
 * Mengambil status koneksi Google SSO / OAuth untuk akun pengguna.
 */
export async function getGoogleOAuthStatus(accountId: string): Promise<GoogleOAuthStatusResult> {
  if (!accountId) return { is_linked: false };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);

      const { data, error } = await supabase
        .from('auth_credentials')
        .select('oauth_provider, oauth_subject_id, oauth_email, updated_at')
        .eq('account_id', accountId)
        .maybeSingle();

      if (!error && data && data.oauth_provider === 'google' && data.oauth_subject_id) {
        return {
          is_linked: true,
          oauth_provider: 'google',
          oauth_subject_id: data.oauth_subject_id,
          oauth_email: data.oauth_email || undefined,
          updated_at: data.updated_at,
        };
      }
      return { is_linked: false };
    } catch {
      return { is_linked: false };
    }
  }

  // Test Harness / Local Mock Check
  const linked = LOCAL_LINKED_GOOGLE_ACCOUNTS.get(accountId);
  if (linked && linked.googleSub) {
    return {
      is_linked: true,
      oauth_provider: 'google',
      oauth_subject_id: linked.googleSub,
      oauth_email: linked.oauthEmail,
      updated_at: new Date().toISOString(),
    };
  }

  const staticMatch = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
    (u) => `acc-${u.ptv_id.toLowerCase()}` === accountId
  );
  if (staticMatch) {
    return {
      is_linked: true,
      oauth_provider: 'google',
      oauth_subject_id: staticMatch.google_sub,
      oauth_email: `${staticMatch.username}@ptvpro.com`,
      updated_at: new Date().toISOString(),
    };
  }

  return { is_linked: false };
}

/**
 * Menghubungkan Google Subject ID ke akun PTVPRO.
 * Mencegah account takeover dan konflik identitas:
 * 1. Menolak jika Google Sub sudah terhubung ke akun PTVPRO lain.
 * 2. Mutasi live ditahan sampai RPC atomik tersedia.
 * 3. Tautan existing yang sama hanya menghasilkan no-op.
 */
export async function linkGoogleIdentityToAccount(
  accountId: string,
  googleSub: string,
  googleEmail?: string
): Promise<LinkGoogleResult> {
  if (!accountId || !googleSub) {
    return {
      success: false,
      error: 'ID akun dan Google Subject ID wajib disertakan untuk menghubungkan akun.',
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);

      // 1. Conflict Check: Pastikan Google Sub ini belum terhubung ke akun PTVPRO LAIN
      const { data: conflictCred, error: conflictErr } = await supabase
        .from('auth_credentials')
        .select('account_id, oauth_email')
        .eq('oauth_provider', 'google')
        .eq('oauth_subject_id', googleSub)
        .maybeSingle();

      if (!conflictErr && conflictCred && conflictCred.account_id !== accountId) {
        return {
          success: false,
          conflict: true,
          error: 'Identitas Google ini sudah terhubung ke akun kru PTVPRO lain. Hubungan ganda ditolak.',
        };
      }

      if (conflictErr) return { success: false, error: 'Identitas Google tidak dapat diverifikasi.' };
      if (conflictCred?.account_id === accountId) return { success: true, oauth_email: conflictCred.oauth_email || undefined };
      return { success: false, error: 'Linking Google ditahan sampai tersedia RPC atomik dengan proteksi Root, sesi, dan audit.' };

    } catch (err: any) {
      return {
        success: false,
        error: `Database Gateway Error: ${err?.message || 'Gagal menghubungi database.'}`,
      };
    }
  }

  if (process.env.NODE_ENV !== 'test') return { success: false, error: 'Backend autentikasi tidak tersedia.' };
  // Test Harness / Local Mock Mode
  // Conflict Check in Mock
  for (const [existingAccId, existingLink] of LOCAL_LINKED_GOOGLE_ACCOUNTS.entries()) {
    if (existingLink.googleSub === googleSub && existingAccId !== accountId) {
      return {
        success: false,
        conflict: true,
        error: 'Identitas Google ini sudah terhubung ke akun kru PTVPRO lain. Hubungan ganda ditolak.',
      };
    }
  }

  const staticConflict = Object.entries(LOCAL_GOOGLE_MOCK_USERS).find(
    ([sub, u]) => sub === googleSub && `acc-${u.ptv_id.toLowerCase()}` !== accountId
  );
  if (staticConflict) {
    return {
      success: false,
      conflict: true,
      error: 'Identitas Google ini sudah terhubung ke akun kru PTVPRO lain. Hubungan ganda ditolak.',
    };
  }

  LOCAL_LINKED_GOOGLE_ACCOUNTS.set(accountId, {
    accountId,
    googleSub,
    oauthEmail: googleEmail,
  });

  return { success: true, oauth_email: googleEmail };
}

/**
 * Pelepasan live ditahan sampai RPC recovery-safe tersedia. Mutasi in-memory hanya test.
 */
export async function unlinkGoogleIdentityFromAccount(accountId: string): Promise<UnlinkGoogleResult> {
  if (!accountId) {
    return { success: false, error: 'ID akun tidak valid.' };
  }

  if (process.env.NODE_ENV !== 'test' || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: 'Pelepasan Google ditahan sampai tersedia RPC atomik yang melindungi Root dan metode login terakhir.' };
  }

  // Test Harness / Local Mock Mode
  LOCAL_LINKED_GOOGLE_ACCOUNTS.delete(accountId);
  return { success: true };
}

/**
 * Identifier-only fixtures are restricted to isolated tests. Live password login is unavailable.
 */
export async function resolveIdentityByCredentials(
  identifier: string,
  _password?: string
): Promise<ResolveIdentityResult> {
  // This legacy resolver has no password verifier. Never mint a live session from an identifier alone.
  if (process.env.NODE_ENV !== 'test' || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, code: 'access_denied', error: 'Login password belum tersedia secara aman. Gunakan Google yang sudah ditautkan atau hubungi operator.' };
  }
  const rawId = (identifier || '').trim();
  if (!rawId) {
    return {
      success: false,
      error: 'Identitas kru (Username atau PTV-ID) wajib diisi.',
      code: 'unlinked',
    };
  }

  // 2. Authorized Dev Accounts Registry (for localhost / dev testing)
  const lower = rawId.toLowerCase();
  const mockMatch = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
    (u) => u.username.toLowerCase() === lower || u.ptv_id.toLowerCase() === lower
  );

  if (mockMatch) {
    if (mockMatch.status_akun !== 'active') {
      return {
        success: false,
        error: `Akun (${mockMatch.ptv_id}) sedang berstatus "${mockMatch.status_akun}". Operasi PTV Hub membutuhkan akun berstatus "active".`,
        code: 'access_denied',
      };
    }

    if (!mockMatch.capabilities.includes('hub.access')) {
      return {
        success: false,
        error: `Akses Ditolak: Akun (${mockMatch.ptv_id}) tidak memiliki izin akses PTV Hub (hub.access).`,
        code: 'access_denied',
      };
    }

    const now = Date.now();
    const session: SessionPayload = {
      account_id: `acc-${mockMatch.ptv_id.toLowerCase()}`,
      identity_id: `id-${mockMatch.ptv_id.toLowerCase()}`,
      ptv_id: mockMatch.ptv_id,
      full_name: mockMatch.full_name,
      username: mockMatch.username,
      status_akun: mockMatch.status_akun,
      status_organisasi: mockMatch.status_organisasi,
      assigned_profiles: mockMatch.profiles,
      capabilities: mockMatch.capabilities,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 7 * 24 * 3600,
    };

    return { success: true, session };
  }

  return {
    success: false,
    error: `Kredensial login untuk identifier "${rawId}" tidak ditemukan atau belum terdaftar pada sistem.`,
    code: 'unlinked',
  };
}


