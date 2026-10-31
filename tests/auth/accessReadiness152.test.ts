import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { generateKeyPairSync, sign } from 'node:crypto';
import login from '../../api/auth/login';
import sessionHandler from '../../api/auth/session';
import googleLogin from '../../api/auth/google/login';
import callback from '../../api/auth/google/callback';
import { resolveLiveAccess, LiveAccessUnavailableError } from '../../api/auth/_utils/liveAccess';
import { resolveFinanceAccess } from '../../api/financeAccess';
import { verifyAccountStatusLive, refreshLiveSession } from '../../api/auth/_utils/identity';
import { parseCookies } from '../../api/auth/_utils/cookies';
import { createHmacState, signSessionToken, verifySessionToken, verifyGoogleIdToken, verifyHmacState } from '../../api/auth/_utils/crypto';
import type { ApiRequest, ApiResponse, SessionPayload } from '../../api/auth/_utils/types';

const fixture = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, failedTable: '', sessionValid:true, sessionError:false }));
function from(table: string) {
  const filters: [string, unknown][] = [];
  let single = false;
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    in: (key: string, values: unknown[]) => { filters.push([key, values]); return query; },
    single: () => { single = true; return query; },
    maybeSingle: () => { single = true; return query; },
    then: (resolve: (value: unknown) => unknown) => {
      const rows = (fixture.tables[table] || []).filter(row => filters.every(([key, value]) =>
        Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
      return Promise.resolve(resolve({ data: single ? rows[0] ?? null : rows,
        error: fixture.failedTable === table ? { code: 'SYNTHETIC_UNAVAILABLE' } : null }));
    },
  };
  return query;
}
const rpc = async () => ({data:fixture.sessionValid,error:fixture.sessionError?{message:'synthetic-unavailable'}:null});
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from, rpc }) }));

const secret = 'synthetic-auth152-test-only';
function payload(): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return { account_id: 'account', identity_id: 'identity', username: 'synthetic', full_name: 'Synthetic', ptv_id: 'SYNTHETIC',
    status_akun: 'active', status_organisasi: 'active', assigned_profiles: ['root_executive'],
    capabilities: ['crew.permissions.manage'], iat: now, exp: now + 3600 };
}
function request(body?: unknown, chunks: string[] = []) {
  const req = Readable.from(chunks) as ApiRequest;
  req.method = 'POST'; req.headers = { cookie: `ptv_hub_session=${signSessionToken(payload(), secret)}` };
  req.body = body;
  return req;
}
function response() {
  const headers: Record<string, unknown> = {};
  let body = '';
  const res = { statusCode: 200, setHeader: (key: string, value: unknown) => { headers[key.toLowerCase()] = value; },
    getHeader: (key: string) => headers[key.toLowerCase()], end: (data?: string) => { body = data || ''; } };
  return { res: res as unknown as ApiResponse, headers, body: () => body };
}
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('AUTH_SECRET', secret);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-placeholder');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
  vi.stubEnv('SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
  fixture.failedTable = '';
  fixture.sessionValid = true; fixture.sessionError = false;
  fixture.tables = {
    user_account: [{ id: 'account', identity_id: 'identity', status_akun: 'active', lockout_until: null }],
    canonical_identity: [{ id: 'identity' }],
    organization_membership: [{ identity_id: 'identity', organization_id: 'ptv_studio', is_current: true, status_organisasi: 'active' }],
    account_profiles: [{ account_id: 'account', profile_id: 'crew' }],
    profile_capabilities: [{ profile_id: 'crew', capability_key: 'hub.access' }],
    account_capability_overrides: [],
  };
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected external request'); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Phase1 revocation enforcement across server permission gates', () => {
  const db = { from, rpc } as unknown as Parameters<typeof resolveLiveAccess>[0];
  function verified() { return verifySessionToken(signSessionToken(payload(),secret),secret)!; }
  it('a valid registered check still resolves effective live permissions',async()=>{
    vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED','true');const live=await resolveLiveAccess(db,verified());expect(live.can('hub.access')).toBe(true);
  });
  it.each(['crew','eksekutif','root_executive'])('revocation denies %s despite signed privilege claims',async profile=>{
    vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED','true');fixture.sessionValid=false;const session=verified();session.assigned_profiles=[profile];
    await expect(resolveLiveAccess(db,session)).rejects.toThrow('forbidden');
    await expect(resolveFinanceAccess(db,session)).rejects.toThrow('forbidden');
    expect(await verifyAccountStatusLive(session.account_id,session.iat,session)).toBe(false);
    expect(await refreshLiveSession(session)).toEqual([]);
  });
  it('registry unavailable denies access without treating it as successful verification',async()=>{
    vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED','true');fixture.sessionError=true;
    await expect(resolveLiveAccess(db,verified())).rejects.toBeInstanceOf(LiveAccessUnavailableError);
  });
  it('a revoked session cannot begin a Google linking flow',async()=>{
    vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED','true');fixture.sessionValid=false;
    vi.stubEnv('GOOGLE_CLIENT_ID','synthetic-client');
    const req=request();req.method='GET';req.url='/api/auth/google/login?action=link';
    const out=response();await googleLogin(req,out.res);expect(String(out.headers.location)).toContain('auth_status=error');
    expect(String(out.headers['set-cookie'])).not.toContain('ptv_oauth_state=');
  });
  it('turning issuance flag off cannot bypass a registered session revocation',async()=>{
    vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED','false');fixture.sessionValid=false;const p=payload();p.session_id='90000000-0000-4000-8000-000000000001';
    const session=verifySessionToken(signSessionToken(p,secret),secret)!;
    await expect(resolveLiveAccess(db,session)).rejects.toThrow('forbidden');
    await expect(resolveFinanceAccess(db,session)).rejects.toThrow('forbidden');
    expect(await verifyAccountStatusLive(session.account_id,session.iat,session)).toBe(false);
  });
});

