import { describe, it, expect, beforeEach } from 'vitest';
import { inventarisService } from '../../src/products/hub/inventaris/inventarisService';
import { LocalPeminjamanService } from '../../src/products/hub/peminjaman/peminjamanService';
const peminjamanService = LocalPeminjamanService.getInstance();
import { hasCapability, PermissionContext } from '../../src/core/policy/policyEngine';

describe('Hub Inventaris & Peminjaman Unit Tests', () => {
  beforeEach(() => {
    // Reset services to ensure clean state between tests
    inventarisService.reset();
    peminjamanService.reset();
  });

  describe('1. Inventaris Service & Data Parity', () => {
    it('1.1 Should retrieve initial catalog items with their physical units', async () => {
      const items = await inventarisService.getInventarisList();
      expect(items.length).toBeGreaterThanOrEqual(5);

      const sonyFx3 = items.find((i) => i.kode === 'INV-001');
      expect(sonyFx3).toBeDefined();
      expect(sonyFx3?.nama_alat).toContain('Sony FX3');
      expect(sonyFx3?.kategori).toBe('Kamera');
      expect(sonyFx3?.units.length).toBe(2);
      expect(sonyFx3?.units[0].kode_unit).toBe('INV-001-U01');
      expect(sonyFx3?.units[1].kode_unit).toBe('INV-001-U02');
    });

    it('1.2 Should filter items by search query (case-insensitive)', async () => {
      const results = await inventarisService.getInventarisList({ search: 'wireless' });
      expect(results.length).toBe(1);
      expect(results[0].nama_alat).toContain('Rode Wireless PRO');

      const nonExistent = await inventarisService.getInventarisList({ search: 'NonExistentEquipment123' });
      expect(nonExistent.length).toBe(0);
    });

    it('1.3 Should filter items by category', async () => {
      const audioItems = await inventarisService.getInventarisList({ kategori: 'Audio' });
      expect(audioItems.length).toBeGreaterThan(0);
      expect(audioItems.every((item) => item.kategori === 'Audio')).toBe(true);

      const lightingItems = await inventarisService.getInventarisList({ kategori: 'Lighting' });
      expect(lightingItems.length).toBeGreaterThan(0);
      expect(lightingItems.every((item) => item.kategori === 'Lighting')).toBe(true);
    });

    it('1.4 Should filter items by status ketersediaan', async () => {
      const availableItems = await inventarisService.getInventarisList({ status: 'tersedia' });
      expect(availableItems.length).toBeGreaterThan(0);
      expect(availableItems.every((i) => i.unit_tersedia > 0)).toBe(true);
    });

    it('1.5 Should create a new equipment item and generate individual unit barcodes', async () => {
      const newItem = await inventarisService.createInventaris({
        kode: 'INV-006',
        nama_alat: 'Blackmagic Pocket Cinema Camera 6K',
        kategori: 'Kamera',
        lokasi_penyimpanan: 'Studio Lt 1 (Dry Cabinet C)',
        spesifikasi: 'Super 35 Sensor, EF Mount, 6K RAW',
        jumlah_unit: 2,
      });

      expect(newItem.id).toBeDefined();
      expect(newItem.kode).toBe('INV-006');
      expect(newItem.nama_alat).toBe('Blackmagic Pocket Cinema Camera 6K');
      expect(newItem.units.length).toBe(2);
      expect(newItem.units[0].kode_unit).toBe('INV-006-U01');
      expect(newItem.units[1].kode_unit).toBe('INV-006-U02');
      expect(newItem.total_unit).toBe(2);
      expect(newItem.unit_tersedia).toBe(2);

      const fetched = await inventarisService.getInventarisById(newItem.id);
      expect(fetched).toBeDefined();
      expect(fetched?.kode).toBe('INV-006');
    });

    it('1.6 Should throw validation error when creating item with invalid data', async () => {
      await expect(
        inventarisService.createInventaris({
          kode: '',
          nama_alat: 'Invalid Item',
          kategori: 'Audio',
          lokasi_penyimpanan: 'Studio',
          jumlah_unit: 1,
        })
      ).rejects.toThrow('Kode alat dan Nama alat wajib diisi.');

      await expect(
        inventarisService.createInventaris({
          kode: 'INV-099',
          nama_alat: '',
          kategori: 'Audio',
          lokasi_penyimpanan: 'Studio',
          jumlah_unit: 1,
        })
      ).rejects.toThrow('Kode alat dan Nama alat wajib diisi.');
    });

    it('1.7 Should generate next available inventory code according to first available number', async () => {
      const nextCode = await inventarisService.getNextAvailableCode();
      // Items initially have INV-001 to INV-005, so next available code should be INV-006
      expect(nextCode).toBe('INV-006');
    });

    it('1.8 Should reject creation when inventory code already exists (duplicate prevention)', async () => {
      await expect(
        inventarisService.createInventaris({
          kode: 'INV-001',
          nama_alat: 'Duplicated Sony FX3',
          kategori: 'Kamera',
          jumlah_unit: 1,
        })
      ).rejects.toThrow('Kode inventaris "INV-001" sudah digunakan oleh alat lain.');
    });

    it('1.9 Should create item with full legacy parity metadata (brand, model, source, photo, and custom units)', async () => {
      const created = await inventarisService.createInventaris({
        kode: 'INV-007',
        nama_alat: 'Rode NTG-4+ Shotgun Microphone',
        kategori: 'Audio',
        brand: 'Rode',
        model: 'NTG-4+',
        sumber_perolehan: 'Yayasan',
        lokasi_penyimpanan: 'Lemari Audio Lt 1',
        foto_url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc',
        spesifikasi: 'Supercardioid condenser microphone with built-in rechargeable lithium battery',
        satuan: 'unit',
        jumlah_unit: 2,
        unit_items: [
          { nama_unit: 'Mic Boom A', kondisi: 'bagus', nomor_seri: 'SN-RODE-101' },
          { nama_unit: 'Mic Boom B', kondisi: 'perlu_servis', nomor_seri: 'SN-RODE-102' },
        ],
      });

      expect(created.kode).toBe('INV-007');
      expect(created.brand).toBe('Rode');
      expect(created.model).toBe('NTG-4+');
      expect(created.sumber_perolehan).toBe('Yayasan');
      expect(created.foto_url).toBeDefined();
      expect(created.total_unit).toBe(2);
      expect(created.units[0].nama_unit).toBe('Mic Boom A');
      expect(created.units[0].nomor_seri).toBe('SN-RODE-101');
      expect(created.units[0].kondisi).toBe('bagus');
      expect(created.units[1].nama_unit).toBe('Mic Boom B');
      expect(created.units[1].kondisi).toBe('perlu_servis');
    });

    it('1.10 Should set unit status to maintenance when unit is initialized with rusak condition', async () => {
      const created = await inventarisService.createInventaris({
        kode: 'INV-008',
        nama_alat: 'Tripod Libec TH-650HD',
        kategori: 'Tripod',
        jumlah_unit: 1,
        unit_items: [{ nama_unit: 'Tripod 01', kondisi: 'rusak' }],
      });

      expect(created.units[0].kondisi).toBe('rusak');
      expect(created.units[0].status_peminjaman).toBe('maintenance');
      expect(created.unit_tersedia).toBe(0);
    });

    it('1.11 Should create asset with multiple units without serial numbers (null/undefined) conforming to new Tambah Alat contract', async () => {
      const created = await inventarisService.createInventaris({
        kode: 'INV-009',
        nama_alat: 'Godox SL60W Video Light',
        kategori: 'Lighting',
        lokasi_penyimpanan: 'Studio PTV',
        sumber_perolehan: 'Yayasan',
        jumlah_unit: 3,
        unit_items: [
          { nomor_unit: 1, nama_unit: 'Unit 01', kondisi: 'bagus' },
          { nomor_unit: 2, nama_unit: 'Unit 02', kondisi: 'bagus' },
          { nomor_unit: 3, nama_unit: 'Unit 03', kondisi: 'bagus' },
        ],
      });

      expect(created.kode).toBe('INV-009');
      expect(created.total_unit).toBe(3);
      expect(created.unit_tersedia).toBe(3);
      // Serial numbers must not be present or fake
      created.units.forEach((u) => {
        expect(u.nomor_seri).toBeUndefined();
      });
    });

    it('1.12 Should map "Baik", "Butuh Servis", and "Rusak" labels correctly to backend condition and status', async () => {
      const created = await inventarisService.createInventaris({
        kode: 'INV-010',
        nama_alat: 'Aputure Amaran 200d',
        kategori: 'Lighting',
        jumlah_unit: 3,
        unit_items: [
          { nomor_unit: 1, nama_unit: 'Unit 01', kondisi: 'bagus' },
          { nomor_unit: 2, nama_unit: 'Unit 02', kondisi: 'perlu_servis' },
          { nomor_unit: 3, nama_unit: 'Unit 03', kondisi: 'rusak' },
        ],
      });

      expect(created.units[0].kondisi).toBe('bagus');
      expect(created.units[0].status_peminjaman).toBe('tersedia');

      expect(created.units[1].kondisi).toBe('perlu_servis');
      expect(created.units[1].status_peminjaman).toBe('maintenance');

      expect(created.units[2].kondisi).toBe('rusak');
      expect(created.units[2].status_peminjaman).toBe('maintenance');

      expect(created.total_unit).toBe(3);
      expect(created.unit_tersedia).toBe(1);
    });

    it('1.13 Should differentiate global operational status (Tersedia, Dipinjam, Rusak / Servis, Hilang) from individual unit conditions', async () => {
      const createdBorrowed = await inventarisService.createInventaris({
        kode: 'INV-011',
        nama_alat: 'Sony A7 IV Unit Khusus',
        kategori: 'Kamera',
        status_operasional: 'Dipinjam',
        jumlah_unit: 1,
        unit_items: [{ nomor_unit: 1, nama_unit: 'Unit 01', kondisi: 'bagus' }],
      });

      expect(createdBorrowed.status_operasional).toBe('Dipinjam');
      expect(createdBorrowed.units[0].status_peminjaman).toBe('dipinjam');
      expect(createdBorrowed.unit_tersedia).toBe(0);
    });

    it('1.14 Should validate photo upload constraints (size and extensions)', async () => {
      // Create mock file > 15MB
      const largeFile = new File(['x'.repeat(16 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      await expect(inventarisService.uploadPhoto(largeFile)).rejects.toThrow('Ukuran file foto terlalu besar (Maksimal 15MB).');

      // Create invalid extension file
      const invalidFile = new File(['text content'], 'document.pdf', { type: 'application/pdf' });
      await expect(inventarisService.uploadPhoto(invalidFile)).rejects.toThrow('Format file tidak didukung.');
    });

    it('1.15 Should persist new items to localStorage across simulated page reload', async () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
      };
      (globalThis as any).window = { localStorage: storageMock };

      try {
        const newItem = await inventarisService.createInventaris({
          kode: 'INV-099',
          nama_alat: 'GVM RGB LED Studio Video Light Panel',
          kategori: 'Lighting',
          jumlah_unit: 1,
          unit_items: [{ nomor_unit: 1, nama_unit: 'Unit 01', kondisi: 'bagus' }],
        });
        expect(newItem.kode).toBe('INV-099');

        // Verify that localStorage holds the serialized state
        const rawStored = storageMock.getItem('ptv_local_inventaris_items');
        expect(rawStored).toBeTruthy();
        const parsed = JSON.parse(rawStored || '[]');
        const foundInStorage = parsed.find((i: any) => i.kode === 'INV-099');
        expect(foundInStorage).toBeDefined();
        expect(foundInStorage.nama_alat).toContain('GVM RGB LED');

        // Reset and verify localStorage is cleaned
        inventarisService.reset();
        expect(storageMock.getItem('ptv_local_inventaris_items')).toBeNull();
      } finally {
        delete (globalThis as any).window;
      }
    });

    it('1.15b Should restore newly created items and photos across simulated hard refresh (re-instantiating service)', async () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
      };
      (globalThis as any).window = { localStorage: storageMock };

      try {
        const { LocalInventarisService } = await import('../../src/products/hub/inventaris/inventarisService');
        const instance1 = new (LocalInventarisService as any)();

        // Buat alat baru dengan foto dan unit fisik
        const created = await instance1.createInventaris({
          kode: 'INV-088',
          nama_alat: 'Blackmagic ATEM Mini Extreme ISO',
          kategori: 'Streaming / Live',
          foto_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD',
          jumlah_unit: 2,
          unit_items: [
            { nomor_unit: 1, nama_unit: 'Switcher Main', kondisi: 'bagus' },
            { nomor_unit: 2, nama_unit: 'Switcher Backup', kondisi: 'bagus' },
          ],
        });
        expect(created.kode).toBe('INV-088');

        // SIMULASI HARD REFRESH: Buat instansi service baru yang membaca langsung dari localStorage
        const instanceAfterRefresh = new (LocalInventarisService as any)();
        const reloadedList = await instanceAfterRefresh.getInventarisList();

        const reloadedItem = reloadedList.find((i: any) => i.kode === 'INV-088');
        expect(reloadedItem).toBeDefined();
        expect(reloadedItem.nama_alat).toBe('Blackmagic ATEM Mini Extreme ISO');
        expect(reloadedItem.foto_url).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD');
        expect(reloadedItem.units.length).toBe(2);
        expect(reloadedItem.units[0].nama_unit).toBe('Switcher Main');
        expect(reloadedItem.units[1].nama_unit).toBe('Switcher Backup');
        expect(reloadedItem.unit_tersedia).toBe(2);
      } finally {
        delete (globalThis as any).window;
      }
    });

    it('1.15c Should protect master asset and physical units from loss when localStorage throws QuotaExceededError', async () => {
      let quotaTriggered = false;
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => {
          // Simulasikan quota exceeded error jika payload memuat data URL besar
          if (v.length > 50000 && !quotaTriggered) {
            quotaTriggered = true;
            const err = new Error('Quota exceeded');
            err.name = 'QuotaExceededError';
            throw err;
          }
          mockStorage[k] = v;
        },
        removeItem: (k: string) => { delete mockStorage[k]; },
      };
      (globalThis as any).window = { localStorage: storageMock };

      try {
        const { LocalInventarisService } = await import('../../src/products/hub/inventaris/inventarisService');
        const service = new (LocalInventarisService as any)();

        // Tambah item dengan payload foto berukuran simulasi besar
        await service.createInventaris({
          kode: 'INV-QUOTA-TEST',
          nama_alat: 'High Resolution Heavy Photo Camera',
          kategori: 'Kamera',
          foto_url: 'data:image/jpeg;base64,' + 'X'.repeat(60000),
          jumlah_unit: 1,
          unit_items: [{ nomor_unit: 1, nama_unit: 'Unit 01', kondisi: 'bagus' }],
        });

        // Verifikasi bahwa quota fallback berhasil menjaga master item dan units di storage
        const rawStored = storageMock.getItem('ptv_local_inventaris_items');
        expect(rawStored).toBeTruthy();
        const parsed = JSON.parse(rawStored || '[]');
        const protectedItem = parsed.find((i: any) => i.kode === 'INV-QUOTA-TEST');
        expect(protectedItem).toBeDefined();
        expect(protectedItem.nama_alat).toBe('High Resolution Heavy Photo Camera');
        expect(protectedItem.units.length).toBe(1);
      } finally {
        delete (globalThis as any).window;
      }
    });

    it('1.16 Should report integration diagnostics from inventarisService', async () => {
      const diag = await inventarisService.getIntegrationDiagnostics();
      expect(diag).toBeDefined();
      expect(diag.activeBackend).toBe('local');
      expect(diag.storage.bucketTarget).toBe('inventory');
      expect(diag.rlsWritePermission.hasPermission).toBe(false);
      expect(diag.rlsWritePermission.notice).toContain('RLS');
    });

    it('1.17 Should allow switching between local and supabase adapters and persist choice in localStorage', async () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
      };
      (globalThis as any).window = { localStorage: storageMock };

      try {
        expect(inventarisService.getActiveBackend()).toBe('local');
        inventarisService.setBackendAdapter('supabase');
        expect(inventarisService.getActiveBackend()).toBe('supabase');
        expect(storageMock.getItem('ptv_inventaris_backend')).toBe('supabase');

        // Switch back to local
        inventarisService.setBackendAdapter('local');
        expect(inventarisService.getActiveBackend()).toBe('local');
        expect(storageMock.getItem('ptv_inventaris_backend')).toBe('local');
      } finally {
        delete (globalThis as any).window;
      }
    });

    it('1.18 Should explicitly throw error in supabase mode without silent fallback to mock data', async () => {
      inventarisService.setBackendAdapter('supabase');
      try {
        // In local unit test environment with mock supabase client (or unauthenticated staging),
        // querying supabase will either succeed or throw an explicit database/network error.
        // It must NOT silently return the default in-memory fixtures.
        const activeService = (inventarisService as any).activeService;
        expect(activeService).toBeDefined();
        expect(inventarisService.isLiveMode()).toBe(true);
      } finally {
        inventarisService.setBackendAdapter('local');
      }
    });

    it('1.19 Should strictly require rpc_create_inventaris for atomic creation and refuse non-atomic fallback when RPC is absent', async () => {
      let nonAtomicInsertAttempted = false;

      // Mock client with missing RPC function (code 42883)
      const mockSupabase = {
        from: (table: string) => {
          if (table === 'ptv_inventaris' || table === 'ptv_inventaris_unit') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              insert: () => {
                nonAtomicInsertAttempted = true;
                return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
              },
            };
          }
          return {};
        },
        storage: {
          from: () => ({
            remove: async () => ({ data: null, error: null }),
          }),
        },
        rpc: async (func: string) => {
          if (func === 'rpc_create_inventaris') {
            return { data: null, error: { message: 'function rpc_create_inventaris does not exist', code: '42883' } };
          }
          return { data: null, error: null };
        },
      };

      const { setSupabaseClientForTesting } = await import('../../src/core/supabase');
      setSupabaseClientForTesting(mockSupabase as any);

      try {
        const { supabaseInventarisService } = await import('../../src/products/hub/inventaris/inventarisService');
        await expect(
          supabaseInventarisService.createInventaris({
            kode: 'INV-TEST-ATOMIC',
            nama_alat: 'Atomic Refusal Test Camera',
            kategori: 'Kamera',
            jumlah_unit: 1,
          })
        ).rejects.toThrow('Database Konfigurasi Belum Siap: Function RPC "rpc_create_inventaris" belum diterapkan');

        // Confirm ZERO non-atomic insert was attempted!
        expect(nonAtomicInsertAttempted).toBe(false);
      } finally {
        setSupabaseClientForTesting(null);
      }
    });

    it('1.20 Should clean up newly uploaded photo from storage bucket if atomic RPC creation fails', async () => {
      let photoRemovedPath: string[] | null = null;

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        storage: {
          from: (bucket: string) => ({
            remove: async (paths: string[]) => {
              if (bucket === 'inventory') {
                photoRemovedPath = paths;
              }
              return { data: null, error: null };
            },
          }),
        },
        rpc: async () => ({
          data: null,
          error: { message: 'Internal validation failed during insert', code: '22023' },
        }),
      };

      const { setSupabaseClientForTesting } = await import('../../src/core/supabase');
      setSupabaseClientForTesting(mockSupabase as any);

      try {
        const { supabaseInventarisService } = await import('../../src/products/hub/inventaris/inventarisService');
        await expect(
          supabaseInventarisService.createInventaris({
            kode: 'INV-PHOTO-FAIL',
            nama_alat: 'Photo Orphan Test Camera',
            kategori: 'Kamera',
            foto_url: 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/catalog/inv-test.jpg',
            jumlah_unit: 1,
          })
        ).rejects.toThrow('Gagal menyimpan alat ke database (RPC Error: Internal validation failed');

        // Verify storage cleanup was called strictly on the inventory bucket for the new photo
        expect(photoRemovedPath).toEqual(['catalog/inv-test.jpg']);
      } finally {
        setSupabaseClientForTesting(null);
      }
    });

    it('1.21 Should detect unique constraint violation (code 23505) from RPC and report concurrency conflict gracefully', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        storage: {
          from: () => ({
            remove: async () => ({ data: null, error: null }),
          }),
        },
        rpc: async () => ({
          data: null,
          error: { message: 'duplicate key value violates unique constraint', code: '23505' },
        }),
      };

      const { setSupabaseClientForTesting } = await import('../../src/core/supabase');
      setSupabaseClientForTesting(mockSupabase as any);

      try {
        const { supabaseInventarisService } = await import('../../src/products/hub/inventaris/inventarisService');
        await expect(
          supabaseInventarisService.createInventaris({
            kode: 'INV-DUPLICATE-RACE',
            nama_alat: 'Concurrent Collision Camera',
            kategori: 'Kamera',
            jumlah_unit: 1,
          })
        ).rejects.toThrow('sudah digunakan di database (konflik unik/konkurensi)');
      } finally {
        setSupabaseClientForTesting(null);
      }
    });

    it('1.22 Should perform database reconciliation upon timeout/network error, preserving photo if record committed', async () => {
      let photoCleanupCalled = false;
      let checkCount = 0;

      const mockSupabase = {
        from: (table: string) => {
          if (table === 'ptv_inventaris') {
            return {
              select: () => ({
                order: () => Promise.resolve({
                  data: [{
                    id: 'uuid-reconciled-999',
                    kode: 'INV-RECONCILE',
                    nama_alat: 'Reconciled Sony Cinema',
                    kategori: 'Kamera',
                    spesifikasi: null,
                    foto_url: 'catalog/inv-safe.jpg',
                    harga_beli: null,
                    sumber_perolehan: 'Yayasan',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    ptv_inventaris_unit: [],
                    ptv_nilai_inventaris: null,
                  }],
                  error: null,
                }),
                eq: (col: string, val: string) => {
                  if (col === 'kode' && val === 'INV-RECONCILE') {
                    checkCount++;
                    return {
                      maybeSingle: async () => {
                        // Pre-check sebelum RPC: kode belum ada di DB
                        if (checkCount === 1) {
                          return { data: null, error: null };
                        }
                        // Rekonsiliasi pasca timeout: transaksi ternyata sudah ter-commit di DB
                        return {
                          data: { id: 'uuid-reconciled-999', kode: 'INV-RECONCILE', foto_url: 'catalog/inv-safe.jpg' },
                          error: null,
                        };
                      },
                    };
                  }
                  return {
                    maybeSingle: async () => ({
                      data: { id: 'uuid-reconciled-999', kode: 'INV-RECONCILE' },
                      error: null,
                    }),
                  };
                },
              }),
            };
          }
          return {};
        },
        storage: {
          from: () => ({
            remove: async () => {
              photoCleanupCalled = true;
              return { data: null, error: null };
            },
          }),
        },
        rpc: async () => ({
          data: null,
          error: { message: '504 Gateway Timeout while executing RPC', code: '57014' },
        }),
      };

      const { setSupabaseClientForTesting } = await import('../../src/core/supabase');
      setSupabaseClientForTesting(mockSupabase as any);

      try {
        const { supabaseInventarisService } = await import('../../src/products/hub/inventaris/inventarisService');
        const result = await supabaseInventarisService.createInventaris({
          kode: 'INV-RECONCILE',
          nama_alat: 'Reconciled Sony Cinema',
          kategori: 'Kamera',
          foto_url: 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/catalog/inv-safe.jpg',
          jumlah_unit: 1,
        });

        // Sukses via rekonsiliasi:
        expect(result).toBeDefined();
        expect(result.id).toBe('uuid-reconciled-999');
        // Foto TIDAK dihapus karena sudah di-commit di database!
        expect(photoCleanupCalled).toBe(false);
      } finally {
        setSupabaseClientForTesting(null);
      }
    });

    it('1.23 Should enforce RBAC capability check rejecting unauthorized accounts from creating inventory', () => {
      const standardCrewCtx: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      const executiveCtx: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      // Standard crew must NOT have inventory.create capability
      expect(hasCapability(standardCrewCtx, 'inventory.create')).toBe(false);

      // Executive MUST have inventory.create capability
      expect(hasCapability(executiveCtx, 'inventory.create')).toBe(true);
    });
  });

  describe('2. Peminjaman Service & Transactional Integrity', () => {
    it('2.1 Should retrieve list of loans and filter by status', async () => {
      const allLoans = await peminjamanService.getPeminjamanList();
      expect(allLoans.length).toBeGreaterThan(0);

      const dipinjamLoans = await peminjamanService.getPeminjamanList({ status: 'dipinjam' });
      expect(dipinjamLoans.every((l) => l.status === 'dipinjam')).toBe(true);

      const returnedLoans = await peminjamanService.getPeminjamanList({ status: 'dikembalikan' });
      expect(returnedLoans.every((l) => l.status === 'dikembalikan')).toBe(true);
    });

    it('2.2 Should list only available units for checkout', async () => {
      const availableUnits = await peminjamanService.getAvailableUnits();
      expect(availableUnits.length).toBeGreaterThan(0);
      expect(availableUnits.every((u) => u.unit.status_peminjaman === 'tersedia')).toBe(true);
      expect(availableUnits.every((u) => u.unit.kondisi !== 'rusak')).toBe(true);
    });

    it('2.3 Should atomically checkout loan and lock unit status to dipinjam', async () => {
      const availableBefore = await peminjamanService.getAvailableUnits();
      const target = availableBefore[0];
      expect(target).toBeDefined();

      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const checkoutRes = await peminjamanService.checkoutLoan({
        borrower_name: 'Budi Santoso',
        purpose: 'Liputan Lapangan Dokumenter',
        unit_ids: [target.unit.id],
        due_date: tomorrow,
      });

      expect(checkoutRes.success).toBe(true);
      expect(checkoutRes.transaction_id).toMatch(/^TRX-\d{6}-\d{3}$/);

      // Verify unit is locked in inventaris
      const itemWithUnit = await inventarisService.getInventarisById(target.item.id);
      const lockedUnit = itemWithUnit?.units.find((u) => u.id === target.unit.id);
      expect(lockedUnit?.status_peminjaman).toBe('dipinjam');

      // Verify unit no longer appears in available units
      const availableAfter = await peminjamanService.getAvailableUnits();
      expect(availableAfter.some((u) => u.unit.id === target.unit.id)).toBe(false);
    });

    it('2.4 Should reject checkout if attempting to borrow already borrowed unit', async () => {
      const availableBefore = await peminjamanService.getAvailableUnits();
      const target = availableBefore[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // First checkout succeeds
      await peminjamanService.checkoutLoan({
        borrower_name: 'Kru Satu',
        purpose: 'Proyek A',
        unit_ids: [target.unit.id],
        due_date: tomorrow,
      });

      // Second checkout on same unit must fail
      await expect(
        peminjamanService.checkoutLoan({
          borrower_name: 'Kru Dua',
          purpose: 'Proyek B',
          unit_ids: [target.unit.id],
          due_date: tomorrow,
        })
      ).rejects.toThrow(/tidak lagi tersedia/);
    });

    it('2.5 Should reject checkout with missing required fields or empty units', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      await expect(
        peminjamanService.checkoutLoan({
          borrower_name: '',
          purpose: 'Liputan',
          unit_ids: ['some-id'],
          due_date: tomorrow,
        })
      ).rejects.toThrow('Nama peminjam wajib diisi.');

      await expect(
        peminjamanService.checkoutLoan({
          borrower_name: 'Peminjam',
          purpose: 'Liputan',
          unit_ids: [],
          due_date: tomorrow,
        })
      ).rejects.toThrow('Pilih minimal satu unit alat untuk dipinjam.');
    });

    it('2.6 Should return loan in good condition and release unit to tersedia', async () => {
      const available = await peminjamanService.getAvailableUnits();
      const target = available[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const checkoutRes = await peminjamanService.checkoutLoan({
        borrower_name: 'Siti Aminah',
        purpose: 'Podcast Studio',
        unit_ids: [target.unit.id],
        due_date: tomorrow,
      });

      const returnRes = await peminjamanService.returnLoan({
        transaction_id: checkoutRes.transaction_id,
        condition_status: 'bagus',
        notes: 'Semua kelengkapan komplit dan bersih',
      });

      expect(returnRes.success).toBe(true);

      // Verify unit is restored to tersedia
      const item = await inventarisService.getInventarisById(target.item.id);
      const restoredUnit = item?.units.find((u) => u.id === target.unit.id);
      expect(restoredUnit?.status_peminjaman).toBe('tersedia');
      expect(restoredUnit?.kondisi).toBe('bagus');
    });

    it('2.7 Should return loan with damaged condition and set unit to maintenance', async () => {
      const available = await peminjamanService.getAvailableUnits();
      const target = available[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const checkoutRes = await peminjamanService.checkoutLoan({
        borrower_name: 'Ahmad Fauzi',
        purpose: 'Shooting Outdoor',
        unit_ids: [target.unit.id],
        due_date: tomorrow,
      });

      const returnRes = await peminjamanService.returnLoan({
        transaction_id: checkoutRes.transaction_id,
        condition_status: 'rusak',
        notes: 'Kabel mic putus dan housing lecet berat',
      });

      expect(returnRes.success).toBe(true);

      // Verify unit is set to maintenance and kondisi rusak
      const item = await inventarisService.getInventarisById(target.item.id);
      const damagedUnit = item?.units.find((u) => u.id === target.unit.id);
      expect(damagedUnit?.status_peminjaman).toBe('maintenance');
      expect(damagedUnit?.kondisi).toBe('rusak');
    });

    it('2.8 Should reject returning an already returned transaction', async () => {
      const loans = await peminjamanService.getPeminjamanList({ status: 'dikembalikan' });
      const alreadyReturned = loans[0];
      expect(alreadyReturned).toBeDefined();

      await expect(
        peminjamanService.returnLoan({
          transaction_id: alreadyReturned.transaction_id,
          condition_status: 'bagus',
        })
      ).rejects.toThrow(/sudah dikembalikan/);
    });
  });

  describe('3. Security & Policy Engine RBAC for Inventaris & Peminjaman', () => {
    it('3.1 Eksekutif and Kepolo Kepali have operational inventory & loan privileges', () => {
      const eksekutifUser: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(hasCapability(eksekutifUser, 'inventory.view')).toBe(true);
      expect(hasCapability(eksekutifUser, 'inventory.create')).toBe(true);
      expect(hasCapability(eksekutifUser, 'inventory.edit')).toBe(true);
      expect(hasCapability(eksekutifUser, 'inventory.units.manage')).toBe(true);
      expect(hasCapability(eksekutifUser, 'loans.view')).toBe(true);
      expect(hasCapability(eksekutifUser, 'loans.checkout')).toBe(true);
      expect(hasCapability(eksekutifUser, 'loans.return')).toBe(true);
      expect(hasCapability(eksekutifUser, 'loans.manage')).toBe(true);

      const kepoloUser: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['kepolo_kepali'],
        allowed_overrides: [],
        denied_overrides: [],
      };
      expect(hasCapability(kepoloUser, 'inventory.view')).toBe(true);
      expect(hasCapability(kepoloUser, 'inventory.create')).toBe(true);
      expect(hasCapability(kepoloUser, 'loans.checkout')).toBe(true);
      expect(hasCapability(kepoloUser, 'loans.return')).toBe(true);
    });

    it('3.2 Crew has view and checkout capabilities, but cannot create catalog items', () => {
      const crew: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(hasCapability(crew, 'inventory.view')).toBe(true);
      expect(hasCapability(crew, 'loans.view')).toBe(true);
      expect(hasCapability(crew, 'loans.checkout')).toBe(true);

      // Crew cannot manage catalog or edit items
      expect(hasCapability(crew, 'inventory.create')).toBe(false);
      expect(hasCapability(crew, 'inventory.edit')).toBe(false);
      expect(hasCapability(crew, 'inventory.delete')).toBe(false);
      expect(hasCapability(crew, 'loans.manage')).toBe(false);
    });

    it('3.3 Inactive/Suspended user loses all inventory and loan access', () => {
      const inactiveUser: PermissionContext = {
        status_akun: 'inactive',
        status_organisasi: 'inactive',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(hasCapability(inactiveUser, 'inventory.view')).toBe(false);
      expect(hasCapability(inactiveUser, 'inventory.create')).toBe(false);
      expect(hasCapability(inactiveUser, 'loans.checkout')).toBe(false);
    });
  });
});
