import React, { useState } from 'react';
import { PaymentMethod } from '../types';
import { fmtRupiah, fmtPeriodeBulan } from '../keuanganStore';

interface TandaiLunasModalProps {
  isOpen: boolean;
  onClose: () => void;
  crewName: string;
  crewPtvId: string;
  crewId: string;
  periodeBulan: string;
  nominal: number;
  onConfirm: (data: {
    crewId: string;
    crewPtvId: string;
    crewNama: string;
    periodeBulan: string;
    metodeBayar: PaymentMethod;
    tanggalBayar: string;
  }) => void;
}

export const TandaiLunasModal: React.FC<TandaiLunasModalProps> = ({
  isOpen,
  onClose,
  crewName,
  crewPtvId,
  crewId,
  periodeBulan,
  nominal,
  onConfirm,
}) => {
  const [metode, setMetode] = useState<PaymentMethod>('Tunai');
  const [tanggal, setTanggal] = useState<string>(() => new Date().toISOString().slice(0, 10));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      crewId,
      crewPtvId,
      crewNama: crewName,
      periodeBulan,
      metodeBayar: metode,
      tanggalBayar: tanggal,
    });
    onClose();
  };

  return (
    <div className="fin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fin-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-icon ok">
            <i className="fa-solid fa-receipt" />
          </div>
          <div>
            <h3 className="fin-modal-title">Tandai Iuran Kas Lunas</h3>
            <p className="fin-modal-subtitle">Pencatatan pembayaran kas kru operasional PTV</p>
          </div>
          <button type="button" className="fin-modal-close-btn" onClick={onClose} aria-label="Tutup Modal">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fin-modal-body">
            <div className="fin-highlight-box">
              <div className="fin-highlight-row">
                <span className="fin-highlight-label">Nama Kru:</span>
                <span className="fin-highlight-val font-bold">
                  {crewName} <span className="fin-kru-id-badge">{crewPtvId}</span>
                </span>
              </div>
              <div className="fin-highlight-row">
                <span className="fin-highlight-label">Periode Kas:</span>
                <span className="fin-highlight-val">{fmtPeriodeBulan(periodeBulan)}</span>
              </div>
              <div className="fin-highlight-row">
                <span className="fin-highlight-label">Nominal Iuran:</span>
                <span className="fin-highlight-val text-green font-bold">{fmtRupiah(nominal)}</span>
              </div>
            </div>

            <div className="fin-form-group">
              <label htmlFor="tgl-bayar" className="fin-form-label">
                Tanggal Pembayaran
              </label>
              <input
                id="tgl-bayar"
                type="date"
                className="fin-form-input"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
            </div>

            <div className="fin-form-group">
              <label htmlFor="metode-bayar" className="fin-form-label">
                Metode Pembayaran
              </label>
              <select
                id="metode-bayar"
                className="fin-form-select"
                value={metode}
                onChange={(e) => setMetode(e.target.value as PaymentMethod)}
              >
                <option value="Tunai">Tunai (Cash ke Bendahara/Kasir)</option>
                <option value="Transfer QRIS">Transfer QRIS PTV</option>
                <option value="Transfer Bank">Transfer Rekening Bank Studio</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          </div>

          <div className="fin-modal-footer">
            <button type="button" className="fin-btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="fin-btn-primary green">
              <i className="fa-solid fa-check" />
              <span>Simpan & Lunaskan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
