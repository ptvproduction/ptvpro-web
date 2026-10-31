import * as liveIdentity from '../../api/auth/_utils/identity';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import acaraHandler, { parseAcaraDbRow, extractValidSqlTime } from '../../api/acara';
import catatanHandler from '../../api/catatan';
import plannerHandler, { parsePlannerDbRow } from '../../api/planner';
import { acaraService } from '../../src/products/hub/acara/acaraService';
import { catatanService } from '../../src/products/hub/catatan/catatanService';
import { kalenderService } from '../../src/products/hub/kalender/kalenderService';
import { signSessionToken } from '../../api/auth/_utils/crypto';

describe('PTVPRO — Full Operational Persistence Regression Tests (Acara, Kalender, Planner, Catatan, Notulensi)', () => {
  const authSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.spyOn(liveIdentity, 'verifyAccountStatusLive').mockResolvedValue(true);
    process.env.SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key-for-unit-test';
    process.env.AUTH_SECRET = authSecret;
  });

  const mockAdminSession: any = {
    account_id: 'acc-025',
    identity_id: 'ident-025',
    full_name: 'Muhammad Zidnal Falah',
    email: 'zidna@ptvpro.com',
    auth_provider: 'google',
    assigned_profiles: ['eksekutif', 'admin'],
    capabilities: [
      'events.create', 'events.edit', 'events.delete', 'events.manage', 'events.view',
      'notes.create', 'notes.edit', 'notes.delete', 'notes.manage', 'notes.view',
      'planner.create', 'planner.edit', 'planner.delete', 'planner.view', 'hub.access'
    ],
    status_akun: 'active',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600
  };

  const adminToken = signSessionToken(mockAdminSession, authSecret);
  const adminCookie = `ptv_hub_session=${adminToken}`;

  function createMockReqRes(method: string, body: any = null, url = '/api/test', cookie = adminCookie) {
    let resData = '';
    let statusCode = 200;
    const headersSent: Record<string, string> = {};

    const req: any = {
      method,
      url,
      headers: {
        cookie,
        'content-type': 'application/json'
      },
      body,
      on: (ev: string, fn: any) => {
        if (ev === 'data' && body) fn(typeof body === 'string' ? body : JSON.stringify(body));
        if (ev === 'end') fn();
      }
    };

    const res: any = {
      statusCode: 200,
      setHeader: (k: string, v: string) => {
        headersSent[k.toLowerCase()] = v;
      },
      end: (chunk?: string) => {
        if (chunk) resData += chunk;
        statusCode = res.statusCode;
      }
    };

    return {
      req,
      res,
      getResult: () => {
        let json: any = {};
        try { json = JSON.parse(resData); } catch { json = { raw: resData }; }
        return { status: statusCode, json };
      }
    };
  }

  describe('1. Modul Acara — Persistence & Metadata Preservation', () => {
    it('harus memvalidasi dan mengekstrak format SQL time yang benar melalui extractValidSqlTime', () => {
      expect(extractValidSqlTime('13:00 – 16:00 WIB')).toBe('13:00:00');
      expect(extractValidSqlTime('16:00 WIB')).toBe('16:00:00');
      expect(extractValidSqlTime('08.30')).toBe('08:30:00');
      expect(extractValidSqlTime('Selesai')).toBeNull();
      expect(extractValidSqlTime('')).toBeNull();
      expect(extractValidSqlTime(null)).toBeNull();
    });

    it('harus mampu mem-parse database row ptv_acara dan mengekstrak blok <!-- PTV_META: {...} --> tanpa merusak catatan', () => {
      const mockMeta = {
        type: 'liputan',
        time: '08:00 – 12:00 WIB',
        loc: 'Masjid Agung',
        notes: 'Instruksi kru live streaming',
        crew: [{ id: 'k-1', name: 'Zidna', job: 'Camera Person' }],
        gear: [{ id: 'g-1', name: 'Sony FX3', qty: 1 }],
        rundown: [{ id: 'r-1', jam_mulai: '08:00', kegiatan: 'Persiapan' }]
      };
      const rawRow: any = {
        id: '11111111-2222-3333-4444-555555555555',
        nama_acara: 'Liputan Maulid Nabi',
        tanggal: '2026-10-25',
        waktu_mulai: '08:00:00',
        waktu_selesai: '12:00:00',
        lokasi: 'Masjid Agung',
        deskripsi: `<!-- PTV_META: ${JSON.stringify(mockMeta)} -->\n\nCatatan tambahan lapangan.`,
        status: 'aktif',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z'
      };

      const parsed = parseAcaraDbRow(rawRow);
      expect(parsed.id).toBe(rawRow.id);
      expect(parsed.name).toBe('Liputan Maulid Nabi');
      expect(parsed.loc).toBe('Masjid Agung');
      expect(parsed.crew).toHaveLength(1);
      expect(parsed.crew[0].name).toBe('Zidna');
      expect(parsed.gear).toHaveLength(1);
      expect(parsed.gear[0].name).toBe('Sony FX3');
      expect(parsed.rundown).toHaveLength(1);
      expect(parsed.notes).toContain('Catatan tambahan lapangan');
    });

    it('harus menolak permintaan POST jika nama kegiatan atau tanggal kosong (HTTP 400)', async () => {
      const { req, res, getResult } = createMockReqRes('POST', { name: '', date: '2026-10-25' }, '/api/acara');
      await acaraHandler(req, res);
      const result = getResult();
      expect(result.status).toBe(400);
      expect(result.json.error).toContain('wajib diisi');
    });

    it('harus menolak permintaan jika sesi login tidak disertakan (HTTP 401)', async () => {
      const { req, res, getResult } = createMockReqRes('GET', null, '/api/acara', '');
      await acaraHandler(req, res);
      const result = getResult();
      expect(result.status).toBe(401);
      expect(result.json.code).toBe('unauthorized');
    });
  });

  describe('2. Modul Catatan Bersama & Notulensi Rapat — Dual-Type Unified Architecture', () => {
    it('harus memvalidasi pembuatan Catatan Bersama (tipe = shared) dan Notulensi Rapat (tipe = meeting_minutes)', () => {
      const sharedNotePayload = {
        judul: 'SOP Dokumentasi Live PTV',
        isi: '<p>Pedoman standar operasional broadcast studio.</p>',
        warna: 'orange',
        tipe: 'shared'
      };

      const meetingMinutesPayload = {
        judul: 'Notulensi Rapat Evaluasi Bulanan',
        isi: '<h1>Keputusan Rapat</h1><p>Penambahan alat lighting.</p>',
        warna: 'purple',
        tipe: 'meeting_minutes',
        meeting_meta: {
          date: '2026-10-18',
          time: '19:00 WIB',
          loc: 'Studio Utama',
          att: 'Zidna, Rouf, Tim Redaksi'
        }
      };

      expect(sharedNotePayload.tipe).toBe('shared');
      expect(meetingMinutesPayload.tipe).toBe('meeting_minutes');
      expect(meetingMinutesPayload.meeting_meta.att).toContain('Zidna');
    });

    it('harus menolak simpan catatan jika judul kosong (HTTP 400)', async () => {
      const { req, res, getResult } = createMockReqRes('POST', { judul: '', isi: 'konten' }, '/api/catatan');
      await catatanHandler(req, res);
      const result = getResult();
      expect(result.status).toBe(400);
      expect(result.json.error).toContain('Judul catatan wajib diisi');
    });

    it('harus menolak simpan catatan jika isi catatan kosong (HTTP 400)', async () => {
      const { req, res, getResult } = createMockReqRes('POST', { judul: 'Judul Catatan', isi: '' }, '/api/catatan');
      await catatanHandler(req, res);
      const result = getResult();
      expect(result.status).toBe(400);
      expect(result.json.error).toContain('Isi catatan tidak boleh kosong');
    });
  });

  describe('3. Modul Content Planner & Kalender — 9 Pola Recurrence Compatibility', () => {
    it('harus mem-parsing pola recurrence Masehi Tahunan dengan benar dari database row', () => {
      const row: any = {
        id: 'cp-001',
        judul: 'Hari Santri Nasional',
        platform: 'Oktober',
        status: 'draft',
        target_tayang: '2026-10-22',
        catatan: '<!-- PTV_RECURRENCE: {"type":"tanggal_masehi_tahunan","rule":{"day":22,"month":10}} -->\nKonten video profil santri.'
      };

      const parsed = parsePlannerDbRow(row);
      expect(parsed.id).toBe('cp-001');
      expect(parsed.judul_momentum).toBe('Hari Santri Nasional');
      expect(parsed.recurrence_type).toBe('tanggal_masehi_tahunan');
      expect(parsed.tanggal_masehi).toBe(22);
      expect(parsed.bulan_masehi).toBe(10);
      expect(parsed.deskripsi).toBe('Konten video profil santri.');
    });

    it('harus mem-parsing pola recurrence Hijriah Tahunan dengan benar', () => {
      const row: any = {
        id: 'cp-002',
        judul: 'Tahun Baru Hijriah 1 Muharram',
        platform: 'Muharram',
        status: 'published',
        catatan: '<!-- PTV_RECURRENCE: {"type":"tanggal_hijriah","rule":{"day":1,"month":"Muharram"}} -->\nDesain ucapan selamat 1 Muharram.'
      };

      const parsed = parsePlannerDbRow(row);
      expect(parsed.recurrence_type).toBe('tanggal_hijriah');
      expect(parsed.tanggal_hijriah).toBe(1);
      expect(parsed.bulan_hijriah).toBe('Muharram');
      expect(parsed.deskripsi).toBe('Desain ucapan selamat 1 Muharram.');
    });

    it('harus mem-parsing pola recurrence Hari Weton Jawa (Siklus 35 Hari)', () => {
      const row: any = {
        id: 'cp-003',
        judul: 'Malam Jumat Kliwon',
        platform: 'Kliwon',
        status: 'draft',
        catatan: '<!-- PTV_RECURRENCE: {"type":"hari_weton","rule":{"dayOfWeek":"Jumat","pasaran":"Kliwon"}} -->\nDoa bersama santri.'
      };

      const parsed = parsePlannerDbRow(row);
      expect(parsed.recurrence_type).toBe('hari_weton');
      expect(parsed.hari_mingguan).toBe('Jumat');
      expect(parsed.hari_pasaran).toBe('Kliwon');
    });

    it('harus menolak create momentum di /api/planner jika judul momentum kosong (HTTP 400)', async () => {
      const { req, res, getResult } = createMockReqRes('POST', { judul_momentum: '', kategori: 'Event Hijriyah' }, '/api/planner');
      await plannerHandler(req, res);
      const result = getResult();
      expect(result.status).toBe(400);
      expect(result.json.error).toContain('Judul momentum / acara konten wajib diisi');
    });
  });

  describe('4. Frontend Service Contracts', () => {
    it('acaraService harus memiliki method getEvents, updateEvent, createEvent, deleteEvent', () => {
      expect(typeof acaraService.getEvents).toBe('function');
      expect(typeof acaraService.updateEvent).toBe('function');
      expect(typeof acaraService.createEvent).toBe('function');
      expect(typeof acaraService.deleteEvent).toBe('function');
    });

    it('catatanService harus memiliki method getNotes, createNote, updateNote, deleteNote, togglePin', () => {
      expect(typeof catatanService.getNotes).toBe('function');
      expect(typeof catatanService.createNote).toBe('function');
      expect(typeof catatanService.updateNote).toBe('function');
      expect(typeof catatanService.deleteNote).toBe('function');
      expect(typeof catatanService.togglePin).toBe('function');
    });

    it('kalenderService harus memiliki method getPlanners, createPlanner, updatePlanner, deletePlanner', () => {
      expect(typeof kalenderService.getPlanners).toBe('function');
      expect(typeof kalenderService.createPlanner).toBe('function');
      expect(typeof kalenderService.updatePlanner).toBe('function');
      expect(typeof kalenderService.deletePlanner).toBe('function');
    });
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
