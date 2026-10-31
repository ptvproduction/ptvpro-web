import * as liveIdentity from '../../api/_routes/auth/_utils/identity';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePlannerDbRow, RawPlannerDbRow } from '../../api/_routes/planner';
import { kalenderService } from '../../src/products/hub/kalender/kalenderService';
import {
  generateMonthGridCells,
  getHijriInfo,
  getWetonInfo,
  getHijriMonthHeader,
  formatIsoDate,
  parseIsoDate,
  formatHumanDateIndo,
  matchPlannerRule,
  isPlannerActiveInMonth,
} from '../../src/products/hub/kalender/utils/calendarDateUtils';
import { CalendarEvent, ContentPlannerItem } from '../../src/products/hub/kalender/types';
import handler from '../../api/_routes/planner';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';

describe('Modul Kalender Staging Integration — Data Mapping & Recurrence', () => {
  it('harus memetakan data planner dengan target_tayang Masehi menjadi tanggal_masehi_tahunan', () => {
    const rawRow: RawPlannerDbRow = {
      id: 'plan-01',
      judul: 'Hari Santri Nasional (22 Oktober)',
      platform: 'Oktober',
      status: 'draft',
      target_tayang: '2026-10-22',
      catatan: 'Peringatan Hari Santri Nasional 22 Oktober.',
      created_at: '2026-09-23T11:55:33Z',
      updated_at: '2026-09-23T11:55:33Z',
    };

    const parsed = parsePlannerDbRow(rawRow);
    expect(parsed.id).toBe('plan-01');
    expect(parsed.judul_momentum).toBe('Hari Santri Nasional (22 Oktober)');
    expect(parsed.kategori).toBe('Event Masehi');
    expect(parsed.subkategori).toBe('Oktober');
    expect(parsed.recurrence_type).toBe('tanggal_masehi_tahunan');
    expect(parsed.bulan_masehi).toBe(10);
    expect(parsed.tanggal_masehi).toBe(22);
    expect(parsed.tanggal_mulai).toBe('2026-10-22');
  });

  it('harus mengekstrak metadata <!-- PTV_RECURRENCE: {...} --> dari catatan planner Hijriah', () => {
    const rawRow: RawPlannerDbRow = {
      id: 'plan-02',
      judul: 'Haul Ploso',
      platform: 'Haul',
      status: 'draft',
      target_tayang: null,
      catatan: '<!-- PTV_RECURRENCE: {"day":9,"month":"Muharram"} --> Peringatan haul akbar Ploso.',
      created_at: '2026-09-23T11:55:33Z',
      updated_at: '2026-09-23T11:55:33Z',
    };

    const parsed = parsePlannerDbRow(rawRow);
    expect(parsed.judul_momentum).toBe('Haul Ploso');
    expect(parsed.kategori).toBe('Event Hijriah');
    expect(parsed.recurrence_type).toBe('tanggal_hijriah');
    expect(parsed.tanggal_hijriah).toBe(9);
    expect(parsed.bulan_hijriah).toBe('Muharram');
    expect(parsed.deskripsi).toBe('Peringatan haul akbar Ploso.');
  });

  it('harus memetakan platform bulan Hijriah tanpa tanggal spesifik sebagai bulan_hijriah', () => {
    const rawRow: RawPlannerDbRow = {
      id: 'plan-03',
      judul: 'Doa Awal & Akhir Tahun & Amalan Muharram',
      platform: 'Muharram',
      status: 'draft',
      target_tayang: null,
      catatan: 'Doa Awal Tahun dan akhir tahun.',
      created_at: '2026-09-23T11:55:33Z',
      updated_at: '2026-09-23T11:55:33Z',
    };

    const parsed = parsePlannerDbRow(rawRow);
    expect(parsed.kategori).toBe('Event Hijriah');
    expect(parsed.recurrence_type).toBe('bulan_hijriah');
    expect(parsed.bulan_hijriah).toBe('Muharram');
  });

  it('harus memetakan event fleksibel seperti Majelis Sama dan Haul PPBS', () => {
    const rawRow: RawPlannerDbRow = {
      id: 'plan-04',
      judul: "Majelis Sama'",
      platform: "Majelis Sama'",
      status: 'draft',
      target_tayang: null,
      catatan: "EVALUASI MAJELIS SAMA': Lebih di-highlight lagi.",
      created_at: '2026-09-23T11:55:33Z',
      updated_at: '2026-09-23T11:55:33Z',
    };

    const parsed = parsePlannerDbRow(rawRow);
    expect(parsed.kategori).toBe('Event Pondok');
    expect(parsed.recurrence_type).toBe('fleksibel');
    expect(isPlannerActiveInMonth(parsed, 2026, 9)).toBe(true);
  });
});

