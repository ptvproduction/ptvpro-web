import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  PortalPage,
  INITIAL_SERVICES,
  PORTAL_CATEGORIES,
  FEATURED_HIGHLIGHTS,
  DEFAULT_ANNOUNCEMENT,
  ServiceStatusView,
  ComingSoonView,
  MaintenanceView,
  PortalHeader,
  PortalHero,
  FeaturedCarousel,
  ServiceCard,
  ServiceCategorySection,
} from '../../src/products/portal';

describe('PTVPRO Public Portal Implementation Tests', () => {
  describe('1. Homepage Render & Core Baseline', () => {
    it('1.1 should render homepage with header, hero, carousel, and categories', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <PortalPage />
        </MemoryRouter>
      );

      // Header Logo Resmi & Hero
      expect(html).toContain('/assets/images/ptv-logo-white.webp');
      expect(html).toContain('portal-header-logo');
      expect(html).toContain('Layanan digital Progresif TV.');
      expect(html).toContain('Satu pintu menuju alat produksi internal');
      expect(html).not.toContain('Tidak ada login di halaman ini.');

      // Kategori resmi
      expect(html).toContain('Layanan Keluarga Yayasan');
      expect(html).toContain('Layanan Progresif TV');
      expect(html).toContain('Layanan Musiman');

      // Layanan resmi
      expect(html).toContain('PTV Hub');
      expect(html).toContain('Verifikasi Identitas');
      expect(html).toContain('Keabsahan Dokumen');
      expect(html).toContain('Shortlink Management');
      expect(html).toContain('Aset Yayasan');

      // Larangan: Dilarang menampilkan Aset Publik
      expect(html).not.toContain('Aset Publik');
      expect(html).not.toContain('Public Assets');
    });

    it('1.2 should render skip to content link for accessibility', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <PortalPage />
        </MemoryRouter>
      );

      expect(html).toContain('href="#layanan"');
      expect(html).toContain('Langsung ke layanan');
    });
  });

  describe('2. Real Service Navigation & Clean URLs', () => {
    it('2.1 should use truthful routes and external URLs without dummy example.com', () => {
      const hub = INITIAL_SERVICES.find((s) => s.id === 'hub');
      const idv = INITIAL_SERVICES.find((s) => s.id === 'idv');
      const ltr = INITIAL_SERVICES.find((s) => s.id === 'ltr');
      const short = INITIAL_SERVICES.find((s) => s.id === 'short');
      const aset = INITIAL_SERVICES.find((s) => s.id === 'aset');

      expect(hub?.url).toBe('/hub');
      expect(idv?.url).toBe('/verifikasi-identitas');
      expect(ltr?.url).toBe('/verifikasi-surat');
      expect(short?.url).toBe('https://bsh.bio');
      expect(short?.isExternal).toBe(true);

      // Aset yayasan berstatus soon jujur
      expect(aset?.st).toBe('soon');

      // Tidak ada layanan yang menunjuk ke domain placeholder example.com
      INITIAL_SERVICES.forEach((s) => {
        if (s.url) {
          expect(s.url).not.toContain('example.com');
        }
      });
    });

    it('2.2 should have proper access badges for each service', () => {
      const hub = INITIAL_SERVICES.find((s) => s.id === 'hub');
      const idv = INITIAL_SERVICES.find((s) => s.id === 'idv');
      const short = INITIAL_SERVICES.find((s) => s.id === 'short');
      const aset = INITIAL_SERVICES.find((s) => s.id === 'aset');

      expect(hub?.ac).toBe('crew');
      expect(idv?.ac).toBe('open');
      expect(short?.ac).toBe('login');
      expect(aset?.ac).toBe('own');
    });

    it('2.3 should render cards with scoped service identity classes and data-svc attributes', () => {
      const hubHtml = renderToString(
        <ServiceCard
          service={INITIAL_SERVICES.find((s) => s.id === 'hub')!}
          lang="id"
          onOpenService={() => {}}
        />
      );
      expect(hubHtml).toContain('data-svc="hub"');
      expect(hubHtml).toContain('svc-hub');

      const asetHtml = renderToString(
        <ServiceCard
          service={INITIAL_SERVICES.find((s) => s.id === 'aset')!}
          lang="id"
          onOpenService={() => {}}
        />
      );
      expect(asetHtml).toContain('data-svc="aset"');
      expect(asetHtml).toContain('svc-aset');
    });
  });

  describe('3. Service Search & Filtering Logic', () => {
    it('3.1 should match services by name and description', () => {
      const html = renderToString(
        <ServiceCategorySection
          categories={PORTAL_CATEGORIES}
          services={INITIAL_SERVICES}
          lang="id"
          query="identitas"
          onClearQuery={() => {}}
          onOpenService={() => {}}
        />
      );

      expect(html).toContain('Verifikasi Identitas');
      expect(html).not.toContain('Shortlink Management');
    });

    it('3.2 should show empty state when no service matches the query', () => {
      const html = renderToString(
        <ServiceCategorySection
          categories={PORTAL_CATEGORIES}
          services={INITIAL_SERVICES}
          lang="id"
          query="layanan-tidak-ada-xyz"
          onClearQuery={() => {}}
          onOpenService={() => {}}
        />
      );

      expect(html).toContain('Tidak ada layanan yang cocok');
      expect(html).toContain('Hapus pencarian');
    });
  });

  describe('4. Bilingual (ID / EN) Support', () => {
    it('4.1 should render English text when locale is set to en', () => {
      const heroHtml = renderToString(<PortalHero lang="en" />);
      expect(heroHtml).toContain('Progresif TV digital services.');
      expect(heroHtml).toContain('One gateway to internal production tools');
      expect(heroHtml).not.toContain('There is no login on this page.');

      const headerHtml = renderToString(
        <PortalHeader
          lang="en"
          setLang={() => {}}
          view="home"
          setView={() => {}}
          hasIssues={false}
          onNavigateServices={() => {}}
        />
      );
      expect(headerHtml).toContain('Services');
      expect(headerHtml).toContain('Status');
    });

    it('4.2 should render English status view when requested', () => {
      const html = renderToString(
        <ServiceStatusView
          services={INITIAL_SERVICES}
          lang="en"
          onBack={() => {}}
        />
      );

      expect(html).toContain('Service Status');
      expect(html).toContain('Current condition of PTVPRO public services.');
      expect(html).toContain('All services are running normally.');
    });
  });

  describe('5. Seasonal Service & Featured Carousel', () => {
    it('5.1 should include Majelis Sama\u2019 as seasonal service', () => {
      const maj = INITIAL_SERVICES.find((s) => s.id === 'maj');
      expect(maj).toBeDefined();
      expect(maj?.seasonal).toBe(true);
      expect(maj?.cat).toBe('season');
    });

    it('5.2 should render featured highlights in carousel', () => {
      const html = renderToString(
        <FeaturedCarousel
          highlights={FEATURED_HIGHLIGHTS}
          services={INITIAL_SERVICES}
          lang="id"
          onSelectService={() => {}}
        />
      );

      expect(html).toContain('Layanan musiman');
      expect(html).toContain('Periode Haul');
      expect(html).toContain('Lihat jadwal &amp; info');
      expect(html).toContain('Verifikasi publik');
    });
  });

  describe('6. Sub-views: Status, Coming Soon, Maintenance', () => {
    it('6.1 should render Coming Soon page with honest development notice', () => {
      const aset = INITIAL_SERVICES.find((s) => s.id === 'aset')!;
      const html = renderToString(
        <ComingSoonView
          service={aset}
          lang="id"
          onBack={() => {}}
        />
      );

      expect(html).toContain('Aset Yayasan');
      expect(html).toContain('Segera Hadir');
      expect(html).toContain('masih dalam pengembangan');
      expect(html).toContain('Kembali ke portal');
    });

    it('6.2 should render Maintenance page with Hub fallback for crew', () => {
      const html = renderToString(
        <MaintenanceView
          lang="id"
          onNavigateHub={() => {}}
        />
      );

      expect(html).toContain('Portal sedang dalam pemeliharaan');
      expect(html).toContain('Buka PTV Hub');
    });
  });

  describe('7. Production Hygiene: No Demo Controls', () => {
    it('7.1 should not contain prototype demo panel in rendered HTML', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <PortalPage />
        </MemoryRouter>
      );

      expect(html).not.toContain('Panel demo');
      expect(html).not.toContain('id="d-svc"');
      expect(html).not.toContain('id="d-st"');
      expect(html).not.toContain('id="d-mt"');
      expect(html).not.toContain('Reset demo');
      expect(html).not.toContain('Tambah Segera Hadir');
    });

    it('7.2 should have official announcement structure ready', () => {
      expect(DEFAULT_ANNOUNCEMENT.title.id).toContain('Selamat Datang');
      expect(DEFAULT_ANNOUNCEMENT.active).toBe(true);
    });
  });

  describe('8. UI Polish R03: WhatsApp Helpdesk & Footer Refinement', () => {
    it('8.1 should omit contact email from footer and preserve Status, Instagram, and YouTube', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <PortalPage />
        </MemoryRouter>
      );

      // Email kontak harus dihapus
      expect(html).not.toContain('kontak@progresiftv.com');
      expect(html).not.toContain('mailto:');

      // Tautan resmi tersisa harus tampil rapi
      expect(html).toContain('Status Layanan');
      expect(html).toContain('https://instagram.com/progresiftv');
      expect(html).toContain('Instagram');
      expect(html).toContain('https://youtube.com/@progresiftv');
      expect(html).toContain('YouTube');
      expect(html).toContain('PTVPRO');
    });

    it('8.2 should build truthful WhatsApp URL with polite greeting and international format', async () => {
      const { buildWhatsAppHelpUrl } = await import('../../src/products/portal/config/portalConfig');

      const url = buildWhatsAppHelpUrl({
        number: '+62 812-3456-7890',
        topic: 'Website error',
        pageName: 'Registrasi Majelis Sama’',
        lang: 'id',
      });

      expect(url).not.toBeNull();
      expect(url).toContain('https://wa.me/6281234567890?text=');
      // Mengandung salam sopan
      expect(decodeURIComponent(url!)).toContain("Assalamu'alaikum, saya ingin bertanya mengenai layanan PTVPRO.");
      expect(decodeURIComponent(url!)).toContain('Topik: Website error');
      expect(decodeURIComponent(url!)).toContain('Halaman: Registrasi Majelis Sama’');
    });

    it('8.3 should return null and not generate dummy URLs when WhatsApp number is unconfigured', async () => {
      const { buildWhatsAppHelpUrl } = await import('../../src/products/portal/config/portalConfig');

      const urlEmpty = buildWhatsAppHelpUrl({ number: '' });
      expect(urlEmpty).toBeNull();

      const urlTooShort = buildWhatsAppHelpUrl({ number: '123' });
      expect(urlTooShort).toBeNull();
    });
  });
});
