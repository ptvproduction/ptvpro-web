import { Announcement, CreateAnnouncementInput, UpdateAnnouncementInput } from './types';
import { DEFAULT_ANNOUNCEMENTS } from './broadcastStore';

function getApiUrl(endpoint: string): string | null {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}${endpoint}`;
  }
  return null;
}

export interface IBroadcastService {
  getAnnouncements(forceRefresh?: boolean): Promise<Announcement[]>;
  createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement | null>;
  updateAnnouncement(id: string, updates: UpdateAnnouncementInput): Promise<boolean>;
  deleteAnnouncement(id: string): Promise<boolean>;
}

export class StagingBroadcastService implements IBroadcastService {
  private cache: { items: Announcement[]; timestamp: number } | null = null;
  private lastFetchErrorTimestamp = 0;

  public async getAnnouncements(forceRefresh = false): Promise<Announcement[]> {
    const now = Date.now();

    // 1. Gunakan cache in-memory jika masih segar (5 detik) dan tidak diminta force refresh
    if (!forceRefresh && this.cache && now - this.cache.timestamp < 5000) {
      return [...this.cache.items];
    }

    // 2. Proteksi Anti-Spam jika request baru saja gagal dalam 3 detik terakhir
    if (this.lastFetchErrorTimestamp > 0 && now - this.lastFetchErrorTimestamp < 3000) {
      if (this.cache) return [...this.cache.items];
      return [...DEFAULT_ANNOUNCEMENTS];
    }

    const apiUrl = getApiUrl('/api/broadcast');
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, {
          credentials: 'same-origin',
        });

        if (res.ok) {
          const contentType = res.headers?.get?.('content-type');
          if (contentType && contentType.includes('application/json')) {
            const body = await res.json();
            if (body.success && Array.isArray(body.announcements)) {
              this.cache = {
                items: body.announcements,
                timestamp: Date.now(),
              };
              this.lastFetchErrorTimestamp = 0;
              return body.announcements;
            }
          }
        } else {
          this.lastFetchErrorTimestamp = Date.now();
        }
      } catch (err) {
        this.lastFetchErrorTimestamp = Date.now();
        console.warn('[BroadcastService] API fetch error, fallback to stored/fixture announcements:', err);
      }
    }

    if (this.cache) return [...this.cache.items];
    return [...DEFAULT_ANNOUNCEMENTS];
  }

  public async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement | null> {
    const apiUrl = getApiUrl('/api/broadcast');
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            action: 'create',
            title: input.title,
            body: input.body,
            prio: input.prio,
            target_divisi: 'Semua',
            durasi_hari: input.durasi_hari,
            berlaku_sampai: input.berlaku_sampai,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.announcement) {
            this.cache = null; // Invalidate cache
            return data.announcement;
          }
        }
      } catch (err) {
        console.warn('[BroadcastService] Failed to persist announcement to cloud:', err);
      }
    }
    return null;
  }

  public async updateAnnouncement(id: string, updates: UpdateAnnouncementInput): Promise<boolean> {
    const apiUrl = getApiUrl('/api/broadcast');
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            action: 'update',
            id,
            title: updates.title,
            body: updates.body,
            prio: updates.prio,
            durasi_hari: updates.durasi_hari,
            berlaku_sampai: updates.berlaku_sampai,
          }),
        });

        if (res.ok) {
          this.cache = null;
          return true;
        }
      } catch (err) {
        console.warn('[BroadcastService] Failed to update announcement in cloud:', err);
      }
    }
    return false;
  }

  public async deleteAnnouncement(id: string): Promise<boolean> {
    const apiUrl = getApiUrl('/api/broadcast');
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            action: 'delete',
            id,
          }),
        });

        if (res.ok) {
          this.cache = null;
          return true;
        }
      } catch (err) {
        console.warn('[BroadcastService] Failed to delete announcement in cloud:', err);
      }
    }
    return false;
  }
}

export const broadcastService = new StagingBroadcastService();
