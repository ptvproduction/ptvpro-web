import React, { useState } from 'react';
import { PemasukanKategori } from '../types';
import { fmtRupiah } from '../keuanganStore';

interface CatatPemasukanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    tanggal: string;
    sumber: string;
    kategori: PemasukanKategori;
    nominal: number;
    keterangan: string;
    bukti_url?: string;
  }) => void;
}

const SAMPLE_RECEIPT_URL = 'https://images.unsplash.com/photo-1554415707-9e4466bfe032?auto=format&fit=crop&w=600&q=80';

export const CatatPemasukanModal: React.FC<CatatPemasukanModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [sumber, setSumber] = useState('');
  const [kategori, setKategori] = useState<PemasukanKategori>('Sponsor');
  const [nominal, setNominal] = useState<number | ''>('');
  const [keterangan, setKeterangan] = useState('');
  const [buktiUrl, setBuktiUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sumber.trim()) return;
    const num = Number(nominal) || 0;
    if (num <= 0) return;

    onSave({
      tanggal,
      sumber: sumber.trim(),
      kategori,
      nominal: num,
      keterangan: keterangan.trim(),
      bukti_url: buktiUrl.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fin-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-icon ok">
            <i className="fa-solid fa-arrow-down" />
          </div>
          <div>
            <h3 className="fin-modal-title">Catat Pemasukan Kas</h3>
            <p className="fin-modal-subtitle">Pencatatan kas masuk operasional atau sponsorship studio</p>
          </div>
          <button type="button" className="fin-modal-close-btn" onClick={onClose} aria-label="Tutup Modal">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fin-modal-body">
            <div className="fin-form-row">
              <div className="fin-form-group flex-1">
                <label htmlFor="pem-tanggal" className="fin-form-label">
                  Tanggal Transaksi *
                </label>
                <input
                  id="pem-tanggal"
                  type="date"
                  className="fin-form-input"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                />
              </div>

              <div className="fin-form-group flex-1">
                <label htmlFor="pem-kategori" className="fin-form-label">
                  Kategori Pemasukan *
                </label>
                <select
                  id="pem-kategori"
                  className="fin-form-select"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as PemasukanKategori)}
                >
                  <option value="Sponsor">Sponsorship Acara / Liputan</option>
                  <option value="Jasa Liputan">Jasa Liputan & Streaming</option>
                  <option value="Donasi">Donasi / Infaq Alumni</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <div className="fin-form-group">
              <label htmlFor="pem-sumber" className="fin-form-label">
                Sumber / Pihak Pembayar *
              </label>
              <input
                id="pem-sumber"
                type="text"
                className="fin-form-input"
                placeholder="Misal: Panitia Wisuda, Sponsor Brand X, Infaq Alumni"
                value={sumber}
                onChange={(e) => setSumber(e.target.value)}
                required
              />
            </div>

            <div className="fin-form-group">
              <label htmlFor="pem-nominal" className="fin-form-label">
                Nominal (Rp) *
              </label>
              <input
                id="pem-nominal"
                type="number"
                min="1000"
                step="500"
                className="fin-form-input"
                placeholder="0"
                value={nominal}
                onChange={(e) => setNominal(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                required
              />
              {typeof nominal === 'number' && nominal > 0 && (
                <div className="fin-nominal-preview">
                  Terbilang: <span className="font-bold text-green">{fmtRupiah(nominal)}</span>
                </div>
              )}
            </div>

            <div className="fin-form-group">
              <label htmlFor="pem-keterangan" className="fin-form-label">
                Keterangan / Rincian
              </label>
              <textarea
                id="pem-keterangan"
                rows={2}
                className="fin-form-textarea"
                placeholder="Rincian pembayaran atau peruntukan kas..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>

            <div className="fin-form-group">
              <label htmlFor="pem-bukti" className="fin-form-label">
                URL Bukti Transfer / Kuitansi (Opsional)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="pem-bukti"
                  type="url"
                  className="fin-form-input flex-1"
                  placeholder="https://..."
                  value={buktiUrl}
                  onChange={(e) => setBuktiUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="fin-btn-secondary sm"
                  onClick={() => setBuktiUrl(SAMPLE_RECEIPT_URL)}
                  title="Gunakan URL bukti mock untuk simulasi showcase"
                >
                  <i className="fa-solid fa-paperclip" />
                  <span>Preset Mock</span>
                </button>
              </div>
            </div>
          </div>

          <div className="fin-modal-footer">
            <button type="button" className="fin-btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="fin-btn-primary green" disabled={!sumber.trim() || !nominal || nominal <= 0}>
              <i className="fa-solid fa-plus" />
              <span>Simpan Pemasukan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
