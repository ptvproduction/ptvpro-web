import { DamageReportItem } from './types';

export const INITIAL_DAMAGE_REPORT_FIXTURES: DamageReportItem[] = [
  {
    "id": "dmg-001",
    "assetId": "inv-001",
    "assetName": "Sony FX3 Cinema Line Full-Frame Camera",
    "assetCategory": "Kamera",
    "unitNumber": 2,
    "unitCode": "INV-001-U02",
    "title": "Layar LCD Flip Berkedip (Flicker) Saat Merekam 4K 60p",
    "description": "Ketika merekam dalam format 4K 10-bit lebih dari 15 menit, layar monitor flip sesekali berkedip hitam dan engsel terasa agak longgar.",
    "severity": "Sedang",
    "reporterName": "Danang Videografer",
    "reporterContact": "6281234567891",
    "reportedAt": "2026-10-15T16:20:00Z",
    "photoUrl": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400' fill='none'><rect width='600' height='400' rx='16' fill='%230F172A'/><rect x='50' y='40' width='500' height='320' rx='12' fill='%231E293B' stroke='%23334155' stroke-width='4'/><rect x='70' y='60' width='460' height='280' rx='6' fill='%230A0F1D'/><line x1='70' y1='153' x2='530' y2='153' stroke='%231E293B' stroke-width='1' stroke-dasharray='4 4'/><line x1='70' y1='246' x2='530' y2='246' stroke='%231E293B' stroke-width='1' stroke-dasharray='4 4'/><line x1='223' y1='60' x2='223' y2='340' stroke='%231E293B' stroke-width='1' stroke-dasharray='4 4'/><line x1='376' y1='60' x2='376' y2='340' stroke='%231E293B' stroke-width='1' stroke-dasharray='4 4'/><rect x='70' y='130' width='460' height='18' fill='%23EF4444' fill-opacity='0.35'/><rect x='70' y='190' width='460' height='8' fill='%233B82F6' fill-opacity='0.4'/><rect x='70' y='270' width='460' height='14' fill='%23EF4444' fill-opacity='0.25'/><text x='90' y='95' fill='%23EF4444' font-family='monospace' font-size='13' font-weight='bold'>● REC 4K 60p 10-bit [FLICKER DETECTED]</text><text x='90' y='325' fill='%2394A3B8' font-family='monospace' font-size='12'>ISO 12800 • 1/120 • F2.8 • UNIT: INV-001-U02</text><text x='440' y='95' fill='%23F59E0B' font-family='monospace' font-size='12'>BAT: 74%</text></svg>",
    "status": "Sedang Dicek",
    "qcBy": "Farid Technical",
    "qcDate": "2026-10-16",
    "qcNotes": "Pemeriksaan kabel fleksibel display. Perlu kalibrasi konektor atau servis resmi Sony Pro.",
    "qcLocked": false,
    "isCurrentUser": false
  },
  {
    "id": "dmg-002",
    "assetId": "inv-002",
    "assetName": "Sony FE 24-70mm f/2.8 GM II Lens",
    "assetCategory": "Lensa",
    "unitNumber": 1,
    "unitCode": "INV-002-U01",
    "title": "Ring Fokus Manual Agak Macet di Rentang 50-70mm",
    "description": "Ring fokus terasa berat dan ada suara gesekan halus saat diputar mendekati infinity. Autofokus masih berfungsi normal.",
    "severity": "Sedang",
    "reporterName": "Roup",
    "reporterContact": "6281298765432",
    "reportedAt": "2026-10-16T11:00:00Z",
    "status": "Baru",
    "qcLocked": false,
    "isCurrentUser": true
  },
  {
    "id": "dmg-003",
    "assetId": "inv-004",
    "assetName": "Rode Wireless GO II Dual Channel Microphone System",
    "assetCategory": "Audio",
    "unitNumber": 2,
    "unitCode": "INV-004-U02",
    "title": "Baterai Transmitter TX 2 Drop Cepat (Hanya Tahan 20 Menit)",
    "description": "Setelah di-charge penuh 100%, baterai unit transmitter nomor 2 langsung turun ke 1 bar dalam waktu 20 menit saat talkshow santri.",
    "severity": "Berat",
    "reporterName": "M. Rizqi S.",
    "reporterContact": "6281567890123",
    "reportedAt": "2026-10-14T14:10:00Z",
    "status": "Dalam Perbaikan",
    "qcBy": "Farid Technical",
    "qcDate": "2026-10-15",
    "qcNotes": "Unit baterai lithium internal aus. Sedang diproses penggantian modul baterai cadangan.",
    "qcLocked": false,
    "isCurrentUser": false
  },
  {
    "id": "dmg-004",
    "assetId": "inv-005",
    "assetName": "Aputure Amaran 200d LED Video Light Kit",
    "assetCategory": "Lighting",
    "unitNumber": 1,
    "unitCode": "INV-005-U01",
    "title": "Kipas Pendingin Head Lamp Berbunyi Kasar",
    "description": "Saat dinyalakan pada intensitas 80% ke atas, kipas internal lampu mengeluarkan bunyi desing kasar yang bocor ke mikrofon clip-on.",
    "severity": "Ringan",
    "reporterName": "Farid Technical",
    "reporterContact": "6281345678901",
    "reportedAt": "2026-10-11T13:00:00Z",
    "status": "Selesai",
    "qcBy": "Ahmad Executive",
    "qcDate": "2026-10-13",
    "qcNotes": "Pembersihan bilah kipas dari debu studio dan pelumasan bearing. Lampu telah diuji 2 jam nonstop, suara hening normal.",
    "qcLocked": true,
    "isCurrentUser": false
  },
  {
    "id": "dmg-005",
    "assetId": "inv-003",
    "assetName": "Blackmagic Design ATEM Mini Pro ISO Switcher",
    "assetCategory": "Streaming",
    "unitNumber": 1,
    "unitCode": "INV-003-U01",
    "title": "Port HDMI Output 1 Kadang Kehilangan Sinyal",
    "description": "Konektor HDMI out utama agak longgar jika kabel tersenggol sedikit. Sudah diatasi dengan kabel pengunci bracket.",
    "severity": "Ringan",
    "reporterName": "Zidna Santri",
    "reporterContact": "6281123456789",
    "reportedAt": "2026-10-09T10:00:00Z",
    "status": "Selesai",
    "qcBy": "Farid Technical",
    "qcDate": "2026-10-10",
    "qcNotes": "Pemasangan HDMI clamp bracket permanen pada rig switcher. Output sinyal stabil 1080p60.",
    "qcLocked": true,
    "isCurrentUser": false
  }
];

