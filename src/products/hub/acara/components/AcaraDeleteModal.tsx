/**
 * PTV PRO — Modul Acara
 * Modal Konfirmasi Hapus Acara Liputan
 * Porting confirmDeleteEvent (page-dasbor.php L33186–33217)
 */

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AcaraItem } from '../types';
import { useAcara } from '../context/AcaraContext';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface AcaraDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AcaraItem;
  onSuccess?: () => void;
}

export const AcaraDeleteModal: React.FC<AcaraDeleteModalProps> = ({
  isOpen,
  onClose,
  event,
  onSuccess
}) => {
  const { deleteEvent } = useAcara();
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'acara-delete-modal',
  });

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!event) return;
    setIsDeleting(true);
    try {
      const ok = await deleteEvent(event.id);
      if (ok) {
        onClose();
        if (onSuccess) onSuccess();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !event) return null;

  const modalContent = (
    <div
      className="acara-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acara-delete-modal-title"
    >
      <div ref={modalRef} className="acara-modal-sheet" style={{ maxWidth: '440px' }}>
        <div className="acara-modal-header" style={{ borderBottomColor: '#fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
            <AlertTriangle size={20} />
            <h3 className="acara-modal-title" id="acara-delete-modal-title" style={{ color: '#dc2626' }}>
              Hapus Acara
            </h3>
          </div>
          <button type="button" className="acara-modal-close-btn" onClick={onClose} aria-label="Tutup modal">
            <X size={18} />
          </button>
        </div>

        <div className="acara-modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: 'var(--r-full, 9999px)',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}
          >
            <Trash2 size={24} />
          </div>

          <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 750, color: '#0f172a' }}>
            Yakin ingin menghapus acara ini?
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Acara <strong>&quot;{event.name}&quot;</strong> beserta data penugasan kru dan peralatan terkait akan dihapus dari jadwal operasional.
          </p>
        </div>

        <div className="acara-modal-footer" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="acara-btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
            style={{ flex: 1, opacity: isDeleting ? 0.6 : 1 }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--r-full, 9999px)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.7 : 1
            }}
          >
            <Trash2 size={15} /> {isDeleting ? 'Menghapus...' : 'Ya, Hapus Acara'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
