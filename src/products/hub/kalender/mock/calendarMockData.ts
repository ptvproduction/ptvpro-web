import { CalendarEvent, ContentPlannerItem, CalendarDocConfig } from '../types';
import { padZero } from '../utils/calendarDateUtils';

/**
 * Penanda internal bahwa data ini adalah fixture terisolasi untuk preview UI / Module Showcase.
 * Tidak terhubung ke Supabase, backend, atau database produksi.
 */
export const IS_MOCK_FIXTURE = true;

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth(); // 0-indexed

// Helper pembuat tanggal bulan berjalan
function getIsoInCurrentMonth(day: number): string {
  return `${currentYear}-${padZero(currentMonth + 1)}-${padZero(day)}`;
}

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'ev-mock-1',
    name: 'Liputan Pengajian Rutin Ahad Pagi',
    date: getIsoInCurrentMonth(5),
    time: '06:00 - 08:30 WIB',
    loc: 'Masjid Agung Pondok Pesantren',
    category: 'Liputan Utama',
    crew: ['Ahmad Fauzi', 'Zulfikar', 'Budi Santoso'],
    gear: ['Sony FX3 Main', 'Sony A7IV', 'Wireless Mic DJI'],
    status: 'Dijadwalkan',
    notes: 'Kamera utama stand by di panggung VIP, audio direct XLR dari mixer utama.'
  },
  {
    id: 'ev-mock-2',
    name: 'Dokumentasi Wisuda Tahfidz Al-Qur\'an Juz 30',
    date: getIsoInCurrentMonth(12),
    time: '08:00 - 12:00 WIB',
    loc: 'Auditorium Utama Lantai 3',
    category: 'Acara Khusus',
    crew: ['Rahmat Hidayat', 'Fajar Ramadhan', 'Ali Imron'],
    gear: ['Sony FX30', 'Gimbal Ronin RS3', 'Lighting Godox SL60'],
    status: 'Dijadwalkan',
    notes: 'Live streaming multi-camera YouTube & Facebook resmi.'
  },
  {
    id: 'ev-mock-3',
    name: 'Podcast Santri Berkarya: Episode 14',
    date: getIsoInCurrentMonth(16),
    time: '13:30 - 15:30 WIB',
    loc: 'Studio Podcast PTV',
    category: 'Program Reguler',
    crew: ['Zulfa Arifin', 'Dedi Prasetyo'],
    gear: ['Shure SM7B (2x)', 'RodeCaster Pro', 'Blackmagic Pocket 4K'],
    status: 'Dijadwalkan',
    notes: 'Bintang tamu juara olimpiade sains nasional.'
  },
  {
    id: 'ev-mock-4',
    name: 'Liputan Upacara Hari Peringatan Santri & Yayasan',
    date: getIsoInCurrentMonth(22),
    time: '07:00 - 09:30 WIB',
    loc: 'Lapangan Utama Pesantren',
    category: 'Liputan Akbar',
    crew: ['Tim Multimedia Lengkap'],
    gear: ['Drone DJI Air 3', 'Sony FX3', 'Sony A7IV (2x)'],
    status: 'Persiapan',
    notes: 'Wajib izin terbang drone ke keamanan pusat.'
  },
  {
    id: 'ev-mock-5',
    name: 'Kajian Kitab Kuning Bersama Pengasuh',
    date: getIsoInCurrentMonth(26),
    time: '19:45 - 21:30 WIB',
    loc: 'Ndalem Kasepuhan',
    category: 'Kajian',
    crew: ['Imron Rosyadi', 'Farhan'],
    gear: ['Sony FX30', 'Shotgun Mic Sennheiser'],
    status: 'Dijadwalkan',
    notes: 'Pencahayaan soft warm, audio kabel panjang langsung ke mimbar.'
  }
];

