import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import handler from '../../api/verifikasi-surat';
import { verifyDocumentOnServer } from '../../src/products/verification/publicDocumentService';

const { query, createClient } = vi.hoisted(() => ({ query: vi.fn(), createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

async function request(
  method = 'GET',
  nomor = '007/SI-PTV/X/2026',
  bodyPayload?: any,
  headers: Record<string, string> = {}
) {
  let body: any;
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (value: string) => {
      try {
        body = JSON.parse(value);
      } catch {
        body = value;
      }
    },
  };

  const req = (
    bodyPayload !== undefined
      ? Readable.from([Buffer.from(JSON.stringify(bodyPayload))])
      : Readable.from([])
  ) as any;

  req.method = method;
  req.url = `/?nomor=${encodeURIComponent(nomor)}`;
  req.headers = {
    'user-agent': 'vitest-test-agent',
    ...headers,
  };

  await handler(req as IncomingMessage, res as unknown as ServerResponse);
  return { res, body };
}

describe('Verifikasi dokumen server & riwayat audit pemeriksaan', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.invalid');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-placeholder');

    createClient.mockReturnValue({
      from: (table: string) => ({
        select: (columns: string = '*') => ({
          eq: (field: string, value: string) => ({
            limit: (limit: number) => query({ table, columns, field, value, limit }),
            order: (orderField: string, orderOpts: any) => ({
              limit: (limit: number) => query({ table, columns, field, value, orderField, orderOpts, limit }),
            }),
          }),
        }),
        insert: (row: any) => ({
          select: () => query({ action: 'insert', table, row }),
        }),
        update: (payload: any) => ({
          eq: (field: string, value: string) => query({ action: 'update', table, payload, field, value }),
        }),
      }),
    });

    query.mockImplementation((args: any) => {
      const { table, action, row } = args || {};
      if (action === 'insert') {
        return Promise.resolve({ data: [{ id: 'mock-log-1', ...row }], error: null });
      }
      if (action === 'update') {
        return Promise.resolve({ data: [], error: null });
      }
      if (table === 'ptv_surat_verifikasi_logs') {
        return Promise.resolve({
          data: [
            {
              id: 'log-101',
              nomor_surat: '007/SI-PTV/X/2026',
              nama_pemeriksa: 'Ust. Ahmad Fauzi',
              instansi: 'ASRAMA',
              metadata: {
                hasil: 'Berhasil',
                status_dokumen: 'valid',
                catatan: 'Pemeriksaan Sah',
                recorded_at: '2026-10-31T05:00:00.000Z',
                userAgent: 'SECRET_AGENT_STRING_SHOULD_BE_SANITIZED',
              },
              accessed_at: '2026-10-31T05:00:00.000Z',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({
        data: [
          {
            id: 'doc-007',
            nomor_surat: '007/SI-PTV/X/2026',
            status: 'disetujui',
            jenis_kegiatan: 'Peliputan Resmi',
            tanggal_selesai: '2026-12-31',
            santri_list: [{ nama: 'Ahmad' }],
            nama_santri: 'PRIVATE',
            metadata: {},
          },
        ],
        error: null,
      });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('mencari nomor asli secara persis dan mempublikasikan metadata resmi beserta riwayat pemeriksaan yang disanitasi', async () => {
    const { body, res } = await request();
    expect(res.statusCode).toBe(200);
    expect(body.found).toBe(true);
    expect(body.nomor_surat).toBe('007/SI-PTV/X/2026');
    expect(body.status).toBe('valid');
    expect(Array.isArray(body.riwayat_pemeriksaan)).toBe(true);
    expect(body.riwayat_pemeriksaan.length).toBe(1);
    expect(body.riwayat_pemeriksaan[0].nama_pemeriksa).toBe('Ust. Ahmad Fauzi');
    expect(body.riwayat_pemeriksaan[0].instansi).toBe('ASRAMA');
    expect(body.riwayat_pemeriksaan[0].hasil).toBe('Berhasil');

    // Pastikan field sensitif internal seperti userAgent mentah atau private query tidak bocor ke riwayat publik
    expect(JSON.stringify(body.riwayat_pemeriksaan)).not.toContain('SECRET_AGENT_STRING');
  });

  it('menolak format nomor surat yang tidak sesuai standar', async () => {
    const result = await request('GET', 'VERIF-SI_internal');
    expect(result.res.statusCode).toBe(400);
  });

  it('tidak menganggap data tidak ditemukan, ambigu, atau error sebagai valid', async () => {
    query.mockResolvedValueOnce({ data: [], error: null });
    expect((await request()).body).toEqual({ found: false, nomor_surat: '007/SI-PTV/X/2026' });

    query.mockResolvedValueOnce({ data: null, error: { message: 'DB Connection Error' } });
    const result = await request();
    expect(result.res.statusCode).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain('DB Connection Error');
  });

  it('memperlakukan status tidak dikenal sebagai belum disahkan', async () => {
    query.mockImplementation(({ table }: any) => {
      if (table === 'ptv_surat_verifikasi_logs') return Promise.resolve({ data: [], error: null });
      return Promise.resolve({
        data: [{ nomor_surat: '007/SI-PTV/X/2026', status: 'unknown', metadata: {} }],
        error: null,
      });
    });
    const { body } = await request();
    expect(body.status).toBe('menunggu');
  });

  it('menolak verifikasi ketika konfigurasi server belum tersedia', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await request()).res.statusCode).toBe(503);
  });

  it('mencatat riwayat pemeriksaan via POST dan mengembalikan status serta daftar riwayat terbarui', async () => {
    const payload = {
      nomor_surat: '007/SI-PTV/X/2026',
      nama_pemeriksa: 'Ustadz Ridwan',
      instansi: 'MADIN',
    };

    const { res, body } = await request('POST', '007/SI-PTV/X/2026', payload);
    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.pemeriksa.nama).toBe('Ustadz Ridwan');
    expect(body.pemeriksa.instansi).toBe('MADIN');
    expect(body.pemeriksa.hasil).toBe('Berhasil');
  });

  it('menolak fallback lokal ketika server gagal atau payload tidak sah', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ found: true, status: 'valid' }) }));
    await expect(verifyDocumentOnServer('007/SI-PTV/X/2026')).rejects.toThrow();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ found: true, nomor_surat: 'OTHER', status: 'valid' }) }));
    await expect(verifyDocumentOnServer('007/SI-PTV/X/2026')).rejects.toThrow();
  });
});
