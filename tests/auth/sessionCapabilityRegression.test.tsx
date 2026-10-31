/**
 * Regression Test Suite: Session Structure & Policy Engine Fail-Closed Parity
 * Prevents TypeError: Cannot read properties of undefined (reading 'includes')
 * Verifies Section 6.2 and login form + OAuth session integrity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { hasCapability, PermissionContext } from '@core/policy';
import { normalizeAuthUser } from '@core/auth';
import { useSessionStore } from '@core/session';
import { ProtectedRoute } from '@app/router/ProtectedRoute';

describe('Session Capabilities & Policy Engine Regression Tests', () => {
  beforeEach(() => {
    useSessionStore.setState({
      session: null,
      user: null,
      isLoading: false,
      error: null,
    });
  });

  describe('1. PolicyEngine Defensive & Fail-Closed Resolution', () => {
    it('tidak boleh crash jika context memiliki denied_overrides atau allowed_overrides undefined', () => {
      const partialContext = {
        status_akun: 'active' as const,
        status_organisasi: 'active' as const,
        assigned_profiles: ['crew' as const],
        // allowed_overrides and denied_overrides intentionally omitted
      } as unknown as PermissionContext;

      expect(() => hasCapability(partialContext, 'hub.access')).not.toThrow();
      expect(hasCapability(partialContext, 'hub.access')).toBe(true);
      expect(hasCapability(partialContext, 'events.delete')).toBe(false);
    });

    it('tidak boleh crash jika context memiliki assigned_profiles undefined', () => {
      const emptyContext = {
        status_akun: 'active' as const,
        status_organisasi: 'active' as const,
      } as unknown as PermissionContext;

      expect(() => hasCapability(emptyContext, 'hub.access')).not.toThrow();
      expect(hasCapability(emptyContext, 'hub.access')).toBe(false);
    });

    it('fail-closed: context null atau undefined harus selalu menolak akses', () => {
      expect(hasCapability(null, 'hub.access')).toBe(false);
      expect(hasCapability(undefined, 'hub.access')).toBe(false);
    });

    it('fail-closed: akun inactive selalu ditolak meskipun memiliki override atau profiles', () => {
      const inactiveContext: PermissionContext = {
        status_akun: 'inactive',
        status_organisasi: 'active',
        assigned_profiles: ['root_executive'],
        allowed_overrides: ['hub.access'],
        denied_overrides: [],
      };

      expect(hasCapability(inactiveContext, 'hub.access')).toBe(false);
    });

    it('fail-closed: akun terarsip (archived) selalu ditolak seluruh akses', () => {
      const archivedContext: PermissionContext = {
        status_akun: 'active',
        status_organisasi: 'archived',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: ['hub.access'],
        denied_overrides: [],
      };

      expect(hasCapability(archivedContext, 'hub.access')).toBe(false);
    });

    it('mendukung validasi direct capabilities array jika tersedia', () => {
      const directCapContext = {
        status_akun: 'active' as const,
        status_organisasi: 'active' as const,
        assigned_profiles: [],
        allowed_overrides: [],
        denied_overrides: [],
        capabilities: ['hub.access', 'notes.view'],
      } as unknown as PermissionContext;

      expect(hasCapability(directCapContext, 'hub.access')).toBe(true);
      expect(hasCapability(directCapContext, 'notes.view')).toBe(true);
      expect(hasCapability(directCapContext, 'events.delete')).toBe(false);
    });
  });

  describe('2. Canonical AuthUser Normalization', () => {
    it('harus menormalisasi payload mentah dari POST /api/auth/login menjadi AuthUser valid', () => {
      const rawLoginPayload = {
        id: 'acc-zidna-uuid',
        ptv_id: 'PTV-025',
        full_name: 'Zidna Santri',
        username: 'zidna',
        status_akun: 'active',
        assigned_profiles: ['crew'],
        capabilities: ['hub.access', 'notes.view'],
      };

      const normalized = normalizeAuthUser(rawLoginPayload);
      expect(normalized).not.toBeNull();
      expect(normalized?.ptv_id).toBe('PTV-025');
      expect(normalized?.status_akun).toBe('active');
      expect(normalized?.status_organisasi).toBe('active');
      expect(Array.isArray(normalized?.assigned_profiles)).toBe(true);
      expect(Array.isArray(normalized?.allowed_overrides)).toBe(true);
      expect(Array.isArray(normalized?.denied_overrides)).toBe(true);
      expect(Array.isArray(normalized?.capabilities)).toBe(true);

      // Pastikan policy engine dapat mengevaluasi user yang dinormalisasi tanpa error
      expect(hasCapability(normalized, 'hub.access')).toBe(true);
      expect(hasCapability(normalized, 'notes.view')).toBe(true);
      expect(hasCapability(normalized, 'events.delete')).toBe(false);
    });

    it('harus menormalisasi payload mentah dari GET /api/auth/session', () => {
      const rawSessionPayload = {
        id: 'acc-exec-uuid',
        ptv_id: 'PTV-001',
        full_name: 'Ahmad Executive',
        username: 'eksekutif',
        avatar_url: 'https://example.com/avatar.jpg',
        division: 'Leadership',
        position: 'Ketua Umum',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['eksekutif'],
        capabilities: ['hub.access', 'events.create'],
      };

      const normalized = normalizeAuthUser(rawSessionPayload);
      expect(normalized).not.toBeNull();
      expect(normalized?.organization).toBe('PTV Studio');
      expect(normalized?.allowed_overrides).toEqual([]);
      expect(normalized?.denied_overrides).toEqual([]);
      expect(hasCapability(normalized, 'events.create')).toBe(true);
    });

    it('fail-closed: harus mengembalikan null jika identitas id atau ptv_id tidak ada', () => {
      expect(normalizeAuthUser(null)).toBeNull();
      expect(normalizeAuthUser({})).toBeNull();
      expect(normalizeAuthUser({ username: 'ghost' })).toBeNull();
      expect(normalizeAuthUser({ id: 'some-id' })).toBeNull();
    });
  });

  describe('3. ProtectedRoute Robustness & Clean Navigation', () => {
    it('harus menampilkan LoadingState ketika session sedang dimuat', () => {
      useSessionStore.setState({
        session: null,
        user: null,
        isLoading: true,
      });

      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/catatan']}>
          <ProtectedRoute>
            <div>Konten Catatan Bersama</div>
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(html).toContain('Memeriksa sesi Anda...');
      expect(html).toContain('ptv-splash-logo');
      expect(html).not.toContain('Konten Catatan Bersama');
    });

    it('harus me-redirect ke /hub/login jika session telah kedaluwarsa (expired)', () => {
      const expiredSession = {
        access_token: 'expired-token',
        expires_at: Date.now() - 10000, // 10 detik lalu
        user: {
          id: 'acc-1',
          ptv_id: 'PTV-025',
          full_name: 'Zidna',
          username: 'zidna',
          organization: 'PTV Studio',
          division: 'Tech',
          position: 'Crew',
          status_akun: 'active' as const,
          status_organisasi: 'active' as const,
          assigned_profiles: ['crew' as const],
          allowed_overrides: [],
          denied_overrides: [],
        },
      };

      useSessionStore.setState({
        session: expiredSession,
        user: expiredSession.user,
        isLoading: false,
      });

      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/catatan']}>
          <ProtectedRoute>
            <div>Konten Catatan Bersama</div>
          </ProtectedRoute>
        </MemoryRouter>
      );

      // Konten internal tidak boleh bocor saat sesi kedaluwarsa
      expect(html).not.toContain('Konten Catatan Bersama');
    });

    it('harus mengizinkan akses ke /hub/catatan jika sesi login form valid dan berizin', () => {
      const rawUser = {
        id: 'acc-login-form',
        ptv_id: 'PTV-025',
        full_name: 'Zidna Santri',
        username: 'zidna',
        status_akun: 'active',
        assigned_profiles: ['crew'],
        capabilities: ['hub.access', 'notes.view'],
      };

      const user = normalizeAuthUser(rawUser)!;
      useSessionStore.setState({
        session: {
          access_token: 'valid-token',
          expires_at: Date.now() + 3600000,
          user,
        },
        user,
        isLoading: false,
      });

      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/catatan']}>
          <Routes>
            <Route
              path="/hub/catatan"
              element={
                <ProtectedRoute requiredCapability="hub.access">
                  <div>Konten Catatan Bersama Resmi</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(html).toContain('Konten Catatan Bersama Resmi');
    });

    it('harus menolak akses dengan kartu pembatasan jika capability tidak mencukupi', () => {
      const rawUser = {
        id: 'acc-crew-only',
        ptv_id: 'PTV-025',
        full_name: 'Zidna Kru',
        username: 'zidna',
        status_akun: 'active',
        assigned_profiles: ['crew'],
        capabilities: ['hub.access', 'notes.view'],
      };

      const user = normalizeAuthUser(rawUser)!;
      useSessionStore.setState({
        session: {
          access_token: 'valid-token',
          expires_at: Date.now() + 3600000,
          user,
        },
        user,
        isLoading: false,
      });

      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/eksekutif-only']}>
          <Routes>
            <Route
              path="/hub/eksekutif-only"
              element={
                <ProtectedRoute requiredCapability="events.delete">
                  <div>Area Eksekutif Super Sensitif</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(html).not.toContain('Area Eksekutif Super Sensitif');
      expect(html).toContain('Akses Dibatasi');
      expect(html).toContain('Memerlukan capability:');
      expect(html).toContain('events.delete');
    });
  });
});