describe('152 password endpoint remains closed without changing an active cookie', () => {
  it.each([{ identifier: 'root', password: 'SYNTHETIC' }, JSON.stringify({ identifier: 'root', password: 'SYNTHETIC' })])('rejects live login for parsed and raw body', async body => {
    const r = response(); await login(request(body), r.res);
    expect(r.res.statusCode).toBe(403); expect(r.body()).toContain('Login password belum tersedia secara aman');
    expect(r.headers['set-cookie']).toBeUndefined(); expect(r.headers['cache-control']).toBe('no-store');
  });
  it.each([null, [], '{', { identifier: 'root' }, { identifier: 'root', password: 'a'.repeat(73) },
    { identifier: 'root', password: 'SYNTHETIC', assigned_profiles: ['root_executive'] }])('rejects malformed, missing or privilege-bearing payload', async body => {
    const r = response(); await login(request(body), r.res);
    expect(r.res.statusCode).toBe(400); expect(r.headers['set-cookie']).toBeUndefined();
  });
  it.each(['parsed', 'stream'])('bounds %s request bytes', async mode => {
    const r = response(); const raw = JSON.stringify({ identifier: 'x'.repeat(5000), password: 'SYNTHETIC' });
    await login(mode === 'parsed' ? request(JSON.parse(raw)) : request(undefined, [raw.slice(0, 2000), raw.slice(2000)]), r.res);
    expect(r.res.statusCode).toBe(413); expect(r.headers['set-cookie']).toBeUndefined();
  });
  it('handles a streamed request through the real blocked resolver', async () => {
    const r = response(); await login(request(undefined, ['{"identifier":"root",', '"password":"SYNTHETIC"}']), r.res);
    expect(r.res.statusCode).toBe(403); expect(r.headers['set-cookie']).toBeUndefined();
  });
});

