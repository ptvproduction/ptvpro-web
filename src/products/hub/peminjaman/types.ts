export type StatusPeminjaman = 'dipinjam' | 'dikembalikan' | 'terlambat';
export type KondisiKembali = 'bagus' | 'rusak' | 'perlu_servis';

export interface PeminjamanRecord {
  id: string;
  transaction_id: string;
  unit_id: string;
  kode_unit: string;
  nama_alat: string;
  kategori: string;
  peminjam_nama: string;
  keperluan: string;
  tanggal_pinjam: string;
  tenggat_kembali: string;
  tanggal_kembali?: string;
  status: StatusPeminjaman;
  kondisi_kembali?: KondisiKembali;
  catatan?: string;
  actor_id?: string;
  actor_nama?: string;
  created_at: string;
}

export interface PeminjamanFilterParams {
  search?: string;
  status?: 'all' | 'dipinjam' | 'dikembalikan' | 'terlambat';
}

export interface CheckoutLoanDTO {
  borrower_name: string;
  purpose: string;
  due_date: string;
  event_name?: string;
  unit_ids: string[];
}

export interface ReturnLoanDTO {
  transaction_id: string;
  condition_status: KondisiKembali;
  notes?: string;
}
