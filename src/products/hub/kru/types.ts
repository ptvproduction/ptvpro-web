import { OrganizationStatus, AccessProfile, AppCapability } from '@core/policy';

export type CrewRole = 'kru' | 'administrasi' | 'eksekutif';
export type CrewCategory = 'Kru' | 'Pengasuh' | 'Pengarah' | 'Pembina';
export type CrewMembershipStatus = 'Aktif' | 'Nonaktif' | 'Purna Kru';
export type CrewAccountStatus = 'Aktif' | 'Nonaktif' | 'Belum Ada Akun';

export const CANONICAL_OPERATIONAL_DIVISIONS = [
  'Editor',
  'Layouter',
  'Technical',
  'Engagement',
] as const;

export type CanonicalOperationalDivision = (typeof CANONICAL_OPERATIONAL_DIVISIONS)[number];

export const CANONICAL_ORGANIZATIONAL_POSITIONS = [
  'Ketua Umum',
  'Ketua',
  'Ketua Divisi',
  'Sekretaris & Bendahara',
  'Bendahara',
  'Sekretaris',
  'Koor Operasional',
  'Editor',
  'Layouter',
  'Technical',
  'Creative',
  'Engagement',
  'Kru Operasional',
  'Kru',
  'Pembina PTV',
  'Pembina',
  'Pengarah',
] as const;

export type CanonicalOrganizationalPosition = (typeof CANONICAL_ORGANIZATIONAL_POSITIONS)[number];


export interface CrewMember {
  version?: string;
  personnel_link_pending?: boolean;
  id: string;
  ptv_id: string;
  full_name: string;
  username: string;
  role: CrewRole;
  category: CrewCategory;
  division: string;
  position: string;
  angkatan: string | number;
  nim?: string;
  jurusan?: string;
  birth_date?: string;
  tanggal_lahir?: string;
  address?: string;
  alamat?: string;
  phone?: string;
  email?: string;
  join_date?: string;
  status_kru: CrewMembershipStatus;
  status_akun: CrewAccountStatus;
  foto_url?: string;
  oauth_email?: string;
  oauth_uid?: string;
  oauth_provider?: 'google';

  // Compatibility fields with legacy & existing policy
  status_organisasi?: OrganizationStatus;
  assigned_profiles?: readonly AccessProfile[];
  allowed_overrides?: readonly AppCapability[];
  denied_overrides?: readonly AppCapability[];
}

export interface CrewFilterParams {
  categoryTab?: 'Aktif' | 'Nonaktif' | 'Pengarah' | 'Pembina' | 'Semua';
  search?: string;
  division?: string;
}

export interface CrewAngkatanGroup {
  label: string;
  icon?: string;
  members: CrewMember[];
}

// Relational items for crew detail
export interface CrewActiveLoan {
  id: string;
  itemName: string;
  unitCode: string;
  unitDisplayName: string;
  outDate: string;
  dueDate: string;
  purpose: string;
  isReturned?: boolean;
}

export interface CrewEventHistory {
  id: string;
  name: string;
  date: string;
  location: string;
  status: 'Selesai' | 'Terjadwal' | 'Berjalan';
}

export interface CrewDocumentHistory {
  id: string;
  no: string;
  subject: string;
  type: string;
  date: string;
  owner: string;
}

export interface CrewStats {
  total: number;
  aktif: number;
  nonaktif: number;
  pengarah: number;
  pembina: number;
}

export interface LoginHistoryItem {
  id: number;
  user_id: string | null;
  ptv_id: string | null;
  username: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string | null;
  login_at: string;
}

/**
 * Predikat resmi kelayakan penugasan acara / liputan:
 * Hanya Personel dengan Kategori 'Kru' dan Status Organisasi 'Aktif'
 */
export function isOperationalCrew(crew: CrewMember): boolean {
  return crew.category === 'Kru' && crew.status_kru === 'Aktif';
}

/**
 * Filter utility untuk kandidat penugasan acara studio
 */
export function filterActiveOperationalCrew(members: CrewMember[]): CrewMember[] {
  return members.filter(isOperationalCrew);
}
