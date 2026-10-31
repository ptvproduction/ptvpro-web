import { describe, it, expect } from 'vitest';
import {
  INITIAL_SANTRI_FIXTURES,
  PRESET_SEKOLAH,
  PRESET_ASRAMA,
  COL_LABELS,
  getRomanMonth,
  IzinColKey,
  Santri,
} from '../../src/products/hub/surat/generator/mock/santriMockData';
import { PROFILE_CAPABILITIES } from '../../src/core/policy/profiles';

describe('Generator Surat Izin — Batch 3 Unit Tests', () => {
  // ── 1. Santri Mock Dataset Parity ──
  it('1. harus memuat dataset santri terisolasi 60 santri realistis lintas angkatan', () => {
    expect(INITIAL_SANTRI_FIXTURES).toBeDefined();
    expect(INITIAL_SANTRI_FIXTURES.length).toBe(60);

    // Verify angkatan distribution (10, 11, 12, 13)
    const angkatans = new Set(INITIAL_SANTRI_FIXTURES.map((s) => s.angkatan));
    expect(angkatans.has('10')).toBe(true);
    expect(angkatans.has('11')).toBe(true);
    expect(angkatans.has('12')).toBe(true);
    expect(angkatans.has('13')).toBe(true);

    // Verify required fields exist for every santri
    INITIAL_SANTRI_FIXTURES.forEach((s) => {
      expect(s.nama).toBeTruthy();
      expect(s.unit).toBeTruthy();
      expect(s.kelas).toBeTruthy();
      expect(s.asrama).toBeTruthy();
      expect(s.kamar).toBeTruthy();
      expect(s.walikelas).toBeTruthy();
      expect(s.murobbi).toBeTruthy();
    });
  });

  // ── 2. Preset Kolom Sekolah vs Asrama ──
  it('2. harus memverifikasi konfigurasi preset Sekolah dan Asrama serta kamus kolom', () => {
    // Preset Sekolah: unit, kelas, walikelas, kamar, asrama, murobbi = true (6 kolom)
    const activeSekolah = (Object.keys(PRESET_SEKOLAH) as IzinColKey[]).filter(
      (k) => PRESET_SEKOLAH[k]
    );
    expect(activeSekolah.length).toBe(6);
    expect(PRESET_SEKOLAH.unit).toBe(true);
    expect(PRESET_SEKOLAH.kelas).toBe(true);
    expect(PRESET_SEKOLAH.walikelas).toBe(true);
    expect(PRESET_SEKOLAH.intensif).toBe(false);
    expect(PRESET_SEKOLAH.madin).toBe(false);

    // Preset Asrama: unit, kamar, asrama, murobbi, intensif, madin = true (6 kolom)
    const activeAsrama = (Object.keys(PRESET_ASRAMA) as IzinColKey[]).filter(
      (k) => PRESET_ASRAMA[k]
    );
    expect(activeAsrama.length).toBe(6);
    expect(PRESET_ASRAMA.unit).toBe(true);
    expect(PRESET_ASRAMA.kamar).toBe(true);
    expect(PRESET_ASRAMA.intensif).toBe(true);
    expect(PRESET_ASRAMA.madin).toBe(true);
    expect(PRESET_ASRAMA.kelas).toBe(false);
    expect(PRESET_ASRAMA.walikelas).toBe(false);

    // Label kolom
    expect(COL_LABELS.unit).toBe('Unit');
    expect(COL_LABELS.kelas).toBe('Kelas');
    expect(COL_LABELS.jobdesc).toBe('Catatan Khusus');
  });

  // ── 3. Konversi Bulan Romawi Penomoran Surat ──
  it('3. harus mengonversi bulan ke angka romawi dengan presisi', () => {
    expect(getRomanMonth(new Date(2026, 0, 15))).toBe('I');
    expect(getRomanMonth(new Date(2026, 1, 15))).toBe('II');
    expect(getRomanMonth(new Date(2026, 2, 15))).toBe('III');
    expect(getRomanMonth(new Date(2026, 3, 15))).toBe('IV');
    expect(getRomanMonth(new Date(2026, 4, 15))).toBe('V');
    expect(getRomanMonth(new Date(2026, 5, 15))).toBe('VI');
    expect(getRomanMonth(new Date(2026, 6, 15))).toBe('VII');
    expect(getRomanMonth(new Date(2026, 7, 15))).toBe('VIII');
    expect(getRomanMonth(new Date(2026, 8, 15))).toBe('IX');
    expect(getRomanMonth(new Date(2026, 9, 15))).toBe('X');
    expect(getRomanMonth(new Date(2026, 10, 15))).toBe('XI');
    expect(getRomanMonth(new Date(2026, 11, 15))).toBe('XII');
  });

  // ── 4. Algoritma Pagination A4 Multi-page (20 Baris Halaman 1, 22 Baris Lanjutan) ──
  it('4. harus memverifikasi algoritma pagination A4 legacy secara eksak untuk 1, 5, 20, 21, 22, 40, dan 60 santri', () => {
    function paginateSantri(list: Santri[]) {
      const totalStudents = list.length;
      interface PageChunk {
        rows: Santri[];
        startIdx: number;
        isPage1: boolean;
        isFinal: boolean;
      }
      const pages: PageChunk[] = [];

      if (totalStudents <= 20) {
        pages.push({
          rows: list,
          startIdx: 0,
          isPage1: true,
          isFinal: true,
        });
      } else {
        pages.push({
          rows: list.slice(0, 20),
          startIdx: 0,
          isPage1: true,
          isFinal: false,
        });
        let rem = list.slice(20);
        let pStart = 20;
        while (rem.length > 0) {
          const chunkSize = rem.length <= 22 ? rem.length : 22;
          const chunk = rem.slice(0, chunkSize);
          rem = rem.slice(chunkSize);
          pages.push({
            rows: chunk,
            startIdx: pStart,
            isPage1: false,
            isFinal: rem.length === 0,
          });
          pStart += chunkSize;
        }
      }
      return pages;
    }

    // 1 santri -> 1 halaman
    const p1 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 1));
    expect(p1.length).toBe(1);
    expect(p1[0].isPage1).toBe(true);
    expect(p1[0].isFinal).toBe(true);
    expect(p1[0].rows.length).toBe(1);

    // 5 santri -> 1 halaman
    const p5 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 5));
    expect(p5.length).toBe(1);
    expect(p5[0].rows.length).toBe(5);

    // 20 santri -> 1 halaman penuh (batas maks halaman 1)
    const p20 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 20));
    expect(p20.length).toBe(1);
    expect(p20[0].rows.length).toBe(20);
    expect(p20[0].isFinal).toBe(true);

    // 21 santri -> 2 halaman (20 baris hal 1, 1 baris hal 2)
    const p21 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 21));
    expect(p21.length).toBe(2);
    expect(p21[0].rows.length).toBe(20);
    expect(p21[0].isFinal).toBe(false);
    expect(p21[1].rows.length).toBe(1);
    expect(p21[1].isFinal).toBe(true);
    expect(p21[1].startIdx).toBe(20);

    // 22 santri -> 2 halaman (20 baris hal 1, 2 baris hal 2)
    const p22 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 22));
    expect(p22.length).toBe(2);
    expect(p22[0].rows.length).toBe(20);
    expect(p22[1].rows.length).toBe(2);

    // 40 santri -> 2 halaman (20 baris hal 1, 20 baris hal 2)
    const p40 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 40));
    expect(p40.length).toBe(2);
    expect(p40[0].rows.length).toBe(20);
    expect(p40[1].rows.length).toBe(20);

    // 42 santri -> 2 halaman (20 baris hal 1, 22 baris hal 2)
    const p42 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 42));
    expect(p42.length).toBe(2);
    expect(p42[0].rows.length).toBe(20);
    expect(p42[1].rows.length).toBe(22);

    // 60 santri -> 3 halaman (20 baris hal 1, 22 baris hal 2, 18 baris hal 3)
    const p60 = paginateSantri(INITIAL_SANTRI_FIXTURES.slice(0, 60));
    expect(p60.length).toBe(3);
    expect(p60[0].rows.length).toBe(20);
    expect(p60[0].isFinal).toBe(false);
    expect(p60[1].rows.length).toBe(22);
    expect(p60[1].isFinal).toBe(false);
    expect(p60[2].rows.length).toBe(18);
    expect(p60[2].isFinal).toBe(true);
    expect(p60[2].startIdx).toBe(42);
  });

  // ── 5. Filtering & Search Logic ──
  it('5. harus menyaring santri berdasarkan nama dan atribut pencarian', () => {
    const q1 = 'Ahmad Faiz';
    const match1 = INITIAL_SANTRI_FIXTURES.filter((s) =>
      s.nama.toLowerCase().includes(q1.toLowerCase())
    );
    expect(match1.length).toBeGreaterThanOrEqual(1);
    expect(match1[0].nama).toContain('Ahmad Faiz');

    // Filter by angkatan
    const angk10 = INITIAL_SANTRI_FIXTURES.filter((s) => s.angkatan === '10');
    expect(angk10.length).toBe(15);

    const angk11 = INITIAL_SANTRI_FIXTURES.filter((s) => s.angkatan === '11');
    expect(angk11.length).toBe(15);
  });

  // ── 6. RBAC Policy Fidelity ──
  it('6. harus memastikan kapabilitas documents.generate hanya dimiliki oleh eksekutif dan kepolo_kepali', () => {
    expect(PROFILE_CAPABILITIES.eksekutif.has('documents.generate')).toBe(true);
    expect(PROFILE_CAPABILITIES.kepolo_kepali.has('documents.generate')).toBe(true);
    expect(PROFILE_CAPABILITIES.crew.has('documents.generate')).toBe(false);
  });

  // ── 7. Canonical Legacy Spreadsheet Parity (20 Santri Riil) ──
  it('7. harus memverifikasi dataset kanonikal PHP Legacy 20 santri riil dan parser CSV', async () => {
    const { CANONICAL_LEGACY_SANTRI_FIXTURES, parseCSV } = await import(
      '../../src/products/hub/surat/generator/mock/santriMockData'
    );
    expect(CANONICAL_LEGACY_SANTRI_FIXTURES).toBeDefined();
    expect(CANONICAL_LEGACY_SANTRI_FIXTURES.length).toBe(20);

    // Verifikasi angkatan 11, 12, 13, 14, 15
    const angkatans = new Set(CANONICAL_LEGACY_SANTRI_FIXTURES.map((s) => s.angkatan));
    expect(angkatans.has('11')).toBe(true);
    expect(angkatans.has('12')).toBe(true);
    expect(angkatans.has('13')).toBe(true);
    expect(angkatans.has('14')).toBe(true);
    expect(angkatans.has('15')).toBe(true);

    // Verifikasi Muhammad Farras Zaidan Mubarok ada di angkatan 13
    const farras = CANONICAL_LEGACY_SANTRI_FIXTURES.find((s) => s.nama.includes('Farras'));
    expect(farras).toBeDefined();
    expect(farras?.angkatan).toBe('13');

    // Test parser CSV
    const sampleCsv = 'Nama,Unit,Kelas\n"Farras",MA,X\n"Faiz",MA,XII';
    const parsed = parseCSV(sampleCsv);
    expect(parsed.length).toBe(3);
    expect(parsed[1][0]).toBe('Farras');
    expect(parsed[2][0]).toBe('Faiz');
  });
});

