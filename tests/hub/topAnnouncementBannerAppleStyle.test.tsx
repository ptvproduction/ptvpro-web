import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TopAnnouncementBanner, getJakartaDateString } from '@/products/hub/shell/TopAnnouncementBanner';
import { broadcastStore } from '@/products/hub/broadcast/broadcastStore';
import { useSessionStore } from '@/core/session';
import { AuthUser } from '@/core/auth/types';

const mockUser: AuthUser = {
  id: 'usr-test-apple-banner',
  ptv_id: 'PTV-APPLE-01',
  username: 'zidnal_operator',
  full_name: 'Zidnal Operator',
  division: 'Teknik',
  position: 'Lead Engineer',
  organization: 'Progresif TV',
  status_akun: 'active',
  status_organisasi: 'active',
  assigned_profiles: ['eksekutif', 'crew'],
  allowed_overrides: [],
  denied_overrides: [],
};

describe('TopAnnouncementBanner — Apple-Style Refinement', () => {
  beforeEach(() => {
    broadcastStore.resetToDefaults();
    useSessionStore.setState({
      user: mockUser,
      session: {
        access_token: 'test-token',
        expires_at: Date.now() + 86400000,
        user: mockUser,
      },
    });

    // Set 2 mock pengumuman aktif untuk verifikasi pager dan multi-items
    broadcastStore.setLiveAnnouncements([
      {
        id: 'ann-apple-001',
        title: 'Pemeliharaan Server Utama',
        body: 'Server studio akan menjalani pembaruan rutin pukul 23:00 WIB.',
        prio: 'penting',
        color_theme: 'orange',
        by: 'Admin PTV',
        date: '2026-10-30',
        created_at: Date.now(),
        berlaku_sampai: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: 'ann-apple-002',
        title: 'Jadwal Siaran Baru',
        body: 'Format rundown baru mulai diterapkan pekan depan.',
        prio: 'normal',
        color_theme: 'blue',
        by: 'Admin PTV',
        date: '2026-10-30',
        created_at: Date.now(),
        berlaku_sampai: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);
  });

  afterEach(() => {
    broadcastStore.resetToDefaults();
  });

  it('1. Render banner dengan skema gradien dan tekstur noise Apple-style', () => {
    const html = renderToString(<TopAnnouncementBanner />);
    expect(html).toContain('id="ptvGlobalNotificationBar"');
    // Ambient noise filter check (data URI SVG)
    expect(html).toContain('fractalNoise');
    // Ambient top reflection line
    expect(html).toContain('linear-gradient(90deg, transparent 0%');
  });

  it('2. Desktop Layout: Kontrol minimalis Apple HIG, subtle category badge, text link Buka, dan pager', () => {
    const html = renderToString(<TopAnnouncementBanner />);
    expect(html).toContain('ptv-banner-desktop-layout');

    // Subtle category badge
    expect(html).toContain('Penting');

    // Judul dan body
    expect(html).toContain('Pemeliharaan Server Utama');
    expect(html).toContain('Server studio akan menjalani pembaruan rutin pukul 23:00 WIB.');

    // Apple-style Refined Text Action Link "Buka" (text + chevron)
    expect(html).toContain('>Buka</span>');
    expect(html).toContain('fa-chevron-right');

    // Minimalist Apple-style Pager "1 dari 2"
    expect(html).toMatch(/1<!-- --> dari <!-- -->2|1 dari 2/);

    // Close button dengan touch target nyaman
    expect(html).toContain('aria-label="Tutup pengumuman hari ini"');
    expect(html).toContain('fa-xmark');
  });

  it('3. Mobile Layout: Susunan single-row ultra-compact, Judul WAJIB terlihat jelas', () => {
    const html = renderToString(<TopAnnouncementBanner />);
    expect(html).toContain('ptv-banner-mobile-layout');

    // Memuat badge dan JUDUL TEBAL (strong)
    expect(html).toContain('Pemeliharaan Server Utama');
    expect(html).toContain('font-weight:700;color:#ffffff;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1');

    // Close button memiliki touch target yang nyaman
    expect(html).toContain('width:30px;height:30px');

    // Memuat pager "1/2" dan link "Buka"
    expect(html).toMatch(/1<!-- -->\/<!-- -->2|1\/2/);
    expect(html).toContain('>Buka</span>');
  });

  it('4. Format tanggal zona waktu Jakarta dihitung akurat', () => {
    const todayJakarta = getJakartaDateString();
    expect(todayJakarta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
