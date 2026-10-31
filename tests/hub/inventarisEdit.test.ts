import { describe, it, expect, beforeEach } from 'vitest';
import { inventarisService } from '../../src/products/hub/inventaris/inventarisService';
import { LocalPeminjamanService } from '../../src/products/hub/peminjaman/peminjamanService';
const peminjamanService = LocalPeminjamanService.getInstance();
import { hasCapability, PermissionContext } from '../../src/core/policy/policyEngine';
import { UpdateInventarisDTO } from '../../src/products/hub/inventaris/types';

describe('Hub Inventaris - Edit Data Alat Unit & Security Tests', () => {
  beforeEach(() => {
    inventarisService.reset();
    peminjamanService.reset();
  });

  describe('1. Form Loading & Data Integrity', () => {
    it('1.1 Harus mengambil data master dan unit fisik yang lengkap untuk pre-populasi form', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items[0];
      expect(target).toBeDefined();

      const detail = await inventarisService.getInventarisById(target.id);
      expect(detail).not.toBeNull();
      expect(detail?.id).toBe(target.id);
      expect(detail?.kode).toBe(target.kode);
      expect(detail?.nama_alat).toBe(target.nama_alat);
      expect(detail?.units.length).toBe(target.units.length);
      expect(detail?.units[0].id).toBe(target.units[0].id);
    });
  });

  describe('2. Edit Atribut Master & Unit', () => {
    it('2.1 Harus berhasil memperbarui atribut master (nama, kategori, brand, model, spesifikasi, lokasi, sumber)', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items[0];

      const updatePayload: UpdateInventarisDTO = {
        id: target.id,
        kode: target.kode,
        nama_alat: 'Sony FX3 Cinema Updated Edition',
        kategori: 'Kamera',
        brand: 'Sony Pro',
        model: 'FX3-V2',
        spesifikasi: 'Kamera sinema full-frame 4K 120fps verifikasi edit',
        lokasi_penyimpanan: 'Studio PTV Rak A1',
        sumber_perolehan: 'Hibah Mitra 2026',
        satuan: 'unit',
        units: target.units.map((u) => ({
          id: u.id,
          kode_unit: u.kode_unit,
          nama_unit: u.nama_unit || `Unit ${u.kode_unit}`,
          nomor_seri: u.nomor_seri || null,
          kondisi: u.kondisi,
          lokasi_penyimpanan: 'Studio PTV Rak A1',
        })),
      };

      const updated = await inventarisService.updateInventaris(updatePayload);

      expect(updated.nama_alat).toBe('Sony FX3 Cinema Updated Edition');
      expect(updated.brand).toBe('Sony Pro');
      expect(updated.model).toBe('FX3-V2');
      expect(updated.spesifikasi).toBe('Kamera sinema full-frame 4K 120fps verifikasi edit');
      expect(updated.sumber_perolehan).toBe('Hibah Mitra 2026');
      expect(updated.kode).toBe(target.kode); // Kode master tidak berubah
    });

    it('2.2 Nomor seri kosong (string kosong atau whitespace) harus diterima dan dinormalisasi menjadi undefined / NULL', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items[0];

      const payload: UpdateInventarisDTO = {
        id: target.id,
        nama_alat: target.nama_alat,
        kategori: target.kategori,
        units: [
          {
            id: target.units[0].id,
            kode_unit: target.units[0].kode_unit,
            nomor_seri: null, // nomor seri dikosongkan
            kondisi: 'bagus',
          },
          ...(target.units.slice(1).map((u) => ({
            id: u.id,
            kode_unit: u.kode_unit,
            nomor_seri: u.nomor_seri,
            kondisi: u.kondisi,
          }))),
        ],
      };

      const updated = await inventarisService.updateInventaris(payload);
      expect(updated.units[0].nomor_seri).toBeUndefined();
    });

    it('2.3 Edit serial number satu unit tidak boleh mengubah nomor seri unit lainnya', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items.find((i) => i.units.length >= 2)!;
      expect(target).toBeDefined();

      const origUnit2Sn = target.units[1].nomor_seri;

      const payload: UpdateInventarisDTO = {
        id: target.id,
        nama_alat: target.nama_alat,
        kategori: target.kategori,
        units: [
          {
            id: target.units[0].id,
            kode_unit: target.units[0].kode_unit,
            nomor_seri: 'NEW-SN-U01-CUSTOM',
            kondisi: target.units[0].kondisi,
          },
          {
            id: target.units[1].id,
            kode_unit: target.units[1].kode_unit,
            nomor_seri: origUnit2Sn,
            kondisi: target.units[1].kondisi,
          },
        ],
      };

      const updated = await inventarisService.updateInventaris(payload);
      expect(updated.units[0].nomor_seri).toBe('NEW-SN-U01-CUSTOM');
      expect(updated.units[1].nomor_seri).toBe(origUnit2Sn);
    });

    it('2.4 Status peminjaman (tersedia vs dipinjam) wajib dipertahankan; edit kondisi tidak boleh membuat unit dipinjam menjadi tersedia', async () => {
      // Cari alat yang memiliki unit berstatus dipinjam
      const items = await inventarisService.getInventarisList();
      const target = items.find((i) => i.units.some((u) => u.status_peminjaman === 'dipinjam'))!;
      expect(target).toBeDefined();

      const borrowedUnit = target.units.find((u) => u.status_peminjaman === 'dipinjam')!;
      expect(borrowedUnit.status_peminjaman).toBe('dipinjam');

      // Lakukan edit kondisi pada unit yang sedang dipinjam (misal diubah ke rusak atau bagus)
      const payload: UpdateInventarisDTO = {
        id: target.id,
        nama_alat: target.nama_alat,
        kategori: target.kategori,
        units: [
          {
            id: borrowedUnit.id,
            kode_unit: borrowedUnit.kode_unit,
            kondisi: 'perlu_servis', // ganti kondisi fisik
          },
          ...(target.units.filter((u) => u.id !== borrowedUnit.id).map((u) => ({
            id: u.id,
            kode_unit: u.kode_unit,
            kondisi: u.kondisi,
          }))),
        ],
      };

      const updated = await inventarisService.updateInventaris(payload);
      const updatedUnit = updated.units.find((u) => u.id === borrowedUnit.id);
      expect(updatedUnit?.kondisi).toBe('perlu_servis');
      expect(updatedUnit?.status_peminjaman).toBe('dipinjam'); // TETAP DIPINJAM
    });
  });

  describe('3. Validasi & Integritas Relasi', () => {
    it('3.1 Harus menolak penyimpanan jika nama alat kosong', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items[0];

      await expect(
        inventarisService.updateInventaris({
          id: target.id,
          nama_alat: '   ',
          kategori: target.kategori,
          units: [],
        })
      ).rejects.toThrow(/Nama alat wajib diisi/i);
    });

    it('3.2 Harus menolak penyimpanan jika master ID tidak ditemukan', async () => {
      await expect(
        inventarisService.updateInventaris({
          id: 'non-existent-uuid-123456',
          nama_alat: 'Valid Name',
          kategori: 'Kamera',
          units: [],
        })
      ).rejects.toThrow(/tidak ditemukan/i);
    });

    it('3.3 Unit milik master lain harus ditolak keras (anti-cross-asset mutation)', async () => {
      const items = await inventarisService.getInventarisList();
      expect(items.length).toBeGreaterThanOrEqual(2);
      const masterA = items[0];
      const masterB = items[1];

      // Coba masukkan unit milik master B ke dalam payload master A
      const alienUnit = masterB.units[0];

      await expect(
        inventarisService.updateInventaris({
          id: masterA.id,
          nama_alat: masterA.nama_alat,
          kategori: masterA.kategori,
          units: [
            {
              id: alienUnit.id, // unit milik masterB!
              kode_unit: alienUnit.kode_unit,
              kondisi: 'bagus',
            },
          ],
        })
      ).rejects.toThrow(/bukan merupakan bagian dari alat/i);
    });

    it('3.4 Identitas ID dan kode inventaris master maupun unit tidak dapat diubah (immutable identities)', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items[0];
      const origKode = target.kode;
      const origUnitId = target.units[0].id;
      const origUnitKode = target.units[0].kode_unit;

      const payload: UpdateInventarisDTO = {
        id: target.id,
        kode: 'HACKED-CODE-999', // kode manipulasi
        nama_alat: 'Nama Baru Sah',
        kategori: target.kategori,
        units: [
          {
            id: origUnitId,
            kode_unit: 'HACKED-UNIT-CODE', // kode unit manipulasi
            kondisi: 'bagus',
          },
        ],
      };

      const updated = await inventarisService.updateInventaris(payload);
      expect(updated.id).toBe(target.id);
      expect(updated.kode).toBe(origKode); // Kode master diproteksi tetap INV-001
      expect(updated.units[0].id).toBe(origUnitId);
      expect(updated.units[0].kode_unit).toBe(origUnitKode); // Kode unit diproteksi tetap INV-001-U01
    });
  });

  describe('4. RBAC & Hak Akses Edit', () => {
    it('4.1 Peran Kru tidak memiliki hak inventory.edit dan inventory.units.manage', () => {
      const crewCtx: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(hasCapability(crewCtx, 'inventory.edit')).toBe(false);
      expect(hasCapability(crewCtx, 'inventory.units.manage')).toBe(false);
      expect(hasCapability(crewCtx, 'inventory.create')).toBe(false);
      // Kru hanya dapat melihat katalog
      expect(hasCapability(crewCtx, 'inventory.view')).toBe(true);
    });

    it('4.2 Peran Eksekutif / Admin memiliki hak penuh inventory.edit dan inventory.units.manage', () => {
      const adminCtx: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
      };

      expect(hasCapability(adminCtx, 'inventory.edit')).toBe(true);
      expect(hasCapability(adminCtx, 'inventory.units.manage')).toBe(true);
      expect(hasCapability(adminCtx, 'inventory.create')).toBe(true);
      expect(hasCapability(adminCtx, 'inventory.view')).toBe(true);
    });
  });

  describe('5. Validasi Kelayakan Pinjam Fisik & Penyelarasan Ringkasan Kondisi', () => {
    it('5.1 Unit berkondisi perlu_servis atau rusak tidak boleh dihitung dalam unit_tersedia yang siap pakai', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items.find((i) => i.units.filter((u) => u.status_peminjaman === 'tersedia').length >= 2)!;
      expect(target).toBeDefined();

      // Edit: Unit 1 menjadi perlu_servis, Unit 2 tetap bagus
      const payload: UpdateInventarisDTO = {
        id: target.id,
        nama_alat: target.nama_alat,
        kategori: target.kategori,
        units: [
          {
            id: target.units[0].id,
            kode_unit: target.units[0].kode_unit,
            nama_unit: 'Kamera Utama A',
            nomor_seri: 'SN-KAMERA-A01',
            kondisi: 'perlu_servis',
          },
          {
            id: target.units[1].id,
            kode_unit: target.units[1].kode_unit,
            nama_unit: 'Kamera Cadangan B',
            nomor_seri: 'SN-KAMERA-B02',
            kondisi: 'bagus',
          },
        ],
      };

      const updated = await inventarisService.updateInventaris(payload);

      // Hanya 1 unit (Unit 2) yang siap pakai, meskipun kedua unit belum dipinjam
      expect(updated.unit_tersedia).toBe(1);
      expect(updated.total_unit).toBe(target.units.length);

      // Verifikasi nama_unit dan nomor_seri tersimpan
      expect(updated.units[0].nama_unit).toBe('Kamera Utama A');
      expect(updated.units[0].nomor_seri).toBe('SN-KAMERA-A01');
      expect(updated.units[0].kondisi).toBe('perlu_servis');

      expect(updated.units[1].nama_unit).toBe('Kamera Cadangan B');
      expect(updated.units[1].nomor_seri).toBe('SN-KAMERA-B02');
      expect(updated.units[1].kondisi).toBe('bagus');
    });

    it('5.2 Pembacaan ulang getInventarisById harus mengembalikan nama_unit dan nomor_seri yang tepat', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items[0];

      await inventarisService.updateInventaris({
        id: target.id,
        nama_alat: target.nama_alat,
        kategori: target.kategori,
        units: [
          {
            id: target.units[0].id,
            kode_unit: target.units[0].kode_unit,
            nama_unit: 'Unit Alpha Khusus',
            nomor_seri: 'SN-ALPHA-999',
            kondisi: 'bagus',
          },
        ],
      });

      const reloaded = await inventarisService.getInventarisById(target.id);
      expect(reloaded).not.toBeNull();
      const u0 = reloaded?.units.find((u) => u.id === target.units[0].id);
      expect(u0?.nama_unit).toBe('Unit Alpha Khusus');
      expect(u0?.nomor_seri).toBe('SN-ALPHA-999');
    });

    it('5.3 Unit dengan nomor seri kosong harus dikembalikan tanpa string kosong palsu', async () => {
      const items = await inventarisService.getInventarisList();
      const target = items[0];

      await inventarisService.updateInventaris({
        id: target.id,
        nama_alat: target.nama_alat,
        kategori: target.kategori,
        units: [
          {
            id: target.units[0].id,
            kode_unit: target.units[0].kode_unit,
            nama_unit: 'Unit Tanpa SN',
            nomor_seri: null,
            kondisi: 'bagus',
          },
        ],
      });

      const reloaded = await inventarisService.getInventarisById(target.id);
      const u0 = reloaded?.units.find((u) => u.id === target.units[0].id);
      expect(u0?.nomor_seri).toBeUndefined();
    });
  });
});
