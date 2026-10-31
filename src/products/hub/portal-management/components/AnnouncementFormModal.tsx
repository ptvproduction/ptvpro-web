import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { PortalManagedAnnouncement } from '../types';

interface AnnouncementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: PortalManagedAnnouncement | null;
  onSave: (data: Partial<PortalManagedAnnouncement> & { id?: string }, asDraft: boolean) => Promise<void>;
  canPublish: boolean;
}

export const AnnouncementFormModal: React.FC<AnnouncementFormModalProps> = ({
  isOpen,
  onClose,
  announcement,
  onSave,
  canPublish,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeWhenIdle = () => {
    if (isSubmitting) return;
    if (isDirty) {
      if (!window.confirm('Terdapat perubahan pengumuman yang belum disimpan. Yakin ingin menutup?')) {
        return;
      }
    }
    onClose();
  };

  useModalScrollLock({
    isOpen,
    onClose: closeWhenIdle,
    modalRef,
    id: 'modal-announcement-form',
  });

  const [titleId, setTitleId] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyId, setBodyId] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [ctaTextId, setCtaTextId] = useState('Lihat Layanan');
  const [ctaHref, setCtaHref] = useState('#direktori-layanan');
  const [format, setFormat] = useState<'text' | 'poster' | 'hybrid'>('text');
  const [posterSrc, setPosterSrc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (announcement) {
      setTitleId(announcement.title?.id || '');
      setTitleEn(announcement.title?.en || '');
      setBodyId(announcement.body?.id || '');
      setBodyEn(announcement.body?.en || '');
      setCtaTextId(announcement.ctaText?.id || '');
      setCtaHref(announcement.ctaHref || '');
      setFormat(announcement.format || 'text');
      setPosterSrc(announcement.posterSrc || '');
      setStartDate(announcement.startDate || '');
      setEndDate(announcement.endDate || '');
      setIsActive(announcement.isActive ?? true);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setTitleId('');
      setTitleEn('');
      setBodyId('');
      setBodyEn('');
      setCtaTextId('Lihat Layanan');
      setCtaHref('#direktori-layanan');
      setFormat('text');
      setPosterSrc('');
      setStartDate(today);
      setEndDate('');
      setIsActive(true);
    }
    setIsDirty(false);
  }, [announcement, isOpen]);

  if (!isOpen) return null;

  const markDirty = () => setIsDirty(true);

  const handleSubmit = async (asDraft: boolean) => {
    if (!titleId.trim()) {
      alert('Judul pengumuman dalam Bahasa Indonesia wajib diisi');
      return;
    }
    if (!bodyId.trim()) {
      alert('Isi pengumuman dalam Bahasa Indonesia wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(
        {
          ...(announcement ? { id: announcement.id } : {}),
          title: {
            id: titleId.trim(),
            en: titleEn.trim() || titleId.trim(),
          },
          body: {
            id: bodyId.trim(),
            en: bodyEn.trim() || bodyId.trim(),
          },
          ctaText: ctaTextId.trim()
            ? { id: ctaTextId.trim(), en: ctaTextId.trim() }
            : undefined,
          ctaHref: ctaHref.trim() || undefined,
          format,
          posterSrc: posterSrc.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          isActive,
        },
        asDraft
      );
      setIsDirty(false);
      onClose();
    } catch (err: any) {
      alert(`Gagal menyimpan pengumuman: ${err.message || 'Error tidak diketahui'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="pm-modal-overlay"
      onClick={closeWhenIdle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcementFormModalTitle"
    >
      <div
        ref={modalRef}
        className="pm-modal-dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="pm-modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span className="pm-badge" style={{ background: 'var(--b-050)', color: 'var(--b-700)', fontWeight: 600 }}>
                PENGUMUMAN PORTAL
              </span>
              {announcement && (
                <span className="font-mono" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                  #{announcement.id}
                </span>
              )}
            </div>
            <h2 id="announcementFormModalTitle" className="pm-modal-title">
              {announcement ? 'Edit Pengumuman Portal' : 'Buat Pengumuman Baru'}
            </h2>
            <p className="pm-modal-subtitle">
              {announcement ? 'Perbarui konten pengumuman, format tayang, dan penjadwalan banner portal' : 'Publikasikan siaran resmi atau banner informasi penting di portal publik'}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeWhenIdle}
            aria-label="Tutup modal"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '15px' }} />
          </button>
        </div>

        {/* Body Modal Scrollable */}
        <div className="pm-modal-body">
          <div className="pm-form-grid-2">
            <div>
              <label className="set-label">Judul Pengumuman (Indonesia) *</label>
              <input
                type="text"
                className="set-input"
                value={titleId}
                onChange={(e) => { setTitleId(e.target.value); markDirty(); }}
                placeholder="Contoh: Jadwal Siaran Khusus Ramadhan 1448 H"
                required
              />
            </div>
            <div>
              <label className="set-label">Judul Pengumuman (Inggris)</label>
              <input
                type="text"
                className="set-input"
                value={titleEn}
                onChange={(e) => { setTitleEn(e.target.value); markDirty(); }}
                placeholder="English headline (optional)"
              />
            </div>
          </div>

          <div>
            <label className="set-label">Isi Pengumuman (Indonesia) *</label>
            <textarea
              className="set-input"
              rows={3}
              value={bodyId}
              onChange={(e) => { setBodyId(e.target.value); markDirty(); }}
              placeholder="Sampaikan rincian pengumuman atau instruksi penting kepada pengunjung portal..."
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <div>
            <label className="set-label">Isi Pengumuman (Inggris)</label>
            <textarea
              className="set-input"
              rows={2}
              value={bodyEn}
              onChange={(e) => { setBodyEn(e.target.value); markDirty(); }}
              placeholder="English announcement body text..."
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Format & Poster */}
          <div className="pm-form-section">
            <div className="pm-form-section-title">Format Banner & Aksi</div>
            <div className="pm-form-grid-2">
              <div>
                <label className="set-label">Format Penayangan</label>
                <select
                  className="set-input"
                  value={format}
                  onChange={(e) => { setFormat(e.target.value as any); markDirty(); }}
                >
                  <option value="text">Teks Standar (Kartu Berita)</option>
                  <option value="poster">Poster Grafis Penuh</option>
                  <option value="hybrid">Hibrida (Poster + Teks Ringkas)</option>
                </select>
              </div>

              {format !== 'text' && (
                <div>
                  <label className="set-label">URL Poster Grafis (Opsional)</label>
                  <input
                    type="text"
                    className="set-input font-mono"
                    value={posterSrc}
                    onChange={(e) => { setPosterSrc(e.target.value); markDirty(); }}
                    placeholder="https://... atau /assets/images/poster.webp"
                  />
                </div>
              )}
            </div>

            <div className="pm-form-grid-2" style={{ marginTop: '12px' }}>
              <div>
                <label className="set-label">Label Tombol Aksi (CTA)</label>
                <input
                  type="text"
                  className="set-input"
                  value={ctaTextId}
                  onChange={(e) => { setCtaTextId(e.target.value); markDirty(); }}
                  placeholder="Contoh: Lihat Jadwal Lengkap"
                />
              </div>
              <div>
                <label className="set-label">Tautan Aksi (Href / Route)</label>
                <input
                  type="text"
                  className="set-input font-mono"
                  value={ctaHref}
                  onChange={(e) => { setCtaHref(e.target.value); markDirty(); }}
                  placeholder="Contoh: /hub/kalender atau #direktori-layanan"
                />
              </div>
            </div>
          </div>

          {/* Penjadwalan */}
          <div className="pm-form-section">
            <div className="pm-form-section-title">Periode Tayang (Penjadwalan)</div>
            <div className="pm-form-grid-2">
              <div>
                <label className="set-label">Mulai Tayang</label>
                <input
                  type="date"
                  className="set-input"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); markDirty(); }}
                />
              </div>
              <div>
                <label className="set-label">Berakhir (Opsional)</label>
                <input
                  type="date"
                  className="set-input"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); markDirty(); }}
                />
              </div>
            </div>
            <small style={{ color: 'var(--muted)', display: 'block', marginTop: '6px', fontSize: '11.5px' }}>
              Bila tanggal berakhir dikosongkan, pengumuman akan terus tayang aktif hingga diarsipkan manual.
            </small>
          </div>

          <div style={{ paddingTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => { setIsActive(e.target.checked); markDirty(); }}
              />
              Status Aktif (Bila tidak dicentang, pengumuman tersimpan sebagai arsip)
            </label>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="pm-modal-footer">
          <button
            type="button"
            className="pm-btn-pill pm-btn-secondary"
            onClick={closeWhenIdle}
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="pm-btn-pill"
            style={{
              background: 'var(--bg-2)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
            }}
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
          >
            <i className="fa-solid fa-floppy-disk" style={{ marginRight: '4px' }} />
            Simpan Draft
          </button>
          {canPublish && (
            <button
              type="button"
              className="pm-btn-pill pm-btn-primary"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              <i className="fa-solid fa-paper-plane" style={{ marginRight: '4px' }} />
              Terbitkan Pengumuman
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
