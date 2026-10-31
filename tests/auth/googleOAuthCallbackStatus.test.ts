import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveIdentityByGoogleSub } from '../../api/_routes/auth/_utils/identity';
import callbackHandler from '../../api/_routes/auth/google/callback';
import { createHmacState } from '../../api/_routes/auth/_utils/crypto';
import type { ApiRequest, ApiResponse } from '../../api/_routes/auth/_utils/types';

// Supabase Mock State
let tableHandlers: Record<string, () => any> = {};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      const handler = tableHandlers[table];
      if (handler) return handler();
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  })),
}));

describe('Google OAuth Callback & Live Identity Resolution Status Diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    tableHandlers = {};
  });

  describe('1. resolveIdentityByGoogleSub with Live Database Credentials', () => {
    it('mengembalikan code: "unlinked" saat akun Google belum ditautkan di database', async () => {
      tableHandlers['auth_credentials'] = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      });

      const result = await resolveIdentityByGoogleSub('google-unlinked-sub-999', 'operator@gmail.com');

      expect(result.success).toBe(false);
      expect(result.code).toBe('unlinked');
      expect(result.error).toContain('belum ditautkan ke akun kru resmi PTVPRO di database');
    });

    it('mengembalikan code: "access_denied" saat akun ditautkan tetapi status_akun != active', async () => {
      tableHandlers['auth_credentials'] = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    account_id: 'acc-inactive',
                    oauth_provider: 'google',
                    oauth_subject_id: 'google-sub-inactive',
                    user_account: {
                      id: 'acc-inactive',
                      identity_id: 'ident-inactive',
                      username: 'kru_nonaktif',
                      status_akun: 'inactive',
                      canonical_identity: {
                        id: 'ident-inactive',
                        ptv_id: 'PTV-088',
                        full_name: 'Kru Nonaktif',
                      },
                    },
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const result = await resolveIdentityByGoogleSub('google-sub-inactive');

      expect(result.success).toBe(false);
      expect(result.code).toBe('access_denied');
      expect(result.error).toContain('sedang berstatus "inactive"');
    });

    it('mengembalikan code: "access_denied" saat akun aktif tetapi tidak memiliki hub.access', async () => {
      tableHandlers['auth_credentials'] = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    account_id: 'acc-no-access',
                    oauth_provider: 'google',
                    oauth_subject_id: 'google-sub-no-access',
                    user_account: {
                      id: 'acc-no-access',
                      identity_id: 'ident-no-access',
                      username: 'tamu',
                      status_akun: 'active',
                      canonical_identity: {
                        id: 'ident-no-access',
                        ptv_id: 'PTV-GUEST',
                        full_name: 'Tamu Luar',
                      },
                    },
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      tableHandlers['account_profiles'] = () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      });

      tableHandlers['account_capability_overrides'] = () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      });

      const result = await resolveIdentityByGoogleSub('google-sub-no-access');

      expect(result.success).toBe(false);
      expect(result.code).toBe('access_denied');
      expect(result.error).toContain('tidak memiliki izin akses PTV Hub');
    });

    it('mengembalikan code: "server_error" saat terjadi error koneksi ke tabel auth_credentials', async () => {
      tableHandlers['auth_credentials'] = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'connection timeout', code: '57P01' },
                }),
            }),
          }),
        }),
      });

      const result = await resolveIdentityByGoogleSub('google-sub-err');

      expect(result.success).toBe(false);
      expect(result.code).toBe('server_error');
      expect(result.error).toContain('Database Auth Error');
    });
  });

  describe('2. Google OAuth Callback Handler HTTP Status & Query Mapping', () => {
    const authSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

    function createMockRes() {
      const headers: Record<string, string> = {};
      return {
        statusCode: 200,
        headers,
        setHeader(name: string, value: string) {
          headers[name.toLowerCase()] = value;
        },
        getHeader(name: string) {
          return headers[name.toLowerCase()];
        },
        end: vi.fn(),
      } as unknown as ApiResponse;
    }

    it('me-redirect dengan auth_status=unlinked & dev_sub saat akun Google belum tertaut', async () => {
      // Explicit offline harness: a development flag must never bypass OAuth on a live backend.
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const stateObj = { returnTo: '/hub', timestamp: Date.now(), nonce: 'test-nonce' };
      const stateToken = createHmacState(stateObj, authSecret);

      const req = {
        method: 'GET',
        url: `/api/auth/google/callback?code=mock-auth-code&state=${stateToken}&mock_sub=unlinked-google-sub-777`,
        headers: {
          host: 'localhost:5174',
          cookie: `ptv_oauth_state=${stateToken}:test-pkce-verifier`,
        },
      } as unknown as ApiRequest;

      const res = createMockRes();

      // Database returns unlinked
      tableHandlers['auth_credentials'] = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      });

      process.env.ENABLE_DEV_MOCK_AUTH = 'true';
      await callbackHandler(req, res);

      expect(res.statusCode).toBe(302);
      const location = (res as any).headers['location'];
      expect(location).toContain('auth_status=unlinked');
      expect(location).toContain('dev_sub=unlinked-google-sub-777');
      expect(location).not.toContain('auth_status=error');
    });

    it('me-redirect dengan auth_status=cancelled saat pengguna membatalkan di Google consent', async () => {
      const req = {
        method: 'GET',
        url: '/api/auth/google/callback?error=access_denied',
        headers: { host: 'localhost:5174' },
      } as unknown as ApiRequest;

      const res = createMockRes();
      await callbackHandler(req, res);

      expect(res.statusCode).toBe(302);
      const location = (res as any).headers['location'];
      expect(location).toContain('auth_status=cancelled');
    });

    it('me-redirect dengan auth_status=state_error saat cookie state tidak ditemukan', async () => {
      const stateObj = { returnTo: '/hub', timestamp: Date.now(), nonce: 'test-nonce' };
      const stateToken = createHmacState(stateObj, authSecret);

      const req = {
        method: 'GET',
        url: `/api/auth/google/callback?code=mock-auth-code&state=${stateToken}`,
        headers: {
          host: 'localhost:5174',
          // cookie absent
        },
      } as unknown as ApiRequest;

      const res = createMockRes();
      await callbackHandler(req, res);

      expect(res.statusCode).toBe(302);
      const location = (res as any).headers['location'];
      expect(location).toContain('auth_status=state_error');
    });
  });
});
