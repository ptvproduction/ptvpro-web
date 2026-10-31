import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { broadcastStore, DEFAULT_ANNOUNCEMENTS } from '@/products/hub/broadcast/broadcastStore';
import { BroadcastPage } from '@/products/hub/broadcast/BroadcastPage';
import { PengaturanPage } from '@/products/hub/pengaturan/PengaturanPage';
import { useSessionStore } from '@/core/session';
import { hasCapability } from '@/core/policy/policyEngine';
import { AuthUser } from '@/core/auth/types';

describe('Broadcast & Pengaturan Modules (Batch 6B)', () => {
  const mockEksekutif: AuthUser = {
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

  const mockCrew: AuthUser = {
    id: 'user-025',
    ptv_id: 'PTV-025',
    full_name: 'Zidna Santri',
    username: 'zidna_crew',
    division: 'Produksi',
    position: 'Kru Kamera',
    organization: 'Progresif TV',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['crew'],
    allowed_overrides: [],
    denied_overrides: [],
  };

  beforeEach(() => {
    broadcastStore.resetToDefaults();
    useSessionStore.setState({
      user: mockEksekutif,
      session: {
        access_token: 'test-token',
        expires_at: Date.now() + 86400000,
        user: mockEksekutif,
      },
      isLoading: false,
    });
  });

  describe('Broadcast Store & CRUD Operations', () => {
    it('memuat data pengumuman awal (seeds) secara benar', () => {
      const items = broadcastStore.getAnnouncements();
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0].title).toBe('Dasbor sudah bisa digunakan!');
      expect(items[0].prio).toBe('penting');
    });

    it('dapat menambahkan pengumuman baru di urutan paling atas', () => {
      const newAnn = broadcastStore.addAnnouncement({
        title: 'Pengumuman Uji Operasional',
        body: 'Rincian pengumuman uji coba operasional studio.',
        prio: 'normal',
        by: 'Ahmad Executive',
      });

      expect(newAnn.id).toBeDefined();
      expect(newAnn.title).toBe('Pengumuman Uji Operasional');

      const items = broadcastStore.getAnnouncements();
      expect(items[0].id).toBe(newAnn.id);
      expect(items[0].title).toBe('Pengumuman Uji Operasional');
    });

    it('dapat memperbarui judul, isi, dan prioritas pengumuman', () => {
      const items = broadcastStore.getAnnouncements();
      const targetId = items[0].id;

      const success = broadcastStore.updateAnnouncement(targetId, {
        title: 'Judul Diperbarui',
        body: 'Isi diperbarui secara lengkap.',
        prio: 'normal',
      });

      expect(success).toBe(true);
      const updated = broadcastStore.getAnnouncementById(targetId);
      expect(updated?.title).toBe('Judul Diperbarui');
      expect(updated?.prio).toBe('normal');
    });

    it('dapat menghapus pengumuman dan mengembalikan false jika ID tidak ditemukan', () => {
      const items = broadcastStore.getAnnouncements();
      const initialCount = items.length;
      const targetId = items[0].id;

      const deleted = broadcastStore.deleteAnnouncement(targetId);
      expect(deleted).toBe(true);
      expect(broadcastStore.getAnnouncements().length).toBe(initialCount - 1);

      const deletedAgain = broadcastStore.deleteAnnouncement('non-existent-id');
      expect(deletedAgain).toBe(false);
    });

    it('mengirimkan notifikasi ke subscriber saat terjadi perubahan data (Beranda synchronization)', () => {
      let callCount = 0;
      const unsubscribe = broadcastStore.subscribe(() => {
        callCount++;
      });

      broadcastStore.addAnnouncement({
        title: 'Notif Sync Test',
        body: 'Pengujian sinkronisasi subscriber.',
        prio: 'normal',
      });

      expect(callCount).toBe(1);

      broadcastStore.updateAnnouncement(DEFAULT_ANNOUNCEMENTS[0].id, {
        title: 'Title Changed',
      });
      expect(callCount).toBe(2);

      broadcastStore.deleteAnnouncement(DEFAULT_ANNOUNCEMENTS[0].id);
      expect(callCount).toBe(3);

      unsubscribe();
      broadcastStore.resetToDefaults();
      // Should not trigger listener after unsubscribe
      expect(callCount).toBe(3);
    });
  });

  describe('Broadcast RBAC & Capabilities', () => {
    it('memvalidasi hak akses broadcast.view untuk seluruh kru dan pembina', () => {
      expect(hasCapability(mockCrew, 'broadcast.view')).toBe(true);
      expect(hasCapability(mockEksekutif, 'broadcast.view')).toBe(true);
    });

    it('membatasi hak akses broadcast.dispatch hanya untuk peran eksekutif', () => {
      expect(hasCapability(mockEksekutif, 'broadcast.dispatch')).toBe(true);
      expect(hasCapability(mockCrew, 'broadcast.dispatch')).toBe(false);
    });

    it('merender tombol Buat Pengumuman untuk eksekutif dan menyembunyikannya untuk kru reguler', () => {
      // Eksekutif
      useSessionStore.setState({ user: mockEksekutif });
      const execHtml = renderToString(
        <MemoryRouter>
          <BroadcastPage currentUser={mockEksekutif} />
        </MemoryRouter>
      );
      expect(execHtml).toContain('Buat Pengumuman');

      // Kru
      useSessionStore.setState({ user: mockCrew });
      const crewHtml = renderToString(
        <MemoryRouter>
          <BroadcastPage currentUser={mockCrew} />
        </MemoryRouter>
      );
      expect(crewHtml).not.toContain('data-act="newAnn"');
    });
  });

  describe('Pengaturan Profil & Keamanan Akun', () => {
    it('merender identitas akun dan nomor ID PTV secara read-only', () => {
      const html = renderToString(
        <MemoryRouter>
          <PengaturanPage currentUser={mockEksekutif} />
        </MemoryRouter>
      );

      expect(html).toContain('Ahmad Executive');
      expect(html).toContain('ahmad_exec');
      expect(html).toContain('PTV-001');
      expect(html).toContain('Eksekutif');
      expect(html).toContain('Aktif');
      expect(html).toContain('Username dan ID PTV dikelola secara terpusat oleh administrator.');
    });

    it('merender URL target verifikasi QR sesuai spesifikasi identitas publik', () => {
      const html = renderToString(
        <MemoryRouter>
          <PengaturanPage currentUser={mockEksekutif} />
        </MemoryRouter>
      );

      expect(html).toContain('Buka Verifikasi');
      expect(html).toContain('ID QR Saya');
      expect(html).toContain('PTV-001');
    });

    it('menampilkan status peringatan jika ID PTV belum diterbitkan untuk akun', () => {
      const userWithoutPtvId: AuthUser = {
        ...mockCrew,
        ptv_id: '',
      };

      const html = renderToString(
        <MemoryRouter>
          <PengaturanPage currentUser={userWithoutPtvId} />
        </MemoryRouter>
      );

      expect(html).toContain('ID PTV belum tersedia');
      expect(html).toContain('Nomor identitas belum diterbitkan untuk akun ini');
    });

    it('memvalidasi hak akses settings.personal dan settings.system', () => {
      expect(hasCapability(mockCrew, 'settings.personal')).toBe(true);
      expect(hasCapability(mockEksekutif, 'settings.personal')).toBe(true);

      expect(hasCapability(mockEksekutif, 'settings.system')).toBe(true);
      expect(hasCapability(mockCrew, 'settings.system')).toBe(false);
    });

    it('merender bagian keamanan akun dengan form password dan Google SSO disclaimer', () => {
      const html = renderToString(
        <MemoryRouter>
          <PengaturanPage currentUser={mockEksekutif} />
        </MemoryRouter>
      );

      expect(html).toContain('Password Saat Ini');
      expect(html).toContain('Password Baru');
      expect(html).toContain('Konfirmasi Password Baru');
      expect(html).toContain('Simpan Password Baru');
      expect(html).toContain('Google SSO / OAuth');
      expect(html).toContain('Belum Terhubung');
    });
  });
});
