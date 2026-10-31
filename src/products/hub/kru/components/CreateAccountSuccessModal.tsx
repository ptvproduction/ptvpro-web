import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CreatedAccountCredentials } from '../kruService';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { showToast } from '@shared/components';

interface CreateAccountSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: CreatedAccountCredentials;
}

export const CreateAccountSuccessModal: React.FC<CreateAccountSuccessModalProps> = ({
  isOpen,
  onClose,
  credentials,
}) => {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(isOpen && credentials),
    onClose,
    modalRef,
  });

  if (!isOpen || !credentials) return null;

  const handleCopyCredentials = async () => {
    const textToCopy = `Halo ${credentials.full_name},\nBerikut kredensial login PTVPRO Hub Anda:\n\nUsername: ${credentials.username}\nPassword Sementara: ${credentials.temporary_password}\nID PTV: ${credentials.ptv_id}\n\n*PENTING: Anda wajib mengganti password saat pertama kali masuk ke sistem PTVPRO.*`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast('Kredensial berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Gagal menyalin otomatis. Silakan salin manual.', 'error');
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-acc-modal-title"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--surface, #ffffff)',
          borderRadius: 'var(--ptv-curve-lg, 16px)',
          border: '1px solid var(--line-2, #e5e7eb)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--line-2, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-raised, #f9fafb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--ptv-curve-pill, 9999px)',
                background: 'var(--ok-bg, rgba(34, 197, 94, 0.12))',
                color: 'var(--ok, #16a34a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
            >
              <i className="fa-solid fa-check" />
            </div>
            <div>
              <h3
                id="create-acc-modal-title"
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--ink, #111827)',
                  lineHeight: 1.3,
                }}
              >
                Akun Berhasil Dibuat
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--muted, #6b7280)' }}>
                {credentials.full_name} ({credentials.ptv_id})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted, #6b7280)',
              fontSize: '16px',
              padding: '6px',
              borderRadius: 'var(--ptv-curve-pill, 9999px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body Modal */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Alert Security Notice */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--ptv-curve-sm, 10px)',
              background: 'var(--warn-bg, rgba(217, 119, 6, 0.08))',
              border: '1px solid var(--warn-border, rgba(217, 119, 6, 0.25))',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--warn, #d97706)', marginTop: '2px', fontSize: '14px' }} />
            <div style={{ fontSize: '11.5px', color: 'var(--ink, #111827)', lineHeight: 1.45 }}>
              <strong>Kredensial sementara hanya ditampilkan sekali.</strong> Berikan kredensial ini kepada personel. Pengguna wajib mengganti password pada login pertama.
            </div>
          </div>

          {/* Credential Fields Box */}
          <div
            style={{
              background: 'var(--surface-sunken, #f3f4f6)',
              borderRadius: 'var(--ptv-curve-sm, 10px)',
              border: '1px solid var(--line-2, #e5e7eb)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Username Login
              </span>
              <div
                className="font-mono"
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--pri, #0284c7)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>@{credentials.username}</span>
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--line-2, #e5e7eb)' }} />

            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Password Sementara
              </span>
              <div
                className="font-mono"
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--ink, #111827)',
                  marginTop: '2px',
                  background: 'var(--surface, #ffffff)',
                  padding: '6px 10px',
                  borderRadius: 'var(--ptv-curve-sm, 6px)',
                  border: '1px dashed var(--line-2, #d1d5db)',
                  display: 'inline-block',
                }}
              >
                {credentials.temporary_password}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--line-2, #e5e7eb)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted, #6b7280)' }}>Profil Akses Awal:</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #111827)', marginLeft: '6px' }}>Kru</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ok, #16a34a)' }} />
                <span style={{ fontSize: '11.5px', color: 'var(--ok, #16a34a)', fontWeight: 600 }}>Akun Aktif</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--line-2, #e5e7eb)',
            background: 'var(--surface-raised, #f9fafb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={handleCopyCredentials}
            style={{
              fontSize: '12.5px',
              padding: '7px 14px',
              borderRadius: 'var(--ptv-curve-pill, 9999px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: copied ? 'var(--ok, #16a34a)' : 'var(--line-2, #e5e7eb)',
              color: copied ? 'var(--ok, #16a34a)' : 'var(--ink, #111827)',
            }}
          >
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
            <span>{copied ? 'Tersalin' : 'Salin Kredensial'}</span>
          </button>
          <button
            type="button"
            className="btn pri"
            onClick={onClose}
            style={{
              fontSize: '12.5px',
              padding: '7px 16px',
              borderRadius: 'var(--ptv-curve-pill, 9999px)',
            }}
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
