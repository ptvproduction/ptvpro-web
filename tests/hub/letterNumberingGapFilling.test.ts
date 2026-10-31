import { describe, it, expect } from 'vitest';
import { calculateNextLetterNumber } from '../../src/products/hub/dokumen-saya/utils/letterNumbering';

describe('PTVPRO HUB — Gap-Filling Letter Numbering & Validation', () => {
  it('mengisi celah nomor yang telah dilepaskan/dihapus (Gap-Filling)', () => {
    // Skenario: 001, 002, 003 pernah terbit. Lalu 001 dihapus.
    // Daftar tersisa di sistem operasional: 002 dan 003.
    const docs = [
      { no: '002/SI-PTV/X/2026' },
      { no: '003/SI-PTV/X/2026' },
    ];
    const next = calculateNextLetterNumber(docs, 'SI', '2026-10-31');
    expect(next.sequence).toBe(1);
    expect(next.nomor_surat).toBe('001/SI-PTV/X/2026');
    expect(next.is_vacant).toBe(true);
  });

  it('mengunci nomor yang diarsipkan (tetap terdaftar di existingDocs)', () => {
    // Skenario: 001 aktif, 002 diarsipkan (tetap ada di existingDocs), 003 aktif.
    // Nomor berikutnya harus 004, nomor 002 tidak boleh dipakai ulang.
    const docs = [
      { no: '001/SI-PTV/X/2026' },
      { no: '002/SI-PTV/X/2026' }, // Surat diarsipkan, nomor tetap terkunci
      { no: '003/SI-PTV/X/2026' },
    ];
    const next = calculateNextLetterNumber(docs, 'SI', '2026-10-31');
    expect(next.sequence).toBe(4);
    expect(next.nomor_surat).toBe('004/SI-PTV/X/2026');
    expect(next.is_vacant).toBe(false);
  });

  it('mengisi celah di tengah urutan jika nomor 002 dihapus', () => {
    // Skenario: 001 dan 003 ada, 002 dilepaskan (dihapus).
    const docs = [
      { no: '001/SI-PTV/X/2026' },
      { no: '003/SI-PTV/X/2026' },
    ];
    const next = calculateNextLetterNumber(docs, 'SI', '2026-10-31');
    expect(next.sequence).toBe(2);
    expect(next.nomor_surat).toBe('002/SI-PTV/X/2026');
    expect(next.is_vacant).toBe(true);
  });

  it('memisahkan nomor per jenis dokumen (SI, ST, SBB)', () => {
    const docs = [
      { no: '001/SI-PTV/X/2026' },
      { no: '002/SI-PTV/X/2026' },
    ];
    // Surat Tugas masih kosong, harus mulai dari 001
    const nextST = calculateNextLetterNumber(docs, 'ST', '2026-10-31');
    expect(nextST.sequence).toBe(1);
    expect(nextST.nomor_surat).toBe('001/ST-PTV/X/2026');

    // Surat Barang masih kosong, harus mulai dari 001
    const nextSBB = calculateNextLetterNumber(docs, 'SBB', '2026-10-31');
    expect(nextSBB.sequence).toBe(1);
    expect(nextSBB.nomor_surat).toBe('001/SBB-PTV/X/2026');
  });

  it('memisahkan nomor per tahun periode', () => {
    const docs = [
      { no: '001/SI-PTV/X/2026' },
      { no: '002/SI-PTV/X/2026' },
    ];
    // Masuk tahun 2027, urutan reset ke 001
    const next2027 = calculateNextLetterNumber(docs, 'SI', '2027-01-15');
    expect(next2027.sequence).toBe(1);
    expect(next2027.nomor_surat).toBe('001/SI-PTV/I/2027');
  });
});
