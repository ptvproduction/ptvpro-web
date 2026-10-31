import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSessionStore } from '@core/session';
import { inventarisService } from './inventarisService';
import { ItemInventaris, KondisiUnit, UpdateUnitDTO } from './types';
import { PTVSelect, PTVSelectOption } from '@shared/components';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface EditAlatModalProps {
  isOpen: boolean;
  asset: ItemInventaris;
  onClose: () => void;
  onSuccess: (updated: ItemInventaris) => void;
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
  { value: 'Hibah Alumni', label: 'Hibah Alumni', icon: 'fa-solid fa-graduation-cap', iconColor: '#4F46E5', iconBg: '#E0E7FF' },
];

const KONDISI_UNIT_OPTIONS: PTVSelectOption<KondisiUnit>[] = [
  { value: 'bagus', label: 'Baik', icon: 'fa-solid fa-circle-check', iconColor: '#16A34A', iconBg: '#DCFCE7' },
  { value: 'perlu_servis', label: 'Butuh Servis', icon: 'fa-solid fa-wrench', iconColor: '#D97706', iconBg: '#FEF3C7' },
  { value: 'rusak', label: 'Rusak', icon: 'fa-solid fa-triangle-exclamation', iconColor: '#DC2626', iconBg: '#FEE2E2' },
];

