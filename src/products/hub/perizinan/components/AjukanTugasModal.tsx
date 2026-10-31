import { createPortal } from 'react-dom';
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { useCrewStore } from '@products/hub/kru/kruStore';
import { CrewMember } from '@products/hub/kru/types';
import { acaraService } from '@products/hub/acara/acaraService';
import { AcaraItem } from '@products/hub/acara/types';

export interface AjukanTugasInitialData {
  eventId?: string;
  eventName?: string;
  date?: string;
  loc?: string;
  crew?: string[];
  penanggung_jawab?: string;
}

interface AjukanTugasModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AjukanTugasInitialData;
  onSubmit: (data: {
    subject: string;
    event?: string;
    event_id?: string;
    start_date: string;
    end_date: string;
    penanggung_jawab: string;
    recipients: string[];
    notes?: string;
  }) => void | Promise<void>;
}

export const AjukanTugasModal: React.FC<AjukanTugasModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSubmit,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({ isOpen, onClose, modalRef });

  const { members, getCurrentUser } = useCrewStore();
  const crewList: CrewMember[] = members;
  const currentUser = getCurrentUser();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [subject, setSubject] = useState(
    () => (initialData?.eventName ? `Liputan & Penugasan: ${initialData.eventName}` : '')
  );
  const [selectedEventId, setSelectedEventId] = useState(() => initialData?.eventId || '');
  const [customEventName, setCustomEventName] = useState(() => initialData?.eventName || '');
  const [startDate, setStartDate] = useState(() => initialData?.date || todayIso);
  const [endDate, setEndDate] = useState(() => initialData?.date || todayIso);
  const [pj, setPj] = useState(() => initialData?.penanggung_jawab || currentUser.full_name || 'M. Zidna Ilma Roup');
  const [selectedCrew, setSelectedCrew] = useState<string[]>(() => initialData?.crew || []);
  const [crewSearch, setCrewSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Acara Data State from Supabase Staging
  const [acaraList, setAcaraList] = useState<AcaraItem[]>([]);
  const [acaraLoading, setAcaraLoading] = useState(false);
  const [acaraError, setAcaraError] = useState<string | null>(null);

  const fetchAcara = useCallback(async () => {
    try {
      setAcaraLoading(true);
      setAcaraError(null);
      const events = await acaraService.getEvents();
      setAcaraList(events || []);
    } catch (err: unknown) {
      setAcaraError((err as Error).message || 'Gagal memuat daftar agenda acara.');
    } finally {
      setAcaraLoading(false);
    }
  }, []);

  // Synchronize state when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsSubmitting(false);
      fetchAcara();
      if (initialData) {
        setSelectedEventId(initialData.eventId || '');
        setCustomEventName(initialData.eventName || '');
        setSubject(
          initialData.eventName
            ? `Liputan & Penugasan: ${initialData.eventName}`
            : ''
        );
        if (initialData.date) {
          setStartDate(initialData.date);
          setEndDate(initialData.date);
        } else {
          setStartDate(todayIso);
          setEndDate(todayIso);
        }
        if (initialData.penanggung_jawab) {
          setPj(initialData.penanggung_jawab);
        }
        if (initialData.crew && initialData.crew.length > 0) {
          setSelectedCrew(initialData.crew);
        }
      }
    }
  }, [isOpen, initialData, fetchAcara]);

  // Kriteria Kru Operasional Berstatus Aktif (Tidak mencakup Nonaktif, Pengarah, Pembina, Pendiri/Pengasuh)
  const isOperationalActiveCrew = (c: CrewMember): boolean => {
    if (c.status_kru !== 'Aktif') return false;
    const cat = (c.category || '').toLowerCase().trim();
    if (
      cat.includes('pengarah') ||
      cat.includes('pembina') ||
      cat.includes('pendiri') ||
      cat.includes('pengasuh') ||
      cat.includes('penasihat')
    ) {
      return false;
    }
    const pos = (c.position || '').toLowerCase().trim();
    const div = (c.division || '').toLowerCase().trim();
    if (
      pos.includes('pengarah') ||
      pos.includes('pembina') ||
      pos.includes('pengasuh') ||
      div.includes('pengarah') ||
      div.includes('pembina')
    ) {
      return false;
    }
    return true;
  };

  const eligibleCrewList = useMemo(() => {
    return crewList.filter(isOperationalActiveCrew);
  }, [crewList]);

  // Sanitize selectedCrew: pastikan personel yang tidak memenuhi syarat tidak tertinggal di state
  useEffect(() => {
    if (eligibleCrewList.length > 0) {
      const eligibleNames = new Set(eligibleCrewList.map((c) => c.full_name));
      setSelectedCrew((prev) => prev.filter((name) => eligibleNames.has(name)));
    }
  }, [eligibleCrewList]);

  // Auto-fill when choosing an event from live Staging data
  const handleEventChange = (evId: string) => {
    setSelectedEventId(evId);
    if (!evId) return;

    const ev = acaraList.find((e) => e.id === evId);
    if (ev) {
      setCustomEventName(ev.name);
      if (!subject || subject.startsWith('Liputan & Penugasan:')) {
        setSubject(`Liputan Siaran Langsung & Dokumentasi: ${ev.name}`);
      }
      if (ev.date) {
        setStartDate(ev.date);
        setEndDate(ev.date);
      }
      // Pre-select crew registered in this event if any and eligible
      if (ev.crew && ev.crew.length > 0) {
        const eligibleNames = new Set(eligibleCrewList.map((c) => c.full_name));
        const evCrewNames = ev.crew
          .map((c) => c.name)
          .filter((name) => eligibleNames.has(name));
        setSelectedCrew((prev) => Array.from(new Set([...prev, ...evCrewNames])));
      }
    }
  };

  const filteredCrew = useMemo(() => {
    if (!crewSearch.trim()) return eligibleCrewList;
    const q = crewSearch.toLowerCase();
    return eligibleCrewList.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.ptv_id.toLowerCase().includes(q) ||
        (c.division && c.division.toLowerCase().includes(q)) ||
        (c.position && c.position.toLowerCase().includes(q))
    );
  }, [eligibleCrewList, crewSearch]);

  const toggleCrewSelection = (name: string) => {
    setSelectedCrew((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!subject.trim()) {
      setErrorMsg('Perihal / judul penugasan wajib diisi.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Tanggal mulai dan selesai wajib ditentukan.');
      return;
    }
    if (endDate < startDate) {
      setErrorMsg('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }
    if (selectedCrew.length === 0) {
      setErrorMsg('Pilih minimal 1 personel kru yang ditugaskan.');
      return;
    }

    const finalEventName = selectedEventId
      ? acaraList.find((e) => e.id === selectedEventId)?.name || customEventName
      : customEventName;

    setIsSubmitting(true);
    Promise.resolve(
      onSubmit({
        subject: subject.trim(),
        event: finalEventName || undefined,
        event_id: selectedEventId || undefined,
        start_date: startDate,
        end_date: endDate,
        penanggung_jawab: pj.trim(),
        recipients: selectedCrew,
        notes: notes.trim() || undefined,
      })
    )
      .catch((err: any) => {
        setErrorMsg(err.message || 'Gagal memproses Surat Tugas.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (!isOpen) return null;

  const content = (
    <div className="prz-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={modalRef}
        className="prz-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px' }}
      >
        {/* Header */}
        <div className="prz-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--r-md, 10px)',
                background: 'rgba(37,99,235,0.12)',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fa-solid fa-file-signature" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                Pengajuan Surat Tugas Baru
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                Permohonan penugasan operasional & liputan kru PTV
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup Modal"
            style={{ minWidth: '40px', minHeight: '40px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '16px' }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="prz-modal-body">
            {/* Banner Status Awal */}
            <div className="prz-modal-banner">
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Nomor Surat Tugas Resmi
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
                  — (Diterbitkan Otomatis Saat Disetujui Eksekutif)
                </div>
              </div>
              <span className="prz-status-badge pending">
                <i className="fa-regular fa-clock" style={{ fontSize: '10px' }} /> Menunggu ACC
              </span>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  borderRadius: 'var(--r-md, 10px)',
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <i className="fa-solid fa-triangle-exclamation" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Field: Terkait Acara */}
            <div className="prz-modal-field">
              <label className="prz-modal-label">Terkait Acara / Agenda Kegiatan</label>
              <select
                className="prz-modal-select"
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}
                disabled={acaraLoading}
              >
                <option value="">
                  {acaraLoading
                    ? 'Memuat agenda acara studio...'
                    : acaraError
                    ? 'Gagal memuat agenda acara — Pilih nama bebas di bawah'
                    : '-- Pilih dari Agenda Acara (Opsional) --'}
                </option>
                {acaraList.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.date})
                  </option>
                ))}
              </select>
              {acaraError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#dc2626' }}>{acaraError}</span>
                  <button
                    type="button"
                    onClick={fetchAcara}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    Coba lagi
                  </button>
                </div>
              )}
              <div style={{ marginTop: '6px' }}>
                <input
                  type="text"
                  className="prz-modal-input"
                  placeholder="Atau ketik nama acara bebas..."
                  value={customEventName}
                  onChange={(e) => setCustomEventName(e.target.value)}
                />
              </div>
            </div>

            {/* Field: Perihal Penugasan */}
            <div className="prz-modal-field">
              <label className="prz-modal-label">
                Perihal / Judul Penugasan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="prz-modal-input"
                placeholder="Contoh: Liputan Siaran Langsung Pengajian Akbar Maulid"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Field: Rentang Tanggal */}
            <div className="prz-modal-field prz-date-grid">
              <div>
                <label className="prz-modal-label">
                  Tanggal Mulai <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="prz-modal-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="prz-modal-label">
                  Tanggal Selesai <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="prz-modal-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Field: Penanggung Jawab */}
            <div className="prz-modal-field">
              <label className="prz-modal-label">
                Penanggung Jawab Tugas <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="prz-modal-input"
                placeholder="Nama penanggung jawab operasional..."
                value={pj}
                onChange={(e) => setPj(e.target.value)}
                required
              />
            </div>

            {/* Field: Pemilihan Personel Kru */}
            <div className="prz-modal-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="prz-modal-label" style={{ margin: 0 }}>
                  Personel Kru yang Ditugaskan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
                  {selectedCrew.length} Kru Terpilih
                </span>
              </div>

              {/* Quick Search Kru */}
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <i
                  className="fa-solid fa-magnifying-glass"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '12.5px', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  className="prz-modal-input"
                  placeholder="Cari kru berdasarkan nama, nomor, divisi..."
                  value={crewSearch}
                  onChange={(e) => setCrewSearch(e.target.value)}
                  style={{ paddingLeft: '38px', paddingRight: '14px', height: '38px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Selection Box */}
              <div className="prz-selection-box">
                {filteredCrew.map((c) => {
                  const isChecked = selectedCrew.includes(c.full_name);
                  return (
                    <div
                      key={c.id}
                      className={`prz-selection-item ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleCrewSelection(c.full_name)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent div click
                        style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      {/* Foto Profil Asli Kru dengan Fallback Inisial */}
                      <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                        {c.foto_url ? (
                          <img
                            src={c.foto_url}
                            alt={c.full_name}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: 'var(--r-md, 8px)',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'grid';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            display: c.foto_url ? 'none' : 'grid',
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--r-md, 8px)',
                            background: 'rgba(37,99,235,0.1)',
                            color: '#2563eb',
                            placeItems: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {c.full_name.slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                          {c.full_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {c.ptv_id} • {c.position} ({c.division})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Field: Catatan Tambahan */}
            <div className="prz-modal-field">
              <label className="prz-modal-label">Catatan Tambahan / Lokasi Tugas</label>
              <textarea
                className="prz-modal-textarea"
                rows={2}
                placeholder="Rincian arahan peliputan, perlengkapan yang disiapkan, dsb..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="prz-modal-footer">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{ minHeight: '42px', borderRadius: 'var(--ptv-curve-pill)' }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn pri"
              disabled={isSubmitting}
              style={{
                flex: 1,
                minHeight: '42px',
                borderRadius: 'var(--ptv-curve-pill)',
                background: '#2563eb',
                borderColor: '#2563eb',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              <i className={isSubmitting ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-paper-plane"} style={{ marginRight: '6px' }} />
              {isSubmitting ? 'Memproses Surat Tugas...' : 'Kirim Pengajuan Surat Tugas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
