import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSessionStore } from '@core/session';
import { inventarisService } from './inventarisService';
import { KondisiUnit, CreateUnitDTO } from './types';
import { PTVSelect, PTVSelectOption } from '@shared/components';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface TambahAlatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORY_OPTIONS: PTVSelectOption[] = [
  { value: 'Kamera', label: 'Kamera', icon: 'fa-solid fa-camera', iconColor: '#2563EB', iconBg: '#DBEAFE' },
  { value: 'Lensa', label: 'Lensa', icon: 'fa-solid fa-circle-dot', iconColor: '#7C3AED', iconBg: '#EDE9FE' },
  { value: 'Tripod & Rig', label: 'Tripod & Rig', icon: 'fa-solid fa-crosshairs', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'Tripod', label: 'Tripod', icon: 'fa-solid fa-box-archive', iconColor: '#475569', iconBg: '#F1F5F9' },
  { value: 'Baterai & Power', label: 'Baterai & Power', icon: 'fa-solid fa-battery-full', iconColor: '#16A34A', iconBg: '#DCFCE7' },
  { value: 'Audio', label: 'Audio', icon: 'fa-solid fa-microphone', iconColor: '#059669', iconBg: '#D1FAE5' },
  { value: 'Lighting', label: 'Lighting', icon: 'fa-solid fa-lightbulb', iconColor: '#EA580C', iconBg: '#FFEDD5' },
  { value: 'Smartphone / Tablet', label: 'Smartphone / Tablet', icon: 'fa-solid fa-mobile-screen', iconColor: '#0284C7', iconBg: '#E0F2FE' },
  { value: 'Komputer / Laptop', label: 'Komputer / Laptop', icon: 'fa-solid fa-laptop', iconColor: '#4F46E5', iconBg: '#E0E7FF' },
  { value: 'Kabel & Adapter', label: 'Kabel & Adapter', icon: 'fa-solid fa-plug', iconColor: '#64748B', iconBg: '#F8FAFC' },
  { value: 'Streaming / Live', label: 'Streaming / Live', icon: 'fa-solid fa-tower-broadcast', iconColor: '#E11D48', iconBg: '#FFE4E6' },
  { value: 'Lainnya', label: 'Lainnya', icon: 'fa-solid fa-cube', iconColor: '#334155', iconBg: '#F1F5F9' },
];

const INITIAL_LOCATION_OPTIONS: PTVSelectOption[] = [
  { value: 'Studio PTV', label: 'Studio PTV', icon: 'fa-solid fa-building', iconColor: '#2563EB', iconBg: '#DBEAFE' },
  { value: 'Box HT (Lemari Putih)', label: 'Box HT (Lemari Putih)', icon: 'fa-solid fa-box', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'Kotak Hollyland', label: 'Kotak Hollyland', icon: 'fa-solid fa-box', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'Kotak Kontainer', label: 'Kotak Kontainer', icon: 'fa-solid fa-box', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'Kotak Memory', label: 'Kotak Memory', icon: 'fa-solid fa-box', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'Rak Kamera Lt 1', label: 'Rak Kamera Lt 1', icon: 'fa-solid fa-archive', iconColor: '#7C3AED', iconBg: '#EDE9FE' },
  { value: 'Lemari Lensa', label: 'Lemari Lensa', icon: 'fa-solid fa-archive', iconColor: '#7C3AED', iconBg: '#EDE9FE' },
  { value: 'Rak Lighting Studio Lt 2', label: 'Rak Lighting Studio Lt 2', icon: 'fa-solid fa-archive', iconColor: '#7C3AED', iconBg: '#EDE9FE' },
  { value: 'Ruang Editing', label: 'Ruang Editing', icon: 'fa-solid fa-building', iconColor: '#2563EB', iconBg: '#DBEAFE' },
  { value: 'Gudang Alat', label: 'Gudang Alat', icon: 'fa-solid fa-warehouse', iconColor: '#475569', iconBg: '#F1F5F9' },
];