describe('Modul Kalender — Grid Calculation & Rule Matching', () => {
  const sampleEvents: CalendarEvent[] = [
    {
      id: 'ev-01',
      name: 'Peliputan Kajian Akbar Ahad Pagi',
      date: '2026-10-22',
      time: '08:00 - 11:30 WIB',
      loc: 'Aula Utama PPBS',
      category: 'Liputan Utama',
    },
  ];

  const samplePlanners: ContentPlannerItem[] = [
    {
      id: 'p-01',
      judul_momentum: 'Hari Santri Nasional (22 Oktober)',
      kategori: 'Event Masehi',
      recurrence_type: 'tanggal_masehi_tahunan',
      bulan_masehi: 10,
      tanggal_masehi: 22,
    },
    {
      id: 'p-02',
      judul_momentum: 'Hari Kesaktian Pancasila',
      kategori: 'Event Masehi',
      recurrence_type: 'tanggal_masehi_tahunan',
      bulan_masehi: 10,
      tanggal_masehi: 1,
    },
  ];

  it('harus mendeteksi hasEvent, hasPlanner, dan hasBoth pada sel kalender Oktober 2026', () => {
    // Oktober = index 9 (0-indexed)
    const cells = generateMonthGridCells(2026, 9, '2026-10-22', sampleEvents, samplePlanners);

    // Tanggal 1 Oktober: Ada planner p-02, tidak ada acara
    const cellOct1 = cells.find((c) => !c.isOutOfMonth && c.dayNumber === 1);
    expect(cellOct1).toBeDefined();
    expect(cellOct1?.hasPlanner).toBe(true);
    expect(cellOct1?.hasEvent).toBe(false);
    expect(cellOct1?.hasBoth).toBe(false);

    // Tanggal 22 Oktober: Ada acara ev-01 dan planner p-01 -> hasBoth!
    const cellOct22 = cells.find((c) => !c.isOutOfMonth && c.dayNumber === 22);
    expect(cellOct22).toBeDefined();
    expect(cellOct22?.hasEvent).toBe(true);
    expect(cellOct22?.hasPlanner).toBe(true);
    expect(cellOct22?.hasBoth).toBe(true);
    expect(cellOct22?.isSelected).toBe(true);

    const h = getHijriInfo('2026-10-22');
    const w = getWetonInfo('2026-10-22');
    expect(matchPlannerRule(samplePlanners[0], '2026-10-22', h, w)).toBe(true);
  });

  it('harus menghasilkan header rentang bulan Hijriah yang valid', () => {
    const header = getHijriMonthHeader(2026, 9);
    expect(header).toContain('H');
    expect(typeof header).toBe('string');
  });

  it('harus mencocokkan tanggal Weton dan Hijriah secara konsisten', () => {
    const w = getWetonInfo('2026-10-22');
    expect(w.day).toBeDefined();
    expect(w.pasaran).toBeDefined();

    const h = getHijriInfo('2026-10-22');
    expect(h.day).toBeGreaterThan(0);
    expect(h.year).toBeGreaterThan(1440);
  });

  it('harus memvalidasi format tanggal WIB dan round-trip parsing', () => {
    const iso = '2026-10-22';
    const human = formatHumanDateIndo(iso);
    expect(human).toBe('22 Oktober 2026');

    const d = parseIsoDate(iso);
    expect(formatIsoDate(d)).toBe(iso);
  });
});

