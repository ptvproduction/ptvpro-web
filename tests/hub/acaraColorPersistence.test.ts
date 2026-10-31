import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../../api/acara';

const { createClient, verifySessionToken } = vi.hoisted(() => ({ createClient: vi.fn(), verifySessionToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('../../api/auth/_utils/crypto', () => ({ verifySessionToken }));
vi.mock('../../api/auth/_utils/identity', () => ({ refreshLiveSession: vi.fn(async (session: any) => ['hub.access', ...(session.capabilities || [])]), verifyAccountStatusLive: vi.fn().mockResolvedValue(true) }));

describe('Penyimpanan warna acara melalui metadata existing (database mock)', () => {
  let row: any;
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.invalid');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-placeholder');
    verifySessionToken.mockReturnValue({ status_akun: 'active', status_organisasi: 'active', account_id: 'test-account',
      identity_id: '11111111-1111-4111-8111-111111111111', capabilities: ['events.create', 'events.edit'], assigned_profiles: ['eksekutif'] });
    row = { id: 'event-test', nama_acara: 'Acara Uji', tanggal: '2026-12-01', lokasi: 'Studio', status: 'aktif',
      created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
      deskripsi: '<!-- PTV_META: {"crew":[],"sessions":[],"dresscode":"Batik","display_color":"hijau"} -->\nCatatan dipertahankan' };
    createClient.mockImplementation(() => ({ from: () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null }),
        update: (value: any) => { row = { ...row, ...value }; return chain; },
        insert: (value: any) => { row = { ...row, ...value }; return chain; },
      };
      return chain;
    } }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  async function invoke(method: string, payload: object) {
    let body: any;
    const req = { method, headers: { cookie: 'ptv_hub_session=test-placeholder' },
      on: (event: string, callback: (chunk?: string) => void) => {
        if (event === 'data') callback(JSON.stringify(payload));
        if (event === 'end') callback();
      } };
    const res = { statusCode: 200, setHeader: vi.fn(), end: (value: string) => { body = JSON.parse(value); } };
    await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    expect(res.statusCode).toBe(method === 'POST' ? 201 : 200);
    return body;
  }

  it('menyimpan warna baru, membacanya kembali, dan mempertahankan metadata lain saat edit berikutnya', async () => {
    const result = await invoke('PATCH', { id: row.id, display_color: 'pink', expected_updated_at: row.updated_at });
    expect(result.event.display_color).toBe('pink');
    expect(row.deskripsi).toContain('"display_color":"pink"');
    expect(row.deskripsi).toContain('"dresscode":"Batik"');
    expect(row.deskripsi).toContain('Catatan dipertahankan');
    const next = await invoke('PATCH', { id: row.id, name: 'Nama Baru' });
    expect(next.event.display_color).toBe('pink');
  });

  it('menyimpan preset pada pembuatan acara tanpa kolom skema baru', async () => {
    const result = await invoke('POST', { name: 'Acara Baru', date: '2026-12-01', display_color: 'ungu' });
    expect(result.event.display_color).toBe('ungu');
    expect(row.deskripsi).toContain('"display_color":"ungu"');
  });
});
