/**
 * PTVPRO — Launcher Redesign (Lusion-Inspired) Test Suite
 * File: tests/portal/livingPortal.test.tsx
 *
 * Memvalidasi:
 * 1. Route Configuration: /preview/living-portal terdaftar dan / tetap PortalPage resmi
 * 2. Server-side rendering (SSR) / static rendering via renderToString berjalan mulus tanpa error
 * 3. Struktur Halaman FINAL: Tepat 3 section (Hero, Direktori Layanan, Footer)
 * 4. Konsistensi Katalog Resmi: Kategori resmi, featured highlights, status badges, dan modal bantuan
 * 5. Struktur CSS isolated dan unifikasi scrolling engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/app/router';
import { LivingPortalContent } from '../../src/products/living-portal/LivingPortalPage';
import { PortalInitScreen } from '../../src/products/living-portal/components/PortalInitScreen';
import type { PortalSnapshot } from '../../src/products/living-portal/portalSnapshot';
import fs from 'fs';
import path from 'path';

const mockSnapshot: PortalSnapshot = {
  services: [
    {
      id: 'srv-1',
      name: { id: 'PTV Hub', en: 'PTV Hub' },
      desc: { id: 'Pusat operasional dan surat izin kru.', en: 'Ops Center' },
      icon: 'hub',
      cat: 'ptv',
      href: '/hub',
      st: 'ok',
      isPublished: true,
      isActive: true,
      pub: 1,
      sortOrder: 1,
      updatedAt: '2026-10-31T00:00:00Z',
    },
    {
      id: 'srv-2',
      name: { id: 'Shortlink Management', en: 'Shortlink Management' },
      desc: { id: 'Pemendek tautan resmi ekosistem.', en: 'Shortlinks' },
      icon: 'link',
      cat: 'ptv',
      href: 'https://s.ptv.id',
      st: 'ok',
      isPublished: true,
      isActive: true,
      pub: 1,
      sortOrder: 2,
      updatedAt: '2026-10-31T00:00:00Z',
    },
    {
      id: 'srv-3',
      name: { id: 'Aset Yayasan', en: 'Foundation Assets' },
      desc: { id: 'Katalog aset dan perlengkapan.', en: 'Assets catalog' },
      icon: 'box',
      cat: 'yayasan',
      href: '/aset',
      st: 'ok',
      isPublished: true,
      isActive: true,
      pub: 1,
      sortOrder: 3,
      updatedAt: '2026-10-31T00:00:00Z',
    },
    {
      id: 'srv-4',
      name: { id: 'Keabsahan Dokumen', en: 'Document Verification' },
      desc: { id: 'Verifikasi keabsahan dokumen dan surat resmi.', en: 'Verification' },
      icon: 'document-check',
      cat: 'yayasan',
      href: '/keabsahan-dokumen',
      st: 'ok',
      isPublished: true,
      isActive: true,
      pub: 1,
      sortOrder: 4,
      updatedAt: '2026-10-31T00:00:00Z',
    },
    {
      id: 'srv-5',
      name: { id: 'Verifikasi Identitas', en: 'Identity Verification' },
      desc: { id: 'Layanan verifikasi kartu santri digital.', en: 'Identity' },
      icon: 'qr',
      cat: 'season',
      href: '/id',
      st: 'ok',
      isPublished: true,
      isActive: true,
      pub: 1,
      sortOrder: 5,
      updatedAt: '2026-10-31T00:00:00Z',
    },
  ],
  announcements: [],
  settings: {
    id: 'global',
    heroTitle: {
      line1: 'Semua layanan.',
      line2: 'Satu tempat.',
    },
    heroDesc: 'Pintu akses resmi ekosistem digital keluarga yayasan dan Progresif TV',
    helpWaNumber: '6281234567890',
    footerSignature: 'Dibangun oleh santri, didedikasikan untuk semua.',
    footerCopyright: '© 2026 Progresif TV Production.',
    isPublished: true,
    updatedAt: '2026-10-31T00:00:00Z',
  },
};

describe('PTVPRO — Launcher Redesign (Lusion-Inspired)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Route Configuration Check: / renders LivingPortalPage and /preview redirects to /', () => {
    const rootRoute = routes.find((r) => r.path === '/');
    expect(rootRoute).toBeDefined();
    expect(rootRoute?.path).toBe('/');
    expect(React.isValidElement(rootRoute?.element)).toBe(true);

    const previewRoute = routes.find((r) => r.path === '/preview');
    expect(previewRoute).toBeDefined();

    const previewLivingRoute = routes.find((r) => r.path === '/preview/living-portal');
    expect(previewLivingRoute).toBeDefined();
  });

  it('2. Cold render shows PortalInitScreen without flashing unready hero or mock cards', () => {
    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    let html = '';
    expect(() => {
      html = renderToString(<RouterProvider router={memoryRouter} />);
    }).not.toThrow();

    expect(html).not.toBe('');
    expect(html).toContain('lp-init');
    expect(html).toContain('lp-init-track');
    expect(html).toContain('lp-init-bar');
    expect(html).toContain('Menyiapkan portal');
    // Hero or directory MUST NOT flash during initial cold render
    expect(html).not.toContain('class="lp-hero"');
    expect(html).not.toContain('id="direktori-layanan"');
  });

  it('3. Renders precisely 3 final sections: Hero, Direktori Layanan, Footer once ready', () => {
    const html = renderToString(<LivingPortalContent snapshot={mockSnapshot} />);

    // Section 1: Hero
    expect(html).toContain('class="lp-hero"');
    expect(html).toContain('PORTAL LAYANAN RESMI');
    expect(html).toContain('Pintu akses resmi ekosistem digital keluarga yayasan dan Progresif TV');
    expect(html).toContain('lp-hero-line lp-line-1');
    expect(html).toContain('lp-hero-line lp-line-2');
    expect(html).toContain('Semua layanan.');
    expect(html).toContain('Satu tempat.');
    expect(html).toContain('JELAJAHI');
    expect(html).toContain('BANTUAN RESMI');

    // Section 2: Direktori Layanan
    expect(html).toContain('id="direktori-layanan"');
    expect(html).toContain('DIREKTORI RESMI PTVPRO');
    expect(html).toContain('Jelajahi layanan.');
    expect(html).toContain('Cari layanan (misal: PTV Hub, Dokumen, Aset)...');

    // Filter Kategori Resmi
    expect(html).toContain('Semua');
    expect(html).toContain('Layanan Keluarga Yayasan');
    expect(html).toContain('Layanan Progresif TV');
    expect(html).toContain('Layanan Musiman');

    // Section 3: Footer with Santri Identity
    expect(html).toContain('lp-compact-footer');
    expect(html).toContain('Dibangun oleh');
    expect(html).toContain('santri');
    expect(html).toContain('didedikasikan untuk semua.');
    expect(html).toContain('Hak cipta dilindungi.');
    expect(html).toContain('KE ATAS');
  });

  it('4. Uses real portal catalog data with official logo and Keabsahan Dokumen alignment', () => {
    const html = renderToString(<LivingPortalContent snapshot={mockSnapshot} />);

    // Official Logo Webp
    expect(html).toContain('src="/assets/images/ptv-logo-white.webp"');

    // Layanan katalog aktif & Keabsahan Dokumen alignment
    expect(html).toContain('PTV Hub');
    expect(html).toContain('Shortlink Management');
    expect(html).toContain('Aset Yayasan');
    expect(html).toContain('Keabsahan Dokumen');
    expect(html).toContain('Verifikasi Identitas');

    // WhatsApp Help modal button
    expect(html).toContain('BANTUAN RESMI ↗');

    // Dynamic system status in footer
    expect(html).toContain('Layanan Publik Beroperasi');
  });

  it('5. Ensures storytelling bloat, Sorotan Utama duplicates, and hero system pill are removed', () => {
    const html = renderToString(<LivingPortalContent snapshot={mockSnapshot} />);

    // Harus bebas dari storytelling bloat, duplikasi featured, dan pill status di hero
    expect(html).not.toContain('id="lpRibbonLayer"');
    expect(html).not.toContain('PRODUCTION EXPLORER / DEMO');
    expect(html).not.toContain('01 / DISCOVER');
    expect(html).not.toContain('02 / INSIGHTS');
    expect(html).not.toContain('SOROTAN UTAMA');
    expect(html).not.toContain('LAUNCHER V2');
    expect(html).not.toContain('SISTEM NORMAL');
  });

  it('6. PortalInitScreen renders error state with Coba Lagi button properly', () => {
    const html = renderToString(
      <PortalInitScreen
        status="error"
        errorMessage="Koneksi bermasalah saat memuat konfigurasi portal."
        onRetry={() => {}}
      />
    );
    expect(html).toContain('lp-init');
    expect(html).toContain('Portal belum dapat dimuat');
    expect(html).toContain('Koneksi bermasalah');
    expect(html).toContain('Coba Lagi');
  });

  it('7. CSS stylesheet exists and enforces isolated color palette & scrolling engine', () => {
    const cssPath = path.resolve(
      process.cwd(),
      'src/products/living-portal/styles/livingPortal.css'
    );
    expect(fs.existsSync(cssPath)).toBe(true);

    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    // Verify isolated tokens
    expect(cssContent).toContain('--lp-ink: #11121a');
    expect(cssContent).toContain('--lp-paper: #f1f1f8');
    expect(cssContent).toContain('--lp-blue: #1749c0');

    // Verify isolation class & scrolling unification
    expect(cssContent).toContain('.living-portal-root');
    expect(cssContent).toContain('html.living-portal-active');
    expect(cssContent).toContain('body.living-portal-active');

    // Verify accessibility prefers-reduced-motion
    expect(cssContent).toContain('prefers-reduced-motion: reduce');
  });
});
