import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../../src/app/router/ProtectedRoute';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: [], crew: [], stats: {} }) })); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe('Hub integration 164: route boundaries', () => {
  it.each(['staging', 'production'])('does not register development bypasses in %s', async mode => {
    vi.stubEnv('MODE', mode);
    vi.stubEnv('DEV', mode === 'staging');
    vi.stubEnv('VITE_AUTH_BACKEND', 'vercel');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    const { routes } = await import('../../src/app/router');
    expect(routes.some(route => route.path?.startsWith('/dev-'))).toBe(false);
    const hub = routes.find(route => route.path === '/hub');
    expect(hub?.children?.some(route => route.path === 'katalog')).toBe(false);
    const portal = hub?.children?.find(route => route.path === 'portal');
    expect(React.isValidElement(portal?.element)).toBe(true);
    const guard = portal!.element as React.ReactElement<React.ComponentProps<typeof ProtectedRoute>>;
    expect(guard.props.anyCapabilities).toEqual(['settings.system', 'crew.permissions.manage']);
  }, 20000);
  it('keeps previews in local mock development', async () => {
    vi.stubEnv('MODE', 'development'); vi.stubEnv('DEV', true); vi.stubEnv('VITE_AUTH_BACKEND', 'mock');
    const { routes } = await import('../../src/app/router');
    expect(routes.some(route => route.path === '/dev-haul')).toBe(true);
  });
});
