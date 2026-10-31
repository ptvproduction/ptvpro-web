import { createPortal } from 'react-dom';
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { PTVSelect, PTVSelectOption } from '@shared/components';
import { LostFoundType, LostFoundItem } from '../types';
import { useSessionStore } from '@core/session';

interface LostFoundModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  initialType?: LostFoundType;
}

const CATEGORY_OPTIONS: PTVSelectOption[] = [
  { value: 'Aksesori Kamera', label: 'Aksesori Kamera', icon: 'fa-solid fa-camera', iconColor: '#0B5FBF', iconBg: '#EDF4FF' },
  { value: 'Kabel & Audio', label: 'Kabel & Audio', icon: 'fa-solid fa-headphones', iconColor: '#7C3AED', iconBg: '#F5F3FF' },
  { value: 'Perlengkapan Kru', label: 'Perlengkapan Kru', icon: 'fa-solid fa-vest', iconColor: '#059669', iconBg: '#ECFDF5' },
  { value: 'Pakaian', label: 'Pakaian', icon: 'fa-solid fa-shirt', iconColor: '#D97706', iconBg: '#FFFBEB' },
  { value: 'Barang Pribadi', label: 'Barang Pribadi', icon: 'fa-solid fa-wallet', iconColor: '#DC2626', iconBg: '#FEF2F2' },
  { value: 'Dokumen', label: 'Dokumen', icon: 'fa-solid fa-file-lines', iconColor: '#2563EB', iconBg: '#EFF6FF' },
  { value: 'Lainnya', label: 'Lainnya', icon: 'fa-solid fa-box-archive', iconColor: '#64748B', iconBg: '#F1F5F9' },
];

export const LostFoundModalForm: React.FC<LostFoundModalFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialType = 'hilang',
}) => {
  const user = useSessionStore((state) => state.user);
  const [type, setType] = useState<LostFoundType>(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Aksesori Kamera');
  const [location, setLocation] = useState('Studio Utama PMV');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(user?.full_name || '');
  const [reporterContact, setReporterContact] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'lost-found-modal-form',
  });

  // Sinkronisasi tipe laporan saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setType(initialType);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Hanya berkas gambar (JPG, PNG, WebP) yang diizinkan');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Ukuran gambar maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !title.trim() || !location.trim()) return;

    setSaveError('');
    setSaving(true);
    try {
      await onSubmit({
      type,
      title: title.trim(),
      category,
      location: location.trim(),
      date,
      description: description.trim(),
      photoUrl,
      reporterName: reporterName.trim() || 'Kru Studio',
      reporterContact: reporterContact.trim(),
      isCurrentUser: true,
    });

      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Laporan belum tersimpan.');
    } finally { setSaving(false); }
  };

  const content = (
    <div
      ref={modalRef}
      className="lf-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lf-modal-title"
    >
      <div className="lf-modal-surface" onClick={(e) => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="lf-modal-header">
          <div>
            <h3 className="lf-modal-title" id="lf-modal-title">
              {type === 'hilang' ? 'Lapor Barang Kehilangan' : 'Lapor Temuan Barang'}
            </h3>
            <p className="lf-modal-subtitle">
              {type === 'hilang'
                ? 'Cantumkan ciri khusus agar kru lain dapat mengenali barang Anda'
                : 'Catat lokasi ditemukan dan amankan barang di tempat yang aman'}
            </p>
          </div>
          <button
            type="button"
            className="lf-close-btn"
            onClick={onClose}
            aria-label="Tutup Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form: Scrollable Body + Fixed Footer */}
        <form onSubmit={handleSubmit} className="lf-modal-form">
          {saveError && <p role="alert" style={{ color: 'var(--ink)', padding: 12 }}>{saveError}</p>}
          <div className="lf-modal-body">
            <div className="lf-form-group">
              <label className="lf-label">Jenis Laporan</label>
              <div className="lf-type-switcher">
                <button
                  type="button"
                  className={`lf-type-btn lf-switcher-btn ${type === 'hilang' ? 'active lost' : ''}`}
                  onClick={() => setType('hilang')}
                >
                  Saya Kehilangan
                </button>
                <button
                  type="button"
                  className={`lf-type-btn lf-switcher-btn ${type === 'temuan' ? 'active found' : ''}`}
                  onClick={() => setType('temuan')}
                >
                  Saya Menemukan
                </button>
              </div>
            </div>

            <div className="lf-form-group">
              <label className="lf-label" htmlFor="lf-item-title">
                Nama Barang <span className="lf-required">*</span>
              </label>
              <input
                id="lf-item-title"
                type="text"
                required
                className="lf-input"
                placeholder="Contoh: Tutup Lensa Sony 67mm, ID Card, Jaket..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="lf-form-row">
              <div className="lf-form-group flex-1">
                <label className="lf-label" htmlFor="lf-category-select">
                  Kategori
                </label>
                <PTVSelect
                  id="lf-category-select"
                  value={category}
                  onChange={(val) => setCategory(val)}
                  options={CATEGORY_OPTIONS}
                  usePortal={true}
                  ariaLabel="Pilih Kategori Barang"
                />
              </div>

              <div className="lf-form-group flex-1">
                <label className="lf-label" htmlFor="lf-date-input">
                  Tanggal Kejadian
                </label>
                <input
                  id="lf-date-input"
                  type="date"
                  required
                  className="lf-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="lf-form-group">
              <label className="lf-label" htmlFor="lf-location-input">
                Lokasi Kejadian <span className="lf-required">*</span>
              </label>
              <input
                id="lf-location-input"
                type="text"
                required
                className="lf-input"
                placeholder="Contoh: Studio Utama PMV, Meja Switcher, Ruang Redaksi..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="lf-form-group">
              <label className="lf-label" htmlFor="lf-desc-input">
                Ciri-ciri & Deskripsi Lengkap
              </label>
              <textarea
                id="lf-desc-input"
                rows={3}
                className="lf-textarea"
                placeholder="Sebutkan warna, nomor seri, tanda khusus, atau tempat barang disimpan saat ini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="lf-form-group">
              <label className="lf-label">Foto Barang</label>
              <div className="lf-upload-zone">
                {photoUrl ? (
                  <div className="lf-preview-container">
                    <img src={photoUrl} alt="Preview" className="lf-preview-img" />
                    <button
                      type="button"
                      className="lf-remove-photo-btn"
                      onClick={() => setPhotoUrl(undefined)}
                    >
                      Hapus Foto
                    </button>
                  </div>
                ) : (
                  <label className="lf-upload-label">
                    <Camera size={24} className="lf-upload-icon" />
                    <span>Pilih foto dari perangkat (Maks 2MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="lf-file-input"
                      onChange={handlePhotoChange}
                    />
                  </label>
                )}
              </div>
              {photoError && <p className="lf-error-text">{photoError}</p>}
            </div>

            <div className="lf-form-row">
              <div className="lf-form-group flex-1">
                <label className="lf-label" htmlFor="lf-reporter-name">
                  Nama Pelapor
                </label>
                <input
                  id="lf-reporter-name"
                  type="text"
                  className="lf-input"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                />
              </div>

              <div className="lf-form-group flex-1">
                <label className="lf-label" htmlFor="lf-reporter-contact">
                  No. WhatsApp
                </label>
                <input
                  id="lf-reporter-contact"
                  type="tel"
                  className="lf-input"
                  placeholder="62812xxxx"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="lf-modal-footer">
            <button type="button" className="lf-btn lf-btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="lf-btn lf-btn-primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Kirim Laporan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
