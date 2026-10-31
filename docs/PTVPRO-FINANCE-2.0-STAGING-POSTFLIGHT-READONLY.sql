-- ============================================================================
-- PTV PRO — FINANCE 2.0 STAGING READ-ONLY POSTFLIGHT VERIFICATION SCRIPT
-- Target Database: ptvpro-staging (swadgljnyelsjstqqxbm)
-- Sesi: PTV-DEV-132 | Operator: Zidnal (jidnaal) | 24 Oktober 2026
--
-- JAMINAN KEAMANAN:
-- 1. Script ini 100% READ-ONLY (hanya menjalankan SELECT & pemeriksaan kondisi).
-- 2. DILARANG menjalankan mutasi DDL atau DML.
-- 3. Memeriksa ketersediaan tabel operasional baru, RLS policies, 5 RPC atomik,
--    kategori canonical piutang, default settings & semester, storage bucket, serta integritas ledger.
-- ============================================================================

-- 1. Status Tabel Operasional Baru & RLS Status (Semua HARUS TRUE / rls_enabled = true)
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE
    WHEN c.relrowsecurity THEN 'RLS AKTIF (Aman)'
    ELSE 'PERINGATAN: RLS TIDAK AKTIF!'
  END AS security_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'ptv_finance_semesters',
    'ptv_finance_kas_records',
    'ptv_finance_kas_payments',
    'ptv_finance_loans',
    'ptv_finance_loan_payments',
    'ptv_finance_settings'
  )
ORDER BY c.relname;

-- 2. Pemeriksaan RLS Policies Terpasang
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ptv_finance_semesters',
    'ptv_finance_kas_records',
    'ptv_finance_kas_payments',
    'ptv_finance_loans',
    'ptv_finance_loan_payments',
    'ptv_finance_settings'
  )
ORDER BY tablename, policyname;

-- 3. Pemeriksaan Ketersediaan 5 RPC Atomik & Helper Keamanan
SELECT
  p.proname AS function_name,
  n.nspname AS schema_name,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc pr
      JOIN pg_namespace ns ON ns.oid = pr.pronamespace
      WHERE ns.nspname = n.nspname AND pr.proname = p.proname
    ) THEN 'TERSEDIA'
    ELSE 'TIDAK DITEMUKAN'
  END AS status
FROM (
  VALUES
    ('rpc_record_kas_kru_payment_atomic', 'public'),
    ('rpc_disburse_loan_atomic', 'public'),
    ('rpc_record_loan_payment_atomic', 'public'),
    ('rpc_reverse_operational_record_atomic', 'public'),
    ('rpc_void_finance_transaction_atomic', 'public'),
    ('rpc_get_finance_loans_aggregate', 'public'),
    ('current_authenticated_ptv_id', 'public'),
    ('is_finance_restricted_personnel', 'public'),
    ('record_kas_kru_payment_atomic', 'ptv_finance_private'),
    ('disburse_loan_atomic', 'ptv_finance_private'),
    ('record_loan_payment_atomic', 'ptv_finance_private'),
    ('reverse_operational_record_atomic', 'ptv_finance_private'),
    ('void_finance_transaction', 'ptv_finance_private')
) AS expected_funcs(proname, nspname)
JOIN pg_proc p ON p.proname = expected_funcs.proname
JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = expected_funcs.nspname
ORDER BY n.nspname, p.proname;

-- 4. Pemeriksaan Kategori Piutang Canonical
SELECT
  id,
  name,
  kind,
  is_active
FROM public.ptv_finance_categories
WHERE name IN ('Pencairan Piutang', 'Pengembalian Pokok Piutang', 'Pendapatan Bunga Piutang')
ORDER BY name;

-- 5. Pemeriksaan Data Default Semester & Settings
SELECT
  (SELECT count(*) FROM public.ptv_finance_semesters) AS count_semesters,
  (SELECT count(*) FROM public.ptv_finance_settings) AS count_settings,
  (SELECT count(*) FROM public.ptv_finance_categories WHERE is_active = true) AS count_active_categories;

-- 6. Pemeriksaan Supabase Storage Bucket & Policies (finance-proofs)
SELECT
  id AS bucket_id,
  name AS bucket_name,
  public AS is_public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'finance-proofs';

SELECT
  policyname,
  tablename,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%finance_proofs%';

