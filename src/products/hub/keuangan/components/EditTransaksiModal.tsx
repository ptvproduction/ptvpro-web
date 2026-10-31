import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Upload, Trash2, X, Check } from 'lucide-react';
import type { PemasukanRecord, PengeluaranRecord, PemasukanKategori, PengeluaranKategori } from '../types';
import { fmtRupiah } from '../keuanganStore';
import type { CanonicalCategory } from '../financeCanonical';

interface EditTransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'pemasukan' | 'pengeluaran';
  pemasukanItem?: PemasukanRecord | null;
  pengeluaranItem?: PengeluaranRecord | null;
  canonicalCategories?: CanonicalCategory[];
  onSavePemasukan: (id: string, data: {
    tanggal: string;
    sumber: string;
    kategori: PemasukanKategori;
    nominal: number;
    keterangan: string;
    bukti_url?: string;
    categoryId?: string;
  }) => void;
  onSavePengeluaran: (id: string, data: {
    tanggal: string;
    keperluan: string;
    kategori: PengeluaranKategori;
    nominal: number;
    keterangan: string;
    bukti_url?: string;
    categoryId?: string;
  }) => void;
}

export const EditTransaksiModal: React.FC<EditTransaksiModalProps> = ({
  isOpen,
  onClose,
  type,
  pemasukanItem,
  pengeluaranItem,
  canonicalCategories = [],
  onSavePemasukan,
  onSavePengeluaran,
}) => {
  const [tanggal, setTanggal] = useState('');
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [nominal, setNominal] = useState<number | ''>('');
  const [keterangan, setKeterangan] = useState('');
  const [buktiUrl, setBuktiUrl] = useState('');

  useEffect(() => {
    if (type === 'pemasukan' && pemasukanItem) {
      setTanggal(pemasukanItem.tanggal);
      setJudul(pemasukanItem.sumber);
      setKategori(pemasukanItem.kategori);
      setNominal(pemasukanItem.nominal);
      setKeterangan(pemasukanItem.keterangan || '');
      setBuktiUrl(pemasukanItem.bukti_url || '');
    } else if (type === 'pengeluaran' && pengeluaranItem) {
      setTanggal(pengeluaranItem.tanggal);
      setJudul(pengeluaranItem.keperluan);
      setKategori(pengeluaranItem.kategori);
      setNominal(pengeluaranItem.nominal);
      setKeterangan(pengeluaranItem.keterangan || '');
      setBuktiUrl(pengeluaranItem.bukti_url || '');
    }
  }, [type, pemasukanItem, pengeluaranItem]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) setBuktiUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim()) return;
    const num = Number(nominal) || 0;
    if (num <= 0) return;

    if (type === 'pemasukan' && pemasukanItem) {
      onSavePemasukan(pemasukanItem.id, {
        tanggal,
        sumber: judul.trim(),
        kategori: (kategori as PemasukanKategori) || 'Sponsor',
        nominal: num,
        keterangan: keterangan.trim(),
        bukti_url: buktiUrl.trim() || undefined,
        categoryId: categoryId || undefined,
      });
    } else if (type === 'pengeluaran' && pengeluaranItem) {
      onSavePengeluaran(pengeluaranItem.id, {
        tanggal,
        keperluan: judul.trim(),
        kategori: (kategori as PengeluaranKategori) || 'Operasional',
        nominal: num,
        keterangan: keterangan.trim(),
        bukti_url: buktiUrl.trim() || undefined,
        categoryId: categoryId || undefined,
      });
    }
    onClose();
  };

  const isPem = type === 'pemasukan';
  const relevantCategories = canonicalCategories.filter(
    (c) => c.kind === (isPem ? 'income' : 'expense') && c.isActive
  );

  return (
    <div className="fin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fin-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className={`fin-modal-header-icon ${isPem ? 'ok' : 'danger'}`}>
            {isPem ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
          </div>
          <div>
            <h3 className="fin-modal-title">Edit Data {isPem ? 'Pemasukan Kas' : 'Pengeluaran Kas'}</h3>
            <p className="fin-modal-subtitle">Perbarui rincian nominal, nota, atau keterangan belanja</p>
          </div>
          <button type="button" className="fin-modal-close-btn" onClick={onClose} aria-label="Tutup Modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fin-modal-body">
            <div className="fin-form-row">
              <div className="fin-form-group flex-1">
                <label htmlFor="edit-tanggal" className="fin-form-label">
                  Tanggal {isPem ? 'Pemasukan' : 'Pengeluaran'} *
                </label>
                <input
                  id="edit-tanggal"
                  type="date"
                  className="fin-form-input"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                />
              </div>

              <div className="fin-form-group flex-1">
                <label htmlFor="edit-kategori" className="fin-form-label">
                  Kategori *
                </label>
                {relevantCategories.length > 0 ? (
                  <select
                    id="edit-kategori"
                    className="fin-form-select"
                    value={categoryId || kategori}
                    onChange={(e) => {
                      const selected = relevantCategories.find((c) => c.id === e.target.value);
                      if (selected) {
                        setCategoryId(selected.id);
                        setKategori(selected.name);
                      } else {
                        setKategori(e.target.value);
                      }
                    }}
                  >
                    <option value="">Pilih Kategori</option>
                    {relevantCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : isPem ? (
                  <select
                    id="edit-kategori"
                    className="fin-form-select"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                  >
                    <option value="Sponsor">Sponsorship Acara / Liputan</option>
                    <option value="Jasa Liputan">Jasa Liputan & Streaming</option>
                    <option value="Donasi">Donasi / Infaq Alumni</option>
                    <option value="Iuran Kas">Iuran Kas</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                ) : (
                  <select
                    id="edit-kategori"
                    className="fin-form-select"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                  >
                    <option value="Operasional">Operasional Rutin Studio</option>
                    <option value="Peralatan">Pengadaan / Perbaikan Peralatan</option>
                    <option value="Konsumsi">Konsumsi Kru Liputan</option>
                    <option value="Transportasi">BBM & Transportasi Armada</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                )}
              </div>
            </div>

            <div className="fin-form-group">
              <label htmlFor="edit-judul" className="fin-form-label">
                {isPem ? 'Sumber / Pihak Pembayar *' : 'Keperluan Pengeluaran *'}
              </label>
              <input
                id="edit-judul"
                type="text"
                className="fin-form-input"
                placeholder={isPem ? 'Misal: Honor Liputan, Donasi' : 'Misal: Beli Kabel HDMI, Konsumsi'}
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                required
              />
            </div>

            <div className="fin-form-group">
              <label htmlFor="edit-nominal" className="fin-form-label">
                Nominal {isPem ? 'Masuk' : 'Keluar'} (Rp) *
              </label>
              <input
                id="edit-nominal"
                type="number"
                min="1000"
                step="500"
                className="fin-form-input"
                value={nominal}
                onChange={(e) => setNominal(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                required
              />
              {typeof nominal === 'number' && nominal > 0 && (
                <div className="fin-nominal-preview">
                  Terbilang:{' '}
                  <span className={`font-bold ${isPem ? 'text-green' : 'text-red'}`}>
                    {isPem ? '+ ' : '- '}
                    {fmtRupiah(nominal)}
                  </span>
                </div>
              )}
            </div>

            <div className="fin-form-group">
              <label className="fin-form-label">
                Foto Nota / Struk / Kuitansi Belanja
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label className="fin-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}>
                  <Upload size={14} />
                  <span>Pilih Foto dari Perangkat</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>
                {buktiUrl && (
                  <button
                    type="button"
                    className="fin-btn-secondary"
                    style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => setBuktiUrl('')}
                  >
                    <Trash2 size={13} style={{ marginRight: '4px' }} /> Hapus Bukti
                  </button>
                )}
              </div>

              {buktiUrl && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: 'var(--r-item)', overflow: 'hidden', border: '1px solid var(--line-2)' }}>
                    <img src={buktiUrl} alt="Thumbnail Bukti" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--ink-2)' }}>Foto nota telah terpasang dan siap disimpan</span>
                </div>
              )}

              <input
                id="edit-bukti"
                type="url"
                className="fin-form-input"
                style={{ marginTop: '8px' }}
                placeholder="Atau tautkan URL gambar https://..."
                value={buktiUrl.startsWith('data:') ? '' : buktiUrl}
                onChange={(e) => setBuktiUrl(e.target.value)}
              />
            </div>

            <div className="fin-form-group">
              <label htmlFor="edit-keterangan" className="fin-form-label">
                Keterangan / Catatan
              </label>
              <textarea
                id="edit-keterangan"
                rows={2}
                className="fin-form-textarea"
                placeholder="Catatan toko, nomor invoice, atau rincian pembelanjaan..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>
          </div>

          <div className="fin-modal-footer">
            <button type="button" className="fin-btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button
              type="submit"
              className={`fin-btn-primary ${isPem ? 'green' : 'red'}`}
              disabled={!judul.trim() || !nominal || nominal <= 0}
            >
              <Check size={16} style={{ marginRight: '4px' }} />
              <span>{isPem ? 'Perbarui Pemasukan' : 'Perbarui Pengeluaran'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
