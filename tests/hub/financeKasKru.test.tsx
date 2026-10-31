import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  generatePeriods,
  createSemester,
  calculateKasKruMatrix,
  recordKasKruPayment,
  reverseKasKruRecord,
} from '../../src/products/hub/keuangan/kasKruService';
import { FinanceKasKruView } from '../../src/products/hub/keuangan/FinanceKasKruView';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { FinanceSemester, KasKruRecord } from '../../src/products/hub/keuangan/kasKruTypes';
import { CANONICAL_STAGING_CREW_FIXTURES } from '../../src/products/hub/kru/canonicalCrewData';

const mockSemester: FinanceSemester = {
  id: 'sem-test-1',
  name: 'Semester Uji Ganjil 2026/2027',
  startDate: '2026-09-01',
  endDate: '2026-11-30',
  monthlyFeeMinor: '2500000', // Rp 25.000,00
  isActive: true,
  isArchived: false,
  createdAt: '2026-09-01T00:00:00Z',
};

const mockSnapshot: FinanceSnapshot = {
  source: 'staging',
  canManage: true,
  scope: 'global',
  counts: { income: 39, expense: 10, ledger: 0 },
  entries: [],
  kas: [
    { id: '1', period: '2026-10', amount: 25000, status: 'Lunas' },
    { id: '2', period: '2026-09', amount: 25000, status: 'Belum Lunas' },
  ],
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
        balanceMinor: '52027600',
        qris: null,
      },
    ],
    categories: [
      { id: '22222222-2222-4222-8222-222222222222', name: 'Iuran Kru', kind: 'income', isActive: true },
    ],
    transactions: [],
  },
};

describe('Finance 2.0: Kas Kru Service & Business Rules', () => {
  it('1. generatePeriods: menghasilkan daftar bulan YYYY-MM secara berurutan dan inklusif', () => {
    const periods = generatePeriods('2026-09-01', '2027-02-28');
    expect(periods).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);

    expect(generatePeriods('2026-10-01', '2026-09-01')).toEqual([]);
  });

  it('2. createSemester: memvalidasi tanggal, menolak nominal negatif, dan mendeteksi tumpang tindih', () => {
    // Valid creation
    const { semester, updatedList } = createSemester(
      {
        name: 'Semester Baru',
        startDate: '2027-03-01',
        endDate: '2027-08-31',
        monthlyFeeMinor: '3000000',
        isActive: true,
      },
      [mockSemester]
    );

    expect(semester.name).toBe('Semester Baru');
    expect(semester.monthlyFeeMinor).toBe('3000000');
    expect(updatedList.length).toBe(2);

    // Overlap validation
    expect(() =>
      createSemester(
        {
          name: 'Semester Tabrakan',
          startDate: '2026-10-01',
          endDate: '2026-12-31',
          monthlyFeeMinor: '2500000',
          isActive: true,
        },
        [mockSemester]
      )
    ).toThrow(/tumpang tindih/i);
  });

  it('3. calculateKasKruMatrix: menghitung matriks kru, status per bulan, dan tunggakan secara deterministik', () => {
    const sampleCrew = CANONICAL_STAGING_CREW_FIXTURES.slice(0, 3);
    const mockRecords: KasKruRecord[] = [
      {
        id: 'rec-1',
        semesterId: mockSemester.id,
        ptvId: sampleCrew[0].ptv_id,
        crewName: sampleCrew[0].full_name,
        period: '2026-09',
        amountMinor: '2500000',
        paidAmountMinor: '2500000',
        status: 'lunas',
        paymentDate: '2026-09-10',
        method: 'cash',
        pocketId: mockSnapshot.canonical.pockets![0].id,
        transactionId: 'tx-1',
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: '2026-09-10T00:00:00Z',
      },
    ];

    const matrix = calculateKasKruMatrix(mockSemester, sampleCrew, mockRecords);
    expect(matrix.periods).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(matrix.rows.length).toBe(3);

    // Crew 0 paid 2026-09
    const row0 = matrix.rows.find(r => r.crew.ptv_id === sampleCrew[0].ptv_id);
    expect(row0?.periods['2026-09'].status).toBe('lunas');
    expect(row0?.periods['2026-10'].status).toBe('belum');

    // Stats
    expect(matrix.stats.totalCollectedMinor).toBe('2500000');
  });

  it('4. recordKasKruPayment: menyiapkan mutasi canonical income dan menautkan record pembayaran', async () => {
    // Mock fetch for serverless submit
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        transaction: { id: 'tx-canonical-101' },
      }),
    } as any);

    const res = await recordKasKruPayment(
      {
        ptvId: 'PTV-001',
        crewName: 'Muhammad Zidnal Falah',
        semesterId: mockSemester.id,
        selectedPeriods: ['2026-09', '2026-10'],
        amountMinor: '5000000',
        pocketId: mockSnapshot.canonical.pockets![0].id,
        paymentDate: '2026-10-23',
        method: 'transfer',
        notes: 'Bayar 2 bulan',
      },
      {
        pockets: mockSnapshot.canonical.pockets!,
        categories: mockSnapshot.canonical.categories!,
        canManage: true,
        existingRecords: [],
      }
    );

    expect(res.success).toBe(true);
    expect(res.records.length).toBe(2);
    expect(res.records[0].status).toBe('lunas');
    expect(res.records[1].status).toBe('lunas');
    expect(res.transactionId).toBe('tx-canonical-101');
  });

  it('5. reverseKasKruRecord: membatalkan pembayaran tanpa menghapus data secara destruktif', () => {
    const existing: KasKruRecord = {
      id: 'rec-test-rev',
      semesterId: mockSemester.id,
      ptvId: 'PTV-001',
      crewName: 'Muhammad Zidnal Falah',
      period: '2026-09',
      amountMinor: '2500000',
      paidAmountMinor: '2500000',
      status: 'lunas',
      paymentDate: '2026-09-10',
      method: 'cash',
      pocketId: mockSnapshot.canonical.pockets![0].id,
      transactionId: 'tx-1',
      createdAt: '2026-09-10T00:00:00Z',
      updatedAt: '2026-09-10T00:00:00Z',
    };

    const { record } = reverseKasKruRecord('rec-test-rev', 'Koreksi salah input', [existing]);
    expect(record.status).toBe('belum');
    expect(record.paidAmountMinor).toBe('0');
    expect(record.reversalReason).toBe('Koreksi salah input');
  });

  it('6. Render UI: FinanceKasKruView merender elemen desktop matrix dan mobile cards', () => {
    const html = renderToStaticMarkup(<FinanceKasKruView data={mockSnapshot} />);
    expect(html).toContain('Kas Kru &amp; Iuran Bulanan');
    expect(html).toContain('terpisah dari Kas Utama Studio');
    expect(html).toContain('finance-substats-row');
    expect(html).toContain('finance-kru-cards-grid');
    expect(html).toContain('finance-matrix-table');
  });
});
