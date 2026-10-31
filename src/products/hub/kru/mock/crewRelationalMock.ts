import { CrewActiveLoan, CrewEventHistory, CrewDocumentHistory } from '../types';

export const CREW_ACTIVE_LOANS_MOCK: Record<string, CrewActiveLoan[]> = {
  'crw-001': [
    {
      id: 'loan-01',
      itemName: 'Sony FX3 Cinema Line',
      unitCode: 'CAM-01-U01',
      unitDisplayName: 'Unit 01',
      outDate: '2026-10-15',
      dueDate: '2026-10-18',
      purpose: 'Liputan Live Streaming Pengajian Akbar',
    },
    {
      id: 'loan-02',
      itemName: 'DJI Mic 2 Dual Transmitter',
      unitCode: 'MIC-02-U01',
      unitDisplayName: 'Set A',
      outDate: '2026-10-15',
      dueDate: '2026-10-18',
      purpose: 'Audio Liputan Dokumentasi',
    },
  ],
  'crw-003': [
    {
      id: 'loan-03',
      itemName: 'Sony Alpha 7 IV',
      unitCode: 'CAM-02-U01',
      unitDisplayName: 'Unit 01',
      outDate: '2026-10-16',
      dueDate: '2026-10-19',
      purpose: 'Dokumentasi Haul Majelis',
    },
  ],
};

export const CREW_EVENT_HISTORY_MOCK: Record<string, CrewEventHistory[]> = {
  'crw-001': [
    {
      id: 'ev-01',
      name: 'Siaran Langsung Pengajian Akbar Maulid',
      date: '2026-10-12',
      location: 'Masjid Agung Al-Ikhlas',
      status: 'Selesai',
    },
    {
      id: 'ev-02',
      name: 'Liputan Khusus Wisuda Santri Angkatan X',
      date: '2026-10-08',
      location: 'Auditorium Progresif',
      status: 'Selesai',
    },
    {
      id: 'ev-03',
      name: 'Live Streaming Kajian Rutin Ahad Pagi',
      date: '2026-10-20',
      location: 'Studio Utama PTV',
      status: 'Terjadwal',
    },
  ],
  'crw-002': [
    {
      id: 'ev-02',
      name: 'Liputan Khusus Wisuda Santri Angkatan X',
      date: '2026-10-08',
      location: 'Auditorium Progresif',
      status: 'Selesai',
    },
  ],
  'crw-003': [
    {
      id: 'ev-01',
      name: 'Siaran Langsung Pengajian Akbar Maulid',
      date: '2026-10-12',
      location: 'Masjid Agung Al-Ikhlas',
      status: 'Selesai',
    },
  ],
};

export const CREW_DOCUMENT_HISTORY_MOCK: Record<string, CrewDocumentHistory[]> = {
  'crw-001': [
    {
      id: 'doc-01',
      no: '042/ST-PTV/X/2026',
      subject: 'Surat Tugas Siaran Langsung Pengajian Akbar',
      type: 'Surat Tugas Resmi',
      date: '2026-10-10',
      owner: 'M. Zidna Ilma Roup',
    },
    {
      id: 'doc-02',
      no: '038/SI-PTV/IX/2026',
      subject: 'Surat Izin Dispensasi Produksi Luar Kota',
      type: 'Surat Izin Santri',
      date: '2026-09-28',
      owner: 'M. Zidna Ilma Roup',
    },
  ],
  'crw-003': [
    {
      id: 'doc-01',
      no: '042/ST-PTV/X/2026',
      subject: 'Surat Tugas Siaran Langsung Pengajian Akbar',
      type: 'Surat Tugas Resmi',
      date: '2026-10-10',
      owner: 'M. Zidna Ilma Roup',
    },
  ],
};
