import { emptyItem, type WorkspaceState, type Person, type WorkItem } from './types';

export const demoPeople: Person[] = [
  { id: 'demo-camera', name: 'Kru Kamera (simulasi)' },
  { id: 'demo-editor', name: 'Kru Editor (simulasi)' },
  { id: 'demo-publikasi', name: 'Kru Publikasi (simulasi)' },
  { id: 'person-zidnal', name: 'Bagas & Zidnal (Koordinator Layouter)' },
  { id: 'person-hasbi', name: 'Hasbi (Pusat Informasi)' },
  { id: 'person-nizar', name: 'Nizar & Mas Zarkasi (Motion Designer)' },
  { id: 'person-zaidan', name: 'Zaidan & Izzur (Video Narasi)' },
  { id: 'person-farsya', name: 'Alfa & Farsya & Mas Wil (Tim Promo)' },
  { id: 'person-gad', name: 'Mas Gad & Hamdan (Tim Technical)' },
  { id: 'person-taqiu', name: 'Taqiu (vMix / Streaming)' },
  { id: 'person-naufal', name: 'Naufal (Kamera Utama)' },
  { id: 'person-farras', name: 'Muhammad Farras Zaidan M' },
  { id: 'person-abyan', name: 'Abyan Zahirr' },
];

export function seedWorkspace(): WorkspaceState {
  const edition = { id: 'demo-2027', title: 'Haul & Harlah PPBS 2027', start: '2027-02-01', end: '2027-02-21' };
  const make = (kind: Parameters<typeof emptyItem>[0], id: string, title: string) => ({ ...emptyItem(kind, edition.id), id, title, revision: 1 });
  const event = { ...make('event', 'demo-opening', 'Pembukaan rangkaian'), brief: 'Contoh brief liputan. Sesuaikan dengan agenda resmi.', start: '2027-02-01T08:00', end: '2027-02-01T11:00', location: 'Lokasi contoh', order: 1 };
  const project = { ...make('project', 'demo-project', 'Paket liputan pembukaan'), eventIds: [event.id], picId: 'demo-editor' };
  const task = { ...make('task', 'demo-task', 'Siapkan bumper pembukaan'), projectId: project.id, eventIds: [event.id], picId: 'demo-editor', memberIds: ['demo-camera'], end: '2027-02-01T07:00', priority: 'Tinggi' as const };
  const session = { ...make('session', 'demo-session', 'Sesi pembukaan'), eventIds: [event.id], start: '2027-02-01T08:00', end: '2027-02-01T09:00', picId: 'demo-camera', position: 'Kamera 1', location: 'Lokasi contoh' };
  const content = { ...make('content', 'demo-content', 'Cuplikan hari pertama'), eventIds: [event.id], parentId: task.id, projectId: project.id, picId: 'demo-publikasi', platform: 'Instagram', format: 'Video vertikal', end: '2027-02-01T16:00', publishAt: '2027-02-01T18:00' };
  const note = { ...make('note', 'demo-note', 'Periksa jalur audio sebelum siaran'), eventIds: [event.id], pinned: true };
  return { version: 1, edition, editions: [edition], items: [event, project, task, session, content, note], audit: [], views: {} };
}

/**
 * Paket Data Referensi Nyata Haul & Harlah PPBS (dari 4 Screenshot Notion & Acara Resmi).
 * Dapat dimuat ke workspace via tombol "+ Paket PPBS" untuk mengisi rangkaian acara,
 * project layouter, task sosmed/acara, jadwal kalender Instagram, dan rundown sesi.
 */
