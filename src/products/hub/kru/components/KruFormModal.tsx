import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CrewMember,
  CrewCategory,
  CrewMembershipStatus,
  CANONICAL_OPERATIONAL_DIVISIONS,
  CANONICAL_ORGANIZATIONAL_POSITIONS,
} from '../types';
import { PTVSelect } from '@shared/components/PTVSelect';
import { getKruService } from '../kruService';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface KruFormModalProps {
  isOpen: boolean;
  isEdit: boolean;
  initialData?: CrewMember | null;
  suggestedPtvId: string;
  onClose: () => void;
  onSave: (data: Omit<CrewMember, 'id'>) => Promise<void> | void;
}

const DEFAULT_AVATAR = 'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp';

export const KruFormModal: React.FC<KruFormModalProps> = ({
  isOpen,
  isEdit,
  initialData,
  suggestedPtvId,
  onClose,
  onSave,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const closeWhenIdle = () => { if (!isSubmitting) onClose(); };
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({
    isOpen,
    onClose: closeWhenIdle,
    modalRef,
  });

  const [fullName, setFullName] = useState('');
  const [ptvId, setPtvId] = useState('');
  const [category, setCategory] = useState<CrewCategory>('Kru');
  const [division, setDivision] = useState('Technical');
  const [positionPreset, setPositionPreset] = useState<string>('Kru Operasional');
  const [customPosition, setCustomPosition] = useState<string>('');
  const [angkatan, setAngkatan] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [statusKru, setStatusKru] = useState<CrewMembershipStatus>('Aktif');
  const [fotoUrl, setFotoUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 3-Option Photo State
  const [photoTab, setPhotoTab] = useState<'camera' | 'upload' | 'url'>('url');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera when closing or switching away
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  useEffect(() => {
    if (!isOpen || photoTab !== 'camera') {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, photoTab]);

  useEffect(() => {
    if (initialData && isEdit) {
      setFullName(initialData.full_name || '');
      setPtvId(initialData.ptv_id || '');
      const cat = initialData.category || 'Kru';
      setCategory(cat);
      setDivision(initialData.division || 'Technical');
      const pos = initialData.position || '';
      if (cat === 'Kru') {
        if ((CANONICAL_ORGANIZATIONAL_POSITIONS as readonly string[]).includes(pos)) {
          setPositionPreset(pos);
          setCustomPosition('');
        } else if (pos) {
          setPositionPreset('custom');
          setCustomPosition(pos);
        } else {
          setPositionPreset('Kru Operasional');
          setCustomPosition('');
        }
      } else {
        setPositionPreset(pos || cat);
        setCustomPosition(pos || '');
      }
      setAngkatan(String(initialData.angkatan || ''));
      setBirthDate(initialData.birth_date || initialData.tanggal_lahir || initialData.jurusan || '');
      setAddress(initialData.address || initialData.alamat || initialData.nim || '');
      setPhone(initialData.phone || '');
      setStatusKru(initialData.status_kru || 'Aktif');
      setFotoUrl(initialData.foto_url || DEFAULT_AVATAR);
    } else {
      setFullName('');
      setPtvId(suggestedPtvId);
      setCategory('Kru');
      setDivision('Technical');
      setPositionPreset('Kru Operasional');
      setCustomPosition('');
      setAngkatan('12');
      setBirthDate('');
      setAddress('');
      setPhone('');
      setStatusKru('Aktif');
      setFotoUrl(DEFAULT_AVATAR);
    }
    setPhotoTab('url');
    setErrorMsg('');
  }, [initialData, isEdit, suggestedPtvId, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  // Handle starting camera
  const handleStartCamera = async () => {
    setErrorMsg('');
    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCapturing(true);
    } catch (err: any) {
      setErrorMsg(`Tidak dapat mengakses kamera: ${err.message || 'Izin kamera ditolak.'}`);
    }
  };

  // Handle capturing snapshot from camera
  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    stopCameraStream();

    // Upload immediately to permanent storage
    setIsUploadingPhoto(true);
    try {
      const permanentUrl = await getKruService().uploadAvatar(base64Data, ptvId || suggestedPtvId);
      setFotoUrl(permanentUrl);
    } catch (err: any) {
      setErrorMsg(`Gagal mengunggah hasil foto ke server: ${err.message}`);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Handle picking image file from gallery
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format file harus berupa gambar (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 8MB.');
      return;
    }

    setIsUploadingPhoto(true);
    setErrorMsg('');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const permanentUrl = await getKruService().uploadAvatar(base64Data, ptvId || suggestedPtvId);
          setFotoUrl(permanentUrl);
        } catch (uploadErr: any) {
          setErrorMsg(`Gagal mengunggah foto ke storage: ${uploadErr.message}`);
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Gagal membaca file dari perangkat.');
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(`Gagal memproses file: ${err.message}`);
      setIsUploadingPhoto(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Nama lengkap personel wajib diisi.');
      return;
    }

    let resolvedPosition = '';
    if (category === 'Kru') {
      if (positionPreset === 'custom') {
        resolvedPosition = customPosition.trim() || 'Kru Operasional';
      } else {
        resolvedPosition = positionPreset;
      }
    } else {
      resolvedPosition = customPosition.trim() || positionPreset || category;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onSave({
        version: initialData?.version,
        full_name: fullName.trim(),
        ptv_id: isEdit ? (initialData?.ptv_id || suggestedPtvId) : suggestedPtvId,
        username: initialData?.username || '',
        role: initialData?.role || 'kru',
        category,
        division: category === 'Kru' ? division : '',
        position: resolvedPosition,
        angkatan: category === 'Kru' ? angkatan.trim() : '',
        birth_date: birthDate.trim() || undefined,
        tanggal_lahir: birthDate.trim() || undefined,
        address: address.trim() || undefined,
        alamat: address.trim() || undefined,
        nim: initialData?.nim,
        jurusan: initialData?.jurusan,
        phone: phone.trim() || undefined,
        status_kru: statusKru,
        status_akun: initialData?.status_akun || 'Belum Ada Akun',
        foto_url: fotoUrl.trim() || DEFAULT_AVATAR,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan data kru ke database Staging.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="ptv-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={closeWhenIdle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kruFormModalTitle"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="ptv-modal-dialog"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--ptv-curve-xl, 22px)',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id="kruFormModalTitle"
              style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em' }}
            >
              {isEdit ? 'Edit Data Personel' : 'Tambah Personel Baru'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              {isEdit ? 'Perbarui identitas, struktur organisasi, dan status personel' : 'Pendaftaran personel kru studio Progresif TV'}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeWhenIdle}
            aria-label="Tutup"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '15px' }} />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
          <div
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {errorMsg && (
              <div
                style={{
                  background: 'var(--dang-bg, rgba(239, 68, 68, 0.1))',
                  border: '1px solid var(--dang-border, rgba(239, 68, 68, 0.3))',
                  color: 'var(--dang, #dc2626)',
                  borderRadius: 'var(--ptv-curve-sm, 8px)',
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* SEKSI 1: IDENTITAS PERSONEL */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--b-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                1. Identitas Personel
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                    Nama Lengkap <span style={{ color: 'var(--dang, #dc2626)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Muhammad Rizky Alamsyah"
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                        ID PTV Personel
                      </label>
                      <span style={{ fontSize: '10.5px', color: 'var(--b-600)', background: 'var(--b-50, rgba(59, 130, 246, 0.1))', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        Otomatis oleh Sistem
                      </span>
                    </div>
                    <input
                      className="input font-mono"
                      value={isEdit ? (ptvId || suggestedPtvId) : suggestedPtvId}
                      readOnly
                      disabled
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface-sunken)', opacity: 0.85, cursor: 'not-allowed', fontWeight: 700, color: 'var(--b-600)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                      No. WhatsApp / Telepon
                    </label>
                    <input
                      type="text"
                      className="input font-mono"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* 3-Option Foto Profil */}
                <div style={{ border: '1px solid var(--line-2)', borderRadius: 'var(--ptv-curve-md, 14px)', padding: '12px 14px', background: 'var(--surface-sunken, #f8fafc)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                      Foto Profil
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Default: AVATAR-PTV
                    </span>
                  </div>

                  {/* Preview Avatar & Selector */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
                    <img
                      src={fotoUrl || DEFAULT_AVATAR}
                      alt="Avatar Preview"
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--surface)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`btn ${photoTab === 'camera' ? 'pri' : ''}`}
                        onClick={() => {
                          setPhotoTab('camera');
                          handleStartCamera();
                        }}
                        style={{ fontSize: '11.5px', padding: '5px 12px', borderRadius: 'var(--ptv-curve-pill)' }}
                      >
                        <i className="fa-solid fa-camera" style={{ marginRight: '5px' }} />
                        Ambil Foto
                      </button>
                      <button
                        type="button"
                        className={`btn ${photoTab === 'upload' ? 'pri' : ''}`}
                        onClick={() => {
                          setPhotoTab('upload');
                          stopCameraStream();
                          fileInputRef.current?.click();
                        }}
                        style={{ fontSize: '11.5px', padding: '5px 12px', borderRadius: 'var(--ptv-curve-pill)' }}
                      >
                        <i className="fa-solid fa-image" style={{ marginRight: '5px' }} />
                        Unggah File
                      </button>
                      <button
                        type="button"
                        className={`btn ${photoTab === 'url' ? 'pri' : ''}`}
                        onClick={() => {
                          setPhotoTab('url');
                          stopCameraStream();
                        }}
                        style={{ fontSize: '11.5px', padding: '5px 12px', borderRadius: 'var(--ptv-curve-pill)' }}
                      >
                        <i className="fa-solid fa-link" style={{ marginRight: '5px' }} />
                        Masukkan URL
                      </button>
                    </div>
                  </div>

                  {/* Hidden File Input for Gallery */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />

                  {/* Camera Live Stream View */}
                  {photoTab === 'camera' && (
                    <div style={{ marginTop: '10px', textAlign: 'center', background: '#000', borderRadius: '12px', padding: '10px', overflow: 'hidden' }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', maxHeight: '220px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn pri"
                          onClick={handleCaptureSnapshot}
                          disabled={!isCapturing || isUploadingPhoto}
                          style={{ fontSize: '12px', borderRadius: 'var(--ptv-curve-pill)' }}
                        >
                          <i className="fa-solid fa-circle-dot" style={{ marginRight: '5px' }} />
                          {isUploadingPhoto ? 'Mengunggah...' : 'Jepret & Simpan'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={stopCameraStream}
                          style={{ fontSize: '12px', borderRadius: 'var(--ptv-curve-pill)', color: '#fff', borderColor: '#444' }}
                        >
                          Tutup Kamera
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload from Gallery Status */}
                  {photoTab === 'upload' && isUploadingPhoto && (
                    <div style={{ fontSize: '12px', color: 'var(--b-600)', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Mengunggah foto ke storage studio...</span>
                    </div>
                  )}

                  {/* URL Text Input */}
                  {photoTab === 'url' && (
                    <div>
                      <input
                        type="url"
                        className="input"
                        value={fotoUrl}
                        onChange={(e) => setFotoUrl(e.target.value)}
                        placeholder="https://... atau biarkan default"
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SEKSI 2: STRUKTUR ORGANISASI & JABATAN */}
            <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--b-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                2. Struktur Organisasi & Jabatan
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                      Kategori Personel
                    </label>
                    <select
                      className="input"
                      value={category}
                      onChange={(e) => {
                        const newCat = e.target.value as CrewCategory;
                        setCategory(newCat);
                        if (newCat === 'Pengasuh') setPositionPreset('Pendiri dan Pengasuh');
                        else if (newCat === 'Pengarah') setPositionPreset('Direktur Yayasan');
                        else if (newCat === 'Pembina') setPositionPreset('Pembina PTV');
                        else setPositionPreset('Kru Operasional');
                      }}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="Kru">Kru</option>
                      <option value="Pengasuh">Pengasuh</option>
                      <option value="Pengarah">Pengarah</option>
                      <option value="Pembina">Pembina</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                      Divisi Kerja {category !== 'Kru' && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Khusus Kru)</span>}
                    </label>
                    <select
                      className="input"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      disabled={category !== 'Kru'}
                      style={{ width: '100%', boxSizing: 'border-box', opacity: category !== 'Kru' ? 0.6 : 1 }}
                    >
                      {division && !CANONICAL_OPERATIONAL_DIVISIONS.includes(division as any) && (
                        <option value={division}>{division} (Historis)</option>
                      )}
                      {CANONICAL_OPERATIONAL_DIVISIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Jabatan Organisasi */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                      Jabatan Organisasi
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--b-600)' }}>
                      Menentukan izin berbasis organisasi
                    </span>
                  </div>
                  {category === 'Kru' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <PTVSelect
                        id="kru-jabatan-select"
                        value={positionPreset}
                        onChange={(val) => setPositionPreset(val)}
                        options={[
                          ...CANONICAL_ORGANIZATIONAL_POSITIONS.map((pos) => ({
                            value: pos,
                            label: pos === 'Sekretaris & Bendahara'
                              ? 'Sekretaris & Bendahara (Sekben)'
                              : pos === 'Kru Operasional'
                              ? 'Kru Operasional (Anggota)'
                              : pos,
                            icon: 'fa-solid fa-id-badge',
                          })),
                          {
                            value: 'custom',
                            label: 'Kustom / Spesifik...',
                            icon: 'fa-solid fa-pen-to-square',
                            hasSeparatorBefore: true,
                          },
                        ]}
                        placeholder="Pilih Jabatan Organisasi..."
                        searchable
                        searchPlaceholder="Cari jabatan..."
                      />
                      {positionPreset === 'custom' && (
                        <input
                          type="text"
                          className="input"
                          value={customPosition}
                          onChange={(e) => setCustomPosition(e.target.value)}
                          placeholder="Masukkan nama jabatan spesifik (contoh: Floor Director, Editor Video)"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="input"
                      value={customPosition || positionPreset}
                      onChange={(e) => setCustomPosition(e.target.value)}
                      placeholder={category === 'Pengasuh' ? 'Pendiri dan Pengasuh' : category === 'Pengarah' ? 'Direktur Yayasan' : 'Pembina PTV'}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* SEKSI 3: TANGGAL LAHIR & ALAMAT */}
            <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--b-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                3. Informasi Personal & Domisili
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                    Angkatan
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={angkatan}
                    onChange={(e) => setAngkatan(e.target.value)}
                    disabled={category !== 'Kru'}
                    placeholder={category !== 'Kru' ? 'Tidak berlaku' : 'Contoh: 11, 12'}
                    style={{ width: '100%', boxSizing: 'border-box', opacity: category !== 'Kru' ? 0.6 : 1 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    className="input font-mono"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                  Alamat Domisili
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat lengkap tempat tinggal / domisili santri"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* SEKSI 4: STATUS KEANGGOTAAN */}
            <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--b-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                4. Status Keaktifan Kru
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                  Status Operasional Personel
                </label>
                <select
                  className="input"
                  value={statusKru}
                  onChange={(e) => setStatusKru(e.target.value as CrewMembershipStatus)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Aktif">Aktif (Dapat ditugaskan pada agenda liputan & peminjaman alat)</option>
                  <option value="Nonaktif">Nonaktif (Purna / Alumni / Istirahat tugas operasional)</option>
                </select>
                <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>
                  Catatan: Status kru terpisah dari status akun login. Personel nonaktif tetap dapat login jika akunnya aktif.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Modal */}
          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--line-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={closeWhenIdle}
              disabled={isSubmitting || isUploadingPhoto}
              style={{ minHeight: '38px', borderRadius: 'var(--ptv-curve-pill)', fontWeight: 600 }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn pri"
              disabled={isSubmitting || isUploadingPhoto}
              style={{ minHeight: '38px', padding: '0 20px', borderRadius: 'var(--ptv-curve-pill)', fontWeight: 600 }}
            >
              <i className={isSubmitting ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-check'} style={{ marginRight: '6px' }} />
              {isSubmitting
                ? 'Menyimpan...'
                : (isEdit ? 'Simpan Perubahan' : 'Daftarkan Personel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
