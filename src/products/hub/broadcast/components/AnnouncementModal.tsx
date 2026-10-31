import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { Announcement, AnnouncementPriority, AnnouncementColorTheme } from '../types';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    body: string;
    prio: AnnouncementPriority;
    color_theme?: AnnouncementColorTheme;
    durasi_hari?: number;
    berlaku_sampai?: string | null;
  }) => void;
  initialData?: Announcement | null;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [prio, setPrio] = useState<AnnouncementPriority>('normal');
  const [colorTheme, setColorTheme] = useState<AnnouncementColorTheme>('blue');
  const [durasiHari, setDurasiHari] = useState<number>(7);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'broadcast-announcement-modal',
  });

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setBody(initialData.body);
      setPrio(initialData.prio);
      setColorTheme(initialData.color_theme || (initialData.prio === 'penting' ? 'orange' : 'blue'));
      if (typeof initialData.durasi_hari === 'number') {
        setDurasiHari(initialData.durasi_hari);
      } else if (initialData.berlaku_sampai) {
        const diffDays = Math.max(1, Math.round((new Date(initialData.berlaku_sampai).getTime() - Date.now()) / 86400000));
        setDurasiHari(diffDays);
      } else {
        setDurasiHari(0); // Tanpa batas waktu
      }
    } else {
      setTitle('');
      setBody('');
      setPrio('normal');
      setColorTheme('blue');
      setDurasiHari(7); // Default 7 hari
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul pengumuman wajib diisi.');
      return;
    }
    if (!body.trim()) {
      setError('Isi pengumuman tidak boleh kosong.');
      return;
    }

    const berlakuSampai = durasiHari > 0 ? new Date(Date.now() + durasiHari * 86400000).toISOString() : null;

    onSubmit({
      title: title.trim(),
      body: body.trim(),
      prio,
      color_theme: colorTheme,
      durasi_hari: durasiHari > 0 ? durasiHari : undefined,
      berlaku_sampai: berlakuSampai,
    });
    onClose();
  };

  const isEdit = Boolean(initialData);

  const modalContent = (
    <div ref={modalRef} className="bc-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bc-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bc-modal-header">
          <div className="bc-modal-title-wrap">
            <div className="bc-modal-icon">
              <i className="fa-solid fa-bullhorn" />
            </div>
            <div>
              <h3 className="bc-modal-title">
                {isEdit ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
              </h3>
              <p className="bc-modal-desc">
                {isEdit
                  ? 'Perbarui rincian pengumuman yang sudah diterbitkan.'
                  : 'Siarkan informasi penting ke seluruh kru Progresif TV.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="bc-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup modal"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bc-modal-form-wrap">
          <div className="bc-modal-body">
            {error && (
              <div className="bc-modal-alert">
                <i className="fa-solid fa-circle-exclamation" />
                <span>{error}</span>
              </div>
            )}

            <div className="bc-form-group">
              <label htmlFor="bc_title" className="bc-form-label">
                Judul Pengumuman <span className="bc-required">*</span>
              </label>
              <input
                id="bc_title"
                type="text"
                className="bc-form-input"
                placeholder="Contoh: Jadwal Piket Liputan & Standby Tim Produksi"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
              />
            </div>

            <div className="bc-form-group">
              <label htmlFor="bc_prio" className="bc-form-label">
                Tingkat Prioritas
              </label>
              <div className="bc-prio-selector">
                <button
                  type="button"
                  className={`bc-prio-btn ${prio === 'normal' ? 'active' : ''}`}
                  onClick={() => setPrio('normal')}
                >
                  <i className="fa-regular fa-bell" />
                  <span>Normal</span>
                </button>
                <button
                  type="button"
                  className={`bc-prio-btn prio-high ${prio === 'penting' ? 'active' : ''}`}
                  onClick={() => setPrio('penting')}
                >
                  <i className="fa-solid fa-triangle-exclamation" />
                  <span>Penting (Highlight)</span>
                </button>
              </div>
            </div>

            <div className="bc-form-group">
              <label className="bc-form-label">
                Warna / Tema Notification Bar
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(76px, 1fr))', gap: '8px' }}>
                {[
                  { key: 'blue', label: 'Biru', bg: '#005ce6' },
                  { key: 'purple', label: 'Ungu', bg: '#8b5cf6' },
                  { key: 'orange', label: 'Oranye', bg: '#ea580c' },
                  { key: 'green', label: 'Hijau', bg: '#16a34a' },
                  { key: 'red', label: 'Merah', bg: '#dc2626' },
                  { key: 'yellow', label: 'Emas', bg: '#d97706' },
                ].map((colorItem) => {
                  const isSel = colorTheme === colorItem.key;
                  return (
                    <button
                      key={colorItem.key}
                      type="button"
                      onClick={() => setColorTheme(colorItem.key as AnnouncementColorTheme)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '7px 8px',
                        borderRadius: 'var(--ptv-curve-pill, 9999px)',
                        fontSize: '11.5px',
                        fontWeight: isSel ? 700 : 500,
                        border: isSel ? '2px solid var(--ink, #0f172a)' : '1px solid var(--line-2, #e2e8f0)',
                        background: 'var(--surface, #ffffff)',
                        color: 'var(--ink, #1e293b)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: colorItem.bg,
                          flexShrink: 0,
                        }}
                      />
                      <span>{colorItem.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bc-form-group">
              <label htmlFor="bc_durasi" className="bc-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Masa Berlaku Pengumuman</span>
                <span style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', fontWeight: 500 }}>
                  {durasiHari === 0 ? 'Aktif selamanya tanpa batas waktu' : `Otomatis ditutup setelah ${durasiHari} hari`}
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: '8px' }}>
                {[
                  { days: 1, label: '1 Hari' },
                  { days: 3, label: '3 Hari' },
                  { days: 7, label: '7 Hari' },
                  { days: 14, label: '14 Hari' },
                  { days: 30, label: '30 Hari' },
                  { days: 0, label: 'Selamanya' },
                ].map((preset) => {
                  const isSel = durasiHari === preset.days;
                  return (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setDurasiHari(preset.days)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--ptv-curve-pill, 9999px)',
                        fontSize: '12px',
                        fontWeight: isSel ? 700 : 500,
                        border: isSel ? '1.5px solid var(--b-600, #005ce6)' : '1px solid var(--line-2, #e2e8f0)',
                        background: isSel ? 'var(--b-050, #eff6ff)' : 'var(--surface, #ffffff)',
                        color: isSel ? 'var(--b-700, #004ecc)' : 'var(--ink-2, #475569)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bc-form-group">
              <label htmlFor="bc_body" className="bc-form-label">
                Isi Pengumuman <span className="bc-required">*</span>
              </label>
              <textarea
                id="bc_body"
                className="bc-form-textarea"
                rows={5}
                placeholder="Tuliskan isi pengumuman secara jelas dan terperinci untuk seluruh kru..."
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (error) setError(null);
                }}
              />
            </div>
          </div>

          <div className="bc-modal-footer">
            <button
              type="button"
              className="bc-btn bc-btn-secondary"
              onClick={onClose}
            >
              Batal
            </button>
            <button type="submit" className="bc-btn bc-btn-primary">
              <i className="fa-solid fa-paper-plane" />
              <span>{isEdit ? 'Simpan Perubahan' : 'Terbitkan Pengumuman'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
