export type KondisiUnit = 'bagus' | 'rusak' | 'perlu_servis' | 'hilang';
export type StatusPeminjamanUnit = 'tersedia' | 'dipinjam' | 'maintenance';

export const INVENTORY_CATEGORIES = [
  'Kamera',
  'Lensa',
  'Tripod',
  'Baterai & Power',
  'Smartphone / Tablet',
  'Komputer / Laptop',
  'Audio',
  'Lighting',
  'Streaming / Live Production',
  'Kabel & Adapter',
  'Dry Cabinet',
  'TV / Smart TV',
  'Storage',
  'Peralatan & Perkakas',
  'ATK',
  'Pengaturan Jaringan',
  'Lainnya',
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export interface InventarisUnit {
  id: string;
  inventaris_id: string;
  kode_unit: string;
  nama_unit?: string;
  nomor_seri?: string;
  kondisi: KondisiUnit;
  status_peminjaman: StatusPeminjamanUnit;
  lokasi_penyimpanan?: string;
  created_at: string;
  updated_at: string;
}

export interface NilaiInventarisRecord {
  id: string;
  inventaris_id: string;
  nilai_perolehan: number;
  nilai_residu?: number;
  nilai_tercatat?: number;
  tanggal_perolehan: string;
  sumber_perolehan: string;
  vendor?: string;
  nomor_invoice?: string;
  status: 'Aktif' | 'Belum Dicatat' | 'Dihapuskan';
  catatan?: string;
  dokumen_url?: string;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ItemInventaris {
  id: string;
  kode: string;
  nama_alat: string;
  kategori: string;
  brand?: string;
  model?: string;
  spesifikasi?: string;
  foto_url?: string;
  harga_beli?: number;
  sumber_perolehan?: string;
  lokasi_penyimpanan?: string;
  satuan?: string;
  status_operasional?: string;
  created_at: string;
  updated_at: string;
  units: InventarisUnit[];
  total_unit: number;
  unit_tersedia: number;
  nilai_inventaris?: NilaiInventarisRecord;
}

export interface InventarisFilterParams {
  search?: string;
  kategori?: string;
  status?: 'all' | 'tersedia' | 'habis';
}

export interface CreateUnitDTO {
  nomor_unit?: number;
  nama_unit?: string;
  kondisi?: KondisiUnit;
  nomor_seri?: string;
  lokasi_penyimpanan?: string;
}

export interface CreateInventarisDTO {
  kode: string;
  nama_alat: string;
  kategori: string;
  brand?: string;
  model?: string;
  spesifikasi?: string;
  lokasi_penyimpanan?: string;
  sumber_perolehan?: string;
  foto_url?: string;
  harga_beli?: number;
  satuan?: string;
  status_operasional?: string;
  jumlah_unit: number;
  unit_items?: CreateUnitDTO[];
  idempotency_key?: string;
  request_id?: string;
}

export interface UpdateUnitDTO {
  id: string;
  kode_unit: string;
  nama_unit?: string;
  nomor_seri?: string | null;
  kondisi: KondisiUnit;
  lokasi_penyimpanan?: string;
}

export interface UpdateInventarisDTO {
  id: string;
  kode?: string;
  nama_alat: string;
  kategori: string;
  brand?: string;
  model?: string;
  spesifikasi?: string;
  sumber_perolehan?: string;
  lokasi_penyimpanan?: string;
  foto_url?: string | null;
  satuan?: string;
  units: UpdateUnitDTO[];
  expected_updated_at?: string;
}
