import { useState, useEffect } from 'react';
import { Announcement, CreateAnnouncementInput, UpdateAnnouncementInput } from './types';
import { broadcastService } from './broadcastService';
import { useSessionStore } from '@/core/session';

const STORAGE_KEY = 'ptv_broadcast_announcements_v2';

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'b5194a18-f80f-46a7-b6f1-298bf57f3bfa',
    title: 'Dasbor sudah bisa digunakan!',
    body: 'Alhamdulillah setelah tirakat bertahun-tahun, kita akhirnya sudah bisa menggunakan dasbor ini dengan nyaman, enak dipandang. Semoga berkah!',
    prio: 'penting',
    by: 'Redaksi PTV',
    date: '2026-09-23',
    created_at: 1727097778637,
  },
  {
    id: 'de9a5908-1d6c-4b77-bc8e-3ee32a50463d',
    title: 'Pengumuman Bug System',
    body: 'Jika ada bug system bisa menghubungi bang jid dan roup yaaw :>',
    prio: 'penting',
    by: 'Redaksi PTV',
    date: '2026-09-24',
    created_at: 1727192201617,
  },
  {
    id: '5d0bca52-a98b-4da4-9f56-0c9890f1e3f0',
    title: 'Ndang bayar kas, rek!',
    body: 'Bendaharamu marah” wisan aowkwkwkwkw',
    prio: 'penting',
    by: 'Redaksi PTV',
    date: '2026-09-28',
    created_at: 1727501232237,
  },
];

type Listener = () => void;

class BroadcastStore {
  private items: Announcement[] = [];
  private listeners: Set<Listener> = new Set();
  private initialized = false;

  constructor() {
    this.load();
    useSessionStore.subscribe((state, prevState) => {
      const prevUserId = prevState?.user?.id || prevState?.user?.ptv_id || null;
      const currentUserId = state?.user?.id || state?.user?.ptv_id || null;

      if (currentUserId && currentUserId !== prevUserId) {
        void this.syncCloud();
      }
    });

    const { user, isLoading } = useSessionStore.getState();
    if (!isLoading && user) {
      void this.syncCloud();
    }
  }

  private load(): void {
    this.initialized = true;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      this.items = [...DEFAULT_ANNOUNCEMENTS];
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.items = parsed;
          return;
        }
      }
    } catch {
      // Fallback to defaults on parse error
    }

    this.items = [...DEFAULT_ANNOUNCEMENTS];
    this.save();
  }

  public async syncCloud(): Promise<void> {
    const { user, isLoading } = useSessionStore.getState();
    if (isLoading || !user) {
      return;
    }
    try {
      const cloudItems = await broadcastService.getAnnouncements(true);
      if (Array.isArray(cloudItems) && cloudItems.length > 0) {
        this.items = cloudItems;
        this.save();
      }
    } catch {
      // Fail silently and use cached/local
    }
  }

  private save(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      } catch {
        // Storage quota exceeded or disabled
      }
    }
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAnnouncements(): Announcement[] {
    if (!this.initialized) {
      this.load();
    }
    return [...this.items];
  }

  public getAnnouncementById(id: string): Announcement | undefined {
    return this.items.find((a) => a.id === id);
  }

  public addAnnouncement(input: CreateAnnouncementInput): Announcement {
    const today = new Date();
    const isoDate = today.toISOString().split('T')[0];
    const newId = 'ann-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    let berlakuSampai = input.berlaku_sampai || null;
    if (!berlakuSampai && typeof input.durasi_hari === 'number' && input.durasi_hari > 0) {
      berlakuSampai = new Date(Date.now() + input.durasi_hari * 86400000).toISOString();
    }

    const newAnnouncement: Announcement = {
      id: newId,
      title: input.title.trim(),
      body: input.body.trim(),
      prio: input.prio,
      color_theme: input.color_theme,
      by: input.by?.trim() || 'Tim Eksekutif',
      date: isoDate,
      created_at: Date.now(),
      durasi_hari: input.durasi_hari,
      berlaku_sampai: berlakuSampai,
    };

    // Unshift to place newest on top matching Legacy
    this.items.unshift(newAnnouncement);
    this.save();

    // Async persist to cloud
    broadcastService.createAnnouncement(input).then((persisted) => {
      if (persisted && persisted.id) {
        // Replace temporary local ID with persisted cloud ID if different
        const idx = this.items.findIndex((a) => a.id === newId);
        if (idx !== -1) {
          this.items[idx] = persisted;
          this.save();
        }
      }
    }).catch((err) => {
      console.warn('[BroadcastStore] Async cloud persist warning:', err);
    });

    return newAnnouncement;
  }

  public updateAnnouncement(id: string, updates: UpdateAnnouncementInput): boolean {
    const index = this.items.findIndex((a) => a.id === id);
    if (index === -1) return false;

    this.items[index] = {
      ...this.items[index],
      title: updates.title !== undefined ? updates.title.trim() : this.items[index].title,
      body: updates.body !== undefined ? updates.body.trim() : this.items[index].body,
      prio: updates.prio !== undefined ? updates.prio : this.items[index].prio,
      color_theme: updates.color_theme !== undefined ? updates.color_theme : this.items[index].color_theme,
      durasi_hari: updates.durasi_hari !== undefined ? updates.durasi_hari : this.items[index].durasi_hari,
      berlaku_sampai: updates.berlaku_sampai !== undefined
        ? updates.berlaku_sampai
        : (updates.durasi_hari && updates.durasi_hari > 0 ? new Date(Date.now() + updates.durasi_hari * 86400000).toISOString() : this.items[index].berlaku_sampai),
    };

    this.save();

    // Async persist to cloud
    broadcastService.updateAnnouncement(id, updates).catch((err) => {
      console.warn('[BroadcastStore] Async cloud update warning:', err);
    });

    return true;
  }

  public deleteAnnouncement(id: string): boolean {
    const prevLength = this.items.length;
    this.items = this.items.filter((a) => a.id !== id);
    if (this.items.length !== prevLength) {
      this.save();

      // Async persist to cloud
      broadcastService.deleteAnnouncement(id).catch((err) => {
        console.warn('[BroadcastStore] Async cloud delete warning:', err);
      });

      return true;
    }
    return false;
  }

  public setLiveAnnouncements(items: Announcement[]): void {
    this.items = [...items];
    this.save();
  }

  public resetToDefaults(): void {
    this.items = [...DEFAULT_ANNOUNCEMENTS];
    this.save();
  }
}

export const broadcastStore = new BroadcastStore();

/**
 * Custom React hook for subscribing to broadcast announcements.
 */
export function useBroadcastAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    broadcastStore.getAnnouncements()
  );

  useEffect(() => {
    // Initial sync with cloud
    broadcastStore.syncCloud();

    const unsubscribe = broadcastStore.subscribe(() => {
      setAnnouncements(broadcastStore.getAnnouncements());
    });
    return unsubscribe;
  }, []);

  return {
    announcements,
    addAnnouncement: (input: CreateAnnouncementInput) => broadcastStore.addAnnouncement(input),
    updateAnnouncement: (id: string, updates: UpdateAnnouncementInput) =>
      broadcastStore.updateAnnouncement(id, updates),
    deleteAnnouncement: (id: string) => broadcastStore.deleteAnnouncement(id),
    resetToDefaults: () => broadcastStore.resetToDefaults(),
    syncCloud: () => broadcastStore.syncCloud(),
  };
}
