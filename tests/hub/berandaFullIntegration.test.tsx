import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BerandaPage } from '../../src/products/hub/beranda/BerandaPage';
import {
  filterUpcomingEvents,
  filterMyActiveLoans,
  formatRelDay,
  getGreeting,
  getWibCurrentInfo,
} from '../../src/products/hub/beranda/berandaDataUtils';
import { berandaService } from '../../src/products/hub/beranda/berandaService';
import { useSessionStore } from '../../src/core/session';
import type { AcaraItem } from '../../src/products/hub/acara/types';
import type { PeminjamanRecord } from '../../src/products/hub/peminjaman/types';
import type { AuthUser } from '../../src/core/auth/types';

// Mock broadcast hook
vi.mock('../../src/products/hub/broadcast', () => ({
  useBroadcastAnnouncements: () => ({
    announcements: [
      {
        id: 'bc-live-1',
        title: 'SOP Baru Peminjaman Kamera Sony FX3',
        body: 'Wajib melakukan check fisik sebelum dan sesudah produksi.',
        by: 'Kepala Studio',
        date: '18 Okt 2026',
        prio: 'penting',
      },
      {
        id: 'bc-live-2',
        title: 'Jadwal Piket Kebersihan Studio 2',
        body: 'Harap kru shift sore merapikan kabel sebelum pulang.',
        by: 'Admin Operasional',
        date: '17 Okt 2026',
        prio: 'normal',
      },
    ],
  }),
}));

