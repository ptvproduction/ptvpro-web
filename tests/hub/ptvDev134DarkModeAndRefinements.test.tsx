import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeBarcodeBranding } from '../../src/products/hub/inventaris/utils/barcodeExportUtils';
import { isInventoryTestFixture } from '../../src/products/hub/inventaris/inventarisService';

describe('PTV-DEV-134 Comprehensive Verification Suite', () => {
  const dashboardCssPath = path.resolve(__dirname, '../../src/styles/dashboard.css');
  const financeCssPath = path.resolve(__dirname, '../../src/products/hub/keuangan/financeFoundation.css');
  const loanModalCssPath = path.resolve(__dirname, '../../src/styles/loanModal.css');
  const inventarisCssPath = path.resolve(__dirname, '../../src/styles/inventaris.css');
  const editAlatModalPath = path.resolve(__dirname, '../../src/products/hub/inventaris/EditAlatModal.tsx');
  const alatDetailPagePath = path.resolve(__dirname, '../../src/products/hub/inventaris/AlatDetailPage.tsx');
  const unitBarcodesSectionPath = path.resolve(__dirname, '../../src/products/hub/inventaris/UnitBarcodesSection.tsx');

  const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf-8');
  const financeCss = fs.readFileSync(financeCssPath, 'utf-8');
  const loanModalCss = fs.readFileSync(loanModalCssPath, 'utf-8');
  const inventarisCss = fs.readFileSync(inventarisCssPath, 'utf-8');
  const editAlatModal = fs.readFileSync(editAlatModalPath, 'utf-8');
  const alatDetailPage = fs.readFileSync(alatDetailPagePath, 'utf-8');
  const unitBarcodesSection = fs.readFileSync(unitBarcodesSectionPath, 'utf-8');

  describe('1. Dark Mode Detail Inventaris & EditAlatModal', () => {
    it('1.1 dashboard.css should provide dark mode rules for all prod- surfaces', () => {
      expect(dashboardCss).toContain(':root[data-theme="dark"] .prod-showcase-card');
      expect(dashboardCss).toContain(':root[data-theme="dark"] .prod-main-photo-wrap');
      expect(dashboardCss).toContain(':root[data-theme="dark"] .prod-pricing-box');
      expect(dashboardCss).toContain(':root[data-theme="dark"] .prod-spec-card');
      expect(dashboardCss).toContain(':root[data-theme="dark"] .prod-unit-hcard');
      expect(dashboardCss).toContain(':root[data-theme="dark"] .prod-section-card');
      expect(dashboardCss).toContain(':root[data-theme="dark"] .prod-tech-specs-box');
      expect(dashboardCss).toContain(':root[data-theme="dark"] .loan-hist-card');
    });

    it('1.2 EditAlatModal should use theme tokens instead of hardcoded white/slate backgrounds', () => {
      expect(editAlatModal).toContain("background: 'var(--surface, #ffffff)'");
      expect(editAlatModal).toContain("background: 'var(--card-bg, #ffffff)'");
      expect(editAlatModal).toContain("background: 'var(--bg-2, #F8FAFC)'");
      expect(editAlatModal).toContain("border: '1.5px solid var(--line-2)'");
      expect(editAlatModal).toContain("borderBottom: '1px solid var(--line-2)'");
      expect(editAlatModal).toContain("borderTop: '1px solid var(--line-2)'");
    });

    it('1.3 AlatDetailPage should use semantic CSS variables for buttons and metadata text', () => {
      expect(alatDetailPage).toContain("background: 'var(--surface, var(--card-bg, #ffffff))'");
      expect(alatDetailPage).toContain("background: 'var(--surface, var(--bg-card, #ffffff))'");
    });
  });

  describe('2. Search UI Positioning & Isolation', () => {
    it('2.1 financeFoundation.css should scope .search-icon to prevent global layout collision', () => {
      expect(financeCss).not.toContain('\n.search-icon {\n  position: absolute;');
      expect(financeCss).toContain('.toolbar-search-wrap .search-icon');
    });

    it('2.2 loanModal.css should enforce static positioning for .search-icon', () => {
      expect(loanModalCss).toContain('position: static !important');
    });

    it('2.3 inventaris.css and dashboard.css should protect inventory search icon', () => {
      expect(inventarisCss).toContain('.inv-search-wrap .search-icon');
      expect(dashboardCss).toContain('.inv-search-wrap .search-icon');
    });
  });

  describe('3. Fixture INV-977 Safe Exclusion', () => {
    it('3.1 isInventoryTestFixture should identify INV-977 and UJI-STAGING test fixtures', () => {
      expect(isInventoryTestFixture({ kode: 'INV-977', nama_alat: 'UJI-STAGING — Inventaris' })).toBe(true);
      expect(isInventoryTestFixture({ kode: 'inv-977' })).toBe(true);
      expect(isInventoryTestFixture({ id: 'ff39f521-a6aa-42ba-aa93-33b6c49941f6' })).toBe(true);
      expect(isInventoryTestFixture({ nama_alat: 'UJI-STAGING — Inventaris' })).toBe(true);
    });

    it('3.2 isInventoryTestFixture should NOT exclude legitimate production or staging operational gear', () => {
      expect(isInventoryTestFixture({ kode: 'INV-001', nama_alat: 'Sony FX3 Cinema Line' })).toBe(false);
      expect(isInventoryTestFixture({ kode: 'INV-042', nama_alat: 'Hollyland Mars 400S Pro' })).toBe(false);
      expect(isInventoryTestFixture({ kode: 'INV-100', nama_alat: 'Kamera Staging Studio' })).toBe(false);
    });
  });

  describe('4. Standardisasi Label Barcode NIKSAN', () => {
    it('4.1 normalizeBarcodeBranding should normalize all variations of NIKSAN to NIKSAN', () => {
      expect(normalizeBarcodeBranding('PROGRESIF TV × NIKSAN', true)).toBe('NIKSAN');
      expect(normalizeBarcodeBranding('PTV × NIKSAN')).toBe('NIKSAN');
      expect(normalizeBarcodeBranding('NIKSAN')).toBe('NIKSAN');
      expect(normalizeBarcodeBranding(null, true)).toBe('NIKSAN');
      expect(normalizeBarcodeBranding('PROGRESIF TV', false)).toBe('PROGRESIF TV');
      expect(normalizeBarcodeBranding(null, false)).toBe('PROGRESIF TV');
    });

    it('4.2 UnitBarcodesSection should render normalized NIKSAN header and footer', () => {
      expect(unitBarcodesSection).toContain('{normalizeBarcodeBranding(\'NIKSAN\', isNik)}');
      expect(unitBarcodesSection).toContain('<span>NIKSAN</span>');
      expect(unitBarcodesSection).not.toContain('<span>PROGRESIF TV × NIKSAN</span>');
    });
  });
});