const INITIAL_SOURCE_OPTIONS: PTVSelectOption[] = [
  { value: 'Yayasan', label: 'Yayasan', icon: 'fa-solid fa-building-columns', iconColor: '#2563EB', iconBg: '#DBEAFE' },
  { value: 'Hibah Kementerian', label: 'Hibah Kementerian', icon: 'fa-solid fa-award', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'Dana Perusahaan', label: 'Dana Perusahaan', icon: 'fa-solid fa-file-invoice-dollar', iconColor: '#16A34A', iconBg: '#DCFCE7' },
  { value: 'Kas Organisasi', label: 'Kas Organisasi', icon: 'fa-solid fa-wallet', iconColor: '#0284C7', iconBg: '#E0F2FE' },
  { value: 'Hibah Pribadi', label: 'Hibah Pribadi', icon: 'fa-solid fa-award', iconColor: '#D97706', iconBg: '#FEF3C7' },
];

const STATUS_OPERASIONAL_OPTIONS: PTVSelectOption[] = [
  { value: 'Tersedia', label: 'Tersedia', icon: 'fa-solid fa-circle-check', iconColor: '#16A34A', iconBg: '#DCFCE7' },
  { value: 'Dipinjam', label: 'Dipinjam', icon: 'fa-solid fa-clock', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'Rusak / Servis', label: 'Rusak / Servis', icon: 'fa-solid fa-triangle-exclamation', iconColor: '#DC2626', iconBg: '#FEE2E2' },
  { value: 'Hilang', label: 'Hilang', icon: 'fa-solid fa-circle-xmark', iconColor: '#475569', iconBg: '#F1F5F9' },
];

const KONDISI_UNIT_OPTIONS: PTVSelectOption<KondisiUnit>[] = [
  { value: 'bagus', label: 'Baik', icon: 'fa-solid fa-circle-check', iconColor: '#16A34A', iconBg: '#DCFCE7' },
  { value: 'perlu_servis', label: 'Butuh Servis', icon: 'fa-solid fa-wrench', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'rusak', label: 'Rusak', icon: 'fa-solid fa-triangle-exclamation', iconColor: '#DC2626', iconBg: '#FEE2E2' },
];

