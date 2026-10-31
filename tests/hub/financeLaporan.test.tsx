import { describe, expect, it } from 'vitest';
import { financePdfTestAssets } from './financePdfTestAssets';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  generateLaporan,
} from '../../src/products/hub/keuangan/laporanService';
import { FinanceLaporanView } from '../../src/products/hub/keuangan/FinanceLaporanView';
import {
  exportLaporanXLSX,
  buildLaporanXLSXWorkbook,
  buildLaporanPdf14,
  downloadLaporanPDF,
} from '../../src/products/hub/keuangan/exportUtils';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { CanonicalTransaction, FinancePocket, CanonicalCategory } from '../../src/products/hub/keuangan/financeCanonical';

const pockets: FinancePocket[] = [
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
  {
    id: 'pocket-bca',
    name: 'Bank BCA',
    kind: 'bank',
    provider: 'BCA',
    accountNumber: '123456',
    accountHolder: 'Studio PTV',
    archived: false,
    version: 1,
    balanceMinor: '100000000', // Rp 1.000.000
    qris: null,
  },
];

const categories: CanonicalCategory[] = [
  { id: 'cat-prod', name: 'Jasa Produksi', kind: 'income', isActive: true },
  { id: 'cat-konsumsi', name: 'Konsumsi', kind: 'expense', isActive: true },
];

const txs: CanonicalTransaction[] = [
  {
    id: 'tx-1',
    occurredOn: '2026-10-10',
    description: 'Jasa Video Live',
    kind: 'income',
    amountMinor: '100000000', // Rp 1.000.000
    status: 'posted',
    auditReference: 'AUDIT-1',
    categoryId: 'cat-prod',
    allocations: [{ pocketId: pockets[0].id, amountMinor: '100000000', direction: 'in' }],
  },
  {
    id: 'tx-2',
    occurredOn: '2026-10-12',
    description: 'Beli Makan Kru',
    kind: 'expense',
    amountMinor: '30000000', // Rp 300.000
    status: 'posted',
    auditReference: 'AUDIT-2',
    categoryId: 'cat-konsumsi',
    allocations: [{ pocketId: pockets[0].id, amountMinor: '30000000', direction: 'out' }],
  },
  {
    id: 'tx-3',
    occurredOn: '2026-10-15',
    description: 'Pindah Kas ke BCA',
    kind: 'transfer',
    amountMinor: '20000000', // Rp 200.000
    status: 'posted',
    auditReference: 'AUDIT-3',
    allocations: [
      { pocketId: pockets[0].id, amountMinor: '20000000', direction: 'out' },
      { pocketId: pockets[1].id, amountMinor: '20000000', direction: 'in' },
    ],
  },
  {
    id: 'tx-4',
    occurredOn: '2026-10-18',
    description: 'Transaksi Batal',
    kind: 'income',
    amountMinor: '50000000', // Rp 500.000
    status: 'reversed',
    auditReference: 'AUDIT-4',
    categoryId: 'cat-prod',
    allocations: [{ pocketId: pockets[0].id, amountMinor: '50000000', direction: 'in' }],
  },
  {
    id: 'tx-test',
    occurredOn: '2026-10-21',
    description: 'PTV-DEV-117-TEST Dummy',
    kind: 'income',
    amountMinor: '100000000',
    status: 'posted',
    auditReference: 'PTV-DEV-117-TEST-RUN',
    allocations: [],
  },
];

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
    pockets,
    categories,
    transactions: txs,
  },
};

