import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { getAuthService, getAndClearIntendedDestination } from '@core/auth';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase';
import { hasCapability } from '@core/policy';

export const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Memverifikasi autentikasi Google...');

  useEffect(() => {
    let isMounted = true;

    const processOAuthCallback = async () => {
      // 1. Periksa parameter error dari Google / Supabase
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        let friendlyMessage = 'Autentikasi Google gagal.';
        if (
          errorParam === 'access_denied' ||
          (errorDescription && errorDescription.toLowerCase().includes('cancel'))
        ) {
          friendlyMessage = 'Autentikasi Google dibatalkan oleh pengguna.';
        } else if (errorDescription) {
          friendlyMessage = `Autentikasi Google gagal: ${errorDescription}`;
        }

        useSessionStore.setState({ error: friendlyMessage, isLoading: false });
        navigate('/hub/login', { replace: true });
        return;
      }

      // 2. Validasi konfigurasi backend Supabase
      const isConfigured = isSupabaseConfigured();
      const isSupabaseBackend = import.meta.env.VITE_AUTH_BACKEND === 'supabase';

      if (!isSupabaseBackend || !isConfigured) {
        useSessionStore.setState({
          error:
            'Callback OAuth ditolak: Backend Supabase belum terkonfigurasi pada runtime ini. ' +
            'Sistem menolak login tanpa validasi identitas riil.',
          isLoading: false,
        });
        navigate('/hub/login', { replace: true });
        return;
      }

      try {
        if (isMounted) setStatusMessage('Menukarkan kode otorisasi sesi...');
        const supabase = getSupabaseClient();
        const code = searchParams.get('code');

        let supabaseSession = null;

        // 3. Pertukaran kode PKCE atau pembacaan sesi Supabase
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw new Error(`Pertukaran kode OAuth gagal: ${error.message}`);
          }
          supabaseSession = data.session;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            throw new Error(`Gagal memuat sesi OAuth: ${error.message}`);
          }
          supabaseSession = data.session;
        }

        if (!supabaseSession || !supabaseSession.user) {
          throw new Error('Sesi autentikasi Google tidak ditemukan atau telah kedaluwarsa.');
        }

        if (isMounted) setStatusMessage('Memvalidasi identitas akun kru & hak akses PTV Hub...');

        // 4. Resolusi identitas murni database & fail-closed security guard
        const authService = getAuthService();
        if (!authService.resolveDatabaseSession) {
          throw new Error('Resolver identitas database tidak tersedia pada layanan autentikasi aktif.');
        }

        const resolvedSession = await authService.resolveDatabaseSession(supabaseSession);

        // 5. Capability Guard: Akun Google WAJIB memiliki hak akses hub.access
        if (!hasCapability(resolvedSession.user, 'hub.access')) {
          throw new Error(
            `Akses Ditolak: Akun (${resolvedSession.user.ptv_id}) tidak memiliki izin akses PTV Hub (hub.access). Hubungi Administrator PTV.`
          );
        }

        // 6. Autentikasi dan Otorisasi Sukses: Simpan sesi dan arahkan ke tujuan aman
        useSessionStore.setState({
          session: resolvedSession,
          user: resolvedSession.user,
          isLoading: false,
          error: null,
        });

        const targetDestination = getAndClearIntendedDestination();
        navigate(targetDestination, { replace: true });
      } catch (err: any) {
        // Fail-Closed: Logout dari Supabase jika verifikasi database atau RBAC gagal
        try {
          const supabase = getSupabaseClient();
          await supabase.auth.signOut();
        } catch {
          // ignore signout errors
        }

        const errorMessage =
          err?.message ||
          'Akses Ditolak: Gagal memverifikasi identitas operasional kru PTV PRO dari database.';

        useSessionStore.setState({
          session: null,
          user: null,
          isLoading: false,
          error: errorMessage,
        });

        navigate('/hub/login', { replace: true });
      }
    };

    processOAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100dvh',
        background: '#061A36',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <img
          src="/assets/images/ptv-logo-white.webp"
          alt="Progresif TV"
          style={{ height: '44px', width: 'auto', display: 'block' }}
        />
      </div>

      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(255, 255, 255, 0.2)',
          borderTopColor: '#FFFFFF',
          borderRadius: '50%',
          animation: 'lk-spin 0.8s linear infinite',
          marginBottom: '16px',
        }}
      />

      <h2
        style={{
          fontSize: '18px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          letterSpacing: '-0.01em',
        }}
      >
        Memproses Login Google
      </h2>

      <p
        style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.7)',
          margin: 0,
          maxWidth: '360px',
          lineHeight: 1.5,
        }}
      >
        {statusMessage}
      </p>
    </div>
  );
};
