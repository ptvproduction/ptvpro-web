import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { UnitPickerModal } from '../../src/products/hub/inventaris/UnitPickerModal';
import { BackToTopButton } from '../../src/shared/components/BackToTopButton';
import { loanBasketStore } from '../../src/products/hub/inventaris/loanBasketStore';
import { ItemInventaris } from '../../src/products/hub/inventaris/types';

const mockAssetSingle: ItemInventaris = {
  id: 'asset-camera-1',
  kode: 'INV-CAM-01',
  nama_alat: 'Sony FX3 Cinema Line',
  kategori: 'Kamera',
  spesifikasi: 'Full Frame Cinema Camera',
  total_unit: 1,
  unit_tersedia: 1,
  foto_url: '',
  units: [
    {
      id: 'unit-uuid-001',
      inventaris_id: 'asset-camera-1',
      kode_unit: 'INV-CAM-01-U01',
      nama_unit: 'Unit 01',
      kondisi: 'bagus',
      status_peminjaman: 'tersedia',
      lokasi_penyimpanan: 'Studio PTV',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockAssetMulti: ItemInventaris = {
  id: 'asset-tripod-1',
  kode: 'INV-TRP-01',
  nama_alat: 'Tripod E-Image EG03A2',
  kategori: 'Tripod',
  spesifikasi: 'Heavy Duty Fluid Head',
  total_unit: 2,
  unit_tersedia: 1,
  foto_url: '',
  units: [
    {
      id: 'unit-uuid-002',
      inventaris_id: 'asset-tripod-1',
      kode_unit: 'INV-TRP-01-U01',
      nama_unit: 'Unit 01',
      kondisi: 'bagus',
      status_peminjaman: 'tersedia',
      lokasi_penyimpanan: 'Studio PTV',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'unit-uuid-003',
      inventaris_id: 'asset-tripod-1',
      kode_unit: 'INV-TRP-01-U02',
      nama_unit: 'Unit 02',
      kondisi: 'rusak',
      status_peminjaman: 'tersedia',
      lokasi_penyimpanan: 'Studio PTV',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('P0 Hotfix: UnitPickerModal & BackToTopButton Tests', () => {
  beforeEach(() => {
    loanBasketStore.clear();
    vi.restoreAllMocks();
  });

  describe('1. UnitPickerModal Rendering & Parity', () => {
    it('1.1 Renders null when closed or no asset is passed', () => {
      const htmlClosed = renderToString(
        <UnitPickerModal
          isOpen={false}
          asset={mockAssetSingle}
          onClose={() => {}}
          onOpenLoanModal={() => {}}
        />
      );
      expect(htmlClosed).toBe('');

      const htmlNoAsset = renderToString(
        <UnitPickerModal
          isOpen={true}
          asset={null}
          onClose={() => {}}
          onOpenLoanModal={() => {}}
        />
      );
      expect(htmlNoAsset).toBe('');
    });

    it('1.2 Renders unit picker modal with correct title, master item, and available count', () => {
      const html = renderToString(
        <UnitPickerModal
          isOpen={true}
          asset={mockAssetSingle}
          onClose={() => {}}
          onOpenLoanModal={() => {}}
        />
      );

      expect(html).toContain('Pilih Unit untuk Daftar Pinjaman');
      expect(html).toContain('Sony FX3 Cinema Line');
      expect(html).toContain('INV-CAM-01');
      expect(html).toContain('unit fisik siap dipinjam');
      expect(html).toMatch(/0.*unit di daftar pinjaman/);
    });

    it('1.3 Correctly renders physical units list with condition and availability chips', () => {
      const html = renderToString(
        <UnitPickerModal
          isOpen={true}
          asset={mockAssetMulti}
          onClose={() => {}}
          onOpenLoanModal={() => {}}
        />
      );

      // Available unit 1 has selectable button
      expect(html).toContain('Pilih Unit');
      // Damaged unit 2 has Tidak Tersedia chip
      expect(html).toContain('Tidak Tersedia');
      expect(html).toContain('Unit 01');
      expect(html).toContain('INV-TRP-01-U01');
      expect(html).toContain('INV-TRP-01-U02');
    });
  });

  describe('2. loanBasketStore Cross-Component Synchronized Selection', () => {
    it('2.1 Does not automatically select all units on open', () => {
      expect(loanBasketStore.getCount()).toBe(0);
      expect(loanBasketStore.has('unit-uuid-002')).toBe(false);
      expect(loanBasketStore.hasAsset('asset-tripod-1')).toBe(false);
    });

    it('2.2 Synchronizes toggle by UUID, assetId_unitId, and unit code', () => {
      loanBasketStore.toggle({
        key: 'asset-tripod-1_unit-uuid-002',
        assetId: 'asset-tripod-1',
        unitId: 'unit-uuid-002',
        unitNo: 1,
        unitCode: 'INV-TRP-01-U01',
        unitName: 'Unit 01 (INV-TRP-01-U01)',
        assetName: 'Tripod E-Image EG03A2',
        invCode: 'INV-TRP-01',
      });

      expect(loanBasketStore.getCount()).toBe(1);
      // Synchronized across all query formats:
      expect(loanBasketStore.has('unit-uuid-002')).toBe(true);
      expect(loanBasketStore.has('asset-tripod-1_unit-uuid-002')).toBe(true);
      expect(loanBasketStore.has('INV-TRP-01_1')).toBe(true);
      expect(loanBasketStore.hasAsset('asset-tripod-1')).toBe(true);
      expect(loanBasketStore.hasAssetUnit('asset-tripod-1', 'unit-uuid-002')).toBe(true);
      expect(loanBasketStore.hasAssetUnit('asset-tripod-1', 1)).toBe(true);

      // Toggling again removes it
      loanBasketStore.toggle({
        key: 'asset-tripod-1_unit-uuid-002',
        assetId: 'asset-tripod-1',
        unitId: 'unit-uuid-002',
        unitNo: 1,
        unitCode: 'INV-TRP-01-U01',
        unitName: 'Unit 01 (INV-TRP-01-U01)',
        assetName: 'Tripod E-Image EG03A2',
        invCode: 'INV-TRP-01',
      });
      expect(loanBasketStore.getCount()).toBe(0);
      expect(loanBasketStore.has('unit-uuid-002')).toBe(false);
    });
  });

  describe('3. Global BackToTopButton Rendering & Behavior', () => {
    it('3.1 Renders button element with accessibility attributes and arrow icon', () => {
      const html = renderToString(
        <MemoryRouter>
          <BackToTopButton threshold={350} />
        </MemoryRouter>
      );

      expect(html).toContain('ptv-back-to-top-btn');
      expect(html).toContain('aria-label="Kembali ke atas"');
      expect(html).toContain('title="Kembali ke atas"');
      expect(html).toContain('fa-arrow-up');
    });

    it('3.2 Initially rendered without .show class when at top', () => {
      const html = renderToString(
        <MemoryRouter>
          <BackToTopButton threshold={350} />
        </MemoryRouter>
      );

      expect(html).not.toContain('show');
    });
  });
});
