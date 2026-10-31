import { describe, it, expect } from 'vitest';
import { applyNilaiInventarisFilters } from '../../src/products/hub/inventaris/inventarisService';
import type { ItemInventaris } from '../../src/products/hub/inventaris/types';
import { resolveInventoryPhotoUrl } from '../../src/products/hub/inventaris/utils/inventoryPhotoUtils';

describe('PTV-DEV-128 Refinements Verification', () => {
  describe('Nilai Inventaris Multi-dimensional Filter Helper', () => {
    const mockItems: ItemInventaris[] = [
      {
        id: 'inv-1',
        kode: 'CAM-01',
        nama_alat: 'Sony A7 IV',
        kategori: 'Kamera',
        harga_beli: 30000000,
        sumber_perolehan: 'Kas PTV',
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z',
        units: [
          {
            id: 'u-1',
            inventaris_id: 'inv-1',
            kode_unit: 'CAM-01-U01',
            nomor_seri: 'SN-SONY-999',
            kondisi: 'bagus',
            status_peminjaman: 'tersedia',
            created_at: '2024-01-10T00:00:00Z',
            updated_at: '2024-01-10T00:00:00Z',
          },
        ],
        total_unit: 1,
        unit_tersedia: 1,
        nilai_inventaris: {
          id: 'val-1',
          inventaris_id: 'inv-1',
          nilai_perolehan: 30000000,
          tanggal_perolehan: '2024-01-10',
          sumber_perolehan: 'Kas PTV',
          vendor: 'Focus Nusantara',
          nomor_invoice: 'INV/2024/001',
          status: 'Aktif',
        },
      },
      {
        id: 'inv-2',
        kode: 'MIC-01',
        nama_alat: 'Rode Wireless Pro',
        kategori: 'Audio',
        harga_beli: 6000000,
        sumber_perolehan: 'Hibah Alumni',
        created_at: '2024-03-01T00:00:00Z',
        updated_at: '2024-03-01T00:00:00Z',
        units: [],
        total_unit: 1,
        unit_tersedia: 1,
        nilai_inventaris: {
          id: 'val-2',
          inventaris_id: 'inv-2',
          nilai_perolehan: 6000000,
          tanggal_perolehan: '2024-03-01',
          sumber_perolehan: 'Hibah Alumni',
          vendor: 'Sentra Digital',
          nomor_invoice: 'INV/2024/089',
          status: 'Belum Dicatat',
        },
      },
      {
        id: 'inv-3',
        kode: 'LGT-01',
        nama_alat: 'Aputure Amaran 200d',
        kategori: 'Lighting',
        harga_beli: 4500000,
        sumber_perolehan: 'Sponsor',
        created_at: '2023-11-15T00:00:00Z',
        updated_at: '2023-11-15T00:00:00Z',
        units: [],
        total_unit: 1,
        unit_tersedia: 0,
        nilai_inventaris: {
          id: 'val-3',
          inventaris_id: 'inv-3',
          nilai_perolehan: 4500000,
          tanggal_perolehan: '2023-11-15',
          sumber_perolehan: 'Sponsor',
          vendor: 'Doss Kamera',
          status: 'Dihapuskan',
        },
      },
    ];

    it('filters by category accurately', () => {
      const res = applyNilaiInventarisFilters(mockItems, { cat: 'Audio' });
      expect(res).toHaveLength(1);
      expect(res[0].kode).toBe('MIC-01');
    });

    it('filters by valuation status accurately', () => {
      const active = applyNilaiInventarisFilters(mockItems, { status: 'Aktif' });
      expect(active).toHaveLength(1);
      expect(active[0].kode).toBe('CAM-01');

      const discarded = applyNilaiInventarisFilters(mockItems, { status: 'Dihapuskan' });
      expect(discarded).toHaveLength(1);
      expect(discarded[0].kode).toBe('LGT-01');
    });

    it('filters by funding source (sumber_perolehan)', () => {
      const res = applyNilaiInventarisFilters(mockItems, { source: 'Kas PTV' });
      expect(res).toHaveLength(1);
      expect(res[0].kode).toBe('CAM-01');
    });

    it('filters by multi-token search matching unit serial or invoice', () => {
      const resSerial = applyNilaiInventarisFilters(mockItems, { q: 'SN-SONY-999' });
      expect(resSerial).toHaveLength(1);
      expect(resSerial[0].nama_alat).toBe('Sony A7 IV');

      const resInvoice = applyNilaiInventarisFilters(mockItems, { q: 'INV/2024/089' });
      expect(resInvoice).toHaveLength(1);
      expect(resInvoice[0].nama_alat).toBe('Rode Wireless Pro');
    });

    it('sorts correctly by val_desc and val_asc', () => {
      const desc = applyNilaiInventarisFilters(mockItems, { sortBy: 'val_desc' });
      expect(desc[0].kode).toBe('CAM-01');
      expect(desc[2].kode).toBe('LGT-01');

      const asc = applyNilaiInventarisFilters(mockItems, { sortBy: 'val_asc' });
      expect(asc[0].kode).toBe('LGT-01');
      expect(asc[2].kode).toBe('CAM-01');
    });

    it('combines multiple filters simultaneously', () => {
      const res = applyNilaiInventarisFilters(mockItems, {
        cat: 'Kamera',
        status: 'Aktif',
        source: 'Kas PTV',
        q: 'Sony',
      });
      expect(res).toHaveLength(1);
      expect(res[0].kode).toBe('CAM-01');

      const noMatch = applyNilaiInventarisFilters(mockItems, {
        cat: 'Lighting',
        status: 'Aktif',
      });
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('Riwayat Peminjaman Real Photo Resolution', () => {
    it('resolves relative or public https URL properly', () => {
      const path = '/assets/inventaris/sony-a7.jpg';
      const resolved = resolveInventoryPhotoUrl(path);
      expect(resolved).toBe('/assets/inventaris/sony-a7.jpg');

      const httpsUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventaris/sony.jpg';
      expect(resolveInventoryPhotoUrl(httpsUrl)).toBe(httpsUrl);
    });

    it('returns null for missing, whitespace, or unreachable local hosts', () => {
      expect(resolveInventoryPhotoUrl(undefined)).toBeNull();
      expect(resolveInventoryPhotoUrl(null as unknown as string)).toBeNull();
      expect(resolveInventoryPhotoUrl('   ')).toBeNull();
      expect(resolveInventoryPhotoUrl('http://ptv-rebuild.local/wp-content/uploads/a.jpg')).toBeNull();
    });
  });
});
