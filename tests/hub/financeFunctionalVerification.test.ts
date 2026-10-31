import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import handler, { readFinance } from '../../api/finance';
import * as cookiesUtil from '../../api/auth/_utils/cookies';
import * as cryptoUtil from '../../api/auth/_utils/crypto';
import * as financeAccess from '../../api/financeAccess';
import {
  pocketFormSchema,
  multiPocketCommandSchema,
  assertPocketBalances,
  assertPocketArchivable,
  type FinancePocket,
} from '../../src/products/hub/keuangan/financeCanonical';

// In-memory capture and mock state
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

describe('PTV-DEV-116: Functional Verification & Stabilization Finance 2.0', () => {
  const MOCK_SECRET = 'test-secret-at-least-32-chars-long-12345';
  const BENDAHARA_ACC_ID = '11111111-1111-1111-1111-111111111111';
  const BENDAHARA_ID_ID = '22222222-2222-2222-2222-222222222222';
  const VIEWER_ACC_ID = '33333333-3333-3333-3333-333333333333';
  const VIEWER_ID_ID = '44444444-4444-4444-4444-444444444444';
  const CREW_ID_ID = '66666666-6666-6666-6666-666666666666';
  const VALID_SESSION_IAT = 1700000000;

  const POCKET_CASH_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const POCKET_BANK_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const POCKET_ARCHIVED_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const CATEGORY_INCOME_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const CATEGORY_EXPENSE_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AUTH_SECRET = MOCK_SECRET;
    process.env.VITE_SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-test-swadgljnyelsjstqqxbm';
  });

  // ==========================================================================
  // 1. PENGUJIAN KANTONG (CASH, BANK, EWALLET, ARSIP, SALDO AWAL)
  // ==========================================================================
  describe('1. Verifikasi Fitur Kantong', () => {
    it('memvalidasi pembuatan Kantong tunai (tanpa rekening/provider) dengan saldo awal nol', () => {
      const validCash = pocketFormSchema.parse({
        name: 'Brankas Studio',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
      });
      expect(validCash.kind).toBe('cash');
      expect(validCash.name).toBe('Brankas Studio');

      // Memastikan saldo tidak bisa disuntikkan via form
      expect(pocketFormSchema.safeParse({
        ...validCash,
        balanceMinor: '1000000',
      }).success).toBe(false);
    });

    it('memvalidasi pembuatan Kantong bank (wajib bank, no rekening, nama pemilik)', () => {
      const validBank = pocketFormSchema.parse({
        name: 'Rekening Operasional BCA',
        kind: 'bank',
        provider: 'Bank Central Asia',
        accountNumber: '8830123456',
        accountHolder: 'PTV Production Studio',
      });
      expect(validBank.kind).toBe('bank');
      expect(validBank.provider).toBe('Bank Central Asia');

      // Ditolak jika data rekening tidak lengkap
      expect(pocketFormSchema.safeParse({
        name: 'BCA Kosong',
        kind: 'bank',
        provider: '',
        accountNumber: '',
        accountHolder: '',
      }).success).toBe(false);
    });

    it('memvalidasi pembuatan Kantong e-wallet (wajib penyedia, nomor akun, nama pemilik)', () => {
      const validEwallet = pocketFormSchema.parse({
        name: 'Kas Operasional GoPay',
        kind: 'ewallet',
        provider: 'GoPay',
        accountNumber: '081234567890',
        accountHolder: 'Bendahara PTV',
      });
      expect(validEwallet.kind).toBe('ewallet');
      expect(validEwallet.accountNumber).toBe('081234567890');
    });

    it('mencegah pengarsipan Kantong jika saldo bukan nol', () => {
      const pocketWithBalance: FinancePocket = {
        id: POCKET_CASH_ID,
        name: 'Kas Kasir',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
        archived: false,
        version: 1,
        balanceMinor: '500000', // Ada saldo Rp 5.000,00
        qris: null,
      };

      expect(() => assertPocketArchivable(pocketWithBalance)).toThrow('Arsip hanya untuk Kantong aktif dengan saldo nol terverifikasi.');
    });

    it('mengizinkan pengarsipan jika saldo tepat nol terverifikasi', () => {
      const pocketZeroBalance: FinancePocket = {
        id: POCKET_CASH_ID,
        name: 'Kas Tutup',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
        archived: false,
        version: 2,
        balanceMinor: '0',
        qris: null,
      };

      expect(() => assertPocketArchivable(pocketZeroBalance)).not.toThrow();
    });
  });

  // ==========================================================================
  // 2. PENGUJIAN TRANSAKSI & ATURAN MULTI-KANTONG
  // ==========================================================================
  describe('2. Verifikasi Transaksi Multi-Kantong & Kontrak', () => {
    it('memvalidasi transaksi pemasukan multi-kantong dengan kategori valid', () => {
      const incomeCmd = multiPocketCommandSchema.parse({
        version: 2,
        idempotencyKey: '11111111-2222-3333-4444-555555555555',
        operation: 'income',
        currency: 'IDR',
        occurredOn: '2026-10-21',
        description: 'Pembayaran Sewa Studio & Jasa Live Streaming',
        amountMinor: '150000000', // Rp 1.500.000
        categoryId: CATEGORY_INCOME_ID,
        incoming: [
          { pocketId: POCKET_BANK_ID, amountMinor: '100000000' }, // Rp 1.000.000 ke Bank
          { pocketId: POCKET_CASH_ID, amountMinor: '50000000' },  // Rp 500.000 ke Kas
        ],
        outgoing: [],
      });

      expect(incomeCmd.operation).toBe('income');
      expect(incomeCmd.incoming).toHaveLength(2);
      expect(incomeCmd.outgoing).toHaveLength(0);
    });

    it('memvalidasi transaksi pengeluaran multi-kantong dengan kategori valid', () => {
      const expenseCmd = multiPocketCommandSchema.parse({
        version: 2,
        idempotencyKey: '22222222-3333-4444-5555-666666666666',
        operation: 'expense',
        currency: 'IDR',
        occurredOn: '2026-10-21',
        description: 'Belanja Perlengkapan Kabel & Konsumsi Kru',
        amountMinor: '75000000', // Rp 750.000
        categoryId: CATEGORY_EXPENSE_ID,
        incoming: [],
        outgoing: [
          { pocketId: POCKET_BANK_ID, amountMinor: '50000000' },
          { pocketId: POCKET_CASH_ID, amountMinor: '25000000' },
        ],
      });

      expect(expenseCmd.operation).toBe('expense');
      expect(expenseCmd.outgoing).toHaveLength(2);
    });

    it('memvalidasi transfer internal antarkantong (tanpa kategori pendapatan/beban)', () => {
      const transferCmd = multiPocketCommandSchema.parse({
        version: 2,
        idempotencyKey: '33333333-4444-5555-6666-777777777777',
        operation: 'transfer',
        currency: 'IDR',
        occurredOn: '2026-10-21',
        description: 'Pindah Dana dari Rekening Bank ke Kas Tunai',
        amountMinor: '200000000', // Rp 2.000.000
        incoming: [{ pocketId: POCKET_CASH_ID, amountMinor: '200000000' }],
        outgoing: [{ pocketId: POCKET_BANK_ID, amountMinor: '200000000' }],
      });

      expect(transferCmd.operation).toBe('transfer');
      expect(transferCmd.categoryId).toBeUndefined();

      // Transfer DITOLAK jika menyertakan kategori
      expect(multiPocketCommandSchema.safeParse({
        ...transferCmd,
        categoryId: CATEGORY_INCOME_ID,
      }).success).toBe(false);
    });

    it('menolak penarikan/pengeluaran jika saldo kantong tidak mencukupi (anti-saldo negatif)', () => {
      const pockets: FinancePocket[] = [
        {
          id: POCKET_BANK_ID,
          name: 'BCA',
          kind: 'bank',
          provider: 'BCA',
          accountNumber: '123',
          accountHolder: 'PTV',
          archived: false,
          version: 1,
          balanceMinor: '10000000', // Saldo hanya Rp 100.000
          qris: null,
        },
      ];

      const overdraftCmd = multiPocketCommandSchema.parse({
        version: 2,
        idempotencyKey: '44444444-5555-6666-7777-888888888888',
        operation: 'expense',
        currency: 'IDR',
        occurredOn: '2026-10-21',
        description: 'Pengeluaran Melebihi Saldo',
        amountMinor: '50000000', // Coba tarik Rp 500.000
        categoryId: CATEGORY_EXPENSE_ID,
        incoming: [],
        outgoing: [{ pocketId: POCKET_BANK_ID, amountMinor: '50000000' }],
      });

      expect(() => assertPocketBalances(overdraftCmd, pockets)).toThrow(/Saldo belum terverifikasi atau tidak mencukupi/);
    });

    it('menolak transaksi yang melibatkan Kantong yang sudah diarsipkan', () => {
      const pockets: FinancePocket[] = [
        {
          id: POCKET_ARCHIVED_ID,
          name: 'Kas Lama Ditutup',
          kind: 'cash',
          provider: '',
          accountNumber: '',
          accountHolder: '',
          archived: true, // STATUS DIARSIPKAN
          version: 1,
          balanceMinor: '0',
          qris: null,
        },
      ];

      const archivedCmd = multiPocketCommandSchema.parse({
        version: 2,
        idempotencyKey: '55555555-6666-7777-8888-999999999999',
        operation: 'income',
        currency: 'IDR',
        occurredOn: '2026-10-21',
        description: 'Pemasukan ke Kantong Arsip',
        amountMinor: '10000000',
        categoryId: CATEGORY_INCOME_ID,
        incoming: [{ pocketId: POCKET_ARCHIVED_ID, amountMinor: '10000000' }],
        outgoing: [],
      });

      expect(() => assertPocketBalances(archivedCmd, pockets)).toThrow(/sudah diarsipkan/);
    });

    it('menolak alokasi duplikat atau self-transfer kantong sama', () => {
      // Kantong sama muncul di incoming dan outgoing
      expect(multiPocketCommandSchema.safeParse({
        version: 2,
        idempotencyKey: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        operation: 'transfer',
        currency: 'IDR',
        occurredOn: '2026-10-21',
        description: 'Self transfer ilegal',
        amountMinor: '10000000',
        incoming: [{ pocketId: POCKET_CASH_ID, amountMinor: '10000000' }],
        outgoing: [{ pocketId: POCKET_CASH_ID, amountMinor: '10000000' }],
      }).success).toBe(false);

      // Kantong sama berulang di incoming
      expect(multiPocketCommandSchema.safeParse({
        version: 2,
        idempotencyKey: '77777777-8888-9999-aaaa-bbbbbbbbbbbb',
        operation: 'income',
        currency: 'IDR',
        occurredOn: '2026-10-21',
        description: 'Pemasukan kantong ganda ilegal',
        amountMinor: '20000000',
        categoryId: CATEGORY_INCOME_ID,
        incoming: [
          { pocketId: POCKET_CASH_ID, amountMinor: '10000000' },
          { pocketId: POCKET_CASH_ID, amountMinor: '10000000' },
        ],
        outgoing: [],
      }).success).toBe(false);
    });
  });

  // ==========================================================================
  // 3. KEAMANAN & RBAC CAPABILITY (BENDAHARA, ROOT, EKSEKUTIF, KRU)
  // ==========================================================================
  describe('3. Verifikasi Keamanan & Capability', () => {
    it('Bendahara / Root / Eksekutif dengan capability finance.manage dapat menulis', async () => {
      vi.spyOn(cookiesUtil, 'parseCookies').mockReturnValue({ ptv_hub_session: 'bendahara-token' });
      vi.spyOn(cryptoUtil, 'verifySessionToken').mockReturnValue({
        account_id: BENDAHARA_ACC_ID,
        identity_id: BENDAHARA_ID_ID,
        iat: VALID_SESSION_IAT,
      } as any);

      vi.spyOn(financeAccess, 'resolveFinanceAccess').mockResolvedValue({
        canManage: true, // Bendahara/Root
        global: true,
        identityId: BENDAHARA_ID_ID,
      });

      mockRpcHandler = async (fnName: string) => {
        if (fnName === 'rpc_finance_admin_mutation_server') {
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
                  data: { id: POCKET_CASH_ID, name: 'Kas Bendahara', kind: 'cash' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'ptv_finance_audit_log') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }
        return {};
      };

      const { req, res } = createMockReqRes({
        method: 'POST',
        cookie: 'ptv_hub_session=bendahara-token',
        body: {
          action: 'create_pocket',
          pocket: { name: 'Kas Bendahara', kind: 'cash', provider: '', accountNumber: '', accountHolder: '' },
        },
      });

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res._getData().success).toBe(true);
    });

    it('Pengguna view-only (finance.view) ditolak melakukan mutasi (403 Forbidden)', async () => {
      vi.spyOn(cookiesUtil, 'parseCookies').mockReturnValue({ ptv_hub_session: 'viewer-token' });
      vi.spyOn(cryptoUtil, 'verifySessionToken').mockReturnValue({
        account_id: VIEWER_ACC_ID,
        identity_id: VIEWER_ID_ID,
        iat: VALID_SESSION_IAT,
      } as any);

      vi.spyOn(financeAccess, 'resolveFinanceAccess').mockResolvedValue({
        canManage: false, // Tidak punya izin kelola
        global: true,      // Punya izin lihat global
        identityId: VIEWER_ID_ID,
      });

      const { req, res } = createMockReqRes({
        method: 'POST',
        cookie: 'ptv_hub_session=viewer-token',
        body: {
          action: 'create_pocket',
          pocket: { name: 'Kas Viewer Ilegal', kind: 'cash', provider: '', accountNumber: '', accountHolder: '' },
        },
      });

      await handler(req, res);
      expect(res.statusCode).toBe(403);
      expect(res._getData().error).toMatch(/memerlukan hak Bendahara, Eksekutif, atau Root/);
    });

    it('Kru biasa tanpa capability global hanya membaca kas pribadi dan writesEnabled=false', async () => {
      const mockDb: any = {
        rpc: vi.fn().mockResolvedValue({ data: { identityId: CREW_ID_ID, canManage: false, global: false, visibleTransactionIds: [] }, error: null }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'ptv_kas_kru') {
            return {
              select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: [{ id: 'kas-1', bulan_tahun: '2026-10', nominal: 50000, status_bayar: 'lunas' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const access: financeAccess.FinanceAccess = {
        canManage: false,
        global: false, // Kru biasa
        identityId: CREW_ID_ID,
      };

      const snapshot = await readFinance(mockDb, access, { account_id: 'synthetic-crew-account', iat: VALID_SESSION_IAT });
      expect(snapshot.scope).toBe('own');
      expect(snapshot.canManage).toBe(false);
      expect(snapshot.writesEnabled).toBe(false);
      expect(snapshot.entries).toHaveLength(0); // Tidak bisa membaca catatan global
      expect(snapshot.kas).toHaveLength(1);
      expect(snapshot.canonical.state).toBe('awaiting_schema'); // Canonical tidak diekspos ke kru
    });

    it('Service role key tidak pernah terekspos di respon JSON', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        cookie: '',
      });

      await handler(req, res);
      const rawText = JSON.stringify(res._getData());
      expect(rawText).not.toContain('mock-service-role-key-test-swadgljnyelsjstqqxbm');
      expect(rawText).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    });
  });
});
