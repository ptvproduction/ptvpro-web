import { describe, it, expect, beforeEach } from 'vitest';
import { INITIAL_SERVICES } from '../../src/products/portal/services/portalCatalog';
import { PortalManagementService } from '../../src/products/hub/portal-management/services/portalManagementService';

// Memory storage polyfill for Vitest Node environment
if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: 0,
  } as Storage;
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { search: '' },
    localStorage: globalThis.localStorage,
  } as any;
}

describe('Portal Integration Regression Fixes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. INITIAL_SERVICES memuat keenam layanan resmi dengan pub: 1 dan Keabsahan Dokumen', () => {
    expect(INITIAL_SERVICES).toHaveLength(6);
    const ids = INITIAL_SERVICES.map((s) => s.id);
    expect(ids).toEqual(['aset', 'short', 'hub', 'idv', 'ltr', 'maj']);

    // PTV Hub harus berstatus pub: 1
    const hub = INITIAL_SERVICES.find((s) => s.id === 'hub');
    expect(hub).toBeDefined();
    expect(hub?.pub).toBe(1);
    expect(hub?.n.id).toBe('PTV Hub');

    // ltr harus bernama 'Keabsahan Dokumen'
    const ltr = INITIAL_SERVICES.find((s) => s.id === 'ltr');
    expect(ltr).toBeDefined();
    expect(ltr?.pub).toBe(1);
    expect(ltr?.n.id).toBe('Keabsahan Dokumen');
  });

  it('2. getPublicPortalData mengembalikan tepat 6 layanan resmi termasuk PTV Hub', async () => {
    const service = new PortalManagementService();
    const publicData = await service.getPublicPortalData();

    expect(publicData.services).toHaveLength(6);
    const serviceIds = publicData.services.map((s) => s.id);
    expect(serviceIds).toContain('hub');
    expect(serviceIds).toContain('ltr');
    expect(serviceIds).toContain('aset');
    expect(serviceIds).toContain('short');
    expect(serviceIds).toContain('idv');
    expect(serviceIds).toContain('maj');

    const hub = publicData.services.find((s) => s.id === 'hub');
    expect(hub?.pub).toBe(1);
    expect(hub?.isActive).toBe(true);
    expect(hub?.isPublished).toBe(true);

    const ltr = publicData.services.find((s) => s.id === 'ltr');
    expect(ltr?.name.id).toBe('Keabsahan Dokumen');
  });

  it('3. Tidak ada pengumuman contoh yang otomatis terbit tanpa persetujuan admin', async () => {
    const service = new PortalManagementService();
    const publicData = await service.getPublicPortalData();

    // Default announcements harus kosong atau tidak ada yang aktif terbit
    expect(publicData.announcements).toHaveLength(0);
  });

  it('4. Rekonsiliasi non-destruktif memulihkan pub: 1 untuk PTV Hub dan nama Keabsahan Dokumen jika tersimpan di localStorage dari sesi lama', async () => {
    // Simulasikan data localStorage lama yang rusak (hub dengan pub: 0 dan ltr dengan nama 'Verifikasi Surat')
    const staleServices = [
      {
        id: 'hub',
        name: { id: 'PTV Hub', en: 'PTV Hub' },
        desc: { id: 'Desc hub', en: 'Desc hub en' },
        cat: 'ptv',
        href: '/hub',
        icon: 'grid',
        st: 'ok',
        pub: 0, // Stale bug: pub 0
        isActive: true,
        isPublished: true,
        hasDraft: false,
        sortOrder: 2,
      },
      {
        id: 'ltr',
        name: { id: 'Verifikasi Surat', en: 'Document Verification' }, // Stale name
        desc: { id: 'Desc ltr', en: 'Desc ltr en' },
        cat: 'ptv',
        href: '/verifikasi-surat',
        icon: 'doc',
        st: 'ok',
        pub: 1,
        isActive: true,
        isPublished: true,
        hasDraft: false,
        sortOrder: 4,
      },
    ];

    // Simulasikan juga stale announcement 'ann-haul-2026' yang terbit
    const staleAnnouncements = [
      {
        id: 'ann-haul-2026',
        title: { id: 'Layanan Musiman Haul & Harlah 2026', en: 'Haul' },
        body: { id: 'Pusat pendaftaran', en: 'Reg' },
        isActive: true,
        isPublished: true,
      },
    ];

    localStorage.setItem('ptv_portal_managed_services', JSON.stringify(staleServices));
    localStorage.setItem('ptv_portal_managed_announcements', JSON.stringify(staleAnnouncements));

    // Inisialisasi ulang service
    const service = new PortalManagementService();
    const publicData = await service.getPublicPortalData();

    // 1. PTV Hub harus otomatis dipulihkan menjadi pub: 1
    const hub = publicData.services.find((s) => s.id === 'hub');
    expect(hub).toBeDefined();
    expect(hub?.pub).toBe(1);

    // 2. ltr harus otomatis dikoreksi menjadi 'Keabsahan Dokumen'
    const ltr = publicData.services.find((s) => s.id === 'ltr');
    expect(ltr?.name.id).toBe('Keabsahan Dokumen');

    // 3. Layanan lain yang hilang (aset, short, idv, maj) harus ditambahkan kembali tanpa menimpa hub
    expect(publicData.services.length).toBe(6);

    // 4. Stale announcement ann-haul-2026 dicabut status publish-nya
    expect(publicData.announcements).toHaveLength(0);
  });

  it('5. Layanan yang sengaja dinonaktifkan oleh administrator tetap dihormati', async () => {
    const service = new PortalManagementService();
    await service.getServices();

    // Admin secara sengaja menonaktifkan salah satu layanan
    await service.saveService({ id: 'aset', isActive: false }, false);

    const publicData = await service.getPublicPortalData();
    const aset = publicData.services.find((s) => s.id === 'aset');
    expect(aset).toBeUndefined(); // Tidak tampil di publik
    expect(publicData.services.length).toBe(5); // Sisa 5 layanan yang masih aktif
  });
});
