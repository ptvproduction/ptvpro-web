import { describe, it, expect, vi } from 'vitest';
import acaraHandler from '../api/_routes/acara';
import uploadAvatarHandler from '../api/_routes/upload-avatar';
import loginHandler from '../api/_routes/auth/login';

describe('Local/Production Parity Fixes Verification', () => {
  it('acaraHandler handles pre-parsed body without waiting for stream', async () => {
    const req: any = {
      method: 'POST',
      url: '/api/acara',
      headers: { cookie: '' },
      body: { title: 'Test Acara' },
    };
    const res: any = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    // Should reject unauthorized gracefully without hanging/timeout
    await acaraHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.end).toHaveBeenCalled();
  });

  it('uploadAvatarHandler validates pre-parsed body and rejects unauthorized without stream hanging', async () => {
    const req: any = {
      method: 'POST',
      url: '/api/upload-avatar',
      headers: { cookie: '' },
      body: { data: 'invalid-base64', ptv_id: 'PTV-001' },
    };
    const res: any = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await uploadAvatarHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.end).toHaveBeenCalled();
  });

  it('loginHandler allows canonical pair origin ptvpro.com with www.ptvpro.com host', async () => {
    const req: any = {
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        host: 'www.ptvpro.com',
        origin: 'https://ptvpro.com',
      },
      body: { identifier: 'PTV-999', password: 'testpassword' },
    };
    const res: any = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await loginHandler(req, res);
    // Should NOT be 403 Origin tidak diizinkan, but proceeds to auth check (e.g. 401 or 503)
    expect(res.statusCode).not.toBe(403);
  });

  it('loginHandler rejects unauthorized foreign origin strictly', async () => {
    const req: any = {
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        host: 'www.ptvpro.com',
        origin: 'https://attacker.com',
      },
      body: { identifier: 'PTV-999', password: 'testpassword' },
    };
    const res: any = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await loginHandler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Origin tidak diizinkan'));
  });
});
