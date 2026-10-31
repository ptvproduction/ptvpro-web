import {
  CategoryConfig,
  FeaturedHighlight,
  LocalizedString,
  PortalAnnouncement,
  PortalService,
  ServiceAccessType,
  ServiceStatus,
  WhatsAppTopicOption,
} from '../types';

export const L = (id: string, en: string): LocalizedString => ({ id, en });

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, LocalizedString> = {
  ok: L('Normal', 'Normal'),
  incident: L('Gangguan', 'Disruption'),
  maint: L('Maintenance', 'Maintenance'),
  soon: L('Segera Hadir', 'Coming Soon'),
};

export const SERVICE_ACCESS_LABELS: Record<ServiceAccessType, LocalizedString> = {
  own: L('Akses diatur layanan', 'Access set by service'),
  login: L('Login di layanan', 'Sign in on the service'),
  crew: L('Khusus kru Progresif TV', 'Progresif TV crew only'),
  open: L('Terbuka untuk umum', 'Open to the public'),
};

export const SERVICE_NOTES: Partial<Record<ServiceStatus, LocalizedString>> = {
  incident: L(
    'Sebagian pengguna mengalami kesulitan membuka layanan. Tim teknis sedang menangani.',
    'Some users have trouble opening this service. The technical team is investigating.'
  ),
  maint: L(
    'Sedang pemeliharaan terjadwal. Layanan akan segera kembali.',
    'Scheduled maintenance in progress. The service will be back soon.'
  ),
};

export const PORTAL_CATEGORIES: CategoryConfig[] = [
  {
    id: 'yayasan',
    n: L('Layanan Keluarga Yayasan', 'Foundation Family Services'),
    d: L('Untuk anggota komunitas yayasan.', 'For members of the foundation community.'),
  },
  {
    id: 'ptv',
    n: L('Layanan Progresif TV', 'Progresif TV Services'),
    d: L('Alat kerja kru dan verifikasi untuk publik.', 'Crew tools and public verification.'),
  },
  {
    id: 'season',
    n: L('Layanan Musiman', 'Seasonal Services'),
    d: L('Layanan sementara untuk acara tertentu.', 'Temporary services for special events.'),
  },
];

export const INITIAL_SERVICES: PortalService[] = [
  {
    id: 'aset',
    cat: 'yayasan',
    ic: 'archive',
    st: 'soon',
    ac: 'own',
    pub: 1,
    n: L('Aset Yayasan', 'Foundation Assets'),
    d: L(
      'Akses dan pengelolaan aset digital yayasan yang dipilih. Pembatasan akses diatur di dalam layanan.',
      'Access and management of selected foundation digital assets. Restricted access is handled inside the service.'
    ),
  },
  {
    id: 'short',
    cat: 'yayasan',
    ic: 'link',
    st: 'ok',
    ac: 'login',
    pub: 1,
    url: 'https://bsh.bio',
    isExternal: true,
    n: L('Shortlink Management', 'Shortlink Management'),
    d: L(
      'Kelola tautan pendek resmi lewat bsh.bio. Autentikasi dilakukan terpisah.',
      'Manage official short links through bsh.bio. Authentication is handled separately.'
    ),
  },
  {
    id: 'hub',
    cat: 'ptv',
    ic: 'grid',
    st: 'ok',
    ac: 'crew',
    hub: true,
    pub: 1,
    url: '/hub',
    isExternal: false,
    n: L('PTV Hub', 'PTV Hub'),
    d: L(
      'Ruang kerja internal untuk kru dan supervisor Progresif TV: inventaris, peminjaman alat, perizinan, administrasi kru, dan alat operasional.',
      'Internal workspace for Progresif TV crew and supervisors: inventory, equipment borrowing, permits, crew administration, and operational tools.'
    ),
  },
  {
    id: 'idv',
    cat: 'ptv',
    ic: 'qr',
    st: 'ok',
    ac: 'open',
    pub: 1,
    url: '/verifikasi-identitas',
    isExternal: false,
    n: L('Verifikasi Identitas', 'Identity Verification'),
    d: L(
      'Cek keaslian identitas kru Progresif TV, termasuk validasi lewat kode QR.',
      'Check the authenticity of Progresif TV crew identities, including QR code validation.'
    ),
  },
  {
    id: 'ltr',
    cat: 'ptv',
    ic: 'doc',
    st: 'ok',
    ac: 'open',
    pub: 1,
    url: '/verifikasi-surat',
    isExternal: false,
    n: L('Keabsahan Dokumen', 'Document Verification'),
    d: L(
      'Cek keaslian surat izin dan dokumen resmi yang diterbitkan lewat Progresif TV.',
      'Check the authenticity of permits and official documents issued through Progresif TV.'
    ),
  },
  {
    id: 'maj',
    cat: 'season',
    ic: 'cal',
    st: 'soon',
    ac: 'open',
    pub: 1,
    seasonal: true,
    seasonalActive: true,
    n: L('Registrasi Majelis Sama\u2019', 'Majelis Sama\u2019 Registration'),
    d: L(
      'Pendaftaran khusus acara, tersedia selama periode Haul & Harlah.',
      'Event-specific registration, available during the Haul & Harlah period.'
    ),
  },
];

