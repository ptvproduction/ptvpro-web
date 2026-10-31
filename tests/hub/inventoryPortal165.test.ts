import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { inventoryImageType, inventoryRequestId } from '../../api/inventaris';
import { signSessionToken } from '../../api/auth/_utils/crypto';
import type { SessionPayload } from '../../api/auth/_utils/types';
import { SupabaseInventarisService, InventarisServiceManager } from '../../src/products/hub/inventaris/inventarisService';

const f = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, caps: [] as string[], valid: true,
  rpc: vi.fn(), upload: vi.fn(), direct: vi.fn(), selected: [] as string[], values: [] as any[], auditFails: false, rpcError: null as any }));
const actor = '10000000-0000-4000-8000-000000000001';
const identity = '20000000-0000-4000-8000-000000000001';
const asset = '30000000-0000-4000-8000-000000000001';
const key = '40000000-0000-4000-8000-000000000001';
const secret = 'synthetic-inventory165-secret-test-only';
function from(table: string) {
  let single = false; let mutation = ''; let value: any;
  const filters: [string, unknown][] = [];
  const q: any = {
    select: (columns: string) => { if (table === 'ptv_inventaris') f.selected.push(columns); return q; }, order: () => q, limit: () => q, or: () => q,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; }, in: () => q,
    single: () => { single = true; return q; }, maybeSingle: () => { single = true; return q; },
    insert: (v: unknown) => { mutation = 'insert'; value = v; return q; },
    upsert: (v: unknown) => { mutation = 'upsert'; value = v; return q; },
    delete: () => { mutation = 'delete'; return q; },
    then: (resolve: (v: unknown) => unknown) => {
      const rows = (f.tables[table] || []).filter(r => filters.every(([k, v]) => r[k] === v));
      let data: any = single ? rows[0] || null : rows;
      if (mutation === 'insert') { if (!f.auditFails) (f.tables[table] ||= []).push(value); data = null; }
      if (mutation === 'upsert') { f.values.push(value); data = { id: 'value-row', ...value }; }
      if (mutation === 'delete') data = [{ id: 'value-row' }];
      return Promise.resolve({ data, error: f.auditFails && table === 'auth_audit_log' ? { code: 'SYNTHETIC' } : null }).then(resolve);
    },
  };
  return q;
}
const rpc = async (name: string, args: any) => {
  f.rpc(name, args);
  if (name === 'rpc_portal_session_valid') return { data: f.valid, error: null };
  return { data: f.rpcError ? null : { id: args.p_master.id }, error: f.rpcError };
};
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from, rpc,
  storage: { getBucket: async () => ({ data: { id: 'inventory' }, error: null }), from: () => ({ upload: f.upload,
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/${path}` } }) }) } }) }));
vi.mock('../../src/core/supabase', () => ({ isSupabaseConfigured: () => true, getSupabaseClient: () => ({
  from: (table: string) => { f.direct(table); return from(table); }, rpc: f.direct }) }));
function session(): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return { account_id: actor, identity_id: identity, ptv_id: 'SYNTHETIC', full_name: 'Synthetic', username: 'synthetic',
    status_akun: 'active', status_organisasi: 'active', assigned_profiles: ['root_executive'], capabilities: ['inventory.create'],
    iat: now, exp: now + 3600, session_id: '50000000-0000-4000-8000-000000000001' };
}
async function call(action: string, payload: unknown = {}, options: { anon?: boolean; method?: string; origin?: string; body?: Buffer; type?: string; expired?: boolean; length?: string } = {}) {
  const read = options.method === 'GET';
  const s = session(); if (options.expired) s.exp = s.iat - 1;
  const req = Object.assign(Readable.from(options.body ? [options.body] : []), {
    method: options.method || 'POST', url: read ? `/?action=${action}&payload=${encodeURIComponent(JSON.stringify(payload))}` : `/?action=${options.body ? action : ''}`,
    headers: { host: 'localhost:5174', origin: options.origin || 'http://localhost:5174', 'content-type': options.type || 'application/json',
      ...(!options.anon ? { cookie: `ptv_hub_session=${signSessionToken(s, secret)}` } : {}), ...(options.length ? { 'content-length': options.length } : {}) },
    ...(!read && !options.body ? { body: { action, payload } } : {}),
  });
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
  await handler(req as never, res as never);
  return { status: res.statusCode, body: JSON.parse(res.end.mock.calls[0][0]), headers: res.setHeader.mock.calls };
}
const create = () => ({ p_master: { id: key, request_id: key, kode: 'INV-800', nama_alat: 'Synthetic', kategori: 'Kamera' },
  p_units: [{ kode_unit: 'INV-800-U01', kondisi: 'bagus', status_peminjaman: 'tersedia' }] });
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-placeholder');
  vi.stubEnv('AUTH_SECRET', secret); vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED', 'true');
  f.caps = ['hub.access', 'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.units.manage', 'inventory.valuation.view', 'inventory.valuation.manage'];
  f.valid = true; f.auditFails = false; f.rpcError = null; f.selected = []; f.values = []; vi.clearAllMocks();
  f.upload.mockResolvedValue({ data: { path: 'synthetic' }, error: null });
  f.tables = { user_account: [{ id: actor, identity_id: identity, status_akun: 'active' }], canonical_identity: [{ id: identity }],
    organization_membership: [{ identity_id: identity, organization_id: 'ptv_studio', is_current: true, status_organisasi: 'active' }],
    account_profiles: [{ account_id: actor, profile_id: 'crew' }], account_capability_overrides: [],
    profile_capabilities: f.caps.map(capability_key => ({ profile_id: 'crew', capability_key })),
    ptv_inventaris: [{ id: asset, kode: 'INV-001', nama_alat: 'Synthetic', kategori: 'Kamera', units: [], created_at: '2026-01-01' }], auth_audit_log: [] };
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Inventaris Portal165: server cookie and operation permissions (synthetic)', () => {
  it.each(['list', 'detail', 'valuations', 'next-code', 'diagnostics'])('anonymous %s is rejected', async action => {
    expect((await call(action, {}, { method: 'GET', anon: true })).status).toBe(401); expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(['create', 'update', 'valuation-save', 'valuation-delete', 'unit-status'])('read-only user cannot %s despite Root cookie claims', async action => {
    f.tables.profile_capabilities = [{ capability_key: 'hub.access' }, { capability_key: 'inventory.view' }];
    expect((await call(action)).status).toBe(403);
    expect(f.rpc.mock.calls.every(([name]) => name === 'rpc_portal_session_valid')).toBe(true);
  });
  it('rejects expired or revoked sessions and foreign origins', async () => {
    expect((await call('list', {}, { expired: true, method: 'GET' })).status).toBe(401);
    f.valid = false; expect((await call('list', {}, { method: 'GET' })).status).toBe(403);
    f.valid = true; expect((await call('create', create(), { origin: 'https://foreign.invalid' })).status).toBe(403);
  });
  it('rejects a non-Staging backend before database access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://wrong-project.invalid');
    expect((await call('list', {}, { method: 'GET' })).status).toBe(503); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('reads with live inventory.view and does not query valuation columns without a grant', async () => {
    f.tables.profile_capabilities = [{ capability_key: 'hub.access' }, { capability_key: 'inventory.view' }];
    expect((await call('list', {}, { method: 'GET' })).status).toBe(200);
    expect(f.selected[0]).not.toContain('nilai:'); expect(f.selected[0]).not.toContain('harga_beli');
    expect((await call('valuations', {}, { method: 'GET' })).status).toBe(403);
  });
  it('creates through atomic RPC with actor-scoped idempotency and canonical audit actor', async () => {
    const first = await call('create', create()); const second = await call('create', create());
    expect(first.status).toBe(200); expect(first.body.data.id).toBe(second.body.data.id);
    expect(first.body.data.id).toBe(inventoryRequestId(actor, key, secret)); expect(first.body.data.id).not.toBe(key);
    expect(inventoryRequestId(identity, key, secret)).not.toBe(first.body.data.id);
    expect(f.tables.auth_audit_log[0]).toMatchObject({ actor_id: identity, metadata: { account_id: actor } });
  });
  it('rejects injected actor fields, borrowed initial units, and invalid valuation', async () => {
    expect((await call('create', { ...create(), p_master: { ...create().p_master, created_by: actor } })).status).toBe(400);
    expect((await call('create', { ...create(), p_units: [{ ...create().p_units[0], status_peminjaman: 'dipinjam' }] })).status).toBe(400);
    expect((await call('create', { ...create(), p_units: [{ ...create().p_units[0], kondisi: 'rusak' }] })).status).toBe(400);
    expect((await call('valuation-save', { assetId: asset, data: { nilai_perolehan: -1 } })).status).toBe(400);
  });
  it('blocks manual loan-state changes even for an inventory manager', async () => {
    expect((await call('unit-status', { unitId: key, status: 'tersedia' })).status).toBe(409);
  });
  it('does not submit mutation without an audit intent', async () => {
    f.auditFails = true; expect((await call('create', create())).status).toBe(503);
    expect(f.rpc.mock.calls.some(([name]) => name === 'rpc_create_inventaris')).toBe(false);
  });
  it('propagates cross-asset RPC rejection and conflict without confirming success', async () => {
    f.rpcError = { code: '42501' };
    const dto = { p_master: { id: asset, nama_alat: 'Synthetic', kategori: 'Kamera' }, p_units: [{ id: key, kode_unit: 'OTHER-U01', kondisi: 'bagus' }] };
    expect((await call('update', dto)).status).toBe(403);
    f.rpcError = { code: '40001' }; expect((await call('update', dto)).status).toBe(409);
  });
  it('acknowledges valuation save/delete and retains zero book value', async () => {
    expect((await call('valuation-save', { assetId: asset, data: { nilai_perolehan: 100, nilai_tercatat: 0, vendor: 'Synthetic Vendor', nomor_invoice: 'SYN-165', status: 'Dihapuskan' } })).status).toBe(200);
    expect(f.values[0]).toMatchObject({ nilai_buku_saat_ini: 0, vendor: 'Synthetic Vendor', nomor_invoice: 'SYN-165', status: 'Dihapuskan' });
    expect((await call('valuation-delete', { assetId: asset })).body.data).toBe(true);
  });
  it('uploads immutable images only through the verified server storage client', async () => {
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    const result = await call('upload', {}, { body: image, type: 'image/jpeg' });
    expect(result.status).toBe(200); expect(result.body.data).toContain(`/inventory/catalog/portal/${actor}/`);
    expect(f.upload).toHaveBeenCalledWith(expect.stringContaining(actor), image, expect.objectContaining({ upsert: false }));
  });
  it('rejects anonymous/no-permission uploads, SVG, MIME spoofing and oversized data', async () => {
    const image = Buffer.from([0xff, 0xd8, 0xff]);
    expect((await call('upload', {}, { anon: true, body: image, type: 'image/jpeg' })).status).toBe(401);
    expect((await call('upload', {}, { body: Buffer.from('<svg/>'), type: 'image/svg+xml' })).status).toBe(415);
    expect((await call('upload', {}, { body: image, type: 'image/png' })).status).toBe(415);
    expect((await call('upload', {}, { body: image, type: 'image/jpeg', length: '5000000' })).status).toBe(413);
    f.tables.profile_capabilities = [{ capability_key: 'hub.access' }];
    expect((await call('upload', {}, { body: image, type: 'image/jpeg' })).status).toBe(403);
    expect(f.upload).not.toHaveBeenCalled(); expect(inventoryImageType(Buffer.from('<html>'))).toBeNull();
  });
  it('cannot attach another actor photo to an asset', async () => {
    const data = create(); (data.p_master as any).foto_url = `https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/catalog/portal/${identity}/a.jpg`;
    expect((await call('create', data)).status).toBe(403);
  });
});

describe('Inventory client: Staging cannot fall back to mock/native writes', () => {
  it('retains server valuation metadata on reload', async () => {
    vi.stubEnv('MODE', 'staging');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {
      id: asset, kode: 'INV-001', nama_alat: 'Synthetic', kategori: 'Kamera', units: [],
      nilai: { id: key, nilai_perolehan: 100, nilai_buku_saat_ini: 0, vendor: 'Synthetic Vendor', nomor_invoice: 'SYN-165', status: 'Dihapuskan', nilai_residu: 0 },
    } }) }));
    expect((await new SupabaseInventarisService().getInventarisById(asset))?.nilai_inventaris).toMatchObject({
      nilai_tercatat: 0, vendor: 'Synthetic Vendor', nomor_invoice: 'SYN-165', status: 'Dihapuskan', nilai_residu: 0,
    });
  });
  it.each(['staging', 'production'])('MODE %s with APP_ENV staging uses cookie API even if local adapter requested', async mode => {
    vi.stubEnv('MODE', mode); vi.stubEnv('VITE_APP_ENV', 'staging'); vi.stubEnv('VITE_INVENTARIS_BACKEND', 'local');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    vi.stubGlobal('fetch', fetcher);
    const manager = new InventarisServiceManager(); expect(manager.getActiveBackend()).toBe('supabase');
    expect(() => manager.setBackendAdapter('local')).toThrow('mock');
    expect(await manager.getInventarisList()).toEqual([]);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/inventaris?action=list'), expect.objectContaining({ credentials: 'same-origin' }));
    expect(f.direct).not.toHaveBeenCalled();
  });
  it('denied writes are errors and never become local success', async () => {
    vi.stubEnv('MODE', 'staging'); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Sesi dicabut' }) }));
    await expect(new SupabaseInventarisService().updateNilaiInventaris(asset, { nilai_perolehan: 100 })).rejects.toThrow('Sesi dicabut');
  });
});
