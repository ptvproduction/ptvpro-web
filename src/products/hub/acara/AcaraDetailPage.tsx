/**
 * PTV PRO — Modul Acara
 * Halaman Detail Acara Liputan & Produksi Studio (/hub/acara/:id)
 * Porting lengkap pgAcaraDetail (page-dasbor.php L15530–15874)
 * Layout 2 Kolom Asimetris Desktop (Info, Rundown, Catatan/Notulensi, Alat | Kru, Dokumen, Aksi)
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAcara } from './context/AcaraContext';
import { AcaraFormModal } from './components/AcaraFormModal';
import { AcaraCrewModal } from './components/AcaraCrewModal';
import { AcaraGearModal } from './components/AcaraGearModal';
import { AcaraLinkNoteModal } from './components/AcaraLinkNoteModal';
import { AcaraStatusModal } from './components/AcaraStatusModal';
import { AcaraDeleteModal } from './components/AcaraDeleteModal';
import { formatHumanDateIndo, getHijriInfo } from './utils/acaraDateUtils';
import { getAcaraStatusInfo } from './utils/acaraStatusUtils';
import { useSessionStore } from '@core/session';
import { AjukanTugasModal } from '@products/hub/perizinan/components/AjukanTugasModal';
import { AjukanBarangModal } from '@products/hub/perizinan/components/AjukanBarangModal';
import { DocDetailDrawer } from '@products/hub/dokumen-saya/components/DocDetailDrawer';
import { useDocsStore } from '@products/hub/dokumen-saya/docsStore';
import { dokumenService } from '@products/hub/dokumen-saya/dokumenService';
import { PtvDocument } from '@products/hub/dokumen-saya/mock/docsMockData';
import { resolveInventoryPhotoUrl } from '@products/hub/inventaris/utils/inventoryPhotoUtils';
import {
  ArrowLeft,
  Calendar,
  Users,
  Boxes,
  FileText,
  Link as LinkIcon,
  Unlink,
  Edit,
  Trash2,
  RotateCw,
  FileSignature,
  ShieldCheck,
  Camera,
  Barcode,
  Info,
  Briefcase,
  ExternalLink
} from 'lucide-react';

export const AcaraDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getEventById,
    unlinkNotulensi,
    getLinkedNotulensi,
    updateEventGear,
    updateEventCrew,
    showToast
  } = useAcara();
  const { session } = useSessionStore();

  const currentUserName = session?.user?.full_name || session?.user?.username || 'Roup';

  const { docs: allDocuments, approveDoc, rejectDoc, deleteDoc } = useDocsStore();

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);
  const [isGearModalOpen, setIsGearModalOpen] = useState(false);
  const [isLinkNoteModalOpen, setIsLinkNoteModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Document Integration Modal & Drawer States
  const [isTugasModalOpen, setIsTugasModalOpen] = useState(false);
  const [isBarangModalOpen, setIsBarangModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PtvDocument | null>(null);

  const event = useMemo(() => {
    if (!id) return undefined;
    return getEventById(id);
  }, [id, getEventById]);

  // Authority evaluation for approving documents
  const canApprove = useMemo(() => {
    const caps = (session?.user as any)?.capabilities || [];
    const profiles = (session?.user as any)?.assigned_profiles || [];
    return (
      caps.includes('documents.approve') ||
      caps.includes('documents.archive.manage') ||
      profiles.includes('admin') ||
      profiles.includes('eksekutif') ||
      profiles.includes('administrasi')
    );
  }, [session?.user]);

  // Documents linked with this event
  const relatedDocs = useMemo(() => {
    if (!event?.id) return [];
    return allDocuments.filter(
      (d) =>
        d.event_id === event.id ||
        (d.event && d.event.toLowerCase().trim() === event.name.toLowerCase().trim()) ||
        (d.subject && d.subject.toLowerCase().includes(event.name.toLowerCase()))
    );
  }, [allDocuments, event?.id, event?.name]);

  if (!event) {
    return (
      <div className="acara-empty-state" style={{ margin: '40px auto', maxWidth: '540px' }}>
        <div className="acara-empty-icon">
          <Calendar size={28} />
        </div>
        <h3 className="acara-empty-title">Acara Tidak Ditemukan</h3>
        <p className="acara-empty-desc">
          Agenda acara yang Anda cari tidak tersedia atau mungkin telah dihapus dari basis data operasional.
        </p>
        <button
          type="button"
          className="acara-btn-primary"
          onClick={() => navigate('/hub/acara')}
          style={{ marginTop: '8px' }}
        >
          <ArrowLeft size={16} /> Kembali ke Daftar Acara
        </button>
      </div>
    );
  }

  const hijri = getHijriInfo(event.date);
  const statusInfo = getAcaraStatusInfo(event);
  const linkedNotes = getLinkedNotulensi(event);

  // Unlink satu alat secara langsung dari baris
  const handleUnlinkGear = async (gearId: string) => {
    const nextGear = (event.gear || []).filter((g) => g.id !== gearId);
    await updateEventGear(event.id, nextGear);
  };

  // Unlink satu kru secara langsung dari baris
  const handleUnlinkCrew = async (crewKeyOrName: string) => {
    const nextCrew = (event.crew || []).filter(
      (c) => c.name !== crewKeyOrName && c.id !== crewKeyOrName && c.ptv_id !== crewKeyOrName
    );
    await updateEventCrew(event.id, nextCrew);
  };

  const handleSubmitTugas = async (data: {
    subject: string;
    event?: string;
    event_id?: string;
    start_date: string;
    end_date: string;
    penanggung_jawab: string;
    recipients: string[];
    notes?: string;
  }) => {
    try {
      const newDoc = await dokumenService.createDocument({
        type: 'Surat Tugas',
        subject: data.subject,
        date: data.start_date,
        start_date: data.start_date,
        end_date: data.end_date,
        penanggung_jawab: data.penanggung_jawab,
        recipients: data.recipients,
        event: data.event || event.name,
        event_id: data.event_id || event.id,
        source: 'acara',
        notes: data.notes,
      });
      setIsTugasModalOpen(false);
      if (newDoc.status === 'Disetujui') {
        showToast(`Surat Tugas resmi berhasil disahkan: ${newDoc.no}`, 'success');
      } else {
        showToast(`Surat Tugas "${newDoc.subject}" berhasil diajukan, menunggu pengesahan pimpinan.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menerbitkan Surat Tugas.', 'alert');
      throw err;
    }
  };

  const handleSubmitBarang = async (data: {
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
  }) => {
    try {
      const newDoc = await dokumenService.createDocument({
        type: 'Izin Membawa Barang',
        subject: data.subject,
        date: data.start_date,
        start_date: data.start_date,
        end_date: data.end_date,
        pembawa: data.pembawa,
        penanggung_jawab: data.penanggung_jawab,
        items: data.items,
        unit_ids: data.unit_ids,
        recipients: [data.pembawa],
        event: data.event || event.name,
        event_id: data.event_id || event.id,
        source: 'acara',
        notes: data.notes,
      });
      setIsBarangModalOpen(false);
      if (newDoc.status === 'Disetujui') {
        showToast(`Surat Izin Pengeluaran Barang Disetujui Otomatis (Detail Acara): ${newDoc.no}`, 'success');
      } else {
        showToast(`Surat Izin Pengeluaran Barang berhasil diajukan, menunggu approval pimpinan.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat Surat Izin Pengeluaran Barang.', 'alert');
      throw err;
    }
  };

  return (
    <div>
      {/* 1. Header Detail & Navigation */}
      <div className="acara-detail-header">
        <button
          type="button"
          className="acara-back-btn"
          onClick={() => navigate('/hub/acara')}
          aria-label="Kembali ke agenda acara"
        >
          <ArrowLeft size={16} /> Kembali ke Acara
        </button>

        <div className="acara-detail-title-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="acara-detail-heading">{event.name}</h1>
            <div className="acara-detail-date-row">
              <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink, #0f172a)' }}>
                {formatHumanDateIndo(event.date, true)}
              </span>
              {hijri.full && <span className="acara-badge-hijri">{hijri.full}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`acara-badge ${statusInfo.variant}`} style={{ fontSize: '12.5px', padding: '6px 14px' }}>
              {statusInfo.variant === 'ok' && '✓ '}
              {statusInfo.variant === 'dang' && '✕ '}
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Asymmetric 2-Column Responsive Layout */}
      <div className="acara-detail-layout">
        {/* ==================== KOLOM KIRI (UTAMA) ==================== */}
        <div className="acara-detail-main">
          {/* Card 1: Informasi Acara */}
          <div className="acara-card">
            <div className="acara-section-header">
              <div className="acara-section-title" style={{ color: 'var(--b-600)' }}>
                <Info size={16} /> Informasi Acara
              </div>
            </div>

            <div className="acara-kv-row">
              <span className="acara-kv-label">Waktu Pelaksanaan</span>
              <span className="acara-kv-val">{event.time || '08:00 – Selesai'}</span>
            </div>
            {event.sessions && event.sessions.length > 0 && (
              <div className="acara-kv-row" style={{ alignItems: 'flex-start' }}>
                <span className="acara-kv-label" style={{ paddingTop: '2px' }}>
                  Rincian Sesi ({event.sessions.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  {event.sessions.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 10px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-md, 8px)',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        Sesi {idx + 1} ({s.label === 'Lainnya' && s.custom_label ? s.custom_label : s.label})
                      </span>
                      <span style={{ color: 'var(--b-600)', fontWeight: 600 }}>
                        {s.start_time || '08:00'} – {s.has_end_time && s.end_time ? s.end_time : 'Selesai'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="acara-kv-row">
              <span className="acara-kv-label">Lokasi Kegiatan</span>
              <span className="acara-kv-val">{event.loc || 'Studio PTV'}</span>
            </div>
            <div className="acara-kv-row">
              <span className="acara-kv-label">Jumlah Kru Bertugas</span>
              <span className="acara-kv-val">{(event.crew || []).length} orang</span>
            </div>
            {event.dresscode && (
              <div className="acara-kv-row">
                <span className="acara-kv-label">Dresscode / Pakaian</span>
                <span className="acara-kv-val">{event.dresscode}</span>
              </div>
            )}
            {event.doc && (
              <div className="acara-kv-row">
                <span className="acara-kv-label">Lampiran Dokumen</span>
                <span className="acara-kv-val" style={{ color: 'var(--b-600)', cursor: 'pointer' }}>
                  📄 {event.doc}
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Catatan Teknis & Notulensi Rapat */}
          <div className="acara-card">
            <div className="acara-section-header">
              <span className="acara-section-title">
                <FileText size={16} /> Catatan & Notulensi
              </span>

              <button
                type="button"
                className="acara-btn-secondary"
                style={{ fontSize: '11.5px', padding: '4px 12px', minHeight: '30px' }}
                onClick={() => setIsLinkNoteModalOpen(true)}
              >
                <LinkIcon size={12} /> Tautkan Notulensi
              </button>
            </div>

            <div className="acara-notes-card-body">
              {/* Catatan Teknis */}
              {event.notes && event.notes.trim() ? (
                <div className="acara-tech-notes-section">
                  <div className="acara-notes-subheading-row">
                    <span className="acara-notes-subheading">
                      Instruksi Teknis Peliputan
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="acara-notes-edit-btn"
                    >
                      <Edit size={12} /> Edit Catatan
                    </button>
                  </div>
                  <div className="acara-tech-notes-content">
                    {event.notes}
                  </div>
                </div>
              ) : null}

              {/* Separator jika Instruksi Teknis ada */}
              {event.notes && event.notes.trim() && (
                <div className="acara-notes-divider" />
              )}

              {/* Notulensi Rapat Tertaut */}
              <div className="acara-notulensi-section">
                <div className="acara-notulensi-subheading">
                  Notulensi Rapat Terkait ({linkedNotes.length})
                </div>

                {linkedNotes.length > 0 ? (
                  <div className="acara-notulensi-list">
                    {linkedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="acara-notulensi-card"
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            marginBottom: '6px'
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 750,
                              padding: '2px 8px',
                              background: 'var(--info-bg)',
                              color: 'var(--info)',
                              border: '1px solid var(--info-border)',
                              borderRadius: 'var(--r-full, 9999px)'
                            }}
                          >
                            {note.date ? formatHumanDateIndo(note.date) : 'Notulensi'}
                          </span>
                          <button
                            type="button"
                            onClick={() => unlinkNotulensi(event.id, note.id)}
                            style={{
                              background: 'var(--dang-bg)',
                              color: 'var(--dang)',
                              border: '1px solid var(--dang-border)',
                              borderRadius: 'var(--r-md, 6px)',
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 650,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="Lepas tautan notulensi dari acara"
                          >
                            <Unlink size={11} /> Lepas
                          </button>
                        </div>

                        <h4 style={{ margin: '0 0 6px', fontSize: '13.5px', fontWeight: 750, color: 'var(--ink)' }}>
                          {note.judul}
                        </h4>

                        {note.isi && (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.45 }}>
                            {note.isi.replace(/<[^>]+>/g, '').slice(0, 160)}...
                          </p>
                        )}

                        {note.created_by_name && (
                          <div
                            style={{
                              marginTop: '8px',
                              paddingTop: '6px',
                              borderTop: '1px dashed var(--line-2)',
                              fontSize: '11px',
                              color: 'var(--muted)'
                            }}
                          >
                            Dicatat oleh <strong style={{ color: 'var(--ink-2)' }}>{note.created_by_name}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="acara-notulensi-empty">
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>
                      Belum ada notulensi rapat yang ditautkan ke agenda ini.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Peralatan yang Digunakan */}
          <div className="acara-card">
            <div className="acara-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="acara-section-title">
                  <Boxes size={16} /> Peralatan yang Digunakan
                </span>
                <span className="acara-section-badge">{(event.gear || []).length}</span>
              </div>

              <button
                type="button"
                className="acara-btn-secondary"
                style={{ fontSize: '11.5px', padding: '4px 12px', minHeight: '30px' }}
                onClick={() => setIsGearModalOpen(true)}
              >
                <Boxes size={14} /> Kelola Peralatan
              </button>
            </div>

            {(event.gear || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {event.gear.map((g) => {
                  const resolvedPhoto = resolveInventoryPhotoUrl(g.photo);
                  return (
                    <div key={g.id} className="acara-gear-row">
                      <div className="acara-gear-thumb" style={{ overflow: 'hidden' }}>
                        {resolvedPhoto ? (
                          <img
                            src={resolvedPhoto}
                            alt={g.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Camera size={22} />
                        )}
                      </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 7px',
                            fontWeight: 750,
                            background: 'var(--info-bg)',
                            color: 'var(--info)',
                            borderRadius: 'var(--r-md, 6px)',
                            border: '1px solid var(--info-border)'
                          }}
                        >
                          {g.code}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>{g.cat}</span>
                        {g.qty > 1 && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              fontWeight: 750,
                              background: 'var(--warn-bg)',
                              color: 'var(--warn)',
                              borderRadius: 'var(--r-md, 6px)',
                              border: '1px solid var(--warn-border)'
                            }}
                          >
                            {g.qty} unit
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 750, fontSize: '13.5px', color: 'var(--ink)', lineHeight: 1.35 }}>
                        {g.name}
                      </div>

                      {/* Barcode unit fisik terpilih */}
                      {Array.isArray(g.units) && g.units.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {g.units.map((u) => (
                            <span
                              key={u.unit}
                              style={{
                                fontSize: '10.5px',
                                padding: '1px 6px',
                                background: 'var(--info-bg)',
                                color: 'var(--info)',
                                border: '1px solid var(--info-border)',
                                borderRadius: 'var(--r-md, 6px)',
                                fontWeight: 650,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Barcode size={10} /> {u.code || `Unit #${u.unit}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleUnlinkGear(g.id)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: 'var(--r-full, 9999px)',
                          background: 'var(--dang-bg)',
                          color: 'var(--dang)',
                          border: '1px solid var(--dang-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Hapus peralatan dari acara ini"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                <Boxes size={24} style={{ color: 'var(--muted)', margin: '0 auto 6px', display: 'block', opacity: 0.6 }} />
                Belum ada peralatan yang dialokasikan untuk kegiatan ini.
              </div>
            )}
          </div>
        </div>

        {/* ==================== KOLOM KANAN (SIDEBAR) ==================== */}
        <div className="acara-detail-side">
          {/* Card 5: Kru yang Bertugas */}
          <div className="acara-card">
            <div className="acara-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="acara-section-title">
                  <Users size={16} /> Kru yang Bertugas
                </span>
                <span className="acara-section-badge">{(event.crew || []).length}</span>
              </div>

              <button
                type="button"
                className="acara-btn-secondary"
                style={{ fontSize: '11.5px', padding: '4px 12px', minHeight: '30px' }}
                onClick={() => setIsCrewModalOpen(true)}
              >
                <Users size={14} /> Kelola Kru
              </button>
            </div>

            {(event.crew || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {event.crew.map((c) => {
                  const isCurrentUser =
                    c.name.toLowerCase().includes(currentUserName.toLowerCase()) ||
                    currentUserName.toLowerCase().includes(c.name.toLowerCase());
                  const initials = c.name
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div key={c.id || c.name} className="acara-crew-row">
                      {c.photo ? (
                        <img
                          src={c.photo}
                          alt={c.name}
                          className="acara-crew-avatar"
                          style={{ objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            const fb = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fb) fb.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="acara-crew-avatar" style={{ display: c.photo ? 'none' : 'flex' }}>
                        {initials}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 750, fontSize: '14px', color: 'var(--ink)' }}>{c.name}</span>
                            {c.ptv_id && (
                              <span style={{ fontSize: '10.5px', color: 'var(--muted)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 'var(--ptv-curve-xs)' }}>
                                {c.ptv_id}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {isCurrentUser && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--ptv-curve-pill)',
                                  background: 'var(--warn-bg)',
                                  color: 'var(--warn)',
                                  border: '1px solid var(--warn-border)',
                                  fontWeight: 750
                                }}
                              >
                                Kamu
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleUnlinkCrew(c.id || c.ptv_id || c.name)}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: 'var(--ptv-curve-pill)',
                                background: 'var(--dang-bg)',
                                color: 'var(--dang)',
                                border: '1px solid var(--dang-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                              title="Lepas kru dari acara ini"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '1px' }}>
                          {c.division || 'Kru'} • {c.role || 'Anggota'}
                        </div>

                        {/* Bertugas Sebagai */}
                        <div
                          style={{
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px dashed var(--line-2)',
                            fontSize: '11.5px',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '4px'
                          }}
                        >
                          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Bertugas sebagai:</span>
                          <span style={{ fontWeight: 750, color: 'var(--b-600)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Briefcase size={11} /> {c.job || c.tugas || 'Belum dicatat'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                <Users size={24} style={{ color: 'var(--muted)', margin: '0 auto 6px', display: 'block', opacity: 0.6 }} />
                Kru yang bertugas belum dicatat untuk acara ini.
              </div>
            )}
          </div>

          {/* Card 6: Dokumen Terkait */}
          <div className="acara-card">
            <div className="acara-section-header">
              <span className="acara-section-title">
                <FileSignature size={16} /> Dokumen Terkait
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 650,
                  padding: '2px 8px',
                  borderRadius: 'var(--r-full, 9999px)',
                  background: 'var(--surface-2)',
                  color: 'var(--muted)',
                  border: '1px solid var(--line)'
                }}
              >
                {relatedDocs.length} Dokumen
              </span>
            </div>

            {relatedDocs.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1.5px dashed var(--line)',
                  borderRadius: 'var(--r-xl, 14px)',
                  padding: '20px 16px',
                  textAlign: 'center'
                }}
              >
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>
                  Belum ada surat tugas resmi atau izin barang yang diterbitkan untuk kegiatan ini.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {relatedDocs.map((doc) => {
                  const isApproved = doc.status === 'Disetujui';
                  const isBarang = doc.type.includes('Barang');
                  return (
                    <div
                      key={doc.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--r-lg, 10px)',
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: isBarang ? 'var(--cat-lensa-fg, #a855f7)' : 'var(--b-600)'
                          }}
                        >
                          {isBarang ? <ShieldCheck size={12} /> : <FileSignature size={12} />}
                          {doc.type}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '1.5px 7px',
                            borderRadius: 'var(--r-full, 9999px)',
                            background: isApproved ? 'var(--ok-bg)' : 'var(--warn-bg)',
                            color: isApproved ? 'var(--ok)' : 'var(--warn)',
                            border: '1px solid ' + (isApproved ? 'var(--ok-border)' : 'var(--warn-border)')
                          }}
                        >
                          {doc.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--ink)' }}>
                        {doc.no && doc.no !== '—' ? doc.no : doc.subject}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {doc.date || doc.start_date || 'Tanggal belum dicatat'}
                        </span>
                        <button
                          type="button"
                          className="acara-btn-secondary"
                          style={{ fontSize: '11px', padding: '3px 8px', height: '24px' }}
                          onClick={() => setViewingDoc(doc)}
                        >
                          <ExternalLink size={11} /> Buka Surat
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 7: Aksi & Pengaturan */}
          <div className="acara-card">
            <div className="acara-section-header">
              <span className="acara-section-title">Aksi & Pengaturan</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="acara-btn-primary"
                  style={{ justifyContent: 'center', fontSize: '12.5px', padding: '9px 12px' }}
                  onClick={() => setIsTugasModalOpen(true)}
                >
                  <FileSignature size={14} /> Surat Tugas
                </button>
                <button
                  type="button"
                  className="acara-btn-secondary"
                  style={{ justifyContent: 'center', fontSize: '12.5px', padding: '9px 12px' }}
                  onClick={() => setIsBarangModalOpen(true)}
                >
                  <ShieldCheck size={14} /> Izin Barang
                </button>
              </div>

              <div style={{ borderTop: '1px dashed var(--line-2, #e2e8f0)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className="acara-btn-secondary"
                    style={{ justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <Edit size={13} /> Edit Acara
                  </button>
                  <button
                    type="button"
                    className="acara-btn-secondary"
                    style={{ justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}
                    onClick={() => setIsStatusModalOpen(true)}
                  >
                    <RotateCw size={13} /> Ubah Status
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="acara-btn-destructive"
                  style={{ width: '100%' }}
                >
                  <Trash2 size={14} /> Hapus Acara
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODALS INTERAKTIF ==================== */}
      <AcaraFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        eventToEdit={event}
        onDeleted={() => navigate('/hub/acara')}
      />

      <AcaraCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        event={event}
      />

      <AcaraGearModal
        isOpen={isGearModalOpen}
        onClose={() => setIsGearModalOpen(false)}
        event={event}
      />

      <AcaraLinkNoteModal
        isOpen={isLinkNoteModalOpen}
        onClose={() => setIsLinkNoteModalOpen(false)}
        event={event}
      />

      <AcaraStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        event={event}
      />

      <AcaraDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        event={event}
        onSuccess={() => navigate('/hub/acara')}
      />

      {/* Surat Tugas Generator Modal */}
      <AjukanTugasModal
        isOpen={isTugasModalOpen}
        onClose={() => setIsTugasModalOpen(false)}
        initialData={{
          eventId: event.id,
          eventName: event.name,
          date: event.date,
          loc: event.loc,
          crew: (event.crew || []).map((c) => c.name),
        }}
        onSubmit={handleSubmitTugas}
      />

      {/* Surat Izin Pengeluaran Barang Generator Modal */}
      <AjukanBarangModal
        isOpen={isBarangModalOpen}
        onClose={() => setIsBarangModalOpen(false)}
        initialData={{
          eventId: event.id,
          eventName: event.name,
          date: event.date,
          loc: event.loc,
          pembawa: event.crew?.[0]?.name,
          gearAllocations: event.gear,
        }}
        onSubmit={handleSubmitBarang}
      />

      {/* Detail & Print Preview Drawer */}
      <DocDetailDrawer
        doc={viewingDoc}
        onClose={() => setViewingDoc(null)}
        canApprove={canApprove}
        onApprove={(docId, note) => {
          approveDoc(docId, note, currentUserName);
          setViewingDoc(null);
          showToast('Dokumen berhasil disetujui.', 'success');
        }}
        onReject={(docId) => {
          rejectDoc(docId, undefined, currentUserName);
          setViewingDoc(null);
          showToast('Pengajuan dokumen ditolak.', 'info');
        }}
        onDelete={(docId) => {
          deleteDoc(docId);
          setViewingDoc(null);
          showToast('Dokumen berhasil dihapus.', 'info');
        }}
      />
    </div>
  );
};
