import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanonicalCategory, editCanonicalCategory, archiveCanonicalCategory, restoreCanonicalCategory } from '../../src/products/hub/keuangan/financeSettingsService';
import { fetchSemestersCloud, saveSemesterCloud, fetchLoansCloud, fetchFinanceSettingsCloud, saveFinanceSettingsCloud } from '../../src/products/hub/keuangan/financeOperationalCloudService';

const from = vi.hoisted(() => vi.fn());
vi.mock('../../src/core/supabase/client', () => ({ getSupabaseClient: () => ({ from }), isSupabaseConfigured: () => true }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Finance Staging regression PTV-DEV-148 (mock, bukan cloud)', () => {
  const categories = [{ id: 'cat', name: 'Operasional', kind: 'expense' as const, isActive: true }];
  it.each(['create', 'edit', 'archive', 'restore'])('kegagalan API %s tidak menjadi sukses lokal', async action => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Akses ditolak' }) }));
    const run = action === 'create' ? createCanonicalCategory('Baru', 'income')
      : action === 'edit' ? editCanonicalCategory('cat', 'Baru', categories)
      : action === 'archive' ? archiveCanonicalCategory('cat', categories)
      : restoreCanonicalCategory('cat', categories);
    await expect(run).rejects.toThrow('Akses ditolak');
    expect(categories[0]).toEqual({ id: 'cat', name: 'Operasional', kind: 'expense', isActive: true });
  });
  it('tarif per bulan dibaca dan dikirim tanpa BigInt JSON', async () => {
    const row = { id: 'semester', name: 'Semester', start_date: '2026-09-01', end_date: '2027-02-28', monthly_fee_minor: '2500000', monthly_fees: { '2026-10': '3000000' }, is_active: true, is_archived: false, created_at: '2026-09-01' };
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const query = { order: () => query, range: async () => ({ data: [row], error: null }) };
    from.mockReturnValue({ select: () => query, upsert });
    const [semester] = await fetchSemestersCloud();
    expect(semester.monthlyFees).toEqual(row.monthly_fees);
    await saveSemesterCloud(semester);
    expect(() => JSON.stringify(upsert.mock.calls[0][0])).not.toThrow();
    expect(upsert.mock.calls[0][0].monthly_fees).toEqual(row.monthly_fees);
  });
  it('gagal membaca cicilan tidak menghasilkan piutang tanpa riwayat palsu', async () => {
    from.mockImplementation((table: string) => { const query = { in: () => query, order: () => query, range: async () => ({ data: table === 'ptv_finance_loans' ? [{ id: 'loan-1' }] : [], error: table === 'ptv_finance_loan_payments' ? new Error('payments unavailable') : null }) }; return { select: () => query }; });
    await expect(fetchLoansCloud()).rejects.toThrow('payments unavailable');
  });
  it('gagal membaca pengaturan tidak dianggap data kosong', async () => {
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('settings unavailable') }) }) }) });
    await expect(fetchFinanceSettingsCloud()).rejects.toThrow('settings unavailable');
  });
  it('nominal pengaturan tetap string yang dapat diserialisasi', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await saveFinanceSettingsCloud({ defaultMonthlyFeeMinor: '3000000', feeDueDay: 10, defaultLoanDueDays: 30, treasurerName: '', treasurerPtvId: '', treasurerPhone: '', officialBankPocketId: null, officialQrisPocketId: null });
    expect(JSON.parse(JSON.stringify(upsert.mock.calls[0][0])).default_monthly_fee_minor).toBe('3000000');
  });
});
