import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  calculateLoanStatus,
  calculatePiutangStats,
  createPiutang,
  recordLoanRepayment,
  cancelPiutang,
} from '../../src/products/hub/keuangan/piutangService';
import { FinancePiutangView } from '../../src/products/hub/keuangan/FinancePiutangView';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { PiutangRecord } from '../../src/products/hub/keuangan/piutangTypes';

const mockSnapshot: FinanceSnapshot = {
  source: 'staging',
  canManage: true,
  scope: 'global',
  counts: { income: 39, expense: 10, ledger: 0 },
  entries: [],
  kas: [],
  limited: false,
  writesEnabled: true,
  canonical: {
    state: 'available',
    pockets: [
      {
        id: '60e8d033-2794-4219-a960-c56bedca0111',
        name: 'Kas Utama Studio',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
        archived: false,
        version: 50,
        balanceMinor: '52027600', // Rp 520.276
        qris: null,
      },
    ],
    categories: [
      { id: '33333333-3333-4333-8333-333333333333', name: 'Operasional Studio', kind: 'expense', isActive: true },
      { id: '44444444-4444-4444-8444-444444444444', name: 'Kas Masuk / Operasional', kind: 'income', isActive: true },
    ],
    transactions: [],
  },
};

describe('Finance 2.0: Piutang Service & Business Rules', () => {
  it('1. calculateLoanStatus: mendeteksi status aktif, overdue, lunas, dan pembatalan secara akurat', () => {
    // Lunas
    expect(
      calculateLoanStatus({
        dueDate: '2026-10-01',
        remainingMinor: '0',
        status: 'aktif',
      })
    ).toBe('lunas');

    // Overdue (jatuh tempo di masa lalu & sisa > 0)
    expect(
      calculateLoanStatus({
        dueDate: '2020-01-01',
        remainingMinor: '10000000',
        status: 'aktif',
      })
    ).toBe('overdue');

    // Aktif (jatuh tempo masa depan)
    expect(
      calculateLoanStatus({
        dueDate: '2030-01-01',
        remainingMinor: '10000000',
        status: 'aktif',
      })
    ).toBe('aktif');

    // Dibatalkan
    expect(
      calculateLoanStatus({
        dueDate: '2020-01-01',
        remainingMinor: '10000000',
        status: 'dibatalkan',
      })
    ).toBe('dibatalkan');

    // Piutang Stats Calculation
    const stats = calculatePiutangStats([
      {
        id: '1',
        principalMinor: '10000000',
        totalPaidMinor: '4000000',
        remainingMinor: '6000000',
        status: 'aktif',
        dueDate: '2030-01-01',
      } as any,
    ]);
    expect(stats.totalPrincipalMinor).toBe('10000000');
    expect(stats.totalCollectedMinor).toBe('4000000');
    expect(stats.totalRemainingMinor).toBe('6000000');
    expect(stats.activeLoansCount).toBe(1);
  });

  it('2. createPiutang: memvalidasi kecukupan saldo kantong (anti-overdraft) dan mencatat transaksi pengeluaran canonical', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        transaction: { id: 'tx-disburse-101' },
      }),
    } as any);

    // Overdraft attempt (Saldo kas: Rp 520.276; coba pinjam Rp 1.000.000)
    await expect(
      createPiutang(
        {
          borrowerType: 'kru',
          borrowerId: 'PTV-001',
          borrowerName: 'Muhammad Zidnal Falah',
          borrowerContact: '08123456789',
          principalMinor: '100000000', // Rp 1.000.000
          disbursedOn: '2026-10-23',
          disbursedFromPocketId: mockSnapshot.canonical.pockets![0].id,
          purpose: 'Dana darurat produksi',
        },
        {
          pockets: mockSnapshot.canonical.pockets!,
          categories: mockSnapshot.canonical.categories!,
          canManage: true,
          existingLoans: [],
        }
      )
    ).rejects.toThrow(/tidak mencukupi/i);

    // Valid loan creation within balance (Rp 200.000)
    const res = await createPiutang(
      {
        borrowerType: 'kru',
        borrowerId: 'PTV-001',
        borrowerName: 'Muhammad Zidnal Falah',
        borrowerContact: '08123456789',
        principalMinor: '20000000', // Rp 200.000
        disbursedOn: '2026-10-23',
        dueDate: '2026-11-23',
        disbursedFromPocketId: mockSnapshot.canonical.pockets![0].id,
        purpose: 'Dana darurat produksi',
      },
      {
        pockets: mockSnapshot.canonical.pockets!,
        categories: mockSnapshot.canonical.categories!,
        canManage: true,
        existingLoans: [],
      }
    );

    expect(res.success).toBe(true);
    expect(res.loan.borrowerName).toBe('Muhammad Zidnal Falah');
    expect(res.loan.principalMinor).toBe('20000000');
    expect(res.loan.totalDueMinor).toBe('20000000');
    expect(res.loan.remainingMinor).toBe('20000000');
    expect(res.loan.status).toBe('aktif');
  });

  it('3. recordLoanRepayment: memvalidasi anti-overpayment dan mencatat pemasukan canonical', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        transaction: { id: 'tx-repay-101' },
      }),
    } as any);

    const existingLoan: PiutangRecord = {
      id: 'loan-test-1',
      borrowerType: 'eksternal',
      borrowerId: null,
      borrowerName: 'CV Media Jaya',
      borrowerContact: '0811111111',
      borrowerInstitution: 'CV Media Jaya',
      principalMinor: '10000000', // Rp 100.000
      interestType: 'none',
      interestRatePercent: 0,
      interestMinor: '0',
      totalDueMinor: '10000000',
      totalPaidMinor: '0',
      remainingMinor: '10000000',
      disbursedOn: '2026-10-01',
      dueDate: '2026-11-01',
      disbursedFromPocketId: mockSnapshot.canonical.pockets![0].id,
      disbursementTxId: 'tx-disb-1',
      status: 'aktif',
      purpose: 'Talangan transport',
      payments: [],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    // Attempt overpayment (Rp 150.000 on Rp 100.000 remaining)
    await expect(
      recordLoanRepayment(
        {
          loanId: existingLoan.id,
          amountMinor: '15000000',
          paidOn: '2026-10-23',
          toPocketId: mockSnapshot.canonical.pockets![0].id,
          method: 'cash',
        },
        {
          pockets: mockSnapshot.canonical.pockets!,
          categories: mockSnapshot.canonical.categories!,
          canManage: true,
          existingLoans: [existingLoan],
        }
      )
    ).rejects.toThrow(/melebihi sisa tagihan/i);

    // Valid partial repayment (Rp 40.000)
    const partialRes = await recordLoanRepayment(
      {
        loanId: existingLoan.id,
        amountMinor: '4000000',
        paidOn: '2026-10-23',
        toPocketId: mockSnapshot.canonical.pockets![0].id,
        method: 'cash',
      },
      {
        pockets: mockSnapshot.canonical.pockets!,
        categories: mockSnapshot.canonical.categories!,
        canManage: true,
        existingLoans: [existingLoan],
      }
    );

    expect(partialRes.loan.totalPaidMinor).toBe('4000000');
    expect(partialRes.loan.remainingMinor).toBe('6000000');
    expect(partialRes.loan.status).toBe('aktif');

    // Full repayment (Remaining Rp 60.000)
    const fullRes = await recordLoanRepayment(
      {
        loanId: existingLoan.id,
        amountMinor: '6000000',
        paidOn: '2026-10-23',
        toPocketId: mockSnapshot.canonical.pockets![0].id,
        method: 'cash',
      },
      {
        pockets: mockSnapshot.canonical.pockets!,
        categories: mockSnapshot.canonical.categories!,
        canManage: true,
        existingLoans: [partialRes.loan],
      }
    );

    expect(fullRes.loan.totalPaidMinor).toBe('10000000');
    expect(fullRes.loan.remainingMinor).toBe('0');
    expect(fullRes.loan.status).toBe('lunas');
  });

  it('4. cancelPiutang: menolak pembatalan jika sudah ada riwayat cicilan', () => {
    const loanWithPayment: PiutangRecord = {
      id: 'loan-with-pay',
      borrowerType: 'kru',
      borrowerId: 'PTV-002',
      borrowerName: 'Rafa Putra',
      borrowerContact: '081234567',
      principalMinor: '5000000',
      interestType: 'none',
      interestRatePercent: 0,
      interestMinor: '0',
      totalDueMinor: '5000000',
      totalPaidMinor: '2000000',
      remainingMinor: '3000000',
      disbursedOn: '2026-10-01',
      dueDate: null,
      disbursedFromPocketId: 'p1',
      disbursementTxId: 'tx-1',
      status: 'aktif',
      purpose: 'Operasional',
      payments: [
        {
          id: 'pay-1',
          loanId: 'loan-with-pay',
          paidOn: '2026-10-15',
          amountMinor: '2000000',
          toPocketId: 'p1',
          receiptTxId: 'tx-2',
          method: 'cash',
          createdAt: '2026-10-15T00:00:00Z',
        },
      ],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-15T00:00:00Z',
    };

    expect(() =>
      cancelPiutang('loan-with-pay', 'Batal saja', [loanWithPayment])
    ).toThrow(/sudah memiliki riwayat pembayaran/i);
  });

  it('6. Flat Interest Calculation: menghitung bunga 0%, bunga flat 5%, angka pecahan 2.5%, cicilan, dan menolak overpayment', async () => {
    // 6a. Tanpa Bunga (0%)
    const noInterestLoan = await createPiutang(
      {
        borrowerType: 'kru',
        borrowerName: 'Farsya',
        borrowerContact: '0812345678',
        principalMinor: '10000000', // Rp 100.000
        interestType: 'none',
        interestRatePercent: 0,
        disbursedOn: '2026-10-23',
        disbursedFromPocketId: mockSnapshot.canonical.pockets![0].id,
        purpose: 'Beli kabel',
      },
      {
        pockets: mockSnapshot.canonical.pockets!,
        categories: mockSnapshot.canonical.categories!,
        canManage: false,
        existingLoans: [],
      }
    );
    expect(noInterestLoan.loan.interestType).toBe('none');
    expect(noInterestLoan.loan.interestMinor).toBe('0');
    expect(noInterestLoan.loan.totalDueMinor).toBe('10000000');
    expect(noInterestLoan.loan.remainingMinor).toBe('10000000');

    // 6b. Bunga Flat 5% atas Pokok Rp 1.000.000
    // Pokok: Rp 1.000.000 (100.000.000 minor)
    // Bunga 5%: Rp 50.000 (5.000.000 minor)
    // Total Tagihan: Rp 1.050.000 (105.000.000 minor)
    const richPocket = [
      {
        ...mockSnapshot.canonical.pockets![0],
        balanceMinor: '500000000', // Rp 5.000.000
      },
    ];

    const flatLoan = await createPiutang(
      {
        borrowerType: 'eksternal',
        borrowerName: 'Mitra Produksi Malang',
        borrowerContact: '0899999999',
        principalMinor: '100000000', // Rp 1.000.000
        interestType: 'flat',
        interestRatePercent: 5,
        disbursedOn: '2026-10-23',
        disbursedFromPocketId: richPocket[0].id,
        purpose: 'Talangan sewa lensa bioskop',
      },
      {
        pockets: richPocket,
        categories: mockSnapshot.canonical.categories!,
        canManage: false,
        existingLoans: [],
      }
    );
    expect(flatLoan.loan.interestType).toBe('flat');
    expect(flatLoan.loan.interestRatePercent).toBe(5);
    expect(flatLoan.loan.interestMinor).toBe('5000000'); // Rp 50.000
    expect(flatLoan.loan.totalDueMinor).toBe('105000000'); // Rp 1.050.000
    expect(flatLoan.loan.remainingMinor).toBe('105000000');

    // 6c. Bunga Pecahan 2.5% atas Pokok Rp 200.000 (20.000.000 minor)
    // Bunga: 2.5% * 200.000 = Rp 5.000 (500.000 minor)
    // Total Tagihan: Rp 205.000 (20.500.000 minor)
    const fractionalLoan = await createPiutang(
      {
        borrowerType: 'kru',
        borrowerName: 'Kru Lapangan',
        borrowerContact: '0811223344',
        principalMinor: '20000000',
        interestType: 'flat',
        interestRatePercent: 2.5,
        disbursedOn: '2026-10-23',
        disbursedFromPocketId: richPocket[0].id,
        purpose: 'Bensin & logistik',
      },
      {
        pockets: richPocket,
        categories: mockSnapshot.canonical.categories!,
        canManage: false,
        existingLoans: [],
      }
    );
    expect(fractionalLoan.loan.interestMinor).toBe('500000'); // Rp 5.000
    expect(fractionalLoan.loan.totalDueMinor).toBe('20500000'); // Rp 205.000
    expect(fractionalLoan.loan.remainingMinor).toBe('20500000');

    // 6d. Cicilan 1: Bayar Rp 500.000 pada pinjaman flat 5% (Total Rp 1.050.000)
    const cicilan1 = await recordLoanRepayment(
      {
        loanId: flatLoan.loan.id,
        amountMinor: '50000000', // Rp 500.000
        paidOn: '2026-10-25',
        toPocketId: richPocket[0].id,
        method: 'transfer',
      },
      {
        pockets: richPocket,
        categories: mockSnapshot.canonical.categories!,
        canManage: false,
        existingLoans: [flatLoan.loan],
      }
    );
    expect(cicilan1.loan.totalPaidMinor).toBe('50000000');
    expect(cicilan1.loan.remainingMinor).toBe('55000000'); // Sisa Rp 550.000
    expect(cicilan1.loan.status).toBe('aktif');

    // 6e. Tolak overpayment: coba bayar Rp 600.000 padahal sisa Rp 550.000
    await expect(
      recordLoanRepayment(
        {
          loanId: flatLoan.loan.id,
          amountMinor: '60000000', // Rp 600.000
          paidOn: '2026-10-26',
          toPocketId: richPocket[0].id,
          method: 'transfer',
        },
        {
          pockets: richPocket,
          categories: mockSnapshot.canonical.categories!,
          canManage: false,
          existingLoans: [cicilan1.loan],
        }
      )
    ).rejects.toThrow(/melebihi sisa tagihan/i);

    // 6f. Pelunasan tepat sisa: Rp 550.000
    const lunas = await recordLoanRepayment(
      {
        loanId: flatLoan.loan.id,
        amountMinor: '55000000', // Rp 550.000
        paidOn: '2026-10-26',
        toPocketId: richPocket[0].id,
        method: 'transfer',
      },
      {
        pockets: richPocket,
        categories: mockSnapshot.canonical.categories!,
        canManage: false,
        existingLoans: [cicilan1.loan],
      }
    );
    expect(lunas.loan.totalPaidMinor).toBe('105000000');
    expect(lunas.loan.remainingMinor).toBe('0');
    expect(lunas.loan.status).toBe('lunas');
  });

  it('7. Render UI: FinancePiutangView memenuhi kriteria arsitektur dan menampilkan badge bunga pada card pinjaman', () => {
    const store: Record<string, string> = {
      ptv_finance_piutang_v2_records: JSON.stringify([
        {
          id: 'loan-test-ui',
          borrowerType: 'kru',
          borrowerName: 'Kru Bunga',
          borrowerContact: '08123',
          principalMinor: '100000000',
          interestType: 'flat',
          interestRatePercent: 5,
          interestMinor: '5000000',
          totalDueMinor: '105000000',
          totalPaidMinor: '0',
          remainingMinor: '105000000',
          disbursedOn: '2026-10-23',
          disbursedFromPocketId: mockSnapshot.canonical.pockets![0].id,
          status: 'aktif',
          purpose: 'Beli kamera',
          payments: [],
          createdAt: '2026-10-23T00:00:00Z',
          updatedAt: '2026-10-23T00:00:00Z',
        },
      ]),
    };

    const origLocalStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    };

    const html = renderToStaticMarkup(<FinancePiutangView data={mockSnapshot} />);
    expect(html).toContain('Piutang &amp; Pelunasan Pihak Ketiga');
    expect(html).toContain('Tahap Perancangan Kontrak Database');
    expect(html).toContain('Pihak Terkait &amp; Klien');
    expect(html).toContain('Jatuh Tempo &amp; Termin');
    expect(html).toContain('Alokasi Masuk Otomatis');
    expect(html).toContain('arch-pillars-grid');
    expect(html).toContain('Bunga Flat 5%');

    if (origLocalStorage !== undefined) {
      (globalThis as any).localStorage = origLocalStorage;
    } else {
      delete (globalThis as any).localStorage;
    }
  });
});
