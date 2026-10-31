vi.mock('../../api/auth/_utils/liveAccess', () => ({ resolveLiveAccess: async () => ({ account: { id: 'acc-025', username: 'zidna', status_akun: 'active' }, identity: { ptv_id: 'PTV-025', full_name: 'Zidna Santri' }, membership: { division_id: 'technical', position_title: 'Kru', status_organisasi: 'active' }, profiles: ['crew'], context: { capabilities: ['hub.access', 'inventory.view'], allowed_overrides: [], denied_overrides: [] } }) }));
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePkceVerifier,
  generatePkceChallenge,
  createHmacState,
  verifyHmacState,
  signSessionToken,
  verifySessionToken,
} from '../../api/auth/_utils/crypto';
import {
  parseCookies,
  serializeCookie,
  appendSetCookieHeader,
} from '../../api/auth/_utils/cookies';
import { resolveIdentityByGoogleSub } from '../../api/auth/_utils/identity';
import type { SessionPayload } from '../../api/auth/_utils/types';
import loginHandler from '../../api/auth/google/login';
import callbackHandler from '../../api/auth/google/callback';
import sessionHandler from '../../api/auth/session';
import logoutHandler from '../../api/auth/logout';
import { VercelAuthService } from '../../src/core/auth/authService';

const TEST_SECRET = 'super-secret-key-32-chars-long-ptvpro-1234';

function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  cookie?: string;
}) {
  const headers: Record<string, string> = {
    host: 'localhost:5174',
    'x-forwarded-proto': 'http',
    ...options.headers,
  };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  const req: any = {
    method: options.method || 'GET',
    url: options.url || '/',
    headers,
  };

  const setHeaders: Record<string, string | string[]> = {};
  let responseData = '';

  const res: any = {
    statusCode: 200,
    setHeader: vi.fn((name: string, val: string | string[]) => {
      setHeaders[name.toLowerCase()] = val;
    }),
    getHeader: vi.fn((name: string) => {
      return setHeaders[name.toLowerCase()];
    }),
    end: vi.fn((data?: string) => {
      if (data) responseData = data;
    }),
    _getSetHeaders: () => setHeaders,
    _getResponseData: () => responseData,
  };

  return { req, res };
}

