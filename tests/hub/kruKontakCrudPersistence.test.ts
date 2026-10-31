import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKruApiRequest } from '../../api/_routes/kru';
import kontakHandler from '../../api/_routes/kontak';
import { signSessionToken } from '../../api/_routes/auth/_utils/crypto';
import type { SessionPayload } from '../../api/_routes/auth/_utils/types';
import * as identityModule from '../../api/_routes/auth/_utils/identity';

// Unit harness: no credentials or network access to cloud.
const liveStagingUrl = 'https://swadgljnyelsjstqqxbm.supabase.co';
const liveServiceRoleKey = 'unit-test-service-key';
vi.mock('../../api/_routes/auth/_utils/liveAccess', () => ({ resolveLiveAccess: async (_db: unknown, session: SessionPayload) => ({ can: (cap: string) => session.capabilities.includes(cap) }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => {
  const chain: any = { then: (resolve: any) => resolve({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }) };
  for (const method of ['select', 'eq', 'or', 'order', 'limit']) chain[method] = () => chain;
  return chain;
} }) }));

describe('PTVPRO — CRUD & Persistence Unit Test Suite (Kru & Kontak Eksternal)', () => {
  const authSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  function makeToken(overrides: Partial<SessionPayload> = {}): string {
    const payload: SessionPayload = {
      account_id: 'acc-admin-1',
      identity_id: 'ident-admin-1',
      ptv_id: 'PTV-001',
      full_name: 'Muhammad Zidnal Falah',
      username: 'admin',
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['admin'],
      capabilities: ['crew.create', 'crew.edit', 'contacts.external.manage'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    };
    return signSessionToken(payload, authSecret);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(identityModule, 'verifyAccountStatusLive').mockResolvedValue(true);
    process.env.AUTH_SECRET = authSecret;
    process.env.VITE_SUPABASE_URL = liveStagingUrl;
    process.env.SUPABASE_URL = liveStagingUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = liveServiceRoleKey;
  });

  describe('1. Kru Management API — Validasi & Proteksi Mutasi', () => {
    it('menolak penambahan kru jika nama lengkap kurang dari 2 karakter (400)', async () => {
      const adminToken = makeToken();

      const res = await handleKruApiRequest({
        method: 'POST',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
        body: {
          full_name: 'A', // Terlalu pendek
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_full_name');
    });

    it('menolak mutasi jika ditargetkan ke Production Supabase (Anti-Production Barrier)', async () => {
      process.env.VITE_SUPABASE_URL = 'https://jthzuhkblxcaohiuypqq.supabase.co'; // Production!

      const adminToken = makeToken();

      const res = await handleKruApiRequest({
        method: 'POST',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
        body: {
          full_name: 'Kru Percobaan',
        },
      });

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('Staging');
    });

    it('menolak user tanpa izin crew.create saat mencoba POST kru baru (403)', async () => {
      const regularCrewToken = makeToken({
        assigned_profiles: ['kru'],
        capabilities: ['crew.view', 'hub.access'], // Tanpa crew.create
      });

      const res = await handleKruApiRequest({
        method: 'POST',
        headers: {
          cookie: `ptv_hub_session=${regularCrewToken}`,
        },
        body: {
          full_name: 'Kru Testing',
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');
      expect(res.body.error).toContain('crew.create');
    });

    it('menolak UPDATE kru jika target ID tidak ditemukan di database (404)', async () => {
      const adminToken = makeToken();

      const res = await handleKruApiRequest({
        method: 'PATCH',
        url: '/api/kru?id=PTV-99999',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
        body: {
          position: 'Ketua Baru',
        },
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('crew_not_found');
    });
  });

  describe('2. Kontak Eksternal API — Validasi & Proteksi Mutasi', () => {
    async function callKontakApi(options: {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      body?: any;
    }) {
      let statusCode = 200;
      let responseData: any = null;

      const chunks: Buffer[] = [];
      if (options.body) {
        chunks.push(Buffer.from(JSON.stringify(options.body)));
      }

      const { Readable } = await import('node:stream');
      const mockReq = new Readable({
        read() {
          if (chunks.length > 0) this.push(chunks.shift());
          else this.push(null);
        },
      }) as any;

      mockReq.method = options.method || 'GET';
      mockReq.url = options.url || '/api/kontak?type=eksternal';
      mockReq.headers = options.headers || {};

      const mockRes: any = {
        setHeader: vi.fn(),
        set statusCode(code: number) {
          statusCode = code;
        },
        get statusCode() {
          return statusCode;
        },
        end: (chunk: string) => {
          try {
            responseData = JSON.parse(chunk);
          } catch {
            responseData = chunk;
          }
        },
      };

      await kontakHandler(mockReq, mockRes);
      return { status: statusCode, body: responseData };
    }

    it('menolak mutasi kontak jika URL mengarah ke Production Supabase (Anti-Production Barrier)', async () => {
      process.env.VITE_SUPABASE_URL = 'https://jthzuhkblxcaohiuypqq.supabase.co'; // Production!

      const adminToken = makeToken();

      const res = await callKontakApi({
        method: 'POST',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
        body: {
          nama: 'Mitra Produksi',
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('production_write_forbidden');
    });

    it('menolak mutasi kontak jika type=internal (Kontak Internal Strict Read-Only)', async () => {
      const adminToken = makeToken();

      const res = await callKontakApi({
        method: 'POST',
        url: '/api/kontak?type=internal',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
        body: {
          nama: 'Internal Fake',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('internal_contacts_read_only');
    });

    it('menolak tambah kontak eksternal jika nama kosong (400)', async () => {
      const adminToken = makeToken();

      const res = await callKontakApi({
        method: 'POST',
        url: '/api/kontak?type=eksternal',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
        body: {
          nama: '',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_nama_kontak');
    });

    it('menolak user biasa tanpa izin saat melakukan DELETE kontak eksternal (403)', async () => {
      const regularCrewToken = makeToken({
        assigned_profiles: ['kru'],
        capabilities: ['contacts.external.view'], // Tanpa contacts.external.manage
      });

      const res = await callKontakApi({
        method: 'DELETE',
        url: '/api/kontak?type=eksternal&id=fake-uuid-1',
        headers: {
          cookie: `ptv_hub_session=${regularCrewToken}`,
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('forbidden');
    });

    it('menolak DELETE kontak eksternal jika parameter ID tidak disertakan (400)', async () => {
      const adminToken = makeToken();

      const res = await callKontakApi({
        method: 'DELETE',
        url: '/api/kontak?type=eksternal',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('missing_contact_id');
    });

    it('menolak DELETE kontak eksternal jika UUID kontak tidak ditemukan di database (404)', async () => {
      const adminToken = makeToken();

      const res = await callKontakApi({
        method: 'DELETE',
        url: '/api/kontak?type=eksternal&id=a0000000-0000-0000-0000-000000000000',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('contact_not_found');
    });

    it('menolak UPDATE kontak eksternal jika ID kontak tidak disertakan (400)', async () => {
      const adminToken = makeToken();

      const res = await callKontakApi({
        method: 'PATCH',
        url: '/api/kontak?type=eksternal',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
        body: {
          nama: 'Nama Baru',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('missing_contact_id');
    });
  });

  describe('3. Keutuhan Historis & Proteksi Arsitektur Kru', () => {
    it('secara tegas menolak metode HTTP DELETE pada modul Manajemen Kru (405 Method Not Allowed)', async () => {
      const adminToken = makeToken();

      const res = await handleKruApiRequest({
        method: 'DELETE',
        url: '/api/kru?id=PTV-001',
        headers: {
          cookie: `ptv_hub_session=${adminToken}`,
        },
      });

      expect(res.status).toBe(405);
      expect(res.body.code).toBe('method_not_allowed');
      expect(res.body.error).toContain('tidak didukung pada modul Manajemen Kru');
    });
  });
});

// Unit boundary: the payload fixture stands for a separately authorized database snapshot.
vi.mock('../../api/_routes/auth/_utils/identity', async importOriginal => {
 const actual = await importOriginal<typeof import('../../api/_routes/auth/_utils/identity')>();
 return { ...actual, refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), };
});
