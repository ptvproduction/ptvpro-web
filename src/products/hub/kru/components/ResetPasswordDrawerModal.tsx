import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CrewMember } from '../types';
import { getKruService } from '../kruService';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { showToast } from '@shared/components';

interface ResetPasswordDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  crew: CrewMember;
  onSuccess?: () => void;
}

export const ResetPasswordDrawerModal: React.FC<ResetPasswordDrawerModalProps> = ({
  isOpen,
  onClose,
  crew,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({
    isOpen: Boolean(isOpen && crew),
    onClose,
    modalRef,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 4) {
      setErrorMessage('Password baru minimal 4 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok.');
      return;
    }
    if (reason.trim().length < 5) {
      setErrorMessage('Alasan atur ulang password wajib diisi (minimal 5 karakter).');
      return;
    }

    try {
      setLoading(true);
      const res = await getKruService().resetPasswordByRoot(
        crew.id,
        newPassword,
        reason.trim()
      );

      showToast({
        title: 'Password Berhasil Direset',
        desc: res.message || `Password untuk @${crew.username || crew.ptv_id} telah diatur ulang.`,
        icon: 'lock',
      });

      setNewPassword('');
      setConfirmPassword('');
      setReason('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengatur ulang password.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div
      className="kk-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10050,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={modalRef}
        className="access-modal-card"
        style={{
          background: 'var(--surface, #ffffff)',
          borderRadius: 'var(--ptv-curve-xl, 20px)',
          padding: '24px',
          maxWidth: '440px',
          width: '100%',
          margin: 'auto',
          boxShadow: 'var(--shadow-xl, 0 24px 64px rgba(0,0,0,0.25))',
          border: '1px solid var(--line-2, rgba(11, 42, 74, 0.1))',
          boxSizing: 'border-box',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--ptv-curve-sm, 10px)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger, #ef4444)',
                fontSize: '15px',
                flexShrink: 0,
              }}
            >
              <i className="fa-solid fa-key" />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                Atur Ulang Password
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                Target: <strong>{crew.full_name}</strong> (@{crew.username || crew.ptv_id})
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
            disabled={loading}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Security Warning Notice */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--ptv-curve-sm, 10px)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            marginBottom: '16px',
            fontSize: '12px',
            lineHeight: 1.45,
            color: 'var(--warn-text, #b45309)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <i className="fa-solid fa-shield-halved" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong>Aksi Khusus ROOT:</strong> Seluruh sesi login lama untuk kru ini akan langsung dibatalkan demi keamanan.
            </div>
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--ptv-curve-sm, 10px)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              marginBottom: '16px',
              fontSize: '12.5px',
              color: 'var(--danger, #ef4444)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <i className="fa-solid fa-circle-exclamation" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Password Baru <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 4 karakter"
                required
                minLength={4}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '9px 38px 9px 12px',
                  borderRadius: 'var(--ptv-curve-sm, 10px)',
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '13px',
                }}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Konfirmasi Password Baru <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              required
              minLength={4}
              disabled={loading}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--ptv-curve-sm, 10px)',
                border: '1px solid var(--line-2)',
                background: 'var(--surface-sunken)',
                color: 'var(--ink)',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Alasan Atur Ulang <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Misal: Permintaan kru karena lupa kata sandi"
              required
              minLength={5}
              disabled={loading}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--ptv-curve-sm, 10px)',
                border: '1px solid var(--line-2)',
                background: 'var(--surface-sunken)',
                color: 'var(--ink)',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Wajib dicatat dalam audit trail keamanan.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn is-secondary"
              onClick={onClose}
              disabled={loading}
              style={{ fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--ptv-curve-pill)' }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn pri"
              disabled={loading}
              style={{
                fontSize: '13px',
                padding: '8px 18px',
                borderRadius: 'var(--ptv-curve-pill)',
                background: 'var(--danger, #ef4444)',
                borderColor: 'var(--danger, #ef4444)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-key" />
                  <span>Simpan Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
