import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PTVPRO Dark Mode Consistency & Contrast Verification', () => {
  const rootDir = process.cwd();
  const acaraCss = fs.readFileSync(path.join(rootDir, 'src/styles/acara.css'), 'utf-8');
  const kruKomunikasiCss = fs.readFileSync(path.join(rootDir, 'src/styles/kruKomunikasi.css'), 'utf-8');
  const perizinanCss = fs.readFileSync(path.join(rootDir, 'src/styles/perizinan.css'), 'utf-8');

  describe('1. Daftar Acara & Detail Acara (acara.css)', () => {
    it('defines dark mode surface and border for .acara-item-row and .acara-card', () => {
      expect(acaraCss).toContain('[data-theme="dark"] .acara-item-row');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-card');
      expect(acaraCss).toContain('background: var(--surface)');
      expect(acaraCss).toContain('border-color: var(--line)');
    });

    it('defines dark mode text hierarchy for title and metadata', () => {
      expect(acaraCss).toContain('[data-theme="dark"] .acara-item-title');
      expect(acaraCss).toContain('color: var(--ink)');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-item-meta');
      expect(acaraCss).toContain('color: var(--muted)');
    });

    it('defines dark mode semantic status badges without light mode pastels', () => {
      expect(acaraCss).toContain('[data-theme="dark"] .acara-badge.ok');
      expect(acaraCss).toContain('background: var(--ok-bg)');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-badge.info');
      expect(acaraCss).toContain('background: var(--info-bg)');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-badge.dang');
      expect(acaraCss).toContain('background: var(--dang-bg)');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-badge.muted');
      expect(acaraCss).toContain('background: var(--surface-2)');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-badge-weton');
      expect(acaraCss).toContain('background: var(--warn-bg)');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-badge-hijri');
      expect(acaraCss).toContain('background: var(--ok-bg)');
    });

    it('defines dark mode rundown row and time badge', () => {
      expect(acaraCss).toContain('[data-theme="dark"] .acara-rd-row');
      expect(acaraCss).toContain('background: var(--surface-2)');
      expect(acaraCss).toContain('[data-theme="dark"] .acara-rd-time-badge');
      expect(acaraCss).toContain('color: #8AB4F8');
    });

    it('defines dark mode destructive button', () => {
      expect(acaraCss).toContain('[data-theme="dark"] .acara-btn-destructive');
      expect(acaraCss).toContain('color: #F28B82');
    });
  });

  describe('2. Kontak & WhatsApp Actions (kruKomunikasi.css)', () => {
    it('defines unified kk-whatsapp-btn and kk-whatsapp-btn-full for light and dark modes', () => {
      expect(kruKomunikasiCss).toContain('.kk-whatsapp-btn-full');
      expect(kruKomunikasiCss).toContain(':root[data-theme="dark"] .kk-whatsapp-btn-full');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-whatsapp-btn-full');
      expect(kruKomunikasiCss).toContain('color: #81C995');
    });

    it('defines kk-phone-btn and kk-kontak-detail-btn for dark mode', () => {
      expect(kruKomunikasiCss).toContain('.kk-phone-btn');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-phone-btn');
      expect(kruKomunikasiCss).toContain('.kk-kontak-detail-btn');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-kontak-detail-btn');
    });

    it('defines category badges (pondok, sekolah, yayasan, mitra)', () => {
      expect(kruKomunikasiCss).toContain('.kk-category-badge.pondok');
      expect(kruKomunikasiCss).toContain('.kk-category-badge.sekolah');
      expect(kruKomunikasiCss).toContain('.kk-category-badge.yayasan');
      expect(kruKomunikasiCss).toContain('.kk-category-badge.mitra');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-category-badge.yayasan');
      expect(kruKomunikasiCss).toContain('color: #c084fc');
    });
  });

  describe('3. Alur Persetujuan & Timeline (kruKomunikasi.css)', () => {
    it('defines dark mode surface and text hierarchy for timeline steps', () => {
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-tl-step');
      expect(kruKomunikasiCss).toContain('background: var(--surface-2)');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-tl-step .tl-title');
      expect(kruKomunikasiCss).toContain('color: var(--ink)');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-tl-step .tl-meta');
      expect(kruKomunikasiCss).toContain('color: var(--muted)');
    });

    it('defines dark mode status variants: done, now, and reject', () => {
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-tl-step.done');
      expect(kruKomunikasiCss).toContain('color: #81C995');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-tl-step.now');
      expect(kruKomunikasiCss).toContain('color: #8AB4F8');
      expect(kruKomunikasiCss).toContain('[data-theme="dark"] .kk-tl-step.reject');
      expect(kruKomunikasiCss).toContain('color: #F28B82');
    });
  });

  describe('4. Perizinan & Accordion Components (perizinan.css)', () => {
    it('defines dark mode accordions and content surfaces', () => {
      expect(perizinanCss).toContain('[data-theme="dark"] .prz-accordion-item');
      expect(perizinanCss).toContain('[data-theme="dark"] .prz-accordion-header');
      expect(perizinanCss).toContain('[data-theme="dark"] .prz-accordion-content');
      expect(perizinanCss).toContain('background: var(--surface-2)');
      expect(perizinanCss).toContain('border-color: var(--line)');
    });

    it('defines dark mode audit items and QR box', () => {
      expect(perizinanCss).toContain('[data-theme="dark"] .prz-audit-item');
      expect(perizinanCss).toContain('[data-theme="dark"] .prz-qr-box');
      expect(perizinanCss).toContain('[data-theme="dark"] .prz-detail-crew-pill');
    });
  });

  describe('5. Component Integrity in AcaraDetailPage and KontakEksternalPage', () => {
    it('AcaraDetailPage uses acara-btn-destructive and semantic colors for cards', () => {
      const acaraDetailPage = fs.readFileSync(
        path.join(rootDir, 'src/products/hub/acara/AcaraDetailPage.tsx'),
        'utf-8'
      );
      expect(acaraDetailPage).toContain('className="acara-btn-destructive"');
      expect(acaraDetailPage).not.toContain("background: '#fef2f2'");
    });

    it('KontakEksternalPage uses kk-category-badge and kk-whatsapp-btn', () => {
      const kontakPage = fs.readFileSync(
        path.join(rootDir, 'src/products/hub/kontak-eksternal/KontakEksternalPage.tsx'),
        'utf-8'
      );
      expect(kontakPage).toContain('kk-category-badge');
      expect(kontakPage).toContain('kk-whatsapp-btn');
      expect(kontakPage).toContain('kk-phone-btn');
      expect(kontakPage).not.toContain("background: '#ecfdf5'");
    });
  });

  describe('6. Lapor Kerusakan & Lost/Found Dark Mode (kerusakan.css, lostFound.css)', () => {
    const kerusakanCss = fs.readFileSync(path.join(rootDir, 'src/styles/kerusakan.css'), 'utf-8');
    const lostFoundCss = fs.readFileSync(path.join(rootDir, 'src/styles/lostFound.css'), 'utf-8');

    it('verifies kerusakan.css modal header, body, footer use semantic surfaces and dark mode rules', () => {
      expect(kerusakanCss).toContain('[data-theme="dark"] .dmg-modal-surface');
      expect(kerusakanCss).toContain('[data-theme="dark"] .dmg-modal-header');
      expect(kerusakanCss).toContain('[data-theme="dark"] .dmg-modal-footer');
      expect(kerusakanCss).toContain('[data-theme="dark"] .dmg-close-btn');
      expect(kerusakanCss).toContain('[data-theme="dark"] .dmg-select');
    });

    it('verifies lostFound.css close button and modal surfaces in dark mode', () => {
      expect(lostFoundCss).toContain('[data-theme="dark"] .lf-modal-surface');
      expect(lostFoundCss).toContain('[data-theme="dark"] .lf-close-btn');
    });
  });

  describe('7. Surat & Arsip Dark Mode (arsip.css)', () => {
    const arsipCss = fs.readFileSync(path.join(rootDir, 'src/styles/arsip.css'), 'utf-8');

    it('verifies arsip.css defines dark mode for cards, controls, search, and item cards', () => {
      expect(arsipCss).toContain('[data-theme="dark"] .arsip-stat-card');
      expect(arsipCss).toContain('[data-theme="dark"] .arsip-controls-card');
      expect(arsipCss).toContain('[data-theme="dark"] .arsip-search-input');
      expect(arsipCss).toContain('[data-theme="dark"] .arsip-select-filter');
      expect(arsipCss).toContain('[data-theme="dark"] .arsip-item-card');
    });
  });
});

