import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalContact } from '../mock/kontakEksternalMockData';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface KontakEksternalDetailDrawerProps {
  contact: ExternalContact | null;
  onClose: () => void;
  canManage: boolean;
  onEdit: (c: ExternalContact) => void;
  onDelete: (c: ExternalContact) => void;
}

export const KontakEksternalDetailDrawer: React.FC<KontakEksternalDetailDrawerProps> = ({
  contact,
  onClose,
  canManage,
  onEdit,
  onDelete,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({
    isOpen: Boolean(contact),
    onClose,
    modalRef,
  });

  if (!contact) return null;

  const inits = contact.nama
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isWaValid = Boolean(contact.whatsapp && !contact.whatsapp.includes('*') && contact.whatsapp.replace(/[^0-9]/g, '').length >= 9);
  const waLink = isWaValid
    ? `https://wa.me/${contact.whatsapp!.replace(/[^0-9]/g, '').replace(/^0/, '62')}`
    : null;

  const isTelValid = Boolean(contact.nomor_telepon && !contact.nomor_telepon.includes('*') && contact.nomor_telepon.replace(/[^0-9]/g, '').length >= 6);

  return createPortal(
    <div className="kk-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div ref={modalRef} className="kk-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Header Drawer */}
        <div className="kk-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>Detail Kontak Relasi</span>
            <span style={{ color: 'var(--line-2)' }}>•</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--b-600)' }}>{contact.lembaga}</span>
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

        {/* Body Drawer */}
        <div className="kk-drawer-body">
          {/* Identity Top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '4px' }}>
            {contact.foto_url ? (
              <img
                src={contact.foto_url}
                alt={contact.nama}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  objectFit: 'cover',
                  border: '2px solid var(--surface)',
                  boxShadow: 'var(--shadow-s)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '22px',
                  fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                }}
              >
                {inits}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: 'var(--ink)' }}>
                {contact.nama}
              </h2>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                  {contact.kategori}
                </span>
                <span
                  className={`kk-category-badge ${
                    contact.lembaga?.toLowerCase().includes('pondok')
                      ? 'pondok'
                      : contact.lembaga?.toLowerCase().includes('sekolah')
                      ? 'sekolah'
                      : contact.lembaga?.toLowerCase().includes('yayasan')
                      ? 'yayasan'
                      : 'mitra'
                  }`}
                >
                  {contact.lembaga}
                </span>
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
              </div>
            </div>
          </div>

          {/* Key-Value Card */}
          <div className="kk-kv-card">
            <div className="kk-kv-row">
              <span className="k">Institusi / Lembaga</span>
              <span className="v" style={{ color: 'var(--b-600)' }}>{contact.organisasi || contact.lembaga}</span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Sapaan / Peran</span>
              <span className="v">{contact.kategori}</span>
            </div>
            <div className="kk-kv-row">
              <span className="k">Jabatan / Bagian</span>
              <span className="v">{contact.jabatan || '—'}</span>
            </div>
            {contact.nomor_telepon && (
              <div className="kk-kv-row">
                <span className="k">Nomor Telepon</span>
                <span className="v font-mono">{contact.nomor_telepon}</span>
              </div>
            )}
            {contact.whatsapp && (
              <div className="kk-kv-row">
                <span className="k">WhatsApp</span>
                <span className="v font-mono">{contact.whatsapp}</span>
              </div>
            )}
            {contact.email && (
              <div className="kk-kv-row">
                <span className="k">Email</span>
                <span className="v" style={{ fontSize: '12px' }}>{contact.email}</span>
              </div>
            )}
            {contact.alamat && (
              <div className="kk-kv-row" style={{ alignItems: 'flex-start' }}>
                <span className="k">Alamat Lengkap</span>
                <span className="v" style={{ textAlign: 'right', maxWidth: '65%' }}>{contact.alamat}</span>
              </div>
            )}
            {contact.catatan && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
                  Catatan Khusus Koordinasi:
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
                  {contact.catatan}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Drawer */}
        <div className="kk-drawer-footer">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn kk-whatsapp-btn-full"
            >
              <i className="fa-brands fa-whatsapp" style={{ fontSize: '15px' }} />
              WhatsApp
            </a>
          )}
          {isTelValid && (
            <a
              href={`tel:${contact.nomor_telepon}`}
              className="btn kk-phone-btn"
            >
              <i className="fa-solid fa-phone" />
              Telepon
            </a>
          )}
          {canManage && (
            <>
              <button
                type="button"
                className="btn pri"
                onClick={() => onEdit(contact)}
                style={{ minHeight: '40px', borderRadius: 'var(--ptv-curve-pill)' }}
              >
                <i className="fa-solid fa-pen-to-square" style={{ marginRight: '6px' }} />
                Edit
              </button>
              <button
                type="button"
                className="btn dang"
                onClick={() => onDelete(contact)}
                style={{ minHeight: '40px', borderRadius: 'var(--ptv-curve-pill)' }}
                title="Hapus Kontak"
              >
                <i className="fa-solid fa-trash" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
