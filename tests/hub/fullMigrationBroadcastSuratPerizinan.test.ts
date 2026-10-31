import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleBroadcastApiRequest } from '../../api/_routes/broadcast';
import {
  mapSuratIzinToDoc,
  mapSuratTugasToDoc,
  mapSuratBarangToDoc,
  type RawSuratIzinDbRow,
  type RawSuratTugasDbRow,
  type RawSuratBarangDbRow,
} from '../../api/_routes/dokumen';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';
import { DEFAULT_ANNOUNCEMENTS } from '../../src/products/hub/broadcast/broadcastStore';
import { INITIAL_DOCS_FIXTURES } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

describe('PTVPRO — Full Migration Regression: Broadcast & Pengumuman, Surat & Arsip, Pengajuan Perizinan', () => {
  const authSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // MODUL 1: BROADCAST & PENGUMUMAN
  // ==========================================
  describe('Modul 1: Broadcast & Pengumuman (Auth, Staging Schema, Read-Only)', () => {
    it('1.1 DEFAULT_ANNOUNCEMENTS harus berisi 3 data kanonikal otentik Production/Staging', () => {
      expect(DEFAULT_ANNOUNCEMENTS.length).toBe(3);

      const ids = DEFAULT_ANNOUNCEMENTS.map((a) => a.id);
      expect(ids).toContain('b5194a18-f80f-46a7-b6f1-298bf57f3bfa');
      expect(ids).toContain('de9a5908-1d6c-4b77-bc8e-3ee32a50463d');
      expect(ids).toContain('5d0bca52-a98b-4da4-9f56-0c9890f1e3f0');

      const kasNotice = DEFAULT_ANNOUNCEMENTS.find((a) => a.id === '5d0bca52-a98b-4da4-9f56-0c9890f1e3f0');
      expect(kasNotice?.title).toBe('Ndang bayar kas, rek!');
      expect(kasNotice?.prio).toBe('penting');
      expect(kasNotice?.by).toBe('Redaksi PTV');
    });

    it('1.2 Endpoint /api/broadcast harus menolak akses tanpa sesi HttpOnly (401 Unauthorized)', async () => {
      const res = await handleBroadcastApiRequest({
        method: 'GET',
        url: '/api/broadcast',
        headers: {},
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Autentikasi sesi login Hub diperlukan');
    });

    it('1.3 Endpoint /api/broadcast harus menolak operasi mutasi POST/PUT/DELETE dengan 405 (Strict Read-Only)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const sessionPayload = {
        account_id: 'acc-admin-01',
        identity_id: 'ident-admin-01',
        ptv_id: 'PTV-2026-001',
        full_name: 'Administrator Studio',
        username: 'admin',
        status_akun: 'active' as const,
        status_organisasi: 'active' as const,
        assigned_profiles: ['administrator'],
        capabilities: ['hub.access', 'broadcast.manage'],
        iat: now,
        exp: now + 3600,
      };
      const sessionToken = await signSessionToken(sessionPayload, authSecret);

      const res = await handleBroadcastApiRequest({
        method: 'POST',
        url: '/api/broadcast',
        headers: {
          cookie: `ptv_hub_session=${sessionToken}`,
          'content-type': 'application/json',
        },
      });

      expect(res.status).toBe(405);
      expect(res.body.error).toContain('Strict Read-Only');
    });
  });

  // ==========================================
  // MODUL 2: SURAT & ARSIP
  // ==========================================
  describe('Modul 2: Surat & Arsip (Mapping Kolom Nyata, Nomor Surat Historis)', () => {
    it('2.1 INITIAL_DOCS_FIXTURES harus berisi 2 surat resmi otentik dari ptv_surat_izin', () => {
      expect(INITIAL_DOCS_FIXTURES.length).toBe(2);

      const noList = INITIAL_DOCS_FIXTURES.map((d) => d.no);
      expect(noList).toContain('001/SI-PTV/X/2026');
      expect(noList).toContain('007/SI-PTV/X/2026');

      const doc007 = INITIAL_DOCS_FIXTURES.find((d) => d.no === '007/SI-PTV/X/2026');
      expect(doc007).toBeDefined();
      expect(doc007?.subject).toBe('Dokuementasi Kedatangan Syekh Salim');
      expect(doc007?.recipients).toEqual(['Farras', 'Iyyaka']);
      expect(doc007?.status).toBe('Disetujui');
    });

    it('2.2 mapSuratIzinToDoc harus memetakan nama_santri, jenis_kegiatan, dan santri_list (JSON/Array)', () => {
      const rawDbRow = {
        id: 'f491c12e-1311-477c-a7a5-da229a43a296',
        nomor_surat: '007/SI-PTV/X/2026',
        nama_santri: 'Farras',
        jenis_kegiatan: 'Dokuementasi Kedatangan Syekh Salim',
        santri_list: ['Farras', 'Iyyaka'],
        tanggal_mulai: '2026-10-15',
        tanggal_selesai: '2026-10-15',
        disetujui_oleh: 'Pimpinan Redaksi PTV',
        status: 'disetujui',
        created_at: '2026-10-15T09:30:00Z',
        diajukan_oleh: 'farras',
      } as unknown as RawSuratIzinDbRow;

      const doc = mapSuratIzinToDoc(rawDbRow);
      expect(doc.id).toBe('si_f491c12e-1311-477c-a7a5-da229a43a296');
      expect(doc.no).toBe('007/SI-PTV/X/2026');
      expect(doc.subject).toBe('Dokuementasi Kedatangan Syekh Salim');
      expect(doc.owner).toBe('Farras');
      expect(doc.recipients).toEqual(['Farras', 'Iyyaka']);
      expect(doc.status).toBe('Disetujui');
    });

    it('2.3 Nomor surat historis wajib dipertahankan secara persis tanpa modifikasi', () => {
      const rawDbRow = {
        id: 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c',
        nomor_surat: '001/SI-PTV/X/2026',
        nama_santri: 'Farras',
        jenis_kegiatan: 'Izin Sekolah - Relay Haul Solo',
        status: 'disetujui',
        diajukan_oleh: 'farras',
        created_at: '2026-10-03T07:15:00Z',
        disetujui_oleh: 'Pimpinan',
      } as unknown as RawSuratIzinDbRow;

      const doc = mapSuratIzinToDoc(rawDbRow);
      expect(doc.no).toBe('001/SI-PTV/X/2026');
    });
  });

  // ==========================================
  // MODUL 3: PENGAJUAN PERIZINAN
  // ==========================================
  describe('Modul 3: Pengajuan Perizinan (Filter Izin Santri, Empty State Jujur)', () => {
    it('3.1 Modul Pengajuan Perizinan wajib memfilter keluar Surat Izin Santri', () => {
      const allDocs = [...INITIAL_DOCS_FIXTURES];

      // Simulasi filter yang digunakan PerizinanPage
      const perizinanRows = allDocs.filter(
        (d) =>
          d.type !== 'Surat Izin' &&
          d.type !== 'Izin Santri' &&
          d.type !== 'Surat Izin Santri' &&
          d.type !== 'Surat Izin Resmi'
      );

      // Karena hanya ada 2 surat izin santri di database dan 0 surat tugas/barang, hasilnya harus 0
      expect(perizinanRows.length).toBe(0);
    });

    it('3.2 Jika ada surat tugas dan surat barang baru, modul perizinan menampilkannya', () => {
      const sampleTugas = mapSuratTugasToDoc({
        id: '11111111-2222-3333-4444-555555555555',
        nomor_surat: '005/ST-PTV/X/2026',
        perihal: 'Liputan Haul Solo 2026',
        tanggal_tugas: '2026-10-18',
        kru_terlibat: ['Farras', 'Zidna'],
        status: 'menunggu',
        diajukan_oleh: 'farras',
      } as unknown as RawSuratTugasDbRow);

      const sampleBarang = mapSuratBarangToDoc({
        id: '22222222-3333-4444-5555-666666666666',
        nomor_surat: '002/SBB-PTV/X/2026',
        tujuan_lokasi: 'Solo',
        nama_pembawa: 'Farras',
        daftar_barang: ['Kamera Sony FX3', 'Tripod'],
        status: 'disetujui',
      } as unknown as RawSuratBarangDbRow);

      const combinedDocs = [...INITIAL_DOCS_FIXTURES, sampleTugas, sampleBarang];
      const perizinanRows = combinedDocs.filter(
        (d) =>
          d.type !== 'Surat Izin' &&
          d.type !== 'Izin Santri' &&
          d.type !== 'Surat Izin Santri' &&
          d.type !== 'Surat Izin Resmi'
      );

      expect(perizinanRows.length).toBe(2);
      expect(perizinanRows.map((d) => d.type)).toContain('Surat Tugas');
      expect(perizinanRows.map((d) => d.type)).toContain('Izin Membawa Barang');
    });

    it('3.3 RBAC Perizinan: Kru biasa hanya melihat dokumen yang melibatkannya', () => {
      const sampleTugas1 = mapSuratTugasToDoc({
        id: '1',
        perihal: 'Tugas Farras',
        kru_terlibat: ['Farras'],
        diajukan_oleh: 'farras',
      } as unknown as RawSuratTugasDbRow);

      const sampleTugas2 = mapSuratTugasToDoc({
        id: '2',
        perihal: 'Tugas Dimas',
        kru_terlibat: ['Dimas'],
        diajukan_oleh: 'dimas',
      } as unknown as RawSuratTugasDbRow);

      const currentUser = { full_name: 'Farras', username: 'farras' };
      const canApprove = false;

      const isUserInDoc = (d: any) => {
        if (canApprove) return true;
        const myName = currentUser.full_name.toLowerCase();
        if (d.owner && d.owner.toLowerCase().includes(myName)) return true;
        if (d.diajukan_oleh && d.diajukan_oleh.toLowerCase() === currentUser.username) return true;
        if (Array.isArray(d.recipients) && d.recipients.some((r: string) => r.toLowerCase().includes(myName))) return true;
        return false;
      };

      const userDocs = [sampleTugas1, sampleTugas2].filter(isUserInDoc);
      expect(userDocs.length).toBe(1);
      expect(userDocs[0].subject).toBe('Tugas Farras');
    });
  });
});
