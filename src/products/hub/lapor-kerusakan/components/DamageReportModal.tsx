import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Send, Camera, Trash2, RotateCcw } from 'lucide-react';
import { useSessionStore } from '@core/session';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { ItemInventaris } from '../../inventaris/types';
import { DamageReportItem } from '../types';
import { loadDamageInventory } from '../damageInventoryService';

interface DamageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAssetId?: string;
  initialUnitId?: string;
  onSubmit: (report: Omit<DamageReportItem, 'id' | 'reportedAt' | 'status' | 'qcLocked'>) => Promise<void>;
}

export const DamageReportModal = ({ isOpen, onClose, onSubmit, initialAssetId, initialUnitId }: DamageReportModalProps) => {
  const user = useSessionStore((state) => state.user);
  const modalRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  useModalScrollLock({ isOpen, onClose, modalRef });
  const [assets, setAssets] = useState<ItemInventaris[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [assetId, setAssetId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(user?.full_name || '');
  const [reporterContact, setReporterContact] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setAssets([]);
    setAssetId('');
    setUnitId('');
    loadDamageInventory().then((items) => {
      if (cancelled) return;
      setAssets(items);
      const selected = items.find((item) => item.id === initialAssetId);
      if (selected) {
        setAssetId(selected.id);
        if (selected.units.some((unit) => unit.id === initialUnitId && unit.inventaris_id === selected.id)) setUnitId(initialUnitId!);
      }
    }).catch(() => {
      if (!cancelled) setError('Inventaris Staging gagal dimuat. Periksa koneksi dan konfigurasi, lalu coba lagi.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, initialAssetId, initialUnitId, retry]);

  const currentAsset = assets.find((item) => item.id === assetId);
  const units = currentAsset?.units.filter((unit) => unit.inventaris_id === currentAsset.id) || [];
  const currentUnit = units.find((unit) => unit.id === unitId);
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((item) => `${item.nama_alat} ${item.kode} ${item.kategori} ${item.spesifikasi || ''}`.toLowerCase().includes(query));
  }, [assets, search]);

  if (!isOpen) return null;

  const content = (
    <div className="ptv-hub-root damage-modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="damage-modal-card damage-live-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dmgModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          className="damage-modal-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving || loading || error || !currentAsset || !currentUnit || !title.trim()) return;
            const index = units.findIndex((unit) => unit.id === currentUnit.id);
            setSaveError('');
            setSaving(true);
            try {
              await onSubmit({
                assetId: currentAsset.id,
                assetName: currentAsset.nama_alat,
                assetCategory: currentAsset.kategori,
                unitId: currentUnit.id,
                unitCode: currentUnit.kode_unit,
                unitNumber: Number(currentUnit.kode_unit.match(/(?:-U?)(\d+)$/)?.[1]) || index + 1,
                title: title.trim(),
                description: description.trim() || '-',
                severity: 'Sedang',
                photoUrl,
                reporterName: reporterName.trim() || user?.full_name || 'Kru Studio',
                reporterContact: reporterContact.trim(),
                isCurrentUser: true,
              });
              onClose();
            } catch (err) {
              setSaveError(err instanceof Error ? err.message : 'Laporan belum tersimpan.');
            } finally {
              setSaving(false);
            }
          }}
        >
          <header className="damage-modal-header">
            <div>
              <h3 id="dmgModalTitle" className="damage-modal-header-title">Lapor Masalah &amp; Kerusakan Alat</h3>
              <p className="damage-modal-header-sub">Catat kendala teknis atau kerusakan unit inventaris studio</p>
            </div>
            <button type="button" className="damage-modal-close" onClick={onClose} aria-label="Tutup laporan kerusakan">
              <X size={20} />
            </button>
          </header>

          <div className="damage-modal-body">
          {saveError && (
            <div className="damage-alert-box error" role="alert">
              <p>{saveError}</p>
            </div>
          )}

          {loading && (
            <div className="damage-alert-box info" role="status">
              <i className="fa-solid fa-spinner fa-spin" />
              <span>Memuat inventaris dan unit fisik dari Staging…</span>
            </div>
          )}

          {error && (
            <div className="damage-alert-box error" role="alert">
              <p>{error}</p>
              <button className="btn sm" type="button" onClick={() => setRetry((value) => value + 1)}>
                <RotateCcw size={13} /> Coba Lagi
              </button>
            </div>
          )}

          {/* 1. Pemilihan Alat */}
          <div className="damage-form-field">
            <label className="damage-form-label" htmlFor="damage-asset-search">
              Peralatan Inventaris <span className="damage-req-mark">*</span>
            </label>

            {currentAsset ? (
              <div className="damage-selected-asset-box">
                <div className="damage-selected-asset-info">
                  <span className="damage-selected-asset-badge">{currentAsset.kode}</span>
                  <strong className="damage-selected-asset-name">{currentAsset.nama_alat}</strong>
                  <span className="damage-selected-asset-cat">{currentAsset.kategori} &bull; {currentAsset.units.length} unit terdaftar</span>
                </div>
                <button
                  type="button"
                  className="damage-btn-change-asset"
                  onClick={() => { setAssetId(''); setUnitId(''); }}
                >
                  Ganti Alat
                </button>
              </div>
            ) : (
              <>
                <div className="damage-live-search">
                  <Search size={16} />
                  <input
                    id="damage-asset-search"
                    className="damage-form-input search"
                    value={search}
                    disabled={loading || Boolean(error)}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Ketik nama, kode, atau kategori alat..."
                  />
                </div>
                <div className="damage-picker-box" role="group" aria-label="Inventaris Staging">
                  {filteredAssets.map((asset) => (
                    <button
                      type="button"
                      key={asset.id}
                      className={`damage-picker-item ${asset.id === assetId ? 'selected' : ''}`}
                      aria-pressed={asset.id === assetId}
                      onClick={() => { setAssetId(asset.id); setUnitId(''); }}
                    >
                      <div className="damage-picker-item-top">
                        <strong className="damage-picker-item-name">{asset.nama_alat}</strong>
                        <span className="damage-picker-item-code">{asset.kode}</span>
                      </div>
                      <div className="damage-picker-item-meta">
                        <span>{asset.kategori}</span>
                        <span>&bull;</span>
                        <span>{asset.units.length} unit ({asset.unit_tersedia} tersedia)</span>
                      </div>
                    </button>
                  ))}
                  {!loading && !error && !filteredAssets.length && (
                    <div className="damage-picker-empty">
                      <p>Tidak ada alat inventaris yang cocok.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 2. Pemilihan Unit Fisik */}
          <div className="damage-form-field">
            <label className="damage-form-label" htmlFor="damage-unit">
              Unit Fisik yang Bermasalah <span className="damage-req-mark">*</span>
            </label>
            <select
              id="damage-unit"
              className="damage-form-input select"
              value={unitId}
              required
              disabled={!currentAsset || loading || Boolean(error)}
              onChange={(event) => setUnitId(event.target.value)}
            >
              <option value="">
                {!currentAsset
                  ? 'Pilih alat inventaris terlebih dahulu'
                  : !units.length
                  ? 'Belum ada unit fisik terdaftar'
                  : '— Pilih salah satu unit fisik —'}
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.kode_unit} {unit.nama_unit ? `(${unit.nama_unit})` : ''} &bull; Kondisi: {unit.kondisi} &bull; Status: {unit.status_peminjaman}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Judul Laporan */}
          <div className="damage-form-field">
            <label htmlFor="damage-title" className="damage-form-label">
              Judul Masalah / Kerusakan <span className="damage-req-mark">*</span>
            </label>
            <input
              id="damage-title"
              className="damage-form-input"
              value={title}
              placeholder="Contoh: Lensa buram / Port HDMI longgar / Baterai drop"
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          {/* 4. Deskripsi / Kronologi */}
          <div className="damage-form-field">
            <label htmlFor="damage-description" className="damage-form-label">
              Kronologi / Penjelasan Gejala
            </label>
            <textarea
              id="damage-description"
              className="damage-form-textarea"
              value={description}
              placeholder="Jelaskan detail saat kendala terjadi, lokasi, atau indikasi fisik kerusakan..."
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {/* 5. Foto Kerusakan */}
          <div className="damage-form-field">
            <label htmlFor="damage-photo" className="damage-form-label">
              Foto Bukti Kerusakan <span className="damage-form-sublabel">(Opsional, maks. 2 MB)</span>
            </label>

            <input
              ref={photoInputRef}
              id="damage-photo"
              type="file"
              hidden
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPhotoError('');
                if (!file) return;
                if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
                  setPhotoError('Gunakan file gambar maksimal 2 MB.');
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setPhotoUrl(String(reader.result));
                reader.readAsDataURL(file);
              }}
            />

            {!photoUrl ? (
              <div
                className="damage-photo-dropzone"
                onClick={() => photoInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') photoInputRef.current?.click();
                }}
              >
                <div className="damage-photo-icon-wrap">
                  <Camera size={22} />
                </div>
                <div className="damage-photo-text-wrap">
                  <span className="damage-photo-cta">Klik untuk unggah foto kerusakan</span>
                  <span className="damage-photo-hint">Format PNG, JPG, atau WebP</span>
                </div>
              </div>
            ) : (
              <div className="damage-photo-preview-box">
                <img className="damage-live-photo" src={photoUrl} alt="Preview kerusakan" />
                <div className="damage-photo-preview-actions">
                  <button
                    type="button"
                    className="damage-btn-delete-photo"
                    onClick={() => {
                      setPhotoUrl(undefined);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Hapus Foto</span>
                  </button>
                </div>
              </div>
            )}
            {photoError && <p className="damage-field-error" role="alert">{photoError}</p>}
          </div>

          {/* 6. Kontak & Pelapor */}
          <div className="damage-live-contact-grid">
            <div className="damage-form-field">
              <label htmlFor="damage-reporter" className="damage-form-label">
                Nama Pelapor
              </label>
              <input
                id="damage-reporter"
                className="damage-form-input"
                value={reporterName}
                placeholder="Nama pelapor"
                onChange={(event) => setReporterName(event.target.value)}
              />
            </div>
            <div className="damage-form-field">
              <label htmlFor="damage-contact" className="damage-form-label">
                WhatsApp Pelapor <span className="damage-form-sublabel">(Opsional)</span>
              </label>
              <input
                id="damage-contact"
                className="damage-form-input"
                type="tel"
                value={reporterContact}
                placeholder="08xxxxxxxxxx"
                onChange={(event) => setReporterContact(event.target.value)}
              />
            </div>
          </div>
          </div>

          {/* Action Footer (Always outside scroll container) */}
          <footer className="damage-modal-footer">
            <button className="btn" type="button" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button
              className="btn pri"
              type="submit"
              disabled={saving || loading || Boolean(error) || !currentUnit || !title.trim()}
            >
              <Send size={15} />
              <span>{saving ? 'Menyimpan…' : 'Kirim Laporan'}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
