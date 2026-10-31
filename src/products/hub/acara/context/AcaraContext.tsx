/**
 * PTV PRO — Modul Acara
 * Shared State Management & Repository Lokal Modul Acara
 * Menjamin keseragaman data antara halaman daftar, halaman detail, dan seluruh modal interaktif.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AcaraItem, CreateAcaraDTO, UpdateAcaraDTO, AcaraStatus, AcaraCrewMember, AcaraGearAllocation, AcaraRundownItem, AcaraNotulensiRef } from '../types';
import { normalizeJam, sortRundownList } from '../utils/rundownUtils';
import { acaraService } from '../acaraService';
import { catatanService } from '../../catatan/catatanService';
import { notificationService } from '../../shell/notificationService';
import { useInstantData } from '@shared/hooks/useInstantData';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'alert' | 'info';
}

export interface AcaraContextType {
  events: AcaraItem[];
  isLoading: boolean;
  error: string | null;
  refreshEvents: () => Promise<void>;
  notulensiList: AcaraNotulensiRef[];
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'alert' | 'info') => void;
  removeToast: (id: string) => void;
  getEventById: (id: string) => AcaraItem | undefined;
  createEvent: (dto: CreateAcaraDTO) => Promise<AcaraItem | null>;
  updateEvent: (id: string, dto: UpdateAcaraDTO) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  updateEventStatus: (id: string, status: AcaraStatus) => Promise<boolean>;
  updateEventCrew: (id: string, crew: AcaraCrewMember[]) => Promise<boolean>;
  updateEventGear: (id: string, gear: AcaraGearAllocation[]) => Promise<boolean>;
  addRundownItem: (id: string, jam: string, kegiatan: string) => Promise<boolean>;
  updateRundownItem: (id: string, itemId: string, jam: string, kegiatan: string) => Promise<boolean>;
  deleteRundownItem: (id: string, itemId: string) => Promise<boolean>;
  linkNotulensi: (id: string, noteId: string) => Promise<boolean>;
  unlinkNotulensi: (id: string, noteId: string) => Promise<boolean>;
  getLinkedNotulensi: (event: AcaraItem) => AcaraNotulensiRef[];
}

const AcaraContext = createContext<AcaraContextType | null>(null);

export const AcaraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Instant-First Persistent Cache: Instant render on remount, background revalidation
  const {
    data: events,
    isLoading,
    error,
    refetch: fetchEvents,
    mutate: setEvents,
  } = useInstantData<AcaraItem[]>({
    key: 'acara_events_list',
    fetcher: () => acaraService.getEvents(),
    ttlMs: 10 * 60 * 1000,
    initialFallback: [],
  });

  const [notulensiList, setNotulensiList] = useState<AcaraNotulensiRef[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const fetchNotulensi = useCallback(async () => {
    try {
      const allNotes = await catatanService.getNotes();
      const meetingNotes = allNotes.filter((n) => n.tipe === 'meeting_minutes');
      {
        const mappedRefs: AcaraNotulensiRef[] = meetingNotes.map((n) => ({
          id: n.id,
          judul: n.judul,
          isi: n.isi,
          date: n.meeting_meta?.date || (n.created_at ? n.created_at.slice(0, 10) : undefined),
          time: n.meeting_meta?.time,
          loc: n.meeting_meta?.loc,
          att: n.meeting_meta?.att,
          created_by_name: n.created_by_name,
          tags: n.tags,
        }));
        setNotulensiList(mappedRefs);
      }
    } catch {
      setNotulensiList([]);
    }
  }, []);

  useEffect(() => {
    fetchNotulensi();
  }, [fetchNotulensi]);

  const showToast = useCallback((message: string, type: 'success' | 'alert' | 'info' = 'info') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getEventById = useCallback((id: string) => {
    return events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
  }, [events]);

  const createEvent = useCallback(async (dto: CreateAcaraDTO): Promise<AcaraItem | null> => {
    try {
      const created = await acaraService.createEvent(dto);
      setEvents((prev) => [created, ...prev]);
      showToast(`Acara "${created.name}" berhasil dijadwalkan dan tersimpan di database.`, 'success');
      return created;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal membuat acara baru:', err);
      showToast(err.message || 'Gagal menyimpan acara baru ke server backend.', 'alert');
      return null;
    }
  }, [showToast]);

  const updateEvent = useCallback(async (id: string, dto: UpdateAcaraDTO): Promise<boolean> => {
    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    if (!target) {
      showToast('Data acara tidak ditemukan dalam daftar.', 'alert');
      return false;
    }

    try {
      const updated = await acaraService.updateEvent({
        id: target.id,
        expected_updated_at: target.updated_at,
        name: dto.name,
        loc: dto.loc,
        date: dto.date,
        time: dto.time,
        notes: dto.notes,
        status: dto.status,
        type: dto.type,
        dresscode: dto.dresscode,
        display_color: dto.display_color,
        crew: dto.crew,
        sessions: dto.sessions,
        notulensi_ids: dto.notulensi_ids,
      });

      setEvents((prev) =>
        prev.map((e) => (String(e.id).toLowerCase() === String(id).toLowerCase() ? updated : e))
      );
      showToast(`Perubahan acara "${updated.name}" berhasil disimpan.`, 'success');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal menyimpan update acara:', err);
      showToast(err.message || 'Gagal menyimpan perubahan acara ke server backend.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    const eventName = target?.name || 'Acara';

    try {
      await acaraService.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => String(e.id).toLowerCase() !== String(id).toLowerCase()));
      showToast(`Acara "${eventName}" telah dihapus dari database.`, 'alert');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal menghapus acara:', err);
      showToast(err.message || 'Gagal menghapus acara dari server backend.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const updateEventStatus = useCallback(async (id: string, status: AcaraStatus): Promise<boolean> => {
    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    if (!target) {
      showToast('Data acara tidak ditemukan.', 'alert');
      return false;
    }

    try {
      const updated = await acaraService.updateEvent({
        id: target.id,
        expected_updated_at: target.updated_at,
        status,
      });

      setEvents((prev) =>
        prev.map((e) => (String(e.id).toLowerCase() === String(id).toLowerCase() ? updated : e))
      );
      showToast(`Status acara diperbarui menjadi: ${status}`, 'success');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal memperbarui status acara:', err);
      showToast(err.message || 'Gagal memperbarui status acara.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const updateEventCrew = useCallback(async (id: string, crew: AcaraCrewMember[]): Promise<boolean> => {
    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    if (!target) {
      showToast('Data acara tidak ditemukan.', 'alert');
      return false;
    }

    try {
      const updated = await acaraService.updateEvent({
        id: target.id,
        expected_updated_at: target.updated_at,
        crew,
      });

      setEvents((prev) =>
        prev.map((e) => (String(e.id).toLowerCase() === String(id).toLowerCase() ? updated : e))
      );

      // Dispatch smart notifications for assigned crew members
      crew.forEach((c) => {
        if (c.ptv_id) {
          notificationService.notifyCrewAssigned({
            id: updated.id,
            name: updated.name,
            crew_ptv_id: c.ptv_id,
            role_name: c.job || c.tugas || 'Kru Acara',
            date: updated.date,
          });
        }
      });

      showToast(`Penugasan ${crew.length} kru acara berhasil disimpan.`, 'success');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal menyimpan kru acara:', err);
      showToast(err.message || 'Gagal menyimpan penugasan kru acara ke database.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const updateEventGear = useCallback(async (id: string, gear: AcaraGearAllocation[]): Promise<boolean> => {
    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    if (!target) {
      showToast('Data acara tidak ditemukan.', 'alert');
      return false;
    }

    try {
      const updated = await acaraService.updateEvent({
        id: target.id,
        expected_updated_at: target.updated_at,
        gear,
      });

      setEvents((prev) =>
        prev.map((e) => (String(e.id).toLowerCase() === String(id).toLowerCase() ? updated : e))
      );
      const totalUnits = gear.reduce((acc, g) => acc + (g.qty || 1), 0);
      showToast(`Alokasi ${totalUnits} unit peralatan berhasil disimpan.`, 'success');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal menyimpan alokasi peralatan acara:', err);
      showToast(err.message || 'Gagal menyimpan alokasi peralatan acara ke database.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const addRundownItem = useCallback(async (id: string, jam: string, kegiatan: string): Promise<boolean> => {
    const rawJam = jam.trim();
    const rawKegiatan = kegiatan.trim();
    if (!rawJam || !rawKegiatan) return false;

    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    if (!target) {
      showToast('Data acara tidak ditemukan.', 'alert');
      return false;
    }

    const normJam = normalizeJam(rawJam);
    const newRdItem: AcaraRundownItem = {
      id: `rd-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      acara_id: target.id,
      jam_mulai: normJam,
      kegiatan: rawKegiatan
    };

    const currentList = Array.isArray(target.rundown) ? target.rundown : [];
    const sorted = sortRundownList([...currentList, newRdItem]);

    try {
      const updated = await acaraService.updateEvent({
        id: target.id,
        expected_updated_at: target.updated_at,
        rundown: sorted,
      });

      setEvents((prev) =>
        prev.map((e) => (String(e.id).toLowerCase() === String(id).toLowerCase() ? updated : e))
      );
      showToast('Item rundown berhasil ditambahkan.', 'success');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal menambah rundown acara:', err);
      showToast(err.message || 'Gagal menyimpan item rundown ke database.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const updateRundownItem = useCallback(async (id: string, itemId: string, jam: string, kegiatan: string): Promise<boolean> => {
    const rawJam = jam.trim();
    const rawKegiatan = kegiatan.trim();
    if (!rawJam || !rawKegiatan) return false;

    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    if (!target) {
      showToast('Data acara tidak ditemukan.', 'alert');
      return false;
    }

    const normJam = normalizeJam(rawJam);
    const currentList = Array.isArray(target.rundown) ? target.rundown : [];
    let itemFound = false;
    const nextList = currentList.map((item) => {
      if (String(item.id) === String(itemId)) {
        itemFound = true;
        return { ...item, jam_mulai: normJam, kegiatan: rawKegiatan };
      }
      return item;
    });

    if (!itemFound) {
      showToast('Item rundown tidak ditemukan.', 'alert');
      return false;
    }

    const sorted = sortRundownList(nextList);

    try {
      const updated = await acaraService.updateEvent({
        id: target.id,
        expected_updated_at: target.updated_at,
        rundown: sorted,
      });

      setEvents((prev) =>
        prev.map((e) => (String(e.id).toLowerCase() === String(id).toLowerCase() ? updated : e))
      );
      showToast('Item rundown berhasil diperbarui.', 'success');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal memperbarui rundown acara:', err);
      showToast(err.message || 'Gagal memperbarui item rundown di database.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const deleteRundownItem = useCallback(async (id: string, itemId: string): Promise<boolean> => {
    const target = events.find((e) => String(e.id).toLowerCase() === String(id).toLowerCase());
    if (!target) {
      showToast('Data acara tidak ditemukan.', 'alert');
      return false;
    }

    const currentList = Array.isArray(target.rundown) ? target.rundown : [];
    const nextList = currentList.filter((item) => String(item.id) !== String(itemId));

    try {
      const updated = await acaraService.updateEvent({
        id: target.id,
        expected_updated_at: target.updated_at,
        rundown: nextList,
      });

      setEvents((prev) =>
        prev.map((e) => (String(e.id).toLowerCase() === String(id).toLowerCase() ? updated : e))
      );
      showToast('Item rundown telah dihapus.', 'info');
      return true;
    } catch (err: any) {
      console.error('[AcaraContext] Gagal menghapus rundown acara:', err);
      showToast(err.message || 'Gagal menghapus item rundown di database.', 'alert');
      return false;
    }
  }, [events, showToast]);

  const linkNotulensi = useCallback(async (id: string, noteId: string): Promise<boolean> => {
    const target = events.find((event) => event.id === id);
    if (!target || !notulensiList.some((note) => note.id === noteId)) return false;
    const ids = target.notulensi_ids || [];
    if (ids.includes(noteId)) return true;
    return updateEvent(id, { notulensi_ids: [...ids, noteId] });
  }, [events, notulensiList, updateEvent]);

  const unlinkNotulensi = useCallback(async (id: string, noteId: string): Promise<boolean> => {
    const target = events.find((event) => event.id === id);
    if (!target) return false;
    return updateEvent(id, { notulensi_ids: (target.notulensi_ids || []).filter((value) => value !== noteId) });
  }, [events, updateEvent]);

  const getLinkedNotulensi = useCallback(
    (event: AcaraItem): AcaraNotulensiRef[] => {
      const ids = event.notulensi_ids || [];
      if (Array.isArray(event.notulensi_ids)) return notulensiList.filter((note) => ids.includes(note.id));
      return notulensiList.filter((note) => note.tags?.some((tag) => tag === `acara_${event.id}` || tag === `event_${event.id}`));
    },
    [notulensiList]
  );

  return (
    <AcaraContext.Provider
      value={{
        events,
        isLoading,
        error,
        refreshEvents: async () => {
          await fetchEvents();
        },
        notulensiList,
        toasts,
        showToast,
        removeToast,
        getEventById,
        createEvent,
        updateEvent,
        deleteEvent,
        updateEventStatus,
        updateEventCrew,
        updateEventGear,
        addRundownItem,
        updateRundownItem,
        deleteRundownItem,
        linkNotulensi,
        unlinkNotulensi,
        getLinkedNotulensi
      }}
    >
      {children}

      {/* Toast Feedback Renderer */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(var(--dock-h, 68px) + 24px)',
            right: '24px',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: '380px'
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 16px',
                background:
                  t.type === 'success'
                    ? '#065f46'
                    : t.type === 'alert'
                    ? '#991b1b'
                    : '#1e3a8a',
                color: '#ffffff',
                borderRadius: 'var(--r-lg, 12px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                fontSize: '13px',
                fontWeight: 600,
                lineHeight: 1.4,
                animation: 'slideUpToast 0.25s ease'
              }}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </AcaraContext.Provider>
  );
};

export function useAcara(): AcaraContextType {
  const context = useContext(AcaraContext);
  if (!context) {
    throw new Error('useAcara harus digunakan di dalam <AcaraProvider>');
  }
  return context;
}

export function useOptionalAcara(): AcaraContextType | null {
  return useContext(AcaraContext);
}
