import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDamageInventory } from '../../src/products/hub/lapor-kerusakan/damageInventoryService';

const { getList } = vi.hoisted(() => ({ getList: vi.fn() }));
vi.mock('../../src/products/hub/inventaris/inventarisService', () => ({
  SupabaseInventarisService: { getInstance: () => ({ getInventarisList: getList }) },
}));

describe('Sumber inventaris laporan kerusakan', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-placeholder');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it('memakai adapter Supabase langsung dan mempertahankan relasi/status unit', async () => {
    const items = [{ id: 'asset-real', nama_alat: 'Alat Server', kode: 'INV-901', kategori: 'Kamera', total_unit: 1, unit_tersedia: 0,
      units: [{ id: 'unit-real', inventaris_id: 'asset-real', kode_unit: 'INV-901-U01', kondisi: 'rusak', status_peminjaman: 'maintenance' }] }];
    getList.mockResolvedValueOnce(items);
    expect(await loadDamageInventory()).toBe(items);
    expect(getList).toHaveBeenCalledOnce();
  });
  it('meneruskan kegagalan server tanpa fallback dummy', async () => {
    getList.mockRejectedValueOnce(new Error('Server unavailable'));
    await expect(loadDamageInventory()).rejects.toThrow('Server unavailable');
  });
  it('menolak project di luar Staging sebelum query database', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.invalid');
    await expect(loadDamageInventory()).rejects.toThrow('Staging');
    expect(getList).not.toHaveBeenCalled();
  });
});
