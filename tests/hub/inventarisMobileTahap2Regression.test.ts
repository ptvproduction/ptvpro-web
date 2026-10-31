import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Inventaris Revision Tahap 2 Regression Suite (INV-05 s.d. INV-09)', () => {
  const inventarisCssPath = path.resolve(__dirname, '../../src/styles/inventaris.css');
  const dashboardCssPath = path.resolve(__dirname, '../../src/styles/dashboard.css');
  const alatDetailPagePath = path.resolve(__dirname, '../../src/products/hub/inventaris/AlatDetailPage.tsx');
  const inventarisPagePath = path.resolve(__dirname, '../../src/products/hub/inventaris/InventarisPage.tsx');

  const inventarisCss = fs.readFileSync(inventarisCssPath, 'utf-8');
  const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf-8');
  const alatDetailPage = fs.readFileSync(alatDetailPagePath, 'utf-8');
  const inventarisPage = fs.readFileSync(inventarisPagePath, 'utf-8');

  describe('INV-05 — Grid Inventaris Mobile 2 Kolom', () => {
    it('1.1 Should contain 2-column grid definition under @media (max-width: 640px)', () => {
      expect(inventarisCss).toContain('@media (max-width: 640px)');
      expect(inventarisCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    });

    it('1.2 Should tune card padding, thumbnail, status badge, and line clamp for mobile', () => {
      expect(inventarisCss).toContain('.r03-inventaris .inv-prod-card');
      expect(inventarisCss).toContain('.r03-inventaris .inv-prod-status-badge');
      expect(inventarisCss).toContain('-webkit-line-clamp: 2');
      expect(inventarisCss).toContain('text-overflow: ellipsis');
    });

    it('1.3 Should preserve desktop auto-fill grid for desktop viewports', () => {
      expect(inventarisCss).toContain('grid-template-columns: repeat(auto-fill, minmax(210px, 1fr))');
    });

    it('1.4 InventarisPage JSX should render semantic classes for responsive tuning', () => {
      expect(inventarisPage).toContain('inv-prod-cat');
      expect(inventarisPage).toContain('inv-prod-unit-status');
      expect(inventarisPage).toContain('inv-prod-loc-row');
      expect(inventarisPage).toContain('inv-prod-loc-text');
    });
  });

  describe('INV-06 — Tombol Aksi Detail Touch Targets & Hierarchy', () => {
    it('2.1 Should configure desktop button height to 48px with generous padding', () => {
      expect(dashboardCss).toMatch(/\.prod-btn-basket\s*\{[^}]*height:\s*48px;/);
      expect(dashboardCss).toMatch(/\.prod-btn-primary-borrow\s*\{[^}]*height:\s*48px;/);
    });

    it('2.2 Should configure mobile action buttons to 48px minimum height for comfortable touch targets', () => {
      expect(dashboardCss).toContain('height: 48px !important');
      expect(dashboardCss).toContain('min-height: 48px !important');
    });

    it('2.3 Should preserve clear primary (gradient blue) and secondary (white surface) visual hierarchy', () => {
      expect(dashboardCss).toContain('background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)');
      expect(dashboardCss).toContain('.prod-btn-basket.added');
    });
  });

  describe('INV-07 — Unit Fisik Vertikal pada Mobile', () => {
    it('3.1 Should display physical units in a vertical stack (flex-direction: column) on mobile', () => {
      expect(dashboardCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.prod-unit-cards-scroll\s*\{[\s\S]*?flex-direction:\s*column\s*!important;/);
    });

    it('3.2 Each unit card should take 100% width (one card per row) on mobile', () => {
      expect(dashboardCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.prod-unit-hcard\s*\{[\s\S]*?width:\s*100%\s*!important;/);
    });

    it('3.3 Navigation arrows should be hidden on mobile via prod-unit-desktop-nav', () => {
      expect(alatDetailPage).toContain('prod-unit-desktop-nav');
      expect(dashboardCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.prod-unit-desktop-nav\s*\{[\s\S]*?display:\s*none\s*!important;/);
    });

    it('3.4 Desktop should retain the horizontal carousel structure', () => {
      expect(dashboardCss).toContain('.prod-unit-cards-scroll {');
      expect(dashboardCss).toContain('flex-direction: row;');
      expect(dashboardCss).toContain('overflow-x: auto;');
    });
  });

  describe('INV-08 — Informasi Berulang (Redundant Specs Suppression)', () => {
    it('4.1 Should display primary specification once in the showcase card header', () => {
      expect(alatDetailPage).toContain('className="prod-subhead"');
      expect(alatDetailPage).toContain('asset.spesifikasi');
    });

    it('4.2 Should conditionally suppress Spesifikasi & Catatan Teknis section if no distinct information exists', () => {
      expect(alatDetailPage).toContain('const hasDistinctSpecs = additionalNotes && additionalNotes.toLowerCase() !== primaryDesc.toLowerCase()');
      expect(alatDetailPage).toContain('if (!hasDistinctSpecs) return null;');
    });
  });

  describe('INV-09 — Redesign Detail Inventaris Mobile & No Internal Technical Leaks', () => {
    it('5.1 Should not leak Supabase project ID (swadgljnyelsjstqqxbm) to end-user UI', () => {
      expect(alatDetailPage).not.toContain('swadgljnyelsjstqqxbm');
    });

    it('5.2 Should not leak internal development phase status (Pilot 2 Ditunda) to end-user UI', () => {
      expect(alatDetailPage).not.toContain('Pilot 2');
      expect(alatDetailPage).not.toContain('Ditunda');
    });

    it('5.3 Should provide a compact, professional history empty state component', () => {
      expect(alatDetailPage).toContain('prod-empty-history-compact');
      expect(alatDetailPage).toContain('prod-empty-history-icon-compact');
      expect(alatDetailPage).toContain('prod-empty-history-title-compact');
      expect(alatDetailPage).toContain('Belum Ada Riwayat Peminjaman');
      expect(dashboardCss).toContain('.prod-empty-history-compact');
    });

    it('5.4 Should style mobile showcase card, pricing box, and 2x2 metadata grid with efficient compact dimensions', () => {
      expect(dashboardCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.prod-spec-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*1fr\)\s*!important;/);
      expect(dashboardCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.prod-showcase-card\s*\{[\s\S]*?padding:\s*16px\s*!important;/);
    });

    it('5.5 Should retain all interactive functions: Edit, Pinjam Sekarang, Daftar Pinjaman, and Unit actions', () => {
      expect(alatDetailPage).toContain('id="btnEditAlat"');
      expect(alatDetailPage).toContain('className="prod-btn-primary-borrow"');
      expect(alatDetailPage).toContain('className={`prod-btn-basket');
      expect(alatDetailPage).toContain('handleUnitBasketToggle');
    });
  });
});
