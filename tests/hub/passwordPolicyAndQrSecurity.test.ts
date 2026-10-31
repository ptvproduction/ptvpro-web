import { describe, it, expect } from 'vitest';

describe('PTVPRO HUB — Kebijakan Minimal 4 Karakter Password', () => {
  const isValidPassword = (p: string) => typeof p === 'string' && p.length >= 4 && Buffer.byteLength(p, 'utf8') <= 72;

  it('menolak password di bawah 4 karakter (0, 1, 2, 3 karakter)', () => {
    expect(isValidPassword('')).toBe(false);
    expect(isValidPassword('a')).toBe(false);
    expect(isValidPassword('ab')).toBe(false);
    expect(isValidPassword('abc')).toBe(false);
    expect(isValidPassword('123')).toBe(false);
  });

  it('menerima password 4 karakter atau lebih', () => {
    expect(isValidPassword('abcd')).toBe(true);
    expect(isValidPassword('1234')).toBe(true);
    expect(isValidPassword('ptv2026')).toBe(true);
    expect(isValidPassword('KruPilihan#1')).toBe(true);
  });
});

describe('PTVPRO HUB — Proteksi Keunikan Token/ID QR Dokumen', () => {
  it('menolak QR jika document ID tidak cocok meskipun nomor surat sama', () => {
    const activeDocInDb = {
      id: 'uuid-doc-001-baru',
      nomor_surat: '001/SI-PTV/X/2026',
      status: 'disetujui',
    };

    const qrScanParams = {
      nomor: '001/SI-PTV/X/2026',
      id: 'uuid-doc-001-lama-telah-dihapus', // QR fisik lama yang dicetak sebelum dihapus
    };

    // Evaluasi aturan
    const isMatched = activeDocInDb.nomor_surat === qrScanParams.nomor &&
      (!qrScanParams.id || activeDocInDb.id === qrScanParams.id);

    expect(isMatched).toBe(false);
  });

  it('menerima verifikasi jika nomor dan ID dokumen cocok', () => {
    const activeDocInDb = {
      id: 'uuid-doc-001-baru',
      nomor_surat: '001/SI-PTV/X/2026',
      status: 'disetujui',
    };

    const qrScanParams = {
      nomor: '001/SI-PTV/X/2026',
      id: 'uuid-doc-001-baru',
    };

    const isMatched = activeDocInDb.nomor_surat === qrScanParams.nomor &&
      (!qrScanParams.id || activeDocInDb.id === qrScanParams.id);

    expect(isMatched).toBe(true);
  });
});