describe('Modul Kalender — Fail-Closed Service Policy (No Silent Fallback)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('harus melempar error eksplisit ketika /api/planner mengembalikan status 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Koneksi database Staging terputus' }),
      })
    );

    await expect(kalenderService.getPlanners()).rejects.toThrow(
      'Koneksi database Staging terputus'
    );
  });

  it('harus melempar error ketika format respon API tidak memiliki array planners', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: false }),
      })
    );

    await expect(kalenderService.getPlanners()).rejects.toThrow(
      'Format respon API momentum tidak valid.'
    );
  });

  it('harus melempar error jika response server bukan JSON (misal JavaScript/HTML)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/javascript' : null),
        },
        json: async () => {
          throw new SyntaxError("Unexpected token 'i'");
        },
      })
    );

    await expect(kalenderService.getPlanners()).rejects.toThrow(
      'Respon server bukan format JSON yang valid.'
    );
  });

  it('harus mengembalikan array planners asli ketika fetch berhasil', async () => {
    const mockPlanners = [
      {
        id: 'p-1',
        judul_momentum: 'Peringatan Hari Santri',
        kategori: 'Event Masehi',
        recurrence_type: 'tanggal_masehi_tahunan',
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, count: 1, planners: mockPlanners }),
      })
    );

    const result = await kalenderService.getPlanners();
    expect(result).toHaveLength(1);
    expect(result[0].judul_momentum).toBe('Peringatan Hari Santri');
  });
});

