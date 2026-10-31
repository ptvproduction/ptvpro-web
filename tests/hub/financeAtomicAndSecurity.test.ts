import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import handler from '../../api/finance';
import * as cookiesUtil from '../../api/auth/_utils/cookies';
import * as cryptoUtil from '../../api/auth/_utils/crypto';
import * as financeAccess from '../../api/financeAccess';
import {
  assertCanPostOperationalLedger,
  checkOperationalCloudStatus,
} from '../../src/products/hub/keuangan/financeOperationalCloudService';
import {
  recordLoanRepayment,
  createPiutang,
  cancelPiutang,
} from '../../src/products/hub/keuangan/piutangService';
import {
  waiveKasKruFee,
  calculateKasKruMatrix,
} from '../../src/products/hub/keuangan/kasKruService';
import { CANONICAL_STAGING_CREW_FIXTURES } from '../../src/products/hub/kru/canonicalCrewData';
import type { FinancePocket, CanonicalCategory, MultiPocketCommand } from '../../src/products/hub/keuangan/financeCanonical';

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

describe('PTV-DEV-129: Finance 2.0 Backend Atomic Transactions & Security Verification', () => {
  const MOCK_SECRET = 'test-secret-at-least-32-chars-long-12345';
  const BENDAHARA_ACCOUNT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const BENDAHARA_IDENTITY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const VALID_SESSION_IAT = 1729000000;

  const POCKET_ID = '60e8d033-2794-4219-a960-c56bedca0111'; // Kas Utama
  const CATEGORY_INCOME_ID = '55555555-5555-5555-5555-555555555555';
  const CATEGORY_EXPENSE_ID = '66666666-6666-6666-6666-666666666666';
  const SEMESTER_ID = '77777777-7777-7777-7777-777777777777';

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AUTH_SECRET = MOCK_SECRET;
    process.env.VITE_SUPABASE_URL = 'https://swadgljnyelsjstqqxbm.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

    vi.spyOn(cookiesUtil, 'parseCookies').mockReturnValue({ ptv_hub_session: 'valid-bendahara-token' });
    vi.spyOn(cryptoUtil, 'verifySessionToken').mockReturnValue({
      account_id: BENDAHARA_ACCOUNT_ID,
      iat: VALID_SESSION_IAT,
    } as any);
    vi.spyOn(financeAccess, 'resolveFinanceAccess').mockResolvedValue({
      identityId: BENDAHARA_IDENTITY_ID,
      canManage: true,
      global: true,
    });
  });

  // ==========================================================================
  // 1. ATOMIC TRANSACTIONS & REPLAY TESTS
  // ==========================================================================
  describe('1. Operasional ditahan sampai database aman (bukan bukti atomisitas)', () => {
    it.each(['post_kas_payment_atomic', 'disburse_loan_atomic', 'post_loan_payment_atomic', 'reverse_operational_atomic'])('menolak %s tanpa memanggil RPC', async action => {
      const rpc = vi.fn();
      mockRpcHandler = rpc;
      const { req, res } = createMockReqRes({ method: 'POST', body: { action } });
      await handler(req, res);
      expect([400, 503]).toContain(res.statusCode);
      expect(res._getData()).toBeDefined();
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. AUTHORIZATION & ANTI-SPOOFING TESTS
  // ==========================================================================
  describe('2. Authorization, Anti-Spoofing & Privilege Separation', () => {
    it('2a. Menolak mutasi jika pengguna tidak memiliki kapabilitas canManage (misal kru biasa)', async () => {
      vi.spyOn(financeAccess, 'resolveFinanceAccess').mockResolvedValue({
        identityId: 'crew-identity-id',
        canManage: false,
        global: false,
      });

      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          action: 'post_kas_payment_atomic',
          command: {},
          kasPayload: {},
        },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res._getData().error).toContain('Akses ditolak: Operasi penulisan keuangan memerlukan hak Bendahara');
    });

    it('2b. Menolak eksekusi mutasi jika backend database menolak otorisasi server-only (42501)', async () => {
      mockRpcHandler = async () => ({
        data: null,
        error: { code: '42501', message: 'Required finance capability missing: finance.manage' },
      });

      const command: MultiPocketCommand = {
        version: 2,
        idempotencyKey: '44444444-4444-4444-4444-444444444444',
        operation: 'income',
        occurredOn: '2026-10-24',
        description: 'Test',
        currency: 'IDR',
        amountMinor: '2500000',
        categoryId: CATEGORY_INCOME_ID,
        incoming: [{ pocketId: POCKET_ID, amountMinor: '2500000' }],
        outgoing: [],
      };

      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          action: 'post_transaction',
          command,
          kasPayload: {
            semesterId: SEMESTER_ID,
            ptvId: 'PTV-001',
            crewName: 'Zidnal',
            periods: ['2026-09'],
            method: 'cash',
            pocketId: POCKET_ID,
          },
        },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res._getData().error).toContain('Required finance capability missing');
    });
  });

  // ==========================================================================
  // 3. FINANCIAL INTEGRITY & ACCOUNTING SEPARATION TESTS
  // ==========================================================================
  describe('3. Financial Integrity: Anti-Overpayment & Anti-Overdraft', () => {
    const mockPockets: FinancePocket[] = [
      {
        id: POCKET_ID,
        name: 'Kas Utama Studio',
        kind: 'cash',
        provider: '',
        accountNumber: '',
        accountHolder: '',
        archived: false,
        version: 1,
        balanceMinor: '5000000', // Rp 50.000
        qris: null,
      },
    ];

    const mockCategories: CanonicalCategory[] = [
      { id: CATEGORY_INCOME_ID, name: 'Pengembalian Pokok Piutang', kind: 'income', isActive: true },
      { id: CATEGORY_EXPENSE_ID, name: 'Pencairan Piutang', kind: 'expense', isActive: true },
    ];

    it('3a. Anti-Overdraft: Menolak pencairan piutang jika saldo kantong sumber tidak mencukupi', async () => {
      // Saldo kantong hanya Rp 50.000, coba pinjam Rp 100.000
      await expect(
        createPiutang(
          {
            borrowerType: 'kru',
            borrowerId: 'PTV-005',
            borrowerName: 'Kru Fajar',
            borrowerContact: '0811111111',
            principalMinor: '10000000', // Rp 100.000
            disbursedOn: '2026-10-24',
            disbursedFromPocketId: POCKET_ID,
            purpose: 'Beli Kabel',
          },
          {
            pockets: mockPockets,
            categories: mockCategories,
            canManage: true,
            existingLoans: [],
          }
        )
      ).rejects.toThrow(/Saldo Kantong 'Kas Utama Studio' tidak mencukupi/);
    });

    it('3b. Anti-Overpayment: Menolak pembayaran cicilan jika melebihi sisa tagihan', async () => {
      const existingLoan = {
        id: 'loan-test-1',
        borrowerType: 'kru' as const,
        borrowerId: 'PTV-002',
        borrowerName: 'Kru Budi',
        borrowerContact: '08123',
        principalMinor: '10000000',
        interestType: 'none' as const,
        interestRatePercent: 0,
        interestMinor: '0',
        totalDueMinor: '10000000',
        totalPaidMinor: '8000000',
        remainingMinor: '2000000', // Sisa hanya Rp 20.000
        disbursedOn: '2026-10-01',
        dueDate: '2026-11-01',
        disbursedFromPocketId: POCKET_ID,
        disbursementTxId: null,
        status: 'aktif' as const,
        purpose: 'Operasional',
        payments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Coba bayar Rp 30.000 padahal sisa hanya Rp 20.000
      await expect(
        recordLoanRepayment(
          {
            loanId: 'loan-test-1',
            amountMinor: '3000000',
            toPocketId: POCKET_ID,
            paidOn: '2026-10-24',
            method: 'cash',
          },
          {
            pockets: mockPockets,
            categories: mockCategories,
            canManage: true,
            existingLoans: [existingLoan],
          }
        )
      ).rejects.toThrow(/Nominal pembayaran melebihi sisa tagihan/);
    });

    it('3c. Menolak pembatalan pinjaman secara langsung jika sudah memiliki riwayat cicilan', () => {
      const activeLoanWithPayment = {
        id: 'loan-test-2',
        borrowerType: 'kru' as const,
        borrowerId: 'PTV-002',
        borrowerName: 'Kru Budi',
        borrowerContact: '08123',
        principalMinor: '10000000',
        interestType: 'none' as const,
        interestRatePercent: 0,
        interestMinor: '0',
        totalDueMinor: '10000000',
        totalPaidMinor: '5000000',
        remainingMinor: '5000000',
        disbursedOn: '2026-10-01',
        dueDate: null,
        disbursedFromPocketId: POCKET_ID,
        disbursementTxId: null,
        status: 'aktif' as const,
        purpose: 'Operasional',
        payments: [
          {
            id: 'pay-1',
            loanId: 'loan-test-2',
            paidOn: '2026-10-15',
            amountMinor: '5000000',
            toPocketId: POCKET_ID,
            receiptTxId: null,
            method: 'cash' as const,
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() =>
        cancelPiutang('loan-test-2', 'Batal', [activeLoanWithPayment])
      ).toThrow(/Piutang yang sudah memiliki riwayat pembayaran tidak dapat dibatalkan secara langsung/);
    });
  });

  // ==========================================================================
  // 4. KAS KRU FEE EXEMPTION & MATRIX INTEGRITY TESTS
  // ==========================================================================
  describe('4. Kas Kru Fee Exemption & Matrix Calculation', () => {
    it('4a. Mendukung pembebasan iuran resmi (status: dikecualikan) dengan alasan yang sah', () => {
      const res = waiveKasKruFee(
        {
          semesterId: SEMESTER_ID,
          ptvId: 'PTV-001',
          crewName: 'Zidnal',
          period: '2026-09',
          reason: 'Dispensasi kru magang',
        },
        []
      );

      expect(res.success).toBe(true);
      expect(res.record.status).toBe('dikecualikan');
      expect(res.record.paidAmountMinor).toBe('0');
      expect(res.record.notes).toContain('Dispensasi kru magang');
    });

    it('4b. Menolak pembebasan iuran jika alasan kosong', () => {
      expect(() =>
        waiveKasKruFee(
          {
            semesterId: SEMESTER_ID,
            ptvId: 'PTV-001',
            crewName: 'Zidnal',
            period: '2026-09',
            reason: '   ',
          },
          []
        )
      ).toThrow('Alasan pembebasan iuran wajib diisi.');
    });

    it('4c. Periode dikecualikan tidak dihitung sebagai tunggakan aktif dalam matriks kas kru', () => {
      const semester = {
        id: SEMESTER_ID,
        name: 'Semester Ganjil 2026/2027',
        startDate: '2026-09-01',
        endDate: '2026-10-31',
        monthlyFeeMinor: '2500000',
        isActive: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
      };

      const crew = CANONICAL_STAGING_CREW_FIXTURES.slice(0, 1);

      // Bulan September dikecualikan, bulan Oktober lunas
      const records = [
        {
          id: 'k-1',
          semesterId: SEMESTER_ID,
          ptvId: 'PTV-001',
          crewName: 'Zidnal',
          period: '2026-09',
          amountMinor: '2500000',
          paidAmountMinor: '0',
          status: 'dikecualikan' as const,
          paymentDate: null,
          method: 'cash' as const,
          pocketId: POCKET_ID,
          transactionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'k-2',
          semesterId: SEMESTER_ID,
          ptvId: 'PTV-001',
          crewName: 'Zidnal',
          period: '2026-10',
          amountMinor: '2500000',
          paidAmountMinor: '2500000',
          status: 'lunas' as const,
          paymentDate: '2026-10-05',
          method: 'cash' as const,
          pocketId: POCKET_ID,
          transactionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const matrix = calculateKasKruMatrix(semester, crew, records);

      // Tunggakan harus 0 karena periode September telah dikecualikan!
      expect(matrix.stats.totalArrearsMinor).toBe('0');
      expect(matrix.rows[0].arrearsMinor).toBe('0');
      expect(matrix.rows[0].isAllPaid).toBe(true);
    });
  });

  // ==========================================================================
  // 5. SCHEMA GUARD & DATABASE STATUS TESTS
  // ==========================================================================
  describe('5. Schema Guard & Awaiting Migration Protection', () => {
    it('5a. assertCanPostOperationalLedger memblokir mutasi ledger jika database berstatus pending_migration', async () => {
      // Panggil checkOperationalCloudStatus yang secara default offline/pending di environment test
      await checkOperationalCloudStatus(true);

      expect(() => assertCanPostOperationalLedger('kas_kru')).toThrow(
        /Pencatatan mutasi transaksi canonical Iuran Kas Kru ke Buku Besar Cloud diblokir/
      );

      expect(() => assertCanPostOperationalLedger('piutang')).toThrow(
        /Pencatatan mutasi transaksi canonical Piutang ke Buku Besar Cloud diblokir/
      );
    });
  });
});
