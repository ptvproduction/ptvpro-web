import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalContact } from '../mock/kontakEksternalMockData';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface KontakEksternalFormModalProps {
  isOpen: boolean;
  isEdit: boolean;
  initialData?: ExternalContact | null;
  onClose: () => void;
  onSave: (data: Omit<ExternalContact, 'id'>) => Promise<void> | void;
}

export const KontakEksternalFormModal: React.FC<KontakEksternalFormModalProps> = ({
  isOpen,
  isEdit,
  initialData,
  onClose,
  onSave,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nama, setNama] = useState('');
  const [lembaga, setLembaga] = useState<'Pondok' | 'Sekolah' | 'Yayasan' | 'Mitra'>('Pondok');
  const [kategori, setKategori] = useState('Ustadz');
  const [jabatan, setJabatan] = useState('');
  const [organisasi, setOrganisasi] = useState('');
  const [nomorTelepon, setNomorTelepon] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [alamat, setAlamat] = useState('');
  const [catatan, setCatatan] = useState('');
  const [status, setStatus] = useState<'Aktif' | 'Tidak Aktif'>('Aktif');
  const [fotoUrl, setFotoUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialData && isEdit) {
      setNama(initialData.nama || '');
      setLembaga(initialData.lembaga || 'Pondok');
      setKategori(initialData.kategori || 'Ustadz');
      setJabatan(initialData.jabatan || '');
      setOrganisasi(initialData.organisasi || '');
      setNomorTelepon(initialData.nomor_telepon || '');
      setWhatsapp(initialData.whatsapp || '');
      setEmail(initialData.email || '');
      setAlamat(initialData.alamat || '');
      setCatatan(initialData.catatan || '');
      setStatus(initialData.status || 'Aktif');
      setFotoUrl(initialData.foto_url || '');
    } else {
      setNama('');
      setLembaga('Pondok');
      setKategori('Ustadz');
      setJabatan('');
      setOrganisasi('Pondok Pesantren Bumi Shalawat');
      setNomorTelepon('');
      setWhatsapp('');
      setEmail('');
      setAlamat('');
      setCatatan('');
      setStatus('Aktif');
      setFotoUrl('');
    }
    setErrorMsg('');
  }, [initialData, isEdit, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setErrorMsg('Nama kontak eksternal wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onSave({
        nama: nama.trim(),
        lembaga,
        kategori,
        jabatan: jabatan.trim() || 'Staf / Relasi',
        organisasi: organisasi.trim() || lembaga,
        nomor_telepon: nomorTelepon.trim() || undefined,
        whatsapp: whatsapp.trim() || nomorTelepon.trim() || undefined,
        email: email.trim() || undefined,
        alamat: alamat.trim() || undefined,
        catatan: catatan.trim() || undefined,
        foto_url: fotoUrl.trim() || undefined,
        status,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan kontak eksternal ke database Staging.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="kk-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div ref={modalRef} className="kk-drawer-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="kk-drawer-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
              {isEdit ? 'Edit Kontak Relasi & Lembaga' : 'Tambah Kontak Relasi & Lembaga'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--muted)' }}>
              Direktori resmi kontak Ustadz/ah, Pondok, Sekolah, Yayasan, dan Rekanan
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '16px' }} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="kk-drawer-body">
            {errorMsg && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#dc2626',
                  borderRadius: 'var(--ptv-curve-sm)',
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Grid 2: Lembaga & Sapaan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Institusi / Lembaga
                </label>
                <select
                  className="input"
                  value={lembaga}
                  onChange={(e) => setLembaga(e.target.value as any)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Pondok">Pondok Pesantren</option>
                  <option value="Sekolah">Sekolah (SMP & SMA)</option>
                  <option value="Yayasan">Yayasan Bumi Shalawat</option>
                  <option value="Mitra">Mitra & Vendor Eksternal</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Sapaan / Peran
                </label>
                <select
                  className="input"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Ustadz">Ustadz</option>
                  <option value="Ustadzah">Ustadzah</option>
                  <option value="Pembina">Pembina</option>
                  <option value="Narasumber">Narasumber</option>
                  <option value="Vendor">Vendor / Rekanan</option>
                  <option value="Partner">Partner Acara / Mitra</option>
                  <option value="Instansi">Instansi Resmi</option>
                </select>
              </div>
            </div>

            {/* Grid 2: Nama & Jabatan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Nama Lengkap (Wajib)
                </label>
                <input
                  type="text"
                  className="input"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Ust. H. Ahmad Fauzi"
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Jabatan / Bagian
                </label>
                <input
                  type="text"
                  className="input"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  placeholder="Contoh: Sarpras SMA / Madin"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Grid 2: Unit Organisasi & Status Relasi */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Unit / Detail Organisasi
                </label>
                <input
                  type="text"
                  className="input"
                  value={organisasi}
                  onChange={(e) => setOrganisasi(e.target.value)}
                  placeholder="Contoh: SMP Progresif / Asrama Putra"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Status Relasi
                </label>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                </select>
              </div>
            </div>

            {/* Grid 2: WhatsApp & Telepon */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Nomor WhatsApp
                </label>
                <input
                  type="text"
                  className="input font-mono"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                  Nomor Telepon (Opsional)
                </label>
                <input
                  type="text"
                  className="input font-mono"
                  value={nomorTelepon}
                  onChange={(e) => setNomorTelepon(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                Email (Opsional)
              </label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Alamat */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                Alamat Lengkap
              </label>
              <textarea
                className="input"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="Alamat kantor, kediaman, atau domisili..."
                rows={2}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {/* Catatan Khusus */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                Catatan Khusus Koordinasi
              </label>
              <textarea
                className="input"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Catatan keahlian, jadwal koordinasi, kontak alternatif..."
                rows={2}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {/* Foto / Logo URL */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                URL Foto / Logo Kontak (Opsional)
              </label>
              <input
                type="text"
                className="input"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                placeholder="https://... atau biarkan kosong"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="kk-drawer-footer" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ minHeight: '40px', borderRadius: 'var(--ptv-curve-pill)' }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn pri"
              disabled={isSubmitting}
              style={{ minHeight: '40px', padding: '0 24px', borderRadius: 'var(--ptv-curve-pill)' }}
            >
              <i className={isSubmitting ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-check'} style={{ marginRight: '6px' }} />
              {isSubmitting
                ? 'Menyimpan ke Staging...'
                : (isEdit ? 'Simpan Kontak' : 'Simpan Kontak Baru')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
