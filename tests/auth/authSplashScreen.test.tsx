import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AuthSplashScreen } from '@shared/components';

describe('AuthSplashScreen Component', () => {
  it('harus me-render splash screen default dengan logo, subtitle, dan progress bar', () => {
    const html = renderToString(<AuthSplashScreen />);

    expect(html).toContain('ptv-splash-screen');
    expect(html).toContain('ptv-splash-logo');
    expect(html).toContain('Ruang kerja digital Progresif TV');
    expect(html).toContain('ptv-splash-progress-track');
    expect(html).toContain('ptv-splash-progress-bar');
    expect(html).toContain('Memeriksa sesi Anda...');
    expect(html).toContain('role="status"');
    expect(html).toContain('role="progressbar"');
  });

  it('harus menerima custom message jika disediakan', () => {
    const html = renderToString(
      <AuthSplashScreen message="Memulihkan sesi pengguna..." />
    );

    expect(html).toContain('Memulihkan sesi pengguna...');
    expect(html).not.toContain('Memeriksa sesi Anda...');
  });

  it('dapat menyembunyikan subtitle jika bernilai null', () => {
    const html = renderToString(
      <AuthSplashScreen subtitle={null} />
    );

    expect(html).not.toContain('Ruang kerja digital Progresif TV');
    expect(html).toContain('Memeriksa sesi Anda...');
    expect(html).toContain('ptv-splash-logo');
  });
});
