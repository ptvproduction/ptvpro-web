/**
 * PTV PRO — Modul Acara
 * Modal Kelola Kru Bertugas (AcaraCrewModal)
 * Terhubung langsung ke data kanonikal kru aktif Supabase Staging.
 * Eliminasi dummy data & filter khusus personel Kru aktif asli.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AcaraItem, AcaraCrewMember, LEGACY_CREW_JOB_PRESETS } from '../types';
import { acaraService } from '../acaraService';
import { useAcara } from '../context/AcaraContext';
import { X, Search, Check, Briefcase, UserCheck, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

export interface AcaraCrewModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: AcaraItem | null;
  initialCrew?: AcaraCrewMember[];
  onSaveCrew?: (crew: AcaraCrewMember[]) => void | Promise<void>;
  eventName?: string;
}

export const AcaraCrewModal: React.FC<AcaraCrewModalProps> = ({
  isOpen,
  onClose,
  event,
  initialCrew,
  onSaveCrew,
  eventName
}) => {
  const acaraCtx = useAcara();
  const updateEventCrew = acaraCtx?.updateEventCrew;

  // State kandidat kru aktif asli dari database backend
  const [candidates, setCandidates] = useState<AcaraCrewMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // State pencarian
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'acara-crew-modal',
  });

  // Helper untuk mendapatkan key stabil kru
  const getCrewKey = (c: { id?: string; ptv_id?: string; name: string }): string => {
    if (c.ptv_id && c.ptv_id.trim()) return `ptv:${c.ptv_id.trim().toUpperCase()}`;
    if (c.id && c.id.trim()) return `id:${c.id.trim()}`;
    return `name:${c.name.trim().toLowerCase()}`;
  };

  // Map identifier kru yang ditugaskan -> AcaraCrewMember
  // Key stabil: c.ptv_id || c.id || c.name.toLowerCase()
  const [assignedMap, setAssignedMap] = useState<Map<string, AcaraCrewMember>>(() => {
    const sourceCrew = initialCrew !== undefined ? initialCrew : (event?.crew || []);
    const map = new Map<string, AcaraCrewMember>();
    sourceCrew.forEach((c) => {
      const key = getCrewKey(c);
      map.set(key, {
        id: c.id || `kru-${Date.now()}-${map.size}`,
        ptv_id: c.ptv_id,
        name: c.name,
        photo: c.photo || '',
        division: c.division || 'Technical',
        role: c.role || 'Kru',
        job: c.job || c.tugas || 'Camera Person',
        tugas: c.job || c.tugas || 'Camera Person'
      });
    });
    return map;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pelacak gambar foto yang gagal dimuat (404 / broken)
  const [failedImageKeys, setFailedImageKeys] = useState<Set<string>>(new Set());

  // Muat kandidat kru aktif resmi dari backend saat modal dibuka
  const loadCandidates = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await acaraService.getActiveCrewCandidates();
      setCandidates(data);
    } catch (err: any) {
      console.error('[AcaraCrewModal] Gagal memuat kandidat kru aktif:', err);
      setLoadError(err.message || 'Gagal memuat daftar kru aktif dari server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Inisialisasi data saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      loadCandidates();
      setSearch('');

      // Tentukan sumber data kru terpilih (prioritaskan initialCrew, lalu event.crew)
      const sourceCrew = initialCrew !== undefined ? initialCrew : (event?.crew || []);
      const map = new Map<string, AcaraCrewMember>();

      sourceCrew.forEach((c) => {
        const key = getCrewKey(c);
        map.set(key, {
          id: c.id || `kru-${Date.now()}-${map.size}`,
          ptv_id: c.ptv_id,
          name: c.name,
          photo: c.photo || '',
          division: c.division || 'Technical',
          role: c.role || 'Kru',
          job: c.job || c.tugas || 'Camera Person',
          tugas: c.job || c.tugas || 'Camera Person'
        });
      });

      setAssignedMap(map);

      const timer = setTimeout(() => searchInputRef.current?.focus(), 60);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [isOpen, event, initialCrew]);

  // Gabungkan kandidat backend dengan kru yang sudah ada di assignedMap
  // Hal ini menjaga agar kru penugasan lama tidak hilang jika ada nama historis
  const unifiedPool = useMemo(() => {
    const poolMap = new Map<string, AcaraCrewMember>();

    // 1. Masukkan seluruh kandidat kru aktif resmi
    candidates.forEach((c) => {
      poolMap.set(getCrewKey(c), c);
    });

    // 2. Masukkan kru yang sudah ditugaskan jika belum ada di pool
    assignedMap.forEach((c, key) => {
      if (!poolMap.has(key)) {
        poolMap.set(key, c);
      }
    });

    return Array.from(poolMap.values());
  }, [candidates, assignedMap]);

  // Filter kandidat berdasarkan kata kunci pencarian
  const filteredCrew = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unifiedPool;
    return unifiedPool.filter((c) => {
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchDiv = (c.division || '').toLowerCase().includes(q);
      const matchRole = (c.role || '').toLowerCase().includes(q);
      const matchPtvId = (c.ptv_id || '').toLowerCase().includes(q);
      return matchName || matchDiv || matchRole || matchPtvId;
    });
  }, [unifiedPool, search]);

  // Pisahkan kru: Ditugaskan vs Belum Ditugaskan
  const assignedList = useMemo(() => {
    return filteredCrew.filter((c) => assignedMap.has(getCrewKey(c)));
  }, [filteredCrew, assignedMap]);

  const unassignedList = useMemo(() => {
    return filteredCrew.filter((c) => !assignedMap.has(getCrewKey(c)));
  }, [filteredCrew, assignedMap]);

  // Toggle penugasan kru
  const toggleCrew = (c: AcaraCrewMember) => {
    const key = getCrewKey(c);
    setAssignedMap((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          id: c.id,
          ptv_id: c.ptv_id,
          name: c.name,
          photo: c.photo || '',
          division: c.division || 'Technical',
          role: c.role || 'Kru',
          job: c.job || 'Camera Person',
          tugas: c.job || 'Camera Person'
        });
      }
      return next;
    });
  };

  // Ubah tugas / job spesifik untuk kru yang ditugaskan
  const setCrewJob = (key: string, jobTitle: string) => {
    setAssignedMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(key);
      if (cur) {
        next.set(key, {
          ...cur,
          job: jobTitle,
          tugas: jobTitle
        });
      }
      return next;
    });
  };

  // Simpan hasil pemilihan kru
  const handleSave = async () => {
    setIsSubmitting(true);
    const crewArray = Array.from(assignedMap.values());

    try {
      if (onSaveCrew) {
        // Mode Form Picker: kirim ke parent state tanpa mutasi DB langsung
        await onSaveCrew(crewArray);
        onClose();
      } else if (event?.id && updateEventCrew) {
        // Mode Standalone: mutasi langsung ke backend via Context
        const ok = await updateEventCrew(event.id, crewArray);
        if (ok) {
          onClose();
        }
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('[AcaraCrewModal] Gagal menyimpan kru:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentTitle = eventName || event?.name || 'Kegiatan';

  const modalContent = (
    <div
      className="acara-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acara-crew-modal-title"
    >
      <div ref={modalRef} className="acara-modal-sheet" style={{ maxWidth: '680px' }}>
        {/* Header Modal */}
        <div className="acara-modal-header">
          <div>
            <h3 className="acara-modal-title" id="acara-crew-modal-title">
              Kelola Kru Bertugas
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              {assignedMap.size} kru ditugaskan untuk <strong>{currentTitle}</strong>
            </p>
          </div>
          <button
            type="button"
            className="acara-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog kelola kru"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Modal */}
        <div className="acara-modal-body">
          {/* Kotak Pencarian */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 14px',
              background: 'var(--surface-2, #f8fafc)',
              borderRadius: 'var(--ptv-curve-md)',
              border: '1.5px solid var(--line, #e2e8f0)',
              marginBottom: '14px'
            }}
          >
            <Search size={16} style={{ color: 'var(--muted, #94a3b8)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari kru aktif berdasarkan nama, divisi, atau peran..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                width: '100%',
                color: 'var(--ink, #0f172a)'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '12px'
                }}
                title="Bersihkan pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* Banner Error jika pemuatan gagal */}
          {loadError && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--ptv-curve-md)',
                color: '#991b1b',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={loadCandidates}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--ptv-curve-pill)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={11} /> Coba Lagi
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted, #64748b)', fontSize: '13px' }}>
              <RefreshCw size={24} className="fa-spin" style={{ margin: '0 auto 8px', display: 'block', color: '#2563eb' }} />
              Memuat data personel kru aktif dari Supabase Staging...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Bagian 1: Kru Ditugaskan */}
              {assignedList.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 750,
                      color: 'var(--b-600, #1d4ed8)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <UserCheck size={14} /> Kru Ditugaskan ({assignedList.length})
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {assignedList.map((c) => {
                      const key = getCrewKey(c);
                      const assignedInfo = assignedMap.get(key);
                      const currentJob = assignedInfo?.job || 'Camera Person';
                      const initials = c.name
                        .trim()
                        .split(/\s+/)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      const isImgFailed = failedImageKeys.has(key);
                      const hasPhoto = Boolean(c.photo && c.photo.trim() && !isImgFailed);

                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            padding: '12px 14px',
                            borderRadius: 'var(--ptv-curve-lg)',
                            border: '1.5px solid var(--b-600, #2563eb)',
                            background: 'rgba(37, 99, 235, 0.12)',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => toggleCrew(c)}
                              aria-label={`Lepaskan penugasan ${c.name}`}
                              style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
                            />

                            {hasPhoto ? (
                              <img
                                src={c.photo}
                                alt={c.name}
                                onError={() => setFailedImageKeys((prev) => new Set(prev).add(key))}
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: 'var(--ptv-curve-pill)',
                                  objectFit: 'cover',
                                  flexShrink: 0,
                                  border: '1.5px solid var(--line, #93c5fd)'
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: 'var(--ptv-curve-pill)',
                                  background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                                  color: '#1e40af',
                                  fontWeight: 750,
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  border: '1px solid var(--line, #93c5fd)'
                                }}
                              >
                                {initials}
                              </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--ink, #0f172a)' }}>{c.name}</span>
                                {c.ptv_id && (
                                  <span style={{ fontSize: '10.5px', color: 'var(--muted, #64748b)', background: 'var(--surface)', padding: '1px 6px', borderRadius: 'var(--ptv-curve-xs)' }}>
                                    {c.ptv_id}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', marginTop: '2px' }}>
                                {c.division || 'Technical'} • {c.role || 'Kru'}
                              </div>
                            </div>

                            <span
                              style={{
                                background: 'rgba(37, 99, 235, 0.2)',
                                color: 'var(--b-400, #1e40af)',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 'var(--ptv-curve-pill)',
                                flexShrink: 0
                              }}
                            >
                              ✓ Ditugaskan
                            </span>
                          </div>

                          {/* Bidang Tugas & 10 Preset Tugas Legacy */}
                          <div
                            style={{
                              paddingTop: '8px',
                              borderTop: '1px dashed var(--line, #bfdbfe)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <label
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--b-400, #1e40af)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <Briefcase size={12} /> Tugas Operasional:
                            </label>
                            <input
                              type="text"
                              value={currentJob}
                              placeholder="Tuliskan tugas operasional kru..."
                              onChange={(e) => setCrewJob(key, e.target.value)}
                              style={{
                                fontSize: '12.5px',
                                padding: '6px 10px',
                                borderRadius: 'var(--ptv-curve-md)',
                                fontWeight: 600,
                                background: 'var(--surface, #ffffff)',
                                border: '1.5px solid var(--line, #bfdbfe)',
                                outline: 'none',
                                color: 'var(--ink, #0f172a)'
                              }}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                              {LEGACY_CREW_JOB_PRESETS.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setCrewJob(key, preset)}
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: 'var(--ptv-curve-pill)',
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    background: currentJob === preset ? 'var(--b-600, #2563eb)' : 'var(--surface)',
                                    color: currentJob === preset ? '#ffffff' : 'var(--ink-2, #1d4ed8)',
                                    borderColor: currentJob === preset ? 'var(--b-600, #2563eb)' : 'var(--line, #bfdbfe)',
                                    transition: 'all 0.1s ease'
                                  }}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bagian 2: Kandidat Kru Aktif Belum Ditugaskan */}
              {unassignedList.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 750,
                      color: 'var(--muted, #64748b)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Users size={14} /> Kandidat Kru Aktif ({unassignedList.length})
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {unassignedList.map((c) => {
                      const key = getCrewKey(c);
                      const initials = c.name
                        .trim()
                        .split(/\s+/)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      const isImgFailed = failedImageKeys.has(key);
                      const hasPhoto = Boolean(c.photo && c.photo.trim() && !isImgFailed);

                      return (
                        <div
                          key={key}
                          onClick={() => toggleCrew(c)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '9px 12px',
                            borderRadius: 'var(--ptv-curve-md)',
                            border: '1px solid var(--line, #e2e8f0)',
                            background: 'var(--surface-2, #ffffff)',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => toggleCrew(c)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Tugaskan ${c.name}`}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                          />

                          {hasPhoto ? (
                            <img
                              src={c.photo}
                              alt={c.name}
                              onError={() => setFailedImageKeys((prev) => new Set(prev).add(key))}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--ptv-curve-pill)',
                                objectFit: 'cover',
                                flexShrink: 0,
                                border: '1px solid var(--line, #e2e8f0)'
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--ptv-curve-pill)',
                                background: 'var(--surface)',
                                color: 'var(--muted, #64748b)',
                                fontWeight: 750,
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: '1px solid var(--line, #e2e8f0)'
                              }}
                            >
                              {initials}
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 650, fontSize: '13.5px', color: 'var(--ink, #0f172a)' }}>
                                {c.name}
                              </span>
                              {c.ptv_id && (
                                <span style={{ fontSize: '10px', color: 'var(--muted, #64748b)', background: 'var(--surface)', padding: '1px 5px', borderRadius: 'var(--ptv-curve-xs)' }}>
                                  {c.ptv_id}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', marginTop: '1px' }}>
                              {c.division || 'Technical'} • {c.role || 'Kru'}
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--b-400, #2563eb)',
                              fontWeight: 650,
                              background: 'var(--surface)',
                              border: '1px solid var(--line)',
                              padding: '3px 8px',
                              borderRadius: 'var(--ptv-curve-pill)',
                              flexShrink: 0
                            }}
                          >
                            + Pilih
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state jika pencarian tidak menemukan hasil */}
              {filteredCrew.length === 0 && (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted, #64748b)', fontSize: '13px' }}>
                  Tidak ada kru aktif yang cocok dengan kata kunci &quot;{search}&quot;.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="acara-modal-footer">
          <button
            type="button"
            className="acara-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="acara-btn-primary"
            onClick={handleSave}
            disabled={isSubmitting || isLoading}
          >
            <Check size={16} />
            {isSubmitting ? 'Menyimpan...' : `Selesai Memilih (${assignedMap.size} Kru)`}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
