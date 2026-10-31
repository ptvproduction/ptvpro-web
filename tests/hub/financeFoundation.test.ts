import { afterEach, describe, expect, it, vi } from 'vitest';
import { financeSection, FINANCE_SETTINGS, loadFinance } from '../../src/products/hub/keuangan/financeFoundation';
import { resolveFinanceAccess } from '../../api/financeAccess';
import handler, { readFinance } from '../../api/finance';
import type { SessionPayload } from '../../api/auth/_utils/types';

const session = { account_id: 'account', identity_id: 'spoofed-cookie-identity', iat: 1792500000 } as SessionPayload;
function database(options: { profiles?: string[]; caps?: string[]; overrides?: object[]; inactive?: boolean; revoked?: boolean; fail?: string; position?: string; lockout?: string; cutoff?: string } = {}) {
  const queried: string[] = []; const filters: unknown[][] = [];
  const db = { rpc: vi.fn().mockResolvedValue({ data: { identityId: 'live-identity', canManage: false, global: false, visibleTransactionIds: [] }, error: null }), from: vi.fn((table: string) => {
    queried.push(table);
    const rows: Record<string, unknown> = {
      user_account: { identity_id: 'live-identity', status_akun: options.inactive ? 'inactive' : 'active', tokens_valid_after: options.cutoff || (options.revoked ? '2099-01-01' : null), lockout_until: options.lockout || null },
      organization_membership: [{ status_organisasi: 'active' }],
      account_profiles: (options.profiles || ['crew']).map(profile_id => ({ profile_id })),
      account_capability_overrides: options.overrides || [],
      profile_capabilities: (options.caps || ['hub.access']).map(capability_key => ({ capability_key })),
      canonical_identity: { ptv_id: 'PTV-TEST' }, legacy_archive_kru: { jabatan: options.position || 'Kru' },
      ptv_kas_kru: [], ptv_pemasukan: [], ptv_pengeluaran: [], ptv_keuangan: [],
    };
    const result = { data: rows[table], count: 0, error: options.fail === table ? { message: 'failure' } : null };
    const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => void) => resolve(result) };
    for (const method of ['select', 'eq', 'in', 'single', 'maybeSingle', 'order', 'limit']) chain[method] = (...args: unknown[]) => { if (method === 'eq') filters.push([table, ...args]); return chain; };
    return chain;
  }) };
  return { db: db as never, queried, filters };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('Fondasi Finance: izin dan sumber nyata', () => {
  it.each(['2099-01-01T00:00:00Z', 'invalid'])('menolak lockout %s sebelum membaca data keuangan', async lockout => {
    const { db, queried } = database({ lockout });
    await expect(resolveFinanceAccess(db, session)).rejects.toThrow('forbidden');
    expect(queried).toEqual(['user_account']);
  });
  it.each([0, -1, NaN, Math.floor(Date.now() / 1000) + 3600])('menolak waktu sesi tidak sah %s', async iat => {
    await expect(resolveFinanceAccess(database().db, { ...session, iat })).rejects.toThrow('forbidden');
  });
  it('menolak cutoff tidak valid dan mengizinkan lockout yang sudah berakhir', async () => {
    await expect(resolveFinanceAccess(database({ cutoff: 'invalid' }).db, session)).rejects.toThrow('forbidden');
    expect((await resolveFinanceAccess(database({ lockout: '2000-01-01T00:00:00Z' }).db, session)).global).toBe(false);
  });
  it.each(['pemasukan', 'pengeluaran'])('deep link lama %s tetap menuju transaksi', value => expect(financeSection(value)).toBe('transaksi'));
  it('kas_kru dan shortcut settings terpetakan', () => { expect(financeSection('kas_kru')).toBe('kas-kru'); expect(financeSection('unknown')).toBe('ringkasan'); expect(FINANCE_SETTINGS.kantong).toBe('kantong'); });
  it('kru hanya membaca kas milik identitas live, tanpa query transaksi global', async () => {
    const { db, queried, filters } = database(); const access = await resolveFinanceAccess(db, session);
    expect(access).toEqual({ identityId: 'live-identity', canManage: false, global: false });
    const result = await readFinance(db, access, session);
    expect(filters).toContainEqual(['ptv_kas_kru', 'identity_id', 'live-identity']);
    expect(queried).not.toContain('ptv_pemasukan'); expect(result.counts).toBeNull(); expect(result.writesEnabled).toBe(false);
  });
  it.each(['root_executive', 'eksekutif', 'crew'])('finance.manage existing memberi akses pengelola terdelegasi: %s', async profile => {
    const { db } = database({ profiles: [profile], caps: ['hub.access', 'finance.manage'] });
    expect((await resolveFinanceAccess(db, session)).canManage).toBe(true);
  });
  it('operator tanpa manage tetap read-only', async () => { const { db } = database({ caps: ['hub.access', 'finance.operator'] }); expect((await resolveFinanceAccess(db, session)).canManage).toBe(false); });
  it('deny override mengalahkan grant pengelola', async () => {
    const { db } = database({ caps: ['hub.access', 'finance.manage'], overrides: [{ capability_key: 'finance.manage', override_type: 'deny' }] });
    expect((await resolveFinanceAccess(db, session)).canManage).toBe(false);
  });
  it.each([{ inactive: true }, { revoked: true }, { fail: 'profile_capabilities' }])('status/otorisasi gagal tidak memakai klaim cookie lama: %j', async options => {
    await expect(resolveFinanceAccess(database(options).db, session)).rejects.toThrow('forbidden');
  });
  it.each(['Pembina Studio', 'Pengarah'])('menolak personel %s meskipun memiliki finance.manage', async position => {
    await expect(resolveFinanceAccess(database({ position, caps: ['hub.access', 'finance.manage'] }).db, session)).rejects.toThrow('forbidden');
  });
  it.each(['canonical_identity', 'legacy_archive_kru'])('gagal tertutup jika lookup personel %s gagal', async fail => {
    await expect(resolveFinanceAccess(database({ fail }).db, session)).rejects.toThrow('forbidden');
  });
  it('query gagal tidak menghasilkan daftar kosong palsu', async () => {
    await expect(readFinance(database({ fail: 'ptv_kas_kru' }).db, { identityId: 'live-identity', global: false, canManage: false }, session)).rejects.toThrow();
  });
  it.each(['PUT', 'PATCH', 'DELETE'])('endpoint menolak %s tanpa memanggil database', async method => {
    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 }; await handler({ method, headers: {} } as never, res as never); expect(res.statusCode).toBe(405);
  });
  it('POST tanpa sesi mengembalikan 401', async () => {
    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 }; await handler({ method: 'POST', headers: {} } as never, res as never); expect(res.statusCode).toBe(401);
  });
  it('HTTP gagal tidak fallback ke fixtures/localStorage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Akses ditolak' }) }));
    await expect(loadFinance()).rejects.toThrow('Akses ditolak');
  });
  it('body menggantung berakhir dengan timeout', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) }));
    const pending = expect(loadFinance()).rejects.toThrow('Waktu memuat'); await vi.advanceTimersByTimeAsync(15000); await pending;
  });
  it('respons palsu tanpa identitas sumber ditolak', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], kas: [] }) }));
    await expect(loadFinance()).rejects.toThrow('tidak valid');
  });
});