describe('152 live authorization and cookie preservation', () => {
  it('memverifikasi sesi dari SUPABASE_URL server tanpa mengubah cookie', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const req = request(); req.method = 'GET'; const r = response();
    await sessionHandler(req, r.res);
    expect(r.res.statusCode).toBe(200);
    expect(JSON.parse(r.body()).authenticated).toBe(true);
    expect(r.headers['set-cookie']).toBeUndefined();
  });
  it.each(['missing', 'wrong', 'conflicting'])('gagal tertutup pada konfigurasi server %s', async kind => {
    vi.stubEnv('VITE_SUPABASE_URL', kind === 'conflicting' ? 'https://wrong-project.example.invalid' : '');
    vi.stubEnv('SUPABASE_URL', kind === 'missing' ? '' : kind === 'wrong' ? 'https://wrong-project.example.invalid' : 'https://swadgljnyelsjstqqxbm.supabase.co');
    const req = request(); req.method = 'GET'; const r = response();
    await sessionHandler(req, r.res);
    expect(r.res.statusCode).toBe(503);
    expect(r.body()).not.toContain('authenticated');
    expect(r.headers['set-cookie']).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['2099-01-01T00:00:00Z', 'invalid'])('rejects lockout=%s in both live checks', async lockout => {
    fixture.tables.user_account[0].lockout_until = lockout;
    await expect(resolveLiveAccess({ from } as never, payload())).rejects.toThrow('forbidden');
    expect(await verifyAccountStatusLive('account', payload().iat)).toBe(false);
  });
  it('permits an expired lock but cannot inherit Root privileges from the cookie', async () => {
    fixture.tables.user_account[0].lockout_until = '2000-01-01T00:00:00Z';
    const live = await resolveLiveAccess({ from } as never, payload());
    expect(live.can('hub.access')).toBe(true); expect(live.can('crew.permissions.manage')).toBe(false);
  });
  it.each(['user_account', 'account_capability_overrides', 'profile_capabilities'])('returns 503 on %s outage and keeps cookie', async table => {
    fixture.failedTable = table; const req = request(); req.method = 'GET'; const r = response();
    await sessionHandler(req, r.res);
    expect(r.res.statusCode).toBe(503); expect(r.body()).not.toContain('authenticated'); expect(r.headers['set-cookie']).toBeUndefined();
  });
  it('denies a disabled account without clearing its cookie or returning stale permissions', async () => {
    fixture.tables.user_account[0].status_akun = 'inactive'; const req = request(); req.method = 'GET'; const r = response();
    await sessionHandler(req, r.res);
    expect(JSON.parse(r.body())).toEqual({ authenticated: false, user: null }); expect(r.headers['set-cookie']).toBeUndefined();
  });
  it('denies an expired session before contacting a backend', async () => {
    const req = request(); req.method = 'GET'; req.headers.cookie = `ptv_hub_session=${signSessionToken({ ...payload(), exp: payload().iat - 1 }, secret)}`;
    fixture.failedTable = 'user_account'; const r = response(); await sessionHandler(req, r.res);
    expect(JSON.parse(r.body()).authenticated).toBe(false); expect(r.headers['set-cookie']).toBeUndefined();
  });
  it('denies account-wide revoked cookies', async () => {
    fixture.tables.user_account[0].tokens_valid_after = '2099-01-01T00:00:00Z';
    await expect(resolveLiveAccess({ from } as never, payload())).rejects.toThrow('forbidden');
  });
  it('ignores a malformed unrelated cookie without changing a valid session', () => {
    expect(parseCookies('broken=%ZZ; ptv_hub_session=SYNTHETIC')).toEqual({ ptv_hub_session: 'SYNTHETIC' });
  });
});

describe('152 OIDC assurance using real synthetic RSA signatures', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic152' };
  function idToken(changes: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const data = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ sub: 'synthetic-subject', iss: 'https://accounts.google.com', aud: 'synthetic-client', iat: now, exp: now + 300, nonce: 'synthetic-nonce', ...changes })}`;
    return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
  }
  it('verifies the signature and nonce', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })));
    expect((await verifyGoogleIdToken(idToken(), 'synthetic-client', 'synthetic-nonce'))?.sub).toBe('synthetic-subject');
  });
  it('rejects a forged RSA signature', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })));
    const parts = idToken().split('.'); parts[2] = Buffer.alloc(256).toString('base64url');
    expect(await verifyGoogleIdToken(parts.join('.'), 'synthetic-client', 'synthetic-nonce')).toBeNull();
  });
  it.each([{ nonce: 'wrong' }, { aud: 'wrong' }, { iss: 'https://untrusted.invalid' }, { exp: 1 }, { iat: 9999999999 }])('rejects invalid claims %j', async changes => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })));
    expect(await verifyGoogleIdToken(idToken(changes), 'synthetic-client', 'synthetic-nonce')).toBeNull();
  });
  it('creates a cryptographically random nonce in the signed authorization state', async () => {
    const req = request(); req.method = 'GET'; req.url = '/api/auth/google/login'; req.headers.host = 'localhost';
    const r = response(); await googleLogin(req, r.res);
    const state = new URL(String(r.headers.location)).searchParams.get('state')!;
    expect(verifyHmacState<{ nonce: string }>(state, secret)?.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('rejects access-token-only fallback before identity resolution', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'synthetic-client'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'synthetic-placeholder');
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ access_token: 'SYNTHETIC' }) })); vi.stubGlobal('fetch', fetcher);
    const state = createHmacState({ nonce: 'synthetic-nonce', timestamp: Date.now(), returnTo: '/hub' }, secret);
    const req = request(); req.method = 'GET'; req.url = `/api/auth/google/callback?code=SYNTHETIC&state=${encodeURIComponent(state)}`;
    req.headers.cookie += `; ptv_oauth_state=${encodeURIComponent(`${state}:synthetic-verifier`)}`;
    const r = response(); await callback(req, r.res);
    expect(r.headers.location).toContain('auth_status=error'); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(r.headers['set-cookie'])).not.toContain('ptv_hub_session=');
  });
});
