import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/_routes/peminjaman';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';
import type { SessionPayload } from '../../api/_routes/auth/_utils/types';

const f = vi.hoisted(() => ({ caps: ['hub.access', 'loans.view'] as string[], rpc: vi.fn(), from: vi.fn() }));
vi.mock('../../api/_routes/auth/_utils/identity', () => ({ refreshLiveSession: async (session: SessionPayload) => { session.capabilities = [...f.caps]; return session.capabilities; }, verifyAccountStatusLive: async () => true }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: f.from, rpc: f.rpc }) }));
const secret = 'synthetic-loan165-cookie-test-only';
beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', secret); vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-placeholder');
  f.caps = ['hub.access', 'loans.view']; vi.clearAllMocks();
  f.rpc.mockResolvedValue({ data: true, error: null });
  f.from.mockImplementation((table: string) => {
    const rows: Record<string, object[]> = {
      ptv_inventaris: [{ id: 'master', kode: 'INV-001', nama_alat: 'Master Camera', kategori: 'Kamera', foto_url: 'photo' }],
      ptv_inventaris_unit: [{ id: 'physical-unit', inventaris_id: 'master', kode_unit: 'INV-001-U01', nama_unit: 'Physical Camera', status_peminjaman: 'tersedia' }],
      ptv_peminjaman: [{ id: 'canonical', unit_id: 'physical-unit', transaction_id: 'TRX-165', status: 'dikembalikan', tanggal_kembali: '2026-10-01', tanggal_pinjam: '2026-09-30' }],
      legacy_archive_unresolved: [{ source_id: 'legacy', raw_payload: { id: 'legacy', aset_id: 'physical-unit', status: 'dikembalikan', tanggal_pinjam: '2026-09-01', tanggal_kembali: '2026-09-02' } }],
    };
    const q = { select: () => q, eq: () => q, order: () => q, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] || [], error: null }).then(resolve) };
    return q;
  });
});
afterEach(() => { vi.unstubAllEnvs(); });
async function call(method = 'GET', anonymous = false) {
  const now = Math.floor(Date.now() / 1000);
  const session = { account_id: 'synthetic-account', identity_id: 'synthetic-identity', ptv_id: 'SYNTHETIC',
    full_name: 'Synthetic', username: 'synthetic', iat: now, exp: now + 3600, status_akun: 'active', status_organisasi: 'active', assigned_profiles: ['crew'], capabilities: [] } as SessionPayload;
  const req = Object.assign(Readable.from([]), { method, headers: { host: 'localhost:5174', origin: 'http://localhost:5174',
    'content-type': 'application/json', ...(!anonymous ? { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` } : {}) },
    ...(method === 'POST' ? { body: { operation: 'rpc_checkout_loan', args: {} } } : {}) });
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
  await handler(req as never, res as never);
  return { status: res.statusCode, data: JSON.parse(res.end.mock.calls[0][0]) };
}
describe('Inventory/loan identity165: cookie API and canonical/historical links', () => {
  it('maps physical unit IDs back to the same master in canonical and legacy history', async () => {
    const result = await call(); expect(result.status).toBe(200);
    expect(result.data.loans).toHaveLength(2);
    for (const row of result.data.loans) expect(row).toMatchObject({ unit_id: 'physical-unit', nama_alat: 'Master Camera', kategori: 'Kamera', foto_url: 'photo', status: 'dikembalikan' });
    expect(result.data.loans.filter((row: { is_historical: boolean }) => row.is_historical)).toHaveLength(1);
  });
  it('anonymous and live permission denial do not expose inventory or loan records', async () => {
    expect((await call('GET', true)).status).toBe(401);
    f.caps = ['hub.access']; expect((await call()).status).toBe(403); expect(f.from).not.toHaveBeenCalled();
  });
  it('view-only session cannot checkout even when account is active', async () => {
    expect((await call('POST')).status).toBe(403); expect(f.rpc).not.toHaveBeenCalled();
  });
});
