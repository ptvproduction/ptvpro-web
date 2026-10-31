import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { withAuth, withCapability, AuthenticatedRequest } from '../../api/_routes/auth/_utils/middleware';
import * as cookiesMod from '../../api/_routes/auth/_utils/cookies';
import * as cryptoMod from '../../api/_routes/auth/_utils/crypto';
import * as identityMod from '../../api/_routes/auth/_utils/identity';

function createMockReqRes(options?: {
  cookie?: string;
  method?: string;
  session?: any;
  userCaps?: string[];
}) {
  const req = new EventEmitter() as any;
  req.method = options?.method || 'GET';
  req.headers = { cookie: options?.cookie };
  if (options?.session) req.session = options.session;
  if (options?.userCaps) req.userCaps = options.userCaps;

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader: vi.fn((k: string, v: string) => {
      res.headers[k.toLowerCase()] = v;
    }),
    end: vi.fn((chunk?: string) => {
      if (chunk) res.body += chunk;
    }),
  } as any;

  return { req, res };
}

describe('Universal Authentication & Authorization Middleware (middleware.ts)', () => {
  const mockSession: any = {
    account_id: 'acc-123',
    identity_id: 'ident-123',
    ptv_id: 'PTV-001',
    full_name: 'Zaidan Kru',
    username: 'zaidan',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['kru'],
    capabilities: ['hub.access', 'notes.view'],
    iat: Math.floor(Date.now() / 1000) - 100,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AUTH_SECRET = 'test-auth-secret-key-32-bytes-long!';
  });

  it('withAuth menolak request tanpa cookie dengan HTTP 401 unauthenticated', async () => {
    const { req, res } = createMockReqRes({ cookie: undefined });
    const innerHandler = vi.fn();
    const wrapped = withAuth(innerHandler, { moduleName: 'Catatan' });

    await wrapped(req, res);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Catatan.',
      code: 'unauthorized',
    });
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it('withAuth menolak token yang tidak valid atau kedaluwarsa dengan HTTP 401 invalid_session', async () => {
    const { req, res } = createMockReqRes({ cookie: 'ptv_hub_session=invalid.token.signature' });
    vi.spyOn(cookiesMod, 'parseCookies').mockReturnValue({ ptv_hub_session: 'invalid.token.signature' });
    vi.spyOn(cryptoMod, 'verifySessionToken').mockReturnValue(null as any);

    const innerHandler = vi.fn();
    const wrapped = withAuth(innerHandler);

    await wrapped(req, res);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: 'Akses ditolak: Sesi tidak valid atau telah kedaluwarsa.',
      code: 'invalid_session',
    });
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it('withAuth menolak pengguna yang status_akun !== active', async () => {
    const { req, res } = createMockReqRes({ cookie: 'ptv_hub_session=token-suspended' });
    vi.spyOn(cookiesMod, 'parseCookies').mockReturnValue({ ptv_hub_session: 'token-suspended' });
    vi.spyOn(cryptoMod, 'verifySessionToken').mockReturnValue({
      ...mockSession,
      status_akun: 'inactive',
    });

    const innerHandler = vi.fn();
    const wrapped = withAuth(innerHandler);

    await wrapped(req, res);

    expect(res.statusCode).toBe(401);
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it('withAuth menolak pengguna tanpa izin hub.access dengan HTTP 403 forbidden', async () => {
    const { req, res } = createMockReqRes({ cookie: 'ptv_hub_session=valid.token' });
    vi.spyOn(cookiesMod, 'parseCookies').mockReturnValue({ ptv_hub_session: 'valid.token' });
    vi.spyOn(cryptoMod, 'verifySessionToken').mockReturnValue(mockSession);
    vi.spyOn(identityMod, 'refreshLiveSession').mockResolvedValue(['some.other.permission']);

    const innerHandler = vi.fn();
    const wrapped = withAuth(innerHandler);

    await wrapped(req, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: 'Sesi atau izin telah dicabut.',
      code: 'forbidden',
    });
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it('withAuth meloloskan sesi aktif dan menyematkan session serta userCaps ke request', async () => {
    const { req, res } = createMockReqRes({ cookie: 'ptv_hub_session=valid.token' });
    vi.spyOn(cookiesMod, 'parseCookies').mockReturnValue({ ptv_hub_session: 'valid.token' });
    vi.spyOn(cryptoMod, 'verifySessionToken').mockReturnValue(mockSession);
    vi.spyOn(identityMod, 'refreshLiveSession').mockResolvedValue(['hub.access', 'notes.view', 'events.view']);

    let capturedReq: AuthenticatedRequest | null = null;
    const innerHandler = vi.fn(async (r: AuthenticatedRequest) => {
      capturedReq = r;
    });

    const wrapped = withAuth(innerHandler);
    await wrapped(req, res);

    expect(innerHandler).toHaveBeenCalledTimes(1);
    expect(capturedReq).not.toBeNull();
    expect(capturedReq!.session.account_id).toBe('acc-123');
    expect(capturedReq!.userCaps).toContain('hub.access');
    expect(capturedReq!.userCaps).toContain('notes.view');
  });

  it('withCapability menolak jika kapabilitas tunggal tidak terpenuhi', async () => {
    const { req, res } = createMockReqRes({
      session: mockSession,
      userCaps: ['hub.access', 'notes.view'],
    });

    const innerHandler = vi.fn();
    const wrapped = withCapability('notes.delete', innerHandler, {
      deniedMessage: 'Tidak boleh menghapus catatan.',
    });

    await wrapped(req as AuthenticatedRequest, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: 'Tidak boleh menghapus catatan.',
      code: 'forbidden',
    });
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it('withCapability meloloskan jika kapabilitas tunggal terpenuhi', async () => {
    const { req, res } = createMockReqRes({
      session: mockSession,
      userCaps: ['hub.access', 'notes.view'],
    });

    const innerHandler = vi.fn();
    const wrapped = withCapability('notes.view', innerHandler);

    await wrapped(req as AuthenticatedRequest, res);

    expect(innerHandler).toHaveBeenCalledTimes(1);
  });

  it('withCapability mendukung array requirement (OR condition)', async () => {
    const { req, res } = createMockReqRes({
      session: mockSession,
      userCaps: ['hub.access', 'calendar.view'],
    });

    const innerHandler = vi.fn();
    const wrapped = withCapability(['events.view', 'calendar.view'], innerHandler);

    await wrapped(req as AuthenticatedRequest, res);

    expect(innerHandler).toHaveBeenCalledTimes(1);
  });

  it('withCapability mendukung function requirement dinamis (ownership / method)', async () => {
    const { req, res } = createMockReqRes({
      session: mockSession,
      userCaps: ['hub.access'],
      method: 'DELETE',
    });

    const innerHandler = vi.fn();
    // Dinamis: izinkan jika user adalah owner
    const wrapped = withCapability((r) => r.session.ptv_id === 'PTV-001', innerHandler);

    await wrapped(req as AuthenticatedRequest, res);

    expect(innerHandler).toHaveBeenCalledTimes(1);
  });
});
