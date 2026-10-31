import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapDbRowToAcaraItem, RawAcaraDbRow, acaraService } from '../../src/products/hub/acara/acaraService';
import handler from '../../api/acara';
import { signSessionToken } from '../../api/auth/_utils/crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

describe('PTV PRO — Acara Module Staging Integration & Legacy Parity Tests', () => {
  const mockSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Data Normalization & Legacy Contract Mapping', () => {
    it('harus memetakan baris ptv_acara dengan metadata PTV_META lengkap secara akurat', () => {
      const rawDbRow: RawAcaraDbRow = {
        id: '2f161da1-902e-4648-bae9-efe9f8279071',
        nama_acara: 'Malam Puncak Hari Santri Nasional',
        tanggal: '2026-10-24',
        waktu_mulai: null,
        waktu_selesai: null,
        lokasi: 'Lapangan Parkir (Eks Pabrik)',
        deskripsi: '<!-- PTV_META: {"time":"19.00","loc":"Lapangan Parkir (Eks Pabrik)","crew":[{"id":"c-1","name":"Abyan Zahir Wijaksono","job":"Switcherman","tugas":"Switcherman"}],"gear":[{"id":"g-1","name":"Sony XDCAM","code":"INV-007","cat":"Kamera","qty":4,"units":[]}],"rundown":[{"id":"rd-1","jam_mulai":"19:00","kegiatan":"Pembukaan"}],"type":"internal","dresscode":"Batik PTV","status_detail":"Terjadwal"} -->\nInstruksi peliputan malam puncak',
        status: 'aktif',
        created_at: '2026-09-24T18:49:07Z',
        updated_at: '2026-10-07T11:45:30Z'
      };

      // Mock todayStr sebagai 2026-10-18
      const item = mapDbRowToAcaraItem(rawDbRow, '2026-10-18');

      expect(item.id).toBe('2f161da1-902e-4648-bae9-efe9f8279071');
      expect(item.name).toBe('Malam Puncak Hari Santri Nasional');
      expect(item.date).toBe('2026-10-24');
      expect(item.time).toBe('19.00');
      expect(item.loc).toBe('Lapangan Parkir (Eks Pabrik)');
      expect(item.status).toBe('Mendatang'); // 2026-10-24 > 2026-10-18
      expect(item.type).toBe('internal');
      expect(item.dresscode).toBe('Batik PTV');
      expect(item.notes).toBe('Instruksi peliputan malam puncak');

      // Verifikasi relasi kru
      expect(item.crew).toHaveLength(1);
      expect(item.crew[0].name).toBe('Abyan Zahir Wijaksono');
      expect(item.crew[0].job).toBe('Switcherman');

      // Verifikasi relasi gear
      expect(item.gear).toHaveLength(1);
      expect(item.gear[0].name).toBe('Sony XDCAM');
      expect(item.gear[0].code).toBe('INV-007');
      expect(item.gear[0].qty).toBe(4);

      // Verifikasi susunan rundown
      expect(item.rundown).toHaveLength(1);
      expect(item.rundown[0].kegiatan).toBe('Pembukaan');
      expect(item.rundown[0].jam_mulai).toBe('19:00');
    });

    it('harus mendukung penugasan kru dengan format string nama langsung sesuai legacy', () => {
      const rawDbRow: RawAcaraDbRow = {
        id: '91c639b9-0b3e-4b26-a07f-eab90cc88e3d',
        nama_acara: 'Kick-Off Rangkaian Acara Hari Santri',
        tanggal: '2026-10-22',
        lokasi: 'Lapangan Parkir',
        deskripsi: '<!-- PTV_META: {"time":"19:00","crew":["Muhammad Farras Zaidan Mubarok"]} -->\nCatatan kick off',
        status: 'aktif',
        created_at: '2026-09-24T18:49:44Z',
        updated_at: '2026-09-27T18:05:55Z'
      };

      const item = mapDbRowToAcaraItem(rawDbRow, '2026-10-18');
      expect(item.crew).toHaveLength(1);
      expect(item.crew[0].name).toBe('Muhammad Farras Zaidan Mubarok');
      expect(item.notes).toBe('Catatan kick off');
    });

    it('harus menangani data acara lama tanpa blok PTV_META dengan nilai default elegan', () => {
      const rawDbRow: RawAcaraDbRow = {
        id: '1dbe9943-feba-4bba-b637-d5280323ac76',
        nama_acara: 'Peresmian Klinik Pesantren',
        tanggal: '2026-06-01',
        lokasi: null,
        deskripsi: 'Peresmian Resmi Klinik Pesantren Progresif Bumi Shalawat',
        status: 'aktif',
        waktu_mulai: '09:00:00',
        waktu_selesai: '12:00:00',
        created_at: '2026-05-28T11:53:34Z',
        updated_at: '2026-08-25T03:52:24Z'
      };

      const item = mapDbRowToAcaraItem(rawDbRow, '2026-10-18');
      expect(item.id).toBe('1dbe9943-feba-4bba-b637-d5280323ac76');
      expect(item.name).toBe('Peresmian Klinik Pesantren');
      expect(item.date).toBe('2026-06-01');
      expect(item.loc).toBe('Studio PTV'); // default
      expect(item.status).toBe('Selesai'); // 2026-06-01 < 2026-10-18
      expect(item.time).toBe('09:00:00 – 12:00:00');
      expect(item.notes).toBe('Peresmian Resmi Klinik Pesantren Progresif Bumi Shalawat');
      expect(item.crew).toEqual([]);
      expect(item.gear).toEqual([]);
      expect(item.rundown).toEqual([]);
    });
  });

  describe('2. Dynamic Status Resolution', () => {
    it('harus menandai status Selesai untuk tanggal yang telah lewat', () => {
      const raw: RawAcaraDbRow = {
        id: 'ev-past',
        nama_acara: 'Acara Lampau',
        tanggal: '2026-10-10',
        status: 'aktif',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z'
      };
      const item = mapDbRowToAcaraItem(raw, '2026-10-18');
      expect(item.status).toBe('Selesai');
    });

    it('harus menandai status Berlangsung jika tanggal bertepatan dengan hari ini', () => {
      const raw: RawAcaraDbRow = {
        id: 'ev-today',
        nama_acara: 'Acara Hari Ini',
        tanggal: '2026-10-18',
        status: 'aktif',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z'
      };
      const item = mapDbRowToAcaraItem(raw, '2026-10-18');
      expect(item.status).toBe('Berlangsung');
    });

    it('harus menandai status Mendatang untuk tanggal masa depan', () => {
      const raw: RawAcaraDbRow = {
        id: 'ev-future',
        nama_acara: 'Acara Masa Depan',
        tanggal: '2026-10-25',
        status: 'aktif',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z'
      };
      const item = mapDbRowToAcaraItem(raw, '2026-10-18');
      expect(item.status).toBe('Mendatang');
    });

    it('harus memprioritaskan status eksplisit Dibatalkan jika status database adalah batal', () => {
      const raw: RawAcaraDbRow = {
        id: 'ev-batal',
        nama_acara: 'Acara Batal',
        tanggal: '2026-10-25',
        status: 'batal',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z'
      };
      const item = mapDbRowToAcaraItem(raw, '2026-10-18');
      expect(item.status).toBe('Dibatalkan');
    });
  });

  describe('3. Backend RBAC & Session Security Gate (/api/acara)', () => {
    function createMockRes(): ServerResponse & { _status: number; _json: any } {
      const res: any = {
        _status: 200,
        _json: null,
        statusCode: 200,
        setHeader: vi.fn(),
        end: vi.fn(function (payload: string) {
          try {
            res._json = JSON.parse(payload);
          } catch {
            res._json = payload;
          }
          res._status = res.statusCode;
        }),
      };
      return res;
    }

    it('harus menolak request tanpa session token dengan status 401 unauthorized', async () => {
      const req = {
        method: 'GET',
        headers: {},
      } as unknown as IncomingMessage;
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(401);
      expect(res._json.code).toBe('unauthorized');
    });

    it('harus menolak request dengan metode yang tidak didukung dengan HTTP 405 Method Not Allowed', async () => {
      const req = {
        method: 'OPTIONS',
        headers: {},
      } as unknown as IncomingMessage;
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(405);
    });

    it('harus menolak pengguna tanpa capability events.view / calendar.view / hub.access dengan status 403', async () => {
      const token = signSessionToken(
        {
          account_id: 'acc-no-access',
          identity_id: 'ident-no-access',
          username: 'noaccess',
          full_name: 'No Access User',
          ptv_id: 'PTV-999',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['crew'],
          capabilities: ['finance.view'], // Tidak memiliki events.view / hub.access
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        mockSecret
      );

      const req = {
        method: 'GET',
        headers: {
          cookie: `ptv_hub_session=${token}`,
        },
      } as unknown as IncomingMessage;
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(403);
      expect(res._json.code).toBe('forbidden');
    });
  });

  describe('4. No Silent Fallback to Dummy Policy', () => {
    it('harus melempar error otentikasi saat server merespons 401 dan tidak mengembalikan fixture diam-diam', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as any);

      await expect(acaraService.getEvents()).rejects.toThrow('Sesi login diperlukan');
    });

    it('harus melempar error hak akses saat server merespons 403 dan tidak mengembalikan fixture diam-diam', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      } as any);

      await expect(acaraService.getEvents()).rejects.toThrow('Akses ditolak');
    });
  });

  describe('5. Acara UPDATE Mutation, Concurrency & PTV_META Preservation', () => {
    function createMockRes(): ServerResponse & { _status: number; _json: any } {
      const res: any = {
        _status: 200,
        _json: null,
        statusCode: 200,
        setHeader: vi.fn(),
        end: vi.fn(function (payload: string) {
          try {
            res._json = JSON.parse(payload);
          } catch {
            res._json = payload;
          }
          res._status = res.statusCode;
        }),
      };
      return res;
    }

    it('harus menolak request dengan metode yang tidak didukung (seperti OPTIONS/CONNECT) dengan HTTP 405 Method Not Allowed', async () => {
      for (const deniedMethod of ['OPTIONS', 'CONNECT']) {
        const req = {
          method: deniedMethod,
          headers: {},
        } as unknown as IncomingMessage;
        const res = createMockRes();

        await handler(req, res);

        expect(res._status).toBe(405);
        expect(res._json.error).toContain('tidak didukung');
      }
    });

    it('harus menolak UPDATE (PATCH) jika pengguna tidak memiliki hak edit (RBAC 403)', async () => {
      const token = signSessionToken(
        {
          account_id: 'acc-viewer-only',
          identity_id: 'ident-viewer-only',
          username: 'vieweronly',
          full_name: 'Viewer Only User',
          ptv_id: 'PTV-888',
          status_akun: 'active',
          status_organisasi: 'active',
          assigned_profiles: ['anggota'],
          capabilities: ['events.view'], // Hanya view, tidak punya events.edit / events.manage / hub.access / admin
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        mockSecret
      );

      const req = {
        method: 'PATCH',
        headers: {
          cookie: `ptv_hub_session=${token}`,
        },
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(JSON.stringify({ id: 'any-id', name: 'Updated Name' }));
          if (event === 'end') callback();
          return req;
        }),
      } as unknown as IncomingMessage;
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(403);
      expect(res._json.code).toBe('forbidden');
    });

    it('acaraService.updateEvent harus melempar error saat parameter id kosong', async () => {
      await expect(
        acaraService.updateEvent({ id: '', name: 'Test Acara' })
      ).rejects.toThrow('ID Acara (UUID) wajib disertakan');
    });

    it('acaraService.updateEvent harus berhasil memetakan respon sukses backend dan mengembalikan AcaraItem', async () => {
      const mockUpdatedEvent = {
        id: '2f161da1-902e-4648-bae9-efe9f8279071',
        name: 'Malam Puncak Hari Santri Nasional (Updated)',
        date: '2026-10-24',
        time: '19:30 – 23:00',
        loc: 'Auditorium Utama PTV',
        status: 'Mendatang',
        notes: 'Instruksi diperbarui',
        crew: [],
        gear: [],
        rundown: [],
        updated_at: '2026-10-18T10:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Perubahan acara berhasil disimpan',
          event: mockUpdatedEvent,
        }),
      } as any);

      const result = await acaraService.updateEvent({
        id: '2f161da1-902e-4648-bae9-efe9f8279071',
        name: 'Malam Puncak Hari Santri Nasional (Updated)',
      });

      expect(result.id).toBe('2f161da1-902e-4648-bae9-efe9f8279071');
      expect(result.name).toBe('Malam Puncak Hari Santri Nasional (Updated)');
      expect(result.updated_at).toBe('2026-10-18T10:00:00Z');
    });

    it('acaraService.updateEvent harus melempar error otentikasi saat server merespons 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized', code: 'unauthorized' }),
      } as any);

      await expect(
        acaraService.updateEvent({ id: 'ev-1', name: 'Test' })
      ).rejects.toThrow('Sesi login telah berakhir');
    });

    it('acaraService.updateEvent harus melempar pesan error backend saat terjadi konflik konkurensi (409)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'Konflik pembaruan: Data acara telah diperbarui oleh pengguna lain.',
          code: 'concurrency_conflict',
        }),
      } as any);

      await expect(
        acaraService.updateEvent({ id: 'ev-1', name: 'Test' })
      ).rejects.toThrow('Konflik pembaruan');
    });
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
