import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RealQrCode } from '@shared/utils';
import { buildOfficialCrewVerificationUrl } from '../../../verification/verificationService';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

export interface IdentityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullName: string;
  ptvId: string;
  position: string;
  division?: string;
  status?: string;
}

export const IdentityVerificationModal: React.FC<IdentityVerificationModalProps> = ({
  isOpen,
  onClose,
  fullName,
  ptvId,
  position,
  division,
  status = 'Aktif',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'identity-verification-modal',
  });

  if (!isOpen) return null;

  const cleanName = fullName || 'Kru Progresif TV';
  const cleanId = ptvId || 'PTV-000';
  const cleanPos = position || 'Kru Operasional';
  const cleanDiv = division || 'Technical';
  const crewVerificationUrl = buildOfficialCrewVerificationUrl(cleanId);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(crewVerificationUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = crewVerificationUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleOpenPublicPortal = () => {
    window.open(crewVerificationUrl, '_blank', 'noopener,noreferrer');
  };

  const modalContent = (
    <div
      className="ptv-qr-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 10000,
        boxSizing: 'border-box',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verifModalTitle"
    >
      <div
        ref={modalRef}
        className="ptv-modal-dialog"
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          padding: '24px',
          background: 'var(--surface, #ffffff)',
          borderRadius: 'var(--ptv-curve-xl, 22px)',
          border: '1px solid var(--line, #e2e8f0)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.28)',
          boxSizing: 'border-box',
          margin: 'auto',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Tutup X */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup modal verifikasi"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            background: 'var(--bg-2, #f1f5f9)',
            color: 'var(--muted, #64748b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'background 0.15s ease',
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>

        {/* Header Modal */}
        <div style={{ paddingRight: '28px' }}>
          <h2
            id="verifModalTitle"
            style={{
              margin: '0 0 4px',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--ink, #0f172a)',
              letterSpacing: '-0.02em',
            }}
          >
            Verifikasi Keabsahan Identitas
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--muted, #64748b)',
              lineHeight: 1.45,
            }}
          >
            Pindai QR code atau buka tautan verifikasi resmi untuk membuktikan keabsahan data keanggotaan kru di portal publik.
          </p>
        </div>

        {/* Status Box Sederhana & Ramah */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '14px',
            background: 'rgba(22, 163, 74, 0.08)',
            border: '1px solid rgba(22, 163, 74, 0.2)',
          }}
        >
          <i
            className="fa-solid fa-circle-check"
            style={{ color: '#16a34a', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}
          />
          <div style={{ minWidth: 0, fontSize: '12.5px', lineHeight: 1.45 }}>
            <strong style={{ color: '#15803d', display: 'block', fontSize: '13px' }}>
              Anggota Terdaftar &amp; Terverifikasi {status}
            </strong>
            <span style={{ color: 'var(--ink, #334155)' }}>
              Data kartu identitas ini tercatat sah di pangkalan data resmi Progresif TV.
            </span>
          </div>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px',
            background: 'var(--bg-2, #f8fafc)',
            borderRadius: '16px',
            border: '1px solid var(--line-2, #e2e8f0)',
            gap: '10px',
          }}
        >
          <div
            style={{
              padding: '12px',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
              border: '1px solid var(--line-2, #e2e8f0)',
              display: 'inline-flex',
            }}
          >
            <RealQrCode
              payload={crewVerificationUrl}
              size={168}
              margin={2}
              color="#0B2A4A"
              bgColor="#ffffff"
              ariaLabel={`QR Code Verifikasi Resmi ${cleanName}`}
            />
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', textAlign: 'center' }}>
            Arahkan kamera smartphone ke QR code di atas untuk verifikasi langsung
          </span>
        </div>

        {/* Informasi Identitas yang Diperiksa */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--surface-2, #f8fafc)',
            borderRadius: '14px',
            border: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '12.5px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted, #64748b)' }}>Nama Kru</span>
            <strong style={{ color: 'var(--ink, #0f172a)' }}>{cleanName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted, #64748b)' }}>Nomor ID</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#2563eb' }}>
              {cleanId}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted, #64748b)' }}>Jabatan &amp; Divisi</span>
            <strong style={{ color: 'var(--ink, #0f172a)' }}>
              {cleanPos} · {cleanDiv}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted, #64748b)' }}>Masa Berlaku</span>
            <strong style={{ color: 'var(--ink, #0f172a)' }}>2026 – 2027</strong>
          </div>
        </div>

        {/* Tindakan: Buka Halaman Verifikasi & Salin Tautan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
          <button
            type="button"
            onClick={handleOpenPublicPortal}
            style={{
              width: '100%',
              minHeight: '40px',
              borderRadius: '12px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 650,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            <span>Buka Halaman Verifikasi Publik</span>
            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '11.5px' }} />
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                flex: 1,
                minHeight: '38px',
                borderRadius: '12px',
                border: '1px solid var(--line, #e2e8f0)',
                background: 'var(--surface, #ffffff)',
                color: copied ? '#15803d' : 'var(--ink, #0f172a)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
              <span>{copied ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                minWidth: '80px',
                minHeight: '38px',
                borderRadius: '12px',
                border: '1px solid var(--line, #e2e8f0)',
                background: 'var(--bg-2, #f1f5f9)',
                color: 'var(--ink, #0f172a)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