export const MOCK_CONTENT_PLANNERS: ContentPlannerItem[] = [
  // 1. Momentum Fleksibel Sepanjang Bulan (Tanggal Belum Ditentukan)
  {
    id: 'plan-mock-1',
    judul_momentum: 'Kampanye Gemar Membaca & Literasi Santri',
    kategori: 'Event Pondok',
    subkategori: 'Program Bulanan',
    deskripsi: 'Rangkaian konten reels dan liputan perpustakaan pesantren sepanjang bulan ini.',
    daftar_konten: [
      'Reels: Rekomendasi 5 Kitab Rujukan',
      'Infografis: Jadwal Kunjungan Perpus',
      'Vlog: Seharian Membaca Santri'
    ],
    recurrence_type: 'bulan_masehi',
    bulan_masehi: currentMonth + 1
  },
  {
    id: 'plan-mock-2',
    judul_momentum: 'Persiapan Semester Baru & Penerimaan Santri',
    kategori: 'Event Pondok',
    subkategori: 'Penerimaan',
    deskripsi: 'Materi edukasi syarat pendaftaran santri baru dan tur asrama virtual.',
    daftar_konten: [
      'Video Profil Asrama',
      'Q&A Penerimaan Santri di Instagram',
      'Highlight Prestasi Santri'
    ],
    recurrence_type: 'bulan_masehi',
    bulan_masehi: currentMonth + 1
  },

  // 2. Momentum Tanggal Pasti (Masehi / Hijriah)
  {
    id: 'plan-mock-3',
    judul_momentum: 'Hari Guru & Penghormatan Ustadz/Ustadzah',
    kategori: 'Event Masehi',
    subkategori: 'Peringatan',
    deskripsi: 'Konten ucapan terima kasih dan kompilasi pesan santri untuk para guru dan asatidz.',
    daftar_konten: [
      'Video Kompilasi Ucapan',
      'Carousel: Nasehat Berharga Dewan Guru'
    ],
    recurrence_type: 'tanggal_masehi_tahunan',
    tanggal_masehi: 12, // Dibuat sama dengan tanggal ev-mock-2 (Tanggal 12) untuk mendemokan HAS-BOTH!
    bulan_masehi: currentMonth + 1
  },
  {
    id: 'plan-mock-4',
    judul_momentum: 'Malam Khotmil Qur\'an & Doa Bersama',
    kategori: 'Event Pondok',
    subkategori: 'Spiritual',
    deskripsi: 'Dokumentasi audio-visual doa bersama malam Kamis.',
    daftar_konten: [
      'Live TikTok Khotmil Qur\'an',
      'Poster Doa Harian'
    ],
    recurrence_type: 'tanggal_masehi_tahunan',
    tanggal_masehi: 18,
    bulan_masehi: currentMonth + 1
  },
  {
    id: 'plan-mock-5',
    judul_momentum: 'Publikasi Hasil Seleksi Santri Berprestasi',
    kategori: 'Event Masehi',
    subkategori: 'Akademik',
    deskripsi: 'Rilis daftar santri peraih medali perlombaan tingkat regional dan nasional.',
    daftar_konten: [
      'Banner Selamat & Sukses',
      'Wawancara Eksklusif Pemenang'
    ],
    recurrence_type: 'tanggal_masehi_tahunan',
    tanggal_masehi: 22, // Juga sama dengan tanggal ev-mock-4 untuk mendemokan HAS-BOTH
    bulan_masehi: currentMonth + 1
  }
];

export const CALENDAR_DOC_CONFIGS: Record<'pesantren' | 'sekolah', CalendarDocConfig> = {
  pesantren: {
    id: 'pesantren',
    title: 'Kalender Akademik Pesantren 2026',
    subtitle: 'Arsip & Dokumen Resmi Santri dan Pesantren Progresif Bumi Shalawat',
    icon: 'fa-solid fa-mosque',
    iconColor: '#059669',
    iconBg: 'rgba(16, 185, 129, 0.12)',
    relPath: '/wp-content/uploads/KALENDER-2026@KHOLIL.pdf',
    downloadName: 'Kalender-Pesantren-2026.pdf',
    totalPages: 8
  },
  sekolah: {
    id: 'sekolah',
    title: 'Kalender Akademik Sekolah',
    subtitle: 'Arsip & Dokumen Resmi Pendidikan Yayasan Bumi Shalawat',
    icon: 'fa-solid fa-graduation-cap',
    iconColor: '#2563eb',
    iconBg: 'rgba(37, 99, 235, 0.12)',
    relPath: '/wp-content/uploads/01.013-SK-Agenda-Sekolah.pdf',
    downloadName: '01.013-SK-Agenda-Sekolah.pdf',
    totalPages: 4
  }
};
