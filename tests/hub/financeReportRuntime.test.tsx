import { afterEach, describe, expect, it, vi } from 'vitest';
import { financePdfTestAssets } from './financePdfTestAssets';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';
import { Finance3Laporan } from '../../src/products/hub/keuangan/Finance3Laporan';
import { generateLaporan, getDateRangeFromPreset, type LaporanFilter } from '../../src/products/hub/keuangan/laporanService';
import { assertFinanceFixtureRuntime } from '../../src/products/hub/keuangan/financeRuntimeSafety';
import { buildLaporanPdf14, buildLaporanXLSXWorkbook, exportLaporanPDF } from '../../src/products/hub/keuangan/exportUtils';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { FinanceOperationalData } from '../../src/products/hub/keuangan/financeOperationalData';

const data: FinanceSnapshot = { source: 'staging', canManage: true, scope: 'global', counts: { income: 1, expense: 0, ledger: 0 }, entries: [], kas: [], limited: false, writesEnabled: true, canonical: {
  state: 'available', categories: [], pockets: [{ id: 'cash', name: 'Kas Utama', kind: 'cash', provider: '', accountHolder: '', accountNumber: '', archived: false, balanceMinor: '59327600', version: 1, qris: null }],
  transactions: [{ id: 'income', description: 'Pemasukan', occurredOn: '2026-10-10', kind: 'income', status: 'posted', amountMinor: '1000000', auditReference: 'original', allocations: [{ pocketId: 'cash', direction: 'in', amountMinor: '1000000' }] },
    { id: 'next', description: 'Pemasukan November', occurredOn: '2026-11-10', kind: 'income', status: 'posted', amountMinor: '2000000', auditReference: 'next', allocations: [{ pocketId: 'cash', direction: 'in', amountMinor: '2000000' }] }],
} };
const operational: FinanceOperationalData = { source: 'staging', scope: 'global', ownerPtvId: 'PTV-QC', writesEnabled: false, feeDueDay: 10, crewRoster: [], records: [], loans: [], semesters: [{ id: 'fall', name: 'Semester Staging', startDate: '2026-09-01', endDate: '2027-02-28', isActive: true, isArchived: false, monthlyFeeMinor: '2500000', createdAt: '2026-09-01' }] };
const filter: LaporanFilter = { ...getDateRangeFromPreset('bulan_ini'), startDate: '2026-10-01', endDate: '2026-10-31', datePreset: 'custom', pocketId: 'semua', kind: 'semua', categoryId: 'semua', status: 'posted_only' };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Finance report with staging fixture guard active', () => {
  it('opens the report with canonical and operational snapshots while the fixture guard still rejects access', () => {
    vi.stubEnv('VITE_APP_ENV', 'staging');
    expect(assertFinanceFixtureRuntime).toThrow();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Forbidden storage'); } });
    const html = renderToStaticMarkup(<Finance3Laporan data={data} operationalData={operational} />);
    expect(html).toContain('Laporan &amp; Rekapitulasi Pembukuan');
    expect(html).toContain('Semester Staging');
    expect(html).toContain('Saldo Awal Periode');
    expect(html).not.toContain('Data laporan tidak dapat dihitung');
    expect(() => generateLaporan(data.canonical.transactions!, data.canonical.pockets!, [], filter)).not.toThrow();
  });

  it('handles loading, operational errors, malformed ledger and empty data without an application crash', () => {
    expect(renderToStaticMarkup(<Finance3Laporan data={data} operationalLoading />)).toContain('Memuat data laporan');
    expect(renderToStaticMarkup(<Finance3Laporan data={data} operationalError="Koneksi gagal" />)).toContain('Coba Lagi');
    const malformed = structuredClone(data);
    malformed.canonical.pockets![0].balanceMinor = 'invalid';
    expect(renderToStaticMarkup(<Finance3Laporan data={malformed} operationalData={operational} />)).toContain('Data laporan tidak dapat dihitung');
    const empty = structuredClone(data);
    empty.canonical.transactions = [];
    expect(renderToStaticMarkup(<Finance3Laporan data={empty} operationalData={{ ...operational, semesters: [] }} />)).toContain('Belum ada data semester');
  });

  it('uses one ledger for period balances, semester totals and Excel/PDF exports', async () => {
    vi.stubEnv('VITE_APP_ENV', 'staging');
    const report = generateLaporan(data.canonical.transactions!, data.canonical.pockets!, [], filter, operational);
    expect(report.openingBalanceMinor).toBe('56327600');
    expect(report.closingBalanceMinor).toBe('57327600');
    expect(report.totalInflowMinor).toBe('1000000');
    const semester = operational.semesters[0];
    expect(generateLaporan(data.canonical.transactions!, data.canonical.pockets!, [], { ...filter, startDate: semester.startDate, endDate: semester.endDate }, operational).totalInflowMinor).toBe('3000000');
    expect(generateLaporan(data.canonical.transactions!, data.canonical.pockets!, [], { ...filter, startDate: '2026-11-01', endDate: '2026-11-30' }, operational).totalInflowMinor).toBe('2000000');
    const workbook = buildLaporanXLSXWorkbook(report, data.canonical.pockets!, [], { kasRecords: operational.records, loans: operational.loans });
    const summary = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Ringkasan Eksekutif'], { header: 1 });
    expect(summary.find(r => r[0] === 'Saldo Awal Periode')?.[1]).toBe(563276);
    expect(summary.find(r => r[0] === 'Saldo Akhir Periode')?.[1]).toBe(573276);
    const pdf = await buildLaporanPdf14(report, data.canonical.pockets!, [], financePdfTestAssets);
    expect(pdf).toContain('/FontFile2');
    expect(await exportLaporanPDF(report, data.canonical.pockets!, [], financePdfTestAssets)).toMatch(/\.pdf$/);
  });
});
