import { describe, expect, it, vi } from 'vitest';
import { FinanceScopeUnavailableError, readFinance } from '../../api/_routes/finance';

function database(denied = false) {
  const rpc = vi.fn().mockResolvedValue({ data: { identityId: 'verified-identity', canManage: false, global: true, visibleTransactionIds: ['public-tx'] }, error: denied ? { message: 'scope unavailable' } : null });
  const from = vi.fn((table: string) => {
    const data = table === 'ptv_finance_transactions'
      ? [{ id: 'private-loan-tx', description: 'PRIVATE SYNTHETIC BORROWER', amount_minor: '50' }, { id: 'public-tx', description: 'Public synthetic', amount_minor: '10' }]
      : table === 'ptv_pengeluaran' ? [{ id: 'legacy-private', keperluan: 'PRIVATE SYNTHETIC BORROWER' }] : [];
    const result = { data, count: data.length, error: null };
    const chain: Record<string, unknown> = { then: (resolve: (r: unknown) => void) => resolve(result) };
    for (const method of ['select', 'eq', 'order', 'limit', 'in']) chain[method] = () => chain;
    return chain;
  });
  return { from, rpc };
}
const access = { identityId: 'verified-identity', global: true, canManage: false };
const session = { account_id: 'verified-account', iat: 1790000000 };
describe('Finance 151 cookie/service-role privacy boundary (mock only)', () => {
  it.each(['PGRST202', '42883'])('reports missing scope %s without querying financial tables', async code => {
    const db = database();
    db.rpc.mockResolvedValue({ data: null as never, error: { code, message: 'missing scope' } } as never);
    await expect(readFinance(db as never, access, session)).rejects.toBeInstanceOf(FinanceScopeUnavailableError);
    expect(db.from).not.toHaveBeenCalled();
  });
  it('uses the live database scope and never returns private canonical or legacy free text', async () => {
    const db = database();
    const snapshot = await readFinance(db as never, access, session);
    expect(db.rpc).toHaveBeenCalledWith('rpc_finance_visible_transactions_server', {
      p_account_id: session.account_id, p_session_iat: session.iat, p_transaction_ids: ['private-loan-tx', 'public-tx'],
    });
    expect(snapshot.canonical.transactions?.map(tx => tx.id)).toEqual(['public-tx']);
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.limited).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE SYNTHETIC BORROWER');
  });
  it('missing or failed scope RPC is not replaced with unrestricted service-role data', async () => {
    await expect(readFinance(database(true) as never, access, session)).rejects.toThrow('read_failed');
  });
  it('does not guess an actor when the server session is missing', async () => {
    const db = database();
    await expect(readFinance(db as never, access)).rejects.toThrow('read_failed');
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
