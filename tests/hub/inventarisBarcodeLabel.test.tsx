import { describe, it, expect } from 'vitest';
import {
  getCode128Modules,
  barcode128SVG,
  decodeCode128Barcode,
  getUnitBarcodeCode,
  isNiksanUnit,
  C128_PATTERNS
} from '../../src/products/hub/inventaris/utils/barcode128';

describe('Unit Barcode Code 128 & Label Integrity Tests', () => {
  it('1. C128_PATTERNS standard table length and stop symbol integrity', () => {
    expect(C128_PATTERNS.length).toBe(107);
    // Patterns 0-105 have length 6
    for (let i = 0; i <= 105; i++) {
      expect(C128_PATTERNS[i].length).toBe(6);
    }
    // Pattern 106 (STOP) has length 7 ("2331112")
    expect(C128_PATTERNS[106]).toBe('2331112');
  });

  it('2. getCode128Modules computes standard Start B, Checksum modulo 103, and Stop', () => {
    const raw = 'INV-788-01';
    const res = getCode128Modules(raw);

    expect(res.text).toBe('INV-788-01');
    expect(res.codes[0]).toBe(104); // Start B
    expect(res.codes[res.codes.length - 1]).toBe(106); // Stop symbol

    // Calculate manual checksum: 104 + sum(val * (i + 1))
    let manualCheck = 104;
    for (let i = 0; i < raw.length; i++) {
      manualCheck += (raw.charCodeAt(i) - 32) * (i + 1);
    }
    const expectedChecksum = manualCheck % 103;
    expect(res.checkSum).toBe(expectedChecksum);
    expect(res.codes[res.codes.length - 2]).toBe(expectedChecksum);
  });

  it('3. barcode128SVG produces valid SVG with quiet zone and solid dark bars', () => {
    const code = 'INV-032-01';
    const svg = barcode128SVG(code);

    expect(svg).toContain('<svg class="barcode-128"');
    expect(svg).toContain('fill="#ffffff"'); // White background
    expect(svg).toContain('fill="#0f172a"'); // Solid dark rects
    expect(svg).toContain('INV-032-01'); // Monospace human readable text
    expect(svg).toContain('letter-spacing: 2px;'); // Spacing below bars
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Barcode INV-032-01"');
  });

  it('4. Independent Code 128 Decoder decodes generated barcode back to 100% identical unit string', () => {
    const testCodes = [
      'INV-001-01',
      'INV-788-01',
      'INV-032-04',
      'INV-095-02',
      'INV-097-03',
      'INV-AUDIO-01',
      'NIKSAN-CAM-01'
    ];

    for (const originalCode of testCodes) {
      const { barStr } = getCode128Modules(originalCode);
      const decoded = decodeCode128Barcode(barStr);

      expect(decoded.isValid).toBe(true);
      expect(decoded.checksumValid).toBe(true);
      expect(decoded.code).toBe(originalCode);
    }
  });

  it('5. getUnitBarcodeCode formats unit codes correctly according to PHP Legacy rules', () => {
    // Normal case: master inv code + unit sequence
    expect(getUnitBarcodeCode('INV-788', 1)).toBe('INV-788-01');
    expect(getUnitBarcodeCode('INV-788', 9)).toBe('INV-788-09');
    expect(getUnitBarcodeCode('INV-788', 12)).toBe('INV-788-12');

    // With explicit code already present
    expect(getUnitBarcodeCode('INV-788', 2, 'INV-788-02')).toBe('INV-788-02');
    expect(getUnitBarcodeCode('INV-788', 3, 'CUSTOM-BARCODE-99')).toBe('CUSTOM-BARCODE-99');

    // Missing master code fallback
    expect(getUnitBarcodeCode(undefined, 1)).toBe('INV-000-01');
  });

  it('6. isNiksanUnit detects Niksan collaboration units accurately', () => {
    expect(isNiksanUnit({ nama_unit: 'Kamera Sony Niksan' })).toBe(true);
    expect(isNiksanUnit({ nama_unit: 'Sony Alpha Niksan Unit 1' })).toBe(true);
    expect(isNiksanUnit('Alat Kolaborasi Niksan')).toBe(true);

    expect(isNiksanUnit({ nama_unit: 'Unit 01', kode_unit: 'INV-032-01' })).toBe(false);
    expect(isNiksanUnit(null)).toBe(false);
    expect(isNiksanUnit(undefined)).toBe(false);
  });

  it('7. UnitBarcodesSection renders label cards, counts, and action buttons correctly', async () => {
    const { renderToString } = await import('react-dom/server');
    const { UnitBarcodesSection } = await import('../../src/products/hub/inventaris/UnitBarcodesSection');

    const mockAsset = {
      id: 'mock-asset-001',
      kode: 'INV-788',
      nama_alat: 'Kamera Cinema Pro',
      kategori: 'Kamera',
      total_unit: 2,
      unit_tersedia: 2,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      units: [
        {
          id: 'u-1',
          inventaris_id: 'mock-asset-001',
          kode_unit: 'INV-788-01',
          nama_unit: 'Unit 01',
          kondisi: 'bagus' as const,
          status_peminjaman: 'tersedia' as const,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'u-2',
          inventaris_id: 'mock-asset-001',
          kode_unit: 'INV-788-02',
          nama_unit: 'Unit 02 (Niksan)',
          kondisi: 'bagus' as const,
          status_peminjaman: 'tersedia' as const,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    };

    const html = renderToString(<UnitBarcodesSection asset={mockAsset} />);

    // Header & counters
    expect(html).toContain('Label Barcode Unit');
    expect(html).toContain('2 Unit Terdaftar');
    expect(html).toContain('Cetak Semua');
    expect(html).toContain('Ekspor Semua (PNG)');

    // Codes & units
    expect(html).toContain('INV-788-01');
    expect(html).toContain('INV-788-02');
    expect(html).toContain('Unit 01');
    expect(html).toContain('Unit 02 (Niksan)');

    // Barcode SVG elements
    expect(html).toContain('class="barcode-128"');
    expect(html).toContain('PROGRESIF TV');
    expect(html).toContain('NIKSAN');
    expect(html).not.toContain('PROGRESIF TV × NIKSAN');

    // Individual action buttons
    expect(html).toContain('Cetak');
    expect(html).toContain('Ekspor PNG');
  });
});
