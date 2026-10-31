/**
 * Tipe data resmi modul Catatan Bersama & Notulensi Rapat
 * Porting 1:1 dari PHP Legacy (page-dasbor.php L16959+)
 */

export type NoteCategoryKey = 'orange' | 'yellow' | 'green' | 'purple' | 'rose';

export interface NoteCategoryDef {
  key: NoteCategoryKey;
  name: string;
  example: string;
  label: string;
  short: string;
  bg: string;
  text: string;
  body: string;
  meta: string;
  pillBg: string;
  pillText: string;
  border: string;
  dot: string;
  icon: string;
}

export const NOTE_CATEGORIES: Record<NoteCategoryKey, NoteCategoryDef> = {
  orange: {
    key: 'orange',
    name: 'Buñol',
    example: 'Urgent, Deadline, SOP Wajib, Fatal Error',
    label: 'Penting & Prioritas',
    short: 'Penting',
    bg: '#F46E56',
    text: '#FFFFFF',
    body: 'rgba(255, 255, 255, 0.94)',
    meta: 'rgba(255, 255, 255, 0.78)',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#FFFFFF',
    border: '#E05A42',
    dot: '#F46E56',
    icon: 'fa-triangle-exclamation'
  },
  yellow: {
    key: 'yellow',
    name: 'Bagan',
    example: 'Konsep Konten, Brainstorming, Strategi',
    label: 'Ide & Rencana',
    short: 'Ide',
    bg: '#FDE3BC',
    text: '#93530E',
    body: '#A35E12',
    meta: '#B56F1F',
    pillBg: 'rgba(147, 83, 14, 0.12)',
    pillText: '#93530E',
    border: '#E8CA9B',
    dot: '#E5A84D',
    icon: 'fa-lightbulb'
  },
  green: {
    key: 'green',
    name: 'Sagano',
    example: 'Broadcast Kru, Jadwal Libur, Update Kebijakan',
    label: 'Info & Pengumuman',
    short: 'Info',
    bg: '#D4F1ED',
    text: '#0A635D',
    body: '#0D7A73',
    meta: '#178C84',
    pillBg: 'rgba(10, 99, 93, 0.12)',
    pillText: '#0A635D',
    border: '#B2E2DB',
    dot: '#2CB6A8',
    icon: 'fa-bullhorn'
  },
  purple: {
    key: 'purple',
    name: 'Valensole',
    example: 'Liputan Event, Rundown Kajian, Haflah',
    label: 'Agenda & Acara',
    short: 'Agenda',
    bg: '#9489BD',
    text: '#FFFFFF',
    body: 'rgba(255, 255, 255, 0.94)',
    meta: 'rgba(255, 255, 255, 0.78)',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#FFFFFF',
    border: '#7D71A8',
    dot: '#9489BD',
    icon: 'fa-calendar-day'
  },
  rose: {
    key: 'rose',
    name: 'Nara',
    example: 'Checklist Alat, Penugasan Operator, PIC',
    label: 'Tugas & Rundown',
    short: 'Tugas',
    bg: '#FCE0DC',
    text: '#A5372D',
    body: '#B8473C',
    meta: '#C7574B',
    pillBg: 'rgba(165, 55, 45, 0.12)',
    pillText: '#A5372D',
    border: '#F0C2BC',
    dot: '#E57368',
    icon: 'fa-list-check'
  }
};

export type NoteType = 'shared' | 'meeting_minutes';

export interface MeetingMeta {
  date?: string;
  time?: string;
  loc?: string;
  att?: string;
  event_id?: string;
  event_name?: string;
}

export interface NoteItem {
  id: string;
  tipe: NoteType;
  judul: string;
  isi: string;
  warna: NoteCategoryKey;
  tags: string[];
  is_pinned: boolean;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  meeting_meta?: MeetingMeta;
}

export type NoteTypeFilter = 'shared' | 'meeting_minutes' | 'semua';
export type NoteCategoryFilter = 'semua' | 'pinned' | NoteCategoryKey;
