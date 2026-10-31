import React, { useState, useRef, useEffect } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface ReviewActionModalProps {
  isOpen: boolean;
  actionType: 'revisi' | 'tolak' | null;
  docTitle: string;
  onClose: () => void;
  onConfirm: (note: string) => void;
}

export const ReviewActionModal: React.FC<ReviewActionModalProps> = ({
  isOpen,
  actionType,
  docTitle,
  onClose,
  onConfirm,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({ isOpen: Boolean(isOpen && actionType), onClose, modalRef });

  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNote('');
      setErrorMsg(null);
    }
  }, [isOpen, actionType]);

  if (!isOpen || !actionType) return null;

  const isRevision = actionType === 'revisi';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setErrorMsg(
        isRevision
          ? 'Catatan alasan revisi wajib diisi agar pemohon dapat memperbaiki dokumen.'
          : 'Alasan penolakan permohonan wajib diisi.'
      );
      return;
    }
    onConfirm(note.trim());
  };

  return (
    <div className="prz-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" style={{ zIndex: 11000 }}>
      <div
        ref={modalRef}
        className="prz-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px' }}
      >
        <div className="prz-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--r-md, 10px)',
                background: isRevision ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                color: isRevision ? '#d97706' : '#dc2626',
                display: 'grid',
                placeItems: 'center',
                fontSize: '15px',
              }}
            >
              <i className={isRevision ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-circle-xmark'} />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--ink)' }}>
                {isRevision ? 'Minta Revisi Dokumen' : 'Tolak Pengajuan Perizinan'}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }} className="trunc">
                {docTitle}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
            style={{ minWidth: '38px', minHeight: '38px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '15px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="prz-modal-body">
            {errorMsg && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  borderRadius: 'var(--r-md, 10px)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '12px',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="prz-modal-field">
              <label className="prz-modal-label">
                {isRevision ? 'Instruksi / Catatan Revisi' : 'Alasan Penolakan'}{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                className="prz-modal-textarea"
                rows={3}
                placeholder={
                  isRevision
                    ? 'Contoh: Mohon tambahkan 1 personel kamera pendamping dan lengkapi surat izin sekolah...'
                    : 'Contoh: Jadwal bertabrakan dengan agenda live streaming utama...'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                Catatan ini akan tersimpan dalam riwayat alur dan dapat dibaca langsung oleh pemohon.
              </span>
            </div>
          </div>

          <div className="prz-modal-footer">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{ minHeight: '38px', borderRadius: 'var(--ptv-curve-pill)' }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn pri"
              style={{
                flex: 1,
                minHeight: '38px',
                borderRadius: 'var(--ptv-curve-pill)',
                background: isRevision ? '#d97706' : '#dc2626',
                borderColor: isRevision ? '#d97706' : '#dc2626',
              }}
            >
              {isRevision ? 'Kirim Permintaan Revisi' : 'Konfirmasi Penolakan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
