/**
 * PTV PRO — Modul Acara
 * Modal Form Tambah & Edit Acara Liputan
 * Fitur: Sesi Opsional, Custom Dropdown Notulensi Rapat, Auto Title Case, Auto Status, dan Aksi Arsip/Hapus
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AcaraItem,
  AcaraStatus,
  AcaraSession,
  AcaraSessionLabel,
  AcaraCrewMember
} from '../types';
import { useAcara } from '../context/AcaraContext';
import { catatanService } from '../../catatan/catatanService';
import { NoteItem } from '../../catatan/types';
import { AcaraCrewModal } from './AcaraCrewModal';
import {
  X,
  Check,
  Plus,
  Trash2,
  Archive,
  Clock,
  Search,
  FileText,
  ChevronDown,
  Layers,
  AlertTriangle,
  RotateCcw,
  Users
} from 'lucide-react';
import { formatIsoDate, formatHumanDateIndo } from '../utils/acaraDateUtils';
import { ACARA_COLORS, normalizeAcaraColor, AcaraColor } from '../utils/acaraColors';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

export interface AcaraFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: AcaraItem | null;
  defaultDate?: string;
  onDeleted?: () => void;
}

const SESSION_LABEL_PRESETS: AcaraSessionLabel[] = ['Pagi', 'Siang', 'Sore', 'Malam', 'Lainnya'];

/**
 * Format string menjadi Capital Each Word, menjaga singkatan kapital (PTV, TV, HD, VIP, PPBS, dll.)
 */
