import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from './LoginPage';
import { HubShell } from '@products/hub/shell/HubShell';
import { BerandaPage } from '@products/hub/beranda/BerandaPage';
import { KruPage } from '@products/hub/kru/KruPage';
import { InventarisPage } from '@products/hub/inventaris/InventarisPage';
import { PeminjamanPage } from '@products/hub/peminjaman/PeminjamanPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/hub/beranda" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
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
      {
        path: 'beranda',
        element: <BerandaPage />,
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
        path: 'peminjaman',
        element: (
          <ProtectedRoute requiredCapability="loans.view">
            <PeminjamanPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/hub/beranda" replace />,
  },
]);
