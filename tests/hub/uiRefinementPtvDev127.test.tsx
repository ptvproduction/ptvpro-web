import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { matchInventoryCode } from '@/products/hub/inventaris/InventoryScanDialog';
import { ItemInventaris } from '@/products/hub/inventaris/types';
import { AcaraCard } from '@/products/hub/acara/components/AcaraCard';
import { AcaraItem } from '@/products/hub/acara/types';
import fs from 'fs';
import path from 'path';

describe('PTV-DEV-127: UI & Functional Refinements', () => {
  const mockAcara: AcaraItem = {
    id: 'ev-test-1',
    name: 'Kajian Rutin Ahad Pagi Studio PTV',
    date: '2026-10-25',
    time: '08:00 – 11:30',
    loc: 'Studio Utama Gedung Multimedia',
    status: 'Mendatang',
    notes: 'Liputan multi-kamera',
    crew: [],
    gear: [],
    rundown: [],
    display_color: 'biru',
    sessions: [],
    notulensi_ids: [],
    type: 'internal',
    dresscode: 'Seragam PTV Hitam',
    doc: '',
    created_at: '2026-10-21T00:00:00Z',
    updated_at: '2026-10-21T00:00:00Z',
  };

  const mockCatalogItems: ItemInventaris[] = [
    {
      id: 'asset-sony-a74',
      kode: 'INV-KMR-001',
      nama_alat: 'Sony A7 IV Mirrorless Camera',
      kategori: 'Kamera',
      foto_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80',
      total_unit: 2,
      unit_tersedia: 2,
      units: [
        {
          id: 'unit-sony-01',
          inventaris_id: 'asset-sony-a74',
          kode_unit: 'INV-KMR-001-U01',
          nomor_seri: 'SN-SONY-99881',
          kondisi: 'bagus',
          status_peminjaman: 'tersedia',
          created_at: '2026-10-01',
          updated_at: '2026-10-01',
        },
        {
          id: 'unit-sony-02',
          inventaris_id: 'asset-sony-a74',
          kode_unit: 'INV-KMR-001-U02',
          nomor_seri: 'SN-SONY-99882',
          kondisi: 'rusak',
          status_peminjaman: 'maintenance',
          created_at: '2026-10-01',
          updated_at: '2026-10-01',
        },
      ],
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    },
    {
      id: 'asset-mic-rode',
      kode: 'INV-AUD-005',
      nama_alat: 'Rode Wireless GO II Dual Mic',
      kategori: 'Audio',
      foto_url: undefined,
      total_unit: 1,
      unit_tersedia: 1,
      units: [
        {
          id: 'unit-rode-01',
          inventaris_id: 'asset-mic-rode',
          kode_unit: 'INV-AUD-005-U01',
          kondisi: 'bagus',
          status_peminjaman: 'tersedia',
          created_at: '2026-10-01',
          updated_at: '2026-10-01',
        },
      ],
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    },
  ];

  describe('1. Agenda Berikutnya & Modul Acara', () => {
    it('Kartu acara menggunakan border netral dan tidak memiliki border-inline-start warna vertikal di CSS', () => {
      const cssPath = path.resolve(__dirname, '../../src/styles/acara.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).not.toMatch(/\.acara-item-row\s*\{[^}]*border-inline-start:\s*3px solid/i);
      expect(cssContent).toMatch(/\.acara-item-row\s*\{[^}]*border:\s*1px solid var\(--line/i);
    });

    it('Metadata acara tersusun dalam satu baris dengan nowrap dan pemotongan lokasi rapi', () => {
      const cssPath = path.resolve(__dirname, '../../src/styles/acara.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toMatch(/\.acara-item-meta\s*\{[^}]*flex-wrap:\s*nowrap;/i);
      expect(cssContent).toMatch(/\.acara-item-meta\s*\{[^}]*white-space:\s*nowrap;/i);
      expect(cssContent).toMatch(/\.acara-item-meta\s*\{[^}]*overflow:\s*hidden;/i);
    });

    it('AcaraCard merender class pembungkus lokasi dan waktu tanpa error', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AcaraCard event={mockAcara} compact={true} />
        </MemoryRouter>
      );

      expect(html).toContain('acara-meta-loc');
      expect(html).toContain('acara-loc-text');
      expect(html).toContain('acara-meta-time');
      expect(html).toContain('acara-meta-sep');
      expect(html).toContain('Kajian Rutin Ahad Pagi Studio PTV');
    });
  });

  describe('2. Scanner Barcode Inventaris (Kamera Nyata & Pencocokan Data)', () => {
    it('matchInventoryCode mencocokkan kode unit fisik persis dengan tepat', () => {
      const result = matchInventoryCode('INV-KMR-001-U01', mockCatalogItems);
      expect(result.matched).toBe(true);
      expect(result.unit?.kode_unit).toBe('INV-KMR-001-U01');
      expect(result.asset?.nama_alat).toBe('Sony A7 IV Mirrorless Camera');
      expect(result.unitIndex).toBe(1);
    });

    it('matchInventoryCode mencocokkan kode induk alat dengan tepat', () => {
      const result = matchInventoryCode('INV-KMR-001', mockCatalogItems);
      expect(result.matched).toBe(true);
      expect(result.asset?.kode).toBe('INV-KMR-001');
      expect(result.asset?.nama_alat).toBe('Sony A7 IV Mirrorless Camera');
    });

    it('matchInventoryCode mencocokkan nomor seri unit fisik dengan tepat', () => {
      const result = matchInventoryCode('SN-SONY-99881', mockCatalogItems);
      expect(result.matched).toBe(true);
      expect(result.unit?.kode_unit).toBe('INV-KMR-001-U01');
    });

    it('matchInventoryCode menolak kode fiktif yang tidak ditemukan dan memberikan pesan error yang jujur', () => {
      const result = matchInventoryCode('INV-PALSU-999', mockCatalogItems);
      expect(result.matched).toBe(false);
      expect(result.message).toContain('tidak ditemukan pada katalog');
    });

    it('matchInventoryCode menolak kode kosong', () => {
      const result = matchInventoryCode('   ', mockCatalogItems);
      expect(result.matched).toBe(false);
      expect(result.message).toBe('Kode kosong.');
    });
  });

  describe('3. Modal Peminjaman Alat (Thumbnail Foto & Category Rail Drag Navigation)', () => {
    it('CSS loanModal.css memiliki aturan untuk loan-cat-rail-wrap, loan-cat-nav-btn, dan loan-asset-thumb-box', () => {
      const cssPath = path.resolve(__dirname, '../../src/styles/loanModal.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toContain('.loan-cat-rail-wrap');
      expect(cssContent).toContain('.loan-cat-nav-btn');
      expect(cssContent).toContain('cursor: grab');
      expect(cssContent).toContain('.loan-asset-thumb-box');
      expect(cssContent).toContain('.loan-asset-thumb-img');
    });
  });
});