describe('PTVPRO Vercel Direct Google OAuth Architecture Tests', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  describe('1. Cryptographic & Security Utilities', () => {
    it('1.1 should generate valid RFC 7636 PKCE verifier and challenge', () => {
      const verifier = generatePkceVerifier();
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43);

      const challenge = generatePkceChallenge(verifier);
      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge).not.toBe(verifier);
      // SHA-256 base64url is 43 characters
      expect(challenge.length).toBe(43);
    });

    it('1.2 should create and verify HMAC-signed CSRF state', () => {
      const payload = { returnTo: '/hub/inventaris', nonce: 'abc123xyz' };
      const state = createHmacState(payload, TEST_SECRET);

      expect(state).toContain('.');
      const verified = verifyHmacState<{ returnTo: string; nonce: string }>(state, TEST_SECRET);
      expect(verified).not.toBeNull();
      expect(verified?.returnTo).toBe('/hub/inventaris');
      expect(verified?.nonce).toBe('abc123xyz');
    });

    it('1.3 should reject tampered HMAC-signed CSRF state', () => {
      const payload = { returnTo: '/hub/inventaris', nonce: 'abc123xyz' };
      const state = createHmacState(payload, TEST_SECRET);
      const tamperedState = state.slice(0, -6) + 'xxxxxx';

      const verified = verifyHmacState(tamperedState, TEST_SECRET);
      expect(verified).toBeNull();
    });

    it('1.4 should sign and verify website session token', () => {
      const sessionPayload: SessionPayload = {
        account_id: 'acc-001',
        identity_id: 'id-001',
        ptv_id: 'PTV-025',
        full_name: 'Zidna Santri',
        username: 'zidna',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        capabilities: ['hub.access', 'inventory.view'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = signSessionToken(sessionPayload, TEST_SECRET);
      expect(token).toBeDefined();

      const verified = verifySessionToken(token, TEST_SECRET);
      expect(verified).not.toBeNull();
      expect(verified?.ptv_id).toBe('PTV-025');
      expect(verified?.capabilities).toContain('hub.access');
    });

    it('1.5 should reject expired session tokens', () => {
      const expiredPayload: SessionPayload = {
        account_id: 'acc-001',
        identity_id: 'id-001',
        ptv_id: 'PTV-025',
        full_name: 'Zidna Santri',
        username: 'zidna',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        capabilities: ['hub.access'],
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      const token = signSessionToken(expiredPayload, TEST_SECRET);
      const verified = verifySessionToken(token, TEST_SECRET);
      expect(verified).toBeNull();
    });
  });

  describe('2. Cookie Utilities', () => {
    it('2.1 should serialize cookie with HttpOnly, Secure, and Lax flags', () => {
      const cookie = serializeCookie('ptv_hub_session', 'token123', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 3600,
        path: '/',
      });

      expect(cookie).toContain('ptv_hub_session=token123');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=3600');
      expect(cookie).toContain('Path=/');
    });

    it('2.2 should parse cookie header correctly', () => {
      const header = 'ptv_hub_session=abc123; ptv_theme=dark; other=val';
      const parsed = parseCookies(header);

      expect(parsed.ptv_hub_session).toBe('abc123');
      expect(parsed.ptv_theme).toBe('dark');
      expect(parsed.other).toBe('val');
    });

    it('2.3 should append set-cookie headers properly', () => {
      const res: any = {
        headers: {} as Record<string, any>,
        getHeader(name: string) {
          return this.headers[name.toLowerCase()];
        },
        setHeader(name: string, val: any) {
          this.headers[name.toLowerCase()] = val;
        },
      };

      appendSetCookieHeader(res, 'cookie1=val1');
      expect(res.getHeader('set-cookie')).toBe('cookie1=val1');

      appendSetCookieHeader(res, 'cookie2=val2');
      expect(Array.isArray(res.getHeader('set-cookie'))).toBe(true);
      expect(res.getHeader('set-cookie')).toEqual(['cookie1=val1', 'cookie2=val2']);
    });
  });

  describe('3. Canonical Identity & Google Sub Resolution', () => {
    it('3.1 should successfully resolve officially linked active crew account with hub.access', async () => {
      const result = await resolveIdentityByGoogleSub('google-sub-ptv-025', 'zidna@ptvpro.com');
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.ptv_id).toBe('PTV-025');
      expect(result.session?.status_akun).toBe('active');
      expect(result.session?.capabilities).toContain('hub.access');
    });

    it('3.2 should reject unlinked Google subject fail-closed', async () => {
      const result = await resolveIdentityByGoogleSub('unknown-google-sub-999', 'stranger@gmail.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('belum ditautkan ke akun kru resmi PTVPRO');
      expect(result.session).toBeUndefined();
    });

    it('3.3 should reject inactive/suspended account fail-closed', async () => {
      const result = await resolveIdentityByGoogleSub('google-sub-inactive', 'inactive@ptvpro.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('sedang berstatus "inactive"');
    });

    it('3.4 should reject account without hub.access capability fail-closed', async () => {
      const result = await resolveIdentityByGoogleSub('google-sub-no-hub-access', 'nohub@ptvpro.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('tidak memiliki izin akses PTV Hub (hub.access)');
    });
  });

  describe('4. Vercel Serverless Endpoint Handlers', () => {
    it('4.1 login.ts should reject non-GET methods', async () => {
      const { req, res } = createMockReqRes({ method: 'POST' });
      await loginHandler(req, res);
      expect(res.statusCode).toBe(405);
    });

    it('4.2 login.ts should redirect to Google OAuth with PKCE and state cookie', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/auth/google/login?returnTo=/hub/inventaris',
      });

      await loginHandler(req, res);
      expect(res.statusCode).toBe(302);

      const location = res._getSetHeaders().location as string;
      expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(location).toContain('response_type=code');
      expect(location).toContain('code_challenge=');
      expect(location).toContain('state=');

      const setCookie = res._getSetHeaders()['set-cookie'] as string;
      expect(setCookie).toContain('ptv_oauth_state=');
      expect(setCookie).toContain('HttpOnly');
    });

    it('4.3 login.ts should sanitize open-redirect attempts in returnTo', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/auth/google/login?returnTo=https://malicious-site.com/steal',
      });

      await loginHandler(req, res);
      expect(res.statusCode).toBe(302);

      const setCookie = res._getSetHeaders()['set-cookie'] as string;
      const cookieVal = decodeURIComponent(setCookie.split('ptv_oauth_state=')[1].split(';')[0]);
      const stateStr = cookieVal.split(':')[0];
      const verified = verifyHmacState<{ returnTo: string }>(stateStr, TEST_SECRET);
      expect(verified?.returnTo).toBe('/hub'); // Sanitized to safe internal default
    });

    it('4.4 callback.ts should handle user cancellation from Google', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/auth/google/callback?error=access_denied',
      });

      await callbackHandler(req, res);
      expect(res.statusCode).toBe(302);
      expect(res._getSetHeaders().location).toContain('/hub/login?auth_error=');
      expect(decodeURIComponent(res._getSetHeaders().location as string)).toContain('dibatalkan oleh pengguna');
    });

    it('4.5 callback.ts should reject missing CSRF state cookie', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/auth/google/callback?code=mock-code&state=fake-state',
      });

      await callbackHandler(req, res);
      expect(res.statusCode).toBe(302);
      expect(decodeURIComponent(res._getSetHeaders().location as string)).toContain('state OAuth telah kedaluwarsa');
    });

    it('4.6 callback.ts should reject mismatched CSRF state', async () => {
      const state1 = createHmacState({ returnTo: '/hub', nonce: 'nonce-state-1' }, TEST_SECRET);
      const state2 = createHmacState({ returnTo: '/hub', nonce: 'nonce-state-2' }, TEST_SECRET);

      const { req, res } = createMockReqRes({
        method: 'GET',
        url: `/api/auth/google/callback?code=mock-code&state=${state1}`,
        cookie: `ptv_oauth_state=${state2}:mock-verifier`,
      });

      await callbackHandler(req, res);
      expect(res.statusCode).toBe(302);
      expect(decodeURIComponent(res._getSetHeaders().location as string)).toContain('CSRF state gagal');
    });

    it('4.7 callback.ts should reject unlinked account fail-closed', async () => {
      const state = createHmacState({ returnTo: '/hub' }, TEST_SECRET);

      const { req, res } = createMockReqRes({
        method: 'GET',
        url: `/api/auth/google/callback?code=mock-auth-code&state=${state}&mock_sub=unlinked-google-sub`,
        cookie: `ptv_oauth_state=${state}:mock-verifier`,
      });

      await callbackHandler(req, res);
      expect(res.statusCode).toBe(302);
      expect(decodeURIComponent(res._getSetHeaders().location as string)).toContain('belum ditautkan ke akun kru resmi PTVPRO');
    });

    
    it('4.7b callback.ts should include auth_status=unlinked on unlinked account', async () => {
      const state = createHmacState({ returnTo: '/hub' }, TEST_SECRET);

      const { req, res } = createMockReqRes({
        method: 'GET',
        url: `/api/auth/google/callback?code=mock-auth-code&state=${state}&mock_sub=unlinked-sub-999`,
        cookie: `ptv_oauth_state=${state}:mock-verifier`,
      });

      await callbackHandler(req, res);
      expect(res.statusCode).toBe(302);
      const loc = res._getSetHeaders().location as string;
      expect(loc).toContain('auth_status=unlinked');
      expect(loc).toContain('auth_error=');
    });

    it('4.7c callback.ts should include auth_status=access_denied for suspended account', async () => {
      const state = createHmacState({ returnTo: '/hub' }, TEST_SECRET);

      const { req, res } = createMockReqRes({
        method: 'GET',
        url: `/api/auth/google/callback?code=mock-auth-code&state=${state}&mock_sub=google-sub-inactive`,
        cookie: `ptv_oauth_state=${state}:mock-verifier`,
      });

      await callbackHandler(req, res);
      expect(res.statusCode).toBe(302);
      const loc = res._getSetHeaders().location as string;
      expect(loc).toContain('auth_status=access_denied');
      expect(loc).toContain('auth_error=');
    });

    it('4.8 callback.ts should complete login, set ptv_hub_session HttpOnly cookie, and redirect to returnTo', async () => {
      const state = createHmacState({ returnTo: '/hub/inventaris' }, TEST_SECRET);

      const { req, res } = createMockReqRes({
        method: 'GET',
        url: `/api/auth/google/callback?code=mock-auth-code&state=${state}&mock_sub=google-sub-ptv-025`,
        cookie: `ptv_oauth_state=${state}:mock-verifier`,
      });

      await callbackHandler(req, res);
      expect(res.statusCode).toBe(302);
      expect(res._getSetHeaders().location).toBe('/hub/login?auth_status=success&returnTo=%2Fhub%2Finventaris');

      const setCookies = res._getSetHeaders()['set-cookie'] as string[];
      expect(Array.isArray(setCookies)).toBe(true);

      const sessionCookie = setCookies.find((c) => c.includes('ptv_hub_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
    });

    it('4.9 session.ts should return unauthenticated when no cookie provided', async () => {
      const { req, res } = createMockReqRes({ method: 'GET', url: '/api/auth/session' });
      await sessionHandler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getResponseData());
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
    });

    it('4.10 session.ts should return live user when valid cookie is provided', async () => {
      process.env.VITE_SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-only-key';
      const sessionPayload: SessionPayload = {
        account_id: 'acc-025',
        identity_id: 'id-025',
        ptv_id: 'PTV-025',
        full_name: 'Zidna Santri',
        username: 'zidna',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['crew'],
        capabilities: ['hub.access', 'inventory.view'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = signSessionToken(sessionPayload, TEST_SECRET);
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/auth/session',
        cookie: `ptv_hub_session=${token}`,
      });

      await sessionHandler(req, res);
      expect(res.statusCode).toBe(200);

      const data = JSON.parse(res._getResponseData());
      expect(data.authenticated).toBe(true);
      expect(data.user.ptv_id).toBe('PTV-025');
      expect(data.user.capabilities).toContain('hub.access');
    });

    it('4.11 logout.ts should clear session cookie with Max-Age=0', async () => {
      const { req, res } = createMockReqRes({ method: 'POST', url: '/api/auth/logout' });
      await logoutHandler(req, res);

      expect(res.statusCode).toBe(200);
      const setCookie = res._getSetHeaders()['set-cookie'] as string;
      expect(setCookie).toContain('ptv_hub_session=');
      expect(setCookie).toContain('Max-Age=0');
      const data = JSON.parse(res._getResponseData());
      expect(data.success).toBe(true);
    });
  });

  describe('5. Client VercelAuthService Adapter Integration', () => {
    it('preserves client state when server session revocation fails', async () => {
      const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({authenticated:true,user:{id:'synthetic-account',ptv_id:'SYNTHETIC',full_name:'Synthetic',username:'synthetic',status_akun:'active',assigned_profiles:['crew'],capabilities:['hub.access']}})}).mockResolvedValue({ok:false,status:503});
      vi.stubGlobal('fetch',fetcher);
      const service=new VercelAuthService();const before=await service.getCurrentSession();expect(before).not.toBeNull();
      const notify=vi.fn();service.onAuthStateChange(notify);notify.mockClear();
      await expect(service.logout()).rejects.toThrow('Logout belum berhasil');expect(notify).not.toHaveBeenCalled();
      expect(await service.getCurrentSession()).toBe(before);
      vi.unstubAllGlobals();
    });
    it('5.1 should redirect window.location to /api/auth/google/login on loginWithOAuth', async () => {
      const service = new VercelAuthService();
      const mockLocation = { href: '' };
      vi.stubGlobal('window', { location: mockLocation });

      await service.loginWithOAuth({
        provider: 'google',
        redirectTo: '/hub/kalender',
      });

      expect(mockLocation.href).toBe('/api/auth/google/login?returnTo=%2Fhub%2Fkalender');
      vi.unstubAllGlobals();
    });

    it('5.2 should call /api/auth/logout on logout() and clear local session state', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const service = new VercelAuthService();
      await service.logout();

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      const session = await service.getCurrentSession();
      expect(session).toBeNull();

      vi.unstubAllGlobals();
    });
  });
});
