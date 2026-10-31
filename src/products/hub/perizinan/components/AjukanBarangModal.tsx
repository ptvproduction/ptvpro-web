import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { useCrewStore } from '@products/hub/kru/kruStore';
import { CrewMember } from '@products/hub/kru/types';
import { inventarisService } from '@products/hub/inventaris/inventarisService';
import { ItemInventaris, InventarisUnit } from '@products/hub/inventaris/types';
import { resolveInventoryPhotoUrl } from '@products/hub/inventaris/utils/inventoryPhotoUtils';
import { acaraService } from '@products/hub/acara/acaraService';
import { AcaraItem } from '@products/hub/acara/types';

export interface AjukanBarangInitialData {
  eventId?: string;
  eventName?: string;
  date?: string;
  loc?: string;
  pembawa?: string;
  penanggung_jawab?: string;
  gearAllocations?: Array<{
    name: string;
    code: string;
    units: Array<{ unit: number; code?: string; barcode?: string }>;
  }>;
}

interface AjukanBarangModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AjukanBarangInitialData;
  onSubmit: (data: {
    subject: string;
    event?: string;
    event_id?: string;
    start_date: string;
    end_date: string;
    pembawa: string;
    penanggung_jawab: string;
    items: string[];
    unit_ids: string[];
    notes?: string;
  }) => void | Promise<void>;
}