export interface StudioAssetOption {
  id: string;
  name: string;
  category: string;
  code: string;
  units: { unitNumber: number; unitCode: string }[];
}

export const AVAILABLE_STUDIO_ASSETS: StudioAssetOption[] = [
  {
    id: "inv-001",
    name: "Sony FX3 Cinema Line Full-Frame Camera",
    category: "Kamera",
    code: "INV-001",
    units: [
      { unitNumber: 1, unitCode: "INV-001-U01" },
      { unitNumber: 2, unitCode: "INV-001-U02" },
    ],
  },
  {
    id: "inv-002",
    name: "Sony FE 24-70mm f/2.8 GM II Lens",
    category: "Lensa",
    code: "INV-002",
    units: [
      { unitNumber: 1, unitCode: "INV-002-U01" },
      { unitNumber: 2, unitCode: "INV-002-U02" },
    ],
  },
  {
    id: "inv-003",
    name: "Blackmagic Design ATEM Mini Pro ISO Switcher",
    category: "Streaming",
    code: "INV-003",
    units: [{ unitNumber: 1, unitCode: "INV-003-U01" }],
  },
  {
    id: "inv-004",
    name: "Rode Wireless GO II Dual Channel Microphone System",
    category: "Audio",
    code: "INV-004",
    units: [
      { unitNumber: 1, unitCode: "INV-004-U01" },
      { unitNumber: 2, unitCode: "INV-004-U02" },
    ],
  },
  {
    id: "inv-005",
    name: "Aputure Amaran 200d LED Video Light Kit",
    category: "Lighting",
    code: "INV-005",
    units: [
      { unitNumber: 1, unitCode: "INV-005-U01" },
      { unitNumber: 2, unitCode: "INV-005-U02" },
    ],
  },
];
