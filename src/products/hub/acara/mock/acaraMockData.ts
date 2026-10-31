/**
 * PTV PRO — Modul Acara
 * Mock Fixtures Data Terisolasi & Realistis untuk UI Showcase Modul Acara
 * Menyelaraskan referensi kru, inventaris alat studio, dan notulensi rapat PTV Hub.
 */

import { AcaraItem } from '../types';

export const INITIAL_ACARA_FIXTURES: AcaraItem[] = [
  {
    id: 'ev-001',
    name: 'Liputan Khusus Pengajian Akbar & Shalawat Bersama Jamaah Santri',
    date: '2026-10-16', // Hari ini
    time: '19:30 – 22:30 WIB',
    loc: 'Masjid Jami’ & Halaman Utama Pesantren',
    status: 'Mendatang',
    notes: 'Briefing tim di ruang redaksi pukul 18.45 WIB. Pastikan wireless mic channel 2 bebas interferensi. Sediakan 3 kamera fixed tripod di sudut kiri-kanan-center panggung serta 1 roving camera gimbal.',
    crew: [
      {
        id: 'kru-001',
        name: 'Roup',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Camera Person',
        tugas: 'Camera Person'
      },
      {
        id: 'kru-002',
        name: 'Zidna Santri',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Switcherman',
        tugas: 'Switcherman'
      },
      {
        id: 'kru-003',
        name: 'Farid Technical',
        division: 'Technical',
        role: 'Ketua Technical',
        job: 'Floor Director',
        tugas: 'Floor Director'
      },
      {
        id: 'kru-004',
        name: 'Ahmad Executive',
        division: 'Leadership',
        role: 'Ketua Umum',
        job: 'Dokumentasi Foto',
        tugas: 'Dokumentasi Foto'
      }
    ],
    gear: [
      {
        id: 'inv-001',
        item_id: 'inv-001',
        name: 'Sony FX3 Cinema Line Full-Frame Camera',
        code: 'INV-001',
        cat: 'Kamera',
        qty: 2,
        units: [
          { unit: 1, code: 'INV-001-U01', barcode: 'INV-001-U01' },
          { unit: 2, code: 'INV-001-U02', barcode: 'INV-001-U02' }
        ]
      },
      {
        id: 'inv-002',
        item_id: 'inv-002',
        name: 'Sony FE 24-70mm f/2.8 GM II Lens',
        code: 'INV-002',
        cat: 'Lensa',
        qty: 1,
        units: [
          { unit: 1, code: 'INV-002-U01', barcode: 'INV-002-U01' }
        ]
      },
      {
        id: 'inv-003',
        item_id: 'inv-003',
        name: 'Blackmagic Design ATEM Mini Pro ISO Switcher',
        code: 'INV-003',
        cat: 'Streaming',
        qty: 1,
        units: [
          { unit: 1, code: 'INV-003-U01', barcode: 'INV-003-U01' }
        ]
      },
      {
        id: 'inv-004',
        item_id: 'inv-004',
        name: 'Rode Wireless GO II Dual Channel Microphone System',
        code: 'INV-004',
        cat: 'Audio',
        qty: 1,
        units: [
          { unit: 1, code: 'INV-004-U01', barcode: 'INV-004-U01' }
        ]
      }
    ],
    rundown: [
      {
        id: 'rd-001-1',
        acara_id: 'ev-001',
        jam_mulai: '19:00',
        kegiatan: 'Persiapan Teknis, Pemasangan Kabel SDI, dan Audio Check'
      },
      {
        id: 'rd-001-2',
        acara_id: 'ev-001',
        jam_mulai: '19:30',
        kegiatan: 'Pembukaan Acara, Tawasul & Pembacaan Ratib Al-Haddad'
      },
      {
        id: 'rd-001-3',
        acara_id: 'ev-001',
        jam_mulai: '20:15',
        kegiatan: 'Qasidah Shalawat Nabi & Penampilan Hadrah Santri'
      },
      {
        id: 'rd-001-4',
        acara_id: 'ev-001',
        jam_mulai: '21:00',
        kegiatan: 'Mauidhoh Hasanah oleh Pengasuh Pondok Pesantren'
      },
      {
        id: 'rd-001-5',
        acara_id: 'ev-001',
        jam_mulai: '22:15',
        kegiatan: 'Doa Penutup, Mushafahah, dan Wrap-Up Kru Lapangan'
      }
    ],
    notulensi_ids: ['nt-001'],
    doc: 'POSTER-PENGAJIAN-AKBAR-2026.pdf',
    type: 'liputan',
    dresscode: 'Kemeja PTV Putih & Peci Hitam'
  },
  {
    id: 'ev-002',
    name: 'Podcast PTV Inspirasi: Dialog Santri Kreatif & Industri Media Digital',
    date: '2026-10-17', // Besok
    time: '13:00 – 15:30 WIB',
    loc: 'Studio Utama PTV Lt. 2',
    status: 'Mendatang',
    notes: 'Setting podcast 2 narasumber + 1 host. Gunakan lighting 3-point (Key, Fill, Backlight). Pastikan recording backup berjalan di Blackmagic HyperDeck studio.',
    crew: [
      {
        id: 'kru-001',
        name: 'Roup',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Audio Engineer',
        tugas: 'Audio Engineer'
      },
      {
        id: 'kru-005',
        name: 'M. Rizqi S.',
        division: 'Production',
        role: 'Creative Crew',
        job: 'Host',
        tugas: 'Host'
      },
      {
        id: 'kru-006',
        name: 'Danang Videografer',
        division: 'Production',
        role: 'Videographer',
        job: 'Camera Person',
        tugas: 'Camera Person'
      }
    ],
    gear: [
      {
        id: 'inv-001',
        item_id: 'inv-001',
        name: 'Sony FX3 Cinema Line Full-Frame Camera',
        code: 'INV-001',
        cat: 'Kamera',
        qty: 1,
        units: [
          { unit: 1, code: 'INV-001-U01', barcode: 'INV-001-U01' }
        ]
      },
      {
        id: 'inv-005',
        item_id: 'inv-005',
        name: 'Aputure Amaran 200d LED Video Light Kit',
        code: 'INV-005',
        cat: 'Lighting',
        qty: 2,
        units: [
          { unit: 1, code: 'INV-005-U01', barcode: 'INV-005-U01' },
          { unit: 2, code: 'INV-005-U02', barcode: 'INV-005-U02' }
        ]
      }
    ],
    rundown: [
      {
        id: 'rd-002-1',
        acara_id: 'ev-002',
        jam_mulai: '12:30',
        kegiatan: 'Sound Check Mic Podcast, Mic Gain Leveling & Framing Kamera'
      },
      {
        id: 'rd-002-2',
        acara_id: 'ev-002',
        jam_mulai: '13:00',
        kegiatan: 'Taping Sesi 1: Perjalanan Santri Menembus Industri Penyiaran'
      },
      {
        id: 'rd-002-3',
        acara_id: 'ev-002',
        jam_mulai: '14:15',
        kegiatan: 'Taping Sesi 2: Kiat Membangun Portofolio Kreatif di Era AI'
      },
      {
        id: 'rd-002-4',
        acara_id: 'ev-002',
        jam_mulai: '15:15',
        kegiatan: 'Closing Statement Host, Foto Bersama Narasumber, File Backup'
      }
    ],
    notulensi_ids: ['nt-002'],
    doc: '',
    type: 'internal',
    dresscode: 'Kaos PTV Official Hitam'
  },
  {
    id: 'ev-003',
    name: 'Liputan Wisuda Tahfidz Al-Qur\'an Angkatan XIV & Haflah Tasyakkur',
    date: '2026-10-19', // 3 hari lagi
    time: '08:00 – 12:00 WIB',
    loc: 'Auditorium Gedung Pusat Yayasan Lt. 3',
    status: 'Mendatang',
    notes: 'Liputan formal live streaming YouTube & Facebook Progresif TV. Gunakan fiber optik converter ke ruang siaran master control.',
    crew: [
      {
        id: 'kru-002',
        name: 'Zidna Santri',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Operator Streaming',
        tugas: 'Operator Streaming'
      },
      {
        id: 'kru-003',
        name: 'Farid Technical',
        division: 'Technical',
        role: 'Ketua Technical',
        job: 'Floor Director',
        tugas: 'Floor Director'
      },
      {
        id: 'kru-007',
        name: 'Budi Santoso',
        division: 'Media',
        role: 'Fotografer',
        job: 'Dokumentasi Foto',
        tugas: 'Dokumentasi Foto'
      }
    ],
    gear: [
      {
        id: 'inv-001',
        item_id: 'inv-001',
        name: 'Sony FX3 Cinema Line Full-Frame Camera',
        code: 'INV-001',
        cat: 'Kamera',
        qty: 2,
        units: [
          { unit: 1, code: 'INV-001-U01', barcode: 'INV-001-U01' },
          { unit: 2, code: 'INV-001-U02', barcode: 'INV-001-U02' }
        ]
      },
      {
        id: 'inv-003',
        item_id: 'inv-003',
        name: 'Blackmagic Design ATEM Mini Pro ISO Switcher',
        code: 'INV-003',
        cat: 'Streaming',
        qty: 1,
        units: [
          { unit: 1, code: 'INV-003-U01', barcode: 'INV-003-U01' }
        ]
      }
    ],
    rundown: [
      {
        id: 'rd-003-1',
        acara_id: 'ev-003',
        jam_mulai: '07:30',
        kegiatan: 'Gladi Bersih Tim Live Streaming & Cek Koneksi Internet Dedicated'
      },
      {
        id: 'rd-003-2',
        acara_id: 'ev-003',
        jam_mulai: '08:00',
        kegiatan: 'Prosesi Masuk Wisudawan Tahfidz ke Dalam Ruangan'
      },
      {
        id: 'rd-003-3',
        acara_id: 'ev-003',
        jam_mulai: '09:00',
        kegiatan: 'Uji Hafalan Terbuka Bersama Para Penguji Eksternal'
      },
      {
        id: 'rd-003-4',
        acara_id: 'ev-003',
        jam_mulai: '11:00',
        kegiatan: 'Pengalungan Gordon & Penyerahan Syahadah Tahfidz'
      }
    ],
    notulensi_ids: [],
    doc: 'RUNDOWN-WISUDA-TAHFIDZ-XIV.pdf',
    type: 'liputan',
    dresscode: 'Batik Resmi PTV & Celana Hitam'
  },
  {
    id: 'ev-004',
    name: 'Produksi Siaran Langsung Talkshow Hari Santri Nasional 2026',
    date: '2026-10-24', // 8 hari lagi
    time: '09:00 – 11:30 WIB',
    loc: 'Studio Mini Lantai 1 & Outdoor Taman Santri',
    status: 'Mendatang',
    notes: 'Kombinasi siaran hybrid indoor & outdoor. Gunakan HDMI wireless transmitter Hollyland Mars 400S Pro untuk umpan kamera luar.',
    crew: [
      {
        id: 'kru-001',
        name: 'Roup',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Camera Person',
        tugas: 'Camera Person'
      },
      {
        id: 'kru-008',
        name: 'Siti Aminah',
        division: 'Production',
        role: 'Creative Crew',
        job: 'Host',
        tugas: 'Host'
      }
    ],
    gear: [
      {
        id: 'inv-001',
        item_id: 'inv-001',
        name: 'Sony FX3 Cinema Line Full-Frame Camera',
        code: 'INV-001',
        cat: 'Kamera',
        qty: 1,
        units: [
          { unit: 1, code: 'INV-001-U01', barcode: 'INV-001-U01' }
        ]
      }
    ],
    rundown: [
      {
        id: 'rd-004-1',
        acara_id: 'ev-004',
        jam_mulai: '08:30',
        kegiatan: 'Standby Kru, Sinyal Wireless Mars 400S Link Verification'
      },
      {
        id: 'rd-004-2',
        acara_id: 'ev-004',
        jam_mulai: '09:00',
        kegiatan: 'On Air Segmen 1: Peran Pesantren dalam Resolusi Jihad'
      },
      {
        id: 'rd-004-3',
        acara_id: 'ev-004',
        jam_mulai: '10:00',
        kegiatan: 'On Air Segmen 2: Inovasi Teknologi dan Kemandirian Santri Era Modern'
      }
    ],
    notulensi_ids: [],
    doc: '',
    type: 'liputan',
    dresscode: 'Almamater Santri & Kemeja Putih'
  },
  {
    id: 'ev-005',
    name: 'Liputan Multicam Haflah Akhirussanah & Pelepasan Santri Angkatan XII',
    date: '2026-10-10', // Selesai masa lalu
    time: '08:00 – 14:00 WIB',
    loc: 'Auditorium Utama KH. Hasyim Asy\'ari',
    status: 'Selesai',
    notes: 'Liputan sukses selesai tanpa hambatan transmisi. Rekaman Master 4K ProRes tersimpan di Server NAS 01 folder /2026/Haflah-XII.',
    crew: [
      {
        id: 'kru-001',
        name: 'Roup',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Switcherman',
        tugas: 'Switcherman'
      },
      {
        id: 'kru-002',
        name: 'Zidna Santri',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Camera Person',
        tugas: 'Camera Person'
      },
      {
        id: 'kru-003',
        name: 'Farid Technical',
        division: 'Technical',
        role: 'Ketua Technical',
        job: 'Floor Director',
        tugas: 'Floor Director'
      }
    ],
    gear: [
      {
        id: 'inv-001',
        item_id: 'inv-001',
        name: 'Sony FX3 Cinema Line Full-Frame Camera',
        code: 'INV-001',
        cat: 'Kamera',
        qty: 2,
        units: [
          { unit: 1, code: 'INV-001-U01', barcode: 'INV-001-U01' },
          { unit: 2, code: 'INV-001-U02', barcode: 'INV-001-U02' }
        ]
      }
    ],
    rundown: [
      {
        id: 'rd-005-1',
        acara_id: 'ev-005',
        jam_mulai: '08:00',
        kegiatan: 'Pembukaan & Kirab Santri Wisudawan'
      },
      {
        id: 'rd-005-2',
        acara_id: 'ev-005',
        jam_mulai: '11:00',
        kegiatan: 'Orasi Ilmiah & Khutbah Wada\''
      }
    ],
    notulensi_ids: ['nt-001'],
    doc: '',
    type: 'liputan',
    dresscode: 'Jas Resmi PTV'
  },
  {
    id: 'ev-006',
    name: 'Workshop Intensif Teknik Kamera Multicam & Lighting Studio PTV',
    date: '2026-10-02', // Selesai
    time: '09:00 – 16:00 WIB',
    loc: 'Studio Utama PTV Lt. 2',
    status: 'Selesai',
    notes: 'Pelatihan internal khusus kru baru angkatan 2026. Seluruh materi praktikum telah didokumentasikan ke Google Drive Kru.',
    crew: [
      {
        id: 'kru-003',
        name: 'Farid Technical',
        division: 'Technical',
        role: 'Ketua Technical',
        job: 'Floor Director',
        tugas: 'Floor Director'
      },
      {
        id: 'kru-001',
        name: 'Roup',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Editor Video',
        tugas: 'Editor Video'
      }
    ],
    gear: [],
    rundown: [
      {
        id: 'rd-006-1',
        acara_id: 'ev-006',
        jam_mulai: '09:00',
        kegiatan: 'Teori Dasar Color Science S-Log3 & Exposure Matrix'
      },
      {
        id: 'rd-006-2',
        acara_id: 'ev-006',
        jam_mulai: '13:00',
        kegiatan: 'Praktik Simulasi Live Switching 3 Kamera'
      }
    ],
    notulensi_ids: [],
    doc: '',
    type: 'internal',
    dresscode: 'Bebas Rapi Berkerah'
  },
  {
    id: 'ev-007',
    name: 'Liputan Kunjungan Eksternal Tim Penyiaran Televisi Regional',
    date: '2026-10-12', // Dibatalkan
    time: '10:00 – 13:00 WIB',
    loc: 'Studio PTV & Kantor Redaksi',
    status: 'Dibatalkan',
    notes: 'Kunjungan ditunda atas permintaan delegasi eksternal karena penyesuaian jadwal dinas. Dijadwalkan ulang pada November 2026.',
    crew: [
      {
        id: 'kru-004',
        name: 'Ahmad Executive',
        division: 'Leadership',
        role: 'Ketua Umum',
        job: 'Host',
        tugas: 'Host'
      }
    ],
    gear: [],
    rundown: [],
    notulensi_ids: [],
    doc: '',
    type: 'eksternal',
    dresscode: 'Jas Resmi PTV'
  },
  {
    id: 'ev-008',
    name: 'Dokumentasi Khusus Pameran Seni Kaligrafi & Seni Rupa Santri Nusantara',
    date: '2026-11-01', // Jadwal November
    time: '08:30 – 16:30 WIB',
    loc: 'Galeri Seni Pesantren Lt. 1',
    status: 'Mendatang',
    notes: 'Peliputan karya kaligrafi kontemporer santri. Utamakan kamera gimbal smooth move untuk cinematic reels media sosial.',
    crew: [
      {
        id: 'kru-002',
        name: 'Zidna Santri',
        division: 'Technical',
        role: 'Crew Operator',
        job: 'Dokumentasi Lapangan',
        tugas: 'Dokumentasi Lapangan'
      }
    ],
    gear: [
      {
        id: 'inv-001',
        item_id: 'inv-001',
        name: 'Sony FX3 Cinema Line Full-Frame Camera',
        code: 'INV-001',
        cat: 'Kamera',
        qty: 1,
        units: [
          { unit: 1, code: 'INV-001-U01', barcode: 'INV-001-U01' }
        ]
      }
    ],
    rundown: [
      {
        id: 'rd-008-1',
        acara_id: 'ev-008',
        jam_mulai: '08:30',
        kegiatan: 'Peresmian Pameran oleh Pengasuh & Pemotongan Pita'
      },
      {
        id: 'rd-008-2',
        acara_id: 'ev-008',
        jam_mulai: '10:00',
        kegiatan: 'Tur Galeri & Wawancara Eksklusif Kaligrafer Santri'
      }
    ],
    notulensi_ids: [],
    doc: '',
    type: 'liputan',
    dresscode: 'Seragam Kru PTV'
  }
];

