import React, { useRef } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface UnlinkGoogleConfirmModalProps {
  isOpen: boolean;
  isLoading: boolean;
  linkedEmail?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const UnlinkGoogleConfirmModal: React.FC<UnlinkGoogleConfirmModalProps> = ({
  isOpen,
  isLoading,
  linkedEmail,
  onClose,
  onConfirm,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose: () => {
      if (!isLoading) onClose();
    },
    modalRef,
    id: 'unlink-google-confirm-modal',
  });

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="set-modal-overlay"
      onClick={isLoading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="set-modal-card set-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="set-confirm-icon-wrap">
          <div className="set-confirm-icon danger">
            <i className="fa-brands fa-google" />
          </div>
        </div>

        <div className="set-confirm-content">
          <h3 className="set-confirm-title">Putuskan Hubungan Google?</h3>
          <p className="set-confirm-desc">
            {linkedEmail ? (
              <>
                Akun Google <strong>{linkedEmail}</strong> tidak lagi dapat digunakan untuk masuk cepat ke akun PTVPRO Anda.
              </>
            ) : (
              'Akun Google Anda tidak lagi dapat digunakan untuk masuk cepat ke akun PTVPRO Anda.'
            )}
          </p>
          <p className="set-confirm-desc" style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '6px' }}>
            Akun utama PTVPRO, profil kru, riwayat aktivitas, dan login kredensial sandi/PIN Anda tetap utuh dan aktif.
          </p>
        </div>

        <div className="set-modal-footer set-confirm-footer">
          <button
            type="button"
            className="set-btn set-btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            type="button"
            className="set-btn set-btn-danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-link-slash" />
                <span>Putuskan Hubungan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