export const AjukanBarangModal: React.FC<AjukanBarangModalProps> = ({
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

  const [selectedEventId, setSelectedEventId] = useState(() => initialData?.eventId || '');
  const [customEventName, setCustomEventName] = useState(() => initialData?.eventName || '');
  const [subject, setSubject] = useState(
    () => (initialData?.eventName ? `Surat Izin Membawa Peralatan: ${initialData.eventName}` : '')
  );
  const [startDate, setStartDate] = useState(() => initialData?.date || todayIso);
  const [endDate, setEndDate] = useState(() => initialData?.date || todayIso);
  const [pembawa, setPembawa] = useState(
    () => initialData?.pembawa || currentUser.full_name || 'Muhammad Dimas Prayoga'
  );
  const [pj, setPj] = useState(() => initialData?.penanggung_jawab || 'M. Zidna Ilma Roup');
  const [notes, setNotes] = useState(
    () => (initialData?.loc ? `Lokasi pelaksanaan kegiatan: ${initialData.loc}` : '')
  );
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

  // Equipment & Unit loading
  const [inventarisItems, setInventarisItems] = useState<ItemInventaris[]>([]);
  const [gearSearch, setGearSearch] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<{
    unitId: string;
    unitCode: string;
    itemName: string;
  }[]>([]);

  useEffect(() => {
    let isMounted = true;
    inventarisService.getInventarisList().then((items: ItemInventaris[]) => {
      if (isMounted) setInventarisItems(items);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const flattenedUnits = useMemo(() => {
    const list: {
      unit: InventarisUnit;
      item: ItemInventaris;
      isAvailable: boolean;
    }[] = [];

    inventarisItems.forEach((item) => {
      if (item.units && item.units.length > 0) {
        item.units.forEach((u) => {
          list.push({
            unit: u,
            item: item,
            isAvailable: u.status_peminjaman === 'tersedia',
          });
        });
      }
    });

    if (!gearSearch.trim()) return list;
    const q = gearSearch.toLowerCase();
    return list.filter(
      (entry) =>
        entry.item.nama_alat.toLowerCase().includes(q) ||
        entry.unit.kode_unit.toLowerCase().includes(q) ||
        (entry.unit.nomor_seri && entry.unit.nomor_seri.toLowerCase().includes(q)) ||
        entry.item.kategori.toLowerCase().includes(q)
    );
  }, [inventarisItems, gearSearch]);

  // Synchronize prefill when modal opens or initialData changes
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
            ? `Surat Izin Membawa Peralatan: ${initialData.eventName}`
            : ''
        );
        if (initialData.date) {
          setStartDate(initialData.date);
          setEndDate(initialData.date);
        } else {
          setStartDate(todayIso);
          setEndDate(todayIso);
        }
        if (initialData.pembawa) {
          setPembawa(initialData.pembawa);
        }
        if (initialData.penanggung_jawab) {
          setPj(initialData.penanggung_jawab);
        }
        if (initialData.loc) {
          setNotes((prev) => prev || `Lokasi pelaksanaan kegiatan: ${initialData.loc}`);
        }

        // Prefill allocated gear if available
        if (initialData.gearAllocations && initialData.gearAllocations.length > 0) {
          const preselected: { unitId: string; unitCode: string; itemName: string }[] = [];
          initialData.gearAllocations.forEach((alloc) => {
            if (alloc.units && alloc.units.length > 0) {
              alloc.units.forEach((u) => {
                const found = flattenedUnits.find(
                  (fu) =>
                    fu.unit.kode_unit === u.code ||
                    (u.barcode && fu.unit.nomor_seri === u.barcode) ||
                    (fu.item.nama_alat.toLowerCase().includes(alloc.name.toLowerCase()) &&
                      fu.unit.status_peminjaman === 'tersedia')
                );
                if (found) {
                  if (!preselected.some((p) => p.unitId === found.unit.id)) {
                    preselected.push({
                      unitId: found.unit.id,
                      unitCode: found.unit.kode_unit,
                      itemName: `${found.item.nama_alat} (${found.unit.kode_unit})`,
                    });
                  }
                } else if (u.code) {
                  preselected.push({
                    unitId: `unit-${u.code}`,
                    unitCode: u.code,
                    itemName: `${alloc.name} (${u.code})`,
                  });
                }
              });
            }
          });
          if (preselected.length > 0) {
            setSelectedUnits(preselected);
          }
        }
      }
    }
  }, [isOpen, initialData, flattenedUnits.length]);

  const toggleUnitSelection = (unit: InventarisUnit, item: ItemInventaris, isAvailable: boolean) => {
    if (!isAvailable) return;

    setSelectedUnits((prev) => {
      const exists = prev.some((u) => u.unitId === unit.id);
      if (exists) {
        return prev.filter((u) => u.unitId !== unit.id);
      } else {
        return [
          ...prev,
          {
            unitId: unit.id,
            unitCode: unit.kode_unit,
            itemName: `${item.nama_alat} (${unit.kode_unit})`,
          },
        ];
      }
    });
  };

  // Auto-fill when choosing an event from live Staging data
  const handleEventChange = (evId: string) => {
    setSelectedEventId(evId);
    if (!evId) return;

    const ev = acaraList.find((e) => e.id === evId);
    if (ev) {
      setCustomEventName(ev.name);
      if (!subject || subject.startsWith('Surat Izin Membawa Peralatan:')) {
        setSubject(`Surat Izin Membawa Peralatan: ${ev.name}`);
      }
      if (ev.date) {
        setStartDate(ev.date);
        setEndDate(ev.date);
      }
      if (ev.loc && !notes) {
        setNotes(`Lokasi pelaksanaan kegiatan: ${ev.loc}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!subject.trim()) {
      setErrorMsg('Perihal / keperluan membawa alat wajib diisi.');
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
    if (selectedUnits.length === 0) {
      setErrorMsg('Pilih minimal 1 unit peralatan yang dibawa.');
      return;
    }
    if (!pembawa.trim()) {
      setErrorMsg('Kru pembawa peralatan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    Promise.resolve(
      onSubmit({
        subject: subject.trim(),
        event: customEventName.trim() || undefined,
        event_id: selectedEventId || undefined,
        start_date: startDate,
        end_date: endDate,
        pembawa: pembawa.trim(),
        penanggung_jawab: pj.trim(),
        items: selectedUnits.map((u) => u.itemName),
        unit_ids: selectedUnits.map((u) => u.unitId),
        notes: notes.trim() || undefined,
      })
    )
      .catch((err: any) => {
        setErrorMsg(err.message || 'Gagal mengirimkan Surat Izin Pengeluaran Barang.');
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
                background: 'rgba(147,51,234,0.12)',
                color: '#7c3aed',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fa-solid fa-boxes-packing" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                Pengajuan Izin Bawa Barang Baru
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                Permohonan izin membawa inventaris peralatan keluar studio
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
                  Nomor Surat Bawa Barang Resmi
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
                      color: '#7c3aed',
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

            {/* Field: Perihal Keperluan */}
            <div className="prz-modal-field">
              <label className="prz-modal-label">
                Perihal / Keperluan Membawa Alat <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="prz-modal-input"
                placeholder="Contoh: Izin Membawa Peralatan Audio & Wireless Mic Liputan Luar"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Field: Rentang Tanggal */}
            <div className="prz-modal-field prz-date-grid">
              <div>
                <label className="prz-modal-label">
                  Tanggal Mulai Pinjam <span style={{ color: '#ef4444' }}>*</span>
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
                  Tanggal Selesai / Kembali <span style={{ color: '#ef4444' }}>*</span>
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

            {/* Field: Kru Pembawa & Penanggung Jawab */}
            <div className="prz-modal-field prz-date-grid">
              <div>
                <label className="prz-modal-label">
                  Kru Pembawa Barang <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="prz-modal-select"
                  value={pembawa}
                  onChange={(e) => setPembawa(e.target.value)}
                  required
                >
                  {crewList.map((c) => (
                    <option key={c.id} value={c.full_name}>
                      {c.full_name} ({c.ptv_id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="prz-modal-label">
                  Penanggung Jawab Studio <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="prz-modal-input"
                  value={pj}
                  onChange={(e) => setPj(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Field: Pemilihan Alat & Unit Fisik */}
            <div className="prz-modal-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="prz-modal-label" style={{ margin: 0 }}>
                  Peralatan Inventaris & Unit Fisik <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#7c3aed' }}>
                  {selectedUnits.length} Unit Dipilih
                </span>
              </div>

              {/* Quick Search Alat */}
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <i
                  className="fa-solid fa-magnifying-glass"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '12.5px', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  className="prz-modal-input"
                  placeholder="Cari alat berdasarkan nama, kode unit, kategori..."
                  value={gearSearch}
                  onChange={(e) => setGearSearch(e.target.value)}
                  style={{ paddingLeft: '38px', paddingRight: '14px', height: '38px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Selection Box */}
              <div className="prz-selection-box">
                {flattenedUnits.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                    Tidak ada unit peralatan yang cocok.
                  </div>
                ) : (
                  flattenedUnits.map(({ unit, item, isAvailable }) => {
                    const isChecked = selectedUnits.some((u) => u.unitId === unit.id);
                    return (
                      <div
                        key={unit.id}
                        className={`prz-selection-item ${isChecked ? 'selected' : ''}`}
                        onClick={() => toggleUnitSelection(unit, item, isAvailable)}
                        style={{
                          opacity: isAvailable ? 1 : 0.5,
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isAvailable}
                          onChange={() => {}} // handled by click
                          style={{ width: '16px', height: '16px', accentColor: '#7c3aed', cursor: isAvailable ? 'pointer' : 'not-allowed' }}
                        />
                        {/* Foto Asli Inventaris dengan Fallback Ikon Kamera */}
                        {(() => {
                          const rawPhoto = (unit as any).foto_url || item.foto_url;
                          const photoUrl = resolveInventoryPhotoUrl(rawPhoto);
                          return (
                            <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={item.nama_alat}
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
                                  display: photoUrl ? 'none' : 'grid',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: 'var(--r-md, 8px)',
                                  background: isAvailable ? 'rgba(147,51,234,0.1)' : 'rgba(100,116,139,0.1)',
                                  color: isAvailable ? '#7c3aed' : '#64748b',
                                  placeItems: 'center',
                                  fontSize: '12px',
                                }}
                              >
                                <i className="fa-solid fa-camera" />
                              </div>
                            </div>
                          );
                        })()}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                            {item.nama_alat}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Unit: <b style={{ color: 'var(--ink-2)' }}>{unit.kode_unit}</b> • {unit.kondisi}
                            {unit.nomor_seri ? ` • SN: ${unit.nomor_seri}` : ''}
                            {!isAvailable && (
                              <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: '6px' }}>
                                (Sedang Dipinjam)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Field: Lokasi / Catatan */}
            <div className="prz-modal-field">
              <label className="prz-modal-label">Catatan Tambahan / Lokasi Tujuan</label>
              <textarea
                className="prz-modal-textarea"
                rows={2}
                placeholder="Lokasi penggunaan alat, keperluan operasional, dsb..."
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
                background: '#7c3aed',
                borderColor: '#7c3aed',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.28)',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              <i className={isSubmitting ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-paper-plane"} style={{ marginRight: '6px' }} />
              {isSubmitting ? 'Menerbitkan Izin Barang...' : 'Kirim Pengajuan Izin Barang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
