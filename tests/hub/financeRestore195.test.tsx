import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFinanceOperational } from '../../api/_routes/financeOperationalRead';
import { FinancePage } from '../../src/products/hub/keuangan/FinancePage';
import { FinanceKasKruView } from '../../src/products/hub/keuangan/FinanceKasKruView';
import { FinancePiutangView } from '../../src/products/hub/keuangan/FinancePiutangView';
import { FinanceLaporanView } from '../../src/products/hub/keuangan/FinanceLaporanView';
import { loadFinanceOperational } from '../../src/products/hub/keuangan/financeOperationalData';
import { generateLaporan, type LaporanFilter } from '../../src/products/hub/keuangan/laporanService';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { CrewMember } from '../../src/products/hub/kru/types';

vi.mock('../../src/products/hub/kru/kruStore', () => ({ useCrewStore: () => ({ members: [], loading: false, error: '' }) }));
const semester = { id: 'semester', name: 'Semester Uji', start_date: '2026-01-01', end_date: '2026-01-31', monthly_fee_minor: '2500000', is_active: true, is_archived: false };
const loan = { id: 'loan-a', borrower_type: 'kru', borrower_id: 'SYN-A', borrower_name: 'Kru Sintetis A', principal_minor: '10000000', total_due_minor: '10000000', total_paid_minor: '2500000', remaining_minor: '7500000', status: 'aktif', disbursed_on: '2026-01-01', payments: [] };
const crew = [{ id: 'crew-a', ptv_id: 'SYN-A', full_name: 'Kru Sintetis A', category: 'Kru', status_kru: 'Aktif', join_date: '2025-01-01' }] as CrewMember[];
const snapshot: FinanceSnapshot = { source: 'staging', scope: 'global', canManage: false, writesEnabled: false, counts: null, entries: [], kas: [], limited: false, canonical: { state: 'available', pockets: [], transactions: [], categories: [] } };
const filter: LaporanFilter = { datePreset: 'semua', startDate: '2026-01-01', endDate: '2026-12-31', pocketId: 'semua', categoryId: 'semua', kind: 'semua', status: 'posted_only' };

