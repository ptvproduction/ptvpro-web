import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Inventaris 4 Refinements Test Suite', () => {
  const unitBarcodesSectionPath = path.resolve(__dirname, '../../src/products/hub/inventaris/UnitBarcodesSection.tsx');
  const barcodeExportUtilsPath = path.resolve(__dirname, '../../src/products/hub/inventaris/utils/barcodeExportUtils.ts');
  const tambahAlatModalPath = path.resolve(__dirname, '../../src/products/hub/inventaris/TambahAlatModal.tsx');
  const alatDetailPagePath = path.resolve(__dirname, '../../src/products/hub/inventaris/AlatDetailPage.tsx');
  const inventarisCssPath = path.resolve(__dirname, '../../src/styles/inventaris.css');
  const dashboardCssPath = path.resolve(__dirname, '../../src/styles/dashboard.css');

  const unitBarcodesSection = fs.readFileSync(unitBarcodesSectionPath, 'utf-8');
  const barcodeExportUtils = fs.readFileSync(barcodeExportUtilsPath, 'utf-8');
  const tambahAlatModal = fs.readFileSync(tambahAlatModalPath, 'utf-8');
  const alatDetailPage = fs.readFileSync(alatDetailPagePath, 'utf-8');
  const inventarisCss = fs.readFileSync(inventarisCssPath, 'utf-8');
  const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf-8');

  describe('1. Label Barcode Unit — NIKSAN Brand Sanitization', () => {
    it('1.1 UnitBarcodesSection should render NIKSAN without PROGRESIF TV prefix on collab cards', () => {
      expect(unitBarcodesSection).toContain('<span>NIKSAN</span>');
      expect(unitBarcodesSection).not.toContain('<span>PROGRESIF TV × NIKSAN</span>');
    });

    it('1.2 barcodeExportUtils should export canvas and print layout with NIKSAN only', () => {
      expect(barcodeExportUtils).toContain("ctx.fillText('NIKSAN', 170, 137);");
      expect(barcodeExportUtils).not.toContain("ctx.fillText('PROGRESIF TV × NIKSAN', 170, 137);");
      expect(barcodeExportUtils).toContain('<span>NIKSAN</span>');
      expect(barcodeExportUtils).not.toContain('<span>PROGRESIF TV × NIKSAN</span>');
    });
  });

  describe('2. Riwayat Peminjaman Inventaris — Canonical Synchronization & States', () => {
    it('2.1 AlatDetailPage should match canonical loans using unit ID, unit code, master asset ID/code, and clean name', () => {
      expect(alatDetailPage).toContain('validUnitIds.has(loanUnitId)');
      expect(alatDetailPage).toContain('validUnitCodes.has(loanUnitCode)');
      expect(alatDetailPage).toContain('peminjamanService.getPeminjamanList()');
    });

    it('2.2 AlatDetailPage should have honest loansLoading and loansError states with retry button', () => {
      expect(alatDetailPage).toContain('const [loansLoading, setLoansLoading] = useState(false);');
      expect(alatDetailPage).toContain('const [loansError, setLoansError] = useState<string | null>(null);');
      expect(alatDetailPage).toContain('Memuat Riwayat Peminjaman...');
      expect(alatDetailPage).toContain('Coba Lagi');
      expect(alatDetailPage).toContain('fetchLoansForAsset');
    });

    it('2.3 AlatDetailPage should render accurate status chips for dikembalikan, terlambat, and dipinjam', () => {
      expect(alatDetailPage).toContain('Dikembalikan');
      expect(alatDetailPage).toContain('Terlambat');
      expect(alatDetailPage).toContain('Dipinjam');
      expect(alatDetailPage).toContain('Belum Ada Riwayat Peminjaman');
    });
  });

  describe('3. Tombol Tambah Unit — No Duplicate Plus Sign', () => {
    it('3.1 TambahAlatModal should not contain double plus sign in Tambah Unit button', () => {
      expect(tambahAlatModal).not.toContain('+ + Tambah Unit');
      expect(tambahAlatModal).not.toContain('+ Tambah Unit');
      expect(tambahAlatModal).toContain('<i className="fa-solid fa-plus" />\n                    Tambah Unit');
    });
  });

  describe('4. Ikon Search — Centering and Padding', () => {
    it('4.1 inventaris.css should configure search icon with inline-flex vertical centering and normalized input padding', () => {
      expect(inventarisCss).toContain('.r03-inventaris .inv-search-wrap .search-icon {');
      expect(inventarisCss).toContain('display: inline-flex;');
      expect(inventarisCss).toContain('align-items: center;');
      expect(inventarisCss).toContain('justify-content: center;');
      expect(inventarisCss).toContain('.r03-inventaris .inv-search-wrap input {');
    });

    it('4.2 dashboard.css should also configure .inv-search-wrap .search-icon with inline-flex vertical centering', () => {
      expect(dashboardCss).toContain('.inv-search-wrap .search-icon {');
      expect(dashboardCss).toContain('display: inline-flex;');
      expect(dashboardCss).toContain('align-items: center;');
      expect(dashboardCss).toContain('justify-content: center;');
    });
  });
});
