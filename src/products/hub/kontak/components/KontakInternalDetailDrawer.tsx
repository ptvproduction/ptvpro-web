import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { InternalContact } from '../types';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface KontakInternalDetailDrawerProps {
  contact: InternalContact | null;
  onClose: () => void;
}

export const KontakInternalDetailDrawer: React.FC<KontakInternalDetailDrawerProps> = ({
  contact,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(contact),
    onClose,
    modalRef,
  });

  if (!contact) return null;

  const inits = contact.full_name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Sembunyikan divisi kerja dan angkatan untuk Pengarah, Pembina, Pendiri/Pengasuh, dan peran kehormatan
  const isNonOperational = (category?: string) => {
    if (!category) return false;
    const cat = category.toLowerCase().trim();
    return (
      cat.includes('pengarah') ||
      cat.includes('pembina') ||
      cat.includes('pendiri') ||
      cat.includes('pengasuh') ||
      cat.includes('penasihat')
    );
  };

  const isPhoneValid = Boolean(contact.phone && !contact.phone.includes('*') && contact.phone.replace(/[^0-9]/g, '').length >= 6);
  const isWaValid = Boolean(contact.phone && !contact.phone.includes('*') && contact.phone.replace(/[^0-9]/g, '').length >= 9);
  const waNumber = isWaValid
    ? contact.phone!.replace(/[^0-9]/g, '').replace(/^0/, '62')
    : null;

  const drawerContent = (
    <div
      className="kk-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="internalContactDrawerTitle"
    >
      <div
        ref={modalRef}
        className="kk-drawer-content"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Drawer */}
        <div className="kk-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>Detail Kontak Internal</span>
            <span style={{ color: 'var(--line-2)' }}>•</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--b-600)' }}>{contact.unit}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup Detail Kontak"
            style={{ minWidth: '44px', minHeight: '44px', display: 'grid', placeItems: 'center' }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '16px' }} />
          </button>
        </div>

        {/* Body Drawer */}
        <div className="kk-drawer-body">
          {/* Identity Top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '4px' }}>
            {contact.foto_url ? (
              <>
                <img
                  src={contact.foto_url}
                  alt={contact.full_name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'grid';
                  }}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    objectFit: 'cover',
                    border: '2px solid var(--surface)',
                    boxShadow: 'var(--shadow-s)',
                  }}
                />
                <div
                  style={{
                    display: 'none',
                    width: '64px',
                    height: '64px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    background:
                      contact.category === 'Pembina'
                        ? 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)'
                        : contact.category === 'Pengarah'
                        ? 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)'
                        : contact.category === 'Pengurus'
                        ? 'linear-gradient(135deg, #047857 0%, #10b981 100%)'
                        : 'linear-gradient(135deg, var(--b-600) 0%, var(--b-800) 100%)',
                    color: '#ffffff',
                    placeItems: 'center',
                    fontSize: '22px',
                    fontWeight: 800,
                    boxShadow: '0 4px 12px rgba(18, 115, 230, 0.25)',
                  }}
                >
                  {inits}
                </div>
              </>
            ) : (
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  background:
                    contact.category === 'Pembina'
                      ? 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)'
                      : contact.category === 'Pengarah'
                      ? 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)'
                      : contact.category === 'Pengurus'
                      ? 'linear-gradient(135deg, #047857 0%, #10b981 100%)'
                      : 'linear-gradient(135deg, var(--b-600) 0%, var(--b-800) 100%)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '22px',
                  fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(18, 115, 230, 0.25)',
                }}
              >
                {inits}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="internalContactDrawerTitle"
                style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: 'var(--ink)' }}
              >
                {contact.full_name}
              </h2>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    background:
                      contact.category === 'Pembina'
                        ? 'rgba(168, 85, 247, 0.12)'
                        : contact.category === 'Pengarah'
                        ? 'rgba(59, 130, 246, 0.12)'
                        : contact.category === 'Pengurus'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(11, 42, 74, 0.08)',
                    color:
                      contact.category === 'Pembina'
                        ? '#7e22ce'
                        : contact.category === 'Pengarah'
                        ? '#1d4ed8'
                        : contact.category === 'Pengurus'
                        ? '#047857'
                        : 'var(--ink)',
                  }}
                >
                  {contact.category}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    background: 'var(--b-050)',
                    color: 'var(--b-600)',
                  }}
                >
                  {contact.position}
                </span>
                {contact.status && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--ptv-curve-pill)',
                      background: contact.status === 'Aktif' ? 'var(--ok-bg)' : 'rgba(110, 140, 174, 0.12)',
                      color: contact.status === 'Aktif' ? 'var(--ok)' : 'var(--muted)',
                    }}
                  >
                    {contact.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Key-Value Card */}
          <div className="kk-kv-card">
            <div className="kk-kv-row">
              <span className="k">Nama Lengkap</span>
              <span className="v">{contact.full_name}</span>
            </div>
            {contact.title_prefix && (
              <div className="kk-kv-row">
                <span className="k">Sapaan / Gelar</span>
                <span className="v">{contact.title_prefix}</span>
              </div>
            )}
            <div className="kk-kv-row">
              <span className="k">Kategori Direktori</span>
              <span className="v">{contact.category}</span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Jabatan / Amanah</span>
              <span className="v">{contact.position}</span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Unit Lembaga</span>
              <span className="v" style={{ color: 'var(--b-600)' }}>{contact.unit}</span>
            </div>
            {/* Divisi Kerja & Angkatan (Hanya untuk kru operasional, disembunyikan untuk Pengarah/Pembina) */}
            {!isNonOperational(contact.category) && contact.divisi && (
              <div className="kk-kv-row">
                <span className="k">Divisi Kerja</span>
                <span className="v">{contact.divisi}</span>
              </div>
            )}
            {!isNonOperational(contact.category) && contact.angkatan && (
              <div className="kk-kv-row">
                <span className="k">Angkatan</span>
                <span className="v">Angkatan {contact.angkatan}</span>
              </div>
            )}
            {contact.ptv_id && (
              <div className="kk-kv-row">
                <span className="k">PTV-ID</span>
                <span className="v font-mono">{contact.ptv_id}</span>
              </div>
            )}
            <div className="kk-kv-row">
              <span className="k">Nomor Telepon</span>
              <span className="v font-mono">
                {isPhoneValid ? (
                  contact.phone
                ) : (
                  <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'inherit' }}>
                    Tidak tersedia
                  </span>
                )}
              </span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Alamat Email</span>
              <span className="v" style={{ fontSize: '12px' }}>{contact.email || '—'}</span>
            </div>

            {/* Catatan Protokoler & Koordinasi */}
            {contact.notes && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
                  <i className="fa-solid fa-info-circle" style={{ marginRight: '5px' }} />
                  Catatan Protokoler & Koordinasi:
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
                  {contact.notes}
                </div>
              </div>
            )}
          </div>

          {/* Tautan Personel Kru (Read-Only Informational Badge) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--ptv-curve-md)',
              background: contact.crew_id ? 'var(--b-050, #edf4ff)' : 'rgba(11,42,74,0.03)',
              border: `1px solid ${contact.crew_id ? 'var(--b-200, #b2d4ff)' : 'var(--line-2)'}`,
              fontSize: '12px',
              color: 'var(--ink-2)',
            }}
          >
            {contact.crew_id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-id-badge" style={{ color: 'var(--b-600)', fontSize: '15px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--b-700)' }}>
                    Personel Terdaftar Studio PTV
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Profil dan hak akses dikelola secara terpusat melalui Manajemen Kru.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-landmark" style={{ color: '#7e22ce', fontSize: '15px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                    Kontak Ekosistem Lembaga Pesantren
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Tercatat murni sebagai direktori komunikasi tanpa akun portal PTV PRO.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Drawer */}
        <div className="kk-drawer-footer">
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn kk-whatsapp-btn-full"
            >
              <i className="fa-brands fa-whatsapp" style={{ fontSize: '15px' }} />
              WhatsApp
            </a>
          )}
          {isPhoneValid && (
            <a
              href={`tel:${contact.phone}`}
              className="btn kk-phone-btn"
            >
              <i className="fa-solid fa-phone" />
              Telepon
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="btn kk-phone-btn"
              aria-label={`Kirim Email ke ${contact.full_name}`}
              title="Kirim Email"
            >
              <i className="fa-solid fa-envelope" />
            </a>
          )}
          <button
            type="button"
            className="btn block"
            onClick={onClose}
            style={{
              minHeight: '40px',
              borderRadius: 'var(--ptv-curve-pill)',
              flex: !waNumber ? 1 : undefined,
            }}
          >
            Tutup Kontak
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerContent, document.body)
    : drawerContent;
};
