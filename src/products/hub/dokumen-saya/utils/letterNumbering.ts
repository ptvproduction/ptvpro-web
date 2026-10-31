export interface CalculatedLetterNumber {
  nomor_surat: string;
  sequence: number;
  is_vacant: boolean;
  year: string;
  roman_month: string;
}

/**
 * Registry Nomor Terbit & Nomor Historis Wajib Terlindungi.
 * Angka yang terdaftar di sini tidak akan pernah dialokasikan untuk dokumen baru,
 * bahkan jika belum tersimpan secara fisik di database aplikasi.
 */
export const HISTORICAL_RESERVED_SEQUENCES: Record<string, Record<string, number[]>> = {
  '2026': {
    SI: [],
    ST: [],
    SBB: [],
  },
};

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Perhitungan nomor surat resmi dengan strategi Gap-Filling.
 * Nomor urut yang telah resmi dilepaskan (dihapus) diprioritaskan sebelum menghasilkan nomor baru.
 */
export function calculateNextLetterNumber(
  existingDocs: Array<{ no?: string }>,
  typeParam: 'SI' | 'ST' | 'SBB',
  dateParam?: string
): CalculatedLetterNumber {
  const effectiveDate = dateParam || new Date().toISOString().slice(0, 10);
  const tag = typeParam === 'ST' ? 'ST-PTV' : typeParam === 'SBB' ? 'SBB-PTV' : 'SI-PTV';
  const yearStr = effectiveDate.split('-')[0] || String(new Date().getFullYear());

  let m = 10;
  if (effectiveDate.includes('-')) {
    const parts = effectiveDate.split('-');
    if (parts.length >= 2) m = parseInt(parts[1], 10) || 10;
  }
  const roman = ROMAN_MONTHS[Math.max(0, Math.min(11, m - 1))];

  const usedSeqs = new Set<number>();

  // 1. Masukkan seluruh nomor yang dicadangkan/historis resmi
  const reservedForYear = HISTORICAL_RESERVED_SEQUENCES[yearStr]?.[typeParam] || [];
  for (const seq of reservedForYear) {
    usedSeqs.add(seq);
  }

  // 2. Kumpulkan semua nomor yang sudah pernah dipakai pada dokumen terdaftar
  const regex = new RegExp(`^(\\d{1,6})\\/${tag}\\/([A-Z]+)\\/${yearStr}$`, 'i');
  for (const d of existingDocs) {
    const num = (d.no || '').trim();
    const match = num.match(regex);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > 0) {
        usedSeqs.add(seq);
      }
    }
  }

  // 3. Gap-filling: Temukan urutan angka terkecil >= 1 yang belum terpakai (prioritaskan nomor kosong/dilepaskan)
  let candidate = 1;
  while (usedSeqs.has(candidate)) {
    candidate++;
  }
  if (candidate > 999999) throw new Error('Kapasitas nomor surat tahunan habis.');

  const maxUsed = usedSeqs.size > 0 ? Math.max(0, ...usedSeqs) : 0;
  const isVacant = candidate < maxUsed;

  const padded = String(candidate).padStart(3, '0');
  const nextNomor = `${padded}/${tag}/${roman}/${yearStr}`;

  return {
    nomor_surat: nextNomor,
    sequence: candidate,
    is_vacant: isVacant,
    year: yearStr,
    roman_month: roman,
  };
}

export function formatLetterNumber(
  seq: number,
  typeParam: 'SI' | 'ST' | 'SBB',
  romanMonth: string,
  year: number | string
): string {
  const tag = typeParam === 'ST' ? 'ST-PTV' : typeParam === 'SBB' ? 'SBB-PTV' : 'SI-PTV';
  return `${String(seq).padStart(3, '0')}/${tag}/${romanMonth}/${year}`;
}
