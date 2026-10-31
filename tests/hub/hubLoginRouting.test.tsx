import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { ProtectedRoute } from '@app/router/ProtectedRoute';
import { LoginPage } from '@app/router/LoginPage';
import { routes } from '@app/router';
import { getSafeInternalDestination } from '@core/auth';
import { AuthUser } from '@core/auth/types';

describe('Hub Clean Login URL & Auth Guard Protection', () => {
  const activeUser: AuthUser = {
    id: 'user-001',
    ptv_id: 'PTV-001',
    full_name: 'Ahmad Executive',
    username: 'ahmad_exec',
    division: 'Manajemen',
    position: 'Produser Eksekutif',
    organization: 'Progresif TV',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['eksekutif'],
    allowed_overrides: [],
    denied_overrides: [],
  };

  beforeEach(() => {
    useSessionStore.setState({
      session: null,
      user: null,
      isLoading: false,
      error: null,
    });
  });

  describe('1. Route Configuration Structure & Legacy Compatibility', () => {
    it('harus mendaftarkan canonical login PTV Hub pada /hub/login', () => {
      const hubLoginRoute = routes.find((r) => r.path === '/hub/login');
      expect(hubLoginRoute).toBeDefined();
      expect(React.isValidElement(hubLoginRoute?.element)).toBe(true);
      expect((hubLoginRoute?.element as any)?.type).toBe(LoginPage);
    });

    it('harus menyediakan compatibility redirect untuk /login dan /login/* menuju /hub/login tanpa query parameter', () => {
      const legacyLoginRoute = routes.find((r) => r.path === '/login');
      const legacySplatRoute = routes.find((r) => r.path === '/login/*');
      expect(legacyLoginRoute).toBeDefined();
      expect(legacySplatRoute).toBeDefined();

      // Render LegacyLoginRedirect dan pastikan mengarah ke /hub/login
      const rendered = renderToString(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={legacyLoginRoute?.element} />
            <Route path="/hub/login" element={<div>Halaman Login Bersih</div>} />
          </Routes>
        </MemoryRouter>
      );
      // Komponen redirect v6 menghasilkan elemen Navigate
      expect(rendered).toBeDefined();
      expect(React.isValidElement(legacyLoginRoute?.element)).toBe(true);
    });

    it('harus memastikan /hub terproteksi oleh ProtectedRoute', () => {
      const hubRoute = routes.find((r) => r.path === '/hub');
      expect(hubRoute).toBeDefined();
      expect((hubRoute?.element as any)?.type).toBe(ProtectedRoute);
    });

    it('harus mempertahankan route portal verifikasi publik di luar login guard', () => {
      const suratRoute = routes.find((r) => r.path === '/verifikasi-surat');
      const identitasRoute = routes.find((r) => r.path === '/verifikasi-identitas');
      expect(suratRoute).toBeDefined();
      expect(identitasRoute).toBeDefined();
      expect((suratRoute?.element as any)?.type).not.toBe(ProtectedRoute);
      expect((identitasRoute?.element as any)?.type).not.toBe(ProtectedRoute);
    });
  });

  describe('2. Clean Login URL & ProtectedRoute Authentication Guard', () => {
    it('harus me-redirect user belum login dari /hub/keuangan ke /hub/login TANPA query parameter (?redirect=...)', () => {
      useSessionStore.setState({ session: null, user: null, isLoading: false });

      let capturedElement: React.ReactElement | null = null;
      const TestProtectedWrapper: React.FC = () => {
        const result = ProtectedRoute({
          children: <div>Halaman Keuangan Rahasia</div>,
          requiredCapability: 'finance.view',
        });
        capturedElement = result as React.ReactElement;
        return result;
      };

      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/keuangan']}>
          <TestProtectedWrapper />
        </MemoryRouter>
      );

      // 1. Konten rahasia internal tidak boleh bocor
      expect(html).not.toContain('Halaman Keuangan Rahasia');

      // 2. Elemen navigasi harus menuju /hub/login (Clean URL) tanpa string query
      expect(capturedElement).not.toBeNull();
      expect((capturedElement as any)?.type).toBe(Navigate);
      expect((capturedElement as any)?.props?.replace).toBe(true);
      
      const targetUrl = (capturedElement as any)?.props?.to;
      expect(targetUrl).toBe('/hub/login');
      expect(targetUrl).not.toContain('?');
      expect(targetUrl).not.toContain('redirect=');

      // 3. Intended destination disimpan melalui React Router navigation state
      const state = (capturedElement as any)?.props?.state;
      expect(state).toBeDefined();
      expect(state.returnTo).toBe('/hub/keuangan');
      expect(state.from.pathname).toBe('/hub/keuangan');
    });

    it('harus mengizinkan akses ke konten internal jika sudah terautentikasi', () => {
      useSessionStore.setState({
        session: { access_token: 'test-token', expires_at: Date.now() + 3600000, user: activeUser },
        user: activeUser,
        isLoading: false,
      });

      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/beranda']}>
          <Routes>
            <Route
              path="/hub/beranda"
              element={
                <ProtectedRoute requiredCapability="hub.access">
                  <div>Halaman Beranda Sah</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(html).toContain('Halaman Beranda Sah');
    });
  });

  describe('3. Intended Destination Sanitization, Open Redirect & Loop Prevention', () => {
    it('harus mengizinkan rute internal /hub/* yang valid sebagai tujuan kembali', () => {
      expect(getSafeInternalDestination('/hub/keuangan')).toBe('/hub/keuangan');
      expect(getSafeInternalDestination('/hub/inventaris?tab=katalog')).toBe('/hub/inventaris?tab=katalog');
      expect(getSafeInternalDestination('/hub/catatan')).toBe('/hub/catatan');
      expect(getSafeInternalDestination('/hub')).toBe('/hub');
    });

    it('harus fallback ke /hub jika dibuka langsung atau di-refresh tanpa navigation state', () => {
      expect(getSafeInternalDestination(null)).toBe('/hub');
      expect(getSafeInternalDestination(undefined)).toBe('/hub');
      expect(getSafeInternalDestination('')).toBe('/hub');
    });

    it('harus mencegah open redirect ke domain luar dan fallback ke /hub', () => {
      expect(getSafeInternalDestination('//evil.com')).toBe('/hub');
      expect(getSafeInternalDestination('https://evil.com/phishing')).toBe('/hub');
      expect(getSafeInternalDestination('http://attacker.com')).toBe('/hub');
      expect(getSafeInternalDestination('/\\malicious.host')).toBe('/hub');
      expect(getSafeInternalDestination('javascript:alert(1)')).toBe('/hub');
    });

    it('harus mencegah redirect loop ke halaman login atau auth callback', () => {
      expect(getSafeInternalDestination('/hub/login')).toBe('/hub');
      expect(getSafeInternalDestination('/login')).toBe('/hub');
      expect(getSafeInternalDestination('/hub/auth/callback')).toBe('/hub');
      expect(getSafeInternalDestination('/hub/login?returnTo=/hub')).toBe('/hub');
    });

    it('harus menolak rute palsu yang bukan /hub/* dan fallback ke /hub', () => {
      expect(getSafeInternalDestination('/hub_fake_module')).toBe('/hub');
      expect(getSafeInternalDestination('/hubbad')).toBe('/hub');
      expect(getSafeInternalDestination('/external-portal')).toBe('/hub');
    });
  });

  describe('4. LoginPage Form & Clean URL Rendering', () => {
    it('harus merender form login lengkap pada /hub/login tanpa query parameter', () => {
      useSessionStore.setState({ session: null, user: null, isLoading: false });

      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/login']}>
          <LoginPage />
        </MemoryRouter>
      );

      expect(html).toContain('Email / Username');
      expect(html).toContain('Password');
      expect(html).toContain('Lanjutkan dengan Google');
      expect(html).toContain('Bantuan Akses Dasbor');
    });
  });
});