// Mock optional acara context
vi.mock('../../src/products/hub/acara/context/AcaraContext', () => ({
  useOptionalAcara: () => null,
  AcaraProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function createMockAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'crew-001',
    ptv_id: 'PTV-001',
    full_name: 'Zidna Kru Utama',
    username: 'zidna',
    division: 'Teknis & Studio',
    position: 'Kru Utama',
    organization: 'Progresif TV',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['crew'],
    allowed_overrides: [],
    denied_overrides: [],
    ...overrides,
  };
}

describe('PTVPRO — P0 Beranda Data Integration & Utility Tests', () => {
  const mockUser = createMockAuthUser();
  const mockOtherUser = createMockAuthUser({
    id: 'crew-999',
    ptv_id: 'PTV-999',
    full_name: 'Budi Kru Tamu',
    username: 'budi',
  });

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
    });
  });

  describe('1. Beranda Data Utils — Timezone WIB & Dynamic Greeting', () => {
    it('menghitung tanggal hari ini dan besok dalam zona waktu Asia/Jakarta (WIB)', () => {
      const info = getWibCurrentInfo();
      expect(info.todayIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(info.tomorrowIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(info.currentHour).toBeGreaterThanOrEqual(0);
      expect(info.currentHour).toBeLessThanOrEqual(23);
    });

    it('menentukan salam dinamis sesuai jam WIB', () => {
      expect(getGreeting(6)).toBe('Selamat Pagi');
      expect(getGreeting(11)).toBe('Selamat Siang');
      expect(getGreeting(15)).toBe('Selamat Sore');
      expect(getGreeting(20)).toBe('Selamat Malam');
    });

    it('formatRelDay menghasilkan Hari ini, Besok, atau nama hari/tanggal', () => {
      expect(formatRelDay('2026-10-18', '2026-10-18', '2026-10-19')).toBe('Hari ini');
      expect(formatRelDay('2026-10-19', '2026-10-18', '2026-10-19')).toBe('Besok');
      const formatted = formatRelDay('2026-10-25', '2026-10-18', '2026-10-19');
      expect(formatted).toContain('Okt');
    });
  });

  describe('2. Beranda Data Utils — Agenda / Acara Filtering & Sorting', () => {
    const rawEvents: AcaraItem[] = [
      {
        id: 'evt-past',
        name: 'Acara Minggu Lalu',
        date: '2026-10-10',
        time: '09:00',
        loc: 'Studio 1',
        status: 'Selesai',
        notes: 'Sudah lewat',
        crew: [],
        gear: [],
        rundown: [],
        type: 'external',
        created_at: '2026-10-01',
      },
      {
        id: 'evt-selesai-today',
        name: 'Acara Pagi Hari Ini yang Sudah Selesai',
        date: '2026-10-18',
        time: '08:00',
        loc: 'Studio 2',
        status: 'Selesai',
        notes: 'Selesai tadi pagi',
        crew: [],
        gear: [],
        rundown: [],
        type: 'external',
        created_at: '2026-10-01',
      },
      {
        id: 'evt-batal',
        name: 'Acara Dibatalkan',
        date: '2026-10-22',
        time: '10:00',
        loc: 'Ruang Rapat',
        status: 'Dibatalkan',
        notes: 'Batal',
        crew: [],
        gear: [],
        rundown: [],
        type: 'internal',
        created_at: '2026-10-01',
      },
      {
        id: 'evt-future-2',
        name: 'Wisuda Politeknik Sesi 2',
        date: '2026-10-21',
        time: '13:00',
        loc: 'Auditorium',
        status: 'Mendatang',
        notes: 'Sesi siang',
        crew: [],
        gear: [],
        rundown: [],
        type: 'external',
        created_at: '2026-10-01',
      },
      {
        id: 'evt-future-1',
        name: 'Wisuda Politeknik Sesi 1',
        date: '2026-10-20',
        time: '08:00',
        loc: 'Auditorium',
        status: 'Mendatang',
        notes: 'Sesi pagi',
        crew: [],
        gear: [],
        rundown: [],
        type: 'external',
        created_at: '2026-10-01',
      },
    ];

    it('hanya mengambil acara aktif mendatang (>= todayIso) dan mengecualikan Selesai/Batal', () => {
      const todayIso = '2026-10-18';
      const upcoming = filterUpcomingEvents(rawEvents, todayIso);

      // Harus mengembalikan 2 event valid, dan mengabaikan evt-past, evt-selesai-today, dan evt-batal
      expect(upcoming).toHaveLength(2);
      expect(upcoming.find((e) => e.id === 'evt-past')).toBeUndefined();
      expect(upcoming.find((e) => e.id === 'evt-selesai-today')).toBeUndefined();
      expect(upcoming.find((e) => e.id === 'evt-batal')).toBeUndefined();

      // Terurut dari tanggal dan jam paling dekat terlebih dahulu
      expect(upcoming[0].id).toBe('evt-future-1');
      expect(upcoming[1].id).toBe('evt-future-2');
      expect(upcoming[0].time).toBe('08:00');
    });
  });

  describe('3. Beranda Data Utils — Alat Saya Filtering & Zero Data Leakage', () => {
    const rawLoans: PeminjamanRecord[] = [
      {
        id: 'loan-zidna-1',
        transaction_id: 'TRX-202610-101',
        unit_id: 'u-fx3-1',
        kode_unit: 'CAM-01',
        nama_alat: 'Sony FX3 Cinema Line',
        peminjam_nama: 'Zidna Kru Utama',
        actor_id: 'crew-001',
        tanggal_pinjam: '2026-10-18',
        tenggat_kembali: '2026-10-19',
        keperluan: 'Liputan Dies Natalis',
        status: 'dipinjam',
        kategori: 'Kamera',
        created_at: '2026-10-18T08:00:00Z',
      },
      {
        id: 'loan-zidna-returned',
        transaction_id: 'TRX-202610-102',
        unit_id: 'u-mic-1',
        kode_unit: 'MIC-02',
        nama_alat: 'Rode Wireless GO II',
        peminjam_nama: 'Zidna Kru Utama',
        actor_id: 'crew-001',
        tanggal_pinjam: '2026-10-10',
        tenggat_kembali: '2026-10-11',
        tanggal_kembali: '2026-10-11',
        keperluan: 'Podcast Internal',
        status: 'dikembalikan',
        kategori: 'Audio',
        created_at: '2026-10-10T08:00:00Z',
      },
      {
        id: 'loan-budi-other',
        transaction_id: 'TRX-202610-103',
        unit_id: 'u-c70-1',
        kode_unit: 'CAM-02',
        nama_alat: 'Canon Cinema C70',
        peminjam_nama: 'Budi Kru Tamu',
        actor_id: 'crew-999',
        tanggal_pinjam: '2026-10-18',
        tenggat_kembali: '2026-10-20',
        keperluan: 'Produksi Drama Musik',
        status: 'dipinjam',
        kategori: 'Kamera',
        created_at: '2026-10-18T09:00:00Z',
      },
    ];

    it('memfilter pinjaman HANYA untuk pengguna login yang belum dikembalikan (actor_id match)', () => {
      const myLoans = filterMyActiveLoans(rawLoans, mockUser, '2026-10-18', '2026-10-19');

      expect(myLoans).toHaveLength(1);
      expect(myLoans[0].name).toBe('Sony FX3 Cinema Line');
      expect(myLoans[0].unitCode).toBe('CAM-01');
      expect(myLoans[0].due.toLowerCase()).toContain('kembali');

      // Memastikan pinjaman yang sudah dikembalikan tidak masuk
      expect(myLoans.find((l) => l.name === 'Rode Wireless GO II')).toBeUndefined();

      // STRICT ZERO DATA LEAKAGE: Peminjaman milik Budi tidak boleh muncul pada Zidna
      expect(myLoans.find((l) => l.name === 'Canon Cinema C70')).toBeUndefined();
    });

    it('memastikan jika login sebagai Budi, hanya melihat alat milik Budi', () => {
      const budiLoans = filterMyActiveLoans(rawLoans, mockOtherUser, '2026-10-18', '2026-10-19');

      expect(budiLoans).toHaveLength(1);
      expect(budiLoans[0].name).toBe('Canon Cinema C70');
      expect(budiLoans.find((l) => l.name === 'Sony FX3 Cinema Line')).toBeUndefined();
    });

    it('jika pengguna tidak memiliki pinjaman aktif, mengembalikan array kosong', () => {
      const emptyUser = createMockAuthUser({
        id: 'crew-empty',
        ptv_id: 'PTV-EMPTY',
        full_name: 'Kru Baru',
        username: 'krubaru',
      });
      const emptyLoans = filterMyActiveLoans(rawLoans, emptyUser, '2026-10-18', '2026-10-19');
      expect(emptyLoans).toHaveLength(0);
    });
  });

  describe('4. Beranda Page Component Rendering Tests', () => {
    it('merender layout ContinuousSurface dengan 6 bento quick action links dan section cards', () => {
      const html = renderToString(
        <MemoryRouter>
          <BerandaPage />
        </MemoryRouter>
      );

      // Section Semantik Beranda
      expect(html).toContain('page');
      expect(html).toContain('hero');
      expect(html).toContain('bento-grid');

      // 6 Shortcut Bento Desktop
      expect(html).toContain('Generator Surat Izin');
      expect(html).toContain('Pinjam Alat');
      expect(html).toContain('Lapor Masalah');
      expect(html).toContain('Lost &amp; Found');
      expect(html).toContain('Surat Tugas');
      expect(html).toContain('ID Digital');

      // Navigasi Section Links
      expect(html).toContain('Lihat semua');
      expect(html).toContain('Riwayat');
      expect(html).toContain('Semua');
      expect(html).toContain('Buka');
    });

    it('tidak ada data dummy hardcoded yang tersisa di render Beranda', () => {
      const html = renderToString(
        <MemoryRouter>
          <BerandaPage />
        </MemoryRouter>
      );

      // Pastikan string mock hardcoded lama sudah dibersihkan dari initial state
      expect(html).not.toContain('Studio 1 — Gedung A');
      expect(html).not.toContain('Briefing Teknis PTV');
    });
  });

  describe('5. Beranda Service Real-Time Aggregation', () => {
    it('mengagregasi data dari 4 modul secara simultan tanpa database paralel', async () => {
      const data = await berandaService.getAggregatedData(mockUser);

      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('myLoans');
      expect(data).toHaveProperty('announcements');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('docStats');

      expect(Array.isArray(data.events)).toBe(true);
      expect(Array.isArray(data.myLoans)).toBe(true);
      expect(Array.isArray(data.announcements)).toBe(true);
      expect(typeof data.docStats.disetujui).toBe('number');
      expect(typeof data.docStats.menunggu).toBe('number');
    });
  });
});
