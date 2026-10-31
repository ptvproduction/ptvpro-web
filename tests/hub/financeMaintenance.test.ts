import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/finance';
import { financeMaintenanceActive } from '../../api/financeMaintenance';
import { uploadFinanceProof } from '../../src/products/hub/keuangan/financeOperationalCloudService';

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.client }));
beforeEach(() => {
  vi.stubEnv('PTV_FINANCE_MAINTENANCE', 'true');
  vi.stubEnv('VITE_APP_ENV', 'staging');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
  vi.stubEnv('PTV_FINANCE_LOCAL_E2E', ''); vi.stubEnv('VERCEL_ENV', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('Finance staging maintenance boundary', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks %s before database or action dispatch', async method => {
    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
    await handler({ method, headers: {}, body: { action: 'post_transaction' } } as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.end.mock.calls[0][0]).code).toBe('FINANCE_MAINTENANCE');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(['create_pocket', 'update_pocket', 'archive_pocket', 'create_category', 'update_category', 'archive_category', 'restore_category', 'update_transaction', 'void_transaction', 'post_transaction', 'post_kas_payment_atomic', 'disburse_loan_atomic', 'post_loan_payment_atomic', 'reverse_operational_atomic', 'waive_kas_fee', 'unknown_action'])('cannot bypass using action %s', async action => {
    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
    await handler({ method: 'POST', headers: {}, body: { action } } as never, res as never);
    expect(res.statusCode).toBe(503); expect(mocks.client).not.toHaveBeenCalled();
  });
  it('keeps GET subject to normal session validation', async () => {
    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
    await handler({ method: 'GET', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(401);
  });
  it('exposes the same maintenance rejection for staging proof-upload precheck', async () => {
    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
    await handler({ method: 'GET', url: '/api/finance?maintenance=1', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.end.mock.calls[0][0]).code).toBe('FINANCE_MAINTENANCE');
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('never starts direct Storage upload when staging maintenance rejects it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ code: 'FINANCE_MAINTENANCE', error: 'Maintenance aktif' }) }));
    await expect(uploadFinanceProof(new Blob(['fixture'], { type: 'image/png' }))).rejects.toThrow('Maintenance aktif');
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('deactivates without changing authorization', () => {
    vi.stubEnv('PTV_FINANCE_MAINTENANCE', 'false'); expect(financeMaintenanceActive()).toBe(false);
  });
  it('fails closed on a mistyped nonempty maintenance flag', () => {
    vi.stubEnv('PTV_FINANCE_MAINTENANCE', 'TRUE'); expect(financeMaintenanceActive()).toBe(true);
  });
  it('supports preview even when NODE_ENV is production', () => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('NODE_ENV', 'production');
    expect(financeMaintenanceActive()).toBe(true);
  });
  it('never applies the staging flag to a production deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'production'); expect(financeMaintenanceActive()).toBe(false);
  });
  it('rejects a backend outside the existing staging allowlist', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.com'); expect(financeMaintenanceActive()).toBe(false);
  });
});
