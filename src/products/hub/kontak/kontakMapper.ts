import { InternalContact } from './types';

export interface RawKontakEksternalDbRow {
  id: string;
  nama_kontak: string;
  instansi: string;
  telepon: string | null;
  email: string | null;
  peran: string | null;
  catatan: string | null;
  created_at: string;
}

export interface EnrichedExternalContact {
  id: string;
  nama: string;
  kategori: string;
  jabatan: string;
  organisasi: string;
  lembaga: 'Pondok' | 'Sekolah' | 'Yayasan' | 'Mitra';
  nomor_telepon?: string;
  whatsapp?: string;
  email?: string;
  alamat?: string;
  catatan?: string;
  foto_url?: string;
  status: 'Aktif' | 'Tidak Aktif';
}

export type EnrichedInternalContact = InternalContact;



/**
 * Photo URLs that return 404 on legacy domain, to be safely omitted so avatar renders initials fallback.
 */
export const KNOWN_BROKEN_PHOTO_PTV_IDS = new Set(['PTV-025', 'PTV-046', 'PTV-070', 'PTV-062']);


/**
 * Legacy classification algorithm from legacy/page-dasbor.php L23080-L23130
 */
export function categorizeExternalContact(row: RawKontakEksternalDbRow): {
  lembaga: 'Pondok' | 'Sekolah' | 'Yayasan' | 'Mitra';
  peran: string;
} {
  const orgLow = String(row.instansi || '').trim().toLowerCase();
  const rawJab = String(row.peran || '').trim();
  const rawName = String(row.nama_kontak || '').trim();
  const combined = `${orgLow} ${rawJab} ${rawName}`.toLowerCase();

  // 1. Lembaga Detection
  let lembaga: 'Pondok' | 'Sekolah' | 'Yayasan' | 'Mitra' = 'Pondok';
  if (orgLow === 'pondok' || orgLow.includes('pesantren') || orgLow.includes('asrama') || orgLow.includes('santri')) {
    lembaga = 'Pondok';
  } else if (orgLow === 'sekolah' || orgLow.includes('smp') || orgLow.includes('sma') || orgLow.includes('sd')) {
    lembaga = 'Sekolah';
  } else if (orgLow === 'yayasan' || orgLow.includes('bumi shalawat') || orgLow.includes('spi')) {
    lembaga = 'Yayasan';
  } else if (['mitra', 'vendor', 'partner', 'supplier', 'rental'].some((w) => orgLow.includes(w) || combined.includes(w))) {
    lembaga = 'Mitra';
  } else if (/asrama|madin|pengasuhan|keasramaan|tahfidz|diniyah/.test(combined)) {
    lembaga = 'Pondok';
  } else if (/smp|sma|sd|kesiswaan|sarpras sm|kurikulum|guru|tu sm/.test(combined)) {
    lembaga = 'Sekolah';
  } else if (/yayasan|spi|direksi|pengurus yayasan/.test(combined)) {
    lembaga = 'Yayasan';
  }

  // 2. Peran / Sapaan Detection
  let peran = 'Ustadz';
  if (combined.includes('ustadzah') || combined.includes('ustzah') || combined.includes('isma') || combined.includes('bu ')) {
    peran = 'Ustadzah';
  } else if (combined.includes('vendor') || combined.includes('supplier')) {
    peran = 'Vendor';
  } else if (combined.includes('mitra') || combined.includes('partner')) {
    peran = 'Partner';
  } else if (combined.includes('pembina')) {
    peran = 'Pembina';
  } else if (combined.includes('narasumber')) {
    peran = 'Narasumber';
  } else {
    peran = 'Ustadz';
  }

  return { lembaga, peran };
}

/**
 * ============================================================================
 * CANONICAL LEGACY CLASSIFICATION RULES FOR KONTAK INTERNAL
 * Source: legacy/page-dasbor.php L22970-L22979 & L23030-L23063
 * ============================================================================
 */

export interface LegacyCrewLike {
  div?: string | null;
  divisi?: string | null;
  pos?: string | null;
  jabatan?: string | null;
  status?: string | null;
  role?: string | null;
  name?: string | null;
  nama?: string | null;
  ptvId?: string | null;
  ptv_id?: string | null;
  crew_id?: string | null;
}

export function isLegacyPembina(c: LegacyCrewLike | null | undefined): boolean {
  if (!c) return false;
  const div = c.div || c.divisi || '';
  const pos = c.pos || c.jabatan || '';
  return div === 'Pembina' || /pembina/i.test(div) || /pembina/i.test(pos);
}

