export type AnnouncementPriority = 'normal' | 'penting';

export type AnnouncementColorTheme = 'blue' | 'purple' | 'orange' | 'green' | 'red' | 'yellow';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  prio: AnnouncementPriority;
  color_theme?: AnnouncementColorTheme;
  by: string;
  date: string; // ISO date string or human readable
  created_at: number;
  durasi_hari?: number;
  berlaku_sampai?: string | null;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  prio: AnnouncementPriority;
  color_theme?: AnnouncementColorTheme;
  by?: string;
  durasi_hari?: number;
  berlaku_sampai?: string | null;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  prio?: AnnouncementPriority;
  color_theme?: AnnouncementColorTheme;
  durasi_hari?: number;
  berlaku_sampai?: string | null;
}
