import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { LOCAL_DEV_MOCK_USERS } from '@core/auth';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [showDevAccounts, setShowDevAccounts] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isLoading, error } = useSessionStore();

  const redirectUrl = searchParams.get('redirect') || '/hub/beranda';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    const ok = await login({ identifier: identifier.trim(), password });
    if (ok) {
      navigate(redirectUrl, { replace: true });
    }
  };

  const handleQuickLogin = async (ptvId: string) => {
    setIdentifier(ptvId);
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
    <div className="login-viewport">
      {/* ── Photo Mosaic Background (PC & Mobile Responsive) ── */}
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
          href="https://progresiftv.id/verifikasi-identitas/"
          target="_blank"
          rel="noopener noreferrer"
          className="lk-navlink"
        >
          Verifikasi Kru
        </a>
        <button
          type="button"
          className="lk-navlink"
          onClick={() => setIsHelpModalOpen(true)}
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
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="lk-form" id="ptvLoginForm">
          <input
            type="text"
            className="lk-input"
            placeholder="Email / Username"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={isLoading}
          />

          <div className="lk-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              id="ptvPassInput"
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
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          <div className="lk-actions">
            <button
              type="button"
              className="lk-sublink"
              onClick={() => setIsHelpModalOpen(true)}
            >
              Bantuan Akses
            </button>
            <button
              type="submit"
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
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
            </svg>
            <span>Lanjutkan dengan Google</span>
          </button>
        </form>

        {/* ── Subtitle Dev Test Selector (Optional Toggle) ── */}
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
        className={`lk-modal-scrim ${isHelpModalOpen ? 'active' : ''}`}
        id="helpModalScrim"
        onClick={() => setIsHelpModalOpen(false)}
      />

      <div
        className={`lk-modal ${isHelpModalOpen ? 'active' : ''}`}
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
            <h3 id="helpModalTitle" className="lk-modal-title">
              Bantuan Akses Dasbor
            </h3>
          </div>
          <button
            type="button"
            className="lk-modal-close"
            onClick={() => setIsHelpModalOpen(false)}
            aria-label="Tutup"
          >
            &times;
          </button>
        </div>

        <div className="lk-modal-body">
          <div className="lk-help-card">
            <h4>Format Username / Akun</h4>
            <p>
              Gunakan <strong>Username</strong> atau <strong>Email</strong> resmi kru yang telah didaftarkan oleh Divisi SDM / Koordinator PTV.
            </p>
          </div>
          <div className="lk-help-card">
            <h4>Kata Sandi Resmi</h4>
            <p>
              Gunakan kata sandi resmi yang telah didaftarkan. Hubungi Koordinator Divisi atau Administrator jika Anda belum memiliki sandi.
            </p>
          </div>
          <div className="lk-help-card">
            <h4>Lupa Password / Belum Terdaftar?</h4>
            <p>
              Jika Anda belum memiliki akses atau mengalami kendala login, silakan hubungi Administrator PTV atau Koordinator Divisi Anda.
            </p>
          </div>
        </div>

        <div className="lk-modal-footer">
          <button
            type="button"
            className="lk-modal-btn pri"
            onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20Admin%20PTV,%20saya%20butuh%20bantuan%20akses%20dasbor', '_blank')}
          >
            Hubungi Admin
          </button>
          <button
            type="button"
            className="lk-modal-btn sec"
            onClick={() => setIsHelpModalOpen(false)}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