describe('Modul Kalender Backend RBAC Gate — /api/planner Security', () => {
  const authSecret = 'test-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.spyOn(liveIdentity, 'verifyAccountStatusLive').mockResolvedValue(true);
    process.env.AUTH_SECRET = authSecret;
    process.env.SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-staging';
  });

  it('harus menolak request tanpa cookie sesi (HTTP 401 Unauthorized)', async () => {
    const req: any = {
      method: 'GET',
      headers: {},
    };

    let statusCode = 200;
    let jsonBody = '';
    const res: any = {
      setHeader: vi.fn(),
      statusCode: 200,
      end: vi.fn((data: string) => {
        jsonBody = data;
      }),
    };

    Object.defineProperty(res, 'statusCode', {
      set(val) {
        statusCode = val;
      },
      get() {
        return statusCode;
      },
    });

    await handler(req, res);

    expect(statusCode).toBe(401);
    const body = JSON.parse(jsonBody);
    expect(body.code).toBe('unauthorized');
  });

  it('harus menolak request dengan sesi pengguna yang tidak memiliki capability calendar.view (HTTP 403 Forbidden)', async () => {
    // Token valid tapi tidak punya izin calendar.view atau events.view
    const token = signSessionToken(
      {
        account_id: 'acc-restricted',
        identity_id: 'id-restricted',
        ptv_id: 'PTV-999',
        full_name: 'Restricted User',
        username: 'restricted_user',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['tamu'],
        capabilities: ['profile.view'], // Tidak memiliki calendar.view / events.view / hub.access
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      authSecret
    );

    const req: any = {
      method: 'GET',
      headers: {
        cookie: `ptv_hub_session=${token}`,
      },
    };

    let statusCode = 200;
    let jsonBody = '';
    const res: any = {
      setHeader: vi.fn(),
      end: vi.fn((data: string) => {
        jsonBody = data;
      }),
    };
    Object.defineProperty(res, 'statusCode', {
      set(val) {
        statusCode = val;
      },
      get() {
        return statusCode;
      },
    });

    await handler(req, res);

    expect(statusCode).toBe(403);
    const body = JSON.parse(jsonBody);
    expect(body.code).toBe('forbidden');
  });

  it('harus menolak request POST tanpa payload valid atau tanpa izin tulis (HTTP 403 Forbidden)', async () => {
    // Sesi tanpa capability write
    const token = signSessionToken(
      {
        account_id: 'acc-reader',
        identity_id: 'id-reader',
        ptv_id: 'PTV-888',
        full_name: 'Reader Only',
        username: 'reader_only',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['anggota'],
        capabilities: ['calendar.view'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      authSecret
    );

    const req: any = {
      method: 'POST',
      headers: {
        cookie: `ptv_hub_session=${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ judul_momentum: 'Acara Baru' }),
    };

    let statusCode = 200;
    let jsonBody = '';
    const res: any = {
      setHeader: vi.fn(),
      end: vi.fn((data: string) => {
        jsonBody = data;
      }),
    };
    Object.defineProperty(res, 'statusCode', {
      set(val) {
        statusCode = val;
      },
      get() {
        return statusCode;
      },
    });

    await handler(req, res);
    expect(statusCode).toBe(403);
    const body = JSON.parse(jsonBody);
    expect(body.code).toBe('forbidden');
  });

  it('harus menolak request DELETE dengan format UUID tidak valid (HTTP 400 Bad Request)', async () => {
    const token = signSessionToken(
      {
        account_id: 'acc-admin',
        identity_id: 'id-admin',
        ptv_id: 'PTV-001',
        full_name: 'Admin User',
        username: 'admin',
        status_akun: 'active',
        status_organisasi: 'active',
        assigned_profiles: ['administrator'],
        capabilities: ['calendar.edit', 'events.manage', 'hub.access'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      authSecret
    );

    const req: any = {
      method: 'DELETE',
      headers: {
        cookie: `ptv_hub_session=${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: 'invalid-non-uuid-id' }),
    };

    let statusCode = 200;
    let jsonBody = '';
    const res: any = {
      setHeader: vi.fn(),
      end: vi.fn((data: string) => {
        jsonBody = data;
      }),
    };
    Object.defineProperty(res, 'statusCode', {
      set(val) {
        statusCode = val;
      },
      get() {
        return statusCode;
      },
    });

    await handler(req, res);
    expect(statusCode).toBe(400);
    const body = JSON.parse(jsonBody);
    expect(body.error).toContain('UUID');
  });
});

describe('Modul Kalender — 9 Pola Recurrence Legacy & Client CRUD Services', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('harus memetakan dan mengekstrak daftar_konten dan referensi_url dari catatan recurrence', () => {
    const rawRow: RawPlannerDbRow = {
      id: 'plan-05',
      judul: 'Konten Peringatan Maulid',
      platform: 'Rabiul Awal',
      status: 'draft',
      target_tayang: null,
      catatan:
        '<!-- PTV_RECURRENCE: {"type":"tanggal_hijriah","bulan_hijriah":"Rabiul Awal","tanggal_hijriah":12,"daftar_konten":["Reels Sejarah","Carousel Sholawat"],"referensi_url":"https://contoh.com/maulid"} --> Peringatan Maulid Nabi SAW.',
      created_at: '2026-09-23T11:55:33Z',
      updated_at: '2026-09-23T11:55:33Z',
    };

    const parsed = parsePlannerDbRow(rawRow);
    expect(parsed.recurrence_type).toBe('tanggal_hijriah');
    expect(parsed.bulan_hijriah).toBe('Rabiul Awal');
    expect(parsed.tanggal_hijriah).toBe(12);
    expect(parsed.daftar_konten).toEqual(['Reels Sejarah', 'Carousel Sholawat']);
    expect(parsed.referensi_url).toBe('https://contoh.com/maulid');
    expect(parsed.deskripsi).toBe('Peringatan Maulid Nabi SAW.');
  });

  it('harus memastikan bulan_hijriah dan bagian_bulan_hijriah memiliki tanggal_hijriah null agar tidak terkunci di tanggal 1', () => {
    const rawRow1: RawPlannerDbRow = {
      id: 'plan-06',
      judul: 'Amalan Rajab',
      platform: 'Rajab',
      status: 'draft',
      target_tayang: null,
      catatan: '<!-- PTV_RECURRENCE: {"type":"bulan_hijriah","bulan_hijriah":"Rajab"} --> Amalan puasa dan istighfar.',
    };

    const parsed1 = parsePlannerDbRow(rawRow1);
    expect(parsed1.recurrence_type).toBe('bulan_hijriah');
    expect(parsed1.tanggal_hijriah).toBeNull();

    const rawRow2: RawPlannerDbRow = {
      id: 'plan-07',
      judul: '10 Hari Terakhir Ramadhan',
      platform: 'Ramadhan',
      status: 'draft',
      target_tayang: null,
      catatan:
        '<!-- PTV_RECURRENCE: {"type":"bagian_bulan_hijriah","bulan_hijriah":"Ramadhan","rule":"10_terakhir"} --> Iktikaf dan Lailatul Qadar.',
    };

    const parsed2 = parsePlannerDbRow(rawRow2);
    expect(parsed2.recurrence_type).toBe('bagian_bulan_hijriah');
    expect(parsed2.tanggal_hijriah).toBeNull();
  });

  it('harus mencocokkan pola setiap_bulan dan hari_mingguan dengan benar pada calendarDateUtils', () => {
    const monthlyPlanner: ContentPlannerItem = {
      id: 'p-monthly',
      judul_momentum: 'Evaluasi Tim Setiap Tanggal 15',
      kategori: 'Konten Rutin',
      recurrence_type: 'setiap_bulan',
      tanggal_masehi: 15,
    };

    const h = getHijriInfo('2026-10-15');
    const w = getWetonInfo('2026-10-15');
    expect(matchPlannerRule(monthlyPlanner, '2026-10-15', h, w)).toBe(true);
    expect(matchPlannerRule(monthlyPlanner, '2026-10-16', h, w)).toBe(false);

    const weeklyPlanner: ContentPlannerItem = {
      id: 'p-weekly',
      judul_momentum: 'Kajian Rutin Malam Jumat',
      kategori: 'Konten Rutin',
      recurrence_type: 'hari_mingguan',
      hari_mingguan: 'Kamis',
    };

    // 2026-10-22 adalah hari Kamis
    expect(matchPlannerRule(weeklyPlanner, '2026-10-22', h, w)).toBe(true);
    // 2026-10-23 adalah hari Jumat
    expect(matchPlannerRule(weeklyPlanner, '2026-10-23', getHijriInfo('2026-10-23'), getWetonInfo('2026-10-23'))).toBe(false);
  });

  it('kalenderService.createPlanner harus mengirim payload POST dan mengembalikan item baru', async () => {
    const mockCreated = {
      id: '11111111-2222-3333-4444-555555555555',
      judul_momentum: 'Momentum Baru Uji Coba',
      kategori: 'Event Masehi',
      recurrence_type: 'tanggal_masehi_tahunan',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          planner: mockCreated,
        }),
      })
    );

    const res = await kalenderService.createPlanner({
      judul_momentum: 'Momentum Baru Uji Coba',
      recurrence_type: 'tanggal_masehi_tahunan',
      bulan_masehi: 10,
      tanggal_masehi: 25,
      deskripsi: 'Deskripsi uji coba',
    });

    expect(res.id).toBe('11111111-2222-3333-4444-555555555555');
    expect(res.judul_momentum).toBe('Momentum Baru Uji Coba');
  });

  it('kalenderService.updatePlanner dan deletePlanner harus memanggil endpoint yang tepat', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        planner: { id: 'uuid-1', judul_momentum: 'Updated' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await kalenderService.updatePlanner('uuid-1', { judul_momentum: 'Updated' });
    expect(updated.judul_momentum).toBe('Updated');
    expect(fetchMock).toHaveBeenCalledWith('/api/planner', expect.objectContaining({ method: 'PATCH' }));

    await kalenderService.deletePlanner('uuid-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/planner', expect.objectContaining({ method: 'DELETE' }));
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/_routes/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/_routes/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
