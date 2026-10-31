import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface PublishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCount: number;
  onConfirmPublish: () => Promise<void>;
}

export const PublishConfirmModal: React.FC<PublishConfirmModalProps> = ({
  isOpen,
  onClose,
  pendingCount,
  onConfirmPublish,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const closeWhenIdle = () => {
    if (!isPublishing) onClose();
  };

  useModalScrollLock({
    isOpen,
    onClose: closeWhenIdle,
    modalRef,
    id: 'modal-publish-confirm',
  });

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsPublishing(true);
    try {
      await onConfirmPublish();
      onClose();
    } catch (err: any) {
      alert(`Gagal mempublikasikan: ${err.message || 'Error'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const modalContent = (
    <div
      className="pm-modal-overlay"
      onClick={closeWhenIdle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="publishConfirmModalTitle"
    >
      <div
        ref={modalRef}
        className="pm-modal-dialog"
        style={{ maxWidth: '460px' }}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pm-modal-header">
          <div>
            <span className="pm-badge" style={{ background: 'var(--ok-bg)', color: 'var(--ok)', fontWeight: 600, marginBottom: '3px' }}>
              PUBLIKASI PORTAL
            </span>
            <h2 id="publishConfirmModalTitle" className="pm-modal-title">
              Konfirmasi Publikasi Perubahan
            </h2>
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

        <div className="pm-modal-body">
          <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: 'var(--ink)' }}>
            Terdapat <b>{pendingCount} item draft</b> yang siap diterbitkan ke portal publik Progresif TV.
          </p>
          <div style={{ background: 'var(--bg-2)', padding: '12px 14px', borderRadius: 'var(--ptv-curve-md, 12px)', fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
            <i className="fa-solid fa-circle-info" style={{ color: 'var(--b-600)', marginRight: '6px' }} />
            Semua draft layanan, pengumuman, dan pengaturan portal akan langsung menjadi versi aktif yang dapat diakses oleh publik.
          </div>
        </div>

        <div className="pm-modal-footer">
          <button
            type="button"
            className="pm-btn-pill pm-btn-secondary"
            onClick={closeWhenIdle}
            disabled={isPublishing}
          >
            Batal
          </button>
          <button
            type="button"
            className="pm-btn-pill pm-btn-primary"
            onClick={handleConfirm}
            disabled={isPublishing}
          >
            <i className="fa-solid fa-rocket" style={{ marginRight: '4px' }} />
            {isPublishing ? 'Menerbitkan…' : 'Ya, Terbitkan Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
