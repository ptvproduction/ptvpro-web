import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, UserX, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { AuthSplashScreen } from '@shared/components';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import {
  LOCAL_DEV_MOCK_USERS,
  getSafeInternalDestination,
  storeIntendedDestination,
} from '@core/auth';

type FeedbackModalType =
  | 'success'
  | 'unlinked'
  | 'access_denied'
  | 'cancelled'
  | 'state_error'
  | 'error';

interface FeedbackModalState {
  type: FeedbackModalType;
  returnTo?: string;
  devSub?: string;
}

function parseFeedbackFromQuery(search: string): FeedbackModalState | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const statusParam = params.get('auth_status') as FeedbackModalType | null;
  const authErr = params.get('auth_error');
  const returnToParam = params.get('returnTo');
  const devSubParam = params.get('dev_sub');

  if (statusParam) {
    return {
      type: statusParam,
      returnTo: returnToParam ? getSafeInternalDestination(returnToParam) : undefined,
      devSub: devSubParam || undefined,
    };
  }
  if (authErr) {
    return {
      type: 'error',
    };
  }
  return null;
}

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const userFromHook = useSessionStore((s) => s.user);
  const user = userFromHook || session?.user || useSessionStore.getState().user || useSessionStore.getState().session?.user;
  const isLoadingHook = useSessionStore((s) => s.isLoading);
  const isLoading = typeof window === 'undefined' ? useSessionStore.getState().isLoading : isLoadingHook;
  const error = useSessionStore((s) => s.error);
  const login = useSessionStore((s) => s.login);
  const loginWithOAuth = useSessionStore((s) => s.loginWithOAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showDevAccounts, setShowDevAccounts] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState | null>(() =>
    parseFeedbackFromQuery(location.search)
  );
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const helpModalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: isHelpOpen,
    onClose: () => setIsHelpOpen(false),
    modalRef: helpModalRef,
    id: 'login-help-modal',
  });

  // Kebijakan Clean Login URL & Aktivasi Auth Feedback Modal
  useEffect(() => {
    if (location.search) {
      const params = new URLSearchParams(location.search);
      const statusParam = params.get('auth_status') as FeedbackModalType | null;
      const authErr = params.get('auth_error');
      const returnToParam = params.get('returnTo');
      const devSubParam = params.get('dev_sub');

      if (statusParam) {
        setFeedbackModal({
          type: statusParam,
          returnTo: returnToParam ? getSafeInternalDestination(returnToParam) : undefined,
          devSub: devSubParam || undefined,
        });
      } else if (authErr) {
        // Fallback jika hanya query auth_error lama tanpa auth_status eksplisit
        setFeedbackModal({
          type: 'error',
        });
      }

      // Bersihkan parameter query dari address bar agar URL tetap bersih
      navigate('/hub/login', { replace: true, state: location.state });
    }
  }, [location.search, location.state, navigate]);

  // Ekstrak intended return target dari React Router navigation state atau modal returnTo
  const state = location.state as { returnTo?: string; from?: { pathname: string; search?: string } } | null;
  const rawTarget =
    feedbackModal?.returnTo ||
    state?.returnTo ||
    (state?.from
      ? typeof state.from === 'string'
        ? state.from
        : `${state.from.pathname}${state.from.search || ''}`
      : null);
  const safeRedirectUrl = getSafeInternalDestination(rawTarget);

  // Auto-redirect jika sudah memiliki sesi aktif, KECUALI jika modal sukses sedang ditampilkan
  useEffect(() => {
    if (feedbackModal?.type === 'success') {
      return;
    }
    if (session && user) {
      navigate(safeRedirectUrl, { replace: true });
    }
  }, [session, user, navigate, safeRedirectUrl, feedbackModal]);

  // Keyboard accessibility (Escape key handler & Focus Trap pada tombol utama)
  useEffect(() => {
    if (feedbackModal) {
      const timer = setTimeout(() => {
        primaryBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (feedbackModal.type === 'success') {
            navigate(safeRedirectUrl, { replace: true });
          } else {
            setFeedbackModal(null);
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [feedbackModal, navigate, safeRedirectUrl]);

  const handleCloseFeedback = () => {
    if (feedbackModal?.type === 'success') {
      navigate(safeRedirectUrl, { replace: true });
    } else {
      setFeedbackModal(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const ok = await login({ identifier: username.trim(), password });
    if (ok) {
      navigate(safeRedirectUrl, { replace: true });
    }
  };

  const handleQuickLogin = async (ptvId: string) => {
    setUsername(ptvId);
    setPassword('demopass123');
    const ok = await login({ identifier: ptvId });
    if (ok) {
      navigate(safeRedirectUrl, { replace: true });
    }
  };

  const handleGoogleLogin = async () => {
    const authBackend = import.meta.env.VITE_AUTH_BACKEND;
    if (authBackend === 'mock') {
      alert('Mode Development: Google OAuth login diarahkan ke akun resmi kru yang terdaftar di database.');
      return;
    }

    setIsGoogleLoading(true);
    try {
      storeIntendedDestination(safeRedirectUrl);
      if (authBackend === 'vercel' || authBackend === 'native') {
        await loginWithOAuth({
          provider: 'google',
          redirectTo: safeRedirectUrl,
        });
        return;
      }

      const origin = window.location.origin;
      const redirectTo = `${origin}/hub/auth/callback`;
      await loginWithOAuth({
        provider: 'google',
        redirectTo,
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isDirectVercelAuth =
    import.meta.env.VITE_AUTH_BACKEND === 'vercel' || import.meta.env.VITE_AUTH_BACKEND === 'native';
  const isSupabaseAuth = import.meta.env.VITE_AUTH_BACKEND === 'supabase';
  const isProductionAuth = isSupabaseAuth || isDirectVercelAuth;

  if (isLoading && !feedbackModal) {
    return <AuthSplashScreen />;
  }

  return (
    <div
      className="login-page-root"
      style={{
        width: '100vw',
        minHeight: '100dvh',
        background: '#061A36',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:
          'max(20px, env(safe-area-inset-top, 20px)) max(18px, env(safe-area-inset-right, 18px)) max(20px, env(safe-area-inset-bottom, 20px)) max(18px, env(safe-area-inset-left, 18px))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
            id="ptvUserInput"
            type={isSupabaseAuth ? 'email' : 'text'}
            name="ptv_user"
            className="lk-input"
            placeholder={isSupabaseAuth ? 'Email Akun Supabase' : 'Email / Username'}
            required
            autoComplete={isSupabaseAuth ? 'email' : 'username'}
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
              placeholder={isSupabaseAuth ? 'Kata Sandi Akun Supabase' : 'Password'}
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
            disabled={isLoading || isGoogleLoading}
            aria-busy={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span className="lk-spinner" />
                <span>Menghubungkan ke Google...</span>
              </span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                </svg>
                <span>Lanjutkan dengan Google</span>
              </>
            )}
          </button>
        </form>

        {/* ── Subtitle Dev Test Selector (Hanya tampil pada mode local/mock) ── */}
        {!isProductionAuth && (
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
                  borderRadius: 'var(--ptv-curve-lg)',
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
                      borderRadius: 'var(--ptv-curve-sm)',
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
        )}
      </main>

      {/* ── Auth Feedback Modal Popup (Google OAuth & Policy Feedback) ── */}
      {feedbackModal && (
        <>
          <div
            className="lk-modal-scrim active"
            id="authFeedbackModalScrim"
            onClick={handleCloseFeedback}
          />
          <div
            className="lk-modal active"
            id="authFeedbackModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedbackModalTitle"
            tabIndex={-1}
          >
            <div className="lk-modal-header">
              <div className="lk-modal-title-wrap">
                {feedbackModal.type === 'success' && (
                  <div className="lk-modal-ic success">
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                  </div>
                )}
                {feedbackModal.type === 'unlinked' && (
                  <div className="lk-modal-ic danger">
                    <UserX size={20} strokeWidth={2.5} />
                  </div>
                )}
                {feedbackModal.type === 'access_denied' && (
                  <div className="lk-modal-ic warning">
                    <ShieldAlert size={20} strokeWidth={2.5} />
                  </div>
                )}
                {(feedbackModal.type === 'cancelled' ||
                  feedbackModal.type === 'state_error' ||
                  feedbackModal.type === 'error') && (
                  <div className="lk-modal-ic error">
                    <AlertTriangle size={20} strokeWidth={2.5} />
                  </div>
                )}
                <h3 id="feedbackModalTitle" className="lk-modal-title">
                  {feedbackModal.type === 'success' && 'Login Berhasil!'}
                  {feedbackModal.type === 'unlinked' && 'Akun Belum Terdaftar'}
                  {feedbackModal.type === 'access_denied' && 'Akses Ditolak'}
                  {feedbackModal.type === 'cancelled' && 'Login Dibatalkan'}
                  {feedbackModal.type === 'state_error' && 'Sesi Tidak Valid'}
                  {feedbackModal.type === 'error' && 'Gagal Masuk'}
                </h3>
              </div>
              <button
                type="button"
                className="lk-modal-close"
                onClick={handleCloseFeedback}
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>

            <div className="lk-modal-body">
              <p className="lk-modal-desc">
                {feedbackModal.type === 'success' && 'Selamat datang kembali di PTV Hub.'}
                {feedbackModal.type === 'unlinked' &&
                  'Akun Google ini belum terhubung dengan akun resmi Progresif TV. Silakan hubungi pengelola PTV untuk mendapatkan akses.'}
                {feedbackModal.type === 'access_denied' &&
                  'Akun Google Anda berhasil diverifikasi, tetapi akun PTVPRO ini belum memiliki izin mengakses PTV Hub.'}
                {feedbackModal.type === 'cancelled' &&
                  'Autentikasi akun Google telah dibatalkan oleh pengguna.'}
                {feedbackModal.type === 'state_error' &&
                  'Sesi autentikasi telah kedaluwarsa atau verifikasi keamanan tidak cocok demi keamanan akun Anda. Silakan coba login kembali.'}
                {feedbackModal.type === 'error' &&
                  'Terjadi kesalahan saat memproses autentikasi Google. Silakan coba beberapa saat lagi.'}
              </p>

              {/* Verified User Identity Card (Success State) */}
              {feedbackModal.type === 'success' && user && (
                <div className="lk-verified-user-card">
                  <div>
                    <div className="lk-verified-user-name">
                      {user.full_name || user.username}
                    </div>
                    <div className="lk-verified-user-sub">
                      {user.division ? `${user.division} • ${user.position || 'Kru'}` : user.username}
                    </div>
                  </div>
                  <span className="lk-verified-user-badge">
                    <CheckCircle2 size={12} strokeWidth={3} />
                    {user.ptv_id || 'PTV KRU'}
                  </span>
                </div>
              )}

              {/* Staging Dev-Only Subject ID Details (Never visible in Production) */}
              {feedbackModal.type === 'unlinked' && import.meta.env.DEV && feedbackModal.devSub && (
                <details className="lk-modal-dev-info">
                  <summary>Detail Penautan Akun (Staging Dev Only)</summary>
                  <div>
                    Google Subject ID:
                    <code>{feedbackModal.devSub}</code>
                  </div>
                </details>
              )}
            </div>

            <div className="lk-modal-footer">
              {feedbackModal.type === 'success' ? (
                <button
                  type="button"
                  ref={primaryBtnRef}
                  className="lk-modal-btn lk-modal-btn-pri pri"
                  onClick={() => navigate(safeRedirectUrl, { replace: true })}
                >
                  <span>Masuk ke Dashboard</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    ref={primaryBtnRef}
                    className="lk-modal-btn lk-modal-btn-pri pri"
                    onClick={() => {
                      setFeedbackModal(null);
                      handleGoogleLogin();
                    }}
                  >
                    <span>
                      {feedbackModal.type === 'unlinked' && 'Coba Akun Google Lain'}
                      {feedbackModal.type === 'access_denied' && 'Gunakan Akun Lain'}
                      {(feedbackModal.type === 'cancelled' ||
                        feedbackModal.type === 'state_error' ||
                        feedbackModal.type === 'error') &&
                        'Coba Lagi'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="lk-modal-btn lk-modal-btn-sec sec"
                    onClick={() => setFeedbackModal(null)}
                  >
                    <span>Tutup</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Help Modal Popup ── */}
      <div
        className={`lk-modal-scrim ${isHelpOpen ? 'active' : ''}`}
        id="helpModalScrim"
        onClick={() => setIsHelpOpen(false)}
      />
      <div
        className={`lk-modal ${isHelpOpen ? 'active' : ''}`}
        ref={helpModalRef}
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
            <h4>{isSupabaseAuth ? 'Format Akun Supabase' : 'Format Username / Akun'}</h4>
            <p>
              {isSupabaseAuth
                ? 'Gunakan Email dan Kata Sandi akun Supabase Auth yang terdaftar dan tertaut di database staging.'
                : 'Gunakan Username atau Email resmi kru yang telah didaftarkan oleh Divisi SDM / Koordinator PTV.'}
            </p>
          </div>
          <div className="lk-help-card">
            <h4>{isSupabaseAuth ? 'Kata Sandi Supabase Auth' : 'Kata Sandi Resmi'}</h4>
            <p>
              {isSupabaseAuth
                ? 'Gunakan kata sandi yang Anda tentukan saat pembuatan akun di panel Authentication Supabase.'
                : 'Gunakan kata sandi resmi yang telah didaftarkan. Hubungi Koordinator Divisi atau Administrator jika Anda belum memiliki sandi.'}
            </p>
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
            className="lk-modal-btn lk-modal-btn-pri pri"
          >
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="15" width="15">
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
            </svg>
            <span>Hubungi Admin</span>
          </a>
          <button
            type="button"
            className="lk-modal-btn lk-modal-btn-sec sec"
            onClick={() => setIsHelpOpen(false)}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
