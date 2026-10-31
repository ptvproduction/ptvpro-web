import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  INVENTORY_CATEGORIES,
  normalizeInventoryCategory,
  sortInventoryItems,
} from '../../src/products/hub/inventaris/inventarisService';
import { ItemInventaris } from '../../src/products/hub/inventaris/types';

describe('Inventaris Kategori & Urutan Regression Suite (INV-01, INV-02, INV-03)', () => {
  describe('1. Canonical 17 Categories Completeness & Order (INV-02)', () => {
    it('1.1 Should have exactly 17 canonical categories', () => {
      expect(INVENTORY_CATEGORIES.length).toBe(17);
    });

    it('1.2 Should preserve exact canonical order matching legacy dashboard page-dasbor.php', () => {
      const expectedCategories = [
        'Kamera',
        'Lensa',
        'Tripod',
        'Baterai & Power',
        'Smartphone / Tablet',
        'Komputer / Laptop',
        'Audio',
        'Lighting',
        'Streaming / Live Production',
        'Kabel & Adapter',
        'Dry Cabinet',
        'TV / Smart TV',
        'Storage',
        'Peralatan & Perkakas',
        'ATK',
        'Pengaturan Jaringan',
        'Lainnya',
      ];

      expect(INVENTORY_CATEGORIES).toEqual(expectedCategories);
    });
  });

  describe('2. Category Normalization (INV-03 & Variant Matching)', () => {
    it('2.1 Should normalize Tripod and related stabilization equipment to "Tripod"', () => {
      expect(normalizeInventoryCategory('Tripod')).toBe('Tripod');
      expect(normalizeInventoryCategory('Tripod & Rig')).toBe('Tripod');
      expect(normalizeInventoryCategory('tripod')).toBe('Tripod');
      expect(normalizeInventoryCategory('Monopod')).toBe('Tripod');
      expect(normalizeInventoryCategory('Stabilizer')).toBe('Tripod');
      expect(normalizeInventoryCategory('Gimbal')).toBe('Tripod');
    });

    it('2.2 Should normalize production database variations to their canonical forms', () => {
      // Cables
      expect(normalizeInventoryCategory('Kabel')).toBe('Kabel & Adapter');
      expect(normalizeInventoryCategory('Kabel & Adapter')).toBe('Kabel & Adapter');

      // Streaming
      expect(normalizeInventoryCategory('Streaming')).toBe('Streaming / Live Production');
      expect(normalizeInventoryCategory('Streaming / Live')).toBe('Streaming / Live Production');
      expect(normalizeInventoryCategory('Streaming / Live Production')).toBe('Streaming / Live Production');

      // Computer
      expect(normalizeInventoryCategory('Komputer')).toBe('Komputer / Laptop');
      expect(normalizeInventoryCategory('Komputer / Laptop')).toBe('Komputer / Laptop');

      // Smartphone / Tablet
      expect(normalizeInventoryCategory('Smartphone/Tablet')).toBe('Smartphone / Tablet');
      expect(normalizeInventoryCategory('Smartphone / Tablet')).toBe('Smartphone / Tablet');

      // Audio & Lighting
      expect(normalizeInventoryCategory('Audio')).toBe('Audio');
      expect(normalizeInventoryCategory('Mic Wireless')).toBe('Audio');
      expect(normalizeInventoryCategory('Lighting')).toBe('Lighting');
      expect(normalizeInventoryCategory('Lampu')).toBe('Lighting');

      // Storage & Tools
      expect(normalizeInventoryCategory('Storage')).toBe('Storage');
      expect(normalizeInventoryCategory('SD Card')).toBe('Storage');
      expect(normalizeInventoryCategory('Peralatan & Perkakas')).toBe('Peralatan & Perkakas');
      expect(normalizeInventoryCategory('ATK')).toBe('ATK');
      expect(normalizeInventoryCategory('Pengaturan Jaringan')).toBe('Pengaturan Jaringan');
    });

    it('2.3 Should fallback null, undefined, or empty values to "Lainnya"', () => {
      expect(normalizeInventoryCategory(null)).toBe('Lainnya');
      expect(normalizeInventoryCategory(undefined)).toBe('Lainnya');
      expect(normalizeInventoryCategory('')).toBe('Lainnya');
      expect(normalizeInventoryCategory('   ')).toBe('Lainnya');
      expect(normalizeInventoryCategory('Barang Tak Terduga 12345')).toBe('Lainnya');
    });
  });

  describe('3. Hierarchical 3-Level Inventory Sorting (INV-01)', () => {
    it('3.1 Level 1: Should sort primarily by category order (1 to 17)', () => {
      const items = [
        { kode: 'INV-010', nama_alat: 'XDCAM Cable', kategori: 'Kabel & Adapter' },
        { kode: 'INV-002', nama_alat: 'Sony A7 IV', kategori: 'Kamera' },
        { kode: 'INV-005', nama_alat: 'Takara Tripod', kategori: 'Tripod' },
        { kode: 'INV-003', nama_alat: 'Sony FE 50mm', kategori: 'Lensa' },
        { kode: 'INV-020', nama_alat: 'Rode Mic', kategori: 'Audio' },
      ];

      const sorted = sortInventoryItems(items);
      expect(sorted.map((x) => x.kategori)).toEqual([
        'Kamera',
        'Lensa',
        'Tripod',
        'Audio',
        'Kabel & Adapter',
      ]);
    });

    it('3.2 Level 2: Should sort by Equipment Name A-Z within the same category', () => {
      const cameraItems = [
        { kode: 'INV-004', nama_alat: 'Sony XDCAM', kategori: 'Kamera' },
        { kode: 'INV-001', nama_alat: 'Bardi IP Camera Indoor PTZ', kategori: 'Kamera' },
        { kode: 'INV-003', nama_alat: 'Sony NXCAM', kategori: 'Kamera' },
        { kode: 'INV-002', nama_alat: 'Sony A7iii Body Only', kategori: 'Kamera' },
      ];

      const sorted = sortInventoryItems(cameraItems);
      expect(sorted.map((x) => x.nama_alat)).toEqual([
        'Bardi IP Camera Indoor PTZ',
        'Sony A7iii Body Only',
        'Sony NXCAM',
        'Sony XDCAM',
      ]);
    });

    it('3.3 Level 3: Should use Equipment Code A-Z as tie-breaker for identical names', () => {
      const duplicateNamed = [
        { kode: 'INV-099', nama_alat: 'Tripod Stand', kategori: 'Tripod' },
        { kode: 'INV-019', nama_alat: 'Tripod Stand', kategori: 'Tripod' },
        { kode: 'INV-050', nama_alat: 'Tripod Stand', kategori: 'Tripod' },
      ];

      const sorted = sortInventoryItems(duplicateNamed);
      expect(sorted.map((x) => x.kode)).toEqual(['INV-019', 'INV-050', 'INV-099']);
    });
  });

  describe('4. Real Production Bundle Audit Verification', () => {
    it('4.1 Should accurately map all 161 items of production-bundle.json into 17 canonical categories', () => {
      const bundlePath = path.resolve('production-bundle.json');
      if (!fs.existsSync(bundlePath)) {
        // Skip if bundle not present in test env
        return;
      }

      const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
      const items: ItemInventaris[] = bundle.ptv_inventaris || [];
      expect(items.length).toBe(161);

      const categoryCounts: Record<string, number> = {};
      INVENTORY_CATEGORIES.forEach((c) => (categoryCounts[c] = 0));

      items.forEach((it) => {
        const canonical = normalizeInventoryCategory(it.kategori);
        expect(INVENTORY_CATEGORIES).toContain(canonical);
        categoryCounts[canonical] = (categoryCounts[canonical] || 0) + 1;
      });

      // Total count across all categories must match exactly 161
      const totalCategorized = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
      expect(totalCategorized).toBe(161);

      // Verify specific known category quantities
      expect(categoryCounts['Kamera']).toBe(6);
      expect(categoryCounts['Lensa']).toBe(4);
      expect(categoryCounts['Tripod']).toBe(5);
      expect(categoryCounts['Baterai & Power']).toBe(0);
      expect(categoryCounts['Smartphone / Tablet']).toBe(4);
      expect(categoryCounts['Komputer / Laptop']).toBe(6);
      expect(categoryCounts['Audio']).toBe(18);
      expect(categoryCounts['Lighting']).toBe(3);
      expect(categoryCounts['Streaming / Live Production']).toBe(13);
      expect(categoryCounts['Kabel & Adapter']).toBe(37);
      expect(categoryCounts['Dry Cabinet']).toBe(4);
      expect(categoryCounts['TV / Smart TV']).toBe(4);
      expect(categoryCounts['Storage']).toBe(16);
      expect(categoryCounts['Peralatan & Perkakas']).toBe(13);
      expect(categoryCounts['ATK']).toBe(5);
      expect(categoryCounts['Pengaturan Jaringan']).toBe(5);
      expect(categoryCounts['Lainnya']).toBe(18);
    });
  });
});
