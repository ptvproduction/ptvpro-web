import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { UniversalSearchModal } from '../../src/products/hub/shell/UniversalSearchModal';
import { NotificationCenterModal } from '../../src/products/hub/shell/NotificationCenterModal';
import { UserProfileMenuModal } from '../../src/products/hub/shell/UserProfileMenuModal';
import { HubShell } from '../../src/products/hub/shell/HubShell';
import { useSessionStore } from '@core/session';
import type { AuthUser } from '../../src/core/auth/types';

const mockUser: AuthUser = {
  id: 'usr-zidna-01',
  ptv_id: 'PTV-001',
  full_name: 'M. Zidna Ilma Roup',
  username: 'zidna',
  division: 'Technical & IT',
  position: 'Pimpinan Eksekutif',
  organization: 'Progresif TV',
  status_akun: 'active',
  status_organisasi: 'active',
  assigned_profiles: ['eksekutif'],
  allowed_overrides: ['hub.access', 'inventory.view', 'crew.view', 'events.view', 'notes.view', 'documents.view', 'settings.personal', 'settings.system'],
  denied_overrides: [],
};

describe('Hub Header Features: Search, Notifikasi, Profile Menu (Tahap B & D)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      user: mockUser,
      session: {
        access_token: 'valid-test-token',
        expires_at: Date.now() + 3600000,
        user: mockUser,
      },
      isLoading: false,
      error: null,
    });
  });

  /* ─────────────────────────────────────────────────────────────
     1. GLOBAL SEARCH
     ───────────────────────────────────────────────────────────── */
  describe('1. Global Universal Search Modal', () => {
    it('1.1 Harus merender modal pencarian desktop ketika isOpen=true dengan placeholder dan hint 1:1 legacy', () => {
      const html = renderToString(
        <MemoryRouter>
          <UniversalSearchModal isOpen={true} onClose={() => {}} isMobile={false} />
        </MemoryRouter>
      );

      expect(html).toContain('Pencarian');
      expect(html).toContain('Acara, alat, kru, surat, catatan…');
      expect(html).toContain('Ketik minimal 2 huruf. Hasil dikelompokkan per kategori.');
      expect(html).toContain('searchbar');
    });

    it('1.2 Harus merender mobile search overlay ketika isMobile=true', () => {
      const html = renderToString(
        <MemoryRouter>
          <UniversalSearchModal isOpen={true} onClose={() => {}} isMobile={true} />
        </MemoryRouter>
      );

      expect(html).toContain('mobile-search-overlay on');
      expect(html).toContain('mso-container');
      expect(html).toContain('Cari kru, alat, acara, catatan, surat...');
      expect(html).toContain('mso-close-btn');
      expect(html).toContain('Tutup');
    });

    it('1.3 Tidak merender DOM ketika isOpen=false', () => {
      const html = renderToString(
        <MemoryRouter>
          <UniversalSearchModal isOpen={false} onClose={() => {}} />
        </MemoryRouter>
      );

      expect(html).toBe('');
    });
  });

  /* ─────────────────────────────────────────────────────────────
     2. NOTIFICATION CENTER
     ───────────────────────────────────────────────────────────── */
  describe('2. Notification Center Modal', () => {
    it('2.1 Menampilkan layout notifikasi 1:1 legacy dengan judul dan tombol aksi', () => {
      const html = renderToString(
        <MemoryRouter>
          <NotificationCenterModal isOpen={true} onClose={() => {}} />
        </MemoryRouter>
      );

      expect(html).toContain('Notifikasi');
      expect(html).toContain('Tandai dibaca');
      expect(html).toContain('Hapus Semua');
      expect(html).toContain('sheet on');
    });

    it('2.2 Tidak merender DOM ketika isOpen=false', () => {
      const html = renderToString(
        <MemoryRouter>
          <NotificationCenterModal isOpen={false} onClose={() => {}} />
        </MemoryRouter>
      );

      expect(html).toBe('');
    });
  });

  /* ─────────────────────────────────────────────────────────────
     3. USER PROFILE MENU
     ───────────────────────────────────────────────────────────── */
  describe('3. User Profile Menu Modal', () => {
    it('3.1 Menampilkan avatar inisial, nama lengkap, identitas kru, dan role badge', () => {
      const html = renderToString(
        <MemoryRouter>
          <UserProfileMenuModal
            isOpen={true}
            onClose={() => {}}
            onToggleTheme={() => {}}
            isDark={false}
            user={mockUser}
          />
        </MemoryRouter>
      );

      expect(html).toContain('Akun');
      expect(html).toContain('MZ'); // Inisial M. Zidna
      expect(html).toContain('M. Zidna Ilma Roup');
      expect(html).toContain('PTV-001 — Technical &amp; IT');
      expect(html).toContain('Pimpinan Eksekutif');
    });

    it('3.2 Menampilkan item menu aksi 1:1 legacy: ID digital, Dokumen, Pengaturan, Tema, dan Logout', () => {
      const html = renderToString(
        <MemoryRouter>
          <UserProfileMenuModal
            isOpen={true}
            onClose={() => {}}
            onToggleTheme={() => {}}
            isDark={false}
            user={mockUser}
          />
        </MemoryRouter>
      );

      expect(html).toContain('Kartu identitas digital');
      expect(html).toContain('Dokumen saya');
      expect(html).toContain('Pengaturan');
      expect(html).toContain('Ganti mode');
      expect(html).toContain('Keluar akun');
      expect(html).toContain('Akhiri sesi login di perangkat ini');
    });
  });

  /* ─────────────────────────────────────────────────────────────
     4. HEADER BUTTONS & INTEGRASI DI HUBSHELL
     ───────────────────────────────────────────────────────────── */
  describe('4. HubShell Header Integration', () => {
    it('4.1 Memastikan tombol search bar, icon mobile search, icon bell, dan avatar profile terhubung pada header', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/hub/beranda']}>
          <HubShell />
        </MemoryRouter>
      );

      // Search bar desktop
      expect(html).toContain('class="hdr-search"');
      expect(html).toContain('Cari acara, alat, kru, surat…');
      expect(html).toContain('<kbd>/</kbd>');

      // Mobile search button
      expect(html).toContain('aria-label="Cari"');

      // Notification button & badge
      expect(html).toContain('aria-label="Notifikasi"');
      expect(html).toContain('id="notifDot"');

      // Profile avatar button
      expect(html).toContain('aria-label="Profil"');
      expect(html).toContain('icon-btn-profile');
      expect(html).toContain('class="avatar sm"');
    });
  });
});
