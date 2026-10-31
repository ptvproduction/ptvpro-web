-- ============================================================================
-- PTV PRO — FINANCE 2.0 STAGING READ-ONLY PREFLIGHT AUDIT SCRIPT
-- Target Database: ptvpro-staging (swadgljnyelsjstqqxbm)
-- Sesi: PTV-DEV-132 | Operator: Zidnal (jidnaal) | 24 Oktober 2026
--
-- JAMINAN KEAMANAN:
-- 1. Script ini 100% READ-ONLY (hanya menjalankan SELECT & pemeriksaan kondisi).
-- 2. DILARANG menjalankan mutasi DDL atau DML.
-- 3. Memeriksa identitas environment, proteksi anti-production, ketersediaan schema,
--    keutuhan tabel canonical v1, baseline transaksi historis, dan kesiapan sebelum ACC.
-- ============================================================================

-- 1. Identitas Server & Database
SELECT
  current_database() AS active_database,
  current_user AS active_user,
  current_setting('server_version') AS pg_version,
  current_setting('server_version_num') AS pg_version_num,
  now() AS audit_timestamp;

-- 2. Anti-Production Barrier Check (HARUS bernilai FALSE / 0)
SELECT
  count(*) AS prod_table_violations,
  CASE
    WHEN count(*) = 0 THEN 'AMAN (Bukan Database Production)'
    ELSE 'BAHAYA KRITIS: Terdeteksi Tabel Fisik Production jthzuhkblxcaohiuypqq!'
  END AS status_anti_prod
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar');

-- 3. Pemeriksaan Schema Privat Canonical V1 (ptv_finance_private)
SELECT
  schema_name,
  CASE
    WHEN schema_name IS NOT NULL THEN 'TERPASANG (Canonical V1 Private Schema)'
    ELSE 'BELUM TERPASANG (Harus dipasang Canonical V1 terlebih dahulu)'
  END AS schema_status
FROM information_schema.schemata
WHERE schema_name = 'ptv_finance_private';

-- 4. Pemeriksaan Keutuhan Arsitektur Staging & Canonical V1
SELECT
  table_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = required_tables.table_name
    ) THEN 'TERSEDIA'
    ELSE 'TIDAK DITEMUKAN'
  END AS status
FROM (
  VALUES
    ('account_profiles'),
    ('canonical_identity'),
    ('user_account'),
    ('ptv_finance_pockets'),
    ('ptv_finance_transactions'),
    ('ptv_finance_allocations'),
    ('ptv_finance_categories'),
    ('ptv_pemasukan'),
    ('ptv_pengeluaran')
) AS required_tables(table_name);

-- 5. Staging Legacy Fingerprint (Minimal 43 pemasukan & 10 pengeluaran)
SELECT
  (SELECT count(*) FROM public.ptv_pemasukan) AS count_legacy_pemasukan,
  (SELECT coalesce(sum(nominal), 0) FROM public.ptv_pemasukan) AS sum_legacy_pemasukan,
  (SELECT count(*) FROM public.ptv_pengeluaran) AS count_legacy_pengeluaran,
  (SELECT coalesce(sum(nominal), 0) FROM public.ptv_pengeluaran) AS sum_legacy_pengeluaran,
  CASE
    WHEN (SELECT count(*) FROM public.ptv_pemasukan) >= 43 AND (SELECT count(*) FROM public.ptv_pengeluaran) >= 10
    THEN 'VALID (Memenuhi Fingerprint Staging swadgljnyelsjstqqxbm)'
    ELSE 'TIDAK VALID (Bukan database Staging yang sah)'
  END AS status_fingerprint;

-- 6. Canonical V1 Baseline & Anchor Check (Minimal 53 mutasi & Saldo Kas Utama Rp 520.276)
SELECT
  (SELECT count(*) FROM public.ptv_finance_transactions) AS count_canonical_transactions,
  (SELECT count(*) FROM public.ptv_finance_allocations) AS count_allocations,
  (SELECT balance_minor FROM public.ptv_finance_pockets WHERE id = '60e8d033-2794-4219-a960-c56bedca0111' AND name = 'Kas Utama Studio') AS saldo_kas_utama_studio,
  CASE
    WHEN (SELECT count(*) FROM public.ptv_finance_transactions) >= 53
     AND (SELECT balance_minor FROM public.ptv_finance_pockets WHERE id = '60e8d033-2794-4219-a960-c56bedca0111' AND name = 'Kas Utama Studio') = 52027600
    THEN 'KONSISTEN (Anchor Kas Utama Studio Rp 520.276,00 terverifikasi valid)'
    ELSE 'INKONSISTEN (Periksa ledger V1 dan saldo anchor Kas Utama Studio terlebih dahulu)'
  END AS status_canonical_v1;

-- 6b. Ledger Allocation Integrity Check (Anti-Orphan, Canonical Rules & Net-Zero Transfer Reconciliation)
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
    -- 1. Transaksi tidak memiliki alokasi sama sekali
    count_allocations = 0
    -- 2. Validasi Pemasukan (Income): hanya alokasi 'in' dengan total = amount_minor
    OR (kind = 'income' AND (
      total_in_minor <> tx_amount_minor OR
      total_out_minor <> 0 OR
      count_in < 1 OR
      count_out <> 0
    ))
    -- 3. Validasi Pengeluaran (Expense): hanya alokasi 'out' dengan total = amount_minor
    OR (kind = 'expense' AND (
      total_out_minor <> tx_amount_minor OR
      total_in_minor <> 0 OR
      count_out < 1 OR
      count_in <> 0
    ))
    -- 4. Validasi Transfer Internal: total in = amount_minor, total out = amount_minor, net-zero balance impact, kantong asal & tujuan berbeda
    OR (kind = 'transfer' AND (
      total_in_minor <> tx_amount_minor OR
      total_out_minor <> tx_amount_minor OR
      total_in_minor <> total_out_minor OR
      count_in < 1 OR
      count_out < 1 OR
      count_distinct_pockets <> count_allocations
    ))
    -- 5. Validasi kind tidak dikenal
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
    THEN 'SEMPURNA (Tidak ada alokasi yatim, transfer internal net-zero seimbang, dan nominal transaksi match 100%)'
    ELSE 'CACAT: Integritas ledger memiliki anomali! Migrasi DIBATALKAN.'
  END AS status_ledger_integrity;

