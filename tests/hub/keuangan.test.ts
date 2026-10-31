import { describe, it, expect, beforeEach } from 'vitest';
import {
  keuanganStore,
  fmtRupiah,
  fmtPeriodeBulan,
  fmtPeriodeBulanShort,
  fmtNominalShort,
} from '../../src/products/hub/keuangan/keuanganStore';
import { hasCapability, PermissionContext } from '../../src/core/policy';
import { isOperationalCrew, CrewMember } from '../../src/products/hub/kru/types';

// Setup memory-based localStorage mock for test environment
if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    length: 0,
  };
}

describe('PTV PRO — Hub Keuangan & Kas Modul Unit Tests', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    keuanganStore.resetToFixtures();
  });

  describe('1. RBAC & Privacy Separation', () => {
    const standardCrew: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
    };

    const financeOperator: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: ['finance.operator'],
      denied_overrides: [],
    };

    const executiveUser: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['eksekutif'],
      allowed_overrides: [],
      denied_overrides: [],
    };

    const pembinaUser: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['pembina'],
      allowed_overrides: [],
      denied_overrides: [],
    };

    it('1.1 Standard crew member has finance.view_own but NOT finance.view or finance.manage', () => {
      expect(hasCapability(standardCrew, 'finance.view_own')).toBe(true);
      expect(hasCapability(standardCrew, 'finance.view')).toBe(false);
      expect(hasCapability(standardCrew, 'finance.operator')).toBe(false);
      expect(hasCapability(standardCrew, 'finance.manage')).toBe(false);
    });

    it('1.2 Crew with finance.operator override (PTV-023) can record cash but cannot perform full management', () => {
      expect(hasCapability(financeOperator, 'finance.view_own')).toBe(true);
      expect(hasCapability(financeOperator, 'finance.operator')).toBe(true);
      expect(hasCapability(financeOperator, 'finance.manage')).toBe(false);
    });

    it('1.3 Executive has full finance access (view, view_own, operator, manage)', () => {
      expect(hasCapability(executiveUser, 'finance.view_own')).toBe(true);
      expect(hasCapability(executiveUser, 'finance.view')).toBe(true);
      expect(hasCapability(executiveUser, 'finance.operator')).toBe(true);
      expect(hasCapability(executiveUser, 'finance.manage')).toBe(true);
    });

    it('1.4 Pembina is strictly isolated from all finance capabilities', () => {
      expect(hasCapability(pembinaUser, 'finance.view')).toBe(false);
      expect(hasCapability(pembinaUser, 'finance.view_own')).toBe(false);
      expect(hasCapability(pembinaUser, 'finance.operator')).toBe(false);
      expect(hasCapability(pembinaUser, 'finance.manage')).toBe(false);
    });
  });

  describe('2. Kas Saya (Personal Crew View & Canonical Historical Parity)', () => {
    it('2.1 getMyKasData retrieves only personal payments and billing for Muhammad Farras (PTV-003)', () => {
      const myKas = keuanganStore.getMyKasData('PTV-003', '23f8a9cf-cb4e-4543-8207-7aef92692ead', 'Muhammad Farras Zaidan Mubarok');

      expect(myKas.crew.ptvId).toBe('PTV-003');
      expect(['Rizky Alamsyah', 'Muhammad Farras Zaidan Mubarok']).toContain(myKas.crew.name);

      // Farras paid July (25k), Aug (25k), Sept (20k). Total paid = 70.000
      expect(myKas.totalDibayar).toBe(70000);
      expect(myKas.paidPeriods.length).toBe(3);

      // October is unpaid (20k canonical nominal)
      expect(myKas.totalTunggakan).toBe(20000);
      expect(myKas.unpaidPeriods.length).toBe(1);
      expect(myKas.unpaidPeriods[0].periode_bulan).toBe('2026-10');
      expect(myKas.isLunasSemua).toBe(false);
    });

    it('2.2 getMyKasData does not leak other crew records into personal payload', () => {
      const myKas = keuanganStore.getMyKasData('PTV-003', '23f8a9cf-cb4e-4543-8207-7aef92692ead', 'Muhammad Farras Zaidan Mubarok');

      // Check paidPeriods: only contains Farras' payments
      myKas.paidPeriods.forEach((p) => {
        expect(['2026-07', '2026-08', '2026-09']).toContain(p.periode_bulan);
      });
      // Should not contain PTV-032 (Rex) or PTV-024 (Fathur) October payments
      const containsOtherCrewPayments = myKas.paidPeriods.some(
        (p) => p.periode_bulan === '2026-10'
      );
      expect(containsOtherCrewPayments).toBe(false);
    });

    it('2.3 Displays lunas status correctly when all periods are paid (Rex Ruizhi Gajendra PTV-032)', () => {
      const myKas = keuanganStore.getMyKasData('PTV-032', 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8', 'Rex Ruizhi Gajendra');

      expect(myKas.totalTunggakan).toBe(0);
      expect(myKas.unpaidPeriods.length).toBe(0);
      expect(myKas.isLunasSemua).toBe(true);
      expect(myKas.paidPeriods.length).toBe(4);
      expect(myKas.totalDibayar).toBe(90000); // 25k + 25k + 20k + 20k
    });

    it('2.4 Displays 2 paid periods and 40.000 remaining for Farsya (PTV-023)', () => {
      const myKas = keuanganStore.getMyKasData('PTV-023', '0f97447d-bc24-48e0-948d-e36b1f53049d', 'Farsya Naufal Rahmandika');

      expect(myKas.paidPeriods.length).toBe(2);
      expect(myKas.totalDibayar).toBe(50000); // 25k + 25k
      expect(myKas.unpaidPeriods.length).toBe(2);
      expect(myKas.totalTunggakan).toBe(40000); // 20k + 20k
      expect(myKas.isLunasSemua).toBe(false);
    });
  });

  describe('3. Ledger Engine & Anti Double-Counting Integrity', () => {
    it('3.1 Total pemasukan equals sum of all active pemasukan transactions', () => {
      const summary = keuanganStore.getSummary();
      const activePem = keuanganStore.getAllPemasukan(false);
      const calculatedSum = activePem.reduce((acc, p) => acc + p.nominal, 0);

      expect(summary.totalPemasukan).toBe(calculatedSum);
    });

    it('3.2 Total pengeluaran equals sum of all active pengeluaran transactions', () => {
      const summary = keuanganStore.getSummary();
      const activePen = keuanganStore.getAllPengeluaran(false);
      const calculatedSum = activePen.reduce((acc, p) => acc + p.nominal, 0);

      expect(summary.totalPengeluaran).toBe(calculatedSum);
    });

    it('3.3 Saldo kas strictly equals totalPemasukan - totalPengeluaran', () => {
      const summary = keuanganStore.getSummary();
      expect(summary.saldoKas).toBe(summary.totalPemasukan - summary.totalPengeluaran);
    });

    it('3.4 Marking kas as lunas updates KasKru and adds exactly ONE pemasukan transaction (no double counting)', () => {
      const initialSummary = keuanganStore.getSummary();
      const initialPemCount = keuanganStore.getAllPemasukan(false).length;

      // Farras (PTV-003) pays October 2026 (canonical nominal 20.000)
      keuanganStore.tandaiKasLunas(
        '23f8a9cf-cb4e-4543-8207-7aef92692ead',
        'PTV-003',
        'Muhammad Farras Zaidan Mubarok',
        '2026-10',
        'Farsya Naufal Rahmandika',
        '0f97447d-bc24-48e0-948d-e36b1f53049d',
        'Tunai'
      );

      const afterSummary = keuanganStore.getSummary();
      const afterPemCount = keuanganStore.getAllPemasukan(false).length;

      // Exactly 1 new pemasukan recorded
      expect(afterPemCount).toBe(initialPemCount + 1);

      // Pemasukan increased by 20.000
      expect(afterSummary.totalPemasukan).toBe(initialSummary.totalPemasukan + 20000);

      // Kas Terkumpul increased by 20.000
      expect(afterSummary.totalKasTerkumpul).toBe(initialSummary.totalKasTerkumpul + 20000);

      // Tunggakan decreased by 20.000
      expect(afterSummary.totalTunggakanKas).toBe(initialSummary.totalTunggakanKas - 20000);

      // Saldo increased by 20.000
      expect(afterSummary.saldoKas).toBe(initialSummary.saldoKas + 20000);
    });

    it('3.5 Undoing a kas payment sets KasKru to Belum Lunas and voids the pemasukan ledger transaction', () => {
      // First pay October
      keuanganStore.tandaiKasLunas(
        '23f8a9cf-cb4e-4543-8207-7aef92692ead',
        'PTV-003',
        'Muhammad Farras Zaidan Mubarok',
        '2026-10',
        'Farsya Naufal Rahmandika',
        '0f97447d-bc24-48e0-948d-e36b1f53049d',
        'Tunai'
      );

      const paidSummary = keuanganStore.getSummary();

      // Now undo
      keuanganStore.undoKasLunas('23f8a9cf-cb4e-4543-8207-7aef92692ead', 'PTV-003', '2026-10');

      const undoneSummary = keuanganStore.getSummary();

      // Pemasukan reverted
      expect(undoneSummary.totalPemasukan).toBe(paidSummary.totalPemasukan - 20000);
      expect(undoneSummary.saldoKas).toBe(paidSummary.saldoKas - 20000);
      expect(undoneSummary.totalTunggakanKas).toBe(paidSummary.totalTunggakanKas + 20000);

      const status = keuanganStore.getKruPaymentStatus('23f8a9cf-cb4e-4543-8207-7aef92692ead', 'PTV-003', 'Muhammad Farras Zaidan Mubarok', '2026-10');
      expect(status.isPaid).toBe(false);
      expect(status.sisa).toBe(20000);
    });
  });

  describe('4. Pemasukan and Pengeluaran CRUD Operations', () => {
    it('4.1 tambahPemasukan records new transaction and increases balance', () => {
      const initialSummary = keuanganStore.getSummary();

      const newRecord = keuanganStore.tambahPemasukan(
        {
          tanggal: '2026-10-17',
          sumber: 'Donasi Pembina Studio',
          kategori: 'Donasi',
          nominal: 1000000,
          keterangan: 'Infaq pengadaan aksesoris audio',
        },
        'Ahmad Fauzi'
      );

      expect(newRecord.id).toBeDefined();
      expect(newRecord.status).toBe('posted');

      const afterSummary = keuanganStore.getSummary();
      expect(afterSummary.totalPemasukan).toBe(initialSummary.totalPemasukan + 1000000);
      expect(afterSummary.saldoKas).toBe(initialSummary.saldoKas + 1000000);
    });

    it('4.2 tambahPengeluaran records new transaction and reduces balance', () => {
      const initialSummary = keuanganStore.getSummary();

      const newRecord = keuanganStore.tambahPengeluaran(
        {
          tanggal: '2026-10-17',
          keperluan: 'Beli Lakban Gaffer & Kabel Ties',
          kategori: 'Operasional',
          nominal: 85000,
          keterangan: 'Perlengkapan pengaman kabel liputan',
        },
        'Farsya Naufal Rahmandika'
      );

      expect(newRecord.id).toBeDefined();
      expect(newRecord.status).toBe('posted');

      const afterSummary = keuanganStore.getSummary();
      expect(afterSummary.totalPengeluaran).toBe(initialSummary.totalPengeluaran + 85000);
      expect(afterSummary.saldoKas).toBe(initialSummary.saldoKas - 85000);
    });

    it('4.3 voidPengeluaran removes expense from active ledger without deleting history', () => {
      const initialSummary = keuanganStore.getSummary();

      const item = keuanganStore.tambahPengeluaran(
        {
          tanggal: '2026-10-17',
          keperluan: 'Salah catat biaya transport',
          kategori: 'Transportasi',
          nominal: 200000,
          keterangan: 'Akan dibatalkan',
        },
        'Admin'
      );

      const intermediateSummary = keuanganStore.getSummary();
      expect(intermediateSummary.totalPengeluaran).toBe(initialSummary.totalPengeluaran + 200000);

      // Void it
      keuanganStore.voidPengeluaran(item.id);

      const finalSummary = keuanganStore.getSummary();
      expect(finalSummary.totalPengeluaran).toBe(initialSummary.totalPengeluaran);
      expect(finalSummary.saldoKas).toBe(initialSummary.saldoKas);

      const allPen = keuanganStore.getAllPengeluaran(true);
      const voided = allPen.find((p) => p.id === item.id);
      expect(voided?.status).toBe('void');
    });

    it('4.4 updatePemasukan updates nominal and correctly recalculates total balance', () => {
      const item = keuanganStore.tambahPemasukan(
        {
          tanggal: '2026-10-17',
          sumber: 'Honor Liputan Khusus',
          kategori: 'Jasa Liputan',
          nominal: 500000,
          keterangan: 'Draft honor',
        },
        'Admin'
      );

      const midSummary = keuanganStore.getSummary();

      keuanganStore.updatePemasukan(item.id, {
        tanggal: '2026-10-17',
        sumber: 'Honor Liputan Khusus (Final)',
        kategori: 'Jasa Liputan',
        nominal: 650000,
        keterangan: 'Honor liputan revisi final',
      });

      const finalSummary = keuanganStore.getSummary();
      expect(finalSummary.totalPemasukan).toBe(midSummary.totalPemasukan + 150000);
      expect(finalSummary.saldoKas).toBe(midSummary.saldoKas + 150000);
    });
  });

  describe('5. Formatting & Presentation Helpers', () => {
    it('5.1 fmtRupiah formats standard and zero numbers correctly in Indonesian locale', () => {
      expect(fmtRupiah(25000)).toBe('Rp 25.000');
      expect(fmtRupiah(1500000)).toBe('Rp 1.500.000');
      expect(fmtRupiah(0)).toBe('Rp 0');
      expect(fmtRupiah(null)).toBe('Rp 0');
    });

    it('5.2 fmtPeriodeBulan outputs full Indonesian month and year', () => {
      expect(fmtPeriodeBulan('2026-07')).toBe('Juli 2026');
      expect(fmtPeriodeBulan('2026-10')).toBe('Oktober 2026');
      expect(fmtPeriodeBulan('2026-12')).toBe('Desember 2026');
    });

    it('5.3 fmtPeriodeBulanShort outputs short month name', () => {
      expect(fmtPeriodeBulanShort('2026-07')).toBe('Jul');
      expect(fmtPeriodeBulanShort('2026-08')).toBe('Agu');
      expect(fmtPeriodeBulanShort('2026-10')).toBe('Okt');
    });

    it('5.4 fmtNominalShort compresses numbers concisely for table headers', () => {
      expect(fmtNominalShort(25000)).toBe('25k');
      expect(fmtNominalShort(20000)).toBe('20k');
      expect(fmtNominalShort(1500000)).toBe('1.5 jt');
    });
  });

  describe('6. PHP Legacy Parity & Pembina/Pengarah Exclusion Regression Tests', () => {
    it('6.1 isOperationalCrew excludes Pembina regardless of active status', () => {
      const pembina1: Partial<CrewMember> = {
        ptv_id: 'PTV-005',
        full_name: 'M. Gading Priangga',
        category: 'Pembina',
        division: 'Pembina',
        position: 'Pembina PTV',
        role: 'kru',
        status_kru: 'Aktif',
      };
      expect(isOperationalCrew(pembina1 as CrewMember)).toBe(false);

      const pembina2: Partial<CrewMember> = {
        ptv_id: 'PTV-011',
        full_name: 'Indah Nur Laeli S.IP.',
        category: 'Pembina',
        division: 'Pembina',
        position: 'Pembina PTV',
        role: 'kru',
        status_kru: 'Aktif',
      };
      expect(isOperationalCrew(pembina2 as CrewMember)).toBe(false);
    });

    it('6.2 isOperationalCrew excludes Pengarah, Pendiri, Pengasuh, and Direktur Yayasan', () => {
      const pengarahAbuya: Partial<CrewMember> = {
        ptv_id: 'PTV-012',
        full_name: 'Abuya KH. Agoes Ali Masyhuri',
        category: 'Pengarah',
        division: 'Pengarah',
        position: 'Pendiri dan Pengasuh',
        role: 'eksekutif',
        status_kru: 'Aktif',
      };
      expect(isOperationalCrew(pengarahAbuya as CrewMember)).toBe(false);

      const pengarahGusRobith: Partial<CrewMember> = {
        ptv_id: 'PTV-014',
        full_name: 'Agus Dr. H. M. Robith Fuad Lc.',
        category: 'Pengarah',
        division: 'Pengarah',
        position: 'Presdir PT. Progresif Digital Media',
        role: 'kru',
        status_kru: 'Aktif',
      };
      expect(isOperationalCrew(pengarahGusRobith as CrewMember)).toBe(false);
    });

    it('6.3 isOperationalCrew includes active operational crew members', () => {
      const activeCrew: Partial<CrewMember> = {
        ptv_id: 'PTV-003',
        full_name: 'Muhammad Farras Zaidan Mubarok',
        category: 'Kru',
        division: 'Editor',
        position: 'Ketua',
        role: 'eksekutif',
        status_kru: 'Aktif',
      };
      expect(isOperationalCrew(activeCrew as CrewMember)).toBe(true);
    });

    it('6.4 Canonical active periods follow Production: 25k (Jul), 25k (Aug), 20k (Sep), 20k (Oct) = Total 90k', () => {
      const periods = keuanganStore.getPeriodeList();
      expect(periods.length).toBe(4);
      expect(periods[0].periode_bulan).toBe('2026-07');
      expect(periods[0].nominal).toBe(25000);
      expect(periods[1].periode_bulan).toBe('2026-08');
      expect(periods[1].nominal).toBe(25000);
      expect(periods[2].periode_bulan).toBe('2026-09');
      expect(periods[2].nominal).toBe(20000);
      expect(periods[3].periode_bulan).toBe('2026-10');
      expect(periods[3].nominal).toBe(20000);

      const totalPeriodsNominal = periods.reduce((sum, p) => sum + p.nominal, 0);
      expect(totalPeriodsNominal).toBe(90000); // 25k + 25k + 20k + 20k, not 95.000!
    });

    it('6.5 Unpaid crew gets total arrears of Rp90.000 (not fabricated Rp95.000)', () => {
      // Zidnal Falah (PTV-001) has not paid yet
      const unpaidKas = keuanganStore.getMyKasData('PTV-001', '8fb1aa38-c469-4dc5-9392-8588f7a71e39', 'Muhammad Zidnal Falah');
      expect(unpaidKas.totalDibayar).toBe(0);
      expect(unpaidKas.totalTunggakan).toBe(90000); // Canonical total
      expect(unpaidKas.unpaidPeriods.length).toBe(4);
    });

    it('6.6 Overall summary matches Production truth values', () => {
      const summary = keuanganStore.getSummary();
      expect(summary.totalKasTerkumpul).toBe(810000);
      expect(summary.totalPemasukan).toBe(1104200);
      expect(summary.totalPengeluaran).toBe(605924);
      expect(summary.saldoKas).toBe(498276);
    });
  });
});
