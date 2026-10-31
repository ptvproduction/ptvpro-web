import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/_routes/finance';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks }));
vi.mock('../../api/_routes/auth/_utils/crypto', () => ({ verifySessionToken: () => ({ account_id: 'verified-account', iat: 1790000000 }) }));
vi.mock('../../api/_routes/financeAccess', () => ({ resolveFinanceAccess: () => ({ identityId: 'verified-identity', canManage: true, global: true }) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('Finance admin API contract (mock only)', () => {
  it.each([['42501', 403], ['40001', 409], ['PGRST202', 503]])('propagates RPC failure %s without a direct-write fallback', async (code, status) => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'synthetic failure' } });
    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    await handler({ method: 'POST', headers: { cookie: 'ptv_hub_session=synthetic' }, body: { action: 'create_pocket' } } as never, res as never);
    expect(res.statusCode).toBe(status);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(['create_pocket', 'update_pocket', 'archive_pocket', 'create_category', 'update_category', 'archive_category', 'restore_category', 'update_transaction'])('%s uses the verified cookie actor and one RPC', async action => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    mocks.rpc.mockResolvedValue({ data: { success: true }, error: null });
    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    const body = { action, account_id: 'spoofed' };
    await handler({ method: 'POST', headers: { cookie: 'ptv_hub_session=synthetic', 'content-type': 'application/json' }, body } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('rpc_finance_admin_mutation_server', {
      p_account_id: 'verified-account', p_session_iat: 1790000000, p_action: action, p_payload: body,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
