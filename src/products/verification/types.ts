export type DocumentVerificationStatus =
  | 'valid'
  | 'revisi'
  | 'ditolak'
  | 'menunggu'
  | 'tidak_ditemukan';

export interface PublicDocumentVerificationResult {
  nomor_surat: string;
  jenis_surat: string;
  perihal: string;
  tanggal_terbit: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  penanggung_jawab: string;
  penerbit: string;
  pemohon: string;
  recipients: string[];
  items: string[];
  status: DocumentVerificationStatus;
  status_title: string;
  status_label: string;
  status_desc: string;
  is_valid: boolean;
  is_simulated: boolean;
  raw_id?: string;
  created_at?: string;
}

export interface PublicActiveAssignment {
  nomor_surat: string;
  perihal: string;
  jenis_surat: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  penanggung_jawab: string;
  is_today_active: boolean;
  verification_url: string;
}

export interface PublicCrewVerificationResult {
  crew_id: string;
  full_name: string;
  position: string;
  division: string;
  angkatan: string | number;
  status_kru: 'Aktif' | 'Nonaktif' | 'Purna Kru';
  foto_url?: string;
  is_found: boolean;
  is_simulated: boolean;
  active_assignment: PublicActiveAssignment | null;
}