export const FEATURED_HIGHLIGHTS: FeaturedHighlight[] = [
  {
    svc: 'maj',
    b: L('Layanan musiman', 'Seasonal service'),
    p: L('Periode Haul & Harlah', 'Haul & Harlah period'),
    d: L(
      'Pendaftaran khusus acara. Bukan layanan tetap yayasan.',
      'Event-specific registration. Not a permanent foundation service.'
    ),
    c: L('Lihat jadwal & info', 'View schedule & info'),
  },
  {
    svc: 'idv',
    b: L('Verifikasi publik', 'Public verification'),
    d: L(
      'Pindai kode QR pada ID kru untuk memastikan keasliannya.',
      'Scan the QR code on a crew ID to confirm it is genuine.'
    ),
    c: L('Cek identitas', 'Check identity'),
  },
  {
    svc: 'ltr',
    b: L('Verifikasi publik', 'Public verification'),
    d: L(
      'Pastikan surat izin dan dokumen resmi benar diterbitkan lewat Progresif TV.',
      'Make sure permits and official documents were really issued through Progresif TV.'
    ),
    c: L('Cek surat', 'Check document'),
  },
];

export const DEFAULT_ANNOUNCEMENT: PortalAnnouncement = {
  id: 'ann-ptvpro-portal-launch',
  format: 'both',
  title: L('Selamat Datang di Portal Layanan PTVPRO', 'Welcome to PTVPRO Service Portal'),
  body: L(
    'Satu pintu gerbang resmi menuju sistem internal produksi kru Progresif TV, verifikasi dokumen publik, dan layanan digital keluarga yayasan.',
    'One official gateway to Progresif TV crew internal production systems, public document verification, and foundation family digital services.'
  ),
  ctaText: L('Lihat Layanan', 'View Services'),
  posterSrc:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#1749C0"/><rect x="40" y="40" width="720" height="920" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/><text x="80" y="140" fill="#fff" fill-opacity=".8" font-family="Arial,sans-serif" font-size="30">PTVPRO</text><text x="80" y="760" fill="#fff" font-family="Arial,sans-serif" font-size="110" font-weight="700">PORTAL</text><text x="80" y="870" fill="#fff" font-family="Arial,sans-serif" font-size="110" font-weight="700">RESMI</text><text x="80" y="930" fill="#fff" fill-opacity=".8" font-family="Arial,sans-serif" font-size="28">Satu Pintu Layanan Digital</text></svg>'
    ),
  active: true,
};

