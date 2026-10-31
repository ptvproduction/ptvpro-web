import { NoteItem } from '../types';

export const MOCK_NOTES: NoteItem[] = [
  {
    id: 'note-001',
    tipe: 'shared',
    judul: 'SOP Pengisian Baterai V-Mount & Keamanan Kelistrikan Studio',
    isi: `<h1>SOP Baterai V-Mount & Kelistrikan</h1>
<p>Dilarang keras meninggalkan charger baterai V-Mount 190Wh menyala semalaman di studio tanpa pengawasan kru piket.</p>
<h2>Aturan Pengisian Daya:</h2>
<p>• Pengisian maksimal 3 jam per baterai hingga lampu indikator hijau penuh.<br>
• Cabut colokan utama charger dari stopkontak saat studio ditutup.<br>
• Jika mendeteksi baterai menggelembung atau panas berlebih, segera laporkan ke Pengelola Alat.</p>`,
    warna: 'orange',
    tags: ['sop', 'alat', 'keamanan', 'baterai'],
    is_pinned: true,
    created_by_id: 'usr-roup-01',
    created_by_name: 'Roup (Eksekutif)',
    created_at: '2026-10-12T08:30:00Z',
    updated_at: '2026-10-14T09:15:00Z'
  },
  {
    id: 'note-002',
    tipe: 'shared',
    judul: 'Deadline Master Video Profil Pesantren 2026',
    isi: `<h1>Deadline Master Video Profil</h1>
<p>Proses post-production video profil pesantren tahap final wajib diserahkan paling lambat hari <strong>Jumat pukul 17:00 WIB</strong>.</p>
<h2>Checklist Finalisasi:</h2>
<p>• Color grading konsisten Rec.709.<br>
• Audio mastering -14 LUFS untuk YouTube dan web.<br>
• Subtitle Bahasa Arab dan Inggris telah diverifikasi bagian bahasa.</p>`,
    warna: 'orange',
    tags: ['deadline', 'editing', 'profil', 'urgent'],
    is_pinned: true,
    created_by_id: 'usr-zidna-02',
    created_by_name: 'Zidna (Pengarah)',
    created_at: '2026-10-13T10:00:00Z',
    updated_at: '2026-10-14T14:20:00Z'
  },
  {
    id: 'note-003',
    tipe: 'shared',
    judul: 'Konsep Serial Dokumenter Santri Berprestasi & Riset Robotika',
    isi: `<h1>Konsep Serial Dokumenter</h1>
<p>Ide serial mini-dokumenter 3 episode mengangkat santri penghafal Quran 30 juz yang berhasil menjuarai kompetisi robotika nasional.</p>
<h2>Format & Gaya Visual:</h2>
<p>• Sinematografi rasio 2.39:1 dengan warna hangat natural.<br>
• Wawancara mendalam diiringi cuplikan kegiatan santri mengaji dan berkutat di bengkel elektronika.<br>
• Durasi per episode sekitar 12 - 15 menit.</p>`,
    warna: 'yellow',
    tags: ['ide', 'konten', 'dokumenter', 'kreatif'],
    is_pinned: false,
    created_by_id: 'usr-faiz-03',
    created_by_name: 'Faiz (Kreatif)',
    created_at: '2026-10-11T14:00:00Z',
    updated_at: '2026-10-13T11:00:00Z'
  },
  {
    id: 'note-004',
    tipe: 'shared',
    judul: 'Strategi Hook 3 Detik Konten Shorts & TikTok PTV',
    isi: `<h1>Strategi Video Pendek</h1>
<p>Evaluasi retensi audiens menunjukkan penurunan pada 3 detik pertama jika video diawali bumper logo statis.</p>
<h2>Rencana Aksi:</h2>
<p>• Langsung mulai dengan kutipan paling kuat dari narasumber.<br>
• Gunakan teks animasi tebal warna kuning-putih dengan highlight kata kunci.<br>
• Pasang bumper transisi mikro hanya di akhir video sebagai ajakan subscribe.</p>`,
    warna: 'yellow',
    tags: ['shorts', 'tiktok', 'medsos', 'strategi'],
    is_pinned: false,
    created_by_id: 'usr-faiz-03',
    created_by_name: 'Faiz (Kreatif)',
    created_at: '2026-10-10T16:20:00Z',
    updated_at: '2026-10-12T10:45:00Z'
  },
  {
    id: 'note-005',
    tipe: 'shared',
    judul: 'Broadcast Kru: Jadwal Piket Studio & Libur Operasional Maulid',
    isi: `<h1>Jadwal Piket & Libur Maulid</h1>
<p>Diumumkan kepada seluruh kru operasional PTV bahwa siaran reguler studio diliburkan pada peringatan 12 Rabiul Awwal.</p>
<p>Tim yang bertugas adalah Shift Khusus Siaga Liputan Lapangan di bawah komando Mas Roup. Studio editing dibuka terbatas bagi kru yang mengejar tenggat render.</p>`,
    warna: 'green',
    tags: ['broadcast', 'libur', 'piket', 'kru'],
    is_pinned: false,
    created_by_id: 'usr-roup-01',
    created_by_name: 'Roup (Eksekutif)',
    created_at: '2026-10-09T08:00:00Z',
    updated_at: '2026-10-10T09:00:00Z'
  },
  {
    id: 'note-006',
    tipe: 'shared',
    judul: 'Kebijakan Pemeriksaan Lensa Cinema Sony G-Master Pasca-Liputan',
    isi: `<h1>Kebijakan Perawatan Lensa</h1>
<p>Mengingat curah hujan tinggi, seluruh kru wajib melakukan inspeksi fisik lensa segera setelah kembali dari liputan outdoor.</p>
<p>Gunakan blower dan microfiber bersih, pastikan lensa masuk ke dry-box dengan kelembapan 40-45% RH. Dilarang menyimpan lensa dalam tas kamera basah.</p>`,
    warna: 'green',
    tags: ['lensa', 'perawatan', 'drybox', 'alat'],
    is_pinned: false,
    created_by_id: 'usr-hakim-04',
    created_by_name: 'Hakim (Logistik)',
    created_at: '2026-10-08T11:15:00Z',
    updated_at: '2026-10-08T11:15:00Z'
  },
  {
    id: 'note-007',
    tipe: 'shared',
    judul: 'Rundown Live Streaming Haflah Akhirussanah & Wisuda Santri',
    isi: `<h1>Rundown Live Haflah 2026</h1>
<p>Konfigurasi siaran langsung 5 kamera terhubung ke switcher ATEM Mini Extreme ISO:</p>
<p>• Cam 1 (Panggung Utama): Sony FX3 + 70-200mm f/2.8<br>
• Cam 2 (Tamu Undangan): Sony A7 IV + 24-70mm f/2.8<br>
• Cam 3 (Koor / Paduan Suara): Sony A7 III + 35mm f/1.4<br>
• Cam 4 (Audience Hallway): PTZ Cam NDI<br>
• Drone Outdoor: DJI Air 3 (khusus prosesi kedatangan para kiai).</p>`,
    warna: 'purple',
    tags: ['haflah', 'live', 'streaming', 'rundown'],
    is_pinned: false,
    created_by_id: 'usr-zidna-02',
    created_by_name: 'Zidna (Pengarah)',
    created_at: '2026-10-07T07:30:00Z',
    updated_at: '2026-10-09T13:40:00Z'
  },
  {
    id: 'note-008',
    tipe: 'shared',
    judul: 'Checklist Perlengkapan Audio & Kamera Liputan Wisuda',
    isi: `<h1>Checklist Perlengkapan Wisuda</h1>
<p>Peralatan yang wajib disiapkan di flight case A1 dan B2:</p>
<p>• 4 unit wireless mic Hollyland Lark Max + deadcat.<br>
• 1 unit Zoom H6 audio field recorder.<br>
• 8 unit baterai Sony NP-FZ100 (kondisi terisi 100%).<br>
• 4 kabel HDMI high-speed 15 meter + gaffer tape hitam.</p>`,
    warna: 'rose',
    tags: ['checklist', 'wisuda', 'audio', 'kamera'],
    is_pinned: false,
    created_by_id: 'usr-hakim-04',
    created_by_name: 'Hakim (Logistik)',
    created_at: '2026-10-06T15:00:00Z',
    updated_at: '2026-10-07T08:20:00Z'
  },
  {
    id: 'note-009',
    tipe: 'meeting_minutes',
    judul: 'Notulensi Rapat Evaluasi Mingguan Siaran Langsung & Interkom Kru',
    isi: `<h1>Notulensi Rapat: Evaluasi Mingguan Studio PTV</h1>
<p><strong>Hari / Tanggal:</strong> Senin, 14 Oktober 2026<br>
<strong>Waktu:</strong> 13:00 - 15:30 WIB<br>
<strong>Tempat / Media:</strong> Ruang Rapat Eksekutif PTV<br>
<strong>Peserta:</strong> Roup, Zidna, Faiz, Hakim, Tim Audio & Siaran</p>

<h2>1. Agenda Pembahasan</h2>
<p>• Evaluasi gangguan audio latency pada siaran Ahad pagi.<br>
• Kebutuhan penambahan headset intercom wireless untuk kameramen outdoor.<br>
• Pengaturan ulang bandwidth jaringan khusus jalur live RTMP.</p>

<h2>2. Pembahasan & Keputusan Rapat</h2>
<p>• Masalah latency audio disebabkan oleh desinkronisasi clock sample rate 44.1kHz vs 48kHz pada interface mixer. Disepakati standardisasi seluruh perangkat audio studio wajib di-lock pada 48kHz 24-bit.<br>
• Disetujui alokasi 1 IP statis prioritas untuk PC encoder OBS agar tidak terganggu trafik tamu.</p>

<h2>3. Tindak Lanjut (Action Items) & PIC</h2>
<p>• PIC Audio (Hakim): Kalibrasi ulang interface audio sebelum hari Kamis.<br>
• PIC Jaringan (Zidna): Konfigurasi QoS pada router mikrotik studio.</p>`,
    warna: 'orange',
    tags: ['notulensi', 'evaluasi', 'audio', 'streaming'],
    is_pinned: true,
    created_by_id: 'usr-roup-01',
    created_by_name: 'Roup (Eksekutif)',
    created_at: '2026-10-14T16:00:00Z',
    updated_at: '2026-10-14T16:00:00Z',
    meeting_meta: {
      date: '2026-10-14',
      time: '13:00 - 15:30 WIB',
      loc: 'Ruang Rapat Eksekutif PTV',
      att: 'Roup, Zidna, Faiz, Hakim, Tim Audio & Siaran',
      event_name: 'Evaluasi Mingguan Studio'
    }
  },
  {
    id: 'note-010',
    tipe: 'meeting_minutes',
    judul: 'Notulensi Rapat Koordinasi Pengadaan Studio Podcast & Akustik',
    isi: `<h1>Notulensi Rapat: Pengadaan Studio Podcast 2026</h1>
<p><strong>Hari / Tanggal:</strong> Kamis, 10 Oktober 2026<br>
<strong>Waktu:</strong> 09:30 - 11:30 WIB<br>
<strong>Tempat / Media:</strong> Studio Podcast PTV<br>
<strong>Peserta:</strong> Dewan Pengarah, Bagian Sarpras, Tim Kreatif</p>

<h2>1. Agenda Pembahasan</h2>
<p>• Pemasangan panel busa peredam akustik dinding.<br>
• Pemilihan meja modular bundar untuk format podcast 3 narasumber.<br>
• Penggantian lighting utama menggunakan softbox lantern dome.</p>

<h2>2. Pembahasan & Keputusan Rapat</h2>
<p>• Disepakati nuansa latar belakang kayu gelap dengan pencahayaan warm accent.<br>
• Penempatan kamera 3-angle: 1 wide panggung dan 2 tight close-up narasumber.</p>

<h2>3. Tindak Lanjut (Action Items) & PIC</h2>
<p>• Bagian Sarpras: Eksekusi pemasangan panel akustik mulai Sabtu depan.<br>
• Faiz: Desain visual neon sign logo PTV Podcast.</p>`,
    warna: 'yellow',
    tags: ['notulensi', 'podcast', 'sarpras', 'akustik'],
    is_pinned: false,
    created_by_id: 'usr-zidna-02',
    created_by_name: 'Zidna (Pengarah)',
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
    meeting_meta: {
      date: '2026-10-10',
      time: '09:30 - 11:30 WIB',
      loc: 'Studio Podcast PTV',
      att: 'Dewan Pengarah, Bagian Sarpras, Tim Kreatif',
      event_name: 'Perencanaan Studio Podcast'
    }
  }
];