-- 7. Pemeriksaan Status Modul Operasional (Sebelum Migrasi)
SELECT
  op_table,
  EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = op_table
  ) AS is_already_created
FROM (
  VALUES
    ('ptv_finance_semesters'),
    ('ptv_finance_kas_records'),
    ('ptv_finance_kas_payments'),
    ('ptv_finance_loans'),
    ('ptv_finance_loan_payments'),
    ('ptv_finance_settings')
) AS op_tables(op_table);

-- 8. Ringkasan Kesiapan Eksekusi Migrasi (Evaluasi Multi-Barrier Dinamis)
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
  SELECT tx_id
  FROM tx_alloc_summary
  WHERE
    count_allocations = 0
    OR (kind = 'income' AND (total_in_minor <> tx_amount_minor OR total_out_minor <> 0 OR count_in < 1 OR count_out <> 0))
    OR (kind = 'expense' AND (total_out_minor <> tx_amount_minor OR total_in_minor <> 0 OR count_out < 1 OR count_in <> 0))
    OR (kind = 'transfer' AND (total_in_minor <> tx_amount_minor OR total_out_minor <> tx_amount_minor OR total_in_minor <> total_out_minor OR count_in < 1 OR count_out < 1 OR count_distinct_pockets <> count_allocations))
    OR (kind NOT IN ('income', 'expense', 'transfer'))
),
preflight_summary AS (
  SELECT
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')) AS prod_violations,
    (SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'ptv_finance_private') AS has_private_schema,
    (SELECT count(*) FROM public.ptv_pemasukan) AS inc_count,
    (SELECT count(*) FROM public.ptv_pengeluaran) AS exp_count,
    (SELECT count(*) FROM public.ptv_finance_transactions) AS tx_count,
    (SELECT balance_minor FROM public.ptv_finance_pockets WHERE id = '60e8d033-2794-4219-a960-c56bedca0111' AND name = 'Kas Utama Studio') AS kas_utama_balance,
    (SELECT count(*) FROM public.ptv_finance_allocations a WHERE NOT EXISTS (SELECT 1 FROM public.ptv_finance_transactions t WHERE t.id = a.transaction_id)) AS orphaned_alloc_count,
    (SELECT count(*) FROM public.ptv_finance_allocations WHERE amount_minor <= 0 OR amount_minor IS NULL OR direction NOT IN ('in', 'out')) AS invalid_alloc_values_count,
    (SELECT count(*) FROM (SELECT transaction_id, pocket_id FROM public.ptv_finance_allocations GROUP BY transaction_id, pocket_id HAVING count(*) > 1) d) AS duplicate_pocket_alloc_count,
    (SELECT count(*) FROM tx_violations) AS tx_alloc_mismatches
)
SELECT
  CASE
    WHEN prod_violations > 0 THEN 'BLOCKED: Terdeteksi tabel Production!'
    WHEN has_private_schema = 0 THEN 'BLOCKED: Skema ptv_finance_private belum terpasang!'
    WHEN inc_count < 43 OR exp_count < 10 THEN 'BLOCKED: Fingerprint data legacy Staging tidak valid!'
    WHEN tx_count < 53 THEN 'BLOCKED: Transaksi canonical kurang dari 53 baris!'
    WHEN kas_utama_balance IS DISTINCT FROM 52027600 THEN 'BLOCKED: Saldo anchor Kas Utama Studio bukan 52027600!'
    WHEN orphaned_alloc_count > 0 THEN 'BLOCKED: Terdapat alokasi yatim (orphaned allocations)!'
    WHEN invalid_alloc_values_count > 0 THEN 'BLOCKED: Terdapat alokasi dengan nominal tidak valid atau arah salah!'
    WHEN duplicate_pocket_alloc_count > 0 THEN 'BLOCKED: Terdapat duplikasi kantong pada alokasi transaksi!'
    WHEN tx_alloc_mismatches > 0 THEN 'BLOCKED: Terdapat anomali alokasi transaksi atau transfer internal tidak seimbang!'
    ELSE 'READY_FOR_OPERATOR_ACC'
  END AS migration_readiness_status,
  CASE
    WHEN prod_violations = 0
     AND has_private_schema > 0
     AND inc_count >= 43 AND exp_count >= 10
     AND tx_count >= 53
     AND kas_utama_balance = 52027600
     AND orphaned_alloc_count = 0
     AND invalid_alloc_values_count = 0
     AND duplicate_pocket_alloc_count = 0
     AND tx_alloc_mismatches = 0
    THEN 'Database Staging swadgljnyelsjstqqxbm terverifikasi 100% aman dan memenuhi seluruh multi-barrier preflight dinamis'
    ELSE 'Database TIDAK memenuhi kriteria pra-migrasi. Dilarang menjalankan migrasi tanpa rekonsiliasi!'
  END AS keterangan
FROM preflight_summary;
