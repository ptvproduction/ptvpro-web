import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/finance';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

vi.mock('../../api/auth/_utils/crypto', () => ({
  verifySessionToken: () => ({
    account_id: 'verified-account-uuid',
    iat: 1790000000,
  }),
}));

vi.mock('../../api/financeAccess', () => ({
  resolveFinanceAccess: () => ({
    identityId: 'verified-identity-uuid',
    canManage: true,
    global: true,
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('PTV-DEV-198: Finance 2.0 Operational Write Flows & Protection', () => {
  it('post_kas_payment_atomic memanggil rpc_record_kas_kru_payment_atomic dengan payload valid', async () => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');

    mocks.rpc.mockResolvedValue({
      data: { success: true, idempotent_replay: false },
      error: null,
    });

    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    const command = {
      version: 2,
      idempotencyKey: '00000000-0000-0000-0000-000000000001',
      operation: 'income',
      occurredOn: '2026-10-29',
      description: 'Iuran Kas Kru PTV-001',
      currency: 'IDR',
      amountMinor: '2500000',
      categoryId: '00000000-0000-0000-0000-000000000002',
      incoming: [{ pocketId: '00000000-0000-0000-0000-000000000003', amountMinor: '2500000' }],
      outgoing: [],
    };
    const kasPayload = {
      semesterId: '00000000-0000-0000-0000-000000000004',
      ptvId: 'PTV-001',
      crewName: 'Kru Satu',
      periods: ['2026-10'],
      method: 'cash',
    };

    const body = {
      action: 'post_kas_payment_atomic',
      command,
      kasPayload,
    };

    await handler(
      {
        method: 'POST',
        headers: { cookie: 'ptv_hub_session=synthetic', 'content-type': 'application/json' },
        body,
      } as never,
      res as never
    );

    expect(res.statusCode).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('rpc_record_kas_kru_payment_atomic', {
      p_account_id: 'verified-account-uuid',
      p_session_iat: 1790000000,
      p_command: command,
      p_kas_payload: kasPayload,
    });
  });

  it('disburse_loan_atomic memanggil rpc_disburse_loan_atomic dengan payload valid', async () => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');

    mocks.rpc.mockResolvedValue({
      data: { success: true, loan_id: 'loan-uuid-001' },
      error: null,
    });

    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    const command = {
      version: 2,
      idempotencyKey: '00000000-0000-0000-0000-000000000010',
      operation: 'expense',
      occurredOn: '2026-10-29',
      description: 'Pencairan Pinjaman Kru',
      currency: 'IDR',
      amountMinor: '50000000',
      categoryId: '00000000-0000-0000-0000-000000000020',
      incoming: [],
      outgoing: [{ pocketId: '00000000-0000-0000-0000-000000000030', amountMinor: '50000000' }],
    };
    const loanPayload = {
      borrowerType: 'kru',
      borrowerId: 'PTV-002',
      borrowerName: 'Kru Dua',
      borrowerContact: '+62811111111',
      principalMinor: '50000000',
      interestType: 'none',
      dueDate: '2026-11-29',
      purpose: 'Kebutuhan mendesak',
    };

    const body = {
      action: 'disburse_loan_atomic',
      command,
      loanPayload,
    };

    await handler(
      {
        method: 'POST',
        headers: { cookie: 'ptv_hub_session=synthetic', 'content-type': 'application/json' },
        body,
      } as never,
      res as never
    );

    expect(res.statusCode).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('rpc_disburse_loan_atomic', {
      p_account_id: 'verified-account-uuid',
      p_session_iat: 1790000000,
      p_command: command,
      p_loan_payload: loanPayload,
    });
  });

  it('post_loan_payment_atomic memanggil rpc_record_loan_payment_atomic dengan payload valid', async () => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');

    mocks.rpc.mockResolvedValue({
      data: { success: true, payment_id: 'pay-uuid-001' },
      error: null,
    });

    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    const command = {
      version: 2,
      idempotencyKey: '00000000-0000-0000-0000-000000000100',
      operation: 'income',
      occurredOn: '2026-10-29',
      description: 'Cicilan Piutang Kru',
      currency: 'IDR',
      amountMinor: '25000000',
      categoryId: '00000000-0000-0000-0000-000000000200',
      incoming: [{ pocketId: '00000000-0000-0000-0000-000000000300', amountMinor: '25000000' }],
      outgoing: [],
    };
    const paymentPayload = {
      loanId: '00000000-0000-0000-0000-000000000400',
      method: 'transfer',
      notes: 'Cicilan 1',
    };

    const body = {
      action: 'post_loan_payment_atomic',
      command,
      paymentPayload,
    };

    await handler(
      {
        method: 'POST',
        headers: { cookie: 'ptv_hub_session=synthetic', 'content-type': 'application/json' },
        body,
      } as never,
      res as never
    );

    expect(res.statusCode).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('rpc_record_loan_payment_atomic', {
      p_account_id: 'verified-account-uuid',
      p_session_iat: 1790000000,
      p_command: command,
      p_payment_payload: paymentPayload,
    });
  });

  it('reverse_operational_atomic memanggil rpc_reverse_operational_record_atomic dengan payload valid', async () => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');

    mocks.rpc.mockResolvedValue({
      data: { success: true, status: 'belum' },
      error: null,
    });

    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    const body = {
      action: 'reverse_operational_atomic',
      recordType: 'kas_kru',
      recordId: '00000000-0000-0000-0000-000000000500',
      reason: 'Koreksi salah input periode kas',
    };

    await handler(
      {
        method: 'POST',
        headers: { cookie: 'ptv_hub_session=synthetic', 'content-type': 'application/json' },
        body,
      } as never,
      res as never
    );

    expect(res.statusCode).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('rpc_reverse_operational_record_atomic', {
      p_account_id: 'verified-account-uuid',
      p_session_iat: 1790000000,
      p_record_type: 'kas_kru',
      p_record_id: '00000000-0000-0000-0000-000000000500',
      p_reason: 'Koreksi salah input periode kas',
    });
  });

  it('menolak pembatalan reversal dengan alasan kurang dari 3 karakter', async () => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');

    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    const body = {
      action: 'reverse_operational_atomic',
      recordType: 'kas_kru',
      recordId: '00000000-0000-0000-0000-000000000500',
      reason: 'no',
    };

    await handler(
      {
        method: 'POST',
        headers: { cookie: 'ptv_hub_session=synthetic', 'content-type': 'application/json' },
        body,
      } as never,
      res as never
    );

    expect(res.statusCode).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('mengembalikan 503 fail-closed jika trigger freeze aktif (SQLSTATE 55000)', async () => {
    vi.stubEnv('AUTH_SECRET', 'synthetic');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://swadgljnyelsjstqqxbm.supabase.co');

    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '55000', message: 'maintenance freeze active' },
    });

    const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    const command = {
      version: 2,
      idempotencyKey: '00000000-0000-0000-0000-000000000001',
      operation: 'income',
      occurredOn: '2026-10-29',
      description: 'Iuran Kas Kru PTV-001',
      currency: 'IDR',
      amountMinor: '2500000',
      categoryId: '00000000-0000-0000-0000-000000000002',
      incoming: [{ pocketId: '00000000-0000-0000-0000-000000000003', amountMinor: '2500000' }],
      outgoing: [],
    };

    await handler(
      {
        method: 'POST',
        headers: { cookie: 'ptv_hub_session=synthetic', 'content-type': 'application/json' },
        body: {
          action: 'post_kas_payment_atomic',
          command,
          kasPayload: { semesterId: 'sem-1', ptvId: 'PTV-001', crewName: 'Kru', periods: ['2026-10'] },
        },
      } as never,
      res as never
    );

    expect(res.statusCode).toBe(503);
    expect(mocks.rpc).toHaveBeenCalled();
  });
});
