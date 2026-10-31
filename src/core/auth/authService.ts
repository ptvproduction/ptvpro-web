/**
 * Core Authentication Service Boundary
 * Provides an interface abstraction supporting both local development mocks
 * and Supabase Auth integration without hardcoding production secrets.
 */

import { AuthResult, AuthSession, AuthUser, LoginCredentials, OAuthSignInOptions } from './types';
import { normalizeAuthUser } from './normalize';
import { AccessProfile, AppCapability, AccountStatus, OrganizationStatus } from '../policy';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<AuthResult>;
  loginWithOAuth?(options: OAuthSignInOptions): Promise<AuthResult>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
  resolveDatabaseSession?(session: any): Promise<AuthSession>;
}

/**
 * Fixture accounts for local development and architecture demonstration.
 * Covers all 5 profiles, inactive alumni, suspended accounts, and override cases.
 */
export const LOCAL_DEV_MOCK_USERS: Record<string, AuthUser> = {
  // 1. Institutional Root Account
  'PTV-ROOT': {
    id: '00000000-0000-0000-0000-000000000001',
    ptv_id: 'PTV-ROOT',
    full_name: 'PTV Studio Master Root',
    username: 'root',
    organization: 'PTV Studio',
    division: 'Master Control',
    position: 'Institutional Root Executive',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['root_executive'],
    allowed_overrides: [],
    denied_overrides: [],
  },

  // 2. Eksekutif
  'PTV-001': {
    id: '00000000-0000-0000-0000-000000000002',
    ptv_id: 'PTV-001',
    full_name: 'Ahmad Executive',
    username: 'eksekutif',
    organization: 'PTV Studio',
    division: 'Leadership',
    position: 'Ketua Umum',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['eksekutif'],
    allowed_overrides: [],
    denied_overrides: [],
  },

  // 3. Kepolo Kepali (Ketua Technical)
  'PTV-010': {
    id: '00000000-0000-0000-0000-000000000003',
    ptv_id: 'PTV-010',
    full_name: 'Farid Technical',
    username: 'kepolo',
    organization: 'PTV Studio',
    division: 'Technical',
    position: 'Ketua Technical',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['kepolo_kepali'],
    allowed_overrides: [],
    denied_overrides: [],
  },

  // 4. Standard Active Crew
  'PTV-025': {
    id: '00000000-0000-0000-0000-000000000004',
    ptv_id: 'PTV-025',
    full_name: 'Zidna Santri',
    username: 'crew',
    organization: 'PTV Studio',
    division: 'Technical',
    position: 'Crew Operator',
    angkatan: 2024,
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['crew'],
    allowed_overrides: [],
    denied_overrides: [],
  },

  // 5. Crew with finance.operator override (Replaces legacy PTV-023 exception)
  'PTV-023': {
    id: '00000000-0000-0000-0000-000000000005',
    ptv_id: 'PTV-023',
    full_name: 'Farsya Crew Finance',
    username: 'farsya',
    organization: 'PTV Studio',
    division: 'Technical',
    position: 'Crew Operator & Kasir',
    angkatan: 2023,
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['crew'],
    allowed_overrides: ['finance.operator'],
    denied_overrides: [],
  },

  // 6. Pembina (Institutional Advisor)
  'PTV-PEMBINA': {
    id: '00000000-0000-0000-0000-000000000006',
    ptv_id: 'PTV-PEMBINA',
    full_name: 'Ustadz Pembina',
    username: 'pembina',
    organization: 'PTV Studio',
    division: 'Advisory',
    position: 'Pembina Studio',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['pembina'],
    allowed_overrides: [],
    denied_overrides: [],
  },

  // 7. Inactive Alumni (Read-only alumni access)
  'PTV-099': {
    id: '00000000-0000-0000-0000-000000000007',
    ptv_id: 'PTV-099',
    full_name: 'Alumni PTV',
    username: 'alumni',
    organization: 'PTV Studio',
    division: 'Editor',
    position: 'Alumni Anggota',
    angkatan: 2021,
    status_akun: 'active',
    status_organisasi: 'inactive',
    assigned_profiles: ['crew'],
    allowed_overrides: [],
    denied_overrides: [],
  },

  // 8. Suspended Account (Login blocked)
  'PTV-000': {
    id: '00000000-0000-0000-0000-000000000008',
    ptv_id: 'PTV-000',
    full_name: 'Suspended Account',
    username: 'suspended',
    organization: 'PTV Studio',
    division: 'General',
    position: 'Non-active Member',
    status_akun: 'inactive',
    status_organisasi: 'inactive',
    assigned_profiles: ['crew'],
    allowed_overrides: [],
    denied_overrides: [],
  },
};

