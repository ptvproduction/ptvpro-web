import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeReport } from '../../src/products/hub/reportPersistence';
import { handleReportWrite, reportCanRead } from '../../api/_routes/reportPersistence';
import type { SessionPayload } from '../../api/_routes/auth/_utils/types';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../src/core/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({ rpc }),
}));

describe('Persistensi laporan: konfirmasi, kegagalan dan isolasi', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    vi.stubEnv('VITE_AUTH_BACKEND', 'vercel');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); vi.useRealTimers(); });

  it.each(['vercel', 'native'])('sesi cookie %s memakai API, tanpa service-role atau account ID dari browser', async backend => {
    vi.stubEnv('MODE', 'staging'); vi.stubEnv('VITE_AUTH_BACKEND', backend);
    const fetchMock = vi.fn().mockImplementation(async (_url, options) => ({
      ok: true, json: async () => ({ success: true, id: JSON.parse(options.body).id }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const id = await writeReport('lostfound', 'create', { title: 'Uji lokal' });
    expect(id).toMatch(/^[a-f\d-]{36}$/);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('account_id');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/lost-found');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('HTTP 403 ditampilkan sebagai gagal, bukan sukses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Izin ditolak' }) }));
    await expect(writeReport('damage', 'create', { title: 'Uji ditolak' })).rejects.toThrow('Izin ditolak');
  });

  it('backend wajib mengonfirmasi ID yang sama', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, id: 'berbeda' }) }));
    await expect(writeReport('damage', 'create', { title: 'Uji id' })).rejects.toThrow('belum mengonfirmasi');
  });

  it('timeout mempertahankan ID idempotensi pada retry', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockReturnValueOnce(new Promise(() => {})).mockImplementation(async (_url, options) => ({
      ok: true, json: async () => ({ success: true, id: JSON.parse(options.body).id }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = expect(writeReport('damage', 'create', { title: 'Uji timeout' })).rejects.toThrow('belum diterima');
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
    const first = JSON.parse(fetchMock.mock.calls[0][1].body).id;
    expect(await writeReport('damage', 'create', { title: 'Uji timeout' })).toBe(first);
  });

  it('Production ditolak sebelum request', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://jthzuhkblxcaohiuypqq.supabase.co');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(writeReport('lostfound', 'create', {})).rejects.toThrow('Staging');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Adapter server memakai identitas dari cookie terverifikasi', () => {
  const session = { account_id: 'server-account', iat: 1792500000, capabilities: ['lostfound.report', 'lostfound.manage', 'damage.report', 'damage.qc.approve'] } as SessionPayload;
  const id = '00000000-0000-4000-8000-000000000106';
  function response() {
    return { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
  }
  function request(body: object, origin = 'http://localhost:5174') {
    const req = Readable.from([JSON.stringify(body)]) as unknown as import('node:http').IncomingMessage;
    req.headers = { host: 'localhost:5174', origin, 'content-type': 'application/json' };
    return req;
  }
  afterEach(() => vi.clearAllMocks());

  it('damage.view alone cannot change QC or report a new fault', async () => {
    const call = vi.fn();
    for (const action of ['create', 'update']) {
      const res = response();
      await handleReportWrite(request({ action, id, payload: {} }), res as never, { rpc: call } as never, { ...session, capabilities: ['damage.view'] }, 'damage');
      expect(res.statusCode).toBe(403);
    }
    expect(call).not.toHaveBeenCalled();
  });

  it('account_id pada body tidak dapat mengganti pelaku', async () => {
    const call = vi.fn().mockResolvedValue({ data: { success: true, id }, error: null });
    const res = response();
    await handleReportWrite(request({ action: 'create', id, payload: {}, account_id: 'spoofed' }), res as never, { rpc: call } as never, session, 'lostfound');
    expect(call).toHaveBeenCalledWith('rpc_write_report_server', expect.objectContaining({ p_account_id: 'server-account' }));
    expect(res.statusCode).toBe(200);
  });

  it('origin asing diblokir sebelum RPC', async () => {
    const call = vi.fn(); const res = response();
    await handleReportWrite(request({ action: 'create', id, payload: {} }, 'https://other.invalid'), res as never, { rpc: call } as never, session, 'damage');
    expect(res.statusCode).toBe(403);
    expect(call).not.toHaveBeenCalled();
  });

  it('penolakan capability database menjadi HTTP 403', async () => {
    const call = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'Capability required' } });
    const res = response();
    await handleReportWrite(request({ action: 'update', id, payload: { status: 'Selesai' } }), res as never, { rpc: call } as never, session, 'damage');
    expect(res.statusCode).toBe(403);
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('belum tersimpan'));
  });

  it('operasi tidak dikenal tidak diteruskan', async () => {
    const call = vi.fn(); const res = response();
    await handleReportWrite(request({ action: 'truncate', id, payload: {} }), res as never, { rpc: call } as never, session, 'damage');
    expect(res.statusCode).toBe(400);
    expect(call).not.toHaveBeenCalled();
  });

  it('hak baca diperiksa ulang dari backend, bukan hub.access di snapshot cookie', async () => {
    const call = vi.fn().mockResolvedValue({ data: false, error: null });
    expect(await reportCanRead({ rpc: call } as never, session, 'damage')).toBe(false);
    call.mockResolvedValueOnce({ data: null, error: { message: 'Unavailable' } });
    await expect(reportCanRead({ rpc: call } as never, session, 'damage')).rejects.toThrow('tidak dapat diverifikasi');
  });
});