export const TambahAlatModal: React.FC<TambahAlatModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { can } = useSessionStore();
  const modalRef = useRef<HTMLElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'tambah-alat-modal',
  });

  const [kode, setKode] = useState('');
  const [isManualKode, setIsManualKode] = useState(false);
  const [kategori, setKategori] = useState('Kamera');
  const [nama, setNama] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');

  // Location state
  const [locationList, setLocationList] = useState<PTVSelectOption[]>(INITIAL_LOCATION_OPTIONS);
  const [lokasiSel, setLokasiSel] = useState('Studio PTV');
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');

  // Source state
  const [sourceList, setSourceList] = useState<PTVSelectOption[]>(INITIAL_SOURCE_OPTIONS);
  const [sumberSel, setSumberSel] = useState('Yayasan');
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceInput, setNewSourceInput] = useState('');

  // Operational status & physical units
  const [statusOperasional, setStatusOperasional] = useState('Tersedia');
  const [jumlah, setJumlah] = useState(1);
  const [satuan, setSatuan] = useState('unit');

  // Specs & Photo
  const [spesifikasi, setSpesifikasi] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');

  // Units list (Each unit ONLY has sequence number, Nama Unit, and Kondisi Unit)
  const [units, setUnits] = useState<CreateUnitDTO[]>([
    { nomor_unit: 1, nama_unit: 'Unit 01', kondisi: 'bagus' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persistent submission idempotency key across retries
  const submissionKeyRef = useRef<string>('');
  // Persistent uploaded photo URL across retries (prevents duplicate upload on timeout/retry)
  const uploadedPhotoUrlRef = useRef<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Auto-fetch first available inventory code when opening
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      inventarisService.getNextAvailableCode().then((code) => {
        setKode(code);
        setIsManualKode(false);
      });
    }
  }, [isOpen]);

  // Sync physical units count whenever jumlah changes
  const handleJumlahChange = (newQty: number) => {
    const q = Math.max(1, newQty);
    setJumlah(q);
    setUnits((prev) => {
      const next: CreateUnitDTO[] = [];
      for (let i = 1; i <= q; i++) {
        if (prev[i - 1]) {
          next.push({ ...prev[i - 1], nomor_unit: i });
        } else {
          const numStr = i < 10 ? `0${i}` : `${i}`;
          next.push({
            nomor_unit: i,
            nama_unit: `Unit ${numStr}`,
            kondisi: 'bagus',
          });
        }
      }
      return next;
    });
  };

  const handleSetAllUnitsBaik = () => {
    setUnits((prev) =>
      prev.map((u) => ({
        ...u,
        kondisi: 'bagus' as KondisiUnit,
      }))
    );
  };

  const handleAddUnitRow = () => {
    handleJumlahChange(jumlah + 1);
  };

  const handleUnitChange = (index: number, patch: Partial<CreateUnitDTO>) => {
    setUnits((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  };

  // Handle Photo selection from camera or gallery (isolated local preview)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Ukuran file foto terlalu besar (Maksimal 15MB).');
      return;
    }

    const validExtensions = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const isImage = file.type ? file.type.startsWith('image/') : validExtensions.test(file.name);
    if (!isImage && !validExtensions.test(file.name)) {
      setErrorMessage('Format file tidak didukung. Harap pilih foto (JPG, PNG, WEBP, atau HEIC).');
      return;
    }

    setErrorMessage(null);
    setFotoFile(file);
    uploadedPhotoUrlRef.current = null;
    submissionKeyRef.current = '';

    // Bersihkan preview blob sebelumnya jika ada
    if (fotoPreview && fotoPreview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(fotoPreview);
      } catch {
        // ignore
      }
    }

    // Buat URL blob terisolasi untuk preview instan tanpa membaca file biner mentah
    try {
      const previewBlobUrl = URL.createObjectURL(file);
      setFotoPreview(previewBlobUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFotoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearPhoto = () => {
    if (fotoPreview && fotoPreview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(fotoPreview);
      } catch {
        // ignore
      }
    }
    setFotoFile(null);
    setFotoPreview('');
    uploadedPhotoUrlRef.current = null;
    submissionKeyRef.current = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  // Bersihkan preview blob saat modal unmount atau ditutup
  useEffect(() => {
    return () => {
      if (fotoPreview && fotoPreview.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(fotoPreview);
        } catch {
          // ignore
        }
      }
    };
  }, [fotoPreview]);

  // Location "+ Tambah Lokasi Baru..." Action
  const handleConfirmAddLocation = () => {
    const trimmed = newLocationInput.trim();
    if (!trimmed) {
      setShowAddLocationModal(false);
      return;
    }
    const exists = locationList.some((loc) => loc.value.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const newOpt: PTVSelectOption = {
        value: trimmed,
        label: trimmed,
        icon: 'fa-solid fa-location-dot',
        iconColor: '#0284C7',
        iconBg: '#E0F2FE',
      };
      setLocationList((prev) => [newOpt, ...prev]);
    }
    setLokasiSel(trimmed);
    setNewLocationInput('');
    setShowAddLocationModal(false);
  };

  // Source "+ Tambah Sumber..." Action
  const handleConfirmAddSource = () => {
    const trimmed = newSourceInput.trim();
    if (!trimmed) {
      setShowAddSourceModal(false);
      return;
    }
    const exists = sourceList.some((src) => src.value.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const newOpt: PTVSelectOption = {
        value: trimmed,
        label: trimmed,
        icon: 'fa-solid fa-gift',
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
      };
      setSourceList((prev) => [newOpt, ...prev]);
    }
    setSumberSel(trimmed);
    setNewSourceInput('');
    setShowAddSourceModal(false);
  };

  // Location dropdown options with "+ Tambah Lokasi Baru..."
  const fullLocationOptions: PTVSelectOption[] = [
    ...locationList,
    {
      value: '__ADD_LOCATION__',
      label: '+ Tambah Lokasi Baru...',
      icon: 'fa-solid fa-circle-plus',
      iconColor: '#0284C7',
      iconBg: '#E0F2FE',
      isAction: true,
      hasSeparatorBefore: true,
      onAction: () => {
        setNewLocationInput('');
        setShowAddLocationModal(true);
      },
    },
  ];

  // Source dropdown options with "+ Tambah Sumber..."
  const fullSourceOptions: PTVSelectOption[] = [
    ...sourceList,
    {
      value: '__ADD_SOURCE__',
      label: '+ Tambah Sumber...',
      icon: 'fa-solid fa-circle-plus',
      iconColor: '#16A34A',
      iconBg: '#DCFCE7',
      isAction: true,
      hasSeparatorBefore: true,
      onAction: () => {
        setNewSourceInput('');
        setShowAddSourceModal(true);
      },
    },
  ];

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // RBAC Permission Check
    if (!can('inventory.create')) {
      setErrorMessage('Hanya peran Eksekutif dan Administrasi yang memiliki akses mengelola data inventaris.');
      return;
    }

    const trimmedNama = nama.trim();
    const trimmedKode = kode.trim();

    if (!trimmedNama || !trimmedKode) {
      setErrorMessage('Kode alat dan Nama alat wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      // Generate or preserve existing idempotency key across retries
      if (!submissionKeyRef.current) {
        submissionKeyRef.current =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
              });
      }

      // Upload photo to storage if provided (reuse previously uploaded photo on retry)
      let permanentPhotoUrl: string | undefined = uploadedPhotoUrlRef.current || undefined;
      if (fotoFile && !permanentPhotoUrl) {
        try {
          permanentPhotoUrl = await inventarisService.uploadPhoto(fotoFile);
          uploadedPhotoUrlRef.current = permanentPhotoUrl;
        } catch (uploadErr) {
          setErrorMessage((uploadErr as Error).message || 'Gagal mengunggah foto alat.');
          setSubmitting(false);
          return;
        }
      }

      await inventarisService.createInventaris({
        kode: trimmedKode,
        nama_alat: trimmedNama,
        kategori,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        spesifikasi: spesifikasi.trim() || undefined,
        lokasi_penyimpanan: lokasiSel,
        sumber_perolehan: sumberSel,
        status_operasional: statusOperasional,
        foto_url: permanentPhotoUrl,
        satuan: satuan.trim() || 'unit',
        jumlah_unit: jumlah,
        unit_items: units.map((u) => ({
          nomor_unit: u.nomor_unit,
          nama_unit: u.nama_unit,
          kondisi: u.kondisi,
          nomor_seri: undefined, // Serial numbers strictly filled later via Edit Data Alat
        })),
        idempotency_key: submissionKeyRef.current,
        request_id: submissionKeyRef.current,
      });

      // Reset form fields & clear submission key and photo ref on success
      submissionKeyRef.current = '';
      uploadedPhotoUrlRef.current = null;
      setNama('');
      setBrand('');
      setModel('');
      setSpesifikasi('');
      handleClearPhoto();
      setJumlah(1);
      setUnits([{ nomor_unit: 1, nama_unit: 'Unit 01', kondisi: 'bagus' }]);

      onSuccess();
    } catch (err: unknown) {
      // NOTE: On failure/timeout, submissionKeyRef.current is intentionally PRESERVED
      // so clicking retry sends the exact same idempotency key to prevent double creation.
      setErrorMessage((err as Error).message || 'Gagal menyimpan alat ke inventaris');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop Scrim */}
      <div className="scrim on" onClick={onClose} />

      {/* Modal Dialog / Mobile Bottom Sheet */}
      <section
        ref={modalRef}
        className="ptv-hub-root sheet on r03-tambah-alat-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tambahAlatModalTitle"
        style={{ maxWidth: '620px' }}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd r03-modal-header" style={{ padding: '16px 20px' }}>
          <div className="r03-modal-title-group">
            <h2 id="tambahAlatModalTitle" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
              Tambah Alat Baru
            </h2>
          </div>
          <button
            type="button"
            className="r03-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup modal"
            style={{ width: '32px', height: '32px' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="sheet-body r03-modal-body" style={{ padding: '16px 20px', gap: '14px' }}>
            {/* Error Alert Box */}
            {errorMessage && (
              <div className="r03-form-error-banner">
                <i className="fa-solid fa-circle-exclamation" style={{ color: '#DC2626', fontSize: '16px' }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* ── Section A: Informasi Utama Alat ── */}
            <div className="r03-form-section">
              <div className="r03-form-section-title">
                <i className="fa-solid fa-cube" />
                <span>INFORMASI UTAMA ALAT</span>
              </div>

              <div className="r03-form-grid-2">
                <div className="r03-form-field">
                  <label className="r03-form-label" htmlFor="inp_ast_kode">
                    Kode Inventaris (Otomatis)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="inp_ast_kode"
                      className="r03-form-input"
                      value={kode}
                      readOnly={!isManualKode}
                      onChange={(e) => setKode(e.target.value)}
                      placeholder="INV-001"
                      required
                      style={{
                        paddingRight: isManualKode ? '14px' : '98px',
                        background: isManualKode ? 'var(--surface)' : 'var(--b-050)',
                        borderColor: isManualKode ? 'var(--line)' : 'var(--b-300)',
                        color: 'var(--form-code-color, #1D4ED8)',
                        fontWeight: 700,
                      }}
                    />
                    {!isManualKode ? (
                      <div
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span className="r03-form-badge-auto">
                          <i className="fa-solid fa-lock" style={{ fontSize: '10px' }} />
                          Otomatis
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsManualKode(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--form-code-action, #2563EB)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: '2px 4px',
                          }}
                        >
                          Ubah
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          inventarisService.getNextAvailableCode().then((c) => {
                            setKode(c);
                            setIsManualKode(false);
                          });
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748B',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                        }}
                      >
                        Reset Auto
                      </button>
                    )}
                  </div>
                </div>

                <div className="r03-form-field">
                  <label className="r03-form-label">
                    Kategori
                  </label>
                  <PTVSelect
                    value={kategori}
                    onChange={(val) => setKategori(val)}
                    options={CATEGORY_OPTIONS}
                    usePortal={true}
                    ariaLabel="Pilih Kategori Alat"
                  />
                </div>
              </div>

              <div className="r03-form-field">
                <label className="r03-form-label" htmlFor="inp_ast_nama">
                  Nama Alat
                </label>
                <input
                  id="inp_ast_nama"
                  className="r03-form-input"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Sony Alpha A7 IV / Mic Wireless Rode"
                  required
                />
              </div>

              <div className="r03-form-grid-2">
                <div className="r03-form-field">
                  <label className="r03-form-label" htmlFor="inp_ast_brand">
                    Merk / Brand
                  </label>
                  <input
                    id="inp_ast_brand"
                    className="r03-form-input"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Sony, Canon, Rode, Godox..."
                  />
                </div>
                <div className="r03-form-field">
                  <label className="r03-form-label" htmlFor="inp_ast_model">
                    Model / Tipe
                  </label>
                  <input
                    id="inp_ast_model"
                    className="r03-form-input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="A7 IV, EOS R6, NTG-4..."
                  />
                </div>
              </div>
            </div>

            {/* ── Section B: Lokasi & Administrasi ── */}
            <div className="r03-form-section">
              <div className="r03-form-section-title">
                <i className="fa-solid fa-location-dot" />
                <span>LOKASI &amp; ADMINISTRASI</span>
              </div>

              <div className="r03-form-grid-2">
                <div className="r03-form-field">
                  <label className="r03-form-label">
                    Lokasi Penyimpanan
                  </label>
                  <PTVSelect
                    value={lokasiSel}
                    onChange={(val) => setLokasiSel(val)}
                    options={fullLocationOptions}
                    usePortal={true}
                    ariaLabel="Pilih Lokasi Penyimpanan"
                  />
                </div>

                <div className="r03-form-field">
                  <label className="r03-form-label">
                    Sumber Perolehan
                  </label>
                  <PTVSelect
                    value={sumberSel}
                    onChange={(val) => setSumberSel(val)}
                    options={fullSourceOptions}
                    usePortal={true}
                    ariaLabel="Pilih Sumber Perolehan"
                  />
                </div>
              </div>

              <div className="r03-form-grid-3">
                <div className="r03-form-field">
                  <label className="r03-form-label">
                    Status Operasional
                  </label>
                  <PTVSelect
                    value={statusOperasional}
                    onChange={(val) => setStatusOperasional(val)}
                    options={STATUS_OPERASIONAL_OPTIONS}
                    usePortal={true}
                    ariaLabel="Pilih Status Operasional Alat"
                  />
                </div>
                <div className="r03-form-field">
                  <label className="r03-form-label" htmlFor="inp_ast_qty">
                    Jumlah Unit Fisik
                  </label>
                  <input
                    id="inp_ast_qty"
                    type="number"
                    min="1"
                    className="r03-form-input"
                    value={jumlah}
                    onChange={(e) => handleJumlahChange(parseInt(e.target.value, 10) || 1)}
                    required
                  />
                </div>
                <div className="r03-form-field">
                  <label className="r03-form-label" htmlFor="inp_ast_satuan">
                    Satuan
                  </label>
                  <input
                    id="inp_ast_satuan"
                    className="r03-form-input"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    placeholder="unit"
                  />
                </div>
              </div>
            </div>

            {/* ── Section C: Identitas & Kondisi Per Unit ── */}
            <div className="r03-form-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div className="r03-form-section-title">
                  <i className="fa-solid fa-layer-group" />
                  <span>IDENTITAS &amp; KONDISI PER UNIT ({jumlah} UNIT)</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="r03-btn-subtle-green"
                    onClick={handleSetAllUnitsBaik}
                  >
                    <i className="fa-solid fa-circle-check" />
                    Semua Baik
                  </button>
                  <button
                    type="button"
                    className="r03-btn-subtle-blue"
                    onClick={handleAddUnitRow}
                  >
                    <i className="fa-solid fa-plus" />
                    Tambah Unit
                  </button>
                </div>
              </div>

              {/* Unit Rows: Each row strictly displays ONLY sequence badge, Nama Unit, and Kondisi Unit */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {units.map((unit, idx) => (
                  <div key={idx} className="r03-unit-row">
                    <span className="r03-unit-badge">#{idx + 1}</span>
                    <input
                      className="r03-form-input"
                      aria-label={`Nama Unit ${idx + 1}`}
                      value={unit.nama_unit || ''}
                      onChange={(e) => handleUnitChange(idx, { nama_unit: e.target.value })}
                      placeholder={`Unit ${idx + 1 < 10 ? `0${idx + 1}` : idx + 1}`}
                    />
                    <PTVSelect
                      value={unit.kondisi || 'bagus'}
                      onChange={(val) => handleUnitChange(idx, { kondisi: val as KondisiUnit })}
                      options={KONDISI_UNIT_OPTIONS}
                      usePortal={true}
                      ariaLabel={`Kondisi Unit ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section D: Spesifikasi & Foto Fisik ── */}
            <div className="r03-form-section">
              <div className="r03-form-section-title">
                <i className="fa-solid fa-file-lines" />
                <span>SPESIFIKASI &amp; FOTO FISIK</span>
              </div>

              <div className="r03-form-field">
                <label className="r03-form-label" htmlFor="inp_ast_specs">
                  Spesifikasi Lengkap / Deskripsi
                </label>
                <textarea
                  id="inp_ast_specs"
                  className="r03-form-textarea"
                  rows={3}
                  value={spesifikasi}
                  onChange={(e) => setSpesifikasi(e.target.value)}
                  placeholder="Tuliskan spesifikasi detail, kelengkapan box, atau catatan khusus alat ini..."
                />
              </div>

              <div className="r03-form-field">
                <label className="r03-form-label">
                  Foto Fisik Alat (Kamera / Galeri)
                </label>
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                {fotoPreview ? (
                  <div className="r03-photo-preview-card">
                    <img
                      src={fotoPreview}
                      alt="Preview Foto Alat"
                      className="r03-photo-preview-img"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        {fotoFile ? fotoFile.name : 'Foto Alat Siap Digunakan'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Foto akan disimpan dan diunggah ke katalog alat
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="r03-btn-subtle-blue"
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={handleClearPhoto}
                        className="r03-btn-pill secondary"
                        style={{ minHeight: '30px', padding: '0 10px', fontSize: '11.5px', color: '#DC2626' }}
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="r03-photo-upload-grid">
                      <div
                        className="r03-photo-upload-card"
                        onClick={() => cameraInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && cameraInputRef.current?.click()}
                      >
                        <i className="fa-solid fa-camera" />
                        <span>Foto Alat</span>
                      </div>
                      <div
                        className="r03-photo-upload-card"
                        onClick={() => galleryInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && galleryInputRef.current?.click()}
                      >
                        <i className="fa-solid fa-image" />
                        <span>Pilih dari Galeri</span>
                      </div>
                    </div>
                    <div className="r03-photo-upload-hint">
                      Ambil Foto Alat / Pilih dari Galeri
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer with full width primary button */}
          <div className="sheet-foot r03-modal-footer" style={{ padding: '16px 20px' }}>
            <button type="button" className="r03-btn-pill secondary" disabled={submitting} onClick={onClose}>Batal</button>
            <button
              type="submit"
              className="r03-btn-full-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Menyimpan ke Inventaris...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check" />
                  <span>Simpan Alat Baru</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Modal Prompt: Tambah Lokasi Baru */}
      {showAddLocationModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div className="r03-prompt-dialog">
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Tambah Lokasi Baru
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748B' }}>
              Masukkan nama tempat atau lemari penyimpanan inventaris.
            </p>
            <input
              className="r03-form-input"
              value={newLocationInput}
              onChange={(e) => setNewLocationInput(e.target.value)}
              placeholder="Contoh: Lemari Audio Lt 1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmAddLocation();
                if (e.key === 'Escape') setShowAddLocationModal(false);
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="r03-btn-pill secondary"
                style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                onClick={() => setShowAddLocationModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="r03-btn-pill primary"
                style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                onClick={handleConfirmAddLocation}
              >
                Simpan Lokasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Prompt: Tambah Sumber Baru */}
      {showAddSourceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div className="r03-prompt-dialog">
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Tambah Sumber Perolehan Baru
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748B' }}>
              Masukkan asal perolehan alat baru (cth: Hibah Alumni, CSR).
            </p>
            <input
              className="r03-form-input"
              value={newSourceInput}
              onChange={(e) => setNewSourceInput(e.target.value)}
              placeholder="Contoh: Hibah Alumni 2024"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmAddSource();
                if (e.key === 'Escape') setShowAddSourceModal(false);
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="r03-btn-pill secondary"
                style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                onClick={() => setShowAddSourceModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="r03-btn-pill primary"
                style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                onClick={handleConfirmAddSource}
              >
                Simpan Sumber
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};
