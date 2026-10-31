import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { resolveLiveAccess } from '../../api/auth/_utils/liveAccess';
import { signSessionToken, verifySessionToken } from '../../api/auth/_utils/crypto';
import { accessChangeSchema } from '../../src/products/hub/akses/accessContract';
import { hasCapability } from '../../src/core/policy';
import accessHandler from '../../api/akses';
import { handleKruApiRequest, readPersonnelAccountStatuses } from '../../api/kru';
import { StagingKruService, personnelFields } from '../../src/products/hub/kru/kruService';
import { mapLegacyKruRowToCrewMember } from '../../src/products/hub/kru/kruMapper';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks }));
const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const session = { account_id: actorId, identity_id: 'identity-actor', ptv_id: 'PTV-999', full_name: 'Unit actor', username: 'actor', status_akun: 'active' as const, status_organisasi: 'active' as const, assigned_profiles: ['root_executive'], capabilities: ['all-forged'], iat: 1792800000, exp: 1999999999 };
const secret = 'unit-test-only-secret-access-149';
let tables: Record<string, any[]>;
let failTable = '';
function chain(table: string) {
  const filters: [string, unknown][] = []; let single = false;
  let alternatives: [string, string][] = [];
  let mutation: any = null; let insert = false; let evaluated: any;
  const read = (row: any, key: string) => key.includes('->>') ? row[key.split('->>')[0]]?.[key.split('->>')[1]] ?? null : row[key];
  const result = () => {
    if (evaluated) return evaluated;
    if (failTable === table) return { data: null, error: { message: 'unavailable' } };
    if (insert) { tables[table] ||= []; tables[table].push(...mutation); }
    let rows = (tables[table] || []).filter(row => filters.every(([key, value]) => read(row,key) === value)
      && (!alternatives.length || alternatives.some(([key,value]) => read(row,key) === value)));
    if (mutation && !insert) {
      rows = rows.map(row => { const next = { ...row, ...mutation }; tables[table][tables[table].indexOf(row)] = next; return next; });
    }
    evaluated = { data: single ? rows[0] || null : rows, error: single && !rows.length && mutation ? { code: 'PGRST116' } : null };
    return evaluated;
  };
  const q: any = { then: (resolve: any) => resolve(result()), select: () => q, order: () => q, limit: () => q, in: () => q,
    or: (expression: string) => { alternatives = expression.split(',').map(part => { const [key, , value] = part.split('.'); return [key,value]; }); return q; },
    eq: (key: string, value: unknown) => { filters.push([key, value]); return q; }, is: (key: string, value: unknown) => { filters.push([key, value]); return q; },
    insert: (data: unknown) => { insert = true; mutation = data; return q; }, update: (data: unknown) => { mutation = data; return q; },
    single: () => { single = true; return q; }, maybeSingle: () => { single = true; return q; } };
  return q;
}

