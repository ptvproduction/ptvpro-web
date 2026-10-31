/**
 * PTV PRO — Modul Acara
 * Modal Tambah & Edit Item Rundown Kegiatan
 * Porting openAddEventRundown (L32830) & openEditEventRundown (L32862)
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AcaraItem, AcaraRundownItem } from '../types';
import { useAcara } from '../context/AcaraContext';
import { X, Check, Clock } from 'lucide-react';
import { formatRundownJam } from '../utils/rundownUtils';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface AcaraRundownModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AcaraItem;
  itemToEdit?: AcaraRundownItem | null;
}

export const AcaraRundownModal: React.FC<AcaraRundownModalProps> = ({
  isOpen,
  onClose,
  event,
  itemToEdit
}) => {
  const { addRundownItem, updateRundownItem } = useAcara();
  const isEditing = Boolean(itemToEdit);

  const [jam, setJam] = useState('19.00');
  const [kegiatan, setKegiatan] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const jamInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'acara-rundown-modal',
  });

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setJam(formatRundownJam(itemToEdit.jam_mulai));
        setKegiatan(itemToEdit.kegiatan || '');
      } else {
        setJam('19.00');
        setKegiatan('');
      }
      setErrorMsg('');

      const timer = setTimeout(() => jamInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, itemToEdit]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jam.trim()) {
      setErrorMsg('Jam kegiatan wajib diisi.');
      return;
    }
    if (!kegiatan.trim()) {
      setErrorMsg('Nama kegiatan / sesi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      let ok = false;
      if (isEditing && itemToEdit) {
        ok = await updateRundownItem(event.id, itemToEdit.id, jam, kegiatan);
      } else {
        ok = await addRundownItem(event.id, jam, kegiatan);
      }

      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="acara-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acara-rundown-modal-title"
    >
      <div ref={modalRef} className="acara-modal-sheet" style={{ maxWidth: '480px' }}>
        <div className="acara-modal-header">
          <h3 className="acara-modal-title" id="acara-rundown-modal-title">
            {isEditing ? 'Edit Rundown Acara' : 'Tambah Rundown Acara'}
          </h3>
          <button type="button" className="acara-modal-close-btn" onClick={onClose} aria-label="Tutup modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="acara-modal-body">
            {errorMsg && (
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--r-md, 8px)',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="acara-field">
              <label className="acara-field-label" htmlFor="rd_form_jam">
                Waktu / Jam Kegiatan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Clock size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                <input
                  id="rd_form_jam"
                  ref={jamInputRef}
                  className="acara-field-input"
                  placeholder="Contoh: 19.00 atau 19:15"
                  value={jam}
                  onChange={(e) => {
                    setJam(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  style={{ paddingLeft: '36px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
                  required
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                Mendukung format titik (19.00) maupun titik dua (19:00).
              </span>
            </div>

            <div className="acara-field">
              <label className="acara-field-label" htmlFor="rd_form_kegiatan">
                Nama Sesi / Kegiatan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="rd_form_kegiatan"
                className="acara-field-input"
                placeholder="Contoh: Pembukaan, Pembacaan Shalawat, Mauidhoh Hasanah..."
                value={kegiatan}
                onChange={(e) => {
                  setKegiatan(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                required
              />
            </div>
          </div>

          <div className="acara-modal-footer">
            <button type="button" className="acara-btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Batal
            </button>
            <button type="submit" className="acara-btn-primary" disabled={isSubmitting}>
              <Check size={16} />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Rundown'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
