export type CalendarLayer = 'ptv' | 'pesantren' | 'sekolah';

export interface HijriInfo {
  day: number;
  month: number;
  monthName: string;
  year: number;
  full: string;
  short: string;
}

export interface WetonInfo {
  day: string;
  pasaran: string;
  full: string;
}

export interface CalendarDayCell {
  dayNumber: number;
  isOutOfMonth: boolean;
  isoDate: string;
  hijri: HijriInfo;
  weton: WetonInfo;
  hasEvent: boolean;
  hasPlanner: boolean;
  hasBoth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events?: CalendarEvent[];
  planners?: ContentPlannerItem[];
}

import type { AcaraSession } from '@products/hub/acara/types';

export interface CalendarEvent {
  id: string;
  name: string;
  date: string; // ISO YYYY-MM-DD
  time?: string;
  loc?: string;
  category?: string;
  crew?: string[];
  gear?: string[];
  status?: string;
  notes?: string;
  sessions?: AcaraSession[];
}

export interface ContentPlannerItem {
  id: string;
  judul_momentum: string;
  kategori: string;
  subkategori?: string;
  deskripsi?: string;
  daftar_konten?: string[];
  referensi_url?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  recurrence_type: string;
  recurrence_rule?: Record<string, any>;
  bulan_hijriah?: string;
  tanggal_hijriah?: number | null;
  bulan_masehi?: number;
  tanggal_masehi?: number;
  hari_pasaran?: string;
  hari_mingguan?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePlannerDTO {
  judul_momentum: string;
  kategori?: string;
  subkategori?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  recurrence_type?: string;
  recurrence_rule?: Record<string, any>;
  bulan_hijriah?: string;
  tanggal_hijriah?: number | null;
  bulan_masehi?: number | null;
  tanggal_masehi?: number | null;
  hari_pasaran?: string;
  hari_mingguan?: string;
  deskripsi?: string;
  daftar_konten?: string[];
  referensi_url?: string;
}

export interface UpdatePlannerDTO extends Partial<CreatePlannerDTO> {
  id: string;
}

export interface CalendarDocConfig {
  id: 'pesantren' | 'sekolah';
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  relPath: string;
  downloadName: string;
  totalPages: number;
}
