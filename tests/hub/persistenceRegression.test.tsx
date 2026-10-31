import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StagingPeminjamanService } from '../../src/products/hub/peminjaman/stagingPeminjamanService';
import { LostFoundProvider, useLostFound } from '../../src/products/hub/lost-found/LostFoundContext';
import { DamageReportProvider, useDamageReport } from '../../src/products/hub/lapor-kerusakan/DamageReportContext';

const { rpc, abortSignal } = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock('../../src/core/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({ rpc }),
}));

const dto = { borrower_name: 'Operator Uji', purpose: 'Uji kontrak lokal', due_date: '2099-12-31', unit_ids: ['unit-test'] };

describe('Persistensi peminjaman Staging (kontrak mock, bukan cloud)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');
    vi.stubEnv('VITE_AUTH_BACKEND', 'supabase');
    rpc.mockImplementation((_name, args) => {
      abortSignal.mockResolvedValue({ data: { success: true, transaction_id: args.p_transaction_id, loan_id: args.p_loan_row_id, unit_id: args.p_unit_id }, error: null });
      return { abortSignal };
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

  it('checkout menunggu konfirmasi RPC atomik, tanpa actor dari browser', async () => {
    let resolve!: (value: unknown) => void;
    rpc.mockReturnValueOnce({ abortSignal });
    abortSignal.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const done = vi.fn();
    const result = new StagingPeminjamanService().checkoutLoan(dto).then(done);
    expect(done).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('rpc_checkout_loan', expect.objectContaining({ p_unit_ids: ['unit-test'] }));
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_actor_id');
    resolve({ data: { success: true, transaction_id: rpc.mock.calls[0][1].p_transaction_id }, error: null });
    await result;
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('penolakan backend tidak disamarkan sebagai sukses', async () => {
    rpc.mockReturnValueOnce({ abortSignal });
    abortSignal.mockResolvedValueOnce({ data: null, error: { message: 'Permission denied' } });
    await expect(new StagingPeminjamanService().checkoutLoan(dto)).rejects.toThrow('Permission denied');
  });

  it('respons tanpa konfirmasi tidak dianggap tersimpan', async () => {
    rpc.mockReturnValueOnce({ abortSignal });
    abortSignal.mockResolvedValueOnce({ data: {}, error: null });
    await expect(new StagingPeminjamanService().checkoutLoan(dto)).rejects.toThrow('belum mengonfirmasi');
  });

  it('menolak Production sebelum memanggil RPC', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://jthzuhkblxcaohiuypqq.supabase.co');
    await expect(new StagingPeminjamanService().checkoutLoan(dto)).rejects.toThrow('Staging');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('timeout tidak mengonfirmasi sukses dan retry memakai transaction ID yang sama', async () => {
    vi.useFakeTimers();
    rpc.mockReturnValueOnce({ abortSignal });
    abortSignal.mockReturnValueOnce(new Promise(() => {}));
    const service = new StagingPeminjamanService();
    const pending = expect(service.checkoutLoan(dto)).rejects.toThrow('belum diterima');
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
    const firstId = rpc.mock.calls[0][1].p_transaction_id;
    await service.checkoutLoan(dto);
    expect(rpc.mock.calls[1][1].p_transaction_id).toBe(firstId);
  });

  it('reload melalui instance baru membaca sumber API, bukan array lokal', async () => {
    const loans = [{ id: 'saved-loan', transaction_id: 'TRX-TEST', unit_id: 'unit-test', status: 'dipinjam' }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, loans }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await new StagingPeminjamanService().getPeminjamanList()).toEqual(loans);
    expect(await new StagingPeminjamanService().getPeminjamanList()).toEqual(loans);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('API gagal tidak memunculkan fixtures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(new StagingPeminjamanService().getPeminjamanList()).rejects.toThrow('500');
  });

  it('pengembalian transaksi memakai RPC existing beserta catatan', async () => {
    await new StagingPeminjamanService().returnLoan({ transaction_id: 'TRX-TEST', condition_status: 'bagus', notes: 'Lengkap' });
    expect(rpc).toHaveBeenCalledWith('rpc_return_loan', expect.objectContaining({ p_notes: 'Lengkap' }));
  });

  it('catatan unit tunggal tidak dibuang diam-diam', async () => {
    await expect(new StagingPeminjamanService().returnSingleLoan('loan', 'bagus', 'Catatan')).rejects.toThrow('adapter server Hub');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('cookie Hub memakai adapter server tanpa memakai token Supabase lain', async () => {
    vi.stubEnv('VITE_AUTH_BACKEND', 'vercel');
    const fetchMock = vi.fn().mockImplementation(async (_url, options) => ({ ok: true, json: async () => ({ success: true, transaction_id: JSON.parse(options.body).args.p_transaction_id }) }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await new StagingPeminjamanService().checkoutLoan(dto)).success).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/peminjaman');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).args).not.toHaveProperty('p_account_id');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('success untuk transaksi berbeda tidak ditampilkan sebagai keberhasilan', async () => {
    rpc.mockReturnValueOnce({ abortSignal });
    abortSignal.mockResolvedValueOnce({ data: { success: true, transaction_id: 'OTHER' }, error: null });
    await expect(new StagingPeminjamanService().checkoutLoan(dto)).rejects.toThrow('tidak cocok');
  });
  it('unit yang sudah kembali tidak dikirim kembali ke RPC', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, loans: [{ id: 'loan', status: 'dikembalikan' }] }) }));
    await expect(new StagingPeminjamanService().returnSingleLoan('loan')).rejects.toThrow('sudah dikembalikan');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('konfirmasi pengembalian harus cocok dengan ID laporan dan unit yang dipilih', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, loans: [{ id: 'loan', unit_id: 'unit', status: 'dipinjam' }] }) }));
    rpc.mockReturnValueOnce({ abortSignal });
    abortSignal.mockResolvedValueOnce({ data: { success: true, loan_id: 'loan', unit_id: 'wrong-unit' }, error: null });
    await expect(new StagingPeminjamanService().returnSingleLoan('loan')).rejects.toThrow('Konfirmasi unit backend tidak cocok');
  });
  it('pengembalian tanpa catatan hanya mengirim unit canonical yang dipilih', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, loans: [{ id: 'loan', unit_id: 'unit', status: 'dipinjam' }] }) }));
    expect(await new StagingPeminjamanService().returnSingleLoan('loan')).toEqual(expect.objectContaining({ success: true }));
    expect(rpc).toHaveBeenCalledWith('rpc_return_single_unit', { p_loan_row_id: 'loan', p_unit_id: 'unit', p_condition_status: 'bagus' });
  });
});

