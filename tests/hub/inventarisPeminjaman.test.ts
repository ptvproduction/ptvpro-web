import { describe, it, expect, beforeEach } from 'vitest';
import { inventarisService } from '../../src/products/hub/inventaris/inventarisService';
import { peminjamanService } from '../../src/products/hub/peminjaman/peminjamanService';
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
