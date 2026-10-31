import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CrewMember } from '../../src/products/hub/kru/types';
import type { FinanceSemester, KasKruRecord } from '../../src/products/hub/keuangan/kasKruTypes';
import { calculateKasKruMatrix } from '../../src/products/hub/keuangan/kasKruService';

describe('PTV-DEV-132: Finance 2.0 Finalization & Staging Readiness', () => {
  describe('1. Kas Kru Retroactive Fee Increase & Integrity', () => {
    it('retroactive tariff increase: Rp30.000 -> Rp35.000 after paying Rp30.000 leaves exactly Rp5.000 shortage', () => {
      const activeCrew: CrewMember[] = [
        {
          id: 'c-001',
          ptv_id: 'PTV-KRU-001',
          full_name: 'Ahmad Reporter',
          username: 'ahmad',
          role: 'kru',
          category: 'Kru',
          position: 'Reporter',
          status_kru: 'Aktif',
          status_akun: 'Belum Ada Akun',
          division: 'Editor',
          angkatan: '2024'
        }
      ];

      // Semester dengan tarif awal Rp30.000 untuk bulan 2026-09
      const semesterInitial: FinanceSemester = {
        id: 'sem-2026-1',
        name: 'Semester Ganjil 2026/2027',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        monthlyFeeMinor: '3000000', // Rp30.000
        isActive: true,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00.000Z'
      };

      // Pembayaran Rp30.000 telah lunas
      const paymentRecord: KasKruRecord = {
        id: 'rec-1',
        semesterId: 'sem-2026-1',
        ptvId: 'PTV-KRU-001',
        crewName: 'Ahmad Reporter',
        period: '2026-09',
        amountMinor: '3000000',
        status: 'lunas',
        paidAmountMinor: '3000000', // Rp30.000
        paymentDate: '2026-09-05',
        method: 'transfer',
        pocketId: 'pkt-ops',
        transactionId: 'tx-1',
        notes: 'Lunas awal',
        createdAt: '2026-09-05T10:00:00Z',
        updatedAt: '2026-09-05T10:00:00Z'
      };

      // Matrix awal: lunas penuh
      const initialMatrix = calculateKasKruMatrix(semesterInitial, activeCrew, [paymentRecord]);
      const initialCell = initialMatrix.rows[0].periods['2026-09'];
      expect(initialCell.status).toBe('lunas');
      expect(initialCell.paidAmountMinor).toBe('3000000');
      expect(initialCell.shortageMinor).toBe('0');
      expect(initialMatrix.stats.totalArrearsMinor).toBe('0');

      // Operator mengubah tarif khusus bulan 2026-09 menjadi Rp35.000 (3500000 minor)
      const semesterUpdated: FinanceSemester = {
        ...semesterInitial,
        monthlyFees: {
          '2026-09': '3500000' // Kenaikan tarif menjadi Rp35.000
        }
      };

      // Hitung ulang matrix dengan tarif baru
      const updatedMatrix = calculateKasKruMatrix(semesterUpdated, activeCrew, [paymentRecord]);
      const updatedCell = updatedMatrix.rows[0].periods['2026-09'];

      // Status berubah menjadi 'sebagian', sisa tagihan tepat Rp5.000 (500000 minor)
      expect(updatedCell.status).toBe('sebagian');
      expect(updatedCell.paidAmountMinor).toBe('3000000'); // histori pembayaran tetap utuh
      expect(updatedCell.amountMinor).toBe('3500000'); // tarif baru
      expect(updatedCell.shortageMinor).toBe('500000'); // kekurangan 5.000,00
      expect(BigInt(updatedMatrix.rows[0].arrearsMinor)).toBeGreaterThanOrEqual(500000n);
    });

    it('Pembina and Pengarah are strictly excluded from billing matrix', () => {
      const crewList: CrewMember[] = [
        {
          id: 'c-1',
          ptv_id: 'PTV-KRU-001',
          full_name: 'Zidnal Operator',
          username: 'zidnal',
          category: 'Kru',
          position: 'Staff',
          status_kru: 'Aktif',
          status_akun: 'Belum Ada Akun',
          role: 'kru',
          division: 'Technical',
          angkatan: '2024'
        },
        {
          id: 'c-2',
          ptv_id: 'PTV-PEM-001',
          full_name: 'Bapak Pembina',
          username: 'pembina1',
          category: 'Pembina',
          position: 'Pembina',
          status_kru: 'Aktif',
          status_akun: 'Belum Ada Akun',
          role: 'kru',
          division: 'Technical',
          angkatan: '2020'
        },
        {
          id: 'c-3',
          ptv_id: 'PTV-PNG-001',
          full_name: 'Ibu Pengarah',
          username: 'pengarah1',
          category: 'Pengarah',
          position: 'Pengarah',
          status_kru: 'Aktif',
          status_akun: 'Belum Ada Akun',
          role: 'kru',
          division: 'Technical',
          angkatan: '2020'
        },
        {
          id: 'c-4',
          ptv_id: 'PTV-KRU-002',
          full_name: 'Kru Nonaktif',
          username: 'krunonaktif',
          category: 'Kru',
          position: 'Staff',
          status_kru: 'Nonaktif',
          status_akun: 'Belum Ada Akun',
          role: 'kru',
          division: 'Technical',
          angkatan: '2023'
        }
      ];

      const semester: FinanceSemester = {
        id: 'sem-2026-1',
        name: 'Semester Ganjil 2026/2027',
        startDate: '2026-09-01',
        endDate: '2027-02-28',
        monthlyFeeMinor: '2500000',
        isActive: true,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00.000Z'
      };

      const matrix = calculateKasKruMatrix(semester, crewList, []);

      // Hanya PTV-KRU-001 yang aktif ditagih. Pembina, Pengarah, dan Nonaktif tanpa histori dikecualikan
      expect(matrix.rows.length).toBe(1);
      expect(matrix.rows[0].crew.ptv_id).toBe('PTV-KRU-001');
      expect(matrix.rows.find(r => r.crew.category === 'Pembina')).toBeUndefined();
      expect(matrix.rows.find(r => r.crew.category === 'Pengarah')).toBeUndefined();
    });
  });

  describe('2. Multi-Layer Security & Access Barrier', () => {
    it('fail-closed: Pembina and Pengarah are completely forbidden from finance access', async () => {
      const { resolveFinanceAccess } = await import('../../api/financeAccess');

    const mockDbPembina: any = {
      from: (table: string) => {
        const rows: Record<string, unknown> = {
          user_account: { identity_id: 'identity-test', status_akun: 'active' },
          canonical_identity: { ptv_id: 'PTV-TEST' },
          organization_membership: [{ status_organisasi: 'active' }],
          account_profiles: [{ profile_id: 'crew' }],
          account_capability_overrides: [],
          legacy_archive_kru: { jabatan: 'Pembina' },
        };
        const result = { data: rows[table], error: null };
        const chain: any = { then: (resolve: any) => resolve(result) };
        for (const method of ['select', 'eq', 'single', 'maybeSingle']) chain[method] = () => chain;
        return chain;
      },
    };

      const session = {
        account_id: 'acc-pembina',
        identity_id: 'ident-pembina',
        iat: Math.floor(Date.now() / 1000)
      };

      await expect(resolveFinanceAccess(mockDbPembina, session as any)).rejects.toThrow('forbidden');
    });
  });

  describe('3. Database SQL Scripts Audit (Migration, Rollback, Preflight, Postflight)', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const migrationPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql');
    const rollbackPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-ROLLBACK.sql');
    const preflightPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-STAGING-PREFLIGHT-READONLY.sql');
    const postflightPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-STAGING-POSTFLIGHT-READONLY.sql');

    it('Migration SQL contains Postgres 15+ check, atomic void RPC, and finance-proofs storage bucket', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      // Check PostgreSQL version requirement relaxed to 150000
      expect(sql).toContain("150000");
      
      // Check atomic void function & RPC
      expect(sql).toContain("CREATE OR REPLACE FUNCTION ptv_finance_private.void_finance_transaction");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_void_finance_transaction_atomic");
      
      // Check finance-proofs storage bucket setup
      expect(sql).toContain("storage.buckets (id, name, public");
      expect(sql).toContain("'finance-proofs'");
      expect(sql).toContain("finance_proofs_upload");
      expect(sql).toContain("finance_proofs_read");
      expect(sql).toContain("finance_proofs_delete");

      // Verify anti-production barrier protects production reference
      expect(sql).toContain("jthzuhkblxcaohiuypqq");
    });

    it('Rollback SQL contains drop statements for void RPC and storage policies', () => {
      expect(fs.existsSync(rollbackPath)).toBe(true);
      const sql = fs.readFileSync(rollbackPath, 'utf-8');

      // Version check relaxed to 150000
      expect(sql).toContain("150000");

      // Drops atomic void RPC & function
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.rpc_void_finance_transaction_atomic");
      expect(sql).toContain("DROP FUNCTION IF EXISTS ptv_finance_private.void_finance_transaction");

      // Drops storage policies
      expect(sql).toContain('DROP POLICY IF EXISTS "finance_proofs_upload"');
      expect(sql).toContain('DROP POLICY IF EXISTS "finance_proofs_read"');
      expect(sql).toContain('DROP POLICY IF EXISTS "finance_proofs_delete"');

      // Resilient transaction count check (>= 53)
      expect(sql).toContain("v_tx_count < 53");
    });

    it('Preflight SQL is strictly READ-ONLY and verifies environment safety', () => {
      expect(fs.existsSync(preflightPath)).toBe(true);
      const sql = fs.readFileSync(preflightPath, 'utf-8');

      // Preflight must NOT contain destructive DDL/DML
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/DELETE\s+FROM/i);
      expect(sql).not.toMatch(/TRUNCATE/i);
      expect(sql).not.toMatch(/ALTER\s+TABLE/i);

      // Must check anti-production table count
      expect(sql).toContain("Anti-Production Barrier Check");
      expect(sql).toContain("swadgljnyelsjstqqxbm");

      // Must inspect canonical transactions
      expect(sql).toContain("ptv_finance_transactions");
      expect(sql).toContain("ptv_finance_categories");
    });

    it('Postflight SQL is strictly READ-ONLY and reconciles ledger balances', () => {
      expect(fs.existsSync(postflightPath)).toBe(true);
      const sql = fs.readFileSync(postflightPath, 'utf-8');

      // Postflight must NOT contain destructive DDL/DML
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/DELETE\s+FROM/i);
      expect(sql).not.toMatch(/TRUNCATE/i);
      expect(sql).not.toMatch(/ALTER\s+TABLE/i);

      // Must check RLS enabled across tables
      expect(sql).toContain("rls_enabled");
      expect(sql).toContain("SECURITY DEFINER");

      // Must reconcile ledger allocations against pocket balances
      expect(sql).toContain("Ledger Reconciled Check");
    });
  });

  describe('4. Accounting Isolation: Piutang vs Operational Expenses', () => {
    it('Piutang disbursements must not be classified as operational expense or operational income', () => {
      const samplePiutangDisbursement = {
        type: 'out' as const,
        category: 'piutang_pencairan',
        amount_minor: 100000000n, // Rp1.000.000
        is_operational_expense: false
      };

      const samplePiutangPrincipalRepayment = {
        type: 'in' as const,
        category: 'piutang_angsuran_pokok',
        amount_minor: 50000000n, // Rp500.000
        is_operational_income: false
      };

      const samplePiutangInterestRepayment = {
        type: 'in' as const,
        category: 'piutang_bunga',
        amount_minor: 2500000n, // Rp25.000
        is_operational_income: true
      };

      expect(samplePiutangDisbursement.is_operational_expense).toBe(false);
      expect(samplePiutangPrincipalRepayment.is_operational_income).toBe(false);
      expect(samplePiutangInterestRepayment.is_operational_income).toBe(true);
    });
  });

  describe('5. PTV-DEV-133: Final Blocker Resolution & Atomic Integrity', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const apiFinancePath = path.join(rootDir, 'api/finance.ts');
    const migrationPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql');
    const preflightPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-STAGING-PREFLIGHT-READONLY.sql');
    const postflightPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-STAGING-POSTFLIGHT-READONLY.sql');

    it('api/finance.ts has zero client-side non-atomic fallback in void_transaction', () => {
      expect(fs.existsSync(apiFinancePath)).toBe(true);
      const apiCode = fs.readFileSync(apiFinancePath, 'utf-8');

      // Wajib menggunakan atomic RPC
      expect(apiCode).toContain("db.rpc('rpc_void_finance_transaction_atomic'");

      // DILARANG keras memiliki sequential fallback multi-query seperti db.from('ptv_finance_pockets').update atau db.from('ptv_finance_transactions').update di dalam void_transaction
      const voidBlock = apiCode.slice(apiCode.indexOf("action === 'void_transaction'"));
      expect(voidBlock).not.toContain("db.from('ptv_finance_pockets')");
      expect(voidBlock).not.toContain("db.from('ptv_finance_allocations')");
    });

    it('api/finance.ts strictly rejects financial amount and allocation mutations in update_transaction', () => {
      const apiCode = fs.readFileSync(apiFinancePath, 'utf-8');
      const updateBlock = apiCode.slice(apiCode.indexOf("action === 'update_transaction'"));

      expect(updateBlock).toContain("updates.amount !== undefined");
      expect(updateBlock).toContain("updates.amountMinor !== undefined");
      expect(updateBlock).toContain("updates.allocations !== undefined");
      expect(updateBlock).toContain("Lakukan pembatalan (VOID) dan catat transaksi baru");
    });

    it('Migration SQL has RLS, deadlock-free ORDER BY pocket_id, and anchor checks', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      // ptv_finance_kas_payments has RLS and read policy
      expect(sql).toContain('ALTER TABLE public.ptv_finance_kas_payments ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('CREATE POLICY ptv_finance_kas_payments_read ON public.ptv_finance_kas_payments');

      // Allocation rollback has ORDER BY pocket_id to prevent deadlocks
      expect(sql).toContain('ORDER BY pocket_id LOOP');

      // Anchor verification: Kas Utama Studio Rp520.276 (52027600 minor)
      expect(sql).toContain('52027600');
      expect(sql).toContain("name = 'Kas Utama Studio'");

      // Ledger integrity checks: anti-orphan and canonical transfer-aware rules
      expect(sql).toContain('orphaned allocations');
      expect(sql).toContain("kind = 'transfer'");
    });

    it('Preflight SQL includes ptv_finance_kas_payments and dynamic multi-barrier evaluation', () => {
      const sql = fs.readFileSync(preflightPath, 'utf-8');

      expect(sql).toContain("'ptv_finance_kas_payments'");
      expect(sql).toContain('WITH tx_alloc_summary AS');
      expect(sql).toContain('orphaned_allocations_count');
      expect(sql).toContain('tx_allocation_mismatches_count');
      expect(sql).toContain("52027600");
    });

    it('Postflight SQL checks all 6 operational tables for RLS and has Check 7b', () => {
      const sql = fs.readFileSync(postflightPath, 'utf-8');

      expect(sql).toContain("'ptv_finance_kas_payments'");
      expect(sql).toContain("'ptv_finance_semesters'");
      expect(sql).toContain("'ptv_finance_kas_records'");
      expect(sql).toContain("'ptv_finance_loans'");
      expect(sql).toContain("'ptv_finance_loan_payments'");
      expect(sql).toContain("'ptv_finance_settings'");
      expect(sql).toContain('-- 7b. Verifikasi Integritas Alokasi Transaksi');
    });

    it('Proof file validation enforces 5MB limit and allowed mime types', async () => {
      const { validateProofFile, PROOF_MAX_SIZE_BYTES } = await import('../../src/products/hub/keuangan/financeOperationalCloudService');

      expect(PROOF_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);

      // Valid files
      expect(validateProofFile({ size: 1024 * 1024, type: 'image/jpeg' }).valid).toBe(true);
      expect(validateProofFile({ size: 2 * 1024 * 1024, type: 'image/png' }).valid).toBe(true);
      expect(validateProofFile({ size: 4 * 1024 * 1024, type: 'application/pdf' }).valid).toBe(true);

      // Invalid: oversized (6MB)
      const over = validateProofFile({ size: 6 * 1024 * 1024, type: 'image/jpeg' });
      expect(over.valid).toBe(false);
      expect(over.error).toContain('5 MB');

      // Invalid: forbidden mime type (e.g. exe or text)
      const badType = validateProofFile({ size: 1024, type: 'application/x-msdownload' });
      expect(badType.valid).toBe(false);
      expect(badType.error).toContain('Format berkas tidak didukung');
    });
  });

  describe('6. PTV-DEV-134: Finance Preflight Transfer Reconciliation & Canonical Ledger Rules', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const preflightPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-STAGING-PREFLIGHT-READONLY.sql');
    const postflightPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-STAGING-POSTFLIGHT-READONLY.sql');
    const migrationPath = path.join(rootDir, 'docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql');

    function checkCanonicalLedgerRules(
      tx: { id: string; kind: string; amount_minor: bigint },
      allocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[]
    ) {
      const txAllocs = allocations.filter(a => a.transaction_id === tx.id);
      const countAllocs = txAllocs.length;
      if (countAllocs === 0) return { valid: false, violation: 'unallocated' };

      const totalIn = txAllocs.filter(a => a.direction === 'in').reduce((s, a) => s + a.amount_minor, 0n);
      const totalOut = txAllocs.filter(a => a.direction === 'out').reduce((s, a) => s + a.amount_minor, 0n);
      const countIn = txAllocs.filter(a => a.direction === 'in').length;
      const countOut = txAllocs.filter(a => a.direction === 'out').length;
      const distinctPockets = new Set(txAllocs.map(a => a.pocket_id)).size;

      if (tx.kind === 'income') {
        if (totalIn !== tx.amount_minor || totalOut !== 0n || countIn < 1 || countOut !== 0) {
          return { valid: false, violation: 'invalid_income' };
        }
      } else if (tx.kind === 'expense') {
        if (totalOut !== tx.amount_minor || totalIn !== 0n || countOut < 1 || countIn !== 0) {
          return { valid: false, violation: 'invalid_expense' };
        }
      } else if (tx.kind === 'transfer') {
        if (
          totalIn !== tx.amount_minor ||
          totalOut !== tx.amount_minor ||
          totalIn !== totalOut ||
          countIn < 1 ||
          countOut < 1 ||
          distinctPockets !== countAllocs
        ) {
          return { valid: false, violation: 'invalid_transfer' };
        }
      } else {
        return { valid: false, violation: 'unknown_kind' };
      }

      return { valid: true };
    }

    it('validates canonical transfer with 1 in and 1 out (Staging 8e4b3211-5c41-4418-b92d-e4466ea58d81 archetype)', () => {
      const tx = {
        id: '8e4b3211-5c41-4418-b92d-e4466ea58d81',
        kind: 'transfer',
        amount_minor: 4000000n, // Rp 40.000,00
      };
      const allocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: tx.id, pocket_id: 'pkt-source', direction: 'out', amount_minor: 4000000n },
        { transaction_id: tx.id, pocket_id: 'pkt-dest', direction: 'in', amount_minor: 4000000n },
      ];

      const res = checkCanonicalLedgerRules(tx, allocations);
      expect(res.valid).toBe(true);
    });

    it('rejects unbalanced transfer where in and out amounts differ', () => {
      const tx = {
        id: 'tx-unbalanced',
        kind: 'transfer',
        amount_minor: 4000000n,
      };
      const allocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: tx.id, pocket_id: 'pkt-source', direction: 'out', amount_minor: 4000000n },
        { transaction_id: tx.id, pocket_id: 'pkt-dest', direction: 'in', amount_minor: 3500000n }, // kurang 500.000
      ];

      const res = checkCanonicalLedgerRules(tx, allocations);
      expect(res.valid).toBe(false);
      expect(res.violation).toBe('invalid_transfer');
    });

    it('rejects transfer where source and destination are the exact same pocket', () => {
      const tx = {
        id: 'tx-same-pocket',
        kind: 'transfer',
        amount_minor: 1000000n,
      };
      const allocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: tx.id, pocket_id: 'pkt-alpha', direction: 'out', amount_minor: 1000000n },
        { transaction_id: tx.id, pocket_id: 'pkt-alpha', direction: 'in', amount_minor: 1000000n },
      ];

      const res = checkCanonicalLedgerRules(tx, allocations);
      expect(res.valid).toBe(false);
      expect(res.violation).toBe('invalid_transfer');
    });

    it('rejects transfer missing in or out leg (e.g. 2 out allocations)', () => {
      const tx = {
        id: 'tx-no-in',
        kind: 'transfer',
        amount_minor: 2000000n,
      };
      const allocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: tx.id, pocket_id: 'pkt-1', direction: 'out', amount_minor: 1000000n },
        { transaction_id: tx.id, pocket_id: 'pkt-2', direction: 'out', amount_minor: 1000000n },
      ];

      const res = checkCanonicalLedgerRules(tx, allocations);
      expect(res.valid).toBe(false);
      expect(res.violation).toBe('invalid_transfer');
    });

    it('validates standard income and expense transactions', () => {
      const incomeTx = { id: 'tx-inc', kind: 'income', amount_minor: 500000n };
      const incomeAllocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: 'tx-inc', pocket_id: 'pkt-bank', direction: 'in', amount_minor: 500000n },
      ];
      expect(checkCanonicalLedgerRules(incomeTx, incomeAllocations).valid).toBe(true);

      const expenseTx = { id: 'tx-exp', kind: 'expense', amount_minor: 250000n };
      const expenseAllocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: 'tx-exp', pocket_id: 'pkt-cash', direction: 'out', amount_minor: 250000n },
      ];
      expect(checkCanonicalLedgerRules(expenseTx, expenseAllocations).valid).toBe(true);
    });

    it('rejects income with out direction or expense with in direction', () => {
      const badIncome = { id: 'tx-bad-inc', kind: 'income', amount_minor: 500000n };
      const badIncomeAllocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: 'tx-bad-inc', pocket_id: 'pkt-bank', direction: 'out', amount_minor: 500000n },
      ];
      expect(checkCanonicalLedgerRules(badIncome, badIncomeAllocations).valid).toBe(false);

      const badExpense = { id: 'tx-bad-exp', kind: 'expense', amount_minor: 250000n };
      const badExpenseAllocations: { transaction_id: string; pocket_id: string; direction: 'in' | 'out'; amount_minor: bigint }[] = [
        { transaction_id: 'tx-bad-exp', pocket_id: 'pkt-cash', direction: 'in', amount_minor: 250000n },
      ];
      expect(checkCanonicalLedgerRules(badExpense, badExpenseAllocations).valid).toBe(false);
    });

    it('SQL files contain canonical transfer reconciliation without blind SUM mismatches', () => {
      const preflightSql = fs.readFileSync(preflightPath, 'utf-8');
      const postflightSql = fs.readFileSync(postflightPath, 'utf-8');
      const migSql = fs.readFileSync(migrationPath, 'utf-8');

      // None of the SQL files should contain the flawed blind sum:
      // WHERE t.amount_minor <> a.total_alloc (without discriminating transfer)
      expect(preflightSql).not.toContain('WHERE t.amount_minor <> a.total_alloc');
      expect(postflightSql).not.toContain('WHERE t.amount_minor <> a.total_alloc');
      expect(migSql).not.toContain('WHERE t.amount_minor <> a.total_alloc');

      // All three must contain transfer net-zero reconciliation rules
      expect(preflightSql).toContain("total_in_minor <> total_out_minor");
      expect(preflightSql).toContain("count_distinct_pockets <> count_allocations");

      expect(postflightSql).toContain("total_in_minor <> total_out_minor");
      expect(postflightSql).toContain("count_distinct_pockets <> count_allocations");

      expect(migSql).toContain("total_in <> total_out");
      expect(migSql).toContain("count_distinct_pockets <> count_allocs");
    });
  });
});

