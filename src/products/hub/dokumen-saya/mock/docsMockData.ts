export type DocStatus =
  | 'Menunggu'
  | 'Disetujui'
  | 'Berlaku'
  | 'Revisi'
  | 'Ditolak'
  | 'Diarsipkan'
  | 'Dibatalkan'
  | 'Draft';

export interface DocStatusHistory {
  status: DocStatus;
  timestamp: string;
  actor?: string;
  note?: string;
}

export interface PtvDocument {
  id: string;
  no: string;
  subject: string;
  type: string;
  date: string;
  start_date?: string;
  end_date?: string;
  owner: string;
  pembawa?: string;
  penanggung_jawab?: string;
  diajukan_oleh?: string;
  recipients?: string[];
  santri_list?: Array<Record<string, unknown> | string>;
  metadata?: Record<string, unknown>;
  qr_token?: string;
  items?: string[];
  unit_ids?: string[];
  event?: string;
  event_id?: string;
  status: DocStatus;
  review_note?: string;
  status_history?: DocStatusHistory[];
  created_at: string;
  updated_at?: string;
  approved_at?: string;
}

export const INITIAL_DOCS_FIXTURES: PtvDocument[] = [
  {
    id: 'si_ff305b4f-0c0e-4abc-9da9-2556bdb1743c',
    no: '001/SI-PTV/X/2026',
    subject: 'Izin Sekolah - Relay Haul Solo',
    type: 'Surat Izin Santri',
    date: '2026-10-03',
    start_date: '2026-10-03',
    end_date: '2026-10-03',
    owner: 'Farras',
    pembawa: 'Farras',
    penanggung_jawab: 'Pimpinan Eksekutif PTV',
    diajukan_oleh: 'farras',
    recipients: ['Farras', 'Muhammad Farras Zaidan Mubarok'],
    items: [],
    status: 'Disetujui',
    created_at: '2026-10-03T07:15:00Z',
    approved_at: '2026-10-03T07:15:00Z',
    updated_at: '2026-10-03T07:15:00Z',
    status_history: [
      { status: 'Menunggu', timestamp: '2026-10-03T07:00:00Z', actor: 'Farras', note: 'Permohonan surat izin: Izin Sekolah - Relay Haul Solo' },
      { status: 'Disetujui', timestamp: '2026-10-03T07:15:00Z', actor: 'Pimpinan Eksekutif PTV', note: 'Surat izin disetujui dengan nomor resmi: 001/SI-PTV/X/2026' }
    ]
  },
  {
    id: 'st_99999999-0000-0000-0000-000000000001',
    no: '042/ST-PTV/X/2026',
    subject: 'Siaran Langsung Pengajian Akbar Maulid & Dokumentasi Multi-Kamera',
    type: 'Surat Tugas',
    date: '2026-10-12',
    start_date: '2026-10-12',
    end_date: '2026-10-13',
    owner: 'Muhammad Zidnal Falah',
    pembawa: 'Muhammad Zidnal Falah',
    penanggung_jawab: 'Dr. H. Ahmad Musthofa, M.Pd.',
    diajukan_oleh: 'zidnalfalah',
    recipients: ['Muhammad Zidnal Falah', 'Rizky Alamsyah', 'Dimas Prayoga'],
    items: ['Sony FX3 Cinema Line', 'DJI Mic 2 Dual', 'Blackmagic ATEM Mini Pro'],
    status: 'Disetujui',
    created_at: '2026-10-10T08:30:00Z',
    approved_at: '2026-10-10T09:00:00Z',
    updated_at: '2026-10-10T09:00:00Z',
    status_history: [
      { status: 'Menunggu', timestamp: '2026-10-10T08:30:00Z', actor: 'Muhammad Zidnal Falah', note: 'Pengajuan surat tugas siaran langsung maulid' },
      { status: 'Disetujui', timestamp: '2026-10-10T09:00:00Z', actor: 'Dr. H. Ahmad Musthofa, M.Pd.', note: 'Surat tugas disahkan nomor 042/ST-PTV/X/2026' }
    ]
  },
  {
    id: 'sbb_88888888-0000-0000-0000-000000000002',
    no: '015/SBB-PTV/X/2026',
    subject: 'Surat Bawa Barang: Siaran Outdoor Masjid Lebo Sidoarjo',
    type: 'Izin Membawa Barang',
    date: '2026-10-14',
    start_date: '2026-10-14',
    end_date: '2026-10-14',
    owner: 'Muhammad Zidnal Falah',
    pembawa: 'Muhammad Zidnal Falah',
    penanggung_jawab: 'Pimpinan Eksekutif PTV',
    diajukan_oleh: 'PTV-001',
    recipients: ['Muhammad Zidnal Falah'],
    items: ['Sony FX3 Cinema Line', 'Sony FE 24-70mm GM II', 'Tripod Libec TH-X'],
    status: 'Disetujui',
    created_at: '2026-10-14T06:45:00Z',
    approved_at: '2026-10-14T07:00:00Z',
    updated_at: '2026-10-14T07:00:00Z',
    status_history: [
      { status: 'Menunggu', timestamp: '2026-10-14T06:45:00Z', actor: 'Muhammad Zidnal Falah', note: 'Pengajuan izin membawa unit kamera dan tripod' },
      { status: 'Disetujui', timestamp: '2026-10-14T07:00:00Z', actor: 'Pimpinan Eksekutif PTV', note: 'Surat jalan disetujui nomor: 015/SBB-PTV/X/2026' }
    ]
  },
  {
    id: 'si_f491c12e-1311-477c-a7a5-da229a43a296',
    no: '007/SI-PTV/X/2026',
    subject: 'Dokuementasi Kedatangan Syekh Salim',
    type: 'Surat Izin Santri',
    date: '2026-10-15',
    start_date: '2026-10-15',
    end_date: '2026-10-15',
    owner: 'Farras',
    pembawa: 'Farras',
    penanggung_jawab: 'Pimpinan Redaksi PTV',
    diajukan_oleh: 'farras',
    recipients: ['Farras', 'Iyyaka'],
    items: [],
    status: 'Disetujui',
    created_at: '2026-10-15T09:30:00Z',
    approved_at: '2026-10-15T09:30:00Z',
    updated_at: '2026-10-15T09:30:00Z',
    status_history: [
      { status: 'Menunggu', timestamp: '2026-10-15T09:10:00Z', actor: 'Muhammad Farras Zaidan Mubarok', note: 'Permohonan surat izin: Dokuementasi Kedatangan Syekh Salim' },
      { status: 'Disetujui', timestamp: '2026-10-15T09:30:00Z', actor: 'Pimpinan Redaksi PTV', note: 'Surat izin disetujui dengan nomor resmi: 007/SI-PTV/X/2026' }
    ]
  }
];