export function toCapitalEachWord(text: string): string {
  if (!text) return '';
  return text
    .split(' ')
    .map((word) => {
      if (!word) return '';
      if (word.length >= 2 && word === word.toUpperCase()) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Menghitung status acara secara otomatis berdasarkan tanggal tanpa dropdown
 */
export function calculateAutoStatus(dateStr: string, existingStatus?: AcaraStatus): AcaraStatus {
  if (existingStatus === 'Dibatalkan' || existingStatus === 'Batal') {
    return 'Dibatalkan';
  }
  if (existingStatus === 'Selesai') {
    return 'Selesai';
  }
  const today = new Date().toISOString().slice(0, 10);
  if (!dateStr) return 'Mendatang';
  if (dateStr > today) return 'Mendatang';
  if (dateStr === today) return 'Berlangsung';
  return 'Selesai';
}

export const AcaraFormModal: React.FC<AcaraFormModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
  defaultDate,
  onDeleted
}) => {
  const { createEvent, updateEvent, deleteEvent } = useAcara();
  const isEditing = Boolean(eventToEdit);

  // Field dasar
  const [name, setName] = useState(() => eventToEdit?.name || '');
  const [loc, setLoc] = useState(() => eventToEdit?.loc || 'Studio PTV');
  const [date, setDate] = useState(() => eventToEdit?.date || defaultDate || formatIsoDate(new Date()));
  const [notes, setNotes] = useState(() => eventToEdit?.notes || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [displayColor, setDisplayColor] = useState<AcaraColor>(() => normalizeAcaraColor(eventToEdit?.display_color));

  // Sistem Sesi Opsional
  const [hasSessions, setHasSessions] = useState(() => Boolean(eventToEdit?.sessions && eventToEdit.sessions.length > 0));
  const [startTime, setStartTime] = useState(() => {
    if (!eventToEdit?.time) return '08:00';
    const parts = eventToEdit.time.split(/[–-]/);
    return parts[0]?.trim() || '08:00';
  });
  const [hasEndTime, setHasEndTime] = useState(() => {
    if (!eventToEdit?.time) return false;
    const parts = eventToEdit.time.split(/[–-]/);
    return Boolean(parts[1] && !parts[1].toLowerCase().includes('selesai'));
  });
  const [endTime, setEndTime] = useState(() => {
    if (!eventToEdit?.time) return '11:30';
    const parts = eventToEdit.time.split(/[–-]/);
    return (parts[1] && !parts[1].toLowerCase().includes('selesai')) ? parts[1].trim() : '11:30';
  });
  const [sessions, setSessions] = useState<AcaraSession[]>(() => {
    if (eventToEdit?.sessions && eventToEdit.sessions.length > 0) {
      return eventToEdit.sessions.map((s, idx) => ({
        id: s.id || `sesi-${idx + 1}`,
        label: (s.label as AcaraSessionLabel) || 'Pagi',
        custom_label: s.custom_label || '',
        start_time: s.start_time || '08:00',
        has_end_time: Boolean(s.has_end_time),
        end_time: s.end_time || '11:30'
      }));
    }
    return [{ id: 'sesi-1', label: 'Pagi', start_time: '08:00', has_end_time: false, end_time: '11:30' }];
  });

  // Custom Dropdown Notulensi Rapat
  const [notulensiNotes, setNotulensiNotes] = useState<NoteItem[]>([]);
  const [isLoadingNotulensi, setIsLoadingNotulensi] = useState(false);
  const [notulensiError, setNotulensiError] = useState<string | null>(null);
  const [isNotulensiDropdownOpen, setIsNotulensiDropdownOpen] = useState(false);
  const [notulensiSearch, setNotulensiSearch] = useState('');
  const [selectedNotulensiId, setSelectedNotulensiId] = useState<string | null>(() => {
    return eventToEdit?.notulensi_ids && eventToEdit.notulensi_ids.length > 0 ? eventToEdit.notulensi_ids[0] : null;
  });

  // Penugasan Kru (Opsional)
  const [selectedCrew, setSelectedCrew] = useState<AcaraCrewMember[]>(() => eventToEdit?.crew || []);
  const [isCrewPickerOpen, setIsCrewPickerOpen] = useState(false);

  // Status proses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notulensiDropdownRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'acara-form-modal',
  });

  // Fetch daftar notulensi rapat asli dari modul Catatan/Notulensi
  const fetchNotulensiData = useCallback(async () => {
    setIsLoadingNotulensi(true);
    setNotulensiError(null);
    try {
      const allNotes = await catatanService.getNotes();
      const meetingNotes = allNotes.filter((n) => n.tipe === 'meeting_minutes');
      setNotulensiNotes(meetingNotes);
    } catch (err: any) {
      console.warn('[AcaraFormModal] Gagal memuat notulensi rapat:', err);
      setNotulensiError('Gagal memuat daftar notulensi rapat.');
    } finally {
      setIsLoadingNotulensi(false);
    }
  }, []);

  // Inisialisasi form state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setDisplayColor(normalizeAcaraColor(eventToEdit?.display_color));
      fetchNotulensiData();
      setIsConfirmingDelete(false);
      setIsNotulensiDropdownOpen(false);
      setNotulensiSearch('');

      if (eventToEdit) {
        setName(eventToEdit.name || '');
        setLoc(eventToEdit.loc || 'Studio PTV');
        setDate(eventToEdit.date || formatIsoDate(new Date()));
        setNotes(eventToEdit.notes || '');

        // Relasi notulensi
        const existingNoteId = eventToEdit.notulensi_ids && eventToEdit.notulensi_ids.length > 0
          ? eventToEdit.notulensi_ids[0]
          : null;
        setSelectedNotulensiId(existingNoteId);

        // Kru Bertugas
        setSelectedCrew(eventToEdit.crew || []);

        // Kompatibilitas Sesi: periksa apakah ada data sessions
        if (eventToEdit.sessions && eventToEdit.sessions.length > 0) {
          setHasSessions(true);
          setSessions(
            eventToEdit.sessions.map((s, idx) => ({
              id: s.id || `sesi-${idx + 1}`,
              label: (s.label as AcaraSessionLabel) || 'Pagi',
              custom_label: s.custom_label || '',
              start_time: s.start_time || '08:00',
              has_end_time: Boolean(s.has_end_time),
              end_time: s.end_time || '11:30'
            }))
          );
        } else {
          // Format waktu tunggal biasa
          setHasSessions(false);
          const rawTime = String(eventToEdit.time || '08:00 – Selesai');
          if (rawTime.includes('–') || rawTime.includes('-')) {
            const parts = rawTime.split(/[–-]/).map((s) => s.trim());
            setStartTime(parts[0] || '08:00');
            if (parts[1] && !parts[1].toLowerCase().includes('selesai')) {
              setHasEndTime(true);
              setEndTime(parts[1]);
            } else {
              setHasEndTime(false);
              setEndTime('11:30');
            }
          } else {
            setStartTime(rawTime || '08:00');
            setHasEndTime(false);
            setEndTime('11:30');
          }
          setSessions([
            { id: 'sesi-1', label: 'Pagi', start_time: '08:00', has_end_time: false, end_time: '11:30' }
          ]);
        }
      } else {
        // Form tambah baru
        setName('');
        setLoc('Studio PTV');
        setDate(defaultDate || formatIsoDate(new Date()));
        setNotes('');
        setSelectedNotulensiId(null);
        setSelectedCrew([]);
        setHasSessions(false);
        setStartTime('08:00');
        setHasEndTime(false);
        setEndTime('11:30');
        setSessions([
          { id: 'sesi-1', label: 'Pagi', start_time: '08:00', has_end_time: false, end_time: '11:30' }
        ]);
      }

      setErrorMsg('');

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, eventToEdit, defaultDate, fetchNotulensiData]);

  // Listener tombol Escape dan klik luar dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isNotulensiDropdownOpen) {
          setIsNotulensiDropdownOpen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        notulensiDropdownRef.current &&
        !notulensiDropdownRef.current.contains(e.target as Node)
      ) {
        setIsNotulensiDropdownOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isNotulensiDropdownOpen, onClose]);

  // Notulensi yang sedang dipilih
  const selectedNotulensi = useMemo(() => {
    if (!selectedNotulensiId) return null;
    return notulensiNotes.find((n) => n.id === selectedNotulensiId) || null;
  }, [selectedNotulensiId, notulensiNotes]);

  // Filter notulensi berdasarkan judul / tanggal
  const filteredNotulensiNotes = useMemo(() => {
    const q = notulensiSearch.trim().toLowerCase();
    if (!q) return notulensiNotes;
    return notulensiNotes.filter(
      (n) =>
        n.judul.toLowerCase().includes(q) ||
        (n.meeting_meta?.date && n.meeting_meta.date.includes(q)) ||
        (n.created_by_name && n.created_by_name.toLowerCase().includes(q))
    );
  }, [notulensiNotes, notulensiSearch]);

  // Manajemen item sesi
  const handleAddSession = () => {
    const nextIdx = sessions.length + 1;
    let nextLabel: AcaraSessionLabel = 'Siang';
    if (sessions.length === 1) nextLabel = 'Siang';
    else if (sessions.length === 2) nextLabel = 'Sore';
    else if (sessions.length === 3) nextLabel = 'Malam';
    else nextLabel = 'Lainnya';

    const newSession: AcaraSession = {
      id: `sesi-${Date.now()}-${nextIdx}`,
      label: nextLabel,
      start_time: '13:00',
      has_end_time: false,
      end_time: '16:00'
    };
    setSessions([...sessions, newSession]);
  };

  const handleUpdateSession = (idx: number, updates: Partial<AcaraSession>) => {
    setSessions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...updates } : s))
    );
  };

  const handleDeleteSession = (idx: number) => {
    if (sessions.length <= 1) return;
    setSessions((prev) => prev.filter((_, i) => i !== idx));
  };

  // Kalkulasi string waktu final
  const calculateFinalTimeString = (): string => {
    if (!hasSessions) {
      const start = startTime.trim() || '08:00';
      if (hasEndTime && endTime.trim()) {
        return `${start} – ${endTime.trim()}`;
      }
      return `${start} – Selesai`;
    }

    if (sessions.length === 0) return '08:00 – Selesai';
    if (sessions.length === 1) {
      const s = sessions[0];
      const start = s.start_time || '08:00';
      const end = s.has_end_time && s.end_time ? s.end_time : 'Selesai';
      return `${start} – ${end}`;
    }

    const firstStart = sessions[0].start_time || '08:00';
    const lastSession = sessions[sessions.length - 1];
    const lastEnd = lastSession.has_end_time && lastSession.end_time ? lastSession.end_time : 'Selesai';
    return `${firstStart} – ${lastEnd} (${sessions.length} Sesi)`;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedName = toCapitalEachWord(name.trim());
    if (!formattedName) {
      setErrorMsg('Nama kegiatan / acara tidak boleh kosong.');
      return;
    }

    if (!date) {
      setErrorMsg('Tanggal acara wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const finalTimeString = calculateFinalTimeString();
      const autoStatus = calculateAutoStatus(date, eventToEdit?.status);
      const cleanNotulensiIds = selectedNotulensiId ? [selectedNotulensiId] : [];
      const cleanSessions = hasSessions ? sessions : [];

      if (isEditing && eventToEdit) {
        const ok = await updateEvent(eventToEdit.id, {
          name: formattedName,
          display_color: displayColor,
          loc: loc.trim() || 'Studio PTV',
          date,
          time: finalTimeString,
          status: autoStatus,
          notes: notes.trim(),
          sessions: cleanSessions,
          notulensi_ids: cleanNotulensiIds,
          crew: selectedCrew
        });
        if (ok) {
          onClose();
        }
      } else {
        const created = await createEvent({
          display_color: displayColor,
          name: formattedName,
          loc: loc.trim() || 'Studio PTV',
          date,
          time: finalTimeString,
          status: autoStatus,
          notes: notes.trim(),
          sessions: cleanSessions,
          notulensi_ids: cleanNotulensiIds,
          crew: selectedCrew
        });
        if (created) {
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan acara.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aksi Arsipkan Acara (Edit Mode)
  const handleArchiveEvent = async () => {
    if (!eventToEdit) return;
    setIsArchiving(true);
    try {
      const ok = await updateEvent(eventToEdit.id, {
        status: 'Selesai'
      });
      if (ok) {
        onClose();
      }
    } finally {
      setIsArchiving(false);
    }
  };

  // Aksi Hapus Acara (Edit Mode)
  const handleDeleteEvent = async () => {
    if (!eventToEdit) return;
    setIsDeleting(true);
    try {
      const ok = await deleteEvent(eventToEdit.id);
      if (ok) {
        onClose();
        if (onDeleted) onDeleted();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="acara-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isDeleting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acara-form-title"
    >
      <div className="acara-modal-sheet" ref={modalRef} style={{ maxWidth: '640px' }}>
        {/* Header Modal */}
        <div className="acara-modal-header">
          <div>
            <h3 className="acara-modal-title" id="acara-form-title">
              {isEditing ? 'Edit Acara Liputan' : 'Tambah Acara Liputan Baru'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              {isEditing
                ? 'Perbarui rincian agenda, waktu, dan tautan notulensi rapat'
                : 'Jadwalkan agenda peliputan atau kegiatan produksi studio baru'}
            </p>
          </div>
          <button
            type="button"
            className="acara-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup form"
            disabled={isSubmitting || isDeleting}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="acara-modal-body">
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--r-md, 8px)',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Nama Kegiatan / Acara (Auto Capital Each Word) */}
            <div className="acara-field">
              <label className="acara-field-label" htmlFor="ev_form_name">
                Nama Kegiatan / Acara <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="ev_form_name"
                ref={inputRef}
                className="acara-field-input"
                placeholder="Contoh: Haflah Akhirussanah Pondok / Liputan Khusus"
                value={name}
                onChange={(e) => {
                  setName(toCapitalEachWord(e.target.value));
                  if (errorMsg) setErrorMsg('');
                }}
                onBlur={() => {
                  setName((prev) => toCapitalEachWord(prev.trim()));
                }}
                required
                autoComplete="off"
              />
              <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                Nama otomatis diformat Kapital Tiap Kata (Capital Each Word).
              </span>
            </div>

            {/* 2. Tanggal Acara & Lokasi Kegiatan */}
            <div className="acara-grid-2">
              <div className="acara-field">
                <label className="acara-field-label" htmlFor="ev_form_date">
                  Tanggal Acara <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="ev_form_date"
                  type="date"
                  className="acara-field-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="acara-field">
                <label className="acara-field-label" htmlFor="ev_form_loc">
                  Lokasi Kegiatan
                </label>
                <input
                  id="ev_form_loc"
                  className="acara-field-input"
                  placeholder="Contoh: Studio PTV / Lapangan Utama"
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                />
              </div>
            </div>

            {/* 3. Sistem Waktu & Sesi Acara (Sesi Bersifat Opsional) */}
            <div className="acara-field">
              <div
                className="acara-session-toggle-box"
                onClick={() => setHasSessions(!hasSessions)}
              >
                <div className="acara-checkbox-custom">
                  <input
                    type="checkbox"
                    id="ev_toggle_sessions"
                    checked={hasSessions}
                    onChange={(e) => setHasSessions(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label htmlFor="ev_toggle_sessions" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} style={{ color: hasSessions ? '#2563eb' : '#64748b' }} />
                    <span>Acara memiliki beberapa sesi</span>
                  </label>
                </div>
                <span style={{ fontSize: '11.5px', color: hasSessions ? '#2563eb' : '#64748b', fontWeight: 600 }}>
                  {hasSessions ? `${sessions.length} Sesi Terdaftar` : 'Waktu Biasa (1 Sesi)'}
                </span>
              </div>

              {/* Mode A: Waktu Biasa (hasSessions === false) */}
              {!hasSessions ? (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg, #f8fafc)',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 'var(--r-lg, 12px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: hasEndTime ? '1fr 1fr' : '1fr', gap: '12px' }}>
                    <div>
                      <label className="acara-field-label" htmlFor="ev_form_starttime" style={{ fontSize: '11.5px' }}>
                        Waktu Mulai <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        id="ev_form_starttime"
                        type="text"
                        className="acara-field-input"
                        placeholder="Contoh: 08:00 / 19:30"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                      />
                    </div>

                    {hasEndTime && (
                      <div>
                        <label className="acara-field-label" htmlFor="ev_form_endtime" style={{ fontSize: '11.5px' }}>
                          Waktu Selesai
                        </label>
                        <input
                          id="ev_form_endtime"
                          type="text"
                          className="acara-field-input"
                          placeholder="Contoh: 11:30 / 22:00"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="acara-checkbox-custom" style={{ fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={hasEndTime}
                        onChange={(e) => setHasEndTime(e.target.checked)}
                      />
                      <span>Tambahkan waktu selesai</span>
                    </label>

                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Pratinjau:{' '}
                      <strong style={{ color: 'var(--ink, #0f172a)' }}>
                        {hasEndTime && endTime.trim() ? `${startTime || '08:00'} – ${endTime.trim()}` : `${startTime || '08:00'} – Selesai`}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                /* Mode B: Multi-Sesi (hasSessions === true) */
                <div className="acara-sessions-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                      Daftar Sesi Acara ({sessions.length})
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Setiap sesi tersimpan permanen sebagai bagian dari acara ini
                    </span>
                  </div>

                  {sessions.map((sesi, idx) => (
                    <div key={sesi.id || idx} className="acara-session-card">
                      <div className="acara-session-card-header">
                        <span className="acara-session-card-title">
                          <Clock size={13} style={{ color: '#2563eb' }} />
                          Sesi {idx + 1}
                        </span>

                        <button
                          type="button"
                          className="acara-session-del-btn"
                          onClick={() => handleDeleteSession(idx)}
                          disabled={sessions.length <= 1}
                          title={sessions.length <= 1 ? 'Minimal 1 sesi harus ada' : 'Hapus sesi ini'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Pilihan Label Sesi */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                          Label Waktu / Kategori:
                        </span>
                        <div className="acara-session-labels-grid">
                          {SESSION_LABEL_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={`acara-session-label-pill ${sesi.label === preset ? 'is-active' : ''}`}
                              onClick={() => handleUpdateSession(idx, { label: preset })}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {sesi.label === 'Lainnya' && (
                          <input
                            type="text"
                            className="acara-field-input"
                            style={{ padding: '6px 10px', fontSize: '12px', marginTop: '4px' }}
                            placeholder="Tuliskan nama sesi kustom (misal: Sesi Akad / Sesi Talkshow)"
                            value={sesi.custom_label || ''}
                            onChange={(e) => handleUpdateSession(idx, { custom_label: e.target.value })}
                          />
                        )}
                      </div>

                      {/* Waktu Mulai & Checkbox Selesai untuk Sesi */}
                      <div style={{ display: 'grid', gridTemplateColumns: sesi.has_end_time ? '1fr 1fr' : '1fr', gap: '8px' }}>
                        <div>
                          <label className="acara-field-label" style={{ fontSize: '11px' }}>
                            Waktu Mulai Sesi
                          </label>
                          <input
                            type="text"
                            className="acara-field-input"
                            style={{ padding: '8px 12px', fontSize: '12.5px' }}
                            placeholder="08:00"
                            value={sesi.start_time}
                            onChange={(e) => handleUpdateSession(idx, { start_time: e.target.value })}
                          />
                        </div>

                        {sesi.has_end_time && (
                          <div>
                            <label className="acara-field-label" style={{ fontSize: '11px' }}>
                              Waktu Selesai Sesi
                            </label>
                            <input
                              type="text"
                              className="acara-field-input"
                              style={{ padding: '8px 12px', fontSize: '12.5px' }}
                              placeholder="11:30"
                              value={sesi.end_time || ''}
                              onChange={(e) => handleUpdateSession(idx, { end_time: e.target.value })}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                        <label className="acara-checkbox-custom" style={{ fontSize: '11.5px' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(sesi.has_end_time)}
                            onChange={(e) => handleUpdateSession(idx, { has_end_time: e.target.checked })}
                          />
                          <span>Tambahkan waktu selesai sesi</span>
                        </label>

                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Hasil: <strong>{sesi.start_time || '08:00'} – {sesi.has_end_time && sesi.end_time ? sesi.end_time : 'Selesai'}</strong>
                        </span>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="acara-session-add-btn"
                    onClick={handleAddSession}
                  >
                    <Plus size={15} /> Tambah Sesi Acara Berikutnya
                  </button>
                </div>
              )}
            </div>

            {/* 4. Custom Dropdown: Hubungkan ke Notulensi Rapat (Opsional) */}
            <div className="acara-field" ref={notulensiDropdownRef}>
              <label className="acara-field-label" htmlFor="ev_notulensi_dropdown_trigger">
                Hubungkan ke Notulensi Rapat (Opsional)
              </label>

              <div className="acara-notulensi-dropdown-wrap">
                <button
                  type="button"
                  id="ev_notulensi_dropdown_trigger"
                  className={`acara-notulensi-trigger ${isNotulensiDropdownOpen ? 'is-open' : ''}`}
                  onClick={() => setIsNotulensiDropdownOpen(!isNotulensiDropdownOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={isNotulensiDropdownOpen}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <FileText size={16} style={{ color: selectedNotulensi ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
                    {selectedNotulensi ? (
                      <span style={{ fontWeight: 600, color: 'var(--ink, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedNotulensi.judul}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Pilih notulensi rapat terkait...</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {selectedNotulensi && (
                      <span
                        role="button"
                        tabIndex={0}
                        style={{
                          background: '#f1f5f9',
                          borderRadius: 'var(--ptv-curve-pill)',
                          padding: '2px 6px',
                          fontSize: '11px',
                          color: '#64748b',
                          cursor: 'pointer'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNotulensiId(null);
                        }}
                        title="Kosongkan pilihan notulensi"
                      >
                        Batal Pilih
                      </span>
                    )}
                    <ChevronDown size={16} style={{ color: '#94a3b8', transform: isNotulensiDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                  </div>
                </button>

                {/* Dropdown Menu Floating */}
                {isNotulensiDropdownOpen && (
                  <div className="acara-notulensi-menu" role="listbox">
                    {/* Search Bar di dalam Dropdown */}
                    <div className="acara-notulensi-search-wrap">
                      <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <input
                        type="text"
                        className="acara-notulensi-search-input"
                        placeholder="Cari notulensi berdasarkan judul rapat..."
                        value={notulensiSearch}
                        onChange={(e) => setNotulensiSearch(e.target.value)}
                        autoFocus
                      />
                      {notulensiSearch && (
                        <button
                          type="button"
                          onClick={() => setNotulensiSearch('')}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Daftar Opsi Notulensi */}
                    <div className="acara-notulensi-options-list">
                      {/* Opsi Kosongkan / Lepas Hubungan */}
                      <div
                        className={`acara-notulensi-option-item ${selectedNotulensiId === null ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedNotulensiId(null);
                          setIsNotulensiDropdownOpen(false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <RotateCcw size={14} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                            Tidak Terhubung (Kosongkan)
                          </span>
                        </div>
                        {selectedNotulensiId === null && <Check size={14} style={{ color: '#2563eb' }} />}
                      </div>

                      {/* Loading State */}
                      {isLoadingNotulensi && (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                          Memuat notulensi rapat...
                        </div>
                      )}

                      {/* Error State */}
                      {!isLoadingNotulensi && notulensiError && (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#dc2626' }}>
                          {notulensiError}
                          <button
                            type="button"
                            onClick={fetchNotulensiData}
                            style={{ display: 'block', margin: '6px auto 0', fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Coba Lagi
                          </button>
                        </div>
                      )}

                      {/* Empty State Not Found */}
                      {!isLoadingNotulensi && !notulensiError && filteredNotulensiNotes.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                          {notulensiNotes.length === 0
                            ? 'Belum ada notulensi rapat di modul Notulensi.'
                            : `Tidak ada notulensi rapat dengan judul "${notulensiSearch}".`}
                        </div>
                      )}

                      {/* Daftar Item Notulensi */}
                      {!isLoadingNotulensi &&
                        filteredNotulensiNotes.map((note) => {
                          const isSelected = selectedNotulensiId === note.id;
                          const noteDate = note.meeting_meta?.date || (note.created_at ? note.created_at.slice(0, 10) : '');
                          return (
                            <div
                              key={note.id}
                              className={`acara-notulensi-option-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => {
                                setSelectedNotulensiId(note.id);
                                setIsNotulensiDropdownOpen(false);
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {note.judul}
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {noteDate ? formatHumanDateIndo(noteDate) : 'Notulensi Rapat'} • {note.created_by_name || 'Kru'}
                                </span>
                              </div>
                              {isSelected && <Check size={14} style={{ color: '#2563eb', flexShrink: 0, marginTop: '4px' }} />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Kru Bertugas (Opsional) */}
            <div className="acara-field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="acara-field-label" style={{ margin: 0 }}>
                  Kru Bertugas (Opsional)
                </label>
                <button
                  type="button"
                  onClick={() => setIsCrewPickerOpen(true)}
                  className="acara-btn-secondary"
                  style={{
                    fontSize: '11.5px',
                    padding: '3px 10px',
                    minHeight: '28px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Users size={13} />
                  <span>{selectedCrew.length > 0 ? `Kelola Kru (${selectedCrew.length})` : '+ Pilih Kru'}</span>
                </button>
              </div>

              {selectedCrew.length > 0 ? (
                <div
                  style={{
                    padding: '10px 12px',
                    background: 'var(--surface-2, #f8fafc)',
                    borderRadius: 'var(--ptv-curve-md)',
                    border: '1.5px solid var(--line-2, #e2e8f0)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--b-600, #1d4ed8)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Users size={13} />
                      {`${selectedCrew.length} Kru Ditugaskan`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCrew([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--dang, #dc2626)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0
                      }}
                    >
                      Kosongkan Semua
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedCrew.map((c) => (
                      <span
                        key={c.id || c.name}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px 3px 6px',
                          background: 'var(--surface, #ffffff)',
                          color: 'var(--ink, #1d4ed8)',
                          borderRadius: 'var(--ptv-curve-pill)',
                          border: '1px solid var(--line, #bfdbfe)',
                          fontSize: '11.5px',
                          fontWeight: 600
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: 'var(--ptv-curve-pill)', background: 'var(--b-600, #2563eb)' }} />
                        <span>{c.name}</span>
                        <span style={{ fontSize: '10.5px', color: 'var(--muted, #64748b)', fontWeight: 500 }}>
                          {`(${c.job || c.tugas || 'Camera Person'})`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCrew((prev) => prev.filter((item) => (item.id || item.name) !== (c.id || c.name)))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--muted, #94a3b8)',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '12px',
                            lineHeight: 1
                          }}
                          title="Hapus dari penugasan"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsCrewPickerOpen(true)}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--surface-2, #f8fafc)',
                    borderRadius: 'var(--ptv-curve-md)',
                    border: '1.5px dashed var(--line-2, #e2e8f0)',
                    color: 'var(--muted, #64748b)',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={15} style={{ color: 'var(--muted, #94a3b8)' }} />
                    <span>Belum ada kru yang ditugaskan untuk kegiatan ini.</span>
                  </span>
                  <span style={{ color: 'var(--b-600, #2563eb)', fontWeight: 600, fontSize: '11.5px' }}>
                    Pilih Kru &rarr;
                  </span>
                </div>
              )}
            </div>

            <fieldset className="acara-color-field">
              <legend>Warna Tampilan</legend>
              <div className="acara-color-options">
                {ACARA_COLORS.map((preset) => (
                  <label key={preset.value} className="acara-color-option">
                    <input type="radio" name="acara-display-color" value={preset.value}
                      checked={displayColor === preset.value}
                      onChange={() => setDisplayColor(preset.value)} />
                    <span className="acara-color-swatch" style={{ backgroundColor: preset.color }} aria-hidden="true" />
                    {preset.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* 6. Catatan / Instruksi Teknis */}
            <div className="acara-field">
              <label className="acara-field-label" htmlFor="ev_form_notes">
                Catatan / Instruksi Teknis
              </label>
              <textarea
                id="ev_form_notes"
                className="acara-field-textarea"
                rows={3}
                placeholder="Tuliskan catatan teknis, penempatan kamera, dresscode kru, atau instruksi khusus untuk peliputan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Modal dengan Aksi Lengkap */}
          <div className="acara-modal-footer">
            {/* Aksi Khusus Mode Edit: Arsipkan & Hapus */}
            {isEditing && eventToEdit && (
              <div className="acara-form-edit-actions">
                {!isConfirmingDelete ? (
                  <>
                    {/* Tombol Arsipkan Acara */}
                    <button
                      type="button"
                      className="acara-btn-archive"
                      onClick={handleArchiveEvent}
                      disabled={isArchiving || isSubmitting}
                      title="Ubah status acara menjadi Selesai (Arsip)"
                    >
                      <Archive size={14} />
                      <span>{isArchiving ? 'Mengarsipkan...' : 'Arsipkan'}</span>
                    </button>

                    {/* Tombol Hapus Acara */}
                    <button
                      type="button"
                      className="acara-btn-danger-outline"
                      onClick={() => setIsConfirmingDelete(true)}
                      disabled={isArchiving || isSubmitting}
                      title="Hapus rekaman acara ini"
                    >
                      <Trash2 size={14} />
                      <span>Hapus Acara</span>
                    </button>
                  </>
                ) : (
                  /* Konfirmasi Hapus Acara */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600 }}>
                      Yakin hapus?
                    </span>
                    <button
                      type="button"
                      style={{
                        padding: '6px 10px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--r-md, 8px)',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={handleDeleteEvent}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '6px 10px',
                        background: 'var(--surface-2, #e2e8f0)',
                        color: 'var(--ink, #334155)',
                        border: '1px solid var(--line, #cbd5e1)',
                        borderRadius: 'var(--r-md, 8px)',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeleting}
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tombol Simpan & Batal */}
            <button
              type="button"
              className="acara-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting || isDeleting || isArchiving}
            >
              Batal
            </button>
            <button
              type="submit"
              className="acara-btn-primary"
              disabled={isSubmitting || isDeleting || isArchiving}
            >
              <Check size={16} />
              {isSubmitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Jadwalkan Acara'}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Pemilihan Kru Bertugas (Sub-modal) */}
      {isCrewPickerOpen && (
        <AcaraCrewModal
          isOpen={isCrewPickerOpen}
          onClose={() => setIsCrewPickerOpen(false)}
          initialCrew={selectedCrew}
          onSaveCrew={(updatedCrew) => {
            setSelectedCrew(updatedCrew);
            setIsCrewPickerOpen(false);
          }}
          eventName={name.trim() || (isEditing ? eventToEdit?.name : 'Acara Baru')}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
