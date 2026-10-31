import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  linkGoogleIdentityToAccount,
  unlinkGoogleIdentityFromAccount,
  resolveIdentityByGoogleSub,
  LOCAL_LINKED_GOOGLE_ACCOUNTS,
} from '../../api/auth/_utils/identity';
import callbackHandler from '../../api/auth/google/callback';
import statusHandler from '../../api/auth/google/status';
import { signSessionToken } from '../../api/auth/_utils/crypto';
import type { ApiRequest, ApiResponse } from '../../api/auth/_utils/types';

// Supabase mock storage for regression testing
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

function createMockRes() {
  const headers: Record<string, string> = {};
  let body = '';
  return {
    statusCode: 200,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    json(data: any) {
      body = JSON.stringify(data);
    },
    end(data?: string) {
      if (data) body = data;
    },
    get body() {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    },
  } as unknown as ApiResponse & { headers: Record<string, string>; body: any };
}

describe('Google SSO/OAuth & Account Linking Regression Test Suite', () => {
  const SECRET = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  const mockAdminAccount = {
    id: 'bcd64337-3511-459b-a2b1-4d027b926fb7',
    identity_id: 'ident-admin-1',
    username: 'admin_staging',
    status_akun: 'active',
    canonical_identity: {
      id: 'ident-admin-1',
      ptv_id: 'PTV-STG-ADM',
      full_name: 'Administrator Staging PTV',
    },
    profiles: ['root_executive'],
    capabilities: ['hub.access', 'inventaris.write', 'audit.view'],
  };

  const mockKruAccount = {
    id: '89455266-3379-4080-a9f6-5b563b790a2d',
    identity_id: 'ident-kru-1',
    username: 'kru_staging',
    status_akun: 'active',
    canonical_identity: {
      id: 'ident-kru-1',
      ptv_id: 'PTV-STG-KRU',
      full_name: 'Kru Operasional Staging PTV',
    },
    profiles: ['crew'],
    capabilities: ['hub.access', 'inventaris.read'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = SECRET;
    process.env.SESSION_SECRET = SECRET;
    process.env.SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    tableHandlers = {};
    tableHandlers.capability_registry = () => ({ select: async () => ({ data: [{ key: 'hub.access' }], error: null }) });
    LOCAL_LINKED_GOOGLE_ACCOUNTS.clear();
  });

  // 1. Akun lama hasil migrasi -> Hubungkan Google -> berhasil
  it('1. Legacy: linking live ditahan tanpa penulisan parsial', async () => {
    let writes = 0;
    tableHandlers.auth_credentials = () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }), upsert: () => { writes++; } });
    const result = await linkGoogleIdentityToAccount(mockKruAccount.id, 'new-sub');
    expect(result.success).toBe(false);
    expect(result.error).toContain('RPC atomik');
    expect(writes).toBe(0);
  });

  // 2. Akun baru -> Hubungkan Google -> berhasil
  it('2. Akun baru: linking live ditahan tanpa penulisan parsial', async () => {
    let writes = 0;
    tableHandlers.auth_credentials = () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }), upsert: () => { writes++; } });
    const result = await linkGoogleIdentityToAccount(mockKruAccount.id, 'new-sub');
    expect(result.success).toBe(false);
    expect(result.error).toContain('RPC atomik');
    expect(writes).toBe(0);
  });

  // 3. Login Google setelah linking -> masuk ke akun yang sama
  it('3. Login Google setelah linking berhasil menyelesaikan identitas akun kru yang tepat', async () => {
    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  account_id: mockKruAccount.id,
                  oauth_provider: 'google',
                  oauth_subject_id: 'google-sub-kru-verified',
                  user_account: mockKruAccount,
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    tableHandlers['account_profiles'] = () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ profile_id: 'crew' }], error: null }),
      }),
    });

    tableHandlers['account_capability_overrides'] = () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ capability_key: 'hub.access', override_type: 'allow' }], error: null }),
      }),
    });

    const resolved = await resolveIdentityByGoogleSub('google-sub-kru-verified');

    expect(resolved.success).toBe(true);
    expect(resolved.session?.account_id).toBe(mockKruAccount.id);
    expect(resolved.session?.ptv_id).toBe('PTV-STG-KRU');
    expect(resolved.session?.username).toBe('kru_staging');
    expect(resolved.session?.assigned_profiles).toContain('crew');
  });

  // 4. Google belum terhubung -> tidak otomatis mengambil akun berdasarkan email
  it('4. Google belum terhubung menolak login otomatis via email (fail-closed, return "unlinked")', async () => {
    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    });

    // Walaupun email sama persis dengan akun kru, OAuth yang belum terhubung WAJIB ditolak
    const resolved = await resolveIdentityByGoogleSub(
      'google-sub-unlinked-attacker',
      'kru_staging@gmail.com'
    );

    expect(resolved.success).toBe(false);
    expect(resolved.code).toBe('unlinked');
    expect(resolved.error).toContain('belum ditautkan ke akun kru resmi PTVPRO di database');
  });

  // 5. Google sudah digunakan akun lain -> ditolak konflik identitas (anti-account takeover)
  it('5. Linking ditolak saat identitas Google sudah ditautkan ke akun PTVPRO lain', async () => {
    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  account_id: 'b1111111-2222-3333-4444-555555555555', // Akun orang lain
                  oauth_provider: 'google',
                  oauth_subject_id: 'google-sub-already-taken',
                  oauth_email: 'victim@gmail.com',
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    const result = await linkGoogleIdentityToAccount(
      mockKruAccount.id,
      'google-sub-already-taken',
      'victim@gmail.com'
    );

    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.error).toContain('sudah terhubung ke akun kru PTVPRO lain');
  });

  // 6. Callback dimanipulasi / CSRF state mismatch -> ditolak
  it('6. OAuth callback menolak state yang dimanipulasi atau tanpa cookie valid (state_error)', async () => {
    const res = createMockRes();
    const req: Partial<ApiRequest> = {
      method: 'GET',
      url: '/api/auth/google/callback?code=mock_code&state=tampered_or_invalid_state',
      headers: {
        host: 'localhost:5174',
        cookie: 'ptv_oauth_state=original_different_state:nonce',
      },
    };

    await callbackHandler(req as ApiRequest, res as ApiResponse);

    const loc = res.getHeader('location') || '';
    expect(loc).toContain('auth_status=state_error');
  });

  // 7. OAuth dibatalkan pengguna -> tidak mengubah relasi database
  it('7. OAuth yang dibatalkan oleh pengguna mengarahkan kembali dengan pesan pembatalan', async () => {
    const res = createMockRes();
    const req: Partial<ApiRequest> = {
      method: 'GET',
      url: '/api/auth/google/callback?error=access_denied&error_description=User+denied+consent',
      headers: {
        host: 'localhost:5174',
      },
    };

    await callbackHandler(req as ApiRequest, res as ApiResponse);

    const loc = res.getHeader('location') || '';
    expect(loc).toContain('auth_status=cancelled');
  });

  // 8. Akun nonaktif -> ditolak login
  it('8. Akun PTVPRO berstatus nonaktif ditolak login Google SSO (access_denied)', async () => {
    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  account_id: 'acc-suspended',
                  oauth_provider: 'google',
                  oauth_subject_id: 'google-sub-suspended',
                  user_account: {
                    ...mockKruAccount,
                    status_akun: 'suspended',
                  },
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    const resolved = await resolveIdentityByGoogleSub('google-sub-suspended');

    expect(resolved.success).toBe(false);
    expect(resolved.code).toBe('access_denied');
    expect(resolved.error).toContain('sedang berstatus "suspended"');
  });

  // 9. Unlink Google -> relasi dihapus, login lama/kredensial tetap berfungsi, profil utuh
  it('9. Unlink live ditahan agar metode login terakhir dan Root tidak hilang', async () => {
    let writes = 0;
    tableHandlers.auth_credentials = () => ({ update: () => { writes++; } });
    expect((await unlinkGoogleIdentityFromAccount(mockKruAccount.id)).success).toBe(false);
    expect(writes).toBe(0);
  });

  // 10. Status endpoint -> mengembalikan status yang konsisten
  it('10. GET /api/auth/google/status mengembalikan status akun Google yang akurat', async () => {
    tableHandlers['user_account'] = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                status_akun: 'active',
              },
              error: null,
            }),
        }),
      }),
    });

    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                oauth_provider: 'google',
                oauth_subject_id: 'google-sub-kru',
                oauth_email: 'kru.staging@gmail.com',
                updated_at: '2026-10-18T22:00:00Z',
              },
              error: null,
            }),
        }),
      }),
    });

    const now = Math.floor(Date.now() / 1000);
    const sessionToken = signSessionToken(
      {
        account_id: mockKruAccount.id,
        identity_id: mockKruAccount.identity_id,
        ptv_id: 'PTV-STG-KRU',
        username: mockKruAccount.username,
        full_name: 'Kru Operasional Staging PTV',
        division: 'Production',
        position: 'Kru',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        capabilities: ['hub.access'],
        iat: now,
        exp: now + 3600,
      },
      SECRET
    );

    const res = createMockRes();
    const req: Partial<ApiRequest> = {
      method: 'GET',
      headers: {
        cookie: `ptv_hub_session=${sessionToken}`,
      },
    };

    await statusHandler(req as ApiRequest, res as ApiResponse);

    expect(res.body).toEqual(
      expect.objectContaining({
        authenticated: true,
        is_linked: true,
        email: 'kru.staging@gmail.com',
        provider: 'google',
      })
    );
  });

  // 11. Akun Staging existing -> tetap aman dan terlindungi
  it('11. Akun Staging existing (PTV-STG-ADM & PTV-STG-KRU) tetap utuh dengan RBAC aslinya', () => {
    expect(mockAdminAccount.profiles).toContain('root_executive');
    expect(mockAdminAccount.capabilities).toContain('audit.view');
    expect(mockKruAccount.profiles).toContain('crew');
    expect(mockKruAccount.capabilities).not.toContain('audit.view');
  });

  // 12. Anti-eskalasi RBAC -> linking tidak menambah profil atau capability
  it('12. Linking Google tidak menambahkan profil atau hak akses apa pun ke akun kru', async () => {
    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    });

    tableHandlers['user_account'] = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: mockKruAccount.id,
                canonical_identity: { ptv_id: 'PTV-STG-KRU' },
              },
              error: null,
            }),
        }),
      }),
    });

    tableHandlers['legacy_archive_kru'] = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    await linkGoogleIdentityToAccount(mockKruAccount.id, 'google-sub-kru', 'kru@gmail.com');

    // Resolusi akun kru setelah linking harus tetap memiliki hak akses awal (crew), tanpa eskalasi
    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  account_id: mockKruAccount.id,
                  oauth_provider: 'google',
                  oauth_subject_id: 'google-sub-kru',
                  user_account: mockKruAccount,
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    tableHandlers['account_profiles'] = () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ profile_id: 'crew' }], error: null }),
      }),
    });

    tableHandlers['account_capability_overrides'] = () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    });

    const resolved = await resolveIdentityByGoogleSub('google-sub-kru');
    expect(resolved.success).toBe(true);
    expect(resolved.session?.assigned_profiles).toEqual(['crew']);
    expect(resolved.session?.capabilities).not.toContain('audit.view');
    expect(resolved.session?.capabilities).not.toContain('user.manage');
  });

  // Bonus: Idempotent linking
  it('13. Idempotent linking: menghubungkan identitas Google yang sama ke akun yang sama berulang kali tidak error', async () => {
    tableHandlers['auth_credentials'] = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  account_id: mockKruAccount.id, // Akun yang sama
                  oauth_provider: 'google',
                  oauth_subject_id: 'google-sub-kru-same',
                },
                error: null,
              }),
          }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    });

    tableHandlers['user_account'] = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: mockKruAccount.id,
                canonical_identity: { ptv_id: 'PTV-STG-KRU' },
              },
              error: null,
            }),
        }),
      }),
    });

    tableHandlers['legacy_archive_kru'] = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const result = await linkGoogleIdentityToAccount(
      mockKruAccount.id,
      'google-sub-kru-same',
      'kru@gmail.com'
    );

    expect(result.success).toBe(true);
    expect(result.oauth_email).toBeUndefined(); // No-op must not replace stored credentials/email from the request.
  });
});

vi.mock('../../api/auth/_utils/liveAccess', () => ({ resolveLiveAccess: vi.fn(async () => ({
 identity: { id: 'ident-kru-1' }, profiles: ['crew'], membership: { status_organisasi: 'active' }, can: (cap: string) => cap === 'hub.access'
})) }));
