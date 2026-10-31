import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signSessionToken } from '../../api/auth/_utils/crypto';
import type { SessionPayload } from '../../api/auth/_utils/types';
import handler from '../../api/kontak';
import fs from 'node:fs';

// Mock Supabase client to simulate live Staging PostgreSQL with patched contacts
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'legacy_archive_kru') {
          // Load pre-patch baseline JSON and apply the 10 patched rows
          const backup = JSON.parse(
            fs.readFileSync('backups/staging-legacy-archive-kru-pre-contacts-migration-2026-10-19.json', 'utf8')
          );
          const phoneMap: Record<string, string> = {
            'PTV-001': '6285334340616',
            'PTV-003': '6282143741822',
            'PTV-005': '6285156849438',
            'PTV-011': '6281249844113',
            'PTV-012': '6282143055550',
            'PTV-013': '6281217678155',
            'PTV-029': '62895400381155',
            'PTV-035': '6285195902495',
          };

          const patchedData = backup.map((r: any) => {
            const copy = { ...r, metadata_json: { ...(r.metadata_json || {}) } };
            if (phoneMap[r.ptv_id]) {
              copy.metadata_json.telepon = phoneMap[r.ptv_id];
            }
            if (r.ptv_id === 'PTV-017') {
              copy.full_name = 'Muhammad Hamdan Yuwafi Sulaim';
              copy.jabatan = 'Technical';
              copy.divisi = 'Operasional';
              copy.angkatan = '12';
              copy.photo_url = 'https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp';
              copy.telepon_masked = null;
              delete copy.metadata_json.telepon;
            }
            if (r.ptv_id === 'PTV-UJI-2712') {
              copy.status = 'test_quarantine';
            }
            return copy;
          });

          return {
            select: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: patchedData, error: null }),
            })),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    })),
  };
});

// Mock verifyAccountStatusLive to return true for active staging accounts
vi.mock('../../api/auth/_utils/identity', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), verifyAccountStatusLive: vi.fn().mockResolvedValue(true),
  };
});

describe('Kontak Internal — WhatsApp Access & All Authenticated Hub Users Policy', () => {
  const authSecret = 'ptvpro-secret-key-at-least-32-chars-long-123456';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-for-vitest';
  });

  function executeRequest(cookieHeader?: string) {
    const req: any = {
      method: 'GET',
      headers: {
        cookie: cookieHeader || '',
      },
      url: '/api/kontak?type=internal',
      on: vi.fn(),
    };

    let statusCode = 200;
    let responseBody = '';
    const res: any = {
      setHeader: vi.fn(),
      set statusCode(code: number) {
        statusCode = code;
      },
      get statusCode() {
        return statusCode;
      },
      end: (body: string) => {
        responseBody = body;
      },
    };

    return {
      run: async () => {
        await handler(req, res);
        return {
          statusCode,
          body: responseBody ? JSON.parse(responseBody) : {},
        };
      },
    };
  }

  it('1. Rejects unauthenticated callers with 401 Unauthorized and zero contact leakage', async () => {
    const { run } = executeRequest('');
    const result = await run();

    expect(result.statusCode).toBe(401);
    expect(result.body.code).toBe('unauthorized');
    expect(result.body.contacts).toBeUndefined();
  });

  it('2. Allows PTV-STG-ADM (Admin) to view real unmasked WhatsApp numbers', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const adminSession: SessionPayload = {
      account_id: 'a0000000-0000-0000-0000-000000000001',
      identity_id: 'i0000000-0000-0000-0000-000000000001',
      ptv_id: 'PTV-STG-ADM',
      full_name: 'Admin Staging',
      username: 'admin.staging',
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['admin', 'eksekutif'],
      capabilities: ['hub.access', 'contacts.internal.view'],
      iat: nowSec,
      exp: nowSec + 3600,
    };
    const adminToken = signSessionToken(adminSession, authSecret);

    const { run } = executeRequest(`ptv_hub_session=${adminToken}`);
    const result = await run();

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.count).toBe(49);

    const contacts = result.body.contacts || [];
    const zidna = contacts.find((c: any) => c.ptv_id === 'PTV-001');
    expect(zidna).toBeDefined();
    expect(zidna.phone).toBe('6285334340616');
    expect(zidna.phone.includes('*')).toBe(false);

    // PTV-017 has no authentic phone in historical records
    const hamdan = contacts.find((c: any) => c.ptv_id === 'PTV-017');
    expect(hamdan).toBeDefined();
    expect(hamdan.full_name).toBe('Muhammad Hamdan Yuwafi Sulaim');
    expect(hamdan.phone).toBeUndefined();
  });

  it('3. Allows PTV-STG-KRU (Standard Crew without contacts.internal.view) to ALSO view real unmasked WhatsApp numbers', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const kruSession: SessionPayload = {
      account_id: 'a0000000-0000-0000-0000-000000000002',
      identity_id: 'i0000000-0000-0000-0000-000000000002',
      ptv_id: 'PTV-STG-KRU',
      full_name: 'Kru Staging',
      username: 'kru.staging',
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['kru'],
      capabilities: ['hub.access'], // Kru standar tanpa capability kontak apa pun
      iat: nowSec,
      exp: nowSec + 3600,
    };
    const kruToken = signSessionToken(kruSession, authSecret);

    const { run } = executeRequest(`ptv_hub_session=${kruToken}`);
    const result = await run();

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.count).toBe(49);

    const contacts = result.body.contacts || [];

    // Verify all 8 migrated leadership & crew WhatsApp numbers are unmasked for Kru
    const verifiedPhonePtvIds = [
      { id: 'PTV-001', expected: '6285334340616' },
      { id: 'PTV-003', expected: '6282143741822' },
      { id: 'PTV-005', expected: '6285156849438' },
      { id: 'PTV-011', expected: '6281249844113' },
      { id: 'PTV-012', expected: '6282143055550' },
      { id: 'PTV-013', expected: '6281217678155' },
      { id: 'PTV-029', expected: '62895400381155' },
      { id: 'PTV-035', expected: '6285195902495' },
    ];

    for (const target of verifiedPhonePtvIds) {
      const c = contacts.find((item: any) => item.ptv_id === target.id);
      expect(c).toBeDefined();
      expect(c.phone).toBe(target.expected);
      expect(c.phone.includes('*')).toBe(false);
    }
  });

  it('4. Excludes quarantined test record PTV-UJI-2712 from official directory', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const kruSession: SessionPayload = {
      account_id: 'a0000000-0000-0000-0000-000000000002',
      identity_id: 'i0000000-0000-0000-0000-000000000002',
      ptv_id: 'PTV-STG-KRU',
      full_name: 'Kru Staging',
      username: 'kru.staging',
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['kru'],
      capabilities: ['hub.access'],
      iat: nowSec,
      exp: nowSec + 3600,
    };
    const kruToken = signSessionToken(kruSession, authSecret);

    const { run } = executeRequest(`ptv_hub_session=${kruToken}`);
    const result = await run();

    const contacts = result.body.contacts || [];
    const testRecord = contacts.find((c: any) => c.ptv_id === 'PTV-UJI-2712');
    expect(testRecord).toBeUndefined();
  });
});
