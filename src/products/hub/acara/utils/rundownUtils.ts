/**
 * PTV PRO — Modul Acara
 * Helper normalisasi dan pengurutan rundown timeline
 * Porting dari legacy page-dasbor.php L32770–L32920
 */

import { AcaraRundownItem } from '../types';

/**
 * Normalisasi format jam: mendukung '19.00', '19:00', '08.30', dsb.
 * Mengembalikan format terstandar 'HH:mm'
 */
export function normalizeJam(raw: string): string {
  if (!raw) return '08:00';
  let cleaned = raw.trim().replace('.', ':');
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    return `${hh}:${mm}`;
  }
  return cleaned;
}

/**
 * Format tampilan jam rundown ala legacy dasbor PTV: '19.00'
 */
export function formatRundownJam(raw: string): string {
  if (!raw) return '—';
  const norm = normalizeJam(raw);
  return norm.replace(':', '.');
}

/**
 * Kunci pengurutan alfabetik kronologis berbasis HH:mm
 */
export function parseRundownSortKey(item: Partial<AcaraRundownItem>): string {
  const jam = normalizeJam(item.jam_mulai || '');
  return jam;
}

/**
 * Urutkan item rundown strictly berdasarkan waktu/jam kronologis
 */
export function sortRundownList(list: AcaraRundownItem[]): AcaraRundownItem[] {
  return [...list].sort((a, b) => {
    const keyA = parseRundownSortKey(a);
    const keyB = parseRundownSortKey(b);
    return keyA.localeCompare(keyB);
  });
}
