import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/app/router';
import { AppProviders } from '../../src/app/providers/AppProviders';
import { useSessionStore } from '../../src/core/session';
import { LOCAL_DEV_MOCK_USERS } from '../../src/core/auth';

describe('Browser Mount Simulation for /hub/', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders /hub/ without crashing when authenticated', () => {
    const mockUser = LOCAL_DEV_MOCK_USERS['PTV-001'];
    useSessionStore.setState({
      user: mockUser,
      session: {
        access_token: 'valid-token',
        expires_at: Date.now() + 86400000,
        user: mockUser,
      },
      isLoading: false,
      error: null,
    });

    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/hub/'],
    });

    let html = '';
    expect(() => {
      html = renderToString(
        <AppProviders>
          <RouterProvider router={memoryRouter} />
        </AppProviders>
      );
    }).not.toThrow();

    console.log('Rendered HTML length:', html.length);
    expect(html).not.toBe('');
  });

  it('renders /hub/login without crashing', () => {
    useSessionStore.setState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    });

    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/hub/login'],
    });

    let html = '';
    expect(() => {
      html = renderToString(
        <AppProviders>
          <RouterProvider router={memoryRouter} />
        </AppProviders>
      );
    }).not.toThrow();

    console.log('LoginPage HTML length:', html.length);
    expect(html).not.toBe('');
  });

  const routesToTest = [
    '/hub/beranda',
    '/hub/acara',
    '/hub/inventaris',
    '/hub/peminjaman',
    '/hub/kru',
    '/hub/id',
    '/hub/generator-surat',
    '/hub/kontak',
    '/hub/kalender',
    '/hub/catatan',
    '/hub/lapor-kerusakan',
    '/hub/lost-found',
    '/hub/dokumen',
    '/hub/perizinan',
    '/hub/arsip',
    '/hub/keuangan',
    '/hub/haul',
    '/hub/seo',
    '/hub/broadcast',
    '/hub/pengaturan',
  ];

  for (const path of routesToTest) {
    it(`renders ${path} without crashing when authenticated`, () => {
      const mockUser = LOCAL_DEV_MOCK_USERS['PTV-001'];
      useSessionStore.setState({
        user: mockUser,
        session: {
          access_token: 'valid-token',
          expires_at: Date.now() + 86400000,
          user: mockUser,
        },
        isLoading: false,
        error: null,
      });

      const memoryRouter = createMemoryRouter(routes, {
        initialEntries: [path],
      });

      let html = '';
      expect(() => {
        html = renderToString(
          <AppProviders>
            <RouterProvider router={memoryRouter} />
          </AppProviders>
        );
      }).not.toThrow();

      console.log(`Rendered ${path} length:`, html.length);
      expect(html).not.toBe('');
    });
  }

  it('renders /hub/ while unauthenticated (redirects to /hub/login)', () => {
    useSessionStore.setState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    });

    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: ['/hub'],
    });

    let html = '';
    expect(() => {
      html = renderToString(
        <AppProviders>
          <RouterProvider router={memoryRouter} />
        </AppProviders>
      );
    }).not.toThrow();
    expect(html).toBeDefined();
  });
});


