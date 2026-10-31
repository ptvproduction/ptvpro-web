/**
 * PTV PRO — Modul Acara
 * Tipe data resmi dan kontrak data Acara Liputan & Produksi Studio
 * Porting 1:1 dari arsitektur PHP Legacy (page-dasbor.php L15300+ & L31489+)
 */

export type AcaraStatus = 'Mendatang' | 'Berlangsung' | 'Selesai' | 'Dibatalkan' | 'Batal' | 'Terjadwal';

export type AcaraFilter = 'semua' | 'mendatang' | 'saya' | 'selesai';

export interface AcaraCrewMember {
  id: string;
  ptv_id?: string;
  name: string;
  photo?: string;
  division?: string;
  role?: string;
  job: string;
  tugas?: string;
}

export interface AcaraGearUnit {
  unit: number;
  code?: string;
  barcode?: string;
}

export interface AcaraGearAllocation {
  id: string;
  item_id?: string;
  name: string;
  code: string;
  photo?: string;
  cat: string;
  qty: number;
  units: AcaraGearUnit[];
}

export interface AcaraRundownItem {
  id: string;
  acara_id?: string;
  jam_mulai: string;
  kegiatan: string;
  sort_key?: string;
}

export interface AcaraNotulensiRef {
  id: string;
  judul: string;
  isi?: string;
  date?: string;
  time?: string;
  loc?: string;
  att?: string;
  created_by_name?: string;
  tags?: string[];
}

export type AcaraSessionLabel = 'Pagi' | 'Siang' | 'Sore' | 'Malam' | 'Lainnya';

export interface AcaraSession {
  id: string;
  label: AcaraSessionLabel;
  custom_label?: string; // Digunakan jika label === 'Lainnya'
  start_time: string; // Format 'HH:mm' misal '08:00'
  has_end_time: boolean;
  end_time?: string; // Format 'HH:mm' misal '11:30'
}

export interface AcaraItem {
  display_color?: import('./utils/acaraColors').AcaraColor;
  id: string;
  name: string;
  date: string; // ISO Format 'YYYY-MM-DD'
  time: string; // Misal '08:00 – Selesai' atau '19.00 – 22.00'
  loc: string; // Misal 'Studio PTV' atau 'Lapangan Utama'
  status: AcaraStatus;
  notes: string; // Instruksi teknis peliputan
  crew: AcaraCrewMember[];
  gear: AcaraGearAllocation[];
  rundown: AcaraRundownItem[];
  sessions?: AcaraSession[];
  notulensi_ids?: string[];
  doc?: string; // Lampiran dokumen/poster
  type?: string; // 'internal' | 'eksternal' | 'liputan'
  dresscode?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAcaraDTO {
  display_color?: import('./utils/acaraColors').AcaraColor;
  name: string;
  loc?: string;
  date: string;
  time?: string;
  notes?: string;
  status?: AcaraStatus;
  type?: string;
  dresscode?: string;
  crew?: AcaraCrewMember[];
  gear?: AcaraGearAllocation[];
  rundown?: AcaraRundownItem[];
  sessions?: AcaraSession[];
  notulensi_ids?: string[];
}

export interface UpdateAcaraDTO {
  display_color?: import('./utils/acaraColors').AcaraColor;
  name?: string;
  loc?: string;
  date?: string;
  time?: string;
  notes?: string;
  status?: AcaraStatus;
  type?: string;
  dresscode?: string;
  crew?: AcaraCrewMember[];
  gear?: AcaraGearAllocation[];
  rundown?: AcaraRundownItem[];
  sessions?: AcaraSession[];
  notulensi_ids?: string[];
}

export interface UpdateAcaraPayloadDTO {
  display_color?: import('./utils/acaraColors').AcaraColor;
  id: string;
  expected_updated_at?: string;
  name?: string;
  loc?: string;
  date?: string;
  time?: string;
  notes?: string;
  status?: AcaraStatus;
  type?: string;
  dresscode?: string;
  crew?: AcaraCrewMember[];
  gear?: AcaraGearAllocation[];
  rundown?: AcaraRundownItem[];
  sessions?: AcaraSession[];
  notulensi_ids?: string[];
}

export const LEGACY_CREW_JOB_PRESETS = [
  'Dokumentasi Foto',
  'Editor Video',
  'Dokumentasi Lapangan',
  'Operator Streaming',
  'Camera Person',
  'Audio Engineer',
  'Lighting',
  'Switcherman',
  'Floor Director',
  'Host'
] as const;

export type LegacyCrewJobPreset = (typeof LEGACY_CREW_JOB_PRESETS)[number];
