import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPerizinan } from '../../src/products/hub/perizinan/loadPerizinan';
import { StagingDokumenService } from '../../src/products/hub/dokumen-saya/dokumenService';
import { getSupabaseClient } from '../../src/core/supabase/client';

vi.mock('../../src/core/supabase/client', () => ({ getSupabaseClient: vi.fn(), isSupabaseConfigured: () => true }));
const stats = { total: 0, izin: 0, tugas: 0, barang: 0, disetujui: 0, menunggu: 0, revisi: 0, ditolak: 0 };
function response(documents: unknown[] = []) {
  return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ success: true, documents, stats }) };
}

describe('Perizinan: request terbatas tanpa fallback atau loop', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('menerima sukses kosong tanpa memuat ulang atau mengambil data Supabase lain', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);
    expect((await loadPerizinan(new AbortController().signal)).documents).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])('menampilkan kegagalan HTTP %s tanpa fallback dummy', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(loadPerizinan(new AbortController().signal)).rejects.toThrow();
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it('mengakhiri request menggantung walaupun implementasi fetch mengabaikan abort', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const pending = loadPerizinan(new AbortController().signal, 100);
    const assertion = expect(pending).rejects.toThrow('batas waktu');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mengakhiri pembacaan body JSON yang menggantung', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ...response(), json: () => new Promise(() => {}) }));
    const assertion = expect(loadPerizinan(new AbortController().signal, 100)).rejects.toThrow('batas waktu');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('membatalkan request ketika halaman ditinggalkan dan membersihkan timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const controller = new AbortController();
    const assertion = expect(loadPerizinan(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('menolak payload sukses yang tidak memiliki daftar dokumen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ...response(), json: async () => ({ success: true }) }));
    await expect(new StagingDokumenService().getDocuments('my', true, { apiOnly: true })).rejects.toThrow();
  });
});
