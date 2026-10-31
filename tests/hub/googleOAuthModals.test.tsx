import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@app/router/LoginPage';
import { useSessionStore } from '@core/session';
import type { AuthUser } from '@core/auth/types';

describe('Google OAuth Feedback Modals in LoginPage', () => {
  const verifiedUser: AuthUser = {
    id: 'user-025',
    ptv_id: 'PTV-025',
    full_name: 'Zidna Santri',
    username: 'zidna',
    division: 'Technical',
    position: 'Lead Engineer',
    organization: 'Progresif TV',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['crew'],
    allowed_overrides: ['hub.access'],
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

  it('1. should render Unlinked Account Modal when auth_status=unlinked', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/login?auth_status=unlinked&dev_sub=google-sub-999']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(html).toContain('id="authFeedbackModal"');
    expect(html).toContain('Akun Belum Terdaftar');
    expect(html).toContain('Akun Google ini belum terhubung dengan akun resmi Progresif TV.');
    expect(html).toContain('Coba Akun Google Lain');
    expect(html).toContain('Tutup');
  });

  it('2. should render Access Denied Modal when auth_status=access_denied without leaking internals', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/login?auth_status=access_denied']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(html).toContain('id="authFeedbackModal"');
    expect(html).toContain('Akses Ditolak');
    expect(html).toContain('belum memiliki izin mengakses PTV Hub.');
    expect(html).toContain('Gunakan Akun Lain');
    expect(html).not.toContain('hub.access');
    expect(html).not.toContain('SELECT');
  });

  it('3. should render Cancelled Modal when auth_status=cancelled', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/login?auth_status=cancelled']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(html).toContain('id="authFeedbackModal"');
    expect(html).toContain('Login Dibatalkan');
    expect(html).toContain('Autentikasi akun Google telah dibatalkan oleh pengguna.');
    expect(html).toContain('Coba Lagi');
  });

  it('4. should render State/Session Error Modal when auth_status=state_error', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/login?auth_status=state_error']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(html).toContain('id="authFeedbackModal"');
    expect(html).toContain('Sesi Tidak Valid');
    expect(html).toContain('Sesi autentikasi telah kedaluwarsa atau verifikasi keamanan tidak cocok');
    expect(html).toContain('Coba Lagi');
  });

  it('5. should render Generic Error Modal when auth_status=error', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/login?auth_status=error']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(html).toContain('id="authFeedbackModal"');
    expect(html).toContain('Gagal Masuk');
    expect(html).toContain('Terjadi kesalahan saat memproses autentikasi Google.');
    expect(html).toContain('Coba Lagi');
  });

  it('6. should render Success Modal displaying verified user badge when session is confirmed', () => {
    useSessionStore.setState({
      session: {
        access_token: 'test-token',
        expires_at: Date.now() + 3600000,
        user: verifiedUser,
      },
      user: verifiedUser,
      isLoading: false,
    });

    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/login?auth_status=success&returnTo=%2Fhub%2Finventaris']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(html).toContain('id="authFeedbackModal"');
    expect(html).toContain('Login Berhasil!');
    expect(html).toContain('Selamat datang kembali di PTV Hub.');
    expect(html).toContain('Zidna Santri');
    expect(html).toContain('PTV-025');
    expect(html).toContain('Masuk ke Dashboard');
  });

  it('7. should maintain accessibility attributes on modal container', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/login?auth_status=unlinked']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="feedbackModalTitle"');
  });
});
