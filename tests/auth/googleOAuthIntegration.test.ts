import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalMockAuthService, SupabaseAuthService } from '../../src/core/auth/authService';
import {
  getSafeInternalDestination,
  storeIntendedDestination,
  getAndClearIntendedDestination,
  clearIntendedDestination,
} from '../../src/core/auth/destination';
import * as supabaseModule from '../../src/core/supabase';
import { useSessionStore } from '../../src/core/session';

describe('Google OAuth Integration & Secure Account Linking Tests', () => {
  const KRU_AUTH_UID = '11111111-2222-3333-4444-555555555555';
  let mockClient: any;
  let signInWithOAuthMock: any;
  let signOutMock: any;
  let rpcMock: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    signInWithOAuthMock = vi.fn();
    signOutMock = vi.fn().mockResolvedValue({ error: null });
    rpcMock = vi.fn();

    mockClient = {
      auth: {
        signInWithOAuth: signInWithOAuthMock,
        signOut: signOutMock,
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        exchangeCodeForSession: vi.fn(),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      rpc: rpcMock,
    };

    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue(mockClient as any);
    useSessionStore.setState({ session: null, user: null, isLoading: false, error: null });
    clearIntendedDestination();
  });

  describe('1. Clean Login Destination & Redirect Loop Protection', () => {
    it('mengizinkan rute internal /hub yang sah', () => {
      expect(getSafeInternalDestination('/hub/beranda')).toBe('/hub/beranda');
      expect(getSafeInternalDestination('/hub/inventaris?tab=katalog&p=1')).toBe('/hub/inventaris?tab=katalog&p=1');
      expect(getSafeInternalDestination('/hub/broadcast')).toBe('/hub/broadcast');
    });

    it('mengizinkan rute development catalog internal', () => {
      expect(getSafeInternalDestination('/dev-catalog')).toBe('/dev-catalog');
      expect(getSafeInternalDestination('/dev-broadcast')).toBe('/dev-broadcast');
    });

    it('menolak open-redirect ke domain eksternal', () => {
      expect(getSafeInternalDestination('https://malicious-site.com')).toBe('/hub');
      expect(getSafeInternalDestination('http://phishing.com/login')).toBe('/hub');
      expect(getSafeInternalDestination('//evil.com/hack')).toBe('/hub');
      expect(getSafeInternalDestination('/\\evil.com/hack')).toBe('/hub');
      expect(getSafeInternalDestination('javascript:alert(1)')).toBe('/hub');
    });

    it('mencegah infinite redirect loop pada halaman login dan auth callback', () => {
      expect(getSafeInternalDestination('/hub/login')).toBe('/hub');
      expect(getSafeInternalDestination('/hub/login?redirect=%2Fhub')).toBe('/hub');
      expect(getSafeInternalDestination('/login')).toBe('/hub');
      expect(getSafeInternalDestination('/login?test=1')).toBe('/hub');
      expect(getSafeInternalDestination('/hub/auth/callback')).toBe('/hub');
      expect(getSafeInternalDestination('/hub/auth/callback?code=mock_code')).toBe('/hub');
      expect(getSafeInternalDestination('/auth/callback')).toBe('/hub');
    });

    it('fallback ke /hub jika input null, undefined, kosong, atau invalid', () => {
      expect(getSafeInternalDestination(null)).toBe('/hub');
      expect(getSafeInternalDestination(undefined)).toBe('/hub');
      expect(getSafeInternalDestination('')).toBe('/hub');
      expect(getSafeInternalDestination('   ')).toBe('/hub');
      expect(getSafeInternalDestination('invalid-route-without-slash')).toBe('/hub');
    });

    it('menyimpan dan mengambil destination secara session-scoped dengan bersih', () => {
      storeIntendedDestination('/hub/keuangan');
      const retrieved = getAndClearIntendedDestination();
      expect(retrieved).toBe('/hub/keuangan');

      // Setelah diambil, storage harus bersih dan mengembalikan fallback
      const secondCheck = getAndClearIntendedDestination();
      expect(secondCheck).toBe('/hub');
    });
  });

  describe('2. OAuth Initiation & Backend Boundary', () => {
    it('LocalMockAuthService menolak simulasi Google OAuth (fail-closed, no fake success)', async () => {
      const mockService = new LocalMockAuthService();
      const result = await mockService.loginWithOAuth({ provider: 'google' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Google OAuth hanya tersedia pada backend Supabase yang terkonfigurasi');
    });

    it('SupabaseAuthService memanggil signInWithOAuth dengan parameter resmi dan redirect URL tepat', async () => {
      signInWithOAuthMock.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2' }, error: null });

      const supabaseService = new SupabaseAuthService();
      const result = await supabaseService.loginWithOAuth({
        provider: 'google',
        redirectTo: 'http://localhost:5174/hub/auth/callback',
      });

      expect(result.success).toBe(true);
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:5174/hub/auth/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
    });

    it('SupabaseAuthService mengembalikan error jika inisiasi provider Google gagal', async () => {
      signInWithOAuthMock.mockResolvedValue({
        data: null,
        error: new Error('Provider Google is not enabled in Supabase project'),
      });

      const supabaseService = new SupabaseAuthService();
      const result = await supabaseService.loginWithOAuth({
        provider: 'google',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider Google is not enabled in Supabase project');
    });
  });

  describe('3. Account Linking & Database RBAC Validation', () => {
    it('mengizinkan login jika akun Google tertaut ke user_account aktif dan memiliki hub.access', async () => {
      rpcMock.mockImplementation((rpcName: string) => {
        if (rpcName === 'jwt_custom_claims') {
          return Promise.resolve({
            data: {
              account_id: 'acc-kru-uuid-001',
              identity_id: 'ident-kru-uuid-001',
              ptv_id: 'PTV-025',
              username: 'zidna_crew',
              full_name: 'Zidna Santri',
              status_akun: 'active',
              status_organisasi: 'active',
              profiles: ['crew'],
              allowed_overrides: [],
              denied_overrides: [],
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
      });

      const supabaseService = new SupabaseAuthService();
      const mockSession = {
        access_token: 'valid-google-jwt',
        expires_at: 1729000000,
        user: {
          id: KRU_AUTH_UID,
          email: 'zidna@progresiftv.id',
        },
      };

      const resolved = await supabaseService.resolveDatabaseSession(mockSession);
      expect(resolved.user.ptv_id).toBe('PTV-025');
      expect(resolved.user.status_akun).toBe('active');
      expect(resolved.user.assigned_profiles).toEqual(['crew']);
    });

    it('menolak akun Google yang belum tertaut ke user_account di database (Fail-Closed)', async () => {
      // RPC mengembalikan claims kosong karena ua.auth_user_id = auth.uid() NOT FOUND
      rpcMock.mockResolvedValue({
        data: {},
        error: null,
      });

      const supabaseService = new SupabaseAuthService();
      const unlinkedSession = {
        access_token: 'google-jwt-unlinked',
        expires_at: 1729000000,
        user: {
          id: 'unlinked-google-uid-999',
          email: 'stranger@gmail.com',
        },
      };

      await expect(supabaseService.resolveDatabaseSession(unlinkedSession)).rejects.toThrow(
        /belum tertaut ke entitas user_account resmi di database/i
      );
    });

    it('menolak akun Google yang tertaut tetapi status akun nonaktif (status_akun != active)', async () => {
      rpcMock.mockResolvedValue({
        data: {
          account_id: 'acc-kru-uuid-suspended',
          identity_id: 'ident-kru-uuid-suspended',
          ptv_id: 'PTV-099',
          username: 'suspended_crew',
          status_akun: 'inactive',
          status_organisasi: 'active',
          profiles: ['crew'],
        },
        error: null,
      });

      const supabaseService = new SupabaseAuthService();
      const suspendedSession = {
        access_token: 'google-jwt-suspended',
        expires_at: 1729000000,
        user: {
          id: KRU_AUTH_UID,
          email: 'suspended@progresiftv.id',
        },
      };

      await expect(supabaseService.resolveDatabaseSession(suspendedSession)).rejects.toThrow(
        /Akun nonaktif atau berstatus "inactive"/i
      );
    });

    it('memastikan akun tanpa hak hub.access terdeteksi untuk ditolak pada callback guard', async () => {
      rpcMock.mockResolvedValue({
        data: {
          account_id: 'acc-guest-uuid',
          identity_id: 'ident-guest-uuid',
          ptv_id: 'PTV-GUEST',
          username: 'guest_user',
          status_akun: 'active',
          status_organisasi: 'active',
          profiles: [], // Tidak memiliki profil yang meng-grant hub.access
          allowed_overrides: [],
          denied_overrides: ['hub.access'], // Eksplisit denied
        },
        error: null,
      });

      const supabaseService = new SupabaseAuthService();
      const noAccessSession = {
        access_token: 'google-jwt-no-access',
        expires_at: 1729000000,
        user: {
          id: KRU_AUTH_UID,
          email: 'noaccess@progresiftv.id',
        },
      };

      const resolved = await supabaseService.resolveDatabaseSession(noAccessSession);
      const { hasCapability } = await import('../../src/core/policy');
      expect(hasCapability(resolved.user, 'hub.access')).toBe(false);
    });
  });
});
