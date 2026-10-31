import { describe, it, expect, vi } from 'vitest';
import handler, { resolveRouteKey, routes } from '../api/[...route]';

describe('PTVPRO Serverless Function Centralized Router', () => {
  it('registers all 25 official endpoints', () => {
    const registeredRoutes = Object.keys(routes);
    expect(registeredRoutes.length).toBe(25);
    expect(registeredRoutes).toContain('acara');
    expect(registeredRoutes).toContain('akses');
    expect(registeredRoutes).toContain('broadcast');
    expect(registeredRoutes).toContain('catatan');
    expect(registeredRoutes).toContain('dokumen');
    expect(registeredRoutes).toContain('finance');
    expect(registeredRoutes).toContain('inventaris');
    expect(registeredRoutes).toContain('kontak');
    expect(registeredRoutes).toContain('kru');
    expect(registeredRoutes).toContain('lapor-kerusakan');
    expect(registeredRoutes).toContain('lost-found');
    expect(registeredRoutes).toContain('peminjaman');
    expect(registeredRoutes).toContain('planner');
    expect(registeredRoutes).toContain('portal');
    expect(registeredRoutes).toContain('portofolio');
    expect(registeredRoutes).toContain('upload-avatar');
    expect(registeredRoutes).toContain('verifikasi-surat');
    expect(registeredRoutes).toContain('auth/change-password');
    expect(registeredRoutes).toContain('auth/login');
    expect(registeredRoutes).toContain('auth/logout');
    expect(registeredRoutes).toContain('auth/session');
    expect(registeredRoutes).toContain('auth/google/callback');
    expect(registeredRoutes).toContain('auth/google/login');
    expect(registeredRoutes).toContain('auth/google/status');
    expect(registeredRoutes).toContain('auth/google/unlink');
  });

  describe('resolveRouteKey', () => {
    it('resolves route key from Vercel catch-all array query param', () => {
      expect(resolveRouteKey({ query: { route: ['auth', 'session'] } })).toBe('auth/session');
      expect(resolveRouteKey({ query: { route: ['acara'] } })).toBe('acara');
      expect(resolveRouteKey({ query: { route: ['auth', 'google', 'login'] } })).toBe('auth/google/login');
    });

    it('resolves route key from Vercel rewrite header x-forwarded-uri', () => {
      expect(resolveRouteKey({
        headers: { 'x-forwarded-uri': '/api/dokumen?action=create' }
      })).toBe('dokumen');

      expect(resolveRouteKey({
        headers: { 'x-forwarded-uri': '/api/auth/google/callback?code=test' }
      })).toBe('auth/google/callback');
    });

    it('resolves route key from req.url fallback', () => {
      expect(resolveRouteKey({ url: '/api/finance?operational=1' })).toBe('finance');
      expect(resolveRouteKey({ url: '/api/kontak?type=internal' })).toBe('kontak');
      expect(resolveRouteKey({ url: '/api' })).toBe('');
      expect(resolveRouteKey({ url: '/api/' })).toBe('');
    });
  });

  describe('router execution', () => {
    function createMockRes() {
      const res: any = {
        statusCode: 200,
        headers: {},
        setHeader: vi.fn((k: string, v: string) => { res.headers[k] = v; }),
        end: vi.fn(),
      };
      return res;
    }

    it('returns 200 status on root /api request', async () => {
      const req = { url: '/api' };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('ptvpro-api');
      expect(body.routes.length).toBe(25);
    });

    it('returns 404 JSON on unknown endpoint without returning HTML', async () => {
      const req = { url: '/api/endpoint-yang-tidak-ada' };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error).toContain('Endpoint tidak ditemukan');
      expect(body.code).toBe('endpoint_not_found');
    });

    it('dispatches to sessionHandler when /api/auth/session is requested', async () => {
      const req = {
        method: 'GET',
        url: '/api/auth/session',
        headers: {},
      };
      const res = createMockRes();

      await handler(req, res);

      // Without valid session cookie, session handler returns 401 unauthenticated
      expect([200, 401]).toContain(res.statusCode);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.authenticated).toBe(false);
    });
  });
});
