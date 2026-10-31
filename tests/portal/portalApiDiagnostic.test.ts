import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { PORTAL_SERVER_TIMEOUT_MS } from '../../api/portal';
import { verifyAccountStatusLive, refreshLiveSession } from '../../api/auth/_utils/identity';

vi.mock('../../api/auth/_utils/identity', () => ({
  verifyAccountStatusLive: vi.fn(),
  refreshLiveSession: vi.fn(),
}));
vi.mock('../../api/auth/_utils/crypto', () => ({ verifySessionToken: vi.fn(() => ({ account_id: 'fixture' })) }));

function response() {
  const res = new EventEmitter() as ServerResponse;
  res.setHeader = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockImplementation(() => {
    Object.defineProperty(res, 'writableEnded', { value: true, configurable: true });
    return res;
  });
  return res;
}

function request(entity = 'services', includeDraft = false) {
  return { method: 'GET', url: `/api/portal?entity=${entity}&includeDraft=${includeDraft}`, headers: { host: 'localhost', cookie: 'ptv_hub_session=fixture' } } as IncomingMessage;
}

function body(res: ServerResponse) {
  return JSON.parse(vi.mocked(res.end).mock.calls[0][0] as string);
}

const service = { id: 'published', is_active: true, is_published: true, is_public: true, name_id: 'Published', draft_payload: { name: { id: 'Unpublished draft' } } };
const settings = { id: 'global', is_published: true, hero_title_1: 'Published', hero_title_2: 'Portal', hero_desc: 'Description', draft_payload: { heroDesc: 'Unpublished draft' } };

describe('Portal API diagnostic', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-key');
    vi.stubEnv('AUTH_SECRET', 'fixture-secret');
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('returns published services without draft payloads or session lookups, even with a session cookie', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([service, { ...service, id: 'draft', is_published: false }])));
    vi.stubGlobal('fetch', fetchMock);
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(200);
    expect(body(res).services).toHaveLength(1);
    expect(body(res).services[0].name.id).toBe('Published');
    expect(body(res).services[0].draftPayload).toBeUndefined();
    expect(body(res).services[0].hasDraft).toBe(false);
    expect(verifyAccountStatusLive).not.toHaveBeenCalled();
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('is_published')).toBe('eq.true');
    expect(url.searchParams.get('is_public')).toBe('eq.true');
  });

  it('aborts a stalled upstream request and returns HTTP 504 within the server budget', async () => {
    vi.useFakeTimers();
    let upstreamSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_input, init) => new Promise((_resolve, reject) => {
      upstreamSignal = init.signal;
      upstreamSignal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const res = response();
    const pending = handler(request(), res);
    await vi.advanceTimersByTimeAsync(PORTAL_SERVER_TIMEOUT_MS);
    await pending;
    expect(upstreamSignal?.aborted).toBe(true);
    expect(res.statusCode).toBe(504);
    expect(body(res).code).toBe('portal_timeout');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves draft preview for an authorized operator', async () => {
    vi.mocked(verifyAccountStatusLive).mockResolvedValue(true);
    vi.mocked(refreshLiveSession).mockResolvedValue(['hub.access']);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([service]))));
    const res = response();
    await handler(request('services', true), res);
    expect(res.statusCode).toBe(200);
    expect(body(res).services[0].name.id).toBe('Unpublished draft');
    expect(body(res).services[0].hasDraft).toBe(true);
  });

  it('does not expose draft preview to an unauthenticated request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([service]))));
    const req = request('services', true);
    req.headers.cookie = '';
    const res = response();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(body(res).services[0].name.id).toBe('Published');
    expect(body(res).services[0].draftPayload).toBeUndefined();
  });

  it('returns a measured failure for permission errors without exposing upstream details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: '42501', message: 'private database detail' }), { status: 403 })));
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(500);
    expect(body(res).code).toBe('portal_fetch_error');
    expect(JSON.stringify(body(res))).not.toContain('private database detail');
  });

  it.each([null, { ...settings, is_published: false }])('fails when published settings are unavailable: %j', async (row) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(row))));
    const res = response();
    await handler(request('settings'), res);
    expect(res.statusCode).toBe(503);
    expect(body(res).code).toBe('portal_settings_unavailable');
    expect(body(res).settings).toBeUndefined();
  });

  it('returns a complete published snapshot for entity=all without draft fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('ptv_portal_services')) return new Response(JSON.stringify([service]));
      if (url.includes('ptv_portal_announcements')) return new Response(JSON.stringify({ code: 'PGRST205', message: 'missing table' }), { status: 404 });
      return new Response(JSON.stringify(settings));
    }));
    const res = response();
    await handler(request('all'), res);
    expect(res.statusCode).toBe(200);
    expect(body(res).services).toHaveLength(1);
    expect(body(res).announcements).toEqual([]);
    expect(body(res).settings.heroTitle.line1).toBe('Published');
    expect(JSON.stringify(body(res))).not.toContain('Unpublished draft');
  });

  it('handles missing server configuration as a JSON error', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(500);
    expect(body(res).code).toBe('portal_server_error');
  });
});
