import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { PortalManagedService, ServiceCategory, ServiceStatus } from '../types';

interface ServiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: PortalManagedService | null;
  onSave: (data: Partial<PortalManagedService> & { id: string }, asDraft: boolean) => Promise<void>;
  canPublish: boolean;
}

export const ServiceEditModal: React.FC<ServiceEditModalProps> = ({
  isOpen,
  onClose,
  service,
  onSave,
  canPublish,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeWhenIdle = () => {
    if (isSubmitting) return;
    if (isDirty) {
      if (!window.confirm('Terdapat perubahan yang belum disimpan. Yakin ingin menutup?')) {
        return;
      }
    }
    onClose();
  };

  useModalScrollLock({
    isOpen,
    onClose: closeWhenIdle,
    modalRef,
    id: 'modal-service-edit',
  });

  const [id, setId] = useState('');
  const [nameId, setNameId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descId, setDescId] = useState('');
  const [descEn, setDescEn] = useState('');
  const [cat, setCat] = useState<ServiceCategory>('public');
  const [href, setHref] = useState('');
  const [icon, setIcon] = useState('globe');
  const [st, setSt] = useState<ServiceStatus>('ok');
  const [statusNote, setStatusNote] = useState('');
  const [pub, setPub] = useState<0 | 1>(1);
  const [isSeasonal, setIsSeasonal] = useState(false);
  const [seasonalStart, setSeasonalStart] = useState('');
  const [seasonalEnd, setSeasonalEnd] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (service) {
      setId(service.id || '');
      setNameId(service.name?.id || '');
      setNameEn(service.name?.en || '');
      setDescId(service.desc?.id || '');
      setDescEn(service.desc?.en || '');
      setCat(service.cat || 'public');
      setHref(service.href || '');
      setIcon(service.icon || 'globe');
      setSt(service.st || 'ok');
      setStatusNote(service.statusNote || '');
      setPub(service.pub ?? 1);
      setIsSeasonal(Boolean(service.isSeasonal));
      setSeasonalStart(service.seasonalStart || '');
      setSeasonalEnd(service.seasonalEnd || '');
      setIsActive(service.isActive ?? true);
    } else {
      setId('');
      setNameId('');
      setNameEn('');
      setDescId('');
      setDescEn('');
      setCat('public');
      setHref('');
      setIcon('globe');
      setSt('ok');
      setStatusNote('');
      setPub(1);
      setIsSeasonal(false);
      setSeasonalStart('');
      setSeasonalEnd('');
      setIsActive(true);
    }
    setIsDirty(false);
  }, [service, isOpen]);

  if (!isOpen) return null;

  const markDirty = () => setIsDirty(true);

  const handleSubmit = async (asDraft: boolean) => {
    if (!id.trim()) {
      alert('ID Layanan wajib diisi');
      return;
    }
    if (!nameId.trim()) {
      alert('Nama Layanan dalam Bahasa Indonesia wajib diisi');
      return;
    }
    if (!href.trim()) {
      alert('Tautan Layanan wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(
        {
          id: id.trim().toLowerCase().replace(/\s+/g, '-'),
          name: {
            id: nameId.trim(),
            en: nameEn.trim() || nameId.trim(),
          },
          desc: {
            id: descId.trim(),
            en: descEn.trim() || descId.trim(),
          },
          cat,
          href: href.trim(),
          icon: icon.trim() || 'globe',
          st,
          statusNote: statusNote.trim() || undefined,
          pub,
          isSeasonal,
          seasonalStart: isSeasonal && seasonalStart ? seasonalStart : undefined,
          seasonalEnd: isSeasonal && seasonalEnd ? seasonalEnd : undefined,
          isActive,
        },
        asDraft
      );
      setIsDirty(false);
      onClose();
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message || 'Error tidak diketahui'}`);
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
      aria-labelledby="serviceEditModalTitle"
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
                DIREKTORI LAYANAN
              </span>
              {service && (
                <span className="font-mono" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                  #{service.id}
                </span>
              )}
            </div>
            <h2 id="serviceEditModalTitle" className="pm-modal-title">
              {service ? 'Edit Layanan Portal' : 'Tambah Layanan Baru'}
            </h2>
            <p className="pm-modal-subtitle">
              {service ? 'Perbarui informasi direktori, tautan, dan visibilitas layanan portal' : 'Daftarkan layanan atau aplikasi baru ke direktori portal publik'}
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
          {/* Identitas Dasar */}
          <div>
            <label className="set-label">ID Layanan (Identifier Unik Slug) *</label>
            <input
              type="text"
              className="set-input font-mono"
              value={id}
              disabled={Boolean(service)}
              onChange={(e) => { setId(e.target.value); markDirty(); }}
              placeholder="contoh: live-streaming, perpustakaan, inventaris"
              required
            />
            <small style={{ color: 'var(--muted)', fontSize: '11.5px', display: 'block', marginTop: '4px' }}>
              Huruf kecil tanpa spasi. Digunakan sebagai rujukan slug routing internal.
            </small>
          </div>

          <div className="pm-form-grid-2">
            <div>
              <label className="set-label">Nama Layanan (Indonesia) *</label>
              <input
                type="text"
                className="set-input"
                value={nameId}
                onChange={(e) => { setNameId(e.target.value); markDirty(); }}
                placeholder="Contoh: Studio Live Streaming"
                required
              />
            </div>
            <div>
              <label className="set-label">Nama Layanan (Inggris)</label>
              <input
                type="text"
                className="set-input"
                value={nameEn}
                onChange={(e) => { setNameEn(e.target.value); markDirty(); }}
                placeholder="English title (optional)"
              />
            </div>
          </div>

          <div className="pm-form-grid-2">
            <div>
              <label className="set-label">Kategori</label>
              <select
                className="set-input"
                value={cat}
                onChange={(e) => { setCat(e.target.value as ServiceCategory); markDirty(); }}
              >
                <option value="public">Publik (Bebas Akses)</option>
                <option value="internal">Internal Kru</option>
                <option value="archive">Arsip & Dokumen</option>
                <option value="system">Sistem & Utility</option>
              </select>
            </div>
            <div>
              <label className="set-label">Visibilitas Publik</label>
              <select
                className="set-input"
                value={pub}
                onChange={(e) => { setPub(Number(e.target.value) as 0 | 1); markDirty(); }}
              >
                <option value={1}>Tampilkan di Launcher Publik</option>
                <option value={0}>Sembunyikan (Hanya Internal Hub)</option>
              </select>
            </div>
          </div>

          <div className="pm-form-grid-2">
            <div>
              <label className="set-label">Tautan Tujuan (URL / Route) *</label>
              <input
                type="text"
                className="set-input font-mono"
                value={href}
                onChange={(e) => { setHref(e.target.value); markDirty(); }}
                placeholder="Contoh: /hub/kalender atau https://..."
                required
              />
            </div>
            <div>
              <label className="set-label">Ikon FontAwesome</label>
              <input
                type="text"
                className="set-input font-mono"
                value={icon}
                onChange={(e) => { setIcon(e.target.value); markDirty(); }}
                placeholder="globe, tv, calendar, file, id"
              />
            </div>
          </div>

          <div>
            <label className="set-label">Deskripsi Layanan (Indonesia)</label>
            <textarea
              className="set-input"
              rows={2}
              value={descId}
              onChange={(e) => { setDescId(e.target.value); markDirty(); }}
              placeholder="Deskripsi singkat fungsi layanan dalam Bahasa Indonesia"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label className="set-label">Deskripsi Layanan (Inggris)</label>
            <textarea
              className="set-input"
              rows={2}
              value={descEn}
              onChange={(e) => { setDescEn(e.target.value); markDirty(); }}
              placeholder="Short English description of the service"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Status & Catatan Status */}
          <div className="pm-form-section">
            <div className="pm-form-section-title">Status Operasional Layanan</div>
            <div className="pm-form-grid-2">
              <div>
                <label className="set-label">Status Operasional</label>
                <select
                  className="set-input"
                  value={st}
                  onChange={(e) => { setSt(e.target.value as ServiceStatus); markDirty(); }}
                >
                  <option value="ok">🟢 Normal (Operasional Penuh)</option>
                  <option value="deg">🟡 Degraded (Gangguan Sebagian)</option>
                  <option value="down">🔴 Down (Tidak Dapat Diakses)</option>
                  <option value="maint">🔧 Maintenance (Pemeliharaan)</option>
                </select>
              </div>
              <div>
                <label className="set-label">Catatan Status Tambahan (Opsional)</label>
                <input
                  type="text"
                  className="set-input"
                  value={statusNote}
                  onChange={(e) => { setStatusNote(e.target.value); markDirty(); }}
                  placeholder="Contoh: Server transmisi dalam perbaikan"
                />
              </div>
            </div>
          </div>

          {/* Pengaturan Musiman */}
          <div className="pm-form-section">
            <div className="pm-form-section-title">Layanan Musiman / Khusus</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={isSeasonal}
                onChange={(e) => { setIsSeasonal(e.target.checked); markDirty(); }}
              />
              Aktifkan Sebagai Layanan Musiman (Periode Tanggal Tertentu)
            </label>

            {isSeasonal && (
              <div className="pm-form-grid-2" style={{ marginTop: '10px' }}>
                <div>
                  <label className="set-label">Mulai Tayang</label>
                  <input
                    type="date"
                    className="set-input"
                    value={seasonalStart}
                    onChange={(e) => { setSeasonalStart(e.target.value); markDirty(); }}
                  />
                </div>
                <div>
                  <label className="set-label">Berakhir</label>
                  <input
                    type="date"
                    className="set-input"
                    value={seasonalEnd}
                    onChange={(e) => { setSeasonalEnd(e.target.value); markDirty(); }}
                  />
                </div>
              </div>
            )}
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
            Simpan Sebagai Draft
          </button>
          {canPublish && (
            <button
              type="button"
              className="pm-btn-pill pm-btn-primary"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              <i className="fa-solid fa-paper-plane" style={{ marginRight: '4px' }} />
              Terbitkan Langsung
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
