import { afterEach, describe, expect, it, vi } from 'vitest';
import { VercelAuthService, LOCAL_DEV_MOCK_USERS, getAuthService, setAuthServiceForTesting } from '../../src/core/auth/authService';
import { normalizeAuthUser } from '../../src/core/auth/normalize';
import * as auth from '../../src/core/auth';
import { useSessionStore } from '../../src/core/session/sessionStore';

const user = { id: 'synthetic-account', ptv_id: 'SYNTHETIC', username: 'synthetic', full_name: 'Synthetic', status_akun: 'active', assigned_profiles: ['crew'], capabilities: ['hub.access'], capabilities_verified_live: true };
const response = (body: unknown) => ({ ok: true, json: async () => body });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); setAuthServiceForTesting(null); useSessionStore.setState({ session: null, user: null, error: null, isLoading: false }); });

describe('Phase1 operational authentication — synthetic client regression', () => {
  it.each(['staging', 'production'])('does not select mock in %s when the backend is misconfigured', mode => {
    setAuthServiceForTesting(null); vi.stubEnv('MODE', mode); vi.stubEnv('DEV', mode !== 'production'); vi.stubEnv('VITE_AUTH_BACKEND', 'mock');
    expect(() => getAuthService()).toThrow('Akses ditutup');
  });
  it.each(['network', 'missing', 'malformed'])('server login cannot fall back to mock on %s', async failure => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ authenticated: false }));
    if (failure === 'network') fetcher.mockRejectedValue(new Error('offline'));
    else if (failure === 'malformed') fetcher.mockResolvedValue({ ok: true, json: async () => { throw new Error('invalid'); } });
    vi.stubGlobal('fetch', fetcher);
    const service = new VercelAuthService(); await service.getCurrentSession();
    if (failure === 'missing') vi.stubGlobal('fetch', undefined);
    const result = await service.login({ identifier: Object.values(LOCAL_DEV_MOCK_USERS)[0].username, password: 'synthetic-wrong-password' });
    expect(result.success).toBe(false); expect(await service.getCurrentSession()).toBeNull();
  });
  it('does not invent an operational division or position for nonoperational personnel', () => {
    expect(normalizeAuthUser(user)).toMatchObject({ division: '', position: '' });
  });
  it('refresh removes revoked capabilities and denies inactive accounts', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ authenticated: true, user })); vi.stubGlobal('fetch', fetcher);
    const service = new VercelAuthService(); await service.getCurrentSession();
    fetcher.mockResolvedValue(response({ authenticated: true, user: { ...user, capabilities: [] } }));
    await service.refreshSession(); expect((await service.getCurrentSession())?.user.capabilities).toEqual([]);
    fetcher.mockResolvedValue(response({ authenticated: true, user: { ...user, status_akun: 'inactive' } }));
    await service.refreshSession(); expect(await service.getCurrentSession()).toBeNull();
  });
  it('server outage denies cached permissions without invoking logout', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ authenticated: true, user })); vi.stubGlobal('fetch', fetcher);
    const service = new VercelAuthService(); await service.getCurrentSession();
    fetcher.mockResolvedValue({ ok: false, status: 503 }); await service.refreshSession();
    expect(await service.getCurrentSession()).toBeNull();
    expect(fetcher.mock.calls.every(([url]) => url === '/api/auth/session')).toBe(true);
  });
  it('polls with a subscriber and stops on unsubscribe', async () => {
    vi.useFakeTimers(); const fetcher = vi.fn().mockResolvedValue(response({ authenticated: true, user })); vi.stubGlobal('fetch', fetcher);
    const service = new VercelAuthService(); await service.getCurrentSession(); const stop = service.onAuthStateChange(vi.fn());
    await vi.advanceTimersByTimeAsync(30_000); expect(fetcher).toHaveBeenCalledTimes(2);
    stop(); await vi.advanceTimersByTimeAsync(30_000); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('an in-flight refresh cannot restore a logged-out session', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ authenticated: true, user })); vi.stubGlobal('fetch', fetcher);
    const service = new VercelAuthService(); await service.getCurrentSession();
    let finish!: (value: unknown) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const refresh = service.refreshSession(); await service.logout(); finish(response({ authenticated: true, user })); await refresh;
    expect(await service.getCurrentSession()).toBeNull();
  });
  it('an initial session response cannot replace a newer successful login', async () => {
    let finish!: (value: unknown) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(response({ success: true, user }));
    vi.stubGlobal('fetch', fetcher); const service = new VercelAuthService();
    expect((await service.login({ identifier: 'synthetic', password: 'synthetic-only-password' })).success).toBe(true);
    finish(response({ authenticated: false })); expect((await service.getCurrentSession())?.user.id).toBe(user.id);
  });
  it('store keeps the session and reports failure when durable logout fails', async () => {
    vi.spyOn(auth, 'getAuthService').mockReturnValue({ logout: async () => { throw new Error('unavailable'); } } as never);
    const session = { user: normalizeAuthUser(user)!, access_token: 'synthetic-cookie', expires_at: Date.now() + 1000 };
    useSessionStore.setState({ session, user: session.user, isLoading: false });
    await useSessionStore.getState().logout(); expect(useSessionStore.getState().session).toBe(session);
    expect(useSessionStore.getState().error).toBe('Logout belum berhasil. Coba lagi.');
  });
});
