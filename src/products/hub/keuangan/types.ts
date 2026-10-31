export type PeriodeStatus = 'aktif' | 'nonaktif';

export interface PeriodeKas {
  periode_bulan: string; // 'YYYY-MM'
  nominal: number;
  keterangan: string;
  status: PeriodeStatus;
  is_active?: boolean;
}

export type KasKruStatus = 'Lunas' | 'Belum Lunas';
export type PaymentMethod = 'Tunai' | 'Transfer QRIS' | 'Transfer Bank' | 'Transfer' | 'Lainnya';

export interface KasKruRecord {
  id: string;
  kru_id: string; // e.g. ID di kruStore
  kru_ptv_id: string; // e.g. 'PTV-025'
  kru_nama: string;
  periode_bulan: string; // 'YYYY-MM'
  nominal: number;
  dibayar: number;
  sisa: number;
  status: KasKruStatus;
  tanggal_bayar?: string; // 'YYYY-MM-DD'
  dicatat_oleh_id?: string;
  dicatat_oleh_nama?: string;
  metode_bayar?: PaymentMethod;
}

export type PemasukanKategori = 'Iuran Kas' | 'Jasa Liputan' | 'Sponsor' | 'Donasi' | 'Penjualan Merchandise' | 'Lainnya';
export type PengeluaranKategori = 'Operasional' | 'Peralatan' | 'Konsumsi' | 'Transportasi' | 'Lainnya';
export type TransactionStatus = 'posted' | 'void';

export interface PemasukanRecord {
  id: string;
  tanggal: string; // 'YYYY-MM-DD'
  sumber: string;
  kategori: PemasukanKategori;
  nominal: number;
  keterangan: string;
  bukti_url?: string;
  dicatat_oleh_nama: string;
  status: TransactionStatus;
  kru_id?: string;
  kru_nama?: string;
  kas_kru_id?: string;
}

export interface PengeluaranRecord {
  id: string;
  tanggal: string; // 'YYYY-MM-DD'
  keperluan: string;
  kategori: PengeluaranKategori;
  nominal: number;
  keterangan: string;
  bukti_url?: string;
  dicatat_oleh_nama: string;
  status: TransactionStatus;
}

export interface KeuanganSummary {
  totalPemasukan: number;
  totalPengeluaran: number;
  saldoKas: number;
  totalKasTerkumpul: number;
  totalTunggakanKas: number;
}

export interface MyUnpaidItem {
  periode_bulan: string;
  label: string;
  nominal: number;
  dibayar: number;
  sisa: number;
}

export interface MyPaidItem {
  periode_bulan: string;
  label: string;
  nominal: number;
  dibayar: number;
  tanggal_bayar: string;
  dicatat_oleh_nama: string;
  metode_bayar?: PaymentMethod;
}

export interface MyKasSummary {
  crew: {
    id: string;
    ptvId: string;
    name: string;
    division: string;
    position: string;
    photo?: string;
  };
  unpaidPeriods: MyUnpaidItem[];
  paidPeriods: MyPaidItem[];
  totalTunggakan: number;
  totalDibayar: number;
  totalTagihan: number;
  isLunasSemua: boolean;
}

export type KeuanganTab = 'kas_kru' | 'pemasukan' | 'pengeluaran';
