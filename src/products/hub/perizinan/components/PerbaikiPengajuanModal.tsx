import React, { useState, useRef, useEffect } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { PtvDocument } from '@products/hub/dokumen-saya/mock/docsMockData';

interface PerbaikiPengajuanModalProps {
  doc: PtvDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, updates: Partial<PtvDocument>) => void;
}

export const PerbaikiPengajuanModal: React.FC<PerbaikiPengajuanModalProps> = ({
  doc,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({ isOpen, onClose, modalRef });

  const [subject, setSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pj, setPj] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (doc) {
      setSubject(doc.subject || '');
      setStartDate(doc.start_date || doc.date || '');
      setEndDate(doc.end_date || doc.date || '');
      setPj(doc.penanggung_jawab || '');
      setErrorMsg(null);
    }
  }, [doc]);

  if (!isOpen || !doc) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!subject.trim()) {
      setErrorMsg('Perihal pengajuan tidak boleh kosong.');
      return;
    }
    if (endDate < startDate) {
      setErrorMsg('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }

    onSubmit(doc.id, {
      subject: subject.trim(),
      start_date: startDate,
      end_date: endDate,
      date: startDate,
      penanggung_jawab: pj.trim(),
    });
  };

  return (
    <div className="prz-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={modalRef}
        className="prz-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        <div className="prz-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--r-md, 10px)',
                background: 'rgba(245,158,11,0.12)',
                color: '#d97706',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fa-solid fa-pen-to-square" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                Perbaiki Pengajuan & Ajukan Ulang
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                Perbarui data sesuai arahan catatan revisi dari pimpinan
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup Modal"
            style={{ minWidth: '40px', minHeight: '40px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '16px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="prz-modal-body">
            {/* Review Note Alert Banner */}
            <div
              style={{
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: 'var(--r-lg, 12px)',
                padding: '14px 16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ color: '#d97706', fontSize: '14px' }} />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                  Catatan Revisi dari Reviewer
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: 1.45 }}>
                {doc.review_note || 'Mohon sesuaikan informasi permohonan sesuai instruksi review.'}
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  borderRadius: 'var(--r-md, 10px)',
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="prz-modal-field">
              <label className="prz-modal-label">
                Perihal / Judul Pengajuan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="prz-modal-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="prz-modal-field">
              <div>
                <label className="prz-modal-label">
                  Tanggal Mulai <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="prz-modal-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="prz-modal-label">
                  Tanggal Selesai <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="prz-modal-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="prz-modal-field">
              <label className="prz-modal-label">Penanggung Jawab</label>
              <input
                type="text"
                className="prz-modal-input"
                value={pj}
                onChange={(e) => setPj(e.target.value)}
              />
            </div>
          </div>

          <div className="prz-modal-footer">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{ minHeight: '42px', borderRadius: 'var(--ptv-curve-pill)' }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn pri"
              style={{
                flex: 1,
                minHeight: '42px',
                borderRadius: 'var(--ptv-curve-pill)',
                background: '#d97706',
                borderColor: '#d97706',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.28)',
              }}
            >
              <i className="fa-solid fa-arrow-rotate-right" style={{ marginRight: '6px' }} />
              Ajukan Ulang Perizinan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
