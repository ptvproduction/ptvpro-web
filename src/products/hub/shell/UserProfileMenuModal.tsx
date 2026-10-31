import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

import type { AuthUser } from '@core/auth/types';

interface UserProfileMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  user?: AuthUser | null;
}

export const UserProfileMenuModal: React.FC<UserProfileMenuModalProps> = ({
  isOpen,
  onClose,
  onToggleTheme,
  isDark,
  user: directUser,
}) => {
  const navigate = useNavigate();
  const modalRef = useRef<HTMLElement>(null);
  const sessionStore = useSessionStore();
  const user = directUser !== undefined ? directUser : sessionStore.user;
  const { logout, can } = sessionStore;

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'user-profile-menu-modal',
    isGlobal: true,
  });

  if (!isOpen) return null;

  const initials = (user?.full_name || 'PTV')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'P';

  const roleDisplay = user?.position
    ? user.position.charAt(0).toUpperCase() + user.position.slice(1)
    : 'Kru';

  const subText = user?.ptv_id
    ? `${user.ptv_id} — ${user.division || 'Kru PTV'}`
    : user?.division || 'Kru PTV';

  const handleLogout = async () => {
    if (!window.confirm('Keluar dari akun Progresif TV?')) return;
    onClose();
    await logout();
    navigate('/hub/login');
  };

  const handleGo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <section
        ref={modalRef}
        className="sheet on"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: '85vh', maxWidth: '480px', width: '100%' }}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <h3>Akun</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="sheet-body" style={{ overflowY: 'auto', paddingBottom: '24px' }}>
          {/* User profile header 1:1 legacy openProfile() */}
          <div
            className="row"
            style={{
              padding: '6px 4px 16px',
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              borderBottom: '1px solid var(--line-2)',
              marginBottom: '12px',
            }}
          >
            <span
              className="avatar lg"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
              }}
            >
              {initials}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start', minWidth: 0 }}>
              <span
                className="t-lg trunc"
                style={{
                  fontSize: '16.5px',
                  fontWeight: 700,
                  lineHeight: '1.2',
                  color: 'var(--ink)',
                  maxWidth: '100%',
                }}
              >
                {user?.full_name || 'Pengguna PTV PRO'}
              </span>
              <span className="t-sm muted" style={{ fontSize: '13px', lineHeight: '1.2', color: 'var(--muted)' }}>
                {subText}
              </span>
              <span
                className="chip ok"
                style={{
                  marginTop: '4px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 650,
                  borderRadius: 'var(--ptv-curve-pill)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-shield-halved" style={{ fontSize: '10px' }} />
                <span>{roleDisplay}</span>
              </span>
            </div>
          </div>

          {/* Action List 1:1 legacy */}
          <div className="list">
            {can('hub.access') && (
              <button
                type="button"
                className="li"
                onClick={() => handleGo('/hub/id')}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <span className="li-ic">
                  <i className="fa-solid fa-id-card" />
                </span>
                <span className="li-body">
                  <span className="li-t">Kartu identitas digital</span>
                  <span className="li-s">Tunjukkan saat diminta petugas</span>
                </span>
                <span className="chev">
                  <i className="fa-solid fa-chevron-right" />
                </span>
              </button>
            )}

            {can('hub.access') && (
              <button
                type="button"
                className="li"
                onClick={() => handleGo('/hub/portofolio')}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <span className="li-ic">
                  <i className="fa-solid fa-briefcase" />
                </span>
                <span className="li-body">
                  <span className="li-t">Portofolio &amp; Rekam Karya</span>
                  <span className="li-s">Catat riwayat kontribusi &amp; publikasi karya</span>
                </span>
                <span className="chev">
                  <i className="fa-solid fa-chevron-right" />
                </span>
              </button>
            )}

            {can('documents.view') && (
              <button
                type="button"
                className="li"
                onClick={() => handleGo('/hub/dokumen')}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <span className="li-ic">
                  <i className="fa-solid fa-file-lines" />
                </span>
                <span className="li-body">
                  <span className="li-t">Dokumen saya</span>
                  <span className="li-s">Surat dan izin atas nama kamu</span>
                </span>
                <span className="chev">
                  <i className="fa-solid fa-chevron-right" />
                </span>
              </button>
            )}

            {can('settings.personal') && (
              <button
                type="button"
                className="li"
                onClick={() => handleGo('/hub/pengaturan')}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <span className="li-ic">
                  <i className="fa-solid fa-gear" />
                </span>
                <span className="li-body">
                  <span className="li-t">Pengaturan</span>
                  <span className="li-s">Tampilan, preferensi, dan akun</span>
                </span>
                <span className="chev">
                  <i className="fa-solid fa-chevron-right" />
                </span>
              </button>
            )}

            <button
              type="button"
              className="li"
              onClick={onToggleTheme}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="li-ic">
                <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`} />
              </span>
              <span className="li-body">
                <span className="li-t">Ganti mode {isDark ? 'terang' : 'gelap'}</span>
                <span className="li-s">Tema tampilan saat ini: {isDark ? 'Gelap' : 'Terang'}</span>
              </span>
            </button>

            <button
              type="button"
              className="li li-danger"
              onClick={handleLogout}
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                marginTop: '6px',
                borderTop: '1px solid var(--line-2)',
                paddingTop: '12px',
              }}
            >
              <span className="li-ic" style={{ color: '#ef4444' }}>
                <i className="fa-solid fa-arrow-right-from-bracket" />
              </span>
              <span className="li-body">
                <span className="li-t" style={{ color: '#ef4444', fontWeight: 650 }}>
                  Keluar akun
                </span>
                <span className="li-s">Akhiri sesi login di perangkat ini</span>
              </span>
              <span className="chev" style={{ color: '#ef4444' }}>
                <i className="fa-solid fa-chevron-right" />
              </span>
            </button>
          </div>
        </div>
      </section>
    </>
  );
};
