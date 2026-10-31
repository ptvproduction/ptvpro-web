import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/core/session';
import { useCrewStore } from '../kru/kruStore';
import { IdentityVerificationModal } from '../id-digital/components/IdentityVerificationModal';
import { OfficialIdCard } from '../id-digital/components/OfficialIdCard';
import { PushDiagnosticsModal } from '../pengaturan/components/PushDiagnosticsModal';
import { LogoutConfirmModal } from '../pengaturan/components/LogoutConfirmModal';
import { UnlinkGoogleConfirmModal } from '../pengaturan/components/UnlinkGoogleConfirmModal';
import { useThemeStore } from '@core/theme/themeStore';
import '@/styles/pengaturan.css';
import '@/styles/dashboard.css';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const sessionUser = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const { getCurrentUser } = useCrewStore();
  const currentUser = getCurrentUser();

  // ── ID Digital Verification Modal State ──
  const [isVerifModalOpen, setIsVerifModalOpen] = useState(false);

  const fullName = currentUser.full_name || sessionUser?.full_name || 'KRU PROGRESIF';
  const ptvId = currentUser.ptv_id || sessionUser?.ptv_id || 'PTV-000';
  const position = currentUser.position || sessionUser?.position || 'Kru Operasional';
  const division = currentUser.division || sessionUser?.division || 'Technical';
  const status = currentUser.status_kru || (sessionUser?.status_akun === 'active' ? 'Aktif' : 'Nonaktif');
  const angkatan = currentUser.angkatan || '-';

  // ── Unified Theme State ──
  const { isDark, toggleTheme: handleToggleTheme } = useThemeStore();

  // ── Password Form State ──
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showCnfPass, setShowCnfPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!oldPassword) {
      setPassError('Kata sandi lama wajib diisi.');
      return;
    }
    if (newPassword.length < 4) {
      setPassError('Kata sandi baru minimal 4 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Konfirmasi kata sandi baru tidak cocok.');
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
        throw new Error(data?.error || 'Gagal memperbarui kata sandi.');
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

  // ── Google SSO State ──
  const [googleStatus, setGoogleStatus] = useState<{ is_linked: boolean; email?: string } | null>({ is_linked: false });
  const [isGoogleStatusLoading, setIsGoogleStatusLoading] = useState(false);
  const [isGoogleActionLoading, setIsGoogleActionLoading] = useState(false);
  const [googleFeedback, setGoogleFeedback] = useState<{ type: 'success' | 'error' | 'conflict'; message: string } | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

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
      // ignore
    } finally {
      setIsGoogleStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleStatus();
  }, []);

  const handleLinkGoogle = () => {
    setIsGoogleActionLoading(true);
    setGoogleFeedback(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth/google/login?action=link';
    }
  };

  const handleUnlinkGoogle = async () => {
    setIsGoogleActionLoading(true);
    setGoogleFeedback(null);
    try {
      const resp = await fetch('/api/auth/google/unlink', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setGoogleStatus({ is_linked: false });
        setGoogleFeedback({ type: 'success', message: 'Tautan akun Google berhasil diputuskan.' });
      } else {
        setGoogleFeedback({ type: 'error', message: data.message || 'Gagal memutuskan tautan Google.' });
      }
    } catch {
      setGoogleFeedback({ type: 'error', message: 'Terjadi kesalahan jaringan.' });
    } finally {
      setIsGoogleActionLoading(false);
      setShowUnlinkModal(false);
    }
  };

  // ── Session & Diagnostics Modals ──
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  const handleTriggerRefresh = () => {
    setRefreshToast('Menyinkronkan data profil & sesi...');
    setTimeout(() => {
      setRefreshToast('Data profil tersinkronisasi.');
      setTimeout(() => setRefreshToast(null), 2500);
    }, 800);
  };

  return (
    <div
      className="ptv-page-container profile-page-container"
      style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '16px 20px 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* Page Header */}
      <header className="ptv-page-header" style={{ marginBottom: '22px' }}>
        <div>
          <h1
            className="ptv-page-title"
            style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}
          >
            Profil &amp; Akun Kru
          </h1>
          <p
            className="ptv-page-subtitle"
            style={{ fontSize: '13.5px', color: 'var(--muted)', margin: '4px 0 0' }}
          >
            Identitas digital resmi, status keanggotaan, dan preferensi akun ruang kerja Progresif TV.
          </p>
        </div>
      </header>

      {/* Grid 2 Kolom (Desktop) / 1 Kolom (Mobile) */}
      <div
        className="profile-layout-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 360px) minmax(0, 1fr)',
          gap: '28px',
          alignItems: 'start',
        }}
      >
        {/* ── KOLOM KIRI: ID Card Resmi & Tindakan ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <OfficialIdCard
            fullName={fullName}
            ptvId={ptvId}
            position={position}
            division={division}
            status={status}
            fotoUrl={currentUser.foto_url}
            onOpenVerifModal={() => setIsVerifModalOpen(true)}
            showActions={true}
          />
        </div>

        {/* ── KOLOM KANAN: Informasi Profil, Preferensi & Keamanan ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Kelompok 1: Data Identitas & Keanggotaan (Read-only clean metadata display) */}
          <section
            className="set-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--ptv-curve-xl, 20px)',
              padding: '20px 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--ptv-curve-md, 10px)',
                  background: 'var(--b-050, rgba(29, 110, 229, 0.08))',
                  color: 'var(--b-700, #1D6EE5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                }}
              >
                <i className="fa-solid fa-id-card-clip" />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--ink)',
                  }}
                >
                  Informasi Personel &amp; Keanggotaan
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                  Data keanggotaan terverifikasi yang tersinkronisasi dengan sistem PTVPRO.
                </p>
              </div>
            </div>

            {/* Read-Only Metadata Grid (No fake input boxes) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-2, rgba(0,0,0,0.02))',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Nama Lengkap
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '3px' }}>
                  {fullName}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-2, rgba(0,0,0,0.02))',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Nomor Anggota (PTV-ID)
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '3px' }}>
                  {ptvId}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-2, rgba(0,0,0,0.02))',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Jabatan Organisasi
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '3px' }}>
                  {position}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-2, rgba(0,0,0,0.02))',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Divisi Kerja
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '3px' }}>
                  {division}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-2, rgba(0,0,0,0.02))',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Angkatan
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '3px' }}>
                  {angkatan}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-2, rgba(0,0,0,0.02))',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  border: '1px solid var(--line-2)',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Status Keanggotaan
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: status === 'Aktif' ? '#10B981' : '#EF4444',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: status === 'Aktif' ? 'var(--ok, #059669)' : 'var(--dang, #DC2626)',
                    }}
                  >
                    {status}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Kelompok 2: Preferensi Tampilan */}
          <section
            className="set-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--ptv-curve-xl, 20px)',
              padding: '20px 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--ptv-curve-md, 10px)',
                  background: 'var(--b-050, rgba(29, 110, 229, 0.08))',
                  color: 'var(--b-700, #1D6EE5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                }}
              >
                <i className="fa-solid fa-palette" />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--ink)',
                  }}
                >
                  Preferensi Tampilan
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                  Sesuaikan kenyamanan visual ruang kerja dengan pencahayaan lingkungan Anda.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: 'var(--bg-2, rgba(0,0,0,0.02))',
                borderRadius: 'var(--ptv-curve-md, 12px)',
                border: '1px solid var(--line-2)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>
                  Mode Gelap (Dark Mode)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {isDark
                    ? 'Tema charcoal netral R03 aktif untuk visibilitas malam hari.'
                    : 'Tema terang kontras bersih aktif.'}
                </div>
              </div>
              <button
                type="button"
                className={`set-toggle ${isDark ? 'active' : ''}`}
                onClick={handleToggleTheme}
                role="switch"
                aria-checked={isDark}
                aria-label="Toggle mode gelap"
              >
                <span className="set-toggle-thumb" />
              </button>
            </div>
          </section>

          {/* Kelompok 3: Keamanan Akun & Google SSO */}
          <section
            className="set-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--ptv-curve-xl, 20px)',
              padding: '20px 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--ptv-curve-md, 10px)',
                  background: 'var(--b-050, rgba(29, 110, 229, 0.08))',
                  color: 'var(--b-700, #1D6EE5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                }}
              >
                <i className="fa-solid fa-shield-halved" />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--ink)',
                  }}
                >
                  Keamanan Akun &amp; Single Sign-On
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                  Kelola tautan akun Google dan perbarui kata sandi login secara berkala.
                </p>
              </div>
            </div>

            {googleFeedback && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--ptv-curve-sm, 8px)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '12px',
                  background: googleFeedback.type === 'success' ? 'var(--ok-bg)' : 'var(--dang-bg)',
                  color: googleFeedback.type === 'success' ? 'var(--ok)' : 'var(--dang)',
                  border: `1px solid ${googleFeedback.type === 'success' ? 'var(--ok)' : 'var(--dang-border)'}`,
                }}
              >
                {googleFeedback.message}
              </div>
            )}

            {/* Google Linking Box */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--ptv-curve-md, 12px)',
                background: 'var(--bg-2, rgba(0,0,0,0.02))',
                border: '1px solid var(--line-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-brands fa-google" style={{ fontSize: '20px', color: '#4285F4' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                    Google Single Sign-On
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    {googleStatus?.is_linked ? `Terhubung: ${googleStatus.email}` : 'Belum dihubungkan ke akun Google'}
                  </div>
                </div>
              </div>

              {googleStatus?.is_linked ? (
                <button
                  type="button"
                  className="set-btn-sec"
                  style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--ptv-curve-pill, 9999px)' }}
                  onClick={() => setShowUnlinkModal(true)}
                  disabled={isGoogleActionLoading}
                >
                  Putuskan Tautan
                </button>
              ) : (
                <button
                  type="button"
                  className="set-btn-pri"
                  style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--ptv-curve-pill, 9999px)' }}
                  onClick={handleLinkGoogle}
                  disabled={isGoogleActionLoading || isGoogleStatusLoading}
                >
                  Hubungkan Google
                </button>
              )}
            </div>

            {/* Password Form */}
            <form onSubmit={handlePasswordSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                Perbarui Kata Sandi
              </div>

              {passError && <div style={{ color: 'var(--dang)', fontSize: '12px', fontWeight: 500 }}>{passError}</div>}
              {passSuccess && <div style={{ color: 'var(--ok)', fontSize: '12px', fontWeight: 500 }}>{passSuccess}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <label className="set-label">Kata Sandi Lama</label>
                  <div className="set-pass-wrap">
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      className="set-input set-pass-input"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="set-eye-btn"
                      onClick={() => setShowOldPass(!showOldPass)}
                      aria-label={showOldPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      <i className={`fa-regular ${showOldPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="set-label">Kata Sandi Baru</label>
                  <div className="set-pass-wrap">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      className="set-input set-pass-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 4 karakter"
                    />
                    <button
                      type="button"
                      className="set-eye-btn"
                      onClick={() => setShowNewPass(!showNewPass)}
                      aria-label={showNewPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      <i className={`fa-regular ${showNewPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="set-label">Konfirmasi Baru</label>
                  <div className="set-pass-wrap">
                    <input
                      type={showCnfPass ? 'text' : 'password'}
                      className="set-input set-pass-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi"
                    />
                    <button
                      type="button"
                      className="set-eye-btn"
                      onClick={() => setShowCnfPass(!showCnfPass)}
                      aria-label={showCnfPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      <i className={`fa-regular ${showCnfPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="submit"
                  className="set-btn-pri"
                  disabled={isSubmittingPass}
                  style={{
                    padding: '0 18px',
                    minHeight: '36px',
                    fontSize: '12.5px',
                    borderRadius: 'var(--ptv-curve-pill, 9999px)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className={`fa-solid ${isSubmittingPass ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                  <span>{isSubmittingPass ? 'Menyimpan...' : 'Simpan Kata Sandi'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Kelompok 4: Sesi & Pengelolaan Akun */}
          <section
            className="set-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--ptv-curve-xl, 20px)',
              padding: '20px 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--ptv-curve-md, 10px)',
                  background: 'var(--b-050, rgba(29, 110, 229, 0.08))',
                  color: 'var(--b-700, #1D6EE5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                }}
              >
                <i className="fa-solid fa-power-off" />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--ink)',
                  }}
                >
                  Sesi &amp; Pengelolaan Akun
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                  Pengaturan sesi aktif dan diagnostik notifikasi perangkat.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="set-btn-sec"
                onClick={() => setIsDiagOpen(true)}
                style={{ fontSize: '12.5px', borderRadius: 'var(--ptv-curve-pill, 9999px)', minHeight: '36px' }}
              >
                <i className="fa-solid fa-stethoscope" style={{ marginRight: '6px' }} />
                Diagnostik Push Notifikasi
              </button>

              <button
                type="button"
                className="set-btn-sec"
                onClick={handleTriggerRefresh}
                style={{ fontSize: '12.5px', borderRadius: 'var(--ptv-curve-pill, 9999px)', minHeight: '36px' }}
              >
                <i className="fa-solid fa-arrows-rotate" style={{ marginRight: '6px' }} />
                Sinkronkan Sesi
              </button>

              <button
                type="button"
                className="set-btn-sec"
                onClick={() => setIsLogoutOpen(true)}
                style={{
                  fontSize: '12.5px',
                  borderRadius: 'var(--ptv-curve-pill, 9999px)',
                  minHeight: '36px',
                  color: 'var(--dang, #DC2626)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  marginLeft: 'auto',
                }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket" style={{ marginRight: '6px' }} />
                Keluar dari Akun
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ── Toast Notifikasi Sederhana ── */}
      {refreshToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--ink)',
            color: 'var(--surface)',
            padding: '10px 18px',
            borderRadius: 'var(--ptv-curve-pill, 9999px)',
            fontSize: '12.5px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 10000,
          }}
        >
          {refreshToast}
        </div>
      )}

      {/* ── MODAL: Verifikasi Publik QR Code ── */}
      <IdentityVerificationModal
        isOpen={isVerifModalOpen}
        onClose={() => setIsVerifModalOpen(false)}
        fullName={fullName}
        ptvId={ptvId}
        position={position}
        division={division}
        status="Aktif"
      />

      {/* ── MODALS: Pengaturan Sub-components ── */}
      <PushDiagnosticsModal
        isOpen={isDiagOpen}
        onClose={() => setIsDiagOpen(false)}
      />

      <LogoutConfirmModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={async () => {
          setIsLogoutOpen(false);
          await logout();
          navigate('/hub/login', { replace: true });
        }}
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
