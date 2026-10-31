import React, { useState } from 'react';
import { AlertCircle, Ban, X } from 'lucide-react';
import { fmtRupiah } from '../keuanganStore';

interface BatalkanTransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'pemasukan' | 'pengeluaran' | 'transfer';
  nominalMinor: string;
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

export const BatalkanTransaksiModal: React.FC<BatalkanTransaksiModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  nominalMinor,
  onConfirm,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Alasan pembatalan transaksi wajib diisi untuk rekam jejak audit.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  const isExpense = type === 'pengeluaran';
  const nominalNum = Math.abs(Number(nominalMinor) / 100);

  return (
    <div className="fin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-icon danger">
            <Ban size={20} />
          </div>
          <div>
            <h3 className="fin-modal-title">
              {isExpense ? 'Batalkan Pengeluaran' : 'Batalkan Transaksi'}
            </h3>
            <p className="fin-modal-subtitle">Pembatalan resmi non-destruktif (Reversal)</p>
          </div>
          <button type="button" className="fin-modal-close-btn" onClick={onClose} aria-label="Tutup Modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fin-modal-body">
            <div className="dialog-alert-box warning" style={{ marginBottom: '14px' }}>
              <AlertCircle size={18} />
              <p>
                Transaksi tidak akan dihapus permanen. Status akan diubah menjadi <strong>reversed (dibatalkan)</strong> dan mutasi saldo buku besar akan dikembalikan.
              </p>
            </div>

            <div style={{ background: 'var(--bg-2, #f8fafc)', padding: '12px 14px', borderRadius: 'var(--r-item)', marginBottom: '14px', border: '1px solid var(--line-2, #e2e8f0)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-3, #64748b)', fontWeight: 700 }}>
                Transaksi yang Dibatalkan:
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink, #0f172a)', marginTop: '2px' }}>
                {title}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 850, color: isExpense ? '#dc2626' : '#059669', marginTop: '4px' }}>
                {isExpense ? '- ' : '+ '}{fmtRupiah(nominalNum)}
              </div>
            </div>

            <div className="fin-form-group">
              <label htmlFor="batal-reason" className="fin-form-label">
                Alasan Pembatalan *
              </label>
              <textarea
                id="batal-reason"
                rows={3}
                className="fin-form-textarea"
                placeholder="Misal: Salah input nominal, transaksi ganda, nota belanja dibatalkan toko..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                required
              />
              {error && <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>{error}</span>}
            </div>
          </div>

          <div className="fin-modal-footer">
            <button type="button" className="fin-btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Batal
            </button>
            <button
              type="submit"
              className="fin-btn-primary red"
              disabled={!reason.trim() || isSubmitting}
            >
              <Ban size={15} style={{ marginRight: '6px' }} />
              <span>{isSubmitting ? 'Memproses...' : isExpense ? 'Batalkan Pengeluaran' : 'Batalkan Transaksi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