function database(manager = false, denied = false, failing = '') {
  const tables: Record<string, any[]> = {
    account_profiles: [{ profile_id: 'crew' }],
    account_capability_overrides: denied ? [{ capability_key: 'finance.view_own', override_type: 'deny' }] : [],
    profile_capabilities: [], canonical_identity: [{ ptv_id: 'SYN-A' }],
    ptv_finance_semesters: [semester],
    ptv_finance_kas_records: ['SYN-A', 'SYN-B'].map((id, index) => ({ id: `kas-${index}`, ptv_id: id, semester_id: 'semester', crew_name: id, period: '2026-01', amount_minor: '2500000', paid_amount_minor: '1000000', status: 'sebagian' })),
    ptv_finance_loans: [loan, { ...loan, id: 'loan-b', borrower_id: 'SYN-B' }],
    ptv_finance_loan_payments: [{ id: 'pay-a', loan_id: 'loan-a', amount_minor: '2500000', status: 'reversed' }, { id: 'pay-b', loan_id: 'loan-b', amount_minor: '999' }],
    ptv_finance_settings: [{ id: 'studio_default', fee_due_day: 12 }],
  };
  const queries: string[] = [];
  const db = {
    rpc: vi.fn().mockResolvedValue({ data: { identityId: 'identity-a', canManage: manager, global: true }, error: null }),
    from: vi.fn((table: string) => {
      queries.push(table);
      let rows = tables[table] || [];
      const result = () => ({ data: rows, error: table === failing ? new Error('read unavailable') : null });
      const q: any = {
        select: () => q,
        eq: (key: string, value: unknown) => { if (!['account_id', 'id'].includes(key)) rows = rows.filter(r => r[key] === value); return q; },
        in: (key: string, values: unknown[]) => { rows = rows.filter(r => values.includes(r[key])); return q; },
        order: () => q,
        range: async (start: number, end: number) => ({ ...result(), data: rows.slice(start, end + 1) }),
        single: async () => ({ ...result(), data: rows[0] }),
        maybeSingle: async () => ({ ...result(), data: rows[0] }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return q;
    }),
  };
  return { db, tables, queries };
}
async function read(fixture = database()) {
  return readFinanceOperational(fixture.db as never, { identityId: 'identity-a', canManage: false, global: true }, { account_id: 'account-a', iat: 1 });
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Restore Finance 195 — local mocks, bukan bukti cloud', () => {
  it('memakai otorisasi live dan membatasi kas, pinjaman, serta histori pembayaran pemilik', async () => {
    const value = await read();
    expect(value.scope).toBe('own');
    expect(value.records.map(r => r.ptvId)).toEqual(['SYN-A']);
    expect(value.loans.map(l => l.id)).toEqual(['loan-a']);
    expect(value.loans[0].payments.map(p => p.id)).toEqual(['pay-a']);
    expect(value.loans[0].payments[0].status).toBe('reversed');
    expect(value.writesEnabled).toBe(false);
  });
  it('pengelola menerima detail global meskipun akses awal stale', async () => {
    const value = await read(database(true));
    expect(value.scope).toBe('global');
    expect(value.loans).toHaveLength(2);
    expect(value.records).toHaveLength(2);
  });
  it('deny own mengalahkan profil kru sebelum membaca detail', async () => {
    const fixture = database(false, true);
    await expect(read(fixture)).rejects.toThrow('forbidden');
    expect(fixture.queries).not.toContain('ptv_finance_loans');
  });
  it('gagal validasi actor tidak membuka tabel operasional', async () => {
    const fixture = database();
    fixture.db.rpc.mockResolvedValue({ error: null, data: { identityId: 'other', canManage: true, global: true } });
    await expect(read(fixture)).rejects.toThrow('forbidden');
    expect(fixture.db.from).not.toHaveBeenCalled();
  });
  it.each(['ptv_finance_semesters', 'ptv_finance_kas_records', 'ptv_finance_loans', 'ptv_finance_loan_payments', 'ptv_finance_settings'])('gagal baca %s tidak berubah menjadi data kosong', async table => {
    await expect(read(database(true, false, table))).rejects.toThrow();
  });
  it('membaca seluruh halaman kas melampaui batas respons default', async () => {
    const fixture = database(true);
    fixture.tables.ptv_finance_kas_records = Array.from({ length: 1001 }, (_, id) => ({ ...fixture.tables.ptv_finance_kas_records[0], id: `kas-${id}` }));
    expect((await read(fixture)).records).toHaveLength(1001);
  });
  it.each(['kas-kru', 'kas_kru', 'piutang', 'laporan'])('navigasi %s memakai pembacaan staging, bukan placeholder atau fixture', tab => {
    vi.stubEnv('MODE', 'staging');
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={[`/?tab=${tab}`]}><FinancePage initialData={snapshot} /></MemoryRouter>);
    expect(html).toContain('Memuat data operasional dari Staging');
    expect(html).toContain('Mode Pemeliharaan Aktif');
    expect(html).not.toContain('Fitur operasional belum siap');
  });
  it('ketiga view asli dapat merender data cloud tanpa storage fixture dan tanpa tombol mutasi', async () => {
    const operational = await read();
    vi.stubEnv('MODE', 'staging');
    const html = renderToStaticMarkup(<><FinanceKasKruView data={snapshot} operational={operational} crew={crew} /><FinancePiutangView data={snapshot} operational={operational} /><FinanceLaporanView data={snapshot} operational={operational} crew={crew} /></>);
    expect(html).toContain('Kru Sintetis A');
    expect(html).toContain('Semester Uji');
    expect(html).toContain('Unduh XLSX');
    expect(html).not.toContain('+ Bayar Iuran');
    expect(html).not.toContain('>Catat Piutang<');
  });
  it('laporan memakai records/crew cloud untuk kalkulasi kas, piutang, dan filter ledger', async () => {
    const operational = await read();
    vi.stubEnv('MODE', 'staging');
    const transactions = [{ id: 'income', occurredOn: '2026-02-01', description: 'Pendapatan', kind: 'income' as const, amountMinor: '10000', status: 'posted' as const, auditReference: '', allocations: [] }];
    const result = generateLaporan(transactions, [], [], filter, operational, crew);
    expect(result.kasKruSummary.totalCollectedMinor).toBe('1000000');
    expect(result.kasKruSummary.totalArrearsMinor).toBe('1500000');
    expect(result.piutangSummary.totalRemainingMinor).toBe('7500000');
    expect(result.netCashFlowMinor).toBe('10000');
    expect(generateLaporan(transactions, [], [], { ...filter, kind: 'expense' }, operational, crew).filteredTransactions).toEqual([]);
    expect(generateLaporan(transactions, [], [], { ...filter, startDate: '2026-03-01' }, operational, crew).totalInflowMinor).toBe('0');
  });
  it('loader menggunakan cookie, no-store, abort signal dan menolak respons salah', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ source: 'mock' }) });
    vi.stubGlobal('fetch', fetcher);
    await expect(loadFinanceOperational(controller.signal)).rejects.toThrow('tidak valid');
    expect(fetcher).toHaveBeenCalledWith('/api/finance?operational=1', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
  });
  it('ekspor resmi ditahan ketika detail operasional hanya milik sendiri', async () => {
    const operational = await read();
    vi.stubEnv('MODE', 'staging');
    const html = renderToStaticMarkup(<FinanceLaporanView data={snapshot} operational={operational} crew={crew} />);
    expect(html).toContain('cakupan data keuangan terbatas');
    expect((html.match(/disabled=""/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(() => generateLaporan([], [], [], filter, operational)).toThrow('Data kru diperlukan');
  });
  it('loader mempertahankan kegagalan permission dari server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Akses ditolak' }) }));
    await expect(loadFinanceOperational(new AbortController().signal)).rejects.toThrow('Akses ditolak');
  });
});