export function isLegacyPengarah(c: LegacyCrewLike | null | undefined): boolean {
  if (!c) return false;
  if (isLegacyPembina(c)) return false;
  const div = c.div || c.divisi || '';
  const pos = c.pos || c.jabatan || '';
  return (
    div === 'Pengarah' ||
    /pengarah/i.test(div) ||
    /pengarah/i.test(pos) ||
    /presdir|wadir|pendiri|pengasuh|direktur|penasihat/i.test(pos)
  );
}

export function isLegacyPengurus(c: LegacyCrewLike | null | undefined): boolean {
  if (!c) return false;
  if (isLegacyPembina(c) || isLegacyPengarah(c)) return false;
  const pos = c.pos || c.jabatan || '';
  return /ketua|wakil|sekretaris|bendahara|koordinator|admin|pimpinan|pengurus/i.test(pos);
}

export function isLegacyKru(c: LegacyCrewLike | null | undefined): boolean {
  if (!c) return false;
  if (isLegacyPembina(c) || isLegacyPengarah(c) || isLegacyPengurus(c)) return false;
  const pos = c.pos || c.jabatan || '';
  const rawStatus = (c.status || '').toLowerCase().trim();
  const isAktif = rawStatus === 'aktif' || (!['nonaktif', 'non-aktif', 'non aktif', 'pasif', 'alumni', 'inactive'].includes(rawStatus) && rawStatus !== '');
  return isAktif || /kru/i.test(pos);
}

export function classifyInternalContact(c: LegacyCrewLike | null | undefined): 'Pembina' | 'Pengarah' | 'Pengurus' | 'Kru' | null {
  if (isLegacyPembina(c)) return 'Pembina';
  if (isLegacyPengarah(c)) return 'Pengarah';
  if (isLegacyPengurus(c)) return 'Pengurus';
  if (isLegacyKru(c)) return 'Kru';
  return null;
}

export function formatAngkatanDisplay(ang?: string | null, c?: { name?: string | null; ptvId?: string | null }): string {
  const cName = ((c && c.name) || '').toLowerCase();
  const cPid = ((c && c.ptvId) || '').toUpperCase();
  const raw = (ang || '').trim();
  if (
    raw.toLowerCase() === 'additional' ||
    cPid === 'PTV-017' ||
    cPid === 'PTV-018' ||
    cName.includes('kru testing') ||
    cName.includes('niki santri')
  ) {
    return 'Additional';
  }
  if (!raw) return 'Angkatan belum ditentukan';
  const lower = raw.toLowerCase();
  if (lower === 'internship') return 'Internship';
  if (lower === 'pembina') return 'Pembina';
  if (lower === 'pengarah') return 'Pengarah';
  if (lower.startsWith('angkatan')) return raw;
  return 'Angkatan ' + raw;
}

export interface AngkatanGroup<T> {
  label: string;
  icon: string;
  isAdditional: boolean;
  rows: T[];
}

export function groupCrewByAngkatan<T extends { angkatan?: string | null; full_name?: string | null; ptv_id?: string | null }>(
  crewList: T[]
): AngkatanGroup<T>[] {
  const groups: Record<string, T[]> = {};

  (crewList || []).forEach((c) => {
    if (!c) return;
    const label = formatAngkatanDisplay(c.angkatan, { name: c.full_name, ptvId: c.ptv_id });
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });

  const sortedLabels = Object.keys(groups).sort((a, b) => {
    if (a === 'Angkatan belum ditentukan') return 1;
    if (b === 'Angkatan belum ditentukan') return -1;
    if (a === 'Additional') return 1;
    if (b === 'Additional') return -1;
    if (a === 'Internship') return 1;
    if (b === 'Internship') return -1;
    const numA = parseInt(a.replace(/[^\d]/g, ''), 10);
    const numB = parseInt(b.replace(/[^\d]/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
    return a.localeCompare(b, 'id');
  });

  return sortedLabels.map((label) => {
    let icon = 'fa-solid fa-graduation-cap';
    if (label === 'Additional') {
      icon = 'fa-solid fa-user-plus';
    } else if (label === 'Internship') {
      icon = 'fa-solid fa-user-clock';
    } else if (label === 'Pembina' || label === 'Pengarah') {
      icon = 'fa-solid fa-user-tie';
    } else if (label === 'Angkatan belum ditentukan') {
      icon = 'fa-solid fa-circle-question';
    }

    return {
      label,
      icon,
      isAdditional: label === 'Additional',
      rows: groups[label],
    };
  });
}

/**
 * DEPRECATED: Do not use synthetic institutional leadership objects.
 * Authentic Pembina and Pengarah are directly sourced from the database.
 */
export const INSTITUTIONAL_LEADERSHIP: EnrichedInternalContact[] = [];