export function getPpbsTemplateItems(editionId: string): WorkItem[] {
  const make = (kind: Parameters<typeof emptyItem>[0], id: string, title: string): WorkItem => ({
    ...emptyItem(kind, editionId),
    id,
    title,
    revision: 1,
  });

  // ── RANGKAIAN ACARA ──
  const evSama = {
    ...make('event', 'ev-sama', "Majelis Sama' Shahih Bukhari"),
    brief: "Majelis Sama' Hadits Shahih Bukhari dan siaran malam. Aula Asrama Putra. Fokus pada aset live, thumbnail, dan penugasan kru per sesi.",
    start: '2027-02-03T19:00',
    end: '2027-02-03T22:30',
    location: 'Aula Asrama Putra',
    order: 2,
    priority: 'Tinggi' as const,
  };

  const evMaulid = {
    ...make('event', 'ev-maulid', 'Maulid Haul PPBS'),
    brief: 'Rangkaian maulid akbar, publikasi hari berjalan, dan kebutuhan konten story serta live report.',
    start: '2027-02-05T15:30',
    end: '2027-02-05T18:00',
    location: 'Masjid Utama PPBS',
    order: 3,
  };

  const evPuncak = {
    ...make('event', 'ev-puncak', 'Haul Puncak (Malam Puncak)'),
    brief: 'Acara puncak dengan panggung megah, narasi haul, video opening, video profil PPBS, dan kontrol live streaming multi-kamera.',
    start: '2027-02-07T08:00',
    end: '2027-02-07T23:00',
    location: 'Panggung Utama PPBS',
    order: 4,
    priority: 'Mendesak' as const,
  };

  const evUmum = {
    ...make('event', 'ev-umum', 'Informasi Umum Haul'),
    brief: 'Garapan yang dipakai untuk keseluruhan rangkaian Haul & Harlah, tidak terikat satu acara saja.',
    start: '2027-02-01T08:00',
    end: '2027-02-21T23:59',
    location: 'Studio PTV & Media Center',
    order: 5,
  };

  // ── PROJECTS (DOKUMEN & KELOMPOK KERJA DINAMIS DARI NOTION) ──
  const prSosmed = {
    ...make('project', 'pr-prahaul-sosmed', 'Persiapan Pra Haul (Sosmed)'),
    eventIds: [evPuncak.id, evUmum.id],
    picId: 'person-farsya',
  };

  const prAcara = {
    ...make('project', 'pr-prahaul-acara', 'Persiapan Pra Haul (Acara)'),
    eventIds: [evPuncak.id, evUmum.id],
    picId: 'person-zidnal',
  };

  const prLayouter = {
    ...make('project', 'pr-layouter', 'Garapan Layouter'),
    eventIds: [evSama.id, evUmum.id],
    picId: 'person-zidnal',
  };

  const prLive = {
    ...make('project', 'pr-live', 'Broadcast & Streaming'),
    eventIds: [evSama.id, evPuncak.id],
    picId: 'person-taqiu',
  };

  const prVideo = {
    ...make('project', 'pr-video', 'Produksi Video'),
    eventIds: [evPuncak.id],
    picId: 'person-zaidan',
  };

  // ── TASKS ──
  const tkLogo = {
    ...make('task', 'tk-logo', 'Logo Haul & Filosofi Rangkaian'),
    brief: 'Segera agar bisa disebarkan waktu penyebaran flyer majelis.',
    projectId: prSosmed.id,
    eventIds: [evUmum.id, evPuncak.id],
    picId: 'person-zidnal',
    memberIds: ['person-nizar'],
    end: '2027-01-28T16:00',
    priority: 'Tinggi' as const,
    status: 'Selesai' as const,
    approval: 'Disetujui' as const,
    resultUrl: 'https://progresiftv.id/assets/logo-haul-2027.png',
  };

  const tkAnimasiLogo = {
    ...make('task', 'tk-animasi-logo', 'Animasi Launching Logo Haul'),
    brief: 'Launching via instagram Reels & Story.',
    projectId: prSosmed.id,
    eventIds: [evUmum.id, evPuncak.id],
    picId: 'person-nizar',
    end: '2027-01-28T19:00',
    priority: 'Tinggi' as const,
    status: 'Selesai' as const,
    approval: 'Disetujui' as const,
  };

  const tkFlyerRoadmap = {
    ...make('task', 'tk-flyer-roadmap', 'Feed & Flyer Roadmap Rangkaian Acara'),
    brief: 'Infografis jadwal lengkap dari pembukaan hingga malam puncak.',
    projectId: prSosmed.id,
    eventIds: [evUmum.id],
    picId: 'person-abyan',
    memberIds: ['person-farsya'],
    end: '2027-02-02T19:00',
    status: 'Selesai' as const,
    approval: 'Disetujui' as const,
  };

  const tkTwibbon = {
    ...make('task', 'tk-twibbon', 'Twibbon Resmi Haul PPBS'),
    brief: 'Format PNG transparan & link Twibbonize resmi.',
    projectId: prSosmed.id,
    eventIds: [evUmum.id],
    picId: 'person-abyan',
    end: '2027-02-03T16:00',
    status: 'Selesai' as const,
  };

  const tkFeedMalamPuncak = {
    ...make('task', 'tk-feed-puncak', 'Feed Flyer Malam Puncak'),
    brief: 'Pengumuman bintang tamu, muballigh, dan susunan acara puncak.',
    projectId: prSosmed.id,
    eventIds: [evPuncak.id],
    picId: 'person-zidnal',
    end: '2027-02-04T12:00',
    priority: 'Tinggi' as const,
    status: 'Dikerjakan' as const,
  };

  const tkMicrosite = {
    ...make('task', 'tk-microsite', 'Microsite Page Official Haul & Harlah'),
    brief: 'Halaman resmi progresiftv.id/haul-harlah untuk panduan jamaah.',
    projectId: prSosmed.id,
    eventIds: [evUmum.id],
    picId: 'person-zidnal',
    memberIds: ['person-abyan'],
    end: '2027-02-05T18:00',
    status: 'Dikerjakan' as const,
  };

  // Garapan Pra Haul (Acara)
  const tkFlyerUtama = {
    ...make('task', 'tk-flyer-utama', 'Flyer Utama Acara Puncak'),
    projectId: prAcara.id,
    eventIds: [evPuncak.id],
    picId: 'person-zidnal',
    end: '2027-02-05T12:00',
    status: 'Rencana' as const,
  };

  const tkBumperPuncak = {
    ...make('task', 'tk-bumper-puncak', 'Bumper Malam Puncak'),
    projectId: prAcara.id,
    eventIds: [evPuncak.id],
    picId: 'person-nizar',
    end: '2027-02-06T15:00',
    status: 'Dikerjakan' as const,
  };

  const tkAnimasiBumper = {
    ...make('task', 'tk-animasi-bumper', 'Animasi Bumper & Transition'),
    projectId: prAcara.id,
    eventIds: [evPuncak.id],
    picId: 'person-nizar',
    end: '2027-02-06T17:00',
    status: 'Rencana' as const,
  };

  const tkNarasiPuncak = {
    ...make('task', 'tk-narasi-puncak', 'Video Narasi / Syi\'ir Harlah'),
    projectId: prAcara.id,
    eventIds: [evPuncak.id],
    picId: 'person-zaidan',
    memberIds: ['person-farsya'],
    end: '2027-02-06T18:00',
    priority: 'Mendesak' as const,
    status: 'Dikerjakan' as const,
  };

  const tkThumbnailAll = {
    ...make('task', 'tk-thumbnail-all', 'Thumbnail All Live Streams'),
    projectId: prAcara.id,
    eventIds: [evPuncak.id, evSama.id],
    picId: 'person-zidnal',
    end: '2027-02-06T20:00',
    status: 'Rencana' as const,
  };

  // Garapan Layouter (Majelis Sama' & Umum)
  const tkBannerSama = {
    ...make('task', 'tk-banner-sama', "Banner Utama Majelis Sama'"),
    brief: 'Ukuran panggung utama 12x4 meter dan backdrop mimbar.',
    projectId: prLayouter.id,
    eventIds: [evSama.id],
    picId: 'person-zidnal',
    memberIds: ['person-farras'],
    end: '2027-02-03T12:00',
    priority: 'Tinggi' as const,
    status: 'Selesai' as const,
    approval: 'Disetujui' as const,
  };

  const tkDenahVisual = {
    ...make('task', 'tk-denah-visual', "Denah Visual Lokasi Acara"),
    brief: 'Zonasi jamaah putra, putri, dan jalur transit ulama.',
    projectId: prLayouter.id,
    eventIds: [evSama.id],
    picId: 'person-zidnal',
    end: '2027-02-03T14:00',
    status: 'Dikerjakan' as const,
  };

  const tkIdCard = {
    ...make('task', 'tk-idcard', 'ID Card Panitia & Delegasi Media'),
    projectId: prLayouter.id,
    eventIds: [evUmum.id],
    picId: 'person-zidnal',
    end: '2027-02-04T17:00',
    status: 'Review' as const,
    approval: 'Menunggu' as const,
  };

  const tkLinkForm = {
    ...make('task', 'tk-linkform', 'Link Form to Microsite'),
    projectId: prLayouter.id,
    eventIds: [evSama.id],
    picId: 'person-zidnal',
    end: '2027-02-02T12:00',
    status: 'Selesai' as const,
  };

  const tkLaporanProgress = {
    ...make('task', 'tk-laporan-prog', 'Laporan Progress Peserta Majelis'),
    projectId: prLayouter.id,
    eventIds: [evSama.id],
    picId: 'person-zidnal',
    end: '2027-02-03T10:00',
    status: 'Selesai' as const,
  };

  // Video & Broadcast
  const tkVideoOpening = {
    ...make('task', 'tk-video-opening', 'Video Opening & Profil PPBS'),
    projectId: prVideo.id,
    eventIds: [evPuncak.id],
    picId: 'person-zaidan',
    memberIds: ['person-taqiu'],
    end: '2027-02-06T20:00',
    priority: 'Tinggi' as const,
    status: 'Rencana' as const,
  };

  // ── RUNDOWN & SESI (PTV-DEV-208 Multi-Position & Multi-Crew) ──
  const ssSama1 = {
    ...make('session', 'ss-sama-1', "Persiapan Teknis & Audio Majelis Sama'"),
    brief: 'Checking signal video switcher, balancing mic podium kiai, dan set lighting live.',
    eventIds: [evSama.id],
    start: '2027-02-03T18:00',
    end: '2027-02-03T19:00',
    picId: 'person-taqiu',
    memberIds: ['person-gad', 'person-naufal'],
    position: 'vMix & Audio Master',
    location: 'Aula Asrama Putra',
    crewAssignments: [
      { position: 'vMix Switching', personId: 'person-taqiu' },
      { position: 'Audio Operator', personId: 'person-gad' },
      { position: 'Kamera Standby', personId: 'person-naufal' },
      { position: 'Koordinator Teknis', personId: 'person-zidnal' },
    ],
  };

  const ssSama2 = {
    ...make('session', 'ss-sama-2', "Siaran Utama Majelis Sama' Shahih Bukhari"),
    brief: 'Live streaming pembacaan kitab Hadits Shahih Bukhari bersama para Masyayikh & Kiai.',
    eventIds: [evSama.id],
    start: '2027-02-03T19:00',
    end: '2027-02-03T22:00',
    picId: 'person-naufal',
    memberIds: ['person-taqiu', 'person-farras', 'person-abyan', 'person-hasbi'],
    position: 'Kamera Utama (Close up Kiai)',
    location: 'Aula Asrama Putra',
    crewAssignments: [
      { position: 'Kamera Utama (Kiai)', personId: 'person-naufal' },
      { position: 'Kamera Wing Kanan', personId: 'person-farras' },
      { position: 'vMix & Streaming', personId: 'person-taqiu' },
      { position: 'Audio Master', personId: 'person-gad' },
      { position: 'Fotografi & Dokumentasi', personId: 'person-abyan' },
      { position: 'Live Report Instagram', personId: 'person-hasbi' },
      { position: 'Floor Director / PJ Sesi', personId: 'person-zidnal' },
    ],
  };

  const ssPuncak1 = {
    ...make('session', 'ss-puncak-1', 'Briefing Kru & Rehearsal Malam Puncak'),
    brief: 'Pengecekan akhir sinyal video outdoor, wireless intercom, dan cue rundown kiai.',
    eventIds: [evPuncak.id],
    start: '2027-02-07T16:00',
    end: '2027-02-07T18:00',
    picId: 'person-zidnal',
    memberIds: ['person-taqiu', 'person-naufal', 'person-gad'],
    position: 'Koordinator Produksi',
    location: 'Panggung Utama PPBS',
    crewAssignments: [
      { position: 'Koordinator Produksi', personId: 'person-zidnal' },
      { position: 'Lead Broadcast (vMix)', personId: 'person-taqiu' },
      { position: 'Lead Kameramen', personId: 'person-naufal' },
      { position: 'Lead Audio Sistem', personId: 'person-gad' },
    ],
  };

  const ssPuncak2 = {
    ...make('session', 'ss-puncak-2', 'Live Streaming Malam Puncak Haul PPBS'),
    brief: 'Siaran langsung multi-platform YouTube & Instagram malam puncak dan gema sholawat.',
    eventIds: [evPuncak.id],
    start: '2027-02-07T19:00',
    end: '2027-02-07T22:30',
    picId: 'person-taqiu',
    memberIds: ['person-naufal', 'person-farras', 'person-abyan', 'person-hasbi', 'person-farsya'],
    position: 'vMix Master Stream',
    location: 'Panggung Utama PPBS',
    crewAssignments: [
      { position: 'Kamera 1 (Panggung)', personId: 'person-naufal' },
      { position: 'Kamera 2 (Wing Jamaah)', personId: 'person-farras' },
      { position: 'Kamera 3 (Close Up Muballigh)', personId: 'person-farsya' },
      { position: 'vMix Video Switcher', personId: 'person-taqiu' },
      { position: 'Audio Mixing & Line Out', personId: 'person-gad' },
      { position: 'Fotografer Stage', personId: 'person-abyan' },
      { position: 'Live Report Story & Reels', personId: 'person-hasbi' },
      { position: 'Koordinator Lapangan', personId: 'person-zidnal' },
    ],
  };

  // ── KONTEN INSTAGRAM / SOSMED (SESUAI NOTION CALENDAR) ──
  const ctStory1 = {
    ...make('content', 'ct-story-1', 'Story Peringatan & Countdown Haul'),
    eventIds: [evUmum.id],
    projectId: prSosmed.id,
    picId: 'person-abyan',
    platform: 'Instagram',
    format: 'Instagram Story',
    end: '2027-02-02T10:00',
    publishAt: '2027-02-02T12:00',
    status: 'Selesai' as const,
  };

  const ctReelsSama = {
    ...make('content', 'ct-reels-sama', "Highlight Momen Khidmat Majelis Sama'"),
    eventIds: [evSama.id],
    projectId: prSosmed.id,
    picId: 'person-farras',
    platform: 'Instagram',
    format: 'Instagram Reels',
    end: '2027-02-04T10:00',
    publishAt: '2027-02-04T14:00',
    status: 'Dikerjakan' as const,
  };

  const ctFeedQuotes = {
    ...make('content', 'ct-feed-quotes', 'Quotes Abah: Keberkahan Silaturahmi'),
    eventIds: [evUmum.id],
    projectId: prSosmed.id,
    picId: 'person-farsya',
    platform: 'Instagram',
    format: 'Instagram Feed',
    end: '2027-02-05T09:00',
    publishAt: '2027-02-05T13:00',
    status: 'Review' as const,
  };

  const ctFeedYanbua = {
    ...make('content', 'ct-feed-yanbua', 'Mengenal Yanbu\'a, Tarikh & Sanad Keilmuan'),
    eventIds: [evUmum.id],
    projectId: prSosmed.id,
    picId: 'person-farsya',
    platform: 'Instagram',
    format: 'Instagram Feed',
    end: '2027-02-06T10:00',
    publishAt: '2027-02-06T13:00',
    status: 'Dikerjakan' as const,
  };

  const ctDocuReels = {
    ...make('content', 'ct-docu-reels', 'Progresif Documentary: Di Balik Layar Haul'),
    eventIds: [evPuncak.id],
    projectId: prVideo.id,
    picId: 'person-zaidan',
    platform: 'Instagram',
    format: 'Instagram Reels',
    end: '2027-02-07T14:00',
    publishAt: '2027-02-07T17:00',
    status: 'Rencana' as const,
  };

  // ── CATATAN & REMINDER ──
  const ntKiai = {
    ...make('note', 'nt-kiai', "Daftar Tamu Kiai dan Waktu Hadir Majelis Sama'"),
    eventIds: [evSama.id],
    brief: "Pembukaan: Nyai Hj. Nihayah Maksum, KH. Fu'ad Thohir, KH. Miftahul Akhyar, Gus Ka'zar.\nPenutupan: KH. Abdul Hakim Mahfudz (Gus Kikin), KH. Kholilul Karim, KH. Marzuki, KH. Ali Mastur.",
    pinned: true,
  };

  const ntTimInti = {
    ...make('note', 'nt-tim-inti', 'Struktur Tim Inti Haul & Harlah PPBS 2027'),
    eventIds: [evUmum.id],
    brief: "Hasbi: Tim Pusat Informasi\nBagas & Zidnal: Koordinator Layouter, Designer Logo & Master Design\nNizar & Zarkasi: Motion Graphic Designer\nZaidan & Izzur: Video Narasi / Syi'ir Harlah\nAlfa & Farsya & Mas Wil: Tim Promo\nMas Gad & Hamdan: Tim Technical",
    pinned: true,
  };

  return [
    evSama,
    evMaulid,
    evPuncak,
    evUmum,
    prSosmed,
    prAcara,
    prLayouter,
    prLive,
    prVideo,
    tkLogo,
    tkAnimasiLogo,
    tkFlyerRoadmap,
    tkTwibbon,
    tkFeedMalamPuncak,
    tkMicrosite,
    tkFlyerUtama,
    tkBumperPuncak,
    tkAnimasiBumper,
    tkNarasiPuncak,
    tkThumbnailAll,
    tkBannerSama,
    tkDenahVisual,
    tkIdCard,
    tkLinkForm,
    tkLaporanProgress,
    tkVideoOpening,
    ssSama1,
    ssSama2,
    ssPuncak1,
    ssPuncak2,
    ctStory1,
    ctReelsSama,
    ctFeedQuotes,
    ctFeedYanbua,
    ctDocuReels,
    ntKiai,
    ntTimInti,
  ];
}
