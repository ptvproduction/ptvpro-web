import { createPortal } from 'react-dom';
import React, { useState, useRef } from 'react';
import { X, MapPin, Calendar, MessageCircle, CheckCircle2, Trash2, ZoomIn, Search, Sparkles } from 'lucide-react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { LostFoundItem } from '../types';
import { ImageLightboxModal } from '../../../../shared/components';

interface LostFoundDetailDrawerProps {
  item: LostFoundItem | null;
  onClose: () => void;
  onMarkDone: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isExecutive?: boolean;
}

export const LostFoundDetailDrawer: React.FC<LostFoundDetailDrawerProps> = ({
  item,
  onClose,
  onMarkDone,
  onDelete,
  isExecutive = true,
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [saveError, setSaveError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(item),
    onClose: () => {
      if (isLightboxOpen) {
        setIsLightboxOpen(false);
      } else {
        onClose();
      }
    },
    modalRef,
    id: 'lost-found-detail-drawer',
  });

  if (!item) return null;

  const isHilang = item.type === 'hilang';
  const isDone = item.status === 'Dikembalikan';
  const cleanContact = item.reporterContact.replace(/[^0-9]/g, '');
  const waText = 'Halo ' + item.reporterName + ', terkait laporan ' + (isHilang ? 'kehilangan' : 'temuan') + ' barang: ' + item.title + ' di PTV PRO.';
  const waUrl = 'https://wa.me/' + cleanContact + '?text=' + encodeURIComponent(waText);

  const canDelete = isExecutive || item.isCurrentUser;
  const hasPhoto = Boolean(item.photoUrl && !imgError);

  const content = (
    <>
      <div className="lf-drawer-backdrop" onClick={onClose}>
        <div
          ref={modalRef}
          className="lf-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
          onClick={(e) => e.stopPropagation()}
        >
          {saveError && <p role="alert" style={{ padding: 16 }}>{saveError}</p>}
          <div className="lf-drawer-header">
            <div className="lf-drawer-header-bar">
              <div className="lf-drawer-badge-group">
                <span className={`lf-status-badge ${isDone ? 'done' : isHilang ? 'lost' : 'found'}`}>
                  {item.status}
                </span>
                <span className="lf-type-pill">{isHilang ? 'Barang Hilang' : 'Barang Temuan'}</span>
              </div>
              <button
                type="button"
                className="lf-close-btn"
                onClick={onClose}
                aria-label="Tutup detail laporan"
              >
                <X size={20} />
              </button>
            </div>
            <div className="lf-drawer-header-title-wrap">
              <h3 className="lf-drawer-title">{item.title}</h3>
            </div>
          </div>

          <div className="lf-drawer-body">
            {hasPhoto ? (
              <div
                className="lf-drawer-media-box"
                onClick={() => setIsLightboxOpen(true)}
                title="Klik untuk memperbesar foto barang"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsLightboxOpen(true);
                  }
                }}
              >
                <img
                  src={item.photoUrl}
                  alt={item.title}
                  className="lf-drawer-img"
                  onError={() => setImgError(true)}
                />
                <div className="lf-photo-zoom-hint">
                  <ZoomIn size={14} /> Klik untuk Perbesar
                </div>
              </div>
            ) : (
              <div className={`lf-drawer-empty-photo ${isHilang ? 'lost' : 'found'}`}>
                {isHilang ? <Search size={36} /> : <Sparkles size={36} />}
                <span>Tidak ada foto barang yang dilampirkan</span>
              </div>
            )}

          <div className="lf-drawer-section">
            <h4 className="lf-section-heading">Informasi Kejadian</h4>
            <div className="lf-info-grid">
              <div className="lf-info-item">
                <MapPin size={16} className="lf-info-icon" />
                <div>
                  <span className="lf-info-label">Lokasi</span>
                  <p className="lf-info-value">{item.location}</p>
                </div>
              </div>
              <div className="lf-info-item">
                <Calendar size={16} className="lf-info-icon" />
                <div>
                  <span className="lf-info-label">Tanggal</span>
                  <p className="lf-info-value">{item.date}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lf-drawer-section">
            <h4 className="lf-section-heading">Deskripsi & Ciri Khusus</h4>
            <div className="lf-desc-box">
              {item.description || 'Tidak ada catatan tambahan untuk barang ini.'}
            </div>
          </div>

          <div className="lf-drawer-section">
            <h4 className="lf-section-heading">Kontak Pelapor</h4>
            <div className="lf-contact-card">
              <div className="lf-contact-info">
                <div className="lf-avatar">{item.reporterName.charAt(0)}</div>
                <div>
                  <p className="lf-contact-name">{item.reporterName}</p>
                  <p className="lf-contact-sub">Pelapor Terverifikasi</p>
                </div>
              </div>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="lf-wa-btn"
              >
                <MessageCircle size={16} /> Hubungi via WhatsApp
              </a>
            </div>
          </div>

          {isDone && item.resolvedAt && (
            <div className="lf-resolved-notice">
              <CheckCircle2 size={18} className="lf-resolved-icon" />
              <div>
                <strong>Barang Telah Dikembalikan</strong>
                <p>
                  Diverifikasi selesai pada{' '}
                  {new Date(item.resolvedAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  oleh {item.resolvedBy || 'Pengelola Studio'}.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="lf-drawer-footer">
          {canDelete && (
            <button
              type="button"
              className="lf-btn lf-btn-danger"
              onClick={async () => {
                if (window.confirm('Hapus laporan Lost & Found ini?')) {
                  try {
                    await onDelete(item.id);
                    onClose();
                  } catch (error) { setSaveError(error instanceof Error ? error.message : 'Penghapusan belum tersimpan.'); }
                }
              }}
            >
              <Trash2 size={16} /> Hapus
            </button>
          )}

          {!isDone && isExecutive && (
            <button
              type="button"
              className="lf-btn lf-btn-success"
              onClick={async () => {
                if (window.confirm('Tandai barang telah berhasil dikembalikan ke pemiliknya?')) {
                  try { await onMarkDone(item.id); }
                  catch (error) { setSaveError(error instanceof Error ? error.message : 'Perubahan belum tersimpan.'); }
                }
              }}
            >
              <CheckCircle2 size={16} /> Tandai Selesai / Dikembalikan
            </button>
          )}
        </div>
      </div>
    </div>

    {hasPhoto && (
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        imageUrl={item.photoUrl!}
        altText={`Foto Barang: ${item.title}`}
        title={`Foto Barang — ${item.title}`}
        caption={`${isHilang ? 'Kehilangan' : 'Temuan'} di ${item.location} • Tanggal: ${item.date}`}
        onClose={() => setIsLightboxOpen(false)}
      />
    )}
  </>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
