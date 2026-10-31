import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseAuthService } from '../../src/core/auth/authService';
import { hasCapability } from '../../src/core/policy';
import * as supabaseModule from '../../src/core/supabase';

describe('Supabase Pure Database RBAC Resolution Tests', () => {
  const ADMIN_UID = 'f7000a7f-36ae-4107-8516-ead83376aadd';
  const KRU_UID = '220e7a3a-aad9-4db1-9ec6-68dbd80caa2a';

  let mockClient: any;
  let signOutMock: any;
  let rpcMock: any;
  let signInWithPasswordMock: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    signOutMock = vi.fn().mockResolvedValue({ error: null });
    rpcMock = vi.fn();
    signInWithPasswordMock = vi.fn();

    mockClient = {
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signOut: signOutMock,
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      rpc: rpcMock,
    };

    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue(mockClient as any);
  });

  it('1. Admin account obtains inventory.create capability from database assignment', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-admin-token',
          expires_at: 1729000000,
          user: {
            id: ADMIN_UID,
            email: 'admin_staging@ptvpro.internal',
          },
        },
      },
      error: null,
    });

    rpcMock.mockImplementation((rpcName: string) => {
      if (rpcName === 'jwt_custom_claims') {
        return Promise.resolve({
          data: {
            account_id: 'acc-admin-uuid-001',
            identity_id: 'ident-admin-uuid-001',
            ptv_id: 'PTV-STG-ADM',
            username: 'admin_staging',
            full_name: 'Staging Admin Eksekutif',
            status_akun: 'active',
            status_organisasi: 'active',
            profiles: ['eksekutif'],
            allowed_overrides: [],
            denied_overrides: [],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
    });

    const authService = new SupabaseAuthService();
    const result = await authService.login({
      identifier: 'admin_staging',
      password: 'validpassword',
    });

    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
    expect(result.session!.user.id).toBe(ADMIN_UID);
    expect(result.session!.user.ptv_id).toBe('PTV-STG-ADM');
    expect(result.session!.user.assigned_profiles).toEqual(['eksekutif']);

    // Verifikasi capability inventory.create aktif untuk profil eksekutif
    const canCreate = hasCapability(result.session!.user, 'inventory.create');
    expect(canCreate).toBe(true);
  });

  it('2. Crew account does NOT obtain inventory.create capability from database assignment', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-kru-token',
          expires_at: 1729000000,
          user: {
            id: KRU_UID,
            email: 'kru_staging@ptvpro.internal',
          },
        },
      },
      error: null,
    });

    rpcMock.mockImplementation((rpcName: string) => {
      if (rpcName === 'jwt_custom_claims') {
        return Promise.resolve({
          data: {
            account_id: 'acc-kru-uuid-002',
            identity_id: 'ident-kru-uuid-002',
            ptv_id: 'PTV-STG-KRU',
            username: 'kru_staging',
            full_name: 'Staging Kru Lapangan',
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

    const authService = new SupabaseAuthService();
    const result = await authService.login({
      identifier: 'kru_staging',
      password: 'validpassword',
    });

    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
    expect(result.session!.user.id).toBe(KRU_UID);
    expect(result.session!.user.ptv_id).toBe('PTV-STG-KRU');
    expect(result.session!.user.assigned_profiles).toEqual(['crew']);

    // Verifikasi capability inventory.create TIDAK DIMILIKI oleh kru
    const canCreate = hasCapability(result.session!.user, 'inventory.create');
    expect(canCreate).toBe(false);
  });

  it('3. CRITICAL SECURITY GUARD: Admin UID does NOT automatically get capability if database assignment is missing', async () => {
    // Skenario penyerangan/regresi: Pengguna memiliki UID admin (f7000a7f...),
    // namun di tabel database account_profiles assignment-nya kosong (profiles: [])
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-without-assignment',
          expires_at: 1729000000,
          user: {
            id: ADMIN_UID,
            email: 'admin_staging@ptvpro.internal',
          },
        },
      },
      error: null,
    });

    rpcMock.mockImplementation((rpcName: string) => {
      if (rpcName === 'jwt_custom_claims') {
        return Promise.resolve({
          data: {
            account_id: 'acc-admin-uuid-001',
            identity_id: 'ident-admin-uuid-001',
            ptv_id: 'PTV-STG-ADM',
            username: 'admin_staging',
            status_akun: 'active',
            status_organisasi: 'active',
            profiles: [], // Profil assignment kosong di database!
            allowed_overrides: [],
            denied_overrides: [],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
    });

    const authService = new SupabaseAuthService();
    const result = await authService.login({
      identifier: 'admin_staging',
      password: 'validpassword',
    });

    expect(result.success).toBe(true);
    expect(result.session!.user.id).toBe(ADMIN_UID);
    // Tidak boleh otomatis fallback ke eksekutif atau role default berhak tinggi
    expect(result.session!.user.assigned_profiles).toEqual([]);

    // Capability inventory.create HARUS bernilai false!
    const canCreate = hasCapability(result.session!.user, 'inventory.create');
    expect(canCreate).toBe(false);
  });

  it('4. Fail-Closed Guard: Unlinked Supabase account is rejected with explicit error', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-auth-token',
          expires_at: 1729000000,
          user: {
            id: 'random-unlinked-uid-123',
            email: 'unlinked@example.com',
          },
        },
      },
      error: null,
    });

    // Database RPC mengembalikan objek kosong {} karena user_account tidak menemukan auth_user_id
    rpcMock.mockResolvedValue({
      data: {},
      error: null,
    });

    const authService = new SupabaseAuthService();
    const result = await authService.login({
      identifier: 'unlinked@example.com',
      password: 'password',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('belum tertaut ke entitas user_account resmi');
    expect(signOutMock).toHaveBeenCalled();
    expect(await authService.getCurrentSession()).toBeNull();
  });

  it('5. Fail-Closed Guard: Inactive / suspended account is rejected', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-auth-token',
          expires_at: 1729000000,
          user: {
            id: 'suspended-uid-999',
            email: 'suspended@ptvpro.internal',
          },
        },
      },
      error: null,
    });

    rpcMock.mockResolvedValue({
      data: {
        account_id: 'acc-suspended-999',
        ptv_id: 'PTV-000',
        username: 'suspended',
        status_akun: 'inactive',
        status_organisasi: 'inactive',
        profiles: ['crew'],
        allowed_overrides: [],
        denied_overrides: [],
      },
      error: null,
    });

    const authService = new SupabaseAuthService();
    const result = await authService.login({
      identifier: 'suspended',
      password: 'password',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Akun nonaktif atau berstatus "inactive"');
    expect(signOutMock).toHaveBeenCalled();
    expect(await authService.getCurrentSession()).toBeNull();
  });

  it('6. Consistency: Session restoration (initSession) uses identical database mapping mechanism', async () => {
    mockClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'restored-token',
          expires_at: 1729000000,
          user: {
            id: ADMIN_UID,
            email: 'admin_staging@ptvpro.internal',
          },
        },
      },
      error: null,
    });

    rpcMock.mockResolvedValue({
      data: {
        account_id: 'acc-admin-uuid-001',
        identity_id: 'ident-admin-uuid-001',
        ptv_id: 'PTV-STG-ADM',
        username: 'admin_staging',
        status_akun: 'active',
        status_organisasi: 'active',
        profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      },
      error: null,
    });

    const authService = new SupabaseAuthService();
    // Tunggu proses async initSession di constructor
    await new Promise((r) => setTimeout(r, 50));

    const session = await authService.getCurrentSession();
    expect(session).toBeDefined();
    expect(session!.user.id).toBe(ADMIN_UID);
    expect(session!.user.assigned_profiles).toEqual(['eksekutif']);
    expect(hasCapability(session!.user, 'inventory.create')).toBe(true);
  });

  it('7. ROOT CAUSE PROOF: Inactive organization status strictly blocks mutation capability (inventory.create) even for executive profile', async () => {
    // Skenario runtime staging saat ini:
    // Akun admin terdaftar dan memiliki profil 'eksekutif', tetapi di tabel organization_membership
    // belum ada baris aktif (status_organisasi: 'inactive').
    rpcMock.mockResolvedValue({
      data: {
        account_id: 'acc-admin-uuid-001',
        identity_id: 'ident-admin-uuid-001',
        ptv_id: 'PTV-STG-ADM',
        username: 'admin_staging',
        status_akun: 'active',
        status_organisasi: 'inactive', // Terjadi karena COALESCE(v_membership.status_organisasi, 'inactive')
        profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      },
      error: null,
    });

    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-admin-token',
          expires_at: 1729000000,
          user: { id: ADMIN_UID, email: 'admin_staging@ptvpro.internal' },
        },
      },
      error: null,
    });

    const authService = new SupabaseAuthService();
    const result = await authService.login({
      identifier: 'admin_staging',
      password: 'validpassword',
    });

    expect(result.success).toBe(true);
    expect(result.session!.user.status_organisasi).toBe('inactive');
    expect(result.session!.user.assigned_profiles).toEqual(['eksekutif']);

    // Pembuktian akar masalah: inventory.create ditolak karena mode read-only alumni/inactive
    const canCreate = hasCapability(result.session!.user, 'inventory.create');
    expect(canCreate).toBe(false);
  });

  it('8. RESOLUTION PROOF: Active organization membership restores inventory.create capability for executive profile', async () => {
    // Skenario pasca penautan organization_membership berstatus 'active':
    rpcMock.mockResolvedValue({
      data: {
        account_id: 'acc-admin-uuid-001',
        identity_id: 'ident-admin-uuid-001',
        ptv_id: 'PTV-STG-ADM',
        full_name: 'Staging Admin Eksekutif',
        username: 'admin_staging',
        status_akun: 'active',
        status_organisasi: 'active', // Pulih setelah baris organization_membership disisipkan
        profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      },
      error: null,
    });

    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-admin-token',
          expires_at: 1729000000,
          user: { id: ADMIN_UID, email: 'admin_staging@ptvpro.internal' },
        },
      },
      error: null,
    });

    const authService = new SupabaseAuthService();
    const result = await authService.login({
      identifier: 'admin_staging',
      password: 'validpassword',
    });

    expect(result.success).toBe(true);
    expect(result.session!.user.status_organisasi).toBe('active');
    expect(result.session!.user.assigned_profiles).toEqual(['eksekutif']);

    // Izin mutasi inventory.create pulih sepenuhnya
    const canCreate = hasCapability(result.session!.user, 'inventory.create');
    expect(canCreate).toBe(true);
  });
});

