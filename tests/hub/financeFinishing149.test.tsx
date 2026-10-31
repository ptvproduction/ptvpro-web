import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import handler, { readFinance } from '../../api/_routes/finance';
import * as session from '../../api/_routes/auth/_utils/crypto';
import * as access from '../../api/_routes/financeAccess';
import { FinancePage } from '../../src/products/hub/keuangan/FinancePage';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import { getStoredRecords, getStoredSemesters, saveRecords, saveSemesters } from '../../src/products/hub/keuangan/kasKruService';
import { getStoredLoans, saveLoans } from '../../src/products/hub/keuangan/piutangService';
import { getStoredFinanceSettings, getCustomCategories } from '../../src/products/hub/keuangan/financeSettingsService';
import { saveSemesterCloud, saveKasRecordCloud, saveLoanCloud, recordLoanPaymentCloud, saveFinanceSettingsCloud } from '../../src/products/hub/keuangan/financeOperationalCloudService';
import { submitTransactionVoid } from '../../src/products/hub/keuangan/financeCanonicalService';

const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }));
vi.mock('../../src/products/hub/kru/kruStore', () => ({ useCrewStore: () => ({ members: [], loading: false, error: '' }) }));
const manager = { identityId: 'fixture-identity', global: true, canManage: true };

beforeEach(() => {
  vi.stubEnv('MODE', 'staging');
  vi.stubEnv('AUTH_SECRET', 'synthetic-only');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-only');
  vi.spyOn(session, 'verifySessionToken').mockReturnValue({ account_id: 'fixture', identity_id: 'fixture-identity', iat: 1 } as never);
  vi.spyOn(access, 'resolveFinanceAccess').mockResolvedValue(manager);
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Finishing 149: tidak ada keberhasilan operasional palsu', () => {
  it.each([
    getStoredRecords, getStoredSemesters, getStoredLoans, getStoredFinanceSettings, getCustomCategories,
    () => saveRecords([]), () => saveSemesters([]), () => saveLoans([]),
  ])('storage fixture ditolak di runtime Staging (%#)', fn => {
    expect(fn).toThrow('belum diaktifkan');
  });
  it.each([
    () => saveSemesterCloud(null as never), () => saveKasRecordCloud(null as never),
    () => saveLoanCloud(null as never), () => recordLoanPaymentCloud(null as never, 'fixture'),
    () => saveFinanceSettingsCloud(null as never),
  ])('adapter direct write tidak menjadi jalur alternatif (%#)', async fn => {
    await expect(fn()).rejects.toThrow('belum diaktifkan');
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each(['post_kas_payment_atomic', 'disburse_loan_atomic', 'post_loan_payment_atomic', 'reverse_operational_atomic', 'waive_kas_fee'])('API menahan %s sebelum RPC/DML', async action => {
    const req = { method: 'POST', headers: { cookie: 'ptv_hub_session=fixture' }, body: { action } } as unknown as IncomingMessage;
    const end = vi.fn();
    const res = { setHeader: vi.fn(), end, statusCode: 0 } as unknown as ServerResponse;
    await handler(req, res);
    expect([400, 503]).toContain(res.statusCode);
    expect(JSON.parse(end.mock.calls[0][0])).toBeDefined();
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each(['kas-kru', 'piutang', 'pengaturan', 'laporan'])('halaman %s tidak membaca fixture atau menawarkan sukses palsu', tab => {
    const snapshot: FinanceSnapshot = { source: 'staging', ...manager, scope: 'global', counts: null, entries: [], kas: [], limited: false, writesEnabled: true, canonical: { state: 'available', pockets: [], transactions: [], categories: [] } };
    const html = renderToString(<MemoryRouter initialEntries={[`/hub/keuangan?tab=${tab}`]}><FinancePage initialData={snapshot} /></MemoryRouter>);
    expect(html).toContain(tab === 'pengaturan' ? 'Otoritas Pengelolaan' : 'Memuat data operasional dari Staging');
    expect(html).not.toContain('Farsya');
  });
  it('HTTP 200 dengan success=false bukan konfirmasi penyimpanan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false, error: 'Ditolak backend' }) }));
    await expect(submitTransactionVoid('fixture', 'alasan')).rejects.toThrow('Ditolak backend');
  });
  it.each(['update_pocket', 'archive_pocket'])('%s menolak versi lama sebelum update', async action => {
    const update = vi.fn();
    db.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { version: 2, archived: false, balance_minor: 0 }, error: null }) }) }), update });
    db.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'Versi kantong berubah. Muat ulang.' } });
    const req = { method: 'POST', headers: { cookie: 'ptv_hub_session=fixture' }, body: { action, pocketId: 'fixture', expectedVersion: 1, pocket: { name: 'Kas', kind: 'cash', provider: '', accountNumber: '', accountHolder: '' } } } as unknown as IncomingMessage;
    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 } as unknown as ServerResponse;
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
  it('permintaan lintas origin ditolak sebelum mutasi', async () => {
    const req = { method: 'POST', headers: { cookie: 'ptv_hub_session=fixture', origin: 'https://attacker.invalid', host: 'ptv.invalid' }, body: { action: 'create_pocket' } } as unknown as IncomingMessage;
    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 } as unknown as ServerResponse;
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe('Pembacaan canonical gagal tertutup (mock, bukan bukti cloud)', () => {
  function reads(failedTable?: string, transactionCount = 0) {
    db.rpc.mockResolvedValue({ data: { ...manager, visibleTransactionIds: ['fixture-tx'] }, error: null });
    db.from.mockImplementation((table: string) => {
      const result = { data: table === 'ptv_finance_transactions' ? [{ id: 'fixture-tx' }] : [], count: table === 'ptv_finance_transactions' ? transactionCount : 0, error: table === failedTable ? { message: 'synthetic read error' } : null };
      const chain: Record<string, unknown> = { then: (resolve: (r: unknown) => void) => resolve(result) };
      for (const method of ['select', 'eq', 'in', 'order', 'limit']) chain[method] = () => chain;
      return chain;
    });
  }
  it.each(['ptv_finance_pockets', 'ptv_finance_transactions', 'ptv_finance_categories', 'ptv_finance_allocations', 'ptv_finance_source_references'])('%s gagal tidak disamarkan sebagai data kosong', async table => {
    reads(table);
    await expect(readFinance(db as never, manager, { account_id: 'fixture', iat: 1 })).rejects.toThrow('read_failed');
  });
  it('riwayat lebih dari 100 ditandai terbatas', async () => {
    reads(undefined, 101);
    expect((await readFinance(db as never, manager, { account_id: 'fixture', iat: 1 })).limited).toBe(true);
  });
});