describe('Laporan gagal menyimpan tidak membuat keberhasilan semu', () => {
  it('Lost & Found meneruskan penolakan tanpa membuat record optimistik', async () => {
    const checks: Promise<unknown>[] = [];
    const Probe = () => {
      const context = useLostFound();
      checks.push(expect(context.addItem({} as never)).rejects.toThrow('Staging'));
      checks.push(expect(context.updateStatus('id', 'Dikembalikan')).rejects.toThrow('Staging'));
      checks.push(expect(context.deleteItem('id')).rejects.toThrow('Staging'));
      expect(context.items).toEqual([]);
      return null;
    };
    renderToStaticMarkup(<LostFoundProvider><Probe /></LostFoundProvider>);
    await Promise.all(checks);
  });

  it('kerusakan meneruskan penolakan dan tidak mensimulasikan mutasi unit', async () => {
    const checks: Promise<unknown>[] = [];
    const Probe = () => {
      const context = useDamageReport();
      checks.push(expect(context.createReport({} as never)).rejects.toThrow('Staging'));
      checks.push(expect(context.updateQCAction('id', 'Selesai', '')).rejects.toThrow('Staging'));
      checks.push(expect(context.deleteReport('id')).rejects.toThrow('Staging'));
      expect(context.reports).toEqual([]);
      expect(context.unitConditions).toEqual([]);
      return null;
    };
    renderToStaticMarkup(<DamageReportProvider><Probe /></DamageReportProvider>);
    await Promise.all(checks);
  });
});
