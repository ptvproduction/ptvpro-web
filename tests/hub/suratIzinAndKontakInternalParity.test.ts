import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleDokumenApiRequest } from '../../api/_routes/dokumen';
import { docsStore } from '../../src/products/hub/dokumen-saya/docsStore';
import { dokumenService } from '../../src/products/hub/dokumen-saya/dokumenService';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';
import * as identityModule from '../../api/_routes/auth/_utils/identity';

const liveStagingUrl = 'https://swadgljnyelsjstqqxbm.supabase.co';
const liveServiceRoleKey = 'unit-only-key';
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: async () => ({data:{nomor_surat:'010/SI-PTV/X/2026',sequence:10,year:'2026',roman_month:'X'},error:null}), from: () => {
 const q: any = { then: (resolve: any) => resolve({ data: [], error: null, count: 0 }) };
 for (const m of ['select','eq','order','in','or','limit','gte','lte','neq','not','is']) q[m]=()=>q;
 q.maybeSingle=async()=>({data:null,error:null}); return q;
} }) }));

describe('PTVPRO — Generator Surat Izin Legacy Parity & Kontak Internal Parity Tests', () => {
  const authSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(docsStore, 'getAll').mockReturnValue([]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Synthetic offline preview')));
    vi.spyOn(identityModule, 'verifyAccountStatusLive').mockResolvedValue(true);
    process.env.AUTH_SECRET = authSecret;
    process.env.VITE_SUPABASE_URL = liveStagingUrl;
    process.env.SUPABASE_URL = liveStagingUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = liveServiceRoleKey;
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('1. Generator Surat Izin — Sequence & Vacancy Parity', () => {
    it('1.1 Harus mendeteksi sequence tertinggi di Staging dan menghasilkan sequence berikutnya setelah reservasi (010)', async () => {
      // Mock existing documents containing historical 001 and 007
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({
        documents: [
          {
            id: 'si_ea91b82d-ff86-41dc-bc87-d29c1a7f09f5',
            no: '007/SI-PTV/X/2026',
            subject: 'Dokumentasi Kedatangan Syekh Salim',
            type: 'Surat Izin Santri',
            date: '2026-10-15',
            owner: 'Muhammad Farras Zaidan Mubarok',
            status: 'Disetujui',
            created_at: '2026-10-14T11:16:06Z',
          },
          {
            id: 'si_ff305b4f-0c0e-4abc-9da9-2556bdb1743c',
            no: '001/SI-PTV/X/2026',
            subject: 'Izin Sekolah - Relay Haul Solo',
            type: 'Surat Izin Santri',
            date: '2026-10-03',
            owner: 'Muhammad Farras Zaidan Mubarok',
            status: 'Disetujui',
            created_at: '2026-10-02T19:48:17Z',
          },
        ],
        stats: {
          total: 2,
          izin: 2,
          tugas: 0,
          barang: 0,
          disetujui: 2,
          menunggu: 0,
          revisi: 0,
          ditolak: 0,
        },
      });

      const vacant = await dokumenService.getNextVacantNomorSurat('SI', '2026-10-18');
      expect(vacant.sequence).toBe(10);
      expect(vacant.nomor_surat).toBe('010/SI-PTV/X/2026');
      expect(vacant.is_vacant).toBe(false);
    });

    it('1.2 Harus menghasilkan nomor urut 001 jika belum ada dokumen sebelumnya pada tahun bersangkutan', async () => {
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({
        documents: [],
        stats: {
          total: 0,
          izin: 0,
          tugas: 0,
          barang: 0,
          disetujui: 0,
          menunggu: 0,
          revisi: 0,
          ditolak: 0,
        },
      });

      const vacant = await dokumenService.getNextVacantNomorSurat('SI', '2027-01-05');
      expect(vacant.sequence).toBe(1);
      expect(vacant.nomor_surat).toBe('001/SI-PTV/I/2027');
      expect(vacant.is_vacant).toBe(false);
    });

    it('1.3 Harus mendukung format nomor untuk Surat Tugas (ST) dan Surat Bawa Barang (SBB)', async () => {
      vi.spyOn(dokumenService, 'getDocuments').mockResolvedValue({
        documents: [
          {
            id: 'st_1',
            no: '001/ST-PTV/X/2026',
            subject: 'Liputan Luar',
            type: 'Surat Tugas',
            date: '2026-10-10',
            owner: 'Pimpinan Studio',
            status: 'Disetujui',
            created_at: '2026-10-10T08:30:00Z',
          },
        ],
        stats: {
          total: 1,
          izin: 0,
          tugas: 1,
          barang: 0,
          disetujui: 1,
          menunggu: 0,
          revisi: 0,
          ditolak: 0,
        },
      });

      const vacantST = await dokumenService.getNextVacantNomorSurat('ST', '2026-10-20');
      expect(vacantST.sequence).toBe(2);
      expect(vacantST.nomor_surat).toBe('002/ST-PTV/X/2026');

      const vacantSBB = await dokumenService.getNextVacantNomorSurat('SBB', '2026-10-20');
      expect(vacantSBB.sequence).toBe(1);
      expect(vacantSBB.nomor_surat).toBe('001/SBB-PTV/X/2026');
    });

    it('1.4 API Serverless /api/dokumen?mode=vacant_check harus merespons vacant check secara aman (Read-Only)', async () => {
      const token = signSessionToken(
        {
          account_id: 'acc_adm_001',
          identity_id: 'ident_adm_001',
          ptv_id: 'PTV-ADM-001',
          username: 'admin_ptv',
          full_name: 'Administrator Studio',
          status_akun: 'active',
          status_organisasi: 'active',
          capabilities: ['documents.generate', 'documents.archive.view'],
          assigned_profiles: ['administrasi'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        authSecret
      );

      const res = await handleDokumenApiRequest({
        method: 'GET',
        url: '/api/dokumen?mode=vacant_check&type=SI&date=2026-10-18',
        headers: {
          cookie: `ptv_hub_session=${token}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mode).toBe('vacant_check');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.type).toBe('SI');
      expect(res.body.data.year).toBe('2026');
      expect(res.body.data.roman_month).toBe('X');
      expect(res.body.data.next_sequence).toBeGreaterThanOrEqual(1);
      expect(res.body.data.nomor_surat).toMatch(/^\d{3}\/SI-PTV\/X\/2026$/);
      expect(res.body.data.is_vacant).toBe(true);
    });
  });

  describe('2. Detail Kontak Internal — UI & Layout Parity with Kontak Eksternal', () => {
    it('2.1 Modul KontakInternalDetailDrawer harus terdefinisi dan kompatibel', async () => {
      const module = await import(
        '../../src/products/hub/kontak/components/KontakInternalDetailDrawer'
      );
      expect(module.KontakInternalDetailDrawer).toBeDefined();
      expect(typeof module.KontakInternalDetailDrawer).toBe('function');
    });
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/_routes/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/_routes/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