describe('Finance 2.0: Laporan Keuangan Accounting Engine & Export', () => {
  it('1. generateLaporan: mematuhi prinsip akuntansi (transfer net-zero, reversed terisolasi, dummy terisolasi)', () => {
    const laporan = generateLaporan(txs, pockets, categories, {
      datePreset: 'semua',
      startDate: '2020-01-01',
      endDate: '2030-12-31',
      pocketId: 'semua',
      categoryId: 'semua',
      kind: 'semua',
      status: 'posted_only',
    });

    // Pemasukan hanya tx-1 (Rp 1.000.000 = 100000000). tx-3 (transfer), tx-4 (reversed), dan tx-test (dummy) tidak masuk!
    expect(laporan.totalInflowMinor).toBe('100000000');

    // Pengeluaran hanya tx-2 (Rp 300.000 = 30000000)
    expect(laporan.totalOutflowMinor).toBe('30000000');

    // Net cash flow: Rp 1.000.000 - Rp 300.000 = Rp 700.000 (70000000)
    expect(laporan.netCashFlowMinor).toBe('70000000');

    // Transfer internal
    expect(laporan.totalTransferMinor).toBe('20000000');

    // Total saldo seluruh kantong aktif (Rp 520.276 + Rp 1.000.000 = Rp 1.520.276)
    expect(laporan.totalBalanceMinor).toBe('152027600');
  });

  it('2. Filter rentang tanggal & kategori: mempersempit transaksi secara konsisten', () => {
    // Filter hanya kategori Konsumsi
    const laporanKonsumsi = generateLaporan(txs, pockets, categories, {
      datePreset: 'semua',
      startDate: '2020-01-01',
      endDate: '2030-12-31',
      pocketId: 'semua',
      categoryId: 'cat-konsumsi',
      kind: 'semua',
      status: 'posted_only',
    });

    expect(laporanKonsumsi.filteredTransactions.length).toBe(1);
    expect(laporanKonsumsi.totalOutflowMinor).toBe('30000000');
    expect(laporanKonsumsi.totalInflowMinor).toBe('0');
  });

  it('3. exportLaporanXLSX & buildLaporanPdf14: menghasilkan XLSX dan PDF dengan font surat tertanam', async () => {
    const laporan = generateLaporan(txs, pockets, categories, {
      datePreset: 'semua',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      pocketId: 'semua',
      categoryId: 'semua',
      kind: 'semua',
      status: 'posted_only',
    });

    // 3a. Uji Workbook XLSX Multi-sheet
    const wb = buildLaporanXLSXWorkbook(laporan, pockets, categories, {
      kasRecords: [
        {
          id: 'kk-1',
          semesterId: 'sem-1',
          ptvId: 'PTV-001',
          crewName: 'Zidnal',
          period: '2026-10',
          amountMinor: '2500000',
          paidAmountMinor: '2500000',
          status: 'lunas',
          paymentDate: '2026-10-01',
          method: 'cash',
          pocketId: pockets[0].id,
          transactionId: 'tx-kk-1',
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ],
      loans: [
        {
          id: 'loan-1',
          borrowerType: 'kru',
          borrowerId: 'PTV-001',
          borrowerName: 'Zidnal',
          borrowerContact: '08123',
          principalMinor: '100000000',
          interestType: 'flat',
          interestRatePercent: 5,
          interestMinor: '5000000',
          totalDueMinor: '105000000',
          totalPaidMinor: '0',
          remainingMinor: '105000000',
          disbursedOn: '2026-10-01',
          dueDate: '2026-11-01',
          disbursedFromPocketId: pockets[0].id,
          disbursementTxId: 'tx-loan-1',
          status: 'aktif',
          purpose: 'Kamera',
          payments: [],
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ],
    });

    expect(wb.SheetNames).toContain('Ringkasan Eksekutif');
    expect(wb.SheetNames).toContain('Mutasi Transaksi');
    expect(wb.SheetNames).toContain('Saldo Kantong Resmi');
    expect(wb.SheetNames).toContain('Kas Kru & Piutang');

    // Pastikan autowidth dan autofilter terpasang
    const wsTx = wb.Sheets['Mutasi Transaksi'];
    expect(wsTx['!autofilter']).toBeDefined();
    expect(wsTx['!cols']?.length).toBeGreaterThanOrEqual(10);

    // 3b. Uji Binary PDF 1.4
    const pdfString = await buildLaporanPdf14(laporan, pockets, categories, financePdfTestAssets);
    expect(pdfString.startsWith('%PDF-1.7')).toBe(true);
    expect(pdfString).toContain('/Type /Catalog');
    expect(pdfString).toContain('/Type /Pages');
    expect(pdfString).toContain('/FontFile2');
    expect(pdfString).toContain('xref');
    expect(pdfString.trimEnd().endsWith('%%EOF')).toBe(true);

    // 3c. Uji pemanggilan nama file ekspor
    const xlsxFileName = exportLaporanXLSX(laporan, pockets, categories);
    expect(xlsxFileName).toMatch(/^Laporan-Keuangan-PTVPRO-.*\.xlsx$/);

    const pdfFileName = await downloadLaporanPDF(laporan, pockets, categories, financePdfTestAssets);
    expect(pdfFileName).toMatch(/^Laporan-Keuangan-PTVPRO-.*\.pdf$/);
  });

  it('4. Render UI: FinanceLaporanView mematuhi kriteria teks dan angka pengujian unified tabs', () => {
    const html = renderToStaticMarkup(<FinanceLaporanView data={mockSnapshot} />);
    expect(html).toContain('Laporan &amp; Rekonsiliasi Pembukuan');
    expect(html).toContain('Buku Utama Terekonsiliasi');
    expect(html).toContain('Supabase Staging Terverifikasi');
    expect(html).toContain('Rp 1.154.200');
    expect(html).toContain('Rp 633.924');
    expect(html).toContain('Rp 90.000');
    expect(html).toContain('4 transaksi batal');
  });
});
