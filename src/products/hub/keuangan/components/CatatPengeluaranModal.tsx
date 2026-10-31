import React, { useState } from 'react';
import { PengeluaranKategori } from '../types';
import { fmtRupiah } from '../keuanganStore';

interface CatatPengeluaranModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    tanggal: string;
    keperluan: string;
    kategori: PengeluaranKategori;
    nominal: number;
    keterangan: string;
    bukti_url?: string;
  }) => void;
}

const SAMPLE_RECEIPT_URL = 'https://images.unsplash.com/photo-1554415707-9e4466bfe032?auto=format&fit=crop&w=600&q=80';

export const CatatPengeluaranModal: React.FC<CatatPengeluaranModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [keperluan, setKeperluan] = useState('');
  const [kategori, setKategori] = useState<PengeluaranKategori>('Operasional');
  const [nominal, setNominal] = useState<number | ''>('');
  const [keterangan, setKeterangan] = useState('');
  const [buktiUrl, setBuktiUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keperluan.trim()) return;
    const num = Number(nominal) || 0;
    if (num <= 0) return;

    onSave({
      tanggal,
      keperluan: keperluan.trim(),
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
          <div className="fin-modal-header-icon danger">
            <i className="fa-solid fa-arrow-up" />
          </div>
          <div>
            <h3 className="fin-modal-title">Catat Pengeluaran Kas</h3>
            <p className="fin-modal-subtitle">Pencatatan belanja operasional, alat studio, atau logistik kru</p>
          </div>
          <button type="button" className="fin-modal-close-btn" onClick={onClose} aria-label="Tutup Modal">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fin-modal-body">
            <div className="fin-form-row">
              <div className="fin-form-group flex-1">
                <label htmlFor="pen-tanggal" className="fin-form-label">
                  Tanggal Transaksi *
                </label>
                <input
                  id="pen-tanggal"
                  type="date"
                  className="fin-form-input"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                />
              </div>

              <div className="fin-form-group flex-1">
                <label htmlFor="pen-kategori" className="fin-form-label">
                  Kategori Pengeluaran *
                </label>
                <select
                  id="pen-kategori"
                  className="fin-form-select"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as PengeluaranKategori)}
                >
                  <option value="Operasional">Operasional Rutin Studio</option>
                  <option value="Peralatan">Pengadaan / Perbaikan Peralatan</option>
                  <option value="Konsumsi">Konsumsi Kru Liputan</option>
                  <option value="Transportasi">BBM & Transportasi Armada</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <div className="fin-form-group">
              <label htmlFor="pen-keperluan" className="fin-form-label">
                Keperluan / Nama Belanja *
              </label>
              <input
                id="pen-keperluan"
                type="text"
                className="fin-form-input"
                placeholder="Misal: Beli Kabel HDMI 15m, Konsumsi Liputan Haul, dsb."
                value={keperluan}
                onChange={(e) => setKeperluan(e.target.value)}
                required
              />
            </div>

            <div className="fin-form-group">
              <label htmlFor="pen-nominal" className="fin-form-label">
                Nominal (Rp) *
              </label>
              <input
                id="pen-nominal"
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
                  Terbilang: <span className="font-bold text-red">- {fmtRupiah(nominal)}</span>
                </div>
              )}
            </div>

            <div className="fin-form-group">
              <label htmlFor="pen-keterangan" className="fin-form-label">
                Keterangan / Rincian Belanja
              </label>
              <textarea
                id="pen-keterangan"
                rows={2}
                className="fin-form-textarea"
                placeholder="Toko, nomor nota, atau rincian pembelanjaan..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>

            <div className="fin-form-group">
              <label htmlFor="pen-bukti" className="fin-form-label">
                URL Bukti Pembayaran / Struk (Opsional)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="pen-bukti"
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
            <button type="submit" className="fin-btn-primary red" disabled={!keperluan.trim() || !nominal || nominal <= 0}>
              <i className="fa-solid fa-plus" />
              <span>Simpan Pengeluaran</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
