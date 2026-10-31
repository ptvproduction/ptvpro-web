import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { AppCapability } from '@core/policy';
import { storeIntendedDestination } from '@core/auth';
import { Card, Button, AuthSplashScreen } from '@shared/components';
import { ShieldAlert } from 'lucide-react';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredCapability?: AppCapability;
  anyCapabilities?: AppCapability[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredCapability = 'hub.access',
  anyCapabilities,
}) => {
  const location = useLocation();
  const store = useSessionStore();
  const session = typeof window === 'undefined' ? useSessionStore.getState().session : store.session;
  const user = typeof window === 'undefined' ? useSessionStore.getState().user : store.user;
  const isLoading = typeof window === 'undefined' ? useSessionStore.getState().isLoading : store.isLoading;
  const can = store.can;
  const logout = store.logout;
  
  // Theme-aware waiting screen: instantly sync stored theme preference on mount to prevent white flash
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTheme = localStorage.getItem('ptv-theme') || localStorage.getItem('theme');
        const targetTheme = savedTheme === 'dark' ? 'dark' : 'light';
        if (document.documentElement.getAttribute('data-theme') !== targetTheme) {
          document.documentElement.setAttribute('data-theme', targetTheme);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const [showSplash, setShowSplash] = React.useState(isLoading);
  const [isSplashExiting, setIsSplashExiting] = React.useState(false);

  React.useEffect(() => {
    if (isLoading) {
      setShowSplash(true);
      setIsSplashExiting(false);
      return;
    }

    if (!isLoading && showSplash) {
      // 1. Terapkan preferensi tema final ke documentElement SEBELUM splash memudar
      if (typeof window !== 'undefined') {
        try {
          const savedTheme = localStorage.getItem('ptv-theme') || localStorage.getItem('theme');
          const targetTheme = savedTheme === 'dark' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', targetTheme);
        } catch {
          // ignore
        }
      }

      // 2. Aksesibilitas: prefers-reduced-motion langsung unmount tanpa crossfade
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        setShowSplash(false);
        setIsSplashExiting(false);
        return;
      }

      // 3. Picu transisi keluar halus 250ms
      setIsSplashExiting(true);
      const timer = setTimeout(() => {
        setShowSplash(false);
        setIsSplashExiting(false);
      }, 260);

      return () => clearTimeout(timer);
    }
  }, [isLoading, showSplash]);

  if (isLoading) {
    return <AuthSplashScreen />;
  }

  // 1. Unauthenticated or expired or incomplete session gate: Clean Login URL
  const isExpired = typeof session?.expires_at === 'number' && session.expires_at <= Date.now();
  if (!session || !user || !user.id || !user.ptv_id || isExpired) {
    const returnTarget = location.pathname + location.search;
    storeIntendedDestination(returnTarget);
    return <Navigate to="/hub/login" state={{ from: location, returnTo: returnTarget }} replace />;
  }

  // 2. Suspended account gate
  if (user.status_akun !== 'active') {
    return (
      <div style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Card style={{ maxWidth: '440px', textAlign: 'center', borderColor: 'var(--status-danger)' }}>
          <ShieldAlert size={40} style={{ color: 'var(--status-danger)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', color: '#fca5a5' }}>
            Akun Dinonaktifkan
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Akun Anda ({user.ptv_id}) sedang berstatus nonaktif. Akses ke sistem ditolak. Silakan hubungi Eksekutif PTV.
          </p>
          <Button variant="secondary" onClick={() => logout()}>
            Keluar Sesi
          </Button>
        </Card>
      </div>
    );
  }

  // 2b. Finance 2.0 Locked Rule (Bagian I): Personel berkategori Pembina atau Pengarah dilarang keras
  // membuka halaman/modul Keuangan, termasuk lewat URL langsung (/hub/keuangan).
  const userCategory = ((user as any)?.category || (user as any)?.kategori || (user as any)?.kategori_personel || '').toLowerCase().trim();
  const isPembinaOrPengarah = userCategory === 'pembina' || userCategory === 'pengarah' || user?.assigned_profiles?.includes('pembina');

  if (location.pathname.startsWith('/hub/keuangan') && isPembinaOrPengarah) {
    return (
      <div style={{ display: 'flex', minHeight: '70vh', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Card style={{ maxWidth: '460px', textAlign: 'center', borderColor: 'var(--status-danger)' }}>
          <ShieldAlert size={40} style={{ color: 'var(--status-danger)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', color: '#fca5a5' }}>
            Akses Keuangan Ditolak
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Personel dengan kategori <strong>Pembina</strong> atau <strong>Pengarah</strong> tidak memiliki hak akses ke modul Keuangan studio.
          </p>
          <Button variant="secondary" onClick={() => window.history.back()}>
            Kembali
          </Button>
        </Card>
      </div>
    );
  }

  // 3. Capability authorization gate (Fail-Closed)
  const safeCan = typeof can === 'function' ? can : () => false;
  const hasAccess = anyCapabilities && anyCapabilities.length > 0
    ? anyCapabilities.some((cap) => safeCan(cap))
    : (!requiredCapability || safeCan(requiredCapability));

  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', minHeight: '70vh', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Card style={{ maxWidth: '460px', textAlign: 'center', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <ShieldAlert size={40} style={{ color: 'var(--status-warning)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', color: '#fcd34d' }}>
            Akses Dibatasi
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Profil Anda tidak memiliki izin untuk fitur ini.
          </p>
          <div
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              marginBottom: '1.5rem',
            }}
          >
            Memerlukan capability: {requiredCapability}
          </div>
          <Button variant="secondary" onClick={() => window.history.back()}>
            Kembali
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      {showSplash && (
        <AuthSplashScreen
          isExiting={isSplashExiting}
          onTransitionEnd={() => {
            setShowSplash(false);
            setIsSplashExiting(false);
          }}
        />
      )}
      {children}
    </>
  );
};
