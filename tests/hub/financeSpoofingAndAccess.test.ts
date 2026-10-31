import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import handler from '../../api/_routes/finance';
import * as cookiesUtil from '../../api/_routes/auth/_utils/cookies';
import * as cryptoUtil from '../../api/_routes/auth/_utils/crypto';
import * as financeAccess from '../../api/_routes/financeAccess';

// In-memory capture variables for Supabase client interactions
let mockRpcHandler: (fnName: string, args: any) => Promise<any> = () => Promise.resolve({ data: null, error: null });
let mockFromHandler: (table: string) => any = () => ({});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn((fnName: string, args: any) => mockRpcHandler(fnName, args)),
    from: vi.fn((table: string) => mockFromHandler(table)),
  })),
}));

function createMockReqRes(options: {
  method?: string;
  cookie?: string;
  body?: any;
}) {
  const req = Object.assign(new EventEmitter(), {
    method: options.method || 'POST',
    headers: {
      cookie: options.cookie || '',
    },
    [Symbol.asyncIterator]: async function* () {
      if (options.body) {
        yield Buffer.from(JSON.stringify(options.body));
      }
    },
  }) as unknown as IncomingMessage;

  let statusCode = 200;
  let responseData = '';
  const headers: Record<string, string> = {};

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    setHeader(key: string, val: string) {
      headers[key.toLowerCase()] = val;
    },
    getHeader(key: string) {
      return headers[key.toLowerCase()];
    },
    end(data?: string) {
      if (data) responseData = data;
    },
    _getData() {
      return responseData ? JSON.parse(responseData) : null;
    },
  } as unknown as ServerResponse & { _getData: () => any };

  return { req, res };
}

