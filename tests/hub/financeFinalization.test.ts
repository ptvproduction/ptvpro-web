import { describe, expect, it, vi, afterEach } from 'vitest';
import { financePdfTestAssets } from './financePdfTestAssets';
import * as XLSX from 'xlsx';
import { cleanTransactionTitle, isMigratedTransaction, type CanonicalTransaction, type FinancePocket } from '../../src/products/hub/keuangan/financeCanonical';
import { generateLaporan, getDateRangeFromPreset, type LaporanFilter } from '../../src/products/hub/keuangan/laporanService';
import { buildLaporanPdf14, buildLaporanXLSXWorkbook } from '../../src/products/hub/keuangan/exportUtils';

const pockets: FinancePocket[] = ['cash', 'bank'].map((id, index) => ({
  id, name: id, kind: 'cash', provider: '', accountNumber: '', accountHolder: '',
  archived: false, version: 1, balanceMinor: index ? '300000' : '59327600', qris: null,
}));
const tx: CanonicalTransaction = {
  id: 'local-only', description: '[LEGACY] Pembayaran Jasa', occurredOn: '2026-10-31',
  kind: 'income', status: 'posted', amountMinor: '1000000', auditReference: 'original-reference',
  allocations: [{ pocketId: 'cash', direction: 'in', amountMinor: '700000' }, { pocketId: 'bank', direction: 'in', amountMinor: '300000' }],
  sourceReferences: [{ kind: 'pemasukan', id: 'original-id' }], categoryId: 'income',
};
const filter: LaporanFilter = { datePreset: 'semua', startDate: '2026-10-01', endDate: '2026-10-31', pocketId: 'semua', categoryId: 'semua', kind: 'semua', status: 'posted_only' };
const categories = [{ id: 'income', name: 'Jasa', kind: 'income' as const, isActive: true }];
afterEach(() => vi.useRealTimers());

describe('Finance finalization: labels and ledger-aligned exports', () => {
  it.each([
    ['[LEGACY] BELI GALON CLEO: subsidi Zaidan', 'BELI GALON CLEO: subsidi Zaidan'],
    ['[Migrasi] [Dasbor PTV] Pembayaran Malik', 'Pembayaran Malik'],
    ['Migrasi Dasbor PTV: Pembayaran Jasa', 'Pembayaran Jasa'],
    ['Dasbor PTV - Pengeluaran Produksi', 'Pengeluaran Produksi'],
    ['Pembayaran Jasa [Migrasi]', 'Pembayaran Jasa'],
    ['Biaya migrasi server', 'Biaya migrasi server'],
    ['[LEGACY][BATAL/UNDO] Iuran', '[BATAL/UNDO] Iuran'],
  ])('cleans only migration metadata in %s', (input, expected) => {
    expect(cleanTransactionTitle(input)).toBe(expected);
  });

  it('preserves original historical fields and recognizes migration provenance separately', () => {
    const before = structuredClone(tx);
    expect(isMigratedTransaction(tx)).toBe(true);
    expect(isMigratedTransaction({ ...tx, description: 'Transaksi Baru', sourceReferences: [] })).toBe(false);
    expect(cleanTransactionTitle(tx.description)).toBe('Pembayaran Jasa');
    expect(tx).toEqual(before);
  });

  it('uses selected-pocket allocations consistently in summary, Excel and PDF', async () => {
    const before = structuredClone(tx);
    const report = generateLaporan([tx], pockets, categories, { ...filter, pocketId: 'bank' });
    expect(report.totalInflowMinor).toBe('300000');
    expect(report.totalBalanceMinor).toBe('300000');
    expect(report.categoryDistribution[0].amountMinor).toBe('300000');
    expect(report.pocketBalances.map(p => p.pocket.id)).toEqual(['bank']);
    const workbook = buildLaporanXLSXWorkbook(report, pockets, categories);
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Mutasi Transaksi'], { header: 1 });
    expect(rows[1][2]).toBe('Pembayaran Jasa');
    expect(rows[1][7]).toBe(3000);
    expect(rows[1][9]).toBe('original-reference');
    const summary = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Ringkasan Eksekutif'], { header: 1 });
    expect(summary.find(row => row[0] === 'Pemasukan Operasional Sah')?.[1]).toBe(3000);
    const pdf = await buildLaporanPdf14(report, pockets, categories, financePdfTestAssets);
    expect(pdf).toContain('/FontFile2');
    expect(pdf).not.toContain('[LEGACY]');
    expect(tx).toEqual(before);
  });

  it('keeps transfers net zero globally and excludes VOID from income and expense', () => {
    const transfer: CanonicalTransaction = { ...tx, id: 'transfer', description: 'Transfer', kind: 'transfer', amountMinor: '300000', allocations: [{ pocketId: 'cash', direction: 'out', amountMinor: '300000' }, { pocketId: 'bank', direction: 'in', amountMinor: '300000' }] };
    const report = generateLaporan([tx, transfer, { ...tx, id: 'void', status: 'reversed' }], pockets, categories, filter);
    expect(report.totalInflowMinor).toBe('1000000');
    expect(report.totalOutflowMinor).toBe('0');
    expect(report.netCashFlowMinor).toBe('1000000');
    expect(report.totalTransferMinor).toBe('300000');
    expect(report.totalBalanceMinor).toBe('59627600');
  });

  it('keeps Indonesian month boundaries in local calendar dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 12));
    expect(getDateRangeFromPreset('bulan_ini')).toEqual({ startDate: '2026-10-01', endDate: '2026-10-31' });
  });
});
