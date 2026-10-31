import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/app/router';
import { AppProviders } from '../../src/app/providers/AppProviders';
import { useSessionStore } from '../../src/core/session';
import { LOCAL_DEV_MOCK_USERS } from '../../src/core/auth';

describe('PTV-DEV-206: HubShell & Route Integration for /hub/haul', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should mount /hub/haul inside HubShell for authenticated coordinator without throwing', () => {
    const mockUser = LOCAL_DEV_MOCK_USERS['PTV-001']; // Zidnal, eksekutif with projecthaul.manage
    useSessionStore.setState({
      user: mockUser,
      session: {
        access_token: 'valid-test-token',
        expires_at: Date.now() + 86400000,
        user: mockUser,
      },
      isLoading: false,
      error: null,
    });

    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/hub/haul'],
    });

    let html = '';
    expect(() => {
      html = renderToString(
        <AppProviders>
          <RouterProvider router={memoryRouter} />
        </AppProviders>
      );
    }).not.toThrow();

    // Verify HubShell integration
    expect(html).toContain('Haul &amp; Harlah PPBS'); // HubShell header title and sidebar link
    expect(html).toContain('class="snav'); // Single Hub navigation sidebar
    expect(html).toContain('href="/hub/haul"');

    // Verify HaulWorkspace is inside HubShell main content
    expect(html).toContain('hh-workspace');
    expect(html).toContain('Rangkaian Acara Utama');
    expect(html).toContain('hh-workspace-surface');

    // Verify coordinator controls are visible in workspace
    expect(html).toContain('Atur edisi');
    expect(html).toContain('+ Edisi');
    expect(html).toContain('+ Paket PPBS');

    // Verify cloud safety notice
    expect(html).toContain('Penyimpanan Database Cloud Tertunda');

    // Verify NO double navigation or duplicate dev controls
    expect(html).not.toContain('Simuler akses');
    expect(html).not.toContain('mobilebar');
  });

  it('2. should mount /hub/haul for crew member and restrict coordinator actions', () => {
    // Regular crew member with hub.access and projecthaul.view, but without projecthaul.manage
    const crewUser = {
      id: 'kru-002',
      ptv_id: 'PTV-002',
      username: 'kru_biasa',
      full_name: 'Kru Lapangan',
      assigned_profiles: ['anggota_kru'],
      allowed_overrides: ['hub.access', 'projecthaul.view'],
      denied_overrides: [],
      status_akun: 'active',
      status_organisasi: 'active',
    } as any;

    useSessionStore.setState({
      user: crewUser,
      session: {
        access_token: 'valid-crew-token',
        expires_at: Date.now() + 86400000,
        user: crewUser,
      },
      isLoading: false,
      error: null,
    });

    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/hub/haul'],
    });

    const html = renderToString(
      <AppProviders>
        <RouterProvider router={memoryRouter} />
      </AppProviders>
    );

    // Workspace is displayed
    expect(html).toContain('hh-workspace');
    expect(html).toContain('Rangkaian Acara Utama');

    // Coordinator action buttons are hidden
    expect(html).not.toContain('Atur edisi');
    expect(html).not.toContain('+ Edisi');
    expect(html).not.toContain('+ Paket PPBS');
  });

  it('3. should redirect or deny unauthenticated visitors attempting to view /hub/haul', () => {
    useSessionStore.setState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    });

    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/hub/haul'],
    });

    const html = renderToString(
      <AppProviders>
        <RouterProvider router={memoryRouter} />
      </AppProviders>
    );

    // ProtectedRoute redirects unauthenticated visitors to login
    expect(html).not.toContain('hh-workspace');
  });
});