describe('Finance 2.0 Security Gate: Anti-Spoofing & Authorization Enforcement', () => {
  const MOCK_SECRET = 'test-secret-at-least-32-chars-long-12345';
  const REAL_ACCOUNT_ID = '11111111-1111-1111-1111-111111111111';
  const REAL_IDENTITY_ID = '22222222-2222-2222-2222-222222222222';
  const REAL_SESSION_IAT = 1700000000;

  const SPOOFED_ACCOUNT_ID = '99999999-9999-9999-9999-999999999999';
  const SPOOFED_IDENTITY_ID = '88888888-8888-8888-8888-888888888888';
  const SPOOFED_SESSION_IAT = 1200000000;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AUTH_SECRET = MOCK_SECRET;
    process.env.VITE_SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  });

  it('menolak akses dengan status 401 jika cookie sesi tidak ada atau tanda tangan sesi tidak sah', async () => {
    vi.spyOn(cookiesUtil, 'parseCookies').mockReturnValue({});

    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { action: 'create_pocket', pocket: { name: 'Kas Test', kind: 'cash' } },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getData()).toEqual({
      error: 'Sesi tidak valid. Silakan masuk kembali.',
    });
  });

  it('menolak akses penulisan dengan status 403 jika akun tidak memiliki hak canManage (misal kru)', async () => {
    vi.spyOn(cookiesUtil, 'parseCookies').mockReturnValue({ ptv_hub_session: 'valid-token' });
    vi.spyOn(cryptoUtil, 'verifySessionToken').mockReturnValue({
      account_id: REAL_ACCOUNT_ID,
      identity_id: REAL_IDENTITY_ID,
      iat: REAL_SESSION_IAT,
    } as any);

    vi.spyOn(financeAccess, 'resolveFinanceAccess').mockResolvedValue({
      canManage: false, // Kru biasa tanpa hak Bendahara/Root
      global: false,
      identityId: REAL_IDENTITY_ID,
    });

    const { req, res } = createMockReqRes({
      method: 'POST',
      cookie: 'ptv_hub_session=valid-token',
      body: { action: 'create_pocket', pocket: { name: 'Kas Kru', kind: 'cash' } },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res._getData().error).toMatch(/Operasi penulisan keuangan memerlukan hak Bendahara/);
  });

  it('ANTI-SPOOFING: post_transaction wajib meneruskan p_account_id dan p_session_iat dari sesi tervalidasi, BUKAN dari payload klien', async () => {
    vi.spyOn(cookiesUtil, 'parseCookies').mockReturnValue({ ptv_hub_session: 'valid-token' });
    vi.spyOn(cryptoUtil, 'verifySessionToken').mockReturnValue({
      account_id: REAL_ACCOUNT_ID,
      identity_id: REAL_IDENTITY_ID,
      iat: REAL_SESSION_IAT,
    } as any);

    vi.spyOn(financeAccess, 'resolveFinanceAccess').mockResolvedValue({
      canManage: true,
      global: true,
      identityId: REAL_IDENTITY_ID,
    });

    let capturedRpcArgs: any = null;
    mockRpcHandler = async (fnName: string, args: any) => {
      if (fnName === 'rpc_post_finance_transaction_server') {
        capturedRpcArgs = args;
        return {
          data: { success: true, transaction_id: 'tx-123' },
          error: null,
        };
      }
      return { data: null, error: { message: 'unknown' } };
    };

    // Klien mencoba menyuntikkan p_account_id, account_id, session_iat, dan actor_id palsu di dalam body
    const maliciousPayload = {
      action: 'post_transaction',
      p_account_id: SPOOFED_ACCOUNT_ID,
      accountId: SPOOFED_ACCOUNT_ID,
      p_session_iat: SPOOFED_SESSION_IAT,
      sessionIat: SPOOFED_SESSION_IAT,
      actor_id: SPOOFED_IDENTITY_ID,
      command: {
        version: 2,
        idempotencyKey: '33333333-3333-3333-3333-333333333333',
        operation: 'income',
        occurredOn: '2026-10-21',
        description: 'Uji Anti-Spoofing',
        currency: 'IDR',
        amountMinor: '100000',
        categoryId: '55555555-5555-5555-5555-555555555555',
        incoming: [
          { pocketId: '44444444-4444-4444-4444-444444444444', amountMinor: '100000' },
        ],
        outgoing: [],
      },
    };

    const { req, res } = createMockReqRes({
      method: 'POST',
      cookie: 'ptv_hub_session=valid-token',
      body: maliciousPayload,
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getData()).toEqual({ success: true, transaction_id: 'tx-123' });

    // VERIFIKASI KEAMANAN TERTINGGI:
    // Nilai yang dikirim ke RPC Supabase HARUS nilai sesi asli, bukan yang disuntikkan klien!
    expect(capturedRpcArgs).not.toBeNull();
    expect(capturedRpcArgs.p_account_id).toBe(REAL_ACCOUNT_ID);
    expect(capturedRpcArgs.p_account_id).not.toBe(SPOOFED_ACCOUNT_ID);
    expect(capturedRpcArgs.p_session_iat).toBe(REAL_SESSION_IAT);
    expect(capturedRpcArgs.p_session_iat).not.toBe(SPOOFED_SESSION_IAT);
  });

  it('ANTI-SPOOFING: create_pocket dan audit log wajib menggunakan identityId terverifikasi backend, BUKAN dari payload klien', async () => {
    vi.spyOn(cookiesUtil, 'parseCookies').mockReturnValue({ ptv_hub_session: 'valid-token' });
    vi.spyOn(cryptoUtil, 'verifySessionToken').mockReturnValue({
      account_id: REAL_ACCOUNT_ID,
      identity_id: REAL_IDENTITY_ID,
      iat: REAL_SESSION_IAT,
    } as any);

    vi.spyOn(financeAccess, 'resolveFinanceAccess').mockResolvedValue({
      canManage: true,
      global: true,
      identityId: REAL_IDENTITY_ID,
    });

    let capturedAuditInsert: any = null;
    mockRpcHandler = async (fnName: string, args: any) => {
      if (fnName === 'rpc_finance_admin_mutation_server') {
        capturedAuditInsert = { actor_id: args.p_account_id };
        return { data: { success: true }, error: null };
      }
      return { data: null, error: null };
    };

    mockFromHandler = (table: string) => {
      if (table === 'ptv_finance_pockets') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'pocket-new-1', name: 'Kas Anti-Spoof', kind: 'cash' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'ptv_finance_audit_log') {
        return {
          insert: vi.fn().mockImplementation((auditData: any) => {
            capturedAuditInsert = auditData;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      return {};
    };

    // Klien mencoba mengirim actor_id atau identity_id palsu
    const maliciousPayload = {
      action: 'create_pocket',
      actor_id: SPOOFED_IDENTITY_ID,
      identityId: SPOOFED_IDENTITY_ID,
      pocket: {
        name: 'Kas Baru',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
      },
    };

    const { req, res } = createMockReqRes({
      method: 'POST',
      cookie: 'ptv_hub_session=valid-token',
      body: maliciousPayload,
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getData().success).toBe(true);

    // Verifikasi audit log merekam actor_id yang terverifikasi, bukan spoofed
    expect(capturedAuditInsert).not.toBeNull();
    expect(capturedAuditInsert.actor_id).toBe(REAL_ACCOUNT_ID);
    expect(capturedAuditInsert.actor_id).not.toBe(SPOOFED_IDENTITY_ID);
  });
});
