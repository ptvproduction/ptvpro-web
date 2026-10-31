import { LostFoundItem } from './types';

// Helper pembuat visual SVG mock yang tajam, ringan, dan tidak bergantung koneksi eksternal
const createMockSvgUrl = (bgGradient: string, iconMarkup: string, label: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        ${bgGradient}
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#g)" rx="16" />
    <g transform="translate(200, 130)" text-anchor="middle">
      ${iconMarkup}
    </g>
    <rect x="40" y="235" width="320" height="36" rx="18" fill="rgba(0,0,0,0.35)" />
    <text x="200" y="258" fill="#ffffff" font-family="-apple-system, SF Pro Display, Segoe UI, sans-serif" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="0.5">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const PHOTO_LENS_CAP = createMockSvgUrl(
  '<stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/>',
  `<circle r="60" fill="#334155" stroke="#64748b" stroke-width="4"/>
   <circle r="46" fill="#1e293b" stroke="#475569" stroke-width="2"/>
   <text y="5" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="16" font-weight="bold">SONY</text>
   <text y="24" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="10">Ø 67 mm</text>`,
  'Tutup Lensa Sony ALC-F67S'
);

const PHOTO_ID_CARD = createMockSvgUrl(
  '<stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/>',
  `<rect x="-42" y="-58" width="84" height="116" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
   <rect x="-42" y="-58" width="84" height="30" rx="6" fill="#0B5FBF"/>
   <text y="-38" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="10" font-weight="bold">PTV PRO</text>
   <circle cx="0" cy="-6" r="14" fill="#e2e8f0"/>
   <rect x="-24" y="14" width="48" height="6" rx="3" fill="#64748b"/>
   <rect x="-16" y="24" width="32" height="4" rx="2" fill="#94a3b8"/>
   <path d="M-12 -58 L-12 -80 L12 -80 L12 -58" fill="none" stroke="#38bdf8" stroke-width="4"/>`,
  'ID Card Kru & Lanyard'
);

const PHOTO_PLATE_TRIPOD = createMockSvgUrl(
  '<stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/>',
  `<rect x="-50" y="-45" width="100" height="90" rx="8" fill="#475569" stroke="#94a3b8" stroke-width="3"/>
   <rect x="-40" y="-35" width="80" height="70" rx="4" fill="#1e293b"/>
   <circle r="12" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
   <rect x="-2" y="-8" width="4" height="16" fill="#78350f"/>
   <text y="24" fill="#cbd5e1" font-family="-apple-system, sans-serif" font-size="9" font-weight="bold">MANFROTTO 200PL</text>`,
  'Quick Release Plate 200PL'
);

const PHOTO_HOODIE = createMockSvgUrl(
  '<stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/>',
  `<path d="M-50,40 L-40,-20 L-20,-45 L20,-45 L40,-20 L50,40 Z" fill="#27272a" stroke="#52525b" stroke-width="3"/>
   <path d="M-15,-45 C-15,-60 15,-60 15,-45 Z" fill="#3f3f46"/>
   <rect x="-10" y="-10" width="20" height="10" rx="2" fill="#ef4444"/>
   <rect x="-10" y="-5" width="20" height="5" rx="1" fill="#ffffff"/>
   <text y="20" fill="#a1a1aa" font-family="-apple-system, sans-serif" font-size="9">HOODIE SANTRI (L)</text>`,
  'Jaket Hoodie Kru Santri'
);

const PHOTO_CONVERTER = createMockSvgUrl(
  '<stop offset="0%" stop-color="#047857"/><stop offset="100%" stop-color="#064e3b"/>',
  `<rect x="-45" y="-30" width="90" height="60" rx="8" fill="#065f46" stroke="#34d399" stroke-width="2"/>
   <circle cx="-30" cy="0" r="8" fill="#fbbf24"/>
   <rect x="25" y="-10" width="16" height="20" rx="3" fill="#94a3b8"/>
   <text y="4" fill="#ecfdf5" font-family="-apple-system, sans-serif" font-size="10" font-weight="bold">HDMI to SDI</text>`,
  'Converter Micro HDMI - SDI'
);

const PHOTO_GLASSES = createMockSvgUrl(
  '<stop offset="0%" stop-color="#3b0764"/><stop offset="100%" stop-color="#1e1b4b"/>',
  `<circle cx="-30" cy="0" r="24" fill="rgba(56, 189, 248, 0.2)" stroke="#1e293b" stroke-width="5"/>
   <circle cx="30" cy="0" r="24" fill="rgba(56, 189, 248, 0.2)" stroke="#1e293b" stroke-width="5"/>
   <path d="M-6,-2 Q0,-10 6,-2" fill="none" stroke="#1e293b" stroke-width="4"/>
   <path d="M-54,0 L-70,-10" fill="none" stroke="#1e293b" stroke-width="4"/>
   <path d="M54,0 L70,-10" fill="none" stroke="#1e293b" stroke-width="4"/>`,
  'Kacamata Frame Owndays'
);

export const INITIAL_LOST_FOUND_FIXTURES: LostFoundItem[] = [
  {
    id: "lf-001",
    type: "hilang",
    title: "Tutup Lensa Depan Sony 67mm ALC-F67S",
    category: "Aksesori Kamera",
    location: "Studio Utama PTV (Meja Switcher)",
    date: "2026-10-15",
    description: "Tutup lensa Sony original diameter 67mm dengan logo timbul.",
    photoUrl: PHOTO_LENS_CAP,
    reporterName: "Danang Videografer",
    reporterContact: "6281234567891",
    status: "Dicari",
    createdAt: "2026-10-15T14:30:00Z",
    isCurrentUser: false,
  },
  {
    id: "lf-002",
    type: "hilang",
    title: "ID Card Kru & Tali Lanyard Hitam PTV Pro",
    category: "Perlengkapan Kru",
    location: "Area Parkir Multimedia",
    date: "2026-10-16",
    description: "ID Card atas nama Roup nomor PTV-OP-042.",
    photoUrl: PHOTO_ID_CARD,
    reporterName: "Roup",
    reporterContact: "6281298765432",
    status: "Dicari",
    createdAt: "2026-10-16T09:15:00Z",
    isCurrentUser: true,
  },
  {
    id: "lf-003",
    type: "temuan",
    title: "Quick Release Plate Tripod Manfrotto 200PL",
    category: "Aksesori Tripod",
    location: "Ruang Redaksi PTV",
    date: "2026-10-14",
    description: "Plate tripod bahan metal abu-abu baut 1/4 inci.",
    photoUrl: PHOTO_PLATE_TRIPOD,
    reporterName: "Farid Technical",
    reporterContact: "6281345678901",
    status: "Ditemukan",
    createdAt: "2026-10-14T17:00:00Z",
    isCurrentUser: false,
  },
  {
    id: "lf-004",
    type: "temuan",
    title: "Jaket Hoodie Hitam Kru Santri (Size L)",
    category: "Pakaian",
    location: "Sofa Depan Editing Video",
    date: "2026-10-13",
    description: "Jaket parasut hitam polos bordir bendera merah putih.",
    photoUrl: PHOTO_HOODIE,
    reporterName: "Zidna Santri",
    reporterContact: "6281123456789",
    status: "Ditemukan",
    createdAt: "2026-10-13T11:20:00Z",
    isCurrentUser: false,
  },
  {
    id: "lf-005",
    type: "hilang",
    title: "Kabel Converter USB-C to 3.5mm Headphone Jack",
    category: "Kabel & Audio",
    location: "Meja Operator Audio Studio",
    date: "2026-10-12",
    description: "Adaptor Apple putih dengan selotip biru di pangkal.",
    photoUrl: PHOTO_CONVERTER,
    reporterName: "M. Rizqi S.",
    reporterContact: "6281567890123",
    status: "Dikembalikan",
    createdAt: "2026-10-12T10:00:00Z",
    resolvedAt: "2026-10-14T15:30:00Z",
    resolvedBy: "Farid Technical",
    isCurrentUser: false,
  },
  {
    id: "lf-006",
    type: "temuan",
    title: "Kacamata Frame Hitam Doff Owndays",
    category: "Barang Pribadi",
    location: "Balkon Studio Rekaman",
    date: "2026-10-11",
    description: "Kacamata baca frame kotak hitam doff dalam case abu-abu.",
    photoUrl: PHOTO_GLASSES,
    reporterName: "Ahmad Executive",
    reporterContact: "6281789012345",
    status: "Dikembalikan",
    createdAt: "2026-10-11T16:45:00Z",
    resolvedAt: "2026-10-12T09:00:00Z",
    resolvedBy: "Ahmad Executive",
    isCurrentUser: false,
  },
];
