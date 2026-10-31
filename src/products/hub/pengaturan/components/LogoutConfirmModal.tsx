import React, { useRef } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'logout-confirm-modal',
  });

  if (!isOpen) return null;

  return (
    <div ref={modalRef} className="set-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="set-modal-card set-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="set-confirm-icon-wrap">
          <div className="set-confirm-icon danger">
            <i className="fa-solid fa-arrow-right-from-bracket" />
          </div>
        </div>

        <div className="set-confirm-content">
          <h3 className="set-confirm-title">Keluar dari Akun?</h3>
          <p className="set-confirm-desc">
            Sesi aktif Anda pada perangkat ini akan diakhiri. Anda perlu memasukkan kredensial login kembali untuk mengakses dasbor.
          </p>
        </div>

        <div className="set-modal-footer set-confirm-footer">
          <button
            type="button"
            className="set-btn set-btn-secondary"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="set-btn set-btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <i className="fa-solid fa-arrow-right-from-bracket" />
            <span>Ya, Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
