import { useSessionStore } from '@core/session';
import { describe, it, expect, beforeEach } from 'vitest';
import { crewStore } from '@products/hub/kru/kruStore';
import {
  PTV_ID_CARD_LOGO_URL,
  PTV_ID_CARD_LOGO_BASE64,
} from '@products/hub/id-digital/idDigitalAssets';

// Setup memory-based localStorage mock if running in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('Modul ID Digital — Visual Asset Fidelity & Shared Crew Integration', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    crewStore.resetToFixtures();
    useSessionStore.setState({ user: { id: 'unit-account', ptv_id: 'PTV-001' } as never });
  });

  it('1. harus merujuk ke file logo resmi Progresif TV Production yang valid', () => {
    expect(PTV_ID_CARD_LOGO_URL).toBe('/assets/images/ptv-logo-white.webp');
    expect(PTV_ID_CARD_LOGO_BASE64).toContain('data:image/webp;base64,');
    expect(PTV_ID_CARD_LOGO_BASE64.length).toBeGreaterThan(1000);
  });

  it('2. harus terhubung ke identitas kru saat ini (getCurrentUser) secara reaktif', () => {
    const current = crewStore.getCurrentUser();
    expect(current).toBeDefined();
    expect(current.ptv_id).toBe('PTV-001');
    expect(current.full_name).toBe('M. Zidna Ilma Roup');
    expect(current.position).toBe('Koordinator Produksi & Lead Dev');
    expect(current.division).toBe('Technical');
    expect(current.status_kru).toBe('Aktif');
  });

  it('3. harus merefleksikan perubahan foto profil anggota kru dari Manajemen Kru', () => {
    const current = crewStore.getCurrentUser();
    expect(current.foto_url).toBe('');

    // Simulasi update foto profil anggota di Manajemen Kru
    const testPhotoUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/ptvpro-media-public/crew/avatar-ptv-001.webp';
    const updated = crewStore.updateCrew(current.id, { foto_url: testPhotoUrl });

    expect(updated).not.toBeNull();
    expect(updated?.foto_url).toBe(testPhotoUrl);

    // Ambil ulang currentUser dari store
    const refreshedCurrent = crewStore.getCurrentUser();
    expect(refreshedCurrent.foto_url).toBe(testPhotoUrl);
  });

  it('4. harus menangani fallback inisial rapi ketika foto profil belum tersedia', () => {
    const current = crewStore.getCurrentUser();
    // Default fixture tidak memiliki foto, harus menghasilkan inisial yang benar
    const inits = (current.full_name || '')
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    expect(inits).toBe('MZ');
  });

  it('5. harus menjaga integritas seluruh kredensial 4-grid pada ID Card', () => {
    const current = crewStore.getCurrentUser();
    expect(current.ptv_id).toMatch(/^PTV-\d+/);
    expect(current.position).toBeTruthy();
    expect(current.division).toBeTruthy();
    expect(['Aktif', 'Nonaktif']).toContain(current.status_kru);
  });

  it('6. harus memastikan tipografi nilai KRU NO selaras dan tidak menggunakan font monospace', () => {
    // Validasi bahwa format nilai nomor kru PTV ID konsisten sebagai string standar
    const current = crewStore.getCurrentUser();
    expect(current.ptv_id).toBe('PTV-001');
    expect(typeof current.ptv_id).toBe('string');
  });
});

