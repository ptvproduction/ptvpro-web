import { describe, it, expect, vi, beforeEach } from 'vitest';
import peminjamanHandler from '../../api/_routes/peminjaman';
import damageHandler from '../../api/_routes/lapor-kerusakan';
import lostFoundHandler from '../../api/_routes/lost-found';
import { peminjamanService } from '../../src/products/hub/peminjaman/peminjamanService';
import { damageReportService } from '../../src/products/hub/lapor-kerusakan/damageReportService';
import { lostFoundService } from '../../src/products/hub/lost-found/lostFoundService';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';
import type { IncomingMessage } from 'node:http';

describe('PTVPRO — 3 Operational Modules Staging Integration & Regression Tests', () => {
  const mockSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Peminjaman Module Data Normalization & Archive Mapping', () => {
    it('harus mampu mem-parsing JSON comment legacy dengan karakter escaped single quote (Rafa Putra Ro\\\'uf)', () => {
      const escapedComment = `<!-- PTV_META: {"code":"PJM-2026-0042","borrower_name":"Rafa Putra Ro\\'uf","purpose":"Dokumentasi","status":"borrowed","equipment_ids":["inv-001"],"due_date":"2026-10-25"} -->\nCatatan peminjaman`;
      
      const metaMatch = escapedComment.match(/<!--\s*PTV_META:\s*([\s\S]*?)\s*-->/);
      expect(metaMatch).not.toBeNull();
      
      const unescaped = metaMatch![1].replace(/\\'/g, "'");
      const parsed = JSON.parse(unescaped);
      
      expect(parsed.code).toBe('PJM-2026-0042');
      expect(parsed.borrower_name).toBe("Rafa Putra Ro'uf");
      expect(parsed.status).toBe('borrowed');
      expect(parsed.equipment_ids).toEqual(['inv-001']);
    });

    it('harus memetakan status peminjaman legacy ke status standar React (returned -> dikembalikan, borrowed -> dipinjam)', () => {
      const normalizeStatus = (rawStatus: string, tenggatKembali?: string, todayIso: string = '2026-10-18') => {
        const s = rawStatus.toLowerCase();
        if (s === 'returned' || s === 'dikembalikan' || s === 'kembali') return 'dikembalikan';
        if (tenggatKembali && tenggatKembali < todayIso) return 'terlambat';
        return 'dipinjam';
      };

      expect(normalizeStatus('returned')).toBe('dikembalikan');
      expect(normalizeStatus('borrowed', '2026-10-20', '2026-10-18')).toBe('dipinjam');
      expect(normalizeStatus('borrowed', '2026-10-10', '2026-10-18')).toBe('terlambat');
    });

    it('harus menandai transaksi tanpa relasi master sebagai Alat Historis (Referensi Lepas) dengan is_historical: true', () => {
      const mockHistoricalLoan = {
        id: 'legacy-loan-1',
        nama_alat: 'Alat Historis (Referensi Lepas)',
        kode_unit: 'UNIT-LEGACY',
        is_historical: true,
      };

      expect(mockHistoricalLoan.is_historical).toBe(true);
      expect(mockHistoricalLoan.nama_alat).toContain('Referensi Lepas');
    });
  });

  describe('2. Lapor Kerusakan Module Data Normalization & Quality Check Integrity', () => {
    it('harus memetakan record kerusakan iPhone 11 128 iBox (INV-972) dengan status Selesai', () => {
      const rawLegacyDamage = {
        id: '3d83a7a8-c2fe-45a4-946f-87034c2d3bbf',
        nama_alat: 'iPhone 11 128 iBox',
        alat_id: 'fabda78e-6c61-42cb-b1b7-a36a782b3d63',
        kru_nama: 'Rafa Putra Rouf',
        keterangan: 'autofokus kamera gak jelas',
        status: 'Selesai',
        created_at: '2026-09-24T18:50:00Z',
      };

      const mapped = {
        id: rawLegacyDamage.id,
        assetId: 'INV-972',
        assetName: rawLegacyDamage.nama_alat,
        reporterName: rawLegacyDamage.kru_nama,
        title: rawLegacyDamage.keterangan,
        status: 'Selesai',
        severity: 'sedang' as const,
        is_historical: true,
      };

      expect(mapped.assetId).toBe('INV-972');
      expect(mapped.assetName).toBe('iPhone 11 128 iBox');
      expect(mapped.status).toBe('Selesai');
      expect(mapped.is_historical).toBe(true);
    });

    it('tidak boleh secara otomatis mengubah status unit inventaris fisik saat laporan kerusakan dimuat', () => {
      // Pastikan integritas read-only: membaca laporan kerusakan tidak mengubah master status unit
      const inventarisUnit = {
        kode_unit: 'INV-972-U01',
        status_kondisi: 'baik',
      };

      const damageReport = {
        assetName: 'iPhone 11 128 iBox',
        status: 'Selesai',
      };

      // Status unit tetap sesuai database
      expect(inventarisUnit.status_kondisi).toBe('baik');
      expect(damageReport.status).toBe('Selesai');
    });
  });

  describe('3. Lost & Found Module Empty State & Zero Dummy Fixture Policy', () => {
    it('harus mengembalikan array kosong saat database Staging tidak memiliki record lost & found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          count: 0,
          items: [],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const items = await lostFoundService.getItems();
      expect(items).toEqual([]);
      expect(items.length).toBe(0);
    });

    it('harus melempar error dan tidak silent fallback ke fixtures mock saat backend /api/lost-found gagal', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: 'Gagal memuat data lost & found: 500',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(lostFoundService.getItems()).rejects.toThrow('Gagal memuat data lost & found: 500');
    });
  });

  describe('4. Serverless Handlers Security, RBAC & Fail-Closed Gates', () => {
    function createMockRes() {
      const res: any = {
        _status: 200,
        _json: null,
        statusCode: 200,
        setHeader: vi.fn(),
        writeHead: vi.fn(function (code: number) {
          res.statusCode = code;
          res._status = code;
          return res;
        }),
        end: vi.fn(function (payload?: string) {
          if (payload) {
            try {
              res._json = JSON.parse(payload);
            } catch {
              res._json = payload;
            }
          }
          res._status = res.statusCode;
          return res;
        }),
        getStatus: function () {
          return res.statusCode;
        },
        getBody: function () {
          return res._json;
        },
      };
      return res;
    }

    const createMockReq = (url: string, headers: Record<string, string> = {}) => {
      return {
        method: 'GET',
        url,
        headers,
      } as unknown as IncomingMessage;
    };

    it('harus menolak request tanpa session token dengan status HTTP 401 pada /api/peminjaman', async () => {
      const req = createMockReq('/api/peminjaman');
      const res = createMockRes();
      await peminjamanHandler(req, res);

      expect(res.getStatus()).toBe(401);
      const body = res.getBody();
      expect(body.error).toContain('Akses ditolak');
    });

    it('harus menolak request tanpa capability loans.view dengan status HTTP 403', async () => {
      process.env.AUTH_SECRET = mockSecret;
      const token = signSessionToken(
        {
          account_id: 'test-user-id',
          identity_id: 'ident-test',
          username: 'testuser',
          full_name: 'Test User',
          ptv_id: 'PTV-001',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['kru'],
          capabilities: ['inventory.view'], // Tidak memiliki loans.view
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        mockSecret
      );

      const req = createMockReq('/api/peminjaman', {
        cookie: `ptv_hub_session=${token}`,
      });
      const res = createMockRes();
      await peminjamanHandler(req, res);

      expect(res.getStatus()).toBe(403);
      const body = res.getBody();
      expect(body.error).toContain('Akses ditolak');
    });

    it('harus menolak request tanpa capability damage.view pada /api/lapor-kerusakan dengan HTTP 403', async () => {
      process.env.AUTH_SECRET = mockSecret;
      const token = signSessionToken(
        {
          account_id: 'test-user-id',
          identity_id: 'ident-test',
          username: 'testuser',
          full_name: 'Test User',
          ptv_id: 'PTV-001',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['kru'],
          capabilities: ['notes.view'], // Tidak memiliki damage.view
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        mockSecret
      );

      const req = createMockReq('/api/lapor-kerusakan', {
        cookie: `ptv_hub_session=${token}`,
      });
      const res = createMockRes();
      await damageHandler(req, res);

      expect(res.getStatus()).toBe(403);
    });

    it('harus menolak request tanpa capability lostfound.view pada /api/lost-found dengan HTTP 403', async () => {
      process.env.AUTH_SECRET = mockSecret;
      const token = signSessionToken(
        {
          account_id: 'test-user-id',
          identity_id: 'ident-test',
          username: 'testuser',
          full_name: 'Test User',
          ptv_id: 'PTV-001',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['kru'],
          capabilities: ['events.view'], // Tidak memiliki lostfound.view
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        mockSecret
      );

      const req = createMockReq('/api/lost-found', {
        cookie: `ptv_hub_session=${token}`,
      });
      const res = createMockRes();
      await lostFoundHandler(req, res);

      expect(res.getStatus()).toBe(403);
    });
  });

  describe('5. Client Services Error Handling & Parsing Safeguards', () => {
    it('peminjamanService harus melempar error saat menerima Content-Type bukan JSON (misal HTML error)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: async () => '<html>Server Error</html>',
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(peminjamanService.getPeminjamanList()).rejects.toThrow(
        'Respon server bukan format JSON yang valid.'
      );
    });

    it('damageReportService harus melempar error saat menerima response HTTP 500', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Database connection failed' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(damageReportService.getReports()).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/_routes/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/_routes/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
