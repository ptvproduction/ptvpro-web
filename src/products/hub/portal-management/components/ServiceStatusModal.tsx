import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { PortalManagedService, ServiceStatus } from '../types';

interface ServiceStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: PortalManagedService | null;
  onSaveStatus: (serviceId: string, status: ServiceStatus, note?: string) => Promise<void>;
}

export const ServiceStatusModal: React.FC<ServiceStatusModalProps> = ({
  isOpen,
  onClose,
  service,
  onSaveStatus,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeWhenIdle = () => {
    if (!isSubmitting) onClose();
  };

  useModalScrollLock({
    isOpen,
    onClose: closeWhenIdle,
    modalRef,
    id: 'modal-service-status',
  });

  const [status, setStatus] = useState<ServiceStatus>('ok');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (service) {
      setStatus(service.st);
      setNote(service.statusNote || '');
    }
  }, [service, isOpen]);

  if (!isOpen || !service) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSaveStatus(service.id, status, note.trim() || undefined);
      onClose();
    } catch (err: any) {
      alert(`Gagal menyimpan status: ${err.message || 'Error'}`);
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
      aria-labelledby="serviceStatusModalTitle"
    >
      <div
        ref={modalRef}
        className="pm-modal-dialog"
        style={{ maxWidth: '480px' }}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pm-modal-header">
          <div>
            <span className="pm-badge" style={{ background: 'var(--b-050)', color: 'var(--b-700)', fontWeight: 600, marginBottom: '3px' }}>
              STATUS OPERASIONAL
            </span>
            <h2 id="serviceStatusModalTitle" className="pm-modal-title">
              Ubah Status: {service.name?.id || service.id}
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
          <div>
            <label className="set-label">Status Layanan Saat Ini</label>
            <select
              className="set-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ServiceStatus)}
            >
              <option value="ok">🟢 Normal (Operasional Penuh)</option>
              <option value="deg">🟡 Degraded (Gangguan Sebagian)</option>
              <option value="down">🔴 Down (Tidak Dapat Diakses)</option>
              <option value="maint">🔧 Maintenance (Pemeliharaan Sistem)</option>
            </select>
          </div>

          <div>
            <label className="set-label">Catatan Gangguan / Maintenance (Publik)</label>
            <textarea
              className="set-input"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Server transmisi sedang dalam peningkatan kapasitas hingga pukul 16:00 WIB"
              style={{ resize: 'vertical' }}
            />
            <small style={{ color: 'var(--muted)', fontSize: '11.5px', display: 'block', marginTop: '4px' }}>
              Catatan ini akan tampil langsung di kartu status portal publik.
            </small>
          </div>
        </div>

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
            className="pm-btn-pill pm-btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            <i className="fa-solid fa-check" style={{ marginRight: '4px' }} />
            Simpan Status
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