beforeEach(() => {
  failTable = ''; mocks.rpc.mockReset(); mocks.from.mockReset(); mocks.from.mockImplementation(chain);
  vi.stubEnv('AUTH_SECRET', secret); vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'unit-test-only-key');
  vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED', 'false');
  tables = {
    user_account: [{ id: actorId, identity_id: 'identity-actor', username: 'actor', status_akun: 'active', tokens_valid_after: null, updated_at: '2026-10-01T00:00:00Z' }, { id: targetId, identity_id: 'identity-target', username: 'target', status_akun: 'active', updated_at: '2026-10-01T00:00:00Z' }],
    canonical_identity: [{ id: 'identity-actor', ptv_id: 'PTV-901', full_name: 'Actor', metadata: { category: 'Kru' } }, { id: 'identity-target', ptv_id: 'PTV-902', full_name: 'Target', metadata: { category: 'Kru' } }],
    organization_membership: [{ identity_id: 'identity-actor', organization_id: 'ptv_studio', is_current: true, status_organisasi: 'active' }, { identity_id: 'identity-target', organization_id: 'ptv_studio', is_current: true, status_organisasi: 'active' }],
    account_profiles: [{ account_id: actorId, profile_id: 'crew' }, { account_id: targetId, profile_id: 'crew' }], account_capability_overrides: [],
    profile_capabilities: ['hub.access', 'crew.permissions.manage', 'crew.view', 'crew.create', 'crew.edit', 'crew.status.manage'].map(capability_key => ({ profile_id: 'crew', capability_key })),
    access_profile: [{ id: 'crew', name: 'Crew' }], capability_registry: [{ key: 'crew.view', description: 'Read crew' }], legacy_archive_kru: [],
  };
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function callAccess(body?: unknown, cookie = true) {
  const req = Readable.from([]) as any; req.method = body ? 'POST' : 'GET'; req.body = body; req.headers = { cookie: cookie ? `ptv_hub_session=${signSessionToken(session, secret)}` : '' };
  let output: any; const res: any = { statusCode: 0, setHeader: vi.fn(), end: (value: string) => { output = JSON.parse(value); } };
  await accessHandler(req, res); return { status: res.statusCode, body: output };
}
const change = () => ({ accountId: targetId, expectedVersion: '2026-10-01T00:00:00Z', profiles: ['crew'], allowed: [], denied: [], status: 'inactive', reason: 'Unit access change', confirmed: true });

describe('PTV-DEV-149 live authorization and direct API (mock database)', () => {
  it.each([
    [null, 'Belum Ada Akun'], ['active', 'Aktif'], ['inactive', 'Nonaktif'],
  ] as const)('status login berasal dari akun %s, bukan link personel', async (accountStatus, expected) => {
    tables.legacy_archive_kru = [{ archive_id: targetId, ptv_id: 'PTV-902', full_name: 'Synthetic Person', canonical_identity_id: 'identity-target', status: 'aktif', imported_at: '2026-10-01T00:00:00Z' }];
    if (accountStatus === null) tables.user_account = tables.user_account.filter(a => a.id !== targetId);
    else tables.user_account.find(a => a.id === targetId)!.status_akun = accountStatus;
    const result = await handleKruApiRequest({ method: 'GET', headers: { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` } });
    expect(result.status).toBe(200);
    expect(result.body.crew[0].status_akun).toBe(expected);
    expect(result.body.crew[0].status_kru).toBe('Aktif');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(['duplicate', 'invalid'])('menolak status akun personel %s tanpa sukses palsu', async kind => {
    tables.legacy_archive_kru = [{ archive_id: targetId, ptv_id: 'PTV-902', canonical_identity_id: 'identity-target' }];
    if (kind === 'duplicate') tables.user_account.push({ id: 'synthetic-sibling', identity_id: 'identity-target', status_akun: 'active' });
    else tables.user_account.find(a => a.id === targetId)!.status_akun = 'unknown';
    const result = await handleKruApiRequest({ method: 'GET', headers: { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` } });
    expect(result.status).toBe(503);
    expect(result.body.crew).toBeUndefined();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('mapper personel tidak menganggap canonical identity sebagai akun aktif', () => {
    const row = { archive_id: targetId, canonical_identity_id: 'identity-target' } as Parameters<typeof mapLegacyKruRowToCrewMember>[0];
    expect(mapLegacyKruRowToCrewMember(row).status_akun).toBe('Belum Ada Akun');
    expect(mapLegacyKruRowToCrewMember(row, 'inactive').status_akun).toBe('Nonaktif');
    expect(mapLegacyKruRowToCrewMember({ ...row, canonical_identity_id: null }, 'active').status_akun).toBe('Belum Ada Akun');
  });
  it('tidak mengarang status akun saat lookup backend gagal', async () => {
    const db = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { code: 'SYNTHETIC_OUTAGE' } }) }) }) };
    await expect(readPersonnelAccountStatuses(db as never, [{ canonical_identity_id: 'identity-target' } as never])).rejects.toThrow('tidak dapat diverifikasi');
  });
  it('hasil edit personel mempertahankan status login nonaktif', async () => {
    const archive = { archive_id: targetId, ptv_id: 'PTV-902', full_name: 'Synthetic Person', canonical_identity_id: 'identity-target', status: 'aktif', divisi: 'Technical', angkatan: '12', imported_at: '2026-10-01T00:00:00Z' };
    tables.legacy_archive_kru = [archive];
    tables.user_account.find(a => a.id === targetId)!.status_akun = 'inactive';
    mocks.rpc.mockResolvedValue({ data: { ...archive, full_name: 'Synthetic Updated' }, error: null });
    const result = await handleKruApiRequest({ method: 'PATCH', url: `/api/kru?id=${targetId}`, headers: { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` }, body: { full_name: 'Synthetic Updated', version: archive.imported_at } });
    expect(result.status).toBe(200);
    expect(result.body.crew.status_akun).toBe('Nonaktif');
    expect(mocks.rpc).toHaveBeenCalledWith('rpc_update_crew_personnel', expect.any(Object));
  });
  it('menolak ketidaksesuaian identitas aktor dengan akun database', async () => {
    await expect(resolveLiveAccess(mocks as never, { ...session, identity_id: 'other' })).rejects.toThrow('forbidden');
  });
  it('Root tetap dilindungi melalui akun lain pada identitas yang sama', async () => {
    tables.user_account.push({ id: 'root-sibling', identity_id: 'identity-target', status_akun: 'active' });
    tables.account_profiles.push({ account_id: 'root-sibling', profile_id: 'root_executive' });
    expect((await callAccess(change())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(['self', 'root'])('jalur personel menolak target %s sebelum RPC', async kind => {
    tables.legacy_archive_kru = [{ archive_id: targetId, ptv_id: 'PTV-902', full_name: 'Unit Target', canonical_identity_id: kind === 'self' ? 'identity-actor' : 'identity-target', status: 'aktif', imported_at: '2026-10-01T00:00:00Z', metadata_json: { category: 'Kru' } }];
    if (kind === 'root') tables.account_profiles[1].profile_id = 'root_executive';
    const response = await handleKruApiRequest({ method: 'PATCH', url: `/api/kru?id=${targetId}`, headers: { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` }, body: { full_name: 'Updated Unit', version: '2026-10-01T00:00:00Z' } });
    expect(response.status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(['acara','broadcast','catatan','dokumen','kontak','lapor-kerusakan','lost-found','peminjaman','planner'])('API %s menolak grant lama cookie setelah pencabutan di DB', async name => {
    tables.profile_capabilities = [{ profile_id: 'crew', capability_key: 'hub.access' }];
    tables.capability_registry = [{ key: 'hub.access' }];
    const handler = (await import(`../../api/${name}.ts`)).default;
    const req = Readable.from([]) as any;
    req.method = 'GET'; req.url = `/api/${name}?type=external`; req.headers = { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` };
    const res: any = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
    await handler(req, res);
    expect(res.statusCode).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('memakai identitas/capability database dan bukan cookie', async () => {
    const access = await resolveLiveAccess(mocks as never, session);
    expect(access.identity.ptv_id).toBe('PTV-901'); expect(access.can('crew.view')).toBe(true);
    tables.profile_capabilities = [{ profile_id: 'crew', capability_key: 'hub.access' }];
    expect((await resolveLiveAccess(mocks as never, session)).can('crew.permissions.manage')).toBe(false);
  });
  it.each(['user_account', 'canonical_identity', 'organization_membership', 'account_profiles', 'account_capability_overrides', 'profile_capabilities'])('gagal tertutup saat %s tidak dapat dibaca', async table => {
    failTable = table; await expect(resolveLiveAccess(mocks as never, session)).rejects.toThrow('forbidden');
  });
  it.each(['inactive', 'archived'])('keanggotaan %s tidak boleh memutasi', async status => {
    tables.organization_membership[0].status_organisasi = status;
    if (status === 'archived') await expect(resolveLiveAccess(mocks as never, session)).rejects.toThrow('forbidden');
    else expect((await resolveLiveAccess(mocks as never, session)).can('crew.edit')).toBe(false);
  });
  it('akun nonaktif dan sesi dicabut ditolak', async () => {
    tables.user_account[0].status_akun = 'inactive'; await expect(resolveLiveAccess(mocks as never, session)).rejects.toThrow();
    tables.user_account[0].status_akun = 'active'; tables.user_account[0].tokens_valid_after = '2099-01-01'; await expect(resolveLiveAccess(mocks as never, session)).rejects.toThrow();
  });
  it('deny mengalahkan allow dan default profil', async () => {
    tables.account_capability_overrides = ['allow', 'deny'].map(override_type => ({ account_id: actorId, capability_key: 'crew.edit', override_type }));
    expect((await resolveLiveAccess(mocks as never, session)).can('crew.edit')).toBe(false);
  });
  it('izin live tidak dipulihkan oleh default profil frontend', () => {
    expect(hasCapability({ status_akun: 'active', status_organisasi: 'active', assigned_profiles: ['root_executive'], allowed_overrides: [], denied_overrides: [], capabilities: [], capabilities_verified_live: true }, 'crew.edit')).toBe(false);
  });
  it('tidak memverifikasi token tanpa signing secret', () => { expect(verifySessionToken(signSessionToken(session, secret), '')).toBeNull(); expect(() => signSessionToken(session, '')).toThrow(); });
  it('GET akses tanpa login ditolak', async () => { expect((await callAccess(undefined, false)).status).toBe(401); });
  it('GET akses memakai izin live, tidak hanya state frontend', async () => {
    tables.account_capability_overrides = [{ account_id: actorId, capability_key: 'crew.permissions.manage', override_type: 'deny' }];
    expect((await callAccess()).status).toBe(403);
  });
  it('self-escalation akun dan identitas sendiri ditolak', async () => {
    expect((await callAccess({ ...change(), accountId: actorId })).status).toBe(403);
    tables.user_account[1].identity_id = 'identity-actor'; expect((await callAccess(change())).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('target Root dilindungi', async () => { tables.account_profiles[1].profile_id = 'root_executive'; expect((await callAccess(change())).status).toBe(403); });
  it('versi lama ditolak sebelum mutasi', async () => { expect((await callAccess({ ...change(), expectedVersion: 'old' })).status).toBe(409); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it('RPC belum tersedia menghasilkan 503 tanpa sukses palsu', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'PGRST202' }, data: null });
    expect((await callAccess(change())).status).toBe(503);
    expect(mocks.rpc.mock.calls[0][1].p_actor_account_id).toBe(actorId);
  });
  it.each(['assigned_profiles', 'role', 'status_akun', 'oauth_uid'])('API personel menolak manipulasi %s', async key => {
    const res = await handleKruApiRequest({ method: 'POST', headers: { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` }, body: { full_name: 'Unit Person', [key]: 'root_executive' } });
    expect(res.status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('jabatan ketua tidak memberikan hak administratif', async () => {
    tables.organization_membership[0].position_title = 'Ketua'; tables.profile_capabilities = [{ profile_id: 'crew', capability_key: 'hub.access' }];
    expect((await resolveLiveAccess(mocks as never, session)).can('crew.edit')).toBe(false);
  });
  it('allow/deny konflik dan data tak dikenal ditolak oleh kontrak', () => {
    expect(accessChangeSchema.safeParse({ ...change(), allowed: ['crew.view'], denied: ['crew.view'] }).success).toBe(false);
    expect(accessChangeSchema.safeParse({ ...change(), actorId }).success).toBe(false);
    expect(accessChangeSchema.safeParse({ ...change(), confirmed: false }).success).toBe(false);
  });
  it('service gagal HTTP tidak memakai fixtures sebagai data staging', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Denied' }) }));
    await expect(new StagingKruService().getActiveCrewCandidates()).rejects.toThrow('Denied');
    await expect(new StagingKruService().getCrewList()).rejects.toThrow('Denied');
  });
  it('payload personel tidak berisi data akses', () => { expect(personnelFields({ role: 'eksekutif', assigned_profiles: ['root_executive'], full_name: 'Unit Person' })).toEqual({ full_name: 'Unit Person' }); });
  it('kategori eksplisit tidak berubah hanya karena nama jabatan', () => {
    expect(mapLegacyKruRowToCrewMember({ full_name: 'Unit Person', ptv_id: 'PTV-901', jabatan: 'Pengarah acara', metadata_json: { category: 'Kru' } } as never).category).toBe('Kru');
  });
  it('CRUD personel baca ulang backend mock setelah create/edit/nonaktif tanpa menghapus histori', async () => {
    const cookie = { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` };
    const created = await handleKruApiRequest({ method: 'POST', headers: cookie, body: { ptv_id: 'PTV-903', full_name: 'Unit Person', category: 'Kru', division: 'Editor', position: 'Koordinator', angkatan: '12', status_kru: 'Aktif' } });
    expect(created.status).toBe(201);
    const edited = await handleKruApiRequest({ method: 'PATCH', url: '/api/kru?id=PTV-903', headers: cookie, body: { full_name: 'Unit Person Updated', version: created.body.crew.version } });
    expect(edited.status).toBe(200);
    const disabled = await handleKruApiRequest({ method: 'PATCH', url: '/api/kru?id=PTV-903', headers: cookie, body: { status_kru: 'Nonaktif', version: edited.body.crew.version } });
    expect(disabled.status).toBe(200);
    const reload = await handleKruApiRequest({ method: 'GET', headers: cookie });
    expect(reload.body.crew[0].full_name).toBe('Unit Person Updated'); expect(reload.body.crew[0].status_kru).toBe('Nonaktif');
    const candidates = await handleKruApiRequest({ method: 'GET', url: '/api/kru?scope=active_crew', headers: cookie });
    expect(candidates.body.crew).toHaveLength(0); expect(tables.legacy_archive_kru).toHaveLength(1);
  });
  it('dua form dengan versi sama: perubahan kedua ditolak, data pertama tetap', async () => {
    tables.legacy_archive_kru = [{ archive_id: 'unit-archive', production_id: 'unit-person', ptv_id: 'PTV-903', full_name: 'Unit Person', status: 'aktif', imported_at: '2026-10-01T00:00:00Z', metadata_json: {} }];
    const headers = { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` };
    const results = await Promise.all(['first', 'second'].map(name => handleKruApiRequest({ method: 'PATCH', url: '/api/kru?id=PTV-903', headers, body: { full_name: name, version: '2026-10-01T00:00:00Z' } })));
    expect(results.map(r => r.status).sort()).toEqual([200,409]);
    expect(tables.legacy_archive_kru[0].full_name).toBe('first');
  });
  it('kategori Pembina tidak membutuhkan divisi/angkatan dan tidak menjadi kandidat operasional', async () => {
    const headers = { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` };
    const created = await handleKruApiRequest({ method: 'POST', headers, body: { ptv_id: 'PTV-904', full_name: 'Unit Adviser', category: 'Pembina', position: 'Pembina' } });
    expect(created.status).toBe(201); expect(created.body.crew.category).toBe('Pembina');
    expect(tables.legacy_archive_kru[0].angkatan).toBe('');
    expect((await handleKruApiRequest({ method: 'GET', url: '/api/kru?scope=active_crew', headers })).body.crew).toHaveLength(0);
  });
  it('izin status tidak dapat digunakan untuk mengganti jabatan', async () => {
    tables.profile_capabilities = tables.profile_capabilities.filter(row => row.capability_key !== 'crew.edit');
    const res = await handleKruApiRequest({ method: 'PATCH', headers: { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` }, body: { position: 'Ketua' } });
    expect(res.status).toBe(403);
  });

  it('alias status tidak melewati izin pengelolaan status', async () => {
    tables.profile_capabilities = tables.profile_capabilities.filter(row => row.capability_key !== 'crew.status.manage');
    tables.legacy_archive_kru = [{ archive_id: 'unit-archive', ptv_id: 'PTV-903', full_name: 'Unit Person', status: 'aktif', imported_at: '2026-10-01T00:00:00Z' }];
    const result = await handleKruApiRequest({ method: 'PATCH', url: '/api/kru?id=PTV-903', headers: { cookie: `ptv_hub_session=${signSessionToken(session, secret)}` }, body: { status: 'Nonaktif', version: '2026-10-01T00:00:00Z' } });
    expect(result.status).toBe(403); expect(tables.legacy_archive_kru[0].status).toBe('aktif');
  });
  it('RPC conflict concurrency diteruskan sebagai 409 tanpa fallback', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '40001' }, data: null });
    expect((await callAccess(change())).status).toBe(409);
  });

  it('HTTP 200 tanpa konfirmasi sukses database tidak dianggap tersimpan', async () => {
    mocks.rpc.mockResolvedValue({ data: { success: false }, error: null });
    expect((await callAccess(change())).status).toBe(400);
  });

});
