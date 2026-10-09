import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { LOCAL_DEV_MOCK_USERS } from '@core/auth';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showDevAccounts, setShowDevAccounts] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isLoading, error } = useSessionStore();

  const redirectUrl = searchParams.get('redirect') || '/hub/beranda';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const ok = await login({ identifier: username.trim(), password });
    if (ok) {
      navigate(redirectUrl, { replace: true });
    }
  };

  const handleQuickLogin = async (ptvId: string) => {
    setUsername(ptvId);
    setPassword('demopass123');
    const ok = await login({ identifier: ptvId });
    if (ok) {
      navigate(redirectUrl, { replace: true });
    }
  };

  const handleGoogleLogin = () => {
    alert('Google OAuth login diarahkan ke akun resmi kru yang terdaftar di database.');
  };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100dvh',
      background: '#061A36',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'max(20px, env(safe-area-inset-top, 20px)) max(18px, env(safe-area-inset-right, 18px)) max(20px, env(safe-area-inset-bottom, 20px)) max(18px, env(safe-area-inset-left, 18px))',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* ── Photo Mosaic Background (Single-Asset Responsive for PC & Mobile) ── */}
      <div className="login-bg-container" aria-hidden="true">
        <picture className="login-bg-picture">
          <source media="(max-width: 768px)" srcSet="/assets/images/login-bg-mobile.webp" type="image/webp" />
          <source media="(max-width: 768px)" srcSet="/assets/images/login-bg-mobile.jpg" type="image/jpeg" />
          <source media="(min-width: 769px)" srcSet="/assets/images/login-bg-pc.webp" type="image/webp" />
          <source media="(min-width: 769px)" srcSet="/assets/images/login-bg-pc.jpg" type="image/jpeg" />
          <img
            src="/assets/images/login-bg-pc.webp"
            alt=""
            className="login-bg-img"
            decoding="async"
          />
        </picture>
      </div>
      <div className="mosaic-overlay" aria-hidden="true" />

      {/* ── Topbar ── */}
      <header className="lk-topbar">
        <a
          href="https://progresiftv.id/kru/"
          target="_blank"
          rel="noopener noreferrer"
          className="lk-navlink"
        >
          Verifikasi Kru
        </a>
        <button
          type="button"
          className="lk-navlink"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => setIsHelpOpen(true)}
        >
          Bantuan
        </button>
      </header>

      {/* ── Center Auth Box ── */}
      <main className="lk-auth-box">
        <div className="lk-brand">
          <div className="lk-brand-logo-wrap">
            <img
              src="/assets/images/ptv-logo-white.webp"
              alt="Progresif TV"
              className="lk-brand-logo-img"
            />
          </div>
        </div>

        {error && (
          <div className="lk-error">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" height="16" width="16">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="lk-form" id="ptvLoginForm">
          <input type="hidden" name="ptv_login" value="1" />
          <input
            type="text"
            name="ptv_user"
            className="lk-input"
            placeholder="Email / Username"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />

          <div className="lk-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              id="ptvPassInput"
              name="ptv_pass"
              className="lk-input"
              placeholder="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="button"
              className="lk-pass-toggle"
              id="passToggleBtn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
            >
              {!showPassword ? (
                <svg className="eye-open" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" height="19" width="19">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg className="eye-closed" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" height="19" width="19">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              )}
            </button>
          </div>

          <div className="lk-actions">
            <button
              type="button"
              className="lk-sublink"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => setIsHelpOpen(true)}
            >
              Bantuan Akses
            </button>
            <button
              type="submit"
              name="ptv_login"
              className="lk-btn-login"
              disabled={isLoading}
            >
              {isLoading ? 'Masuk...' : 'Login'}
            </button>
          </div>

          <div className="lk-divider">
            <span>atau</span>
          </div>

          <button
            type="button"
            className="lk-btn-google"
            id="btnGoogleLogin"
            onClick={handleGoogleLogin}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
            </svg>
            <span>Lanjutkan dengan Google</span>
          </button>
        </form>

        {/* ── Subtitle Dev Test Selector (Optional Toggle for Testing) ── */}
        <div style={{ marginTop: '24px' }}>
          <button
            type="button"
            onClick={() => setShowDevAccounts(!showDevAccounts)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: '11px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showDevAccounts ? '▲ Sembunyikan Akun Pengujian' : '▼ Pilih Akun Pengujian Cepat'}
          </button>

          {showDevAccounts && (
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: 'rgba(7, 42, 82, 0.75)',
                backdropFilter: 'blur(10px)',
                padding: '10px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              {Object.values(LOCAL_DEV_MOCK_USERS).map((u) => (
                <button
                  type="button"
                  key={u.ptv_id}
                  onClick={() => handleQuickLogin(u.ptv_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>
                    <strong>{u.ptv_id}</strong> &bull; {u.full_name}
                  </span>
                  <span style={{ fontSize: '10px', opacity: 0.75 }}>{u.assigned_profiles[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Help Modal Popup ── */}
      <div
        className={`lk-modal-scrim ${isHelpOpen ? 'active' : ''}`}
        id="helpModalScrim"
        onClick={() => setIsHelpOpen(false)}
      />
      <div
        className={`lk-modal ${isHelpOpen ? 'active' : ''}`}
        id="helpModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="helpModalTitle"
      >
        <div className="lk-modal-header">
          <div className="lk-modal-title-wrap">
            <div className="lk-modal-ic">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" height="20" width="20">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 id="helpModalTitle" className="lk-modal-title">Bantuan Akses Dasbor</h3>
          </div>
          <button
            type="button"
            className="lk-modal-close"
            onClick={() => setIsHelpOpen(false)}
            aria-label="Tutup"
          >
            &times;
          </button>
        </div>
        <div className="lk-modal-body">
          <div className="lk-help-card">
            <h4>Format Username / Akun</h4>
            <p>Gunakan <strong>Username</strong> atau <strong>Email</strong> resmi kru yang telah didaftarkan oleh Divisi SDM / Koordinator PTV.</p>
          </div>
          <div className="lk-help-card">
            <h4>Kata Sandi Resmi</h4>
            <p>Gunakan kata sandi resmi yang telah didaftarkan. Hubungi Koordinator Divisi atau Administrator jika Anda belum memiliki sandi.</p>
          </div>
          <div className="lk-help-card">
            <h4>Lupa Password / Belum Terdaftar?</h4>
            <p>Jika Anda belum memiliki akses atau mengalami kendala login, silakan hubungi Administrator PTV atau Koordinator Divisi Anda.</p>
          </div>
        </div>
        <div className="lk-modal-footer">
          <a
            href="https://wa.me/628123456789?text=Halo%20Admin%20PTV,%20saya%20butuh%20bantuan%20akses%20akun%20dasbor"
            target="_blank"
            rel="noopener noreferrer"
            className="lk-modal-btn pri"
          >
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="15" width="15">
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
            </svg>
            <span>Hubungi Admin</span>
          </a>
          <button
            type="button"
            className="lk-modal-btn sec"
            onClick={() => setIsHelpOpen(false)}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
