import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapSuratIzinToDoc,
  mapSuratTugasToDoc,
  mapSuratBarangToDoc,
  mapDbStatusToDocStatus,
  parseJsonOrArray,
  filterUserDocuments,
  handleDokumenApiRequest,
  type RawSuratIzinDbRow,
  type RawSuratTugasDbRow,
  type RawSuratBarangDbRow,
} from '../../api/_routes/dokumen';
import { parseDocDate } from '../../src/products/hub/arsip/ArsipPage';
import { dokumenService } from '../../src/products/hub/dokumen-saya/dokumenService';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';

describe('PTVPRO — Migrasi & Integrasi Dokumen Saya & Arsip Dokumen ke Supabase Staging', () => {
  const authSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Authoritative Data Mapping (Database Staging -> PtvDocument)', () => {
    it('1.1 Harus memetakan data riil ptv_surat_izin dari Staging ke interface PtvDocument', () => {
      const rawIzin: RawSuratIzinDbRow = {
        id: 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c',
        nomor_surat: '001/SI-PTV/X/2026',
        nama_pemohon: 'Muhammad Farras Zaidan Mubarok',
        alasan: 'Izin Sekolah - Relay Haul Solo',
        tanggal_mulai: '2026-10-03',
        tanggal_selesai: '2026-10-03',
        disetujui_oleh: 'Pimpinan Eksekutif PTV',
        status: 'disetujui',
        created_at: '2026-10-02T19:48:17.097499+00:00',
        diajukan_oleh: 'farras',
      };

      const doc = mapSuratIzinToDoc(rawIzin);

      expect(doc.id).toBe('si_ff305b4f-0c0e-4abc-9da9-2556bdb1743c');
      expect(doc.no).toBe('001/SI-PTV/X/2026');
      expect(doc.type).toBe('Surat Izin Santri');
      expect(doc.subject).toBe('Izin Sekolah - Relay Haul Solo');
      expect(doc.owner).toBe('Muhammad Farras Zaidan Mubarok');
      expect(doc.pembawa).toBe('Muhammad Farras Zaidan Mubarok');
      expect(doc.diajukan_oleh).toBe('farras');
      expect(doc.status).toBe('Disetujui');
      expect(doc.recipients).toContain('Muhammad Farras Zaidan Mubarok');
      expect(doc.status_history?.length).toBeGreaterThanOrEqual(2);
      expect(doc.status_history?.[1].status).toBe('Disetujui');
    });

    it('1.2 Harus memetakan skema ptv_surat_tugas dengan jsonb kru_terlibat', () => {
      const rawTugas: RawSuratTugasDbRow = {
        id: '99999999-0000-0000-0000-000000000001',
        nomor_surat: '042/ST-PTV/X/2026',
        perihal: 'Siaran Langsung Pengajian Akbar Maulid',
        tanggal_tugas: '2026-10-12',
        kru_terlibat: ['M. Zidna Ilma Roup', 'Rizky Alamsyah', 'Dimas Prayoga'],
        disetujui_oleh: 'Dr. H. Ahmad Musthofa, M.Pd.',
        status: 'disetujui',
        created_at: '2026-10-10T08:30:00Z',
        diajukan_oleh: 'zidna',
      };

      const doc = mapSuratTugasToDoc(rawTugas);

      expect(doc.id).toBe('st_99999999-0000-0000-0000-000000000001');
      expect(doc.no).toBe('042/ST-PTV/X/2026');
      expect(doc.type).toBe('Surat Tugas');
      expect(doc.subject).toBe('Siaran Langsung Pengajian Akbar Maulid');
      expect(doc.recipients).toEqual(['M. Zidna Ilma Roup', 'Rizky Alamsyah', 'Dimas Prayoga']);
      expect(doc.status).toBe('Disetujui');
      expect(doc.penanggung_jawab).toBe('Dr. H. Ahmad Musthofa, M.Pd.');
    });

    it('1.3 Harus memetakan skema ptv_surat_barang dengan daftar_barang dan nama_pembawa', () => {
      const rawBarang: RawSuratBarangDbRow = {
        id: '88888888-0000-0000-0000-000000000002',
        nomor_surat: '015/SBB-PTV/X/2026',
        nama_pembawa: 'Rizky Alamsyah',
        tujuan_lokasi: 'Masjid Agung Solo',
        daftar_barang: ['Sony FX3 Cinema Line', 'DJI Mic 2 Dual'],
        disetujui_oleh: 'Pimpinan Eksekutif PTV',
        status: 'disetujui',
        created_at: '2026-10-11T09:00:00Z',
        diajukan_oleh: 'alamsyah',
      };

      const doc = mapSuratBarangToDoc(rawBarang);

      expect(doc.id).toBe('sbb_88888888-0000-0000-0000-000000000002');
      expect(doc.no).toBe('015/SBB-PTV/X/2026');
      expect(doc.type).toBe('Izin Membawa Barang');
      expect(doc.subject).toContain('Masjid Agung Solo');
      expect(doc.owner).toBe('Rizky Alamsyah');
      expect(doc.items).toEqual(['Sony FX3 Cinema Line', 'DJI Mic 2 Dual']);
    });

    it('1.4 Normalisasi status database aman dan fail-safe ke status Menunggu', () => {
      expect(mapDbStatusToDocStatus('disetujui')).toBe('Disetujui');
      expect(mapDbStatusToDocStatus('VALID')).toBe('Disetujui');
      expect(mapDbStatusToDocStatus('acc')).toBe('Disetujui');
      expect(mapDbStatusToDocStatus('revisi')).toBe('Revisi');
      expect(mapDbStatusToDocStatus('ditolak')).toBe('Ditolak');
      expect(mapDbStatusToDocStatus('unknown_status')).toBe('Menunggu');
      expect(mapDbStatusToDocStatus(null)).toBe('Menunggu');
    });

    it('1.5 Helper parseJsonOrArray menangani array, json string, dan string koma', () => {
      expect(parseJsonOrArray(['Kamera A', 'Kamera B'])).toEqual(['Kamera A', 'Kamera B']);
      expect(parseJsonOrArray('[{"nama":"Lensa 24-70mm"}]')).toEqual(['Lensa 24-70mm']);
      expect(parseJsonOrArray('Unit 1, Unit 2')).toEqual(['Unit 1', 'Unit 2']);
      expect(parseJsonOrArray(null)).toEqual([]);
    });
  });

  describe('2. Pemisahan Mekanisme Dokumen Saya vs Arsip Dokumen', () => {
    const sampleDocs = [
      mapSuratIzinToDoc({
        id: '1',
        nomor_surat: '001/SI-PTV/X/2026',
        nama_pemohon: 'Muhammad Farras Zaidan Mubarok',
        alasan: 'Izin Santri Farras',
        tanggal_mulai: '2026-10-03',
        tanggal_selesai: '2026-10-03',
        disetujui_oleh: null,
        status: 'disetujui',
        created_at: '2026-10-02T19:48:17Z',
        diajukan_oleh: 'farras',
      }),
      mapSuratTugasToDoc({
        id: '2',
        nomor_surat: '042/ST-PTV/X/2026',
        perihal: 'Surat Tugas Dimas',
        tanggal_tugas: '2026-10-12',
        kru_terlibat: ['Dimas Prayoga'],
        disetujui_oleh: 'Direktur',
        status: 'disetujui',
        created_at: '2026-10-10T08:30:00Z',
        diajukan_oleh: 'dimas',
      }),
    ];

    it('2.1 Dokumen Saya memfilter dokumen kepemilikan pribadi untuk kru biasa (tidak ada kebocoran dokumen)', () => {
      // Farras hanya boleh melihat dokumennya sendiri
      const farrasDocs = filterUserDocuments(sampleDocs, {
        name: 'Muhammad Farras Zaidan Mubarok',
        username: 'farras',
        ptv_id: 'PTV-003',
        isExecOrAdmin: false,
      });

      expect(farrasDocs.length).toBe(1);
      expect(farrasDocs[0].subject).toBe('Izin Santri Farras');
      expect(farrasDocs.some((d) => d.subject.includes('Dimas'))).toBe(false);

      // Dimas hanya boleh melihat dokumennya sendiri
      const dimasDocs = filterUserDocuments(sampleDocs, {
        name: 'Dimas Prayoga',
        username: 'dimas',
        ptv_id: 'PTV-005',
        isExecOrAdmin: false,
      });

      expect(dimasDocs.length).toBe(1);
      expect(dimasDocs[0].subject).toBe('Surat Tugas Dimas');
      expect(dimasDocs.some((d) => d.subject.includes('Farras'))).toBe(false);
    });

    it('2.2 Dokumen Saya mematuhi kepemilikan riil tanpa bypass admin yang membocorkan dokumen pihak lain', () => {
      // Dr. Ahmad Musthofa hanya melihat dokumen di mana ia bertindak sebagai penanggung jawab/pemberi tugas, bukan dokumen orang lain
      const execDocs = filterUserDocuments(sampleDocs, {
        name: 'Dr. Ahmad Musthofa',
        username: 'direktur',
        ptv_id: 'PTV-001',
        isExecOrAdmin: true,
      });

      // Hanya dokumen yang melibatkan Direktur yang tampil (doc 2 disetujui_oleh Direktur)
      expect(execDocs.length).toBe(1);
      expect(execDocs[0].subject).toBe('Surat Tugas Dimas');
    });

    it('2.3 Arsip Dokumen mengelompokkan dokumen berdasarkan tahun dan bulan (byYear / byMonth)', () => {
      const p1 = parseDocDate('2026-10-15T08:00:00Z');
      expect(p1.year).toBe('2026');
      expect(p1.monthIndex).toBe(9); // Oktober = index 9 (0-indexed)

      const p2 = parseDocDate('2025-05-20');
      expect(p2.year).toBe('2025');
      expect(p2.monthIndex).toBe(4); // Mei = index 4
    });
  });

  describe('3. Serverless API RBAC & Security Boundaries (/api/dokumen)', () => {
    it('3.1 Harus menolak permintaan tanpa session token HttpOnly (HTTP 401)', async () => {
      const res = await handleDokumenApiRequest({
        method: 'GET',
        headers: {},
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('unauthorized');
    });

    it('3.2 Harus menolak mutasi HTTP (POST/PUT/DELETE) dalam mode Strict Read-Only (HTTP 405)', async () => {
      const validCookie = `ptv_hub_session=${signSessionToken(
        {
          account_id: 'acc-1',
          identity_id: 'ident-1',
          ptv_id: 'PTV-001',
          full_name: 'Direktur',
          username: 'direktur',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['eksekutif'],
          capabilities: ['documents.archive.manage', 'hub.access'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        authSecret
      )}`;

      const resPost = await handleDokumenApiRequest({
        method: 'POST',
        headers: { cookie: validCookie },
      });
      expect(resPost.status).toBe(405);
      expect(resPost.body.code).toBe('method_not_allowed');

      const resDelete = await handleDokumenApiRequest({
        method: 'DELETE',
        headers: { cookie: validCookie },
      });
      expect(resDelete.status).toBe(405);
      expect(resDelete.body.code).toBe('method_not_allowed');
    });

    it('3.3 Harus menolak kru biasa tanpa izin arsip saat mengakses mode=archive (HTTP 403 fail-closed)', async () => {
      const crewCookie = `ptv_hub_session=${signSessionToken(
        {
          account_id: 'acc-crew-1',
          identity_id: 'ident-crew-1',
          ptv_id: 'PTV-030',
          full_name: 'Kru Operasional Biasa',
          username: 'krubiasa',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['crew'],
          capabilities: ['hub.access', 'documents.view'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        authSecret
      )}`;

      const res = await handleDokumenApiRequest({
        method: 'GET',
        url: '/api/dokumen?mode=archive',
        headers: { cookie: crewCookie },
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden_archive_access');
    });

    it('3.4 Tidak mengekspos secrets, credentials, atau private URLs ke respons', async () => {
      const validCookie = `ptv_hub_session=${signSessionToken(
        {
          account_id: 'acc-adm-1',
          identity_id: 'ident-adm-1',
          ptv_id: 'PTV-002',
          full_name: 'Admin TU',
          username: 'admintu',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['administrasi'],
          capabilities: ['documents.archive.view', 'hub.access'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        authSecret
      )}`;

      const res = await handleDokumenApiRequest({
        method: 'GET',
        url: '/api/dokumen?mode=archive',
        headers: { cookie: validCookie },
      });

      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain('service_role');
      expect(jsonStr).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(jsonStr).not.toContain('authSecret');
    });
  });

  describe('4. Client Service & Resilient Loading (dokumenService)', () => {
    it('4.1 dokumenService memiliki method getDocuments dan getDocumentById', () => {
      expect(typeof dokumenService.getDocuments).toBe('function');
      expect(typeof dokumenService.getDocumentById).toBe('function');
    });

    it('4.2 getDocuments menangani mode my dan archive dengan return type terstandarisasi', async () => {
      const res = await dokumenService.getDocuments('my');
      expect(res).toBeDefined();
      expect(Array.isArray(res.documents)).toBe(true);
      expect(res.stats).toBeDefined();
      expect(typeof res.stats.total).toBe('number');
    });
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/_routes/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/_routes/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