/**
 * Local Development Mock Auth Adapter
 * Stores active session in memory or localStorage without making external network calls.
 */
export class LocalMockAuthService implements IAuthService {
  private currentSession: AuthSession | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();
  private storageKey = 'ptv_mock_auth_session';

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as AuthSession;
          if (parsed && parsed.expires_at > Date.now()) {
            this.currentSession = parsed;
          } else {
            window.localStorage.removeItem(this.storageKey);
          }
        }
      }
    } catch {
      this.currentSession = null;
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const rawId = credentials.identifier.trim();
    // Lookup by PTV ID or username
    const user =
      LOCAL_DEV_MOCK_USERS[rawId] ||
      Object.values(LOCAL_DEV_MOCK_USERS).find(
        (u) => u.username.toLowerCase() === rawId.toLowerCase() || u.ptv_id.toLowerCase() === rawId.toLowerCase()
      );

    if (!user) {
      return {
        success: false,
        error: `Akun "${rawId}" tidak ditemukan dalam direktori lokal.`,
      };
    }

    // Gate check on account status
    if (user.status_akun !== 'active') {
      return {
        success: false,
        error: 'Akun nonaktif. Silakan hubungi Eksekutif PTV untuk aktivasi.',
      };
    }

    const session: AuthSession = {
      access_token: `mock_jwt_${user.ptv_id}_${Date.now()}`,
      expires_at: Date.now() + 72 * 60 * 60 * 1000, // 72 hours
      user,
    };

    this.currentSession = session;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.storageKey, JSON.stringify(session));
    }

    this.notify();
    return { success: true, session };
  }

  async loginWithOAuth(_options: OAuthSignInOptions): Promise<AuthResult> {
    return {
      success: false,
      error: 'Google OAuth hanya tersedia pada backend Supabase yang terkonfigurasi (VITE_AUTH_BACKEND=supabase). Menolak simulasi login palsu.',
    };
  }

  async logout(): Promise<void> {
    this.currentSession = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(this.storageKey);
    }
    this.notify();
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    return this.currentSession;
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentSession);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }
}

// Singleton auth service instance for local environment
let authServiceInstance: IAuthService | null = null;

/**
 * Supabase GoTrue Auth Adapter
 * Connects institutional credentials to trusted Supabase JWT sessions.
 * Preserves the canonical identity contract without altering the LoginPage UI.
 */
export class SupabaseAuthService implements IAuthService {
  private currentSession: AuthSession | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();

  constructor() {
    this.initSession();
  }

