export interface InternalContact {
  id: string;
  full_name: string;
  title_prefix?: string; // Gelar / sapaan kehormatan (misal: 'KH.', 'Gus', 'Dr.', 'Ust.')
  position: string; // Jabatan fungsional / kehormatan
  unit: string; // Unit lembaga (Pesantren, Yayasan, Studio PTV, dll)
  category: 'Pembina' | 'Pengarah' | 'Pengurus' | 'Kru'; // Kategori direktori
  phone?: string;
  email?: string;
  foto_url?: string;
  notes?: string; // Catatan protokoler / koordinasi
  crew_id?: string; // Shared reference ke data kru (jika figur bersangkutan adalah anggota PTV)
  ptv_id?: string; // Canonical identifier PTV-ID (e.g. 'PTV-001')
  status?: 'Aktif' | 'Nonaktif'; // Status operasional / keanggotaan
  angkatan?: string; // Angkatan kru (e.g. '12', 'Additional')
  divisi?: string; // Nama divisi kerja
}