export const EditAlatModal: React.FC<EditAlatModalProps> = ({ isOpen, asset, onClose, onSuccess }) => {
  const { can } = useSessionStore();
  const modalRef = useRef<HTMLElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'edit-alat-modal',
  });

  const [nama, setNama] = useState(asset.nama_alat);
  const [kategori, setKategori] = useState(asset.kategori || 'Kamera');
  const [brand, setBrand] = useState(asset.brand || '');
  const [model, setModel] = useState(asset.model || '');

  // Locations
  const [locationList, setLocationList] = useState<PTVSelectOption[]>(INITIAL_LOCATION_OPTIONS);
  const [lokasiSel, setLokasiSel] = useState(asset.lokasi_penyimpanan || asset.units[0]?.lokasi_penyimpanan || 'Studio PTV');
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');

  // Sources
  const [sourceList, setSourceList] = useState<PTVSelectOption[]>(INITIAL_SOURCE_OPTIONS);
  const [sumberSel, setSumberSel] = useState(asset.sumber_perolehan || 'Yayasan');
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceInput, setNewSourceInput] = useState('');

  const [satuan, setSatuan] = useState(asset.satuan || 'unit');
  const [spesifikasi, setSpesifikasi] = useState(asset.spesifikasi || '');

  // Media state
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState(asset.foto_url || '');
  const [isPhotoChanged, setIsPhotoChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Units state
  const [units, setUnits] = useState<UpdateUnitDTO[]>(() =>
    asset.units.map((u, idx) => ({
      id: u.id,
      kode_unit: u.kode_unit,
      nama_unit: u.nama_unit || `Unit ${String(idx + 1).padStart(2, '0')}`,
      nomor_seri: u.nomor_seri || '',
      kondisi: u.kondisi || 'bagus',
      lokasi_penyimpanan: u.lokasi_penyimpanan || asset.lokasi_penyimpanan || 'Studio PTV',
    }))
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever asset prop changes
  useEffect(() => {
    setNama(asset.nama_alat);
    setKategori(asset.kategori || 'Kamera');
    setBrand(asset.brand || '');
    setModel(asset.model || '');
    setLokasiSel(asset.lokasi_penyimpanan || asset.units[0]?.lokasi_penyimpanan || 'Studio PTV');
    setSumberSel(asset.sumber_perolehan || 'Yayasan');
    setSatuan(asset.satuan || 'unit');
    setSpesifikasi(asset.spesifikasi || '');
    setFotoPreview(asset.foto_url || '');
    setIsPhotoChanged(false);
    setFotoFile(null);
    setUnits(
      asset.units.map((u, idx) => ({
        id: u.id,
        kode_unit: u.kode_unit,
        nama_unit: u.nama_unit || `Unit ${String(idx + 1).padStart(2, '0')}`,
        nomor_seri: u.nomor_seri || '',
        kondisi: u.kondisi || 'bagus',
        lokasi_penyimpanan: u.lokasi_penyimpanan || asset.lokasi_penyimpanan || 'Studio PTV',
      }))
    );
    setErrorMessage(null);
  }, [asset, isOpen]);

  const canEdit = can('inventory.edit');

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Ukuran file foto terlalu besar (maksimal 15MB).');
      return;
    }

    setFotoFile(file);
    setIsPhotoChanged(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFotoPreview((event.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleUnitChange = (index: number, field: keyof UpdateUnitDTO, value: any) => {
    setUnits((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSetAllUnitsCondition = (targetCond: KondisiUnit) => {
    setUnits((prev) =>
      prev.map((u) => ({
        ...u,
        kondisi: targetCond,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      setErrorMessage('Akses Ditolak: Hanya peran yang berwenang yang dapat mengedit data inventaris.');
      return;
    }

    const trimmedNama = nama.trim();
    if (!trimmedNama) {
      setErrorMessage('Nama alat tidak boleh kosong.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      let finalPhotoUrl: string | null | undefined = undefined;
      if (isPhotoChanged) {
        if (fotoFile) {
          try {
            finalPhotoUrl = await inventarisService.uploadPhoto(fotoFile);
          } catch (uploadErr) {
            setErrorMessage((uploadErr as Error).message || 'Gagal mengunggah foto baru.');
            setSubmitting(false);
            return;
          }
        } else {
          finalPhotoUrl = null;
        }
      }

      const cleanedUnits: UpdateUnitDTO[] = units.map((u) => ({
        id: u.id,
        kode_unit: u.kode_unit,
        nama_unit: u.nama_unit?.trim() || undefined,
        nomor_seri: u.nomor_seri && u.nomor_seri.trim() ? u.nomor_seri.trim() : null,
        kondisi: u.kondisi,
        lokasi_penyimpanan: u.lokasi_penyimpanan?.trim() || lokasiSel,
      }));

      const updated = await inventarisService.updateInventaris({
        id: asset.id,
        kode: asset.kode,
        nama_alat: trimmedNama,
        kategori,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        spesifikasi: spesifikasi.trim() || undefined,
        lokasi_penyimpanan: lokasiSel,
        sumber_perolehan: sumberSel,
        satuan: satuan.trim() || 'unit',
        foto_url: finalPhotoUrl,
        units: cleanedUnits,
        expected_updated_at: asset.updated_at,
      });

      onSuccess(updated);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat memperbarui data alat.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="scrim on" onClick={() => !submitting && onClose()} aria-hidden="true" />
      <section
        ref={modalRef}
        className="sheet on r03-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editAlatModalTitle"
        style={{
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          borderRadius: 'var(--r-ref-card, 18px)',
          overflow: 'hidden',
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--line-2)',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* ── Sheet Header ── */}
        <div
          className="sheet-hd"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-2, #F8FAFC)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--r-ref-sm, 8px)',
                background: 'var(--b-050, #DBEAFE)',
                color: 'var(--b-600, #2563EB)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
            >
              <i className="fa-solid fa-pen-to-square" />
            </span>
            <h2 id="editAlatModalTitle" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink, #0F172A)', margin: 0 }}>
              Edit Data Alat — <span style={{ color: 'var(--b-600, #2563EB)', fontFamily: 'monospace' }}>{asset.kode}</span>
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup form edit"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* ── Sheet Scrollable Body ── */}
        <div className="sheet-body" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {errorMessage && (
            <div
              className="alert-box"
              style={{
                marginBottom: '16px',
                padding: '12px 14px',
                background: 'var(--dang-bg, #FEF2F2)',
                border: '1px solid var(--dang, #FCA5A5)',
                borderRadius: 'var(--r-ref-m, 10px)',
                color: 'var(--dang, #991B1B)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-circle-exclamation" style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form id="formEditAlat" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* ── SECTION 1: INFORMASI UTAMA ALAT ── */}
            <div
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1.5px solid var(--line-2)',
                borderRadius: 'var(--r-ref-m, 14px)',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '12px',
                  color: '#0F172A',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-cube" style={{ color: '#2563EB' }} /> Informasi Utama Alat
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                {/* Kode Inventaris (Terkunci) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                    Kode Inventaris (Terkunci)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      value={asset.kode}
                      readOnly
                      tabIndex={-1}
                      style={{
                        background: 'var(--bg-2, #F1F5F9)',
                        border: '1.5px solid var(--line-2, #CBD5E1)',
                        color: 'var(--muted, #475569)',
                        cursor: 'not-allowed',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        userSelect: 'none',
                        paddingRight: '85px',
                        width: '100%',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '11px',
                        color: 'var(--muted, #64748B)',
                        fontWeight: 700,
                        pointerEvents: 'none',
                        background: 'var(--line-2, #E2E8F0)',
                        padding: '2px 8px',
                        borderRadius: 'var(--r-ref-xs, 6px)',
                      }}
                    >
                      <i className="fa-solid fa-lock" style={{ fontSize: '9.5px', marginRight: '4px' }} />
                      Terkunci
                    </span>
                  </div>
                </div>

                {/* Kategori Alat */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                    Kategori Alat
                  </label>
                  <PTVSelect
                    options={CATEGORY_OPTIONS}
                    value={kategori}
                    onChange={(val) => setKategori(val)}
                    placeholder="Pilih Kategori"
                  />
                </div>
              </div>

              {/* Nama Alat */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                  Nama Alat <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  className="input"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Sony FX3 Cinema Line Full-Frame Camera"
                  style={{ width: '100%', fontSize: '13.5px', fontWeight: 600 }}
                />
              </div>

              {/* Brand & Model */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                    Merk / Brand
                  </label>
                  <input
                    className="input"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Contoh: Sony, Hollyland, Aputure..."
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                    Model / Tipe
                  </label>
                  <input
                    className="input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Contoh: FX3, Mars 400S Pro..."
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION 2: PENYIMPANAN & ADMINISTRASI ── */}
            <div
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1.5px solid var(--line-2)',
                borderRadius: 'var(--r-ref-m, 14px)',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '12px',
                  color: 'var(--ink, #0F172A)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-location-dot" style={{ color: '#0284C7' }} /> Lokasi &amp; Administrasi
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                {/* Lokasi Penyimpanan */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)' }}>
                      Lokasi Penyimpanan Default
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddLocationModal(true)}
                      style={{ fontSize: '11px', color: 'var(--b-600, #2563EB)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Tambah Lokasi
                    </button>
                  </div>
                  <PTVSelect
                    options={locationList}
                    value={lokasiSel}
                    onChange={(val) => setLokasiSel(val)}
                    placeholder="Pilih Lokasi"
                  />
                </div>

                {/* Sumber Perolehan */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)' }}>
                      Sumber Perolehan
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddSourceModal(true)}
                      style={{ fontSize: '11px', color: 'var(--b-600, #2563EB)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Tambah Sumber
                    </button>
                  </div>
                  <PTVSelect
                    options={sourceList}
                    value={sumberSel}
                    onChange={(val) => setSumberSel(val)}
                    placeholder="Pilih Sumber"
                  />
                </div>
              </div>

              {/* Satuan & Jumlah Unit Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                    Satuan
                  </label>
                  <input
                    className="input"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    placeholder="unit, set, pcs..."
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                    Total Unit Fisik
                  </label>
                  <input
                    className="input"
                    value={`${asset.total_unit} ${satuan} (${asset.unit_tersedia} tersedia)`}
                    readOnly
                    tabIndex={-1}
                    style={{ background: 'var(--bg-2, #F8FAFC)', color: 'var(--muted, #64748B)', fontWeight: 700, width: '100%', border: '1.5px solid var(--line-2)' }}
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION 3: RINCIAN TIAP UNIT FISIK ── */}
            <div
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1.5px solid var(--line-2)',
                borderRadius: 'var(--r-ref-m, 14px)',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '12px',
                    color: 'var(--ink, #0F172A)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa-solid fa-barcode" style={{ color: '#7C3AED' }} /> Rincian Tiap Unit Fisik ({units.length} Unit)
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleSetAllUnitsCondition('bagus')}
                    className="btn sm"
                    style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--r-ref-xs, 6px)' }}
                  >
                    <i className="fa-solid fa-check-double" style={{ marginRight: '4px', color: '#16A34A' }} />
                    Semua Baik
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {units.map((u, idx) => {
                  const originalUnit = asset.units.find((orig) => orig.id === u.id);
                  const isBorrowed = originalUnit?.status_peminjaman === 'dipinjam';

                  return (
                    <div
                      key={u.id}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--bg-2, #F8FAFC)',
                        border: '1px solid var(--line-2)',
                        borderRadius: 'var(--r-ref-m, 10px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: 'var(--r-ref-xs, 6px)',
                              background: 'var(--b-050, #DBEAFE)',
                              color: 'var(--b-600, #1D4ED8)',
                              fontSize: '11px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            #{idx + 1}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: 'var(--ink, #0F172A)' }}>
                            {u.kode_unit}
                          </span>
                        </div>
                        {isBorrowed ? (
                          <span
                            className="chip warn"
                            style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px' }}
                            title="Unit sedang dipinjam (status peminjaman tidak terpengaruh oleh edit kondisi)"
                          >
                            <i className="fa-solid fa-user-clock" style={{ marginRight: '4px' }} />
                            Sedang Dipinjam
                          </span>
                        ) : (
                          <span
                            className="chip"
                            style={{ fontSize: '10.5px', fontWeight: 600, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px' }}
                          >
                            Tersedia
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '2px' }}>
                            Nama Unit
                          </label>
                          <input
                            className="input"
                            value={u.nama_unit || ''}
                            onChange={(e) => handleUnitChange(idx, 'nama_unit', e.target.value)}
                            placeholder={`Unit ${String(idx + 1).padStart(2, '0')}`}
                            style={{ width: '100%', fontSize: '12.5px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '2px' }}>
                            Nomor Seri (Opsional)
                          </label>
                          <input
                            className="input"
                            value={u.nomor_seri || ''}
                            onChange={(e) => handleUnitChange(idx, 'nomor_seri', e.target.value)}
                            placeholder="Contoh: SN-88291..."
                            style={{ width: '100%', fontSize: '12.5px', fontFamily: 'monospace' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '2px' }}>
                            Kondisi Fisik
                          </label>
                          <PTVSelect
                            options={KONDISI_UNIT_OPTIONS}
                            value={u.kondisi}
                            onChange={(val) => handleUnitChange(idx, 'kondisi', val)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── SECTION 4: SPESIFIKASI & MEDIA FOTO ── */}
            <div
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1.5px solid var(--line-2)',
                borderRadius: 'var(--r-ref-m, 14px)',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '12px',
                  color: 'var(--ink, #0F172A)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-align-left" style={{ color: '#64748B' }} /> Spesifikasi &amp; Foto Alat
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                  Deskripsi / Spesifikasi Teknis
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={spesifikasi}
                  onChange={(e) => setSpesifikasi(e.target.value)}
                  placeholder="Rincian spesifikasi operasional alat..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Upload Foto */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-2, #475569)', marginBottom: '4px' }}>
                  Foto Fisik Alat
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {fotoPreview ? (
                    <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: 'var(--r-ref-m, 10px)', overflow: 'hidden', border: '1.5px solid var(--line-2, #CBD5E1)' }}>
                      <img src={fotoPreview} alt="Preview Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: 'var(--r-ref-m, 10px)',
                        background: 'var(--bg-2, #F1F5F9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted, #94A3B8)',
                        fontSize: '24px',
                        border: '1.5px dashed var(--line-2, #CBD5E1)',
                      }}
                    >
                      <i className="fa-solid fa-camera" />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ fontWeight: 600, fontSize: '12px' }}
                    >
                      <i className="fa-solid fa-camera" style={{ marginRight: '6px' }} />
                      {fotoPreview ? 'Ganti Foto' : 'Pilih Foto Baru'}
                    </button>
                    {isPhotoChanged && (
                      <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }} />
                        Foto baru dipilih
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--muted, #64748B)' }}>
                      Maks. 15MB (JPG, PNG, WEBP, HEIC)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* ── Sheet Footer ── */}
        <div
          className="sheet-ft"
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--bg-2, #F8FAFC)',
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={submitting}
            style={{ minHeight: '38px', padding: '0 16px', borderRadius: 'var(--r-ref-full, 999px)' }}
          >
            Batal
          </button>
          <button
            type="submit"
            form="formEditAlat"
            className="btn pri inv-btn-pill"
            disabled={submitting || !canEdit}
            style={{
              minHeight: '38px',
              padding: '0 20px',
              borderRadius: 'var(--r-ref-full, 999px)',
              fontWeight: 700,
              fontSize: '13px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {submitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ── MODAL TAMBAH LOKASI BARU ── */}
      {showAddLocationModal && (
        <div className="scrim on" style={{ zIndex: 10000 }} onClick={() => setShowAddLocationModal(false)}>
          <div
            className="card"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '380px',
              padding: '20px',
              zIndex: 10001,
              background: 'var(--surface, #ffffff)',
              color: 'var(--ink, #0F172A)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-ref-card, 16px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink, #0F172A)' }}>Tambah Lokasi Baru</h3>
            <p style={{ fontSize: '12px', color: 'var(--muted, #64748B)', marginBottom: '14px' }}>
              Ketik nama tempat atau kotak penyimpanan inventaris.
            </p>
            <input
              className="input"
              value={newLocationInput}
              onChange={(e) => setNewLocationInput(e.target.value)}
              placeholder="Contoh: Rak Tripod Lt 1"
              autoFocus
              style={{ width: '100%', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn sm" onClick={() => setShowAddLocationModal(false)}>
                Batal
              </button>
              <button
                type="button"
                className="btn sm pri"
                onClick={() => {
                  const val = newLocationInput.trim();
                  if (val) {
                    const newOpt: PTVSelectOption = {
                      value: val,
                      label: val,
                      icon: 'fa-solid fa-location-dot',
                      iconColor: '#2563EB',
                      iconBg: '#DBEAFE',
                    };
                    setLocationList((prev) => [newOpt, ...prev]);
                    setLokasiSel(val);
                    setNewLocationInput('');
                    setShowAddLocationModal(false);
                  }
                }}
              >
                Simpan Lokasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TAMBAH SUMBER BARU ── */}
      {showAddSourceModal && (
        <div className="scrim on" style={{ zIndex: 10000 }} onClick={() => setShowAddSourceModal(false)}>
          <div
            className="card"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '380px',
              padding: '20px',
              zIndex: 10001,
              background: 'var(--surface, #ffffff)',
              color: 'var(--ink, #0F172A)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-ref-card, 16px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink, #0F172A)' }}>Tambah Sumber Perolehan</h3>
            <p style={{ fontSize: '12px', color: 'var(--muted, #64748B)', marginBottom: '14px' }}>
              Ketik nama asal perolehan atau pengadaan alat.
            </p>
            <input
              className="input"
              value={newSourceInput}
              onChange={(e) => setNewSourceInput(e.target.value)}
              placeholder="Contoh: Donasi Wali Santri"
              autoFocus
              style={{ width: '100%', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn sm" onClick={() => setShowAddSourceModal(false)}>
                Batal
              </button>
              <button
                type="button"
                className="btn sm pri"
                onClick={() => {
                  const val = newSourceInput.trim();
                  if (val) {
                    const newOpt: PTVSelectOption = {
                      value: val,
                      label: val,
                      icon: 'fa-solid fa-building-columns',
                      iconColor: '#2563EB',
                      iconBg: '#DBEAFE',
                    };
                    setSourceList((prev) => [newOpt, ...prev]);
                    setSumberSel(val);
                    setNewSourceInput('');
                    setShowAddSourceModal(false);
                  }
                }}
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