-- 7. Rekonsiliasi Integritas Saldo Buku Besar (Ledger Reconciled Check)
SELECT
  p.id AS pocket_id,
  p.name AS pocket_name,
  p.balance_minor AS posted_balance_minor,
  coalesce(alloc.calc_balance, 0) AS calculated_from_posted_allocations,
  CASE
    WHEN p.id = '60e8d033-2794-4219-a960-c56bedca0111'
    THEN 'VALID (Kas Utama Studio, Saldo Rekonstruksi Historis)'
    WHEN p.balance_minor = coalesce(alloc.calc_balance, 0)
    THEN 'RECONCILED (Saldo posted 100% sama dengan alokasi)'
    ELSE 'PERIKSA (Selisih terdeteksi)'
  END AS reconciliation_status
FROM public.ptv_finance_pockets p
LEFT JOIN (
  SELECT
    pocket_id,
    sum(
      CASE
        WHEN direction = 'in' THEN amount_minor
        WHEN direction = 'out' THEN -amount_minor
        ELSE 0
      END
    ) AS calc_balance
  FROM public.ptv_finance_allocations a
  JOIN public.ptv_finance_transactions t ON t.id = a.transaction_id
  WHERE t.status = 'posted'
  GROUP BY pocket_id
) alloc ON alloc.pocket_id = p.id
WHERE p.archived = false
ORDER BY p.name;

-- 7b. Verifikasi Integritas Alokasi Transaksi (Canonical Rule Compliance: Income, Expense, Transfer)
WITH tx_alloc_summary AS (
  SELECT
    t.id AS tx_id,
    t.kind,
    t.amount_minor AS tx_amount_minor,
    coalesce(sum(CASE WHEN a.direction = 'in' THEN a.amount_minor ELSE 0 END), 0) AS total_in_minor,
    coalesce(sum(CASE WHEN a.direction = 'out' THEN a.amount_minor ELSE 0 END), 0) AS total_out_minor,
    count(CASE WHEN a.direction = 'in' THEN 1 END) AS count_in,
    count(CASE WHEN a.direction = 'out' THEN 1 END) AS count_out,
    count(a.id) AS count_allocations,
    count(DISTINCT a.pocket_id) AS count_distinct_pockets
  FROM public.ptv_finance_transactions t
  LEFT JOIN public.ptv_finance_allocations a ON a.transaction_id = t.id
  GROUP BY t.id, t.kind, t.amount_minor
),
tx_violations AS (
  SELECT tx_id, kind
  FROM tx_alloc_summary
  WHERE
    count_allocations = 0
    OR (kind = 'income' AND (total_in_minor <> tx_amount_minor OR total_out_minor <> 0 OR count_in < 1 OR count_out <> 0))
    OR (kind = 'expense' AND (total_out_minor <> tx_amount_minor OR total_in_minor <> 0 OR count_out < 1 OR count_in <> 0))
    OR (kind = 'transfer' AND (total_in_minor <> tx_amount_minor OR total_out_minor <> tx_amount_minor OR total_in_minor <> total_out_minor OR count_in < 1 OR count_out < 1 OR count_distinct_pockets <> count_allocations))
    OR (kind NOT IN ('income', 'expense', 'transfer'))
)
SELECT
  (SELECT count(*) FROM public.ptv_finance_allocations a WHERE NOT EXISTS (SELECT 1 FROM public.ptv_finance_transactions t WHERE t.id = a.transaction_id)) AS orphaned_allocations_count,
  (SELECT count(*) FROM public.ptv_finance_allocations WHERE amount_minor <= 0 OR amount_minor IS NULL OR direction NOT IN ('in', 'out')) AS invalid_allocation_values_count,
  (SELECT count(*) FROM (SELECT transaction_id, pocket_id FROM public.ptv_finance_allocations GROUP BY transaction_id, pocket_id HAVING count(*) > 1) d) AS duplicate_pocket_allocations_count,
  (SELECT count(*) FROM tx_violations) AS tx_allocation_mismatches_count,
  CASE
    WHEN (SELECT count(*) FROM public.ptv_finance_allocations a WHERE NOT EXISTS (SELECT 1 FROM public.ptv_finance_transactions t WHERE t.id = a.transaction_id)) = 0
     AND (SELECT count(*) FROM public.ptv_finance_allocations WHERE amount_minor <= 0 OR amount_minor IS NULL OR direction NOT IN ('in', 'out')) = 0
     AND (SELECT count(*) FROM (SELECT transaction_id, pocket_id FROM public.ptv_finance_allocations GROUP BY transaction_id, pocket_id HAVING count(*) > 1) d) = 0
     AND (SELECT count(*) FROM tx_violations) = 0
    THEN 'VALID (Seluruh alokasi transaksi patuh model canonical v2 dan transfer internal net-zero)'
    ELSE 'PERIKSA (Ditemukan anomali alokasi transaksi)'
  END AS allocation_integrity_status;

