/**
 * PTV PRO — Modul Acara
 * Modal Ubah Status Acara Liputan
 * Porting openChangeEventStatus (page-dasbor.php L33131–33184)
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AcaraItem, AcaraStatus } from '../types';
import { useAcara } from '../context/AcaraContext';
import { X, Check, RotateCw } from 'lucide-react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface AcaraStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AcaraItem;
}

export const AcaraStatusModal: React.FC<AcaraStatusModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const { updateEventStatus } = useAcara();
  const [selectedStatus, setSelectedStatus] = useState<AcaraStatus>(event?.status || 'Mendatang');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'acara-status-modal',
  });

  useEffect(() => {
    if (isOpen && event) {
      setSelectedStatus(event.status || 'Mendatang');
    }
  }, [isOpen, event]);

  const handleCancel = () => {
    if (event) {
      setSelectedStatus(event.status || 'Mendatang');
    }
    onClose();
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const ok = await updateEventStatus(event.id, selectedStatus);
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions: { value: AcaraStatus; label: string; desc: string }[] = [
    { value: 'Mendatang', label: 'Mendatang / Terjadwal', desc: 'Acara dalam persiapan dan akan dilaksanakan sesuai jadwal.' },
    { value: 'Berlangsung', label: 'Sedang Berlangsung', desc: 'Peliputan lapangan atau produksi siaran sedang aktif berjalan.' },
    { value: 'Selesai', label: 'Selesai', desc: 'Acara dan peliputan telah tuntas dilaksanakan.' },
    { value: 'Dibatalkan', label: 'Dibatalkan', desc: 'Kegiatan resmi dibatalkan atau ditunda tanpa batas waktu.' }
  ];

  const modalContent = (
    <div
      className="acara-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acara-status-modal-title"
    >
      <div ref={modalRef} className="acara-modal-sheet" style={{ maxWidth: '480px' }}>
        <div className="acara-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCw size={18} style={{ color: '#2563eb' }} />
            <h3 className="acara-modal-title" id="acara-status-modal-title">
              Ubah Status Acara
            </h3>
          </div>
          <button type="button" className="acara-modal-close-btn" onClick={handleCancel} aria-label="Tutup modal">
            <X size={18} />
          </button>
        </div>

        <div className="acara-modal-body">
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Pilih status operasional terbaru untuk acara <strong>{event.name}</strong>:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {statusOptions.map((opt) => {
              const isSelected = selectedStatus === opt.value;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: 'var(--r-xl, 14px)',
                    border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="status_radio"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => setSelectedStatus(opt.value)}
                    style={{ marginTop: '2px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 750, color: '#0f172a' }}>{opt.label}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>
                      {opt.desc}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="acara-modal-footer">
          <button type="button" className="acara-btn-secondary" onClick={handleCancel} disabled={isSubmitting}>
            Batal
          </button>
          <button type="button" className="acara-btn-primary" onClick={handleSave} disabled={isSubmitting}>
            <Check size={16} /> {isSubmitting ? 'Menerapkan...' : 'Terapkan Status'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
