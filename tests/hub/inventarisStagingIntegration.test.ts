import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SupabaseInventarisService } from '../../src/products/hub/inventaris/inventarisService';
import { CreateInventarisDTO } from '../../src/products/hub/inventaris/types';
import * as supabaseModule from '../../src/core/supabase';
import { getAuthService, setAuthServiceForTesting, SupabaseAuthService } from '../../src/core/auth/authService';

describe('Inventaris Staging Integration & Contract Verification Tests', () => {
  describe('1. Idempotency Key, Safe Timeout Reconciliation & Photo Protection', () => {
    let mockSupabase: any;
    let service: SupabaseInventarisService;
    let removeStorageMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      removeStorageMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase = {
        from: vi.fn(),
        rpc: vi.fn(),
        storage: {
          from: vi.fn().mockReturnValue({
            remove: removeStorageMock,
          }),
        },
      };

      vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);
      service = new SupabaseInventarisService();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('does not report valuation saved when cloud rejects the write', async () => {
      const read = vi.spyOn(service, 'getInventarisById').mockResolvedValue({ id: 'synthetic-asset' } as any);
      mockSupabase.from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { code: '42501' } }) });
      await expect(service.updateNilaiInventaris('synthetic-asset', { nilai_perolehan: 100 })).rejects.toThrow('belum tersimpan');
      expect(read).toHaveBeenCalledTimes(1);
    });

    it('1.1 Should reconcile on timeout if record was committed under idempotency key without deleting photo', async () => {
      const fixedIdempotencyKey = 'c7d5314d-b9bf-4300-beee-0090df31d04b';
      const mockPhotoUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/alat/photo.jpg';

      // 1. Initial code existence check returns null
      const existingQueryMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // 2. Timeout simulation on RPC
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Connection timed out after 10000ms',
          code: '57014',
        },
      });

      // 3. Reconciled query mock finds the committed record by ID!
      const reconcileQueryMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: fixedIdempotencyKey, kode: 'INV-777', foto_url: mockPhotoUrl },
          error: null,
        }),
      };

      // Setup supabase.from dispatcher
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'ptv_inventaris') {
          return {
            select: vi.fn((fields: string) => {
              if (fields === 'id') return existingQueryMock;
              return reconcileQueryMock;
            }),
          };
        }
        return {};
      });

      // Mock getInventarisById returning the reconstructed item
      vi.spyOn(service, 'getInventarisById').mockResolvedValue({
        id: fixedIdempotencyKey,
        kode: 'INV-777',
        nama_alat: 'Sony Cinema Line FX6',
        kategori: 'Kamera',
        foto_url: mockPhotoUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        units: [],
        total_unit: 1,
        unit_tersedia: 1,
      });

      const dto: CreateInventarisDTO = {
        kode: 'INV-777',
        nama_alat: 'Sony Cinema Line FX6',
        kategori: 'Kamera',
        jumlah_unit: 1,
        foto_url: mockPhotoUrl,
        idempotency_key: fixedIdempotencyKey,
      };

      const result = await service.createInventaris(dto);

      expect(result.id).toBe(fixedIdempotencyKey);
      expect(result.kode).toBe('INV-777');
      // Critical check: Storage remove MUST NOT be called because transaction succeeded!
      expect(removeStorageMock).not.toHaveBeenCalled();
    });

    it('1.2 Should NOT delete photo if timeout occurs and reconciliation search is still empty (status unknown)', async () => {
      const fixedIdempotencyKey = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      const mockPhotoUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/alat/photo.jpg';

      const existingQueryMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Statement timeout 57014',
          code: '57014',
        },
      });

      const reconcileQueryMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn((fields: string) => {
          if (fields === 'id') return existingQueryMock;
          return reconcileQueryMock;
        }),
      }));

      const dto: CreateInventarisDTO = {
        kode: 'INV-888',
        nama_alat: 'Red Komodo 6K',
        kategori: 'Kamera',
        jumlah_unit: 1,
        foto_url: mockPhotoUrl,
        idempotency_key: fixedIdempotencyKey,
      };

      await expect(service.createInventaris(dto)).rejects.toThrow(
        /Koneksi database timeout\/terputus.*Status pengajuan inventaris di database belum dapat dipastikan/
      );

      // Critical check: Foto TIDAK BOLEH dihapus karena status masih belum dapat dipastikan!
      expect(removeStorageMock).not.toHaveBeenCalled();
    });

    it('1.3 Should delete photo ONLY on definitive failures (e.g. RLS 42501, Duplicate Code 23505, Missing RPC 42883)', async () => {
      const mockPhotoUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/alat/photo.jpg';

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for function rpc_create_inventaris',
        },
      });

      const dto: CreateInventarisDTO = {
        kode: 'INV-999',
        nama_alat: 'Definitive Reject Test',
        kategori: 'Kamera',
        jumlah_unit: 1,
        foto_url: mockPhotoUrl,
      };

      await expect(service.createInventaris(dto)).rejects.toThrow(/Akses Ditolak Database \(RLS\)/);

      // On definitive RLS denial, photo cleanup IS performed
      expect(removeStorageMock).toHaveBeenCalledWith(['alat/photo.jpg']);
    });

    it('1.4 Should clean up photo and throw specific conflict error on IDEMPOTENCY_CONFLICT', async () => {
      const mockPhotoUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/alat/mismatch.jpg';

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'IDEMPOTENCY_CONFLICT: Request ID "c7d5314d-b9bf-4300-beee-0090df31d04b" telah digunakan sebelumnya dengan payload data alat yang berbeda',
        },
      });

      const dto: CreateInventarisDTO = {
        kode: 'INV-101',
        nama_alat: 'Tripod Carbon',
        kategori: 'Aksesoris',
        jumlah_unit: 1,
        foto_url: mockPhotoUrl,
        idempotency_key: 'c7d5314d-b9bf-4300-beee-0090df31d04b',
      };

      await expect(service.createInventaris(dto)).rejects.toThrow(/Konflik Idempotensi: IDEMPOTENCY_CONFLICT/);
      expect(removeStorageMock).toHaveBeenCalledWith(['alat/mismatch.jpg']);
    });

    it('1.5 Should clean up photo and throw specific error on foreign request ID ownership rejection', async () => {
      const mockPhotoUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/alat/foreign.jpg';

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'FORBIDDEN: Request ID c7d5314d-b9bf-4300-beee-0090df31d04b terdaftar atas kepemilikan akun lain',
        },
      });

      const dto: CreateInventarisDTO = {
        kode: 'INV-102',
        nama_alat: 'Foreign Asset Replay',
        kategori: 'Kamera',
        jumlah_unit: 1,
        foto_url: mockPhotoUrl,
        idempotency_key: 'c7d5314d-b9bf-4300-beee-0090df31d04b',
      };

      await expect(service.createInventaris(dto)).rejects.toThrow(/Akses Ditolak Database: FORBIDDEN: Request ID.*kepemilikan akun lain/);
      expect(removeStorageMock).toHaveBeenCalledWith(['alat/foreign.jpg']);
    });
  });

  describe('2. SQL DDL & Storage Policies Verification', () => {
    const ddlPath = path.resolve('docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql');
    const ddlContent = fs.readFileSync(ddlPath, 'utf8');

    it('2.1 Should contain regex verification before UUID cast to prevent invalid input syntax crash', () => {
      expect(ddlContent).toContain(
        "IF (p_master ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN"
      );
      expect(ddlContent).toContain("v_client_id := (p_master ->> 'id')::UUID;");
    });

    it('2.2 Should contain idempotent replay logic that returns existing record on duplicate UUID', () => {
      expect(ddlContent).toContain("IF v_client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.ptv_inventaris WHERE id = v_client_id) THEN");
      expect(ddlContent).toContain("'idempotent_replay', true");
    });

    it('2.3 Should drop broad authenticated delete policy and define distinct owner cleanup and manager delete', () => {
      expect(ddlContent).toContain('DROP POLICY IF EXISTS "inventory_authenticated_delete" ON storage.objects;');
      expect(ddlContent).toContain('CREATE POLICY "inventory_owner_cleanup" ON storage.objects');
      expect(ddlContent).toContain('owner = auth.uid()');
      expect(ddlContent).toContain("public.has_capability('inventory.create') IS TRUE");

      expect(ddlContent).toContain('CREATE POLICY "inventory_manager_delete" ON storage.objects');
      expect(ddlContent).toContain("public.has_capability('inventory.delete') IS TRUE OR public.has_capability('inventory.manage') IS TRUE");
    });

    it('2.4 Should ensure public view policy remains open for catalog reading', () => {
      expect(ddlContent).toContain('CREATE POLICY "inventory_public_view" ON storage.objects');
      expect(ddlContent).toContain("bucket_id = 'inventory'");
    });

    it('2.5 Should acquire advisory lock at the very beginning to serialize concurrent submissions and prevent race duplicates', () => {
      const lockIdx = ddlContent.indexOf('PERFORM pg_advisory_xact_lock(1001);');
      const idempotencyIdx = ddlContent.indexOf('Pemeriksaan Idempotensi');
      expect(lockIdx).toBeGreaterThan(0);
      expect(lockIdx).toBeLessThan(idempotencyIdx);
    });

    it('2.6 Should verify operation ownership and reject replay from different auth.uid() with 42501', () => {
      expect(ddlContent).toContain('v_caller_auth_id := auth.uid();');
      expect(ddlContent).toContain('v_existing_created_by <> v_caller_auth_id');
      expect(ddlContent).toContain("RAISE EXCEPTION 'FORBIDDEN: Request ID % terdaftar atas kepemilikan akun lain'");
    });

    it('2.7 Should detect payload mismatch on replay and reject with IDEMPOTENCY_CONFLICT', () => {
      expect(ddlContent).toContain('v_calculated_payload_hash := md5(');
      expect(ddlContent).toContain('v_existing_payload_hash <> v_calculated_payload_hash');
      expect(ddlContent).toContain("RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT:");
    });

    it('2.8 Should restrict inventory_owner_cleanup strictly to files NOT referenced by any tool in ptv_inventaris', () => {
      expect(ddlContent).toContain('NOT EXISTS (');
      expect(ddlContent).toContain('SELECT 1 FROM public.ptv_inventaris pi');
      expect(ddlContent).toContain("pi.foto_url LIKE '%' || storage.objects.name");
    });
  });

  describe('3. Auth Adapter & Identity Contract Verification', () => {
    beforeEach(() => {
      setAuthServiceForTesting(null);
    });

    afterEach(() => {
      setAuthServiceForTesting(null);
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('3.1 Should throw an explicit configuration error if VITE_AUTH_BACKEND=supabase without environment credentials (no silent mock)', () => {
      vi.stubEnv('VITE_AUTH_BACKEND', 'supabase');
      vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(false);

      expect(() => getAuthService()).toThrow(
        /Konfigurasi Auth Error: Mode autentikasi "supabase" dipilih.*Sistem menolak beralih diam-diam ke mock/
      );
    });

    it('3.2 Should reject login and sign out if user account status is not active', async () => {
      const signOutMock = vi.fn().mockResolvedValue({ error: null });
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          signInWithPassword: vi.fn().mockResolvedValue({
            data: {
              session: {
                access_token: 'fake-jwt-token',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                user: {
                  id: 'user-suspended-001',
                  email: 'suspended@ptvpro.internal',
                  user_metadata: {
                    status_akun: 'suspended',
                    full_name: 'Suspended Crew Member',
                  },
                },
              },
            },
            error: null,
          }),
          signOut: signOutMock,
          onAuthStateChange: vi.fn().mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
          }),
        },
        rpc: vi.fn().mockResolvedValue({
          data: {
            account_id: 'acc-suspended-001',
            ptv_id: 'PTV-000',
            username: 'suspended',
            status_akun: 'inactive',
            status_organisasi: 'inactive',
            profiles: ['crew'],
            allowed_overrides: [],
            denied_overrides: [],
          },
          error: null,
        }),
      };

      vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue(mockClient as any);

      const authService = new SupabaseAuthService();
      const loginResult = await authService.login({
        identifier: 'suspended@ptvpro.internal',
        password: 'password123',
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('Akun nonaktif');
      expect(signOutMock).toHaveBeenCalled();
      expect(await authService.getCurrentSession()).toBeNull();
    });
  });
});
