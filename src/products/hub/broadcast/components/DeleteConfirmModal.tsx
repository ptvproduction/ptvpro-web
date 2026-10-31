import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { Announcement } from '../types';

interface DeleteConfirmModalProps {
  announcement: Announcement | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  announcement,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(isOpen && announcement),
    onClose,
    modalRef,
    id: 'broadcast-delete-confirm-modal',
  });

  if (!isOpen || !announcement) return null;

  const modalContent = (
    <div ref={modalRef} className="bc-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bc-modal-card bc-confirm-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bc-confirm-icon-wrap">
          <div className="bc-confirm-icon danger">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
        </div>

        <div className="bc-confirm-content">
          <h3 className="bc-confirm-title">Hapus Pengumuman?</h3>
          <p className="bc-confirm-desc">
            Pengumuman <strong>"{announcement.title}"</strong> akan dihapus permanen dari daftar siaran Broadcast dan Beranda kru.
          </p>
        </div>

        <div className="bc-modal-footer bc-confirm-footer">
          <button
            type="button"
            className="bc-btn bc-btn-secondary"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="bc-btn bc-btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <i className="fa-regular fa-trash-can" />
            <span>Ya, Hapus</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