export const INITIAL_NOTULENSI_FIXTURES = [
  {
    id: 'nt-001',
    judul: 'Notulensi Rapat Koordinasi Liputan Pengajian Akbar & Shalawat Santri',
    isi: `Rapat pra-liputan bersama tim teknis dan panitia pengajian akbar. Disepakati alur audio langsung dari mixer sound system utama masjid melalui kabel XLR balance ke interface studio. Tim live streaming akan mulai standby 1 jam sebelum adzan Isya untuk testing bitrate YouTube.`,
    date: '2026-10-14',
    time: '20:00 WIB',
    loc: 'Ruang Rapat Redaksi PTV',
    att: 'Ahmad Executive, Farid Technical, Zidna Santri, Roup',
    created_by_name: 'Zidna Santri',
    tags: ['acara_ev-001', 'notulensi', 'rapat-teknis']
  },
  {
    id: 'nt-002',
    judul: 'Notulensi Rapat Konsep & Run Sheet Podcast Inspirasi Santri Ep. 12',
    isi: `Penyelarasan topik pembicaraan mengenai perkembangan artificial intelligence dan relevansinya bagi santri multimedia. Naskah intro dan segmen tanya jawab media sosial disiapkan oleh tim kreatif produksi.`,
    date: '2026-10-15',
    time: '14:00 WIB',
    loc: 'Studio Mini PTV',
    att: 'M. Rizqi S., Roup, Danang Videografer',
    created_by_name: 'M. Rizqi S.',
    tags: ['acara_ev-002', 'notulensi', 'podcast']
  },
  {
    id: 'nt-003',
    judul: 'Notulensi Rapat Evaluasi Peralatan & Inventaris Pasca Liputan Haflah',
    isi: `Pengecekan fisik peralatan kamera dan mikrofon pasca liputan haflah akbar. Ditemukan 1 kabel HDMI switcherman perlu penggantian terminal konektor karena aus. Seluruh unit kamera Sony FX3 dalam kondisi prima dan telah dibersihkan sensornya.`,
    date: '2026-10-11',
    time: '16:00 WIB',
    loc: 'Gudang Inventaris PTV',
    att: 'Farid Technical, Roup, Administrator Studio',
    created_by_name: 'Farid Technical',
    tags: ['notulensi', 'inventaris', 'evaluasi']
  }
];
