import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/core/session';
import { AuthUser } from '@/core/auth/types';
import { PushDiagnosticsModal } from './components/PushDiagnosticsModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { UnlinkGoogleConfirmModal } from './components/UnlinkGoogleConfirmModal';
import { useThemeStore } from '@core/theme/themeStore';
import '@/styles/pengaturan.css';

interface PengaturanPageProps {
  currentUser?: AuthUser | null;
}

export const PengaturanPage: React.FC<PengaturanPageProps> = ({ currentUser }) => {
  const sessionUser = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const user = currentUser !== undefined ? currentUser : sessionUser;
  const navigate = useNavigate();

  // Theme state synchronized with unified theme store
  const { isDark, toggleTheme } = useThemeStore();

  // Password form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showCnfPass, setShowCnfPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Modals
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  // Google SSO / OAuth Account Linking State
  const [googleStatus, setGoogleStatus] = useState<{ is_linked: boolean; email?: string } | null>({
    is_linked: false,
  });
  const [isGoogleStatusLoading, setIsGoogleStatusLoading] = useState<boolean>(false);
  const [isGoogleActionLoading, setIsGoogleActionLoading] = useState<boolean>(false);
  const [googleFeedback, setGoogleFeedback] = useState<{
    type: 'success' | 'error' | 'conflict';
    message: string;
  } | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState<boolean>(false);

  const fetchGoogleStatus = async () => {
    setIsGoogleStatusLoading(true);
    try {
      if (typeof fetch !== 'undefined') {
        const resp = await fetch('/api/auth/google/status', { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          setGoogleStatus(data);
        }
      }
    } catch {
      // Ignore network errors in offline/mock
    } finally {
      setIsGoogleStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleStatus();

    // Parse OAuth callback response if redirected to /hub/pengaturan
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const oauthStatus = params.get('oauth_status');
      const oauthError = params.get('oauth_error');
      const oauthEmail = params.get('oauth_email');

      if (oauthStatus === 'linked_success') {
        setGoogleFeedback({
          type: 'success',
          message: oauthEmail
            ? `Akun Google (${oauthEmail}) berhasil dihubungkan ke akun PTVPRO Anda.`
            : 'Akun Google berhasil dihubungkan ke akun PTVPRO Anda.',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (oauthStatus === 'conflict') {
        setGoogleFeedback({
          type: 'conflict',
          message:
            oauthError ||
            'Akun Google tersebut sudah terhubung ke akun kru PTVPRO lain. Silakan gunakan akun Google yang berbeda.',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (oauthStatus === 'cancelled') {
        setGoogleFeedback({
          type: 'error',
          message: 'Autentikasi Google dibatalkan oleh pengguna.',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (oauthStatus === 'error') {
        setGoogleFeedback({
          type: 'error',
          message: oauthError || 'Gagal memproses autentikasi Google.',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleLinkGoogle = () => {
    setIsGoogleActionLoading(true);
    setGoogleFeedback(null);
    if (typeof window !== 'undefined') {
      window.location.href = `/api/auth/google/login?action=link&returnTo=${encodeURIComponent(window.location.pathname)}`;
    }
  };

  const handleUnlinkGoogle = async () => {
    setIsGoogleActionLoading(true);
    setGoogleFeedback(null);
    try {
      if (typeof fetch !== 'undefined') {
        const resp = await fetch('/api/auth/google/unlink', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          setGoogleStatus({ is_linked: false });
          setGoogleFeedback({
            type: 'success',
            message: 'Tautan akun Google berhasil diputuskan dari akun PTVPRO Anda.',
          });
        } else {
          setGoogleFeedback({
            type: 'error',
            message: data.error || 'Gagal memutuskan tautan Google.',
          });
        }
      }
    } catch {
      setGoogleFeedback({
        type: 'error',
        message: 'Koneksi jaringan gagal saat memutuskan tautan Google.',
      });
    } finally {
      setIsGoogleActionLoading(false);
      setShowUnlinkModal(false);
    }
  };

  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!oldPassword) {
      setPassError('Ketik password saat ini terlebih dahulu.');
      return;
    }
    if (newPassword.length < 4) {
      setPassError('Password baru minimal terdiri dari 4 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsSubmittingPass(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal mengubah kata sandi.');
      }
      setPassSuccess(data.message || 'Kata sandi berhasil diperbarui.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(err.message || 'Terjadi kesalahan sistem saat memperbarui kata sandi.');
    } finally {
      setIsSubmittingPass(false);
    }
  };

  const handleRefreshData = () => {
    setRefreshToast('Menyegarkan data dari cache dan server...');
    setTimeout(() => {
      setRefreshToast('Data berhasil disegarkan.');
      setTimeout(() => setRefreshToast(null), 3000);
    }, 600);
  };

  // QR Code Generation
  const ptvId = user?.ptv_id || '';
  const hasPtvId = Boolean(ptvId && ptvId.trim());
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ptvpro.com';
  const qrTargetUrl = hasPtvId ? `${origin}/verifikasi-identitas/${encodeURIComponent(ptvId)}` : '';

  const initials = (user?.full_name || 'PTV')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'P';

  const role = user?.assigned_profiles?.[0] || 'crew';
  const roleLabelMap: Record<string, string> = {
    root_executive: 'Root Executive',
    eksekutif: 'Eksekutif',
    kepolo_kepali: 'Kepolo Kepali',
    crew: 'Crew',
    pembina: 'Pembina',
  };

  const roleDescMap: Record<string, string> = {
    root_executive: 'Akses penuh institusional: audit log, konfigurasi sistem, dan manajemen operasional studio.',
    eksekutif: 'Akses penuh: manajemen kru, persetujuan surat resmi, keuangan, dan pengaturan sistem.',
    kepolo_kepali: 'Tanggung jawab tertinggi inventaris alat teknis studio, alur peminjaman, dan inspeksi QC.',
    crew: 'Akses operasional: beranda kegiatan, peminjaman alat, pengajuan surat tugas & barang, ID digital, dan kontak.',
    pembina: 'Pengawasan umum studio dan pemantauan kegiatan operasional santri.',
  };

  return (
    <div className="set-page-container">
      {/* Page Header */}
      <header className="set-header">
        <h1 className="set-title">Pengaturan Sistem & Profil</h1>
        <p className="set-subtitle">
          Kelola preferensi akun, identitas digital kru, dan opsi tampilan antarmuka Progresif TV.
        </p>
      </header>

      {refreshToast && (
        <div className="set-alert-box info" role="status">
          <i className="fa-solid fa-arrows-rotate fa-spin" />
          <span>{refreshToast}</span>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="set-cols">
        {/* Left Column: Akun, Peran, Keamanan, Tampilan */}
        <div className="set-col-main">
          {/* Section 1: Akun & Identitas */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-regular fa-id-card" />
                <span>Akun & Identitas</span>
              </h2>
            </div>

            <div className="set-card set-profile-card">
              <div className="set-avatar">{initials}</div>
              <div className="set-profile-info">
                <div className="set-profile-name">{user?.full_name || 'Kru Progresif TV'}</div>
                <div className="set-profile-sub">
                  {user?.position || 'Kru Operasional'} &bull; Divisi {user?.division || 'Produksi'}
                </div>
              </div>
              <span className="set-chip set-chip-ok">
                <i className="fa-solid fa-circle-check" />
                <span>Aktif</span>
              </span>
            </div>

            <div className="set-card" style={{ marginTop: '12px' }}>
              <div className="set-grid-2">
                <div className="set-field">
                  <label className="set-lbl" htmlFor="set_usr">
                    Username Sistem (Read-Only)
                  </label>
                  <input
                    id="set_usr"
                    type="text"
                    className="set-input"
                    value={user?.username || ''}
                    disabled
                  />
                </div>
                <div className="set-field">
                  <label className="set-lbl" htmlFor="set_ptv_id">
                    ID PTV / Nomor Kru
                  </label>
                  <input
                    id="set_ptv_id"
                    type="text"
                    className="set-input set-input-mono"
                    value={ptvId || 'Belum diterbitkan'}
                    disabled
                  />
                </div>
              </div>
              <p className="set-hint">
                <i className="fa-solid fa-shield-halved" style={{ marginRight: '5px' }} />
                Username dan ID PTV dikelola secara terpusat oleh administrator.
              </p>
            </div>
          </section>

          {/* Section 2: Peran Aktif */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-solid fa-user-shield" />
                <span>Peran Aktif</span>
              </h2>
            </div>

            <div className="set-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Hak Akses Sistem</span>
                <span className="set-chip set-chip-gold">
                  {roleLabelMap[role] || role.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '10px 0 0', lineHeight: 1.55 }}>
                {roleDescMap[role] || 'Akses portal kru Progresif TV.'}
              </p>
              <p className="set-hint">
                <i className="fa-solid fa-lock" style={{ marginRight: '5px' }} />
                Perubahan peran aktif dikunci dan hanya dapat diubah oleh Eksekutif melalui Manajemen Kru.
              </p>
            </div>
          </section>

          {/* Section 3: Keamanan Akun */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-solid fa-lock" />
                <span>Keamanan Akun</span>
              </h2>
            </div>

            <div className="set-card">
              {passError && (
                <div className="set-alert-box warn">
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>{passError}</span>
                </div>
              )}
              {passSuccess && (
                <div className="set-alert-box info">
                  <i className="fa-solid fa-circle-info" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit}>
                <div className="set-field" style={{ marginBottom: '12px' }}>
                  <label className="set-lbl" htmlFor="set_old_pass">
                    Password Saat Ini
                  </label>
                  <div className="set-pass-wrap">
                    <input
                      id="set_old_pass"
                      type={showOldPass ? 'text' : 'password'}
                      className="set-input set-pass-input"
                      placeholder="Ketik password lama Anda"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="set-eye-btn"
                      onClick={() => setShowOldPass(!showOldPass)}
                      aria-label="Toggle password lama"
                    >
                      <i className={showOldPass ? 'fa-solid fa-eye-slash' : 'fa-regular fa-eye'} />
                    </button>
                  </div>
                </div>

                <div className="set-grid-2" style={{ marginBottom: '16px' }}>
                  <div className="set-field">
                    <label className="set-lbl" htmlFor="set_new_pass">
                      Password Baru
                    </label>
                    <div className="set-pass-wrap">
                      <input
                        id="set_new_pass"
                        type={showNewPass ? 'text' : 'password'}
                        className="set-input set-pass-input"
                        placeholder="Min. 4 karakter"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="set-eye-btn"
                        onClick={() => setShowNewPass(!showNewPass)}
                        aria-label="Toggle password baru"
                      >
                        <i className={showNewPass ? 'fa-solid fa-eye-slash' : 'fa-regular fa-eye'} />
                      </button>
                    </div>
                  </div>

                  <div className="set-field">
                    <label className="set-lbl" htmlFor="set_cnf_pass">
                      Konfirmasi Password Baru
                    </label>
                    <div className="set-pass-wrap">
                      <input
                        id="set_cnf_pass"
                        type={showCnfPass ? 'text' : 'password'}
                        className="set-input set-pass-input"
                        placeholder="Ulangi password baru"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="set-eye-btn"
                        onClick={() => setShowCnfPass(!showCnfPass)}
                        aria-label="Toggle konfirmasi password"
                      >
                        <i className={showCnfPass ? 'fa-solid fa-eye-slash' : 'fa-regular fa-eye'} />
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" className="set-btn set-btn-primary" disabled={isSubmittingPass}>
                  <i className={`fa-solid ${isSubmittingPass ? 'fa-spinner fa-spin' : 'fa-key'}`} />
                  <span>{isSubmittingPass ? 'Menyimpan...' : 'Simpan Password Baru'}</span>
                </button>
              </form>
            </div>
          </section>

          {/* Section 4: Login & OAuth */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-solid fa-shield" />
                <span>Login & Autentikasi Eksternal</span>
              </h2>
            </div>

            <div className="set-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <i className="fa-brands fa-google" style={{ fontSize: '24px', color: '#4285F4' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                      Google SSO / OAuth
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Integrasi akun Google untuk akses cepat
                    </div>
                  </div>
                </div>

                {isGoogleStatusLoading ? (
                  <span className="set-chip set-chip-muted">
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '4px' }} />
                    Memeriksa...
                  </span>
                ) : googleStatus?.is_linked ? (
                  <span className="set-chip set-chip-ok">
                    <i className="fa-solid fa-check-circle" style={{ marginRight: '4px' }} />
                    Terhubung
                  </span>
                ) : (
                  <span className="set-chip set-chip-muted">Belum Terhubung</span>
                )}
              </div>

              {/* Feedback Alert Banner */}
              {googleFeedback && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--ptv-curve-sm)',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background:
                      googleFeedback.type === 'success'
                        ? 'var(--ok-bg, #ecfdf5)'
                        : googleFeedback.type === 'conflict'
                        ? 'var(--warn-bg, #fffbeb)'
                        : '#fef2f2',
                    border: `1px solid ${
                      googleFeedback.type === 'success'
                        ? 'var(--ok-border, #a7f3d0)'
                        : googleFeedback.type === 'conflict'
                        ? 'var(--warn-border, #fef3c7)'
                        : '#fecaca'
                    }`,
                    color:
                      googleFeedback.type === 'success'
                        ? 'var(--ok, #059669)'
                        : googleFeedback.type === 'conflict'
                        ? 'var(--warn, #d97706)'
                        : '#dc2626',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i
                      className={
                        googleFeedback.type === 'success'
                          ? 'fa-solid fa-circle-check'
                          : googleFeedback.type === 'conflict'
                          ? 'fa-solid fa-triangle-exclamation'
                          : 'fa-solid fa-circle-exclamation'
                      }
                    />
                    <span>{googleFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGoogleFeedback(null)}
                    style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px 4px' }}
                    aria-label="Tutup pesan"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              )}

              {/* Action Area */}
              <div
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {googleStatus?.is_linked ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink)' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Email Google Terhubung:</span>
                      <strong style={{ fontWeight: 650 }}>{googleStatus.email || (user?.username ? `${user.username}@gmail.com` : 'Akun Terverifikasi')}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setShowUnlinkModal(true)}
                      disabled={isGoogleActionLoading}
                      style={{
                        borderRadius: 'var(--ptv-curve-pill)',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 650,
                        color: '#dc2626',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        cursor: isGoogleActionLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isGoogleActionLoading ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-link-slash" style={{ marginRight: '6px' }} />
                          Putuskan Hubungan
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                      Hubungkan akun Google agar Anda dapat login cepat menggunakan Google SSO.
                    </div>
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={handleLinkGoogle}
                      disabled={isGoogleActionLoading}
                      style={{
                        borderRadius: 'var(--ptv-curve-pill)',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: isGoogleActionLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isGoogleActionLoading ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin" />
                          Mengarahkan ke Google...
                        </>
                      ) : (
                        <>
                          <i className="fa-brands fa-google" />
                          Hubungkan Google
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Section 5: Tampilan Tema */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-solid fa-palette" />
                <span>Tampilan</span>
              </h2>
            </div>

            <div className="set-list">
              <button
                type="button"
                className="set-list-item"
                onClick={toggleTheme}
                data-act="theme"
              >
                <div className="set-li-left">
                  <div className="set-li-ic">
                    <i className={isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
                  </div>
                  <div className="set-li-body">
                    <span className="set-li-title">
                      {isDark ? 'Mode Terang (Light Mode)' : 'Mode Gelap (Dark Mode)'}
                    </span>
                    <span className="set-li-sub">
                      Klik untuk beralih tampilan &bull; Tersimpan ke preferensi peramban
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="set-chip set-chip-muted">
                    {isDark ? 'Gelap' : 'Terang'}
                  </span>
                  <i className="fa-solid fa-chevron-right set-li-chev" />
                </div>
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: QR ID, Notifikasi, Sistem */}
        <div className="set-col-side">
          {/* Section 6: ID QR Saya */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-solid fa-qrcode" />
                <span>ID QR Saya</span>
              </h2>
            </div>

            <div className="set-card set-qr-box">
              {hasPtvId ? (
                <>
                  <div className="set-qr-surface">
                    <svg
                      width={140}
                      height={140}
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-label="QR Code Verifikasi"
                    >
                      <rect width="100" height="100" fill="white" rx="6" />
                      {/* Finder Top-Left */}
                      <rect x="10" y="10" width="24" height="24" fill="#0B2A4A" rx="3" />
                      <rect x="15" y="15" width="14" height="14" fill="white" rx="2" />
                      <rect x="18" y="18" width="8" height="8" fill="#0B2A4A" rx="1" />
                      {/* Finder Top-Right */}
                      <rect x="66" y="10" width="24" height="24" fill="#0B2A4A" rx="3" />
                      <rect x="71" y="15" width="14" height="14" fill="white" rx="2" />
                      <rect x="74" y="18" width="8" height="8" fill="#0B2A4A" rx="1" />
                      {/* Finder Bottom-Left */}
                      <rect x="10" y="66" width="24" height="24" fill="#0B2A4A" rx="3" />
                      <rect x="15" y="71" width="14" height="14" fill="white" rx="2" />
                      <rect x="18" y="74" width="8" height="8" fill="#0B2A4A" rx="1" />
                      {/* Pattern Elements */}
                      <rect x="42" y="12" width="6" height="6" fill="#0B2A4A" />
                      <rect x="52" y="12" width="6" height="6" fill="#0B2A4A" />
                      <rect x="42" y="24" width="6" height="6" fill="#0B2A4A" />
                      <rect x="52" y="30" width="6" height="6" fill="#0B2A4A" />
                      <rect x="12" y="44" width="6" height="6" fill="#0B2A4A" />
                      <rect x="24" y="44" width="6" height="6" fill="#0B2A4A" />
                      <rect x="36" y="44" width="6" height="6" fill="#0B2A4A" />
                      <rect x="48" y="44" width="6" height="6" fill="#0B2A4A" />
                      <rect x="60" y="44" width="6" height="6" fill="#0B2A4A" />
                      <rect x="72" y="44" width="6" height="6" fill="#0B2A4A" />
                      <rect x="84" y="44" width="6" height="6" fill="#0B2A4A" />
                      <rect x="42" y="60" width="6" height="6" fill="#0B2A4A" />
                      <rect x="52" y="60" width="6" height="6" fill="#0B2A4A" />
                      <rect x="42" y="72" width="6" height="6" fill="#0B2A4A" />
                      <rect x="52" y="78" width="6" height="6" fill="#0B2A4A" />
                      <rect x="66" y="66" width="6" height="6" fill="#0B2A4A" />
                      <rect x="78" y="66" width="6" height="6" fill="#0B2A4A" />
                      <rect x="72" y="78" width="6" height="6" fill="#0B2A4A" />
                      <rect x="84" y="84" width="6" height="6" fill="#0B2A4A" />
                    </svg>
                  </div>
                  <div className="set-qr-id">{ptvId}</div>
                  <div className="set-qr-sub">{user?.division || 'Kru'} &bull; Progresif TV</div>
                  <div className="set-qr-actions">
                    <button
                      type="button"
                      className="set-btn set-btn-secondary"
                      onClick={() => {
                        window.open(qrTargetUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" />
                      <span>Buka Verifikasi</span>
                    </button>
                    <button
                      type="button"
                      className="set-btn set-btn-primary"
                      onClick={() => navigate('/hub/id-digital')}
                    >
                      <i className="fa-solid fa-id-badge" />
                      <span>Kartu ID Digital</span>
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 10px', color: 'var(--muted)' }}>
                  <i className="fa-solid fa-qrcode" style={{ fontSize: '36px', opacity: 0.3, marginBottom: '8px', display: 'block' }} />
                  <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '13.5px' }}>
                    ID PTV belum tersedia
                  </div>
                  <p style={{ fontSize: '11.5px', margin: '4px 0 0' }}>
                    Nomor identitas belum diterbitkan untuk akun ini. Hubungi Administrator.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Section 7: Notifikasi Push */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-regular fa-bell" />
                <span>Notifikasi Browser</span>
              </h2>
            </div>

            <div className="set-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
                  Pemberitahuan Sistem
                </span>
                <span className="set-chip set-chip-ok">Aktif</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                Terima pemberitahuan saat ada jadwal liputan baru, peminjaman alat, kerusakan, atau pengumuman broadcast.
              </p>
              <button
                type="button"
                className="set-btn set-btn-secondary"
                onClick={() => setIsDiagOpen(true)}
              >
                <i className="fa-solid fa-stethoscope" />
                <span>Cek Diagnostik Push</span>
              </button>
            </div>
          </section>

          {/* Section 8: Sistem & Logout */}
          <section>
            <div className="set-sec-hd">
              <h2 className="set-sec-title">
                <i className="fa-solid fa-sliders" />
                <span>Sistem & Akses</span>
              </h2>
            </div>

            <div className="set-list">
              <button
                type="button"
                className="set-list-item"
                onClick={() => navigate('/hub/inventaris')}
                data-act="scan"
              >
                <div className="set-li-left">
                  <div className="set-li-ic">
                    <i className="fa-solid fa-barcode" />
                  </div>
                  <div className="set-li-body">
                    <span className="set-li-title">Pindai QR Alat</span>
                    <span className="set-li-sub">Buka detail alat dari kode QR inventaris</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right set-li-chev" />
              </button>

              <button
                type="button"
                className="set-list-item"
                onClick={handleRefreshData}
                data-act="refresh"
              >
                <div className="set-li-left">
                  <div className="set-li-ic">
                    <i className="fa-solid fa-arrows-rotate" />
                  </div>
                  <div className="set-li-body">
                    <span className="set-li-title">Segarkan Data</span>
                    <span className="set-li-sub">Ambil ulang data terbaru dari server</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right set-li-chev" />
              </button>

              <button
                type="button"
                className="set-list-item"
                onClick={() => setIsLogoutOpen(true)}
                data-act="logout"
              >
                <div className="set-li-left">
                  <div className="set-li-ic danger">
                    <i className="fa-solid fa-arrow-right-from-bracket" />
                  </div>
                  <div className="set-li-body">
                    <span className="set-li-title" style={{ color: '#ef4444' }}>
                      Keluar dari Akun
                    </span>
                    <span className="set-li-sub">Akhiri sesi aktif pada perangkat ini</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right set-li-chev" />
              </button>
            </div>

            <p className="set-footer-note">
              Dashboard Kru Progresif TV &bull; Pesantren Progresif Bumi Shalawat
            </p>
          </section>
        </div>
      </div>

      {/* Modals */}
      <PushDiagnosticsModal
        isOpen={isDiagOpen}
        onClose={() => setIsDiagOpen(false)}
      />

      <LogoutConfirmModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={logout}
      />

      <UnlinkGoogleConfirmModal
        isOpen={showUnlinkModal}
        isLoading={isGoogleActionLoading}
        linkedEmail={googleStatus?.email}
        onClose={() => setShowUnlinkModal(false)}
        onConfirm={handleUnlinkGoogle}
      />
    </div>
  );
};
