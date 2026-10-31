import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../scripts/lib/inventory170-preview-gateway';

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VITE_APP_ENV', 'staging');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
});
afterEach(() => vi.unstubAllEnvs());
async function call(path: string) {
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
  await handler({ method: 'GET', url: `/api/gateway?__ptv_path=${path}`, headers: {} } as never, res as never);
  return res;
}
describe('Kemasan gateway Preview170 memakai handler aplikasi existing', () => {
  it.each(['inventaris', 'peminjaman', 'lapor-kerusakan'])('anonim %s tetap401', async path => {
    expect((await call(path)).statusCode).toBe(401);
  });
  it('session anonim mengembalikan authenticated=false', async () => {
    const res = await call('auth/session');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.end.mock.calls[0][0]).authenticated).toBe(false);
  });
  it.each(['__proto__', 'missing'])('rute %s tidak dapat memanggil handler lain', async path => {
    expect((await call(path)).statusCode).toBe(404);
  });
  it('menolak target Production sebelum dispatch', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await call('inventaris')).statusCode).toBe(503);
  });
  it('menolak project lain sebelum dispatch', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://invalid.supabase.co');
    expect((await call('inventaris')).statusCode).toBe(503);
  });
});