  private async initSession(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (!error && data && data.session) {
        try {
          const session = await this.resolveDatabaseSession(data.session);
          this.currentSession = session;
        } catch {
          await supabase.auth.signOut();
          this.currentSession = null;
        }
        this.notify();
      }
    } catch {
      this.currentSession = null;
    }
  }

  /**
   * Resolusi identitas sesi murni dari database PostgreSQL.
   * Alur resmi: Supabase Auth user.id -> user_account.auth_user_id -> canonical_identity & account_profiles.
   * Menggunakan RPC arsitektur public.jwt_custom_claims() (SECURITY DEFINER).
   * DILARANG memperoleh role dari UID whitelist, data mock, atau metadata yang dapat diubah klien.
   */
  async resolveDatabaseSession(session: any): Promise<AuthSession> {
    const rawUser = session?.user;
    if (!rawUser || !rawUser.id) {
      throw new Error('Sesi autentikasi Supabase tidak valid: ID pengguna tidak ditemukan.');
    }

    const supabase = getSupabaseClient();

    // 1. Eksekusi RPC resolver identitas sesi resmi (SECURITY DEFINER)
    // Menjalankan pengecekan auth.uid() pada ua.auth_user_id
    const { data: claims, error: rpcError } = await supabase.rpc('jwt_custom_claims');

    if (rpcError) {
      throw new Error(
        `Akses Ditolak Database: Gagal memuat profil identitas via RPC (${rpcError.message || rpcError.code}).`
      );
    }

    // 2. Fail-Closed: Akun Supabase Auth WAJIB tertaut ke entitas user_account resmi di database
    if (!claims || typeof claims !== 'object' || Object.keys(claims).length === 0 || !claims.account_id) {
      throw new Error(
        `Akun Supabase (${rawUser.email || rawUser.id}) belum tertaut ke entitas user_account resmi di database. ` +
        'Hubungi Administrator PTV untuk menautkan akun ke identitas kanonikal.'
      );
    }

    // 3. Status Akun Guard: Menolak akun nonaktif atau disuspend
    if (claims.status_akun !== 'active') {
      throw new Error(
        `Akun nonaktif atau berstatus "${claims.status_akun || 'inactive'}". Operasi PTV Hub membutuhkan akun berstatus "active".`
      );
    }

    // 4. Resolusi Profil Murni Database (Fail-closed: dilarang memberi role default berhak tinggi)
    const assignedProfiles: AccessProfile[] = Array.isArray(claims.profiles)
      ? (claims.profiles as AccessProfile[])
      : [];

    const allowedOverrides: AppCapability[] = Array.isArray(claims.allowed_overrides)
      ? (claims.allowed_overrides as AppCapability[])
      : [];

    const deniedOverrides: AppCapability[] = Array.isArray(claims.denied_overrides)
      ? (claims.denied_overrides as AppCapability[])
      : [];

    const user: AuthUser = {
      id: rawUser.id,
      ptv_id: claims.ptv_id || 'PTV-GUEST',
      full_name: claims.full_name || claims.username || rawUser.email?.split('@')[0] || 'Kru PTV',
      username: claims.username || rawUser.email?.split('@')[0] || 'user',
      avatar_url: claims.avatar_url,
      organization: 'PTV Studio',
      division: claims.division || '',
      position: claims.position || '',
      angkatan: claims.angkatan,
      status_akun: claims.status_akun as AccountStatus,
      status_organisasi: (claims.status_organisasi || 'active') as OrganizationStatus,
      assigned_profiles: assignedProfiles,
      allowed_overrides: allowedOverrides,
      denied_overrides: deniedOverrides,
    };

    return {
      access_token: session.access_token,
      expires_at: (session.expires_at || 0) * 1000,
      user,
    };
  }

  async loginWithOAuth(options: OAuthSignInOptions): Promise<AuthResult> {
    const supabase = getSupabaseClient();
    const redirectTo =
      options.redirectTo ||
      `${typeof window !== 'undefined' ? window.location.origin : ''}/hub/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: options.provider,
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: `Supabase OAuth Error: ${error.message}`,
      };
    }

    return { success: true };
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const rawId = credentials.identifier.trim();
    const supabase = getSupabaseClient();

    // Resolusi email: jika bukan email lengkap, gunakan konvensi username institusional
    let email = rawId;
    if (!email.includes('@')) {
      const uname = rawId.toLowerCase().replace(/[^a-z0-9._-]/g, '');
      email = `${uname}@ptvpro.internal`;
    }

    const password = credentials.password || '';

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return {
        success: false,
        error: error ? `Supabase Auth: ${error.message}` : 'Gagal memperoleh sesi terautentikasi dari Supabase.',
      };
    }

    try {
      const session = await this.resolveDatabaseSession(data.session);
      this.currentSession = session;
      this.notify();
      return { success: true, session };
    } catch (resolveErr: any) {
      await supabase.auth.signOut();
      this.currentSession = null;
      this.notify();
      return {
        success: false,
        error: resolveErr?.message || 'Gagal memverifikasi identitas operasional dari database.',
      };
    }
  }

  async logout(): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    this.currentSession = null;
    this.notify();
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    return this.currentSession;
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentSession);

    const supabase = getSupabaseClient();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try {
          const mapped = await this.resolveDatabaseSession(session);
          this.currentSession = mapped;
        } catch {
          await supabase.auth.signOut();
          this.currentSession = null;
        }
      } else {
        this.currentSession = null;
      }
      this.notify();
    });

    return () => {
      this.listeners.delete(callback);
      authListener.subscription.unsubscribe();
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }
}

/**
 * Vercel Serverless Native Website Auth Adapter
 * Connects directly to Vercel Serverless Functions (/api/auth/*) with HttpOnly cookies.
 * Operates without Supabase Auth (GoTrue).
 */
export class VercelAuthService implements IAuthService {
  private currentSession: AuthSession | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<AuthSession | null> | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshPending: Promise<void> | null = null;
  private revision = 0;
  private readonly refreshOnFocus = () => { void this.refreshSession(); };

  async refreshSession(): Promise<void> {
    if (this.refreshPending) return this.refreshPending;
    const revision = this.revision;
    this.refreshPending = (async () => {
      const session = await this.fetchServerSession();
      if (revision !== this.revision) return;
      this.currentSession = session;
      this.notify();
    })().finally(() => { this.refreshPending = null; });
    return this.refreshPending;
  }

  constructor() {
    this.initPromise = this.initSession();
  }

  private async initSession(): Promise<AuthSession | null> {
    const revision = this.revision;
    try {
      const session = await this.fetchServerSession();
      if (revision !== this.revision) return this.currentSession;
      this.currentSession = session;
      return session;
    } catch {
      if (revision === this.revision) this.currentSession = null;
      return null;
    } finally {
      this.isInitialized = true;
      this.notify();
    }
  }

  private async fetchServerSession(): Promise<AuthSession | null> {
    try {
      if (typeof fetch === 'undefined') return null;
      const resp = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data && data.authenticated && data.user) {
        const user = normalizeAuthUser(data.user);
        if (user?.status_akun === 'active') {
          return {
            access_token: 'vercel-session-cookie',
            expires_at: data.expires_at || Date.now() + 30_000,
            user,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async loginWithOAuth(options: OAuthSignInOptions): Promise<AuthResult> {
    const returnTo = options.redirectTo || '/hub';
    if (typeof window !== 'undefined') {
      window.location.href = `/api/auth/google/login?returnTo=${encodeURIComponent(returnTo)}`;
    }
    return { success: true };
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      if (typeof fetch !== 'undefined') {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            identifier: credentials.identifier,
            password: credentials.password,
          }),
        });

        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success && data.user) {
          const user = normalizeAuthUser(data.user);
          if (!user || user.status_akun !== 'active') {
            return {
              success: false,
              error: 'Data sesi dari server tidak valid.',
            };
          }
          this.revision++;
          this.currentSession = {
            access_token: 'vercel-session-cookie',
            expires_at: data.expires_at || Date.now() + 30_000,
            user,
          };
          this.notify();
          return { success: true, session: this.currentSession };
        }

        return {
          success: false,
          error: data.error || 'Kredensial login tidak valid.',
        };
      }
    } catch {
      return { success: false, error: 'Layanan login belum dapat dihubungi. Coba lagi.' };
    }

    return {
      success: false,
      error: 'Layanan login belum dapat dihubungi. Coba lagi.',
    };
  }

  async logout(): Promise<void> {
    if (typeof fetch === 'undefined') throw new Error('Logout belum berhasil. Coba lagi.');
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Logout belum berhasil. Coba lagi.');
    this.revision++;
    this.currentSession = null;
    this.notify();
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise;
    }
    return this.currentSession;
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.add(callback);
    if (!this.refreshTimer) {
      this.refreshTimer = setInterval(() => { void this.refreshSession(); }, 30_000);
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('focus', this.refreshOnFocus);
    }
    if (this.isInitialized) {
      callback(this.currentSession);
    }
    return () => {
      this.listeners.delete(callback);
      if (!this.listeners.size && this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('focus', this.refreshOnFocus);
      }
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }
}

export function getAuthService(): IAuthService {
  if (!authServiceInstance) {
    const authBackend = import.meta.env.VITE_AUTH_BACKEND;
    if (authBackend === 'vercel' || authBackend === 'native') {
      authServiceInstance = new VercelAuthService();
    } else if (authBackend === 'supabase') {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Konfigurasi Auth Error: Mode autentikasi "supabase" dipilih (VITE_AUTH_BACKEND=supabase), ' +
          'tetapi VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum dikonfigurasi dengan benar di environment. ' +
          'Sistem menolak beralih diam-diam ke mock.'
        );
      }
      authServiceInstance = new SupabaseAuthService();
    } else if (import.meta.env.DEV && import.meta.env.MODE !== 'staging' && (!authBackend || authBackend === 'mock')) {
      authServiceInstance = new LocalMockAuthService();
    } else {
      throw new Error('Backend autentikasi belum dikonfigurasi. Akses ditutup; mock hanya tersedia untuk development lokal.');
    }
  }
  return authServiceInstance;
}

export function setAuthServiceForTesting(service: IAuthService | null): void {
  authServiceInstance = service;
}
