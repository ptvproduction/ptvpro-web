import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AcaraKalenderHeader } from '../../src/shared/components/AcaraKalenderHeader';
import { AcaraKalenderNav } from '../../src/shared/components/AcaraKalenderNav';
import { AcaraPage } from '../../src/products/hub/acara/AcaraPage';
import { KalenderPage } from '../../src/products/hub/kalender/KalenderPage';

// Mock context and hooks
vi.mock('@/core/session', () => ({
  useSessionStore: () => ({
    session: {
      user: {
        name: 'Zidnal Falah',
        email: 'zidna@progresiftv.id',
      },
    },
  }),
}));

vi.mock('../../src/products/hub/acara/context/AcaraContext', () => ({
  useAcara: () => ({
    events: [],
    isLoading: false,
    error: null,
    refreshEvents: vi.fn(),
  }),
  useOptionalAcara: () => ({
    events: [],
    isLoading: false,
    error: null,
    refreshEvents: vi.fn(),
    createEvent: vi.fn(),
  }),
}));

vi.mock('../../src/products/hub/kalender/kalenderService', () => ({
  kalenderService: {
    getPlanners: vi.fn().mockResolvedValue([]),
    createPlanner: vi.fn().mockResolvedValue({}),
    updatePlanner: vi.fn().mockResolvedValue({}),
    deletePlanner: vi.fn().mockResolvedValue(true),
  },
}));

describe('PTVPRO — UI Konsistensi Header Acara & Kalender (P0 Fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Shared AcaraKalenderHeader Component', () => {
    it('me-render judul dan deskripsi standar bersama yang konsisten', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/acara']}>
          <AcaraKalenderHeader />
        </MemoryRouter>
      );

      expect(html).toContain('Agenda &amp; Kalender Kegiatan');
      expect(html).toContain('Jadwal peliputan, produksi siaran studio, dan koordinasi agenda kegiatan terpadu Progresif TV.');
      expect(html).toContain('acara-kal-shared-header');
      expect(html).toContain('acara-kal-nav');
    });

    it('mendukung kustomisasi title dan subtitle jika diperlukan', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/kalender']}>
          <AcaraKalenderHeader
            title="Judul Khusus"
            subtitle="Deskripsi kustom"
          />
        </MemoryRouter>
      );

      expect(html).toContain('Judul Khusus');
      expect(html).toContain('Deskripsi kustom');
    });
  });

  describe('2. Segmented Navigation Switcher (AcaraKalenderNav)', () => {
    it('menandai tab Daftar Acara sebagai aktif saat berada di route /hub/acara', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/acara']}>
          <AcaraKalenderNav />
        </MemoryRouter>
      );

      expect(html).toContain('Daftar Acara');
      expect(html).toContain('Kalender');
      // Tab Daftar Acara memiliki class active
      expect(html).toMatch(/acara-kal-nav-link active[^>]*>.*Daftar Acara/s);
    });

    it('menandai tab Kalender sebagai aktif saat berada di route /hub/kalender', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/kalender']}>
          <AcaraKalenderNav />
        </MemoryRouter>
      );

      expect(html).toContain('Daftar Acara');
      expect(html).toContain('Kalender');
      // Tab Kalender memiliki class active
      expect(html).toMatch(/acara-kal-nav-link active[^>]*>.*Kalender/s);
    });
  });

  describe('3. Konsistensi Header pada Halaman Acara (AcaraPage)', () => {
    it('me-render shared header dan memisahkan tombol Acara Baru ke action bar terpisah', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/acara']}>
          <AcaraPage />
        </MemoryRouter>
      );

      // Shared Header ter-render
      expect(html).toContain('acara-kal-shared-header');
      expect(html).toContain('Agenda &amp; Kalender Kegiatan');
      expect(html).toContain('acara-kal-nav');

      // Tombol Acara Baru berada di luar shared header (pada acara-action-bar)
      expect(html).toContain('acara-action-bar');
      expect(html).toContain('Acara Baru');
      expect(html).toContain('acara-search-box');
      expect(html).toContain('acara-filter-chips');
    });
  });

  describe('4. Konsistensi Header pada Halaman Kalender (KalenderPage)', () => {
    it('me-render shared header yang identik dan dilengkapi scroll hint pada kal-filter-bar', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/kalender']}>
          <KalenderPage />
        </MemoryRouter>
      );

      // Shared Header ter-render identik
      expect(html).toContain('acara-kal-shared-header');
      expect(html).toContain('Agenda &amp; Kalender Kegiatan');
      expect(html).toContain('acara-kal-nav');

      // Kategori kalender memiliki pembungkus dengan scroll hint affordance
      expect(html).toContain('kal-filter-bar-wrap');
      expect(html).toContain('kal-filter-bar');
      expect(html).toContain('kal-filter-scroll-hint');
      expect(html).toContain('Kalender PTV');
      expect(html).toContain('Kalender Pesantren');
      expect(html).toContain('Kalender Sekolah');
    });
  });
});
