import { afterEach, describe, expect, it, vi } from 'vitest';
import { financeBackendUrl } from '../../api/_routes/auth/_utils/financeLocalHarness';
afterEach(() => vi.unstubAllEnvs());
describe('Finance local harness binding', () => {
  it('accepts only the explicit loopback test endpoint', () => {
    vi.stubEnv('PTV_FINANCE_LOCAL_E2E', 'true'); vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:55441');
    expect(financeBackendUrl()).toBe('http://127.0.0.1:55441');
  });
  it.each(['production', 'development'])('rejects local override in %s', mode => {
    vi.stubEnv('PTV_FINANCE_LOCAL_E2E', 'true'); vi.stubEnv('NODE_ENV', mode);
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:55441');
    expect(financeBackendUrl).toThrow();
  });
  it.each(['http://localhost:55441', 'http://127.0.0.1:55442', 'https://example.com', 'http://127.0.0.1:55441/'])('rejects endpoint %s', url => {
    vi.stubEnv('PTV_FINANCE_LOCAL_E2E', 'true'); vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VITE_SUPABASE_URL', url); expect(financeBackendUrl).toThrow();
  });
  it('rejects test flag on hosted execution', () => {
    vi.stubEnv('PTV_FINANCE_LOCAL_E2E', 'true'); vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL', '1'); vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:55441');
    expect(financeBackendUrl).toThrow();
  });
  it('preserves hosted allowlist', () => {
    vi.stubEnv('PTV_FINANCE_LOCAL_E2E', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    expect(financeBackendUrl()).toBe('https://swadgljnyelsjstqqxbm.supabase.co');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:55441');
    expect(financeBackendUrl).toThrow();
  });
});
