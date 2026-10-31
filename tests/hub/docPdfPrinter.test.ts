import { describe, it, expect } from 'vitest';
import { buildOfficialDocPdf14 } from '../../src/products/hub/dokumen-saya/utils/docPdfPrinter';
import { INITIAL_DOCS_FIXTURES } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

describe('PTVPRO — Paritas PDF Resmi dengan Generator Surat Izin (docPdfPrinter)', () => {
  it('harus menghasilkan binary PDF 1.4 resmi dengan identitas brand hijau #0e4f40 dan kop Sidoarjo', () => {
    const doc = INITIAL_DOCS_FIXTURES.find((d) => d.no === '042/ST-PTV/X/2026')!;
    expect(doc).toBeDefined();

    const pdfString = buildOfficialDocPdf14(doc);

    // 1. PDF 1.4 Binary Structure
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfString.includes('%%EOF')).toBe(true);
    expect(pdfString.includes('xref')).toBe(true);

    // 2. Paritas Identitas Lembaga & Kop Surat
    expect(pdfString).toContain('PROGRESIF TV');
    expect(pdfString).toContain('OFFICIAL MEDIA BROADCASTER');
    expect(pdfString).toContain('Sidoarjo, Jawa Timur 61223');
    expect(pdfString).toContain('0.055 0.310 0.251 rg'); // Brand green #0e4f40

    // 2b. Paritas Logo Resmi (BS x PTV) Tertanam Nyata di Binary PDF
    expect(pdfString).toContain('/XObject << /ImLogo 7 0 R >>');
    expect(pdfString).toContain('/ImLogo Do');
    expect(pdfString).toContain('84.26 0 0 48 50 752 cm'); // 48pt height, 84.26pt width, left margin 50, bottom 752
    expect(pdfString).toContain('/Width 323 /Height 184 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode');

    // 3. Metadata Surat
    expect(pdfString).toContain('042/ST-PTV/X/2026');
    expect(pdfString).toContain('SURAT TUGAS PROGRESIF TV');

    // 4. Tabel Personil / Kru Terlibat
    expect(pdfString).toContain('NAMA LENGKAP KRU / SANTRI');
    expect(pdfString).toContain('Muhammad Zidnal Falah');
    expect(pdfString).toContain('Rizky Alamsyah');

    // 5. Keabsahan & QR Code Verifikasi
    expect(pdfString).toContain('DOKUMEN RESMI PROGRESIF TV');
    expect(pdfString).toContain('Dokumen ini diterbitkan secara sah melalui Sistem Digital');
    expect(pdfString).toContain('Progresif TV dan berlaku resmi tanpa tanda tangan basah.');
    expect(pdfString).toContain('Sidoarjo,');
    expect(pdfString).toContain('Dr. H. Ahmad Musthofa,');
    expect(pdfString).toContain('M.Pd.');
  });
});

