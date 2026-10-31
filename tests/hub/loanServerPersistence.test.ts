import { Readable } from 'node:stream';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { handleLoanWrite, loanCanRead } from '../../api/_routes/loanPersistence';
import { StagingPeminjamanService } from '../../src/products/hub/peminjaman/stagingPeminjamanService';
import type { SessionPayload } from '../../api/_routes/auth/_utils/types';

const { directRpc } = vi.hoisted(() => ({ directRpc: vi.fn() }));
vi.mock('../../src/core/supabase/client', () => ({ isSupabaseConfigured: () => true, getSupabaseClient: () => ({ rpc: directRpc }) }));
const session = { account_id: 'verified-account', iat: 1792500000, capabilities: ['loans.checkout', 'loans.return'] } as SessionPayload;
const request = (body: object, origin = 'http://localhost:5174') => Object.assign(Readable.from([JSON.stringify(body)]), { headers: { origin, host: 'localhost:5174', 'content-type': 'application/json' } });
const response = () => ({ statusCode: 0, setHeader: vi.fn(), end: vi.fn() });

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Adapter peminjaman dengan identitas server', () => {
  it.each(['rpc_checkout_loan', 'rpc_return_loan', 'rpc_return_single_unit'])('view-only cannot invoke %s', async operation => {
    const rpc = vi.fn(); const res = response();
    await handleLoanWrite(request({ operation, args: {} }) as never, res as never, { rpc } as never, { ...session, capabilities: ['loans.view'] });
    expect(res.statusCode).toBe(403); expect(rpc).not.toHaveBeenCalled();
  });
  it('batas payload berlaku juga setelah framework mem-parsing JSON', async () => {
    const rpc = vi.fn(); const res = response();
    const req = Object.assign(request({}), { body: { operation: 'rpc_checkout_loan', args: { p_purpose: 'x'.repeat(65537) } } });
    await handleLoanWrite(req as never, res as never, { rpc } as never, session);
    expect(res.statusCode).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('terlalu besar'));
  });
  it('actor/account dari browser tidak dapat mengganti identitas cookie', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null }); const res = response();
    await handleLoanWrite(request({ operation: 'rpc_checkout_loan', args: { p_transaction_id: 'UJI', p_account_id: 'spoofed', p_actor_id: 'spoofed', p_session_iat: 1 } }) as never, res as never, { rpc } as never, session);
    expect(rpc).toHaveBeenCalledWith('rpc_checkout_loan_server', expect.objectContaining({ p_account_id: 'verified-account', p_session_iat: session.iat }));
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_actor_id');
    expect(res.statusCode).toBe(200);
  });
  it('catatan per-unit diteruskan bersama ID laporan/unit ke RPC atomik', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null }); const res = response();
    await handleLoanWrite(request({ operation: 'rpc_return_single_unit', args: { p_loan_row_id: 'loan', p_unit_id: 'unit', p_notes: 'Kabel lengkap', p_condition_status: 'bagus' } }) as never, res as never, { rpc } as never, session);
    expect(rpc).toHaveBeenCalledWith('rpc_return_single_unit_server', expect.objectContaining({ p_notes: 'Kabel lengkap', p_loan_row_id: 'loan', p_unit_id: 'unit' }));
  });
  it('origin asing ditolak sebelum RPC', async () => {
    const rpc = vi.fn(); const res = response();
    await handleLoanWrite(request({}, 'https://foreign.invalid') as never, res as never, { rpc } as never, session);
    expect(res.statusCode).toBe(403); expect(rpc).not.toHaveBeenCalled();
  });
  it.each(['rpc_drop_table', '__proto__'])('RPC tidak diizinkan: %s', async operation => {
    const rpc = vi.fn(); const res = response();
    await handleLoanWrite(request({ operation, args: {} }) as never, res as never, { rpc } as never, session);
    expect(res.statusCode).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });
  it('penolakan capability tidak menjadi sukses', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'Capability required' } }); const res = response();
    await handleLoanWrite(request({ operation: 'rpc_return_loan', args: {} }) as never, res as never, { rpc } as never, session);
    expect(res.statusCode).toBe(403); expect(res.end).toHaveBeenCalledWith(expect.stringContaining('belum dikonfirmasi'));
  });
  it('hak baca diverifikasi live dan gagal tertutup', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(loanCanRead({ rpc } as never, session)).rejects.toThrow('Izin baca');
  });
  it.each(['vercel', 'native'])('service cookie %s menyimpan catatan dan menunggu konfirmasi unit yang cocok', async backend => {
    vi.stubEnv('MODE', 'production'); vi.stubEnv('VITE_APP_ENV', 'staging');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co'); vi.stubEnv('VITE_AUTH_BACKEND', backend);
    const fetchMock = vi.fn().mockImplementation(async (_url, options) => options.method === 'POST'
      ? { ok: true, json: async () => ({ success: true, loan_id: 'loan', unit_id: 'unit' }) }
      : { ok: true, json: async () => ({ success: true, loans: [{ id: 'loan', unit_id: 'unit', status: 'dipinjam' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await new StagingPeminjamanService().returnSingleLoan('loan', 'bagus', 'Kabel lengkap')).success).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).args.p_notes).toBe('Kabel lengkap');
    expect(directRpc).not.toHaveBeenCalled();
  });
  it('error API mempertahankan alur gagal, tanpa sukses palsu', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co'); vi.stubEnv('VITE_AUTH_BACKEND', 'vercel');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Sesi dicabut' }) }));
    await expect(new StagingPeminjamanService().returnLoan({ transaction_id: 'UJI', condition_status: 'bagus' })).rejects.toThrow('Sesi dicabut');
  });
});
