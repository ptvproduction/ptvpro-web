import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { Announcement } from '../types';

interface AnnouncementDetailModalProps {
  announcement: Announcement | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (ann: Announcement) => void;
  onDelete?: (ann: Announcement) => void;
  canManage: boolean;
}

export const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({
  announcement,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  canManage,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(isOpen && announcement),
    onClose,
    modalRef,
    id: 'broadcast-announcement-detail-modal',
  });

  if (!isOpen || !announcement) return null;

  const modalContent = (
    <div ref={modalRef} className="bc-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bc-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bc-modal-header">
          <div className="bc-modal-title-wrap">
            <span
              className={`bc-chip ${
                announcement.prio === 'penting' ? 'bc-chip-gold' : 'bc-chip-muted'
              }`}
            >
              <i
                className={
                  announcement.prio === 'penting'
                    ? 'fa-solid fa-triangle-exclamation'
                    : 'fa-regular fa-bell'
                }
              />
              <span>{announcement.prio === 'penting' ? 'Penting' : 'Normal'}</span>
            </span>
            <div className="bc-detail-date">
              <i className="fa-regular fa-calendar" />
              <span>{announcement.date}</span>
            </div>
          </div>
          <button
            type="button"
            className="bc-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup detail"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="bc-modal-body">
          <h2 className="bc-detail-title">{announcement.title}</h2>

          <div className="bc-detail-content">
            {announcement.body.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <div className="bc-detail-meta" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line-2)' }}>
            <div className="bc-detail-author">
              <div className="bc-author-avatar">
                <i className="fa-solid fa-user-tie" />
              </div>
              <div>
                <span className="bc-author-label">Diterbitkan oleh</span>
                <span className="bc-author-name">{announcement.by}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bc-modal-footer">
          {canManage ? (
            <>
              <button
                type="button"
                className="bc-btn bc-btn-danger"
                onClick={() => {
                  onDelete?.(announcement);
                }}
              >
                <i className="fa-regular fa-trash-can" />
                <span>Hapus</span>
              </button>
              <div className="bc-footer-spacer" />
              <button
                type="button"
                className="bc-btn bc-btn-secondary"
                onClick={() => {
                  onEdit?.(announcement);
                }}
              >
                <i className="fa-regular fa-pen-to-square" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className="bc-btn bc-btn-primary"
                onClick={onClose}
              >
                Tutup
              </button>
            </>
          ) : (
            <button
              type="button"
              className="bc-btn bc-btn-primary"
              style={{ width: '100%' }}
              onClick={onClose}
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
