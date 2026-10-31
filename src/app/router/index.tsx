import { AksesPage } from '@products/hub/akses/AksesPage';
import React from 'react';
import { createBrowserRouter, Navigate, RouteObject, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from './LoginPage';
import { AuthCallbackPage } from './AuthCallbackPage';
import { HubShell } from '@products/hub/shell/HubShell';
import { BerandaPage } from '@products/hub/beranda/BerandaPage';
import { KruPage } from '@products/hub/kru/KruPage';
import { InventarisPage } from '@products/hub/inventaris/InventarisPage';
import { AlatDetailPage } from '@products/hub/inventaris/AlatDetailPage';
import { NilaiInventarisPage } from '@products/hub/inventaris/NilaiInventarisPage';
import { NilaiInventarisDetailPage } from '@products/hub/inventaris/NilaiInventarisDetailPage';
import { PeminjamanPage } from '@products/hub/peminjaman/PeminjamanPage';
import { KalenderPage } from '@products/hub/kalender/KalenderPage';
import { CatatanPage } from '@products/hub/catatan/CatatanPage';
import { AcaraModuleLayout } from '@products/hub/acara/AcaraModuleLayout';
import { AcaraProvider } from '@products/hub/acara/context/AcaraContext';
import { AcaraPage } from '@products/hub/acara/AcaraPage';
import { AcaraDetailPage } from '@products/hub/acara/AcaraDetailPage';
import { LostFoundPage } from '@products/hub/lost-found/LostFoundPage';
import { LaporKerusakanPage } from '@products/hub/lapor-kerusakan/LaporKerusakanPage';
import { PerizinanPage } from '@products/hub/perizinan/PerizinanPage';
import { ArsipPage } from '@products/hub/arsip/ArsipPage';
import { GeneratorSuratPage } from '@products/hub/surat/generator/GeneratorSuratPage';
import { KontakInternalPage } from '@products/hub/kontak/KontakInternalPage';
import { KontakEksternalPage } from '@products/hub/kontak-eksternal/KontakEksternalPage';
import { KeabsahanDokumenPage, VerifikasiIdentitasPage } from '@products/verification';
import { KeuanganPage } from '@products/hub/keuangan';
import { HaulPage } from '@products/hub/haul';
import { SeoPage } from '@products/hub/seo';
import { BroadcastPage } from '@products/hub/broadcast';
import { PengaturanPage } from '@products/hub/pengaturan';
import { ProfilePage } from '@products/hub/profile/ProfilePage';
import { PortofolioSayaPage } from '@products/hub/kru/PortofolioSayaPage';

import { LivingPortalPage, LivingStatusPage } from '@products/living-portal';
import { PortalManagementPage } from '@products/hub/portal-management';

const isDev = Boolean(import.meta.env.DEV) && import.meta.env.MODE === 'development'
  && (!import.meta.env.VITE_AUTH_BACKEND || import.meta.env.VITE_AUTH_BACKEND === 'mock');
const DevCatalogPage = isDev
  ? React.lazy(() =>
      import('@products/hub/dev-catalog/DevCatalogPage').then((m) => ({
        default: m.DevCatalogPage,
      }))
    )
  : null;
import { DevKeuanganPage } from '@products/hub/dev-catalog/DevKeuanganPage';
import { useSessionStore } from '@core/session';
import { LOCAL_DEV_MOCK_USERS } from '@core/auth/authService';

const DevAutoAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useSessionStore((s) => s.user);
  if (!user) {
    const mockUser = LOCAL_DEV_MOCK_USERS['PTV-001'];
    useSessionStore.setState({
      user: mockUser,
      session: {
        access_token: 'dev-mock-token',
        expires_at: Date.now() + 86400000,
        user: mockUser,
      },
      isLoading: false,
    });
  }
  return <>{children}</>;
};


/**
 * Kompatibilitas Legacy Redirect: /login -> /hub/login dengan preservasi query search
 */
const LegacyLoginRedirect: React.FC = () => {
  return <Navigate to="/hub/login" replace />;
};

/**
 * Kompatibilitas Preview Redirect: /preview -> / dengan preservasi query search & hash
 */
const PreviewPortalRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: '/', search: location.search, hash: location.hash }} replace />;
};

/**
 * Kompatibilitas Preview Status Redirect: /preview/status-layanan -> /status-layanan dengan preservasi query search & hash
 */
const PreviewStatusRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: '/status-layanan', search: location.search, hash: location.hash }} replace />;
};

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <LivingPortalPage />,
  },
  {
    path: '/status-layanan',
    element: <LivingStatusPage />,
  },
  {
    path: '/preview',
    element: <PreviewPortalRedirect />,
  },
  {
    path: '/preview/living-portal',
    element: <PreviewPortalRedirect />,
  },
  {
    path: '/preview/status-layanan',
    element: <PreviewStatusRedirect />,
  },
  {
    path: '/preview/*',
    element: <PreviewPortalRedirect />,
  },
  {
    path: '/hub/login',
    element: <LoginPage />,
  },
  {
    path: '/hub/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/login',
    element: <LegacyLoginRedirect />,
  },
  {
    path: '/login/*',
    element: <LegacyLoginRedirect />,
  },
  ...(isDev
    ? [
        ...(DevCatalogPage
          ? [
              {
                path: '/dev-catalog',
                element: (
                  <React.Suspense fallback={<div style={{ padding: '24px', color: 'var(--ink)' }}>Memuat katalog development...</div>}>
                    <DevCatalogPage />
                  </React.Suspense>
                ),
              },
            ]
          : []),
        {
          path: '/dev-arsip',
          element: (
            <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
              <ArsipPage />
            </div>
          ),
        },
        {
          path: '/dev-generator-surat',
          element: (
            <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
              <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
                <GeneratorSuratPage />
              </div>
            </div>
          ),
        },
        {
          path: '/dev-keuangan',
          element: <DevKeuanganPage />,
        },
        {
          path: '/dev-haul',
          element: (
            <DevAutoAuth>
              <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafd)' }}>
                <HaulPage />
              </div>
            </DevAutoAuth>
          ),
        },
        {
          path: '/dev-seo',
          element: (
            <DevAutoAuth>
              <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafd)' }}>
                <SeoPage />
              </div>
            </DevAutoAuth>
          ),
        },
        {
          path: '/dev-broadcast',
          element: (
            <DevAutoAuth>
              <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafd)' }}>
                <BroadcastPage />
              </div>
            </DevAutoAuth>
          ),
        },
        {
          path: '/dev-pengaturan',
          element: (
            <DevAutoAuth>
              <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafd)' }}>
                <PengaturanPage />
              </div>
            </DevAutoAuth>
          ),
        },
      ]
    : []),
  // ── PORTAL VERIFIKASI PUBLIK (Bebas Akses Tanpa Login) ──
  {
    path: '/verifikasi-surat',
    element: <KeabsahanDokumenPage />,
  },
  {
    path: '/verifikasi-surat/*',
    element: <KeabsahanDokumenPage />,
  },
  {
    path: '/keabsahan-dokumen',
    element: <KeabsahanDokumenPage />,
  },
  {
    path: '/keabsahan-dokumen/*',
    element: <KeabsahanDokumenPage />,
  },
  {
    path: '/verifikasi-identitas',
    element: <VerifikasiIdentitasPage />,
  },
  {
    path: '/verifikasi-identitas/:crewId',
    element: <VerifikasiIdentitasPage />,
  },
  {
    path: '/verifikasi-identitas/*',
    element: <VerifikasiIdentitasPage />,
  },
  {
    path: '/hub',
    element: (
      <ProtectedRoute requiredCapability="hub.access">
        <HubShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/hub/beranda" replace />,
      },
      ...(isDev && DevCatalogPage
        ? [
            {
              path: 'katalog',
              element: (
                <React.Suspense fallback={<div style={{ padding: '24px', color: 'var(--ink)' }}>Memuat katalog development...</div>}>
                  <DevCatalogPage />
                </React.Suspense>
              ),
            },
          ]
        : []),
      {
        path: 'beranda',
        element: (
          <AcaraProvider>
            <BerandaPage />
          </AcaraProvider>
        ),
      },
      {
        path: 'akses',
        element: <ProtectedRoute requiredCapability="crew.permissions.manage"><AksesPage /></ProtectedRoute>,
      },
      {
        path: 'kru',
        element: (
          <ProtectedRoute requiredCapability="crew.view">
            <KruPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventaris',
        element: (
          <ProtectedRoute requiredCapability="inventory.view">
            <InventarisPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventaris/nilai',
        element: (
          <ProtectedRoute requiredCapability="inventory.valuation.view">
            <NilaiInventarisPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventaris/nilai/:id',
        element: (
          <ProtectedRoute requiredCapability="inventory.valuation.view">
            <NilaiInventarisDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'nilai-inventaris',
        element: <Navigate to="/hub/inventaris/nilai" replace />,
      },
      {
        path: 'inventaris/:id',
        element: (
          <ProtectedRoute requiredCapability="inventory.view">
            <AlatDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'peminjaman',
        element: (
          <ProtectedRoute requiredCapability="loans.view">
            <PeminjamanPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'acara',
        element: (
          <ProtectedRoute requiredCapability="events.view">
            <AcaraModuleLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <AcaraPage />,
          },
          {
            path: ':id',
            element: <AcaraDetailPage />,
          },
        ],
      },
      {
        path: 'kalender',
        element: (
          <ProtectedRoute requiredCapability="calendar.view">
            <AcaraProvider>
              <KalenderPage />
            </AcaraProvider>
          </ProtectedRoute>
        ),
      },
      {
        path: 'catatan',
        element: (
          <ProtectedRoute requiredCapability="notes.view">
            <CatatanPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'catatan-bersama',
        element: <Navigate to="/hub/catatan" replace />,
      },
      {
        path: 'lostfound',
        element: (
          <ProtectedRoute requiredCapability="lostfound.view">
            <LostFoundPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'lost-found',
        element: <Navigate to="/hub/lostfound" replace />,
      },
      {
        path: 'kerusakan',
        element: (
          <ProtectedRoute requiredCapability="damage.view">
            <LaporKerusakanPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'lapor-kerusakan',
        element: <Navigate to="/hub/kerusakan" replace />,
      },
      {
        path: 'id',
        element: <Navigate to="/hub/profile" replace />,
      },
      {
        path: 'perizinan',
        element: (
          <ProtectedRoute requiredCapability="documents.view">
            <PerizinanPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'dokumen',
        element: <Navigate to="/hub/arsip" replace />,
      },
      {
        path: 'dokumen-saya',
        element: <Navigate to="/hub/arsip" replace />,
      },
      {
        path: 'arsip',
        element: (
          <ProtectedRoute anyCapabilities={['documents.archive.view', 'documents.view', 'documents.approve', 'documents.archive.manage']}>
            <ArsipPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'surat/generator',
        element: (
          <ProtectedRoute requiredCapability="documents.generate">
            <GeneratorSuratPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'generator-surat',
        element: <Navigate to="/hub/surat/generator" replace />,
      },
      {
        path: 'keuangan',
        element: (
          <ProtectedRoute anyCapabilities={['finance.view', 'finance.view_own']}>
            <KeuanganPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'kontak',
        element: (
          <ProtectedRoute requiredCapability="contacts.internal.view">
            <KontakInternalPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'kontak-eksternal',
        element: (
          <ProtectedRoute requiredCapability="contacts.external.view">
            <KontakEksternalPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'kontakEksternal',
        element: <Navigate to="/hub/kontak-eksternal" replace />,
      },
      {
        path: 'haul',
        element: (
          <ProtectedRoute requiredCapability="projecthaul.view">
            <HaulPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'seo',
        element: (
          <ProtectedRoute requiredCapability="settings.system">
            <SeoPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'broadcast',
        element: (
          <ProtectedRoute requiredCapability="broadcast.view">
            <BroadcastPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'portal',
        element: (
          <ProtectedRoute anyCapabilities={['settings.system', 'crew.permissions.manage']}>
            <PortalManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'portofolio',
        element: (
          <ProtectedRoute anyCapabilities={['settings.personal', 'id.view', 'crew.view']}>
            <PortofolioSayaPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'portofolio-saya',
        element: <Navigate to="/hub/portofolio" replace />,
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute anyCapabilities={['settings.personal', 'id.view']}>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'pengaturan',
        element: <Navigate to="/hub/profile" replace />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/hub/beranda" replace />,
  },
];

export const router =
  typeof document !== 'undefined'
    ? createBrowserRouter(routes, {
        future: {
          v7_relativeSplatPath: true,
        },
      })
    : (null as unknown as ReturnType<typeof createBrowserRouter>);

if (typeof window !== 'undefined' && router) {
  (window as any).__router = router;
}

