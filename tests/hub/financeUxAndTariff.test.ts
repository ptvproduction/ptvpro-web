import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateKasKruMatrix,
  getSemesterPeriodFeeMinor,
  updateSemesterMonthlyFee,
  recordKasKruPayment,
  reverseKasKruInstallment,
  waiveKasKruFee,
} from '../../src/products/hub/keuangan/kasKruService';
import {
  isSystemCategory,
  editCanonicalCategory,
  archiveCanonicalCategory,
  restoreCanonicalCategory,
} from '../../src/products/hub/keuangan/financeSettingsService';
import type { FinanceSemester, KasKruRecord } from '../../src/products/hub/keuangan/kasKruTypes';
import type { CanonicalCategory, FinancePocket } from '../../src/products/hub/keuangan/financeCanonical';
import { CANONICAL_STAGING_CREW_FIXTURES } from '../../src/products/hub/kru/canonicalCrewData';

describe('PTV-DEV-130 — Finance 2.0 UX, Tariff & Database Hardening', () => {
  const baseSemester: FinanceSemester = {
    id: 'sem-2026-test',
    name: 'Semester Test 2026',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    monthlyFeeMinor: '2500000', // Default 25k
    monthlyFees: {
      '2026-09': '2500000', // Sep: 25k
      '2026-10': '3000000', // Oct: 30k
      '2026-11': '2000000', // Nov: 20k
      '2026-12': '3500000', // Dec: 35k
    },
    isActive: true,
    isArchived: false,
    createdAt: '2026-09-01T00:00:00Z',
  };

  const testPocket: FinancePocket = {
    id: 'b5f00000-0000-0000-0000-000000000001',
    name: 'Kas Utama Studio',
    kind: 'bank',
    provider: 'BCA',
    accountNumber: '1234567890',
    accountHolder: 'Studio PTV',
    archived: false,
    version: 1,
    balanceMinor: '5000000',
    qris: null,
  };

  const testCategories: CanonicalCategory[] = [
    { id: 'cat-sys-1', name: 'Iuran Kas Kru', kind: 'income', isActive: true },
    { id: 'cat-sys-2', name: 'Pencairan Piutang', kind: 'expense', isActive: true },
    { id: 'cat-custom-1', name: 'Konsumsi Event', kind: 'expense', isActive: true },
  ];

  describe('E. Kas Kru — Tarif Berbeda Setiap Bulan & Perubahan Tarif Dinamis', () => {
    it('mengambil tarif spesifik untuk setiap bulan mandiri', () => {
      expect(getSemesterPeriodFeeMinor(baseSemester, '2026-09')).toBe('2500000');
      expect(getSemesterPeriodFeeMinor(baseSemester, '2026-10')).toBe('3000000');
      expect(getSemesterPeriodFeeMinor(baseSemester, '2026-11')).toBe('2000000');
      expect(getSemesterPeriodFeeMinor(baseSemester, '2026-12')).toBe('3500000');
      // Fallback ke monthlyFeeMinor jika belum diatur
      expect(getSemesterPeriodFeeMinor(baseSemester, '2027-01')).toBe('2500000');
    });

    it('mendukung update tarif bulanan mandiri secara persisten', () => {
      const updatedList = updateSemesterMonthlyFee(baseSemester.id, '2026-10', '3500000', [baseSemester]);
      const sem = updatedList.find(s => s.id === baseSemester.id)!;
      expect(sem.monthlyFees?.['2026-10']).toBe('3500000');
    });

    it('RULE LOCKED: jika iuran Oktober naik dari 30k ke 35k setelah dibayar 30k, status menjadi sebagian dan sisa 5k', () => {
      const firstCrew = CANONICAL_STAGING_CREW_FIXTURES[0];
      const initialRecord: KasKruRecord = {
        id: 'rec-oct-1',
        semesterId: baseSemester.id,
        ptvId: firstCrew.ptv_id,
        crewName: firstCrew.full_name,
        period: '2026-10',
        amountMinor: '3000000',
        paidAmountMinor: '3000000',
        status: 'lunas',
        paymentDate: '2026-10-05',
        method: 'cash',
        pocketId: testPocket.id,
        transactionId: null,
        createdAt: '2026-10-05T00:00:00Z',
        updatedAt: '2026-10-05T00:00:00Z',
      };

      // Matriks sebelum kenaikan: lunas
      const matrixBefore = calculateKasKruMatrix(baseSemester, [firstCrew], [initialRecord]);
      const cellBefore = matrixBefore.rows[0].periods['2026-10'];
      expect(cellBefore.status).toBe('lunas');
      expect(cellBefore.paidAmountMinor).toBe('3000000');
      expect(cellBefore.shortageMinor).toBe('0');

      // 2. Tarif Oktober dinaikkan menjadi 35k
      const raisedSemester: FinanceSemester = {
        ...baseSemester,
        monthlyFees: {
          ...baseSemester.monthlyFees,
          '2026-10': '3500000',
        },
      };

      // 3. Evaluasi matriks setelah kenaikan
      const matrixAfter = calculateKasKruMatrix(raisedSemester, [firstCrew], [initialRecord]);
      const cellAfter = matrixAfter.rows[0].periods['2026-10'];

      // Pembayaran 30k tetap sah
      expect(cellAfter.paidAmountMinor).toBe('3000000');
      // Total kewajiban berubah menjadi 35k
      expect(cellAfter.amountMinor).toBe('3500000');
      // Status menjadi sebagian / belum lunas
      expect(cellAfter.status).toBe('sebagian');
      // Sisa tanggungan menjadi 5.000 (500000 minor)
      expect(cellAfter.shortageMinor).toBe('500000');
    });

    it('RULE LOCKED: jika tarif diturunkan di bawah jumlah yang sudah dibayar, overpayment terdeteksi tanpa saldo negatif', () => {
      const firstCrew = CANONICAL_STAGING_CREW_FIXTURES[0];
      const initialRecord: KasKruRecord = {
        id: 'rec-oct-2',
        semesterId: baseSemester.id,
        ptvId: firstCrew.ptv_id,
        crewName: firstCrew.full_name,
        period: '2026-10',
        amountMinor: '3000000',
        paidAmountMinor: '3000000',
        status: 'lunas',
        paymentDate: '2026-10-05',
        method: 'cash',
        pocketId: testPocket.id,
        transactionId: null,
        createdAt: '2026-10-05T00:00:00Z',
        updatedAt: '2026-10-05T00:00:00Z',
      };

      // Tarif diturunkan ke 20k
      const loweredSemester: FinanceSemester = {
        ...baseSemester,
        monthlyFees: {
          ...baseSemester.monthlyFees,
          '2026-10': '2000000',
        },
      };

      const matrix = calculateKasKruMatrix(loweredSemester, [firstCrew], [initialRecord]);
      const cell = matrix.rows[0].periods['2026-10'];

      expect(cell.status).toBe('lunas');
      expect(cell.amountMinor).toBe('2000000');
      expect(cell.paidAmountMinor).toBe('3000000');
      expect(cell.shortageMinor).toBe('0');
      expect(cell.overpaidMinor).toBe('1000000'); // Kelebihan bayar 10k
    });

    it('kru yang baru bergabung hanya ditagih mulai bulan saat bergabung', () => {
      const crewWithJoinDate = {
        ...CANONICAL_STAGING_CREW_FIXTURES[0],
        join_date: '2026-11-01',
      };
      const matrix = calculateKasKruMatrix(baseSemester, [crewWithJoinDate], []);
      const sitiRow = matrix.rows[0];

      // September & Oktober sebelum join date: tidak ditagih
      expect(sitiRow.periods['2026-09'].unbilled).toBe(true);
      expect(sitiRow.periods['2026-10'].unbilled).toBe(true);

      // November & Desember: ditagih normal
      expect(sitiRow.periods['2026-11'].unbilled).toBe(false);
      expect(sitiRow.periods['2026-12'].unbilled).toBe(false);
    });
  });

  describe('G2 & G1. Multi-Cicilan Kas Kru & Reversal Non-Destruktif', () => {
    it('mencatat multi-cicilan secara terpisah dan menghitung status akumulasi', async () => {
      const firstCrew = CANONICAL_STAGING_CREW_FIXTURES[0];

      // Pembayaran cicilan 1: 15k
      const res1 = await recordKasKruPayment(
        {
          semesterId: baseSemester.id,
          ptvId: firstCrew.ptv_id,
          crewName: firstCrew.full_name,
          selectedPeriods: ['2026-10'],
          pocketId: testPocket.id,
          method: 'cash',
          amountMinor: '1500000', // 15k
          notes: 'Cicilan 1',
          paymentDate: '2026-10-02',
        },
        {
          pockets: [testPocket],
          categories: testCategories,
          canManage: false,
          existingRecords: [],
          semesters: [baseSemester],
        }
      );

      const recordAfter1 = res1.records[0];
      expect(recordAfter1.status).toBe('sebagian');
      expect(recordAfter1.paidAmountMinor).toBe('1500000');
      expect(recordAfter1.payments?.length).toBe(1);

      // Pembayaran cicilan 2: 15k (sehingga total 30k = lunas)
      const res2 = await recordKasKruPayment(
        {
          semesterId: baseSemester.id,
          ptvId: firstCrew.ptv_id,
          crewName: firstCrew.full_name,
          selectedPeriods: ['2026-10'],
          pocketId: testPocket.id,
          method: 'cash',
          amountMinor: '1500000', // 15k lagi
          notes: 'Cicilan 2 Pelunasan',
          paymentDate: '2026-10-15',
        },
        {
          pockets: [testPocket],
          categories: testCategories,
          canManage: false,
          existingRecords: res1.records,
          semesters: [baseSemester],
        }
      );

      const recordAfter2 = res2.records[0];
      expect(recordAfter2.status).toBe('lunas');
      expect(recordAfter2.paidAmountMinor).toBe('3000000');
      expect(recordAfter2.payments?.length).toBe(2);
    });

    it('membalikkan satu cicilan spesifik tanpa menghapus histori cicilan lainnya', () => {
      const firstCrew = CANONICAL_STAGING_CREW_FIXTURES[0];
      // Siapkan record dengan 2 cicilan
      const recordWith2Payments: KasKruRecord = {
        id: 'rec-multi',
        semesterId: baseSemester.id,
        ptvId: firstCrew.ptv_id,
        crewName: firstCrew.full_name,
        period: '2026-10',
        amountMinor: '3000000',
        paidAmountMinor: '3000000',
        status: 'lunas',
        paymentDate: '2026-10-10',
        method: 'cash',
        pocketId: testPocket.id,
        transactionId: null,
        payments: [
          {
            id: 'pay-1',
            transactionId: 'tx-1',
            amountMinor: '2000000',
            paymentDate: '2026-10-02',
            method: 'cash',
            recordedBy: 'Admin',
            status: 'posted',
            createdAt: '2026-10-02T00:00:00Z',
            pocketId: testPocket.id,
          },
          {
            id: 'pay-2',
            transactionId: 'tx-2',
            amountMinor: '1000000',
            paymentDate: '2026-10-10',
            method: 'cash',
            recordedBy: 'Admin',
            status: 'posted',
            createdAt: '2026-10-10T00:00:00Z',
            pocketId: testPocket.id,
          },
        ],
        createdAt: '2026-10-02T00:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z',
      };

      // Batalkan cicilan kedua (pay-2)
      const res = reverseKasKruInstallment('rec-multi', 'pay-2', 'Salah input nominal', [recordWith2Payments]);
      const updated = res.record;

      expect(updated.payments?.length).toBe(2);
      expect(updated.payments?.find(p => p.id === 'pay-2')?.status).toBe('reversed');
      expect(updated.payments?.find(p => p.id === 'pay-1')?.status).toBe('posted');

      // Total bayar menjadi hanya 20k, status turun ke sebagian
      expect(updated.paidAmountMinor).toBe('2000000');
      expect(updated.status).toBe('sebagian');
    });

    it('mempertahankan pembebasan iuran (fee waiver) persisten tanpa terpengaruh perubahan tarif', () => {
      const firstCrew = CANONICAL_STAGING_CREW_FIXTURES[0];
      const paidPriorRecords: KasKruRecord[] = [
        {
          id: 'rec-09',
          semesterId: baseSemester.id,
          ptvId: firstCrew.ptv_id,
          crewName: firstCrew.full_name,
          period: '2026-09',
          amountMinor: '2500000',
          paidAmountMinor: '2500000',
          status: 'lunas',
          paymentDate: '2026-09-05',
          method: 'cash',
          pocketId: testPocket.id,
          transactionId: null,
          createdAt: '2026-09-05T00:00:00Z',
          updatedAt: '2026-09-05T00:00:00Z',
        },
        {
          id: 'rec-10',
          semesterId: baseSemester.id,
          ptvId: firstCrew.ptv_id,
          crewName: firstCrew.full_name,
          period: '2026-10',
          amountMinor: '3000000',
          paidAmountMinor: '3000000',
          status: 'lunas',
          paymentDate: '2026-10-05',
          method: 'cash',
          pocketId: testPocket.id,
          transactionId: null,
          createdAt: '2026-10-05T00:00:00Z',
          updatedAt: '2026-10-05T00:00:00Z',
        },
      ];

      const waived = waiveKasKruFee(
        {
          semesterId: baseSemester.id,
          ptvId: firstCrew.ptv_id,
          crewName: firstCrew.full_name,
          period: '2026-11',
          reason: 'Dispensasi sakit',
        },
        paidPriorRecords
      );

      const matrix = calculateKasKruMatrix(baseSemester, [firstCrew], waived.updatedList);
      const cell = matrix.rows[0].periods['2026-11'];

      expect(cell.status).toBe('dikecualikan');
      expect(cell.shortageMinor).toBe('0');
      expect(matrix.rows[0].arrearsMinor).toBe('0');
    });
  });

  describe('C. Manajemen Kategori Canonical & Proteksi Sistem', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })));
    afterEach(() => vi.unstubAllGlobals());
    it('mengidentifikasi kategori sistem yang dilindungi', () => {
      expect(isSystemCategory('Iuran Kas Kru')).toBe(true);
      expect(isSystemCategory('Pencairan Piutang')).toBe(true);
      expect(isSystemCategory('Konsumsi Event')).toBe(false);
    });

    it('melarang pengubahan atau pengarsipan kategori sistem', async () => {
      await expect(editCanonicalCategory('cat-sys-1', 'Ubah Nama', testCategories)).rejects.toThrow(
        /kategori sistem .* dilindungi/i
      );
      await expect(archiveCanonicalCategory('cat-sys-1', testCategories)).rejects.toThrow(
        /kategori sistem .* dilindungi/i
      );
    });

    it('mengubah nama kategori kustom dan mempertahankan id', async () => {
      const updated = await editCanonicalCategory('cat-custom-1', 'Konsumsi Studio & Event', testCategories);
      expect(updated.find(c => c.id === 'cat-custom-1')?.name).toBe('Konsumsi Studio & Event');
    });

    it('mengarsipkan dan memulihkan kategori kustom', async () => {
      const archived = await archiveCanonicalCategory('cat-custom-1', testCategories);
      expect(archived.find(c => c.id === 'cat-custom-1')?.isActive).toBe(false);

      const restored = await restoreCanonicalCategory('cat-custom-1', archived);
      expect(restored.find(c => c.id === 'cat-custom-1')?.isActive).toBe(true);
    });
  });
});