export const WHATSAPP_TOPICS: WhatsAppTopicOption[] = [
  { id: 0, label: L('Website error', 'Website error') },
  { id: 1, label: L('Link tidak berfungsi', 'Broken link') },
  { id: 2, label: L('Masalah akses', 'Access problem') },
  { id: 3, label: L('Lainnya', 'Other') },
];

export const PORTAL_UI_STRINGS = {
  skip: L('Langsung ke layanan', 'Skip to services'),
  nav: L('Navigasi utama', 'Main navigation'),
  svc: L('Layanan', 'Services'),
  status: L('Status', 'Status'),
  statusLink: L('Status Layanan', 'Service Status'),
  h1: L('Layanan digital Progresif TV.', 'Progresif TV digital services.'),
  sub: L(
    'Satu pintu menuju alat produksi internal dan layanan pilihan untuk keluarga yayasan.',
    'One gateway to internal production tools and selected services for the foundation family.'
  ),
  note: L(
    'Tidak ada login di halaman ini. Setiap layanan mengatur akses masuknya sendiri.',
    'There is no login on this page. Each service manages its own access.'
  ),
  ph: L('Cari layanan', 'Search services'),
  catNav: L('Kategori layanan', 'Service categories'),
  carL: L('Layanan unggulan', 'Featured services'),
  prev: L('Sebelumnya', 'Previous'),
  next: L('Berikutnya', 'Next'),
  emT: L('Tidak ada layanan yang cocok', 'No matching services'),
  emD: L('Coba kata kunci lain atau hapus pencarian.', 'Try another keyword or clear the search.'),
  clr: L('Hapus pencarian', 'Clear search'),
  back: L('Kembali ke portal', 'Back to portal'),
  stLead: L('Kondisi layanan publik PTVPRO saat ini.', 'Current condition of PTVPRO public services.'),
  allOk: L('Semua layanan berjalan normal.', 'All services are running normally.'),
  issues: (n: number) =>
    L(
      `${n} layanan mengalami gangguan atau pemeliharaan.`,
      `${n} service(s) disrupted or under maintenance.`
    ),
  soonInfo: L(
    'Layanan ini masih dalam pengembangan atau penjadwalan khusus dan belum dapat dibuka.',
    'This service is still in development or special scheduling and cannot be opened yet.'
  ),
  mT: L('Portal sedang dalam pemeliharaan', 'The portal is under maintenance'),
  mD: L(
    'Kami sedang melakukan pembaruan sistem. Silakan kembali beberapa saat lagi.',
    'We are updating system features. Please check back shortly.'
  ),
  mHub: L(
    'Kru Progresif TV tetap dapat mengakses PTV Hub langsung melalui rute khusus /hub.',
    'Progresif TV crew can still reach PTV Hub directly through the /hub route.'
  ),
  mHubB: L('Buka PTV Hub', 'Open PTV Hub'),
  close: L('Tutup', 'Close'),
  posterAlt: L('Poster pengumuman resmi PTVPRO', 'Official PTVPRO announcement poster'),
  waT: L('Butuh bantuan?', 'Need help?'),
  waD: L(
    'Pilih topik, lalu kami siapkan pesan bantuan WhatsApp untuk Anda.',
    'Pick a topic, and we will prepare a WhatsApp help message for you.'
  ),
  waPrev: L('Pratinjau pesan', 'Message preview'),
  waSend: L('Buka WhatsApp Bantuan', 'Open WhatsApp Help'),
  waUnconfigured: L(
    'Kontak resmi WhatsApp helpdesk sedang dalam tahap konfigurasi operator.',
    'Official WhatsApp helpdesk contact is currently being configured by the operator.'
  ),
  msg: (topic: string, page: string) =>
    L(
      `Assalamu'alaikum, saya ingin bertanya mengenai layanan PTVPRO.\n(Topik: ${topic} — Halaman: ${page})`,
      `Hello, I would like to inquire about PTVPRO digital services.\n(Topic: ${topic} — Page: ${page})`
    ),
};
