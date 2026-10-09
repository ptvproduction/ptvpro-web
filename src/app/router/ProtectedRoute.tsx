import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { AppCapability } from '@core/policy';
import { LoadingState, Card, Button } from '@shared/components';
import { ShieldAlert } from 'lucide-react';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredCapability?: AppCapability;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredCapability = 'hub.access',
}) => {
  const location = useLocation();
  const { session, user, isLoading, can, logout } = useSessionStore();

  if (isLoading) {
    return <LoadingState message="Memeriksa otentikasi..." />;
  }

  // 1. Unauthenticated gate
  if (!session || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
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

  // 3. Capability authorization gate
  if (requiredCapability && !can(requiredCapability)) {
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

  return <>{children}</>;
};
