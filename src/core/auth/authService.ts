/**
 * Core Authentication Service Boundary
 * Provides an interface abstraction supporting both local development mocks
 * and Supabase Auth integration without hardcoding production secrets.
 */

import { AuthResult, AuthSession, AuthUser, LoginCredentials } from './types';

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<AuthResult>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
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

export function getAuthService(): IAuthService {
  if (!authServiceInstance) {
    // Default to local mock auth service for Phase 2 scaffold
    authServiceInstance = new LocalMockAuthService();
  }
  return authServiceInstance;
}
