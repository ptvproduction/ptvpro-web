export type KondisiUnit = 'bagus' | 'rusak' | 'perlu_servis';
export type StatusPeminjamanUnit = 'tersedia' | 'dipinjam' | 'maintenance';

export interface InventarisUnit {
  id: string;
  inventaris_id: string;
  kode_unit: string;
  nomor_seri?: string;
  kondisi: KondisiUnit;
  status_peminjaman: StatusPeminjamanUnit;
  lokasi_penyimpanan?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemInventaris {
  id: string;
  kode: string;
  nama_alat: string;
  kategori: string;
  spesifikasi?: string;
  foto_url?: string;
  harga_beli?: number;
  sumber_perolehan?: string;
  created_at: string;
  updated_at: string;
  units: InventarisUnit[];
  total_unit: number;
  unit_tersedia: number;
}

export interface InventarisFilterParams {
  search?: string;
  kategori?: string;
  status?: 'all' | 'tersedia' | 'habis';
}

export interface CreateInventarisDTO {
  kode: string;
  nama_alat: string;
  kategori: string;
  spesifikasi?: string;
  lokasi_penyimpanan?: string;
  jumlah_unit: number;
}
