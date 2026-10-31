export interface ExternalContact {
  id: string;
  nama: string;
  kategori: string; // Sapaan / Peran: Ustadz, Ustadzah, Vendor, Partner, dll.
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

export const INITIAL_EXTERNAL_CONTACTS: ExternalContact[] = [
  {
    id: 'ke-001',
    nama: 'Ust. H. Fauzi Ridwan, S.Pd.I.',
    kategori: 'Ustadz',
    jabatan: 'Kepala Madin & Pengasuhan Putra',
    organisasi: 'Pondok Pesantren Bumi Shalawat',
    lembaga: 'Pondok',
    nomor_telepon: '081234567111',
    whatsapp: '081234567111',
    email: 'fauzi.ridwan@bumishalawat.org',
    alamat: 'Kompleks Asrama Al-Ikhlas Lt. 2, Sidoarjo',
    catatan: 'Kontak koordinasi izin santri dan liputan kegiatan madin.',
    status: 'Aktif',
  },
  {
    id: 'ke-002',
    nama: 'U. Isma Dwi Cahyani, S.Pd.',
    kategori: 'Ustadzah',
    jabatan: 'Koordinator Keasramaan Putri',
    organisasi: 'Pondok Pesantren Putri Bumi Shalawat',
    lembaga: 'Pondok',
    nomor_telepon: '081398765222',
    whatsapp: '081398765222',
    email: 'isma.dwi@bumishalawat.org',
    alamat: 'Gedung Asrama Putri Khadijah',
    catatan: 'PIC perizinan liputan khusus santriwati dan wisuda tahfidz.',
    status: 'Aktif',
  },
  {
    id: 'ke-003',
    nama: 'Pak Wahyu Pratama, M.Kom.',
    kategori: 'Ustadz',
    jabatan: 'Waka Kesiswaan & IT',
    organisasi: 'SMA Progresif Bumi Shalawat',
    lembaga: 'Sekolah',
    nomor_telepon: '085712345333',
    whatsapp: '085712345333',
    email: 'wahyu.pratama@smaprogresif.sch.id',
    alamat: 'Gedung SMA Progresif Lt. 1, Ruang Kesiswaan',
    catatan: 'Koordinasi liputan olimpiade, wisuda, dan agenda kesiswaan.',
    status: 'Aktif',
  },
  {
    id: 'ke-004',
    nama: 'Bu Rina Wijayanti, S.Pd.',
    kategori: 'Ustadzah',
    jabatan: 'Kepala Sarana Prasarana',
    organisasi: 'SMP Progresif Bumi Shalawat',
    lembaga: 'Sekolah',
    nomor_telepon: '085811223444',
    whatsapp: '085811223444',
    email: 'sarpras@smpprogresif.sch.id',
    alamat: 'Kantor Tata Usaha SMP Progresif Lt. 1',
    catatan: 'Peminjaman ruangan aula SMP untuk studio dadakan liputan.',
    status: 'Aktif',
  },
  {
    id: 'ke-005',
    nama: 'H. Bambang Sulistyo',
    kategori: 'Pembina',
    jabatan: 'Direktur Umum & Aset Yayasan',
    organisasi: 'Yayasan Bumi Shalawat',
    lembaga: 'Yayasan',
    nomor_telepon: '081199887555',
    whatsapp: '081199887555',
    email: 'aset@bumishalawat.foundation',
    alamat: 'Gedung Rektorat Yayasan Lt. 3',
    catatan: 'Dispensasi anggaran liputan besar dan aset kendaraan operasional.',
    status: 'Aktif',
  },
  {
    id: 'ke-006',
    nama: 'CV. Surya Jaya Audio Visual',
    kategori: 'Vendor',
    jabatan: 'PIC Rental LED Screen & Rigging',
    organisasi: 'Mitra Surya Jaya Production',
    lembaga: 'Mitra',
    nomor_telepon: '082233445666',
    whatsapp: '082233445666',
    email: 'order@suryajayaprod.com',
    alamat: 'Jl. Raya Tropodo No. 45, Waru, Sidoarjo',
    catatan: 'Rekanan rental videotron outdoor untuk Haul Akbar & konser santri.',
    status: 'Aktif',
  },
];
