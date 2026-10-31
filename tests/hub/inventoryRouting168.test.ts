import { afterEach, describe, expect, it, vi } from 'vitest';
import { usesInventoryPortal } from '../../src/products/hub/inventaris/services/inventoryPortalClient';
import { writeReport } from '../../src/products/hub/reportPersistence';

const native = vi.hoisted(() => vi.fn(() => { throw new Error('native client forbidden'); }));
vi.mock('../../src/core/supabase/client', () => ({ getSupabaseClient: native, isSupabaseConfigured: () => false }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const stagingUrl = 'https://swadgljnyelsjstqqxbm.supabase.co';
describe('Consumer Staging yang dibangun hosted', () => {
  it.each(['staging', 'production'])('memilih cookie untuk MODE %s dan APP_ENV staging', mode => {
    vi.stubEnv('MODE', mode); vi.stubEnv('VITE_APP_ENV', 'staging'); vi.stubEnv('VITE_SUPABASE_URL', stagingUrl);
    expect(usesInventoryPortal()).toBe(true);
  });
  it.each(['', 'https://other.supabase.co', 'not-a-url', 'http://swadgljnyelsjstqqxbm.supabase.co'])('menolak konfigurasi Staging salah tanpa fallback: %s', url => {
    vi.stubEnv('MODE', 'production'); vi.stubEnv('VITE_APP_ENV', 'staging'); vi.stubEnv('VITE_SUPABASE_URL', url);
    expect(() => usesInventoryPortal()).toThrow('tidak cocok');
  });
  it('mempertahankan pemilihan existing di luar Staging', () => {
    vi.stubEnv('MODE', 'production'); vi.stubEnv('VITE_APP_ENV', 'production');
    expect(usesInventoryPortal()).toBe(false);
  });
  it.each(['damage', 'lostfound'] as const)('report %s hosted Staging tidak memanggil native walau backend native', async module => {
    vi.stubEnv('MODE', 'production'); vi.stubEnv('VITE_APP_ENV', 'staging');
    vi.stubEnv('VITE_SUPABASE_URL', stagingUrl); vi.stubEnv('VITE_AUTH_BACKEND', 'native');
    const fetcher = vi.fn(async (_url, init) => ({ ok: true, json: async () => ({ success: true, id: JSON.parse(init.body).id }) }));
    vi.stubGlobal('fetch', fetcher);
    await writeReport(module, 'create', { title: 'Synthetic hosted routing' });
    expect(fetcher.mock.calls[0][0]).toBe(module === 'damage' ? '/api/lapor-kerusakan' : '/api/lost-found');
    expect(fetcher.mock.calls[0][1].credentials).toBe('same-origin');
    expect(native).not.toHaveBeenCalled();
  });
});
