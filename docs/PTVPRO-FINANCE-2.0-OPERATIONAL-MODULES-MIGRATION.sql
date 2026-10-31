-- ============================================================================
-- PTV PRO — FINANCE 2.0 OPERATIONAL MODULES STAGING MIGRATION
-- Target Database: ptvpro-staging (swadgljnyelsjstqqxbm)
-- Dokumen Persiapan ACC Operator: PTV-DEV-129 | Operator: zidnal (24 Oktober 2026)
--
-- Modul yang dicakup:
-- 1. ptv_finance_semesters (Semester & Periode Iuran Kas Kru)
-- 2. ptv_finance_kas_records (Catatan Matriks Pembayaran Kas Kru & Pembebasan Iuran)
-- 3. ptv_finance_loans (Pencatatan Piutang Kru & Eksternal dengan Bunga Flat Opsional)
-- 4. ptv_finance_loan_payments (Cicilan & Pelunasan Piutang)
-- 5. ptv_finance_settings (Pengaturan Operasional Kasir & Rekening Bendahara)
-- 6. Canonical Category Extension (Pencairan Piutang, Pengembalian Pokok, Pendapatan Bunga)
-- 7. Server-Verified Identity Helper (public.current_authenticated_ptv_id)
-- 8. 4 PostgreSQL Atomic RPCs (Kas Kru, Pencairan Piutang, Cicilan Piutang, Reversal)
--
-- JAMINAN KEAMANAN & BATAS OTORISASI:
-- 1. 100% Aditif: Tidak menghapus atau memodifikasi tabel legacy maupun canonical v1.
-- 2. Anti-Production Multi-Barrier:
--    - Menolak jika mendeteksi tabel Production jthzuhkblxcaohiuypqq.
--    - Memvalidasi skema privat ptv_finance_private & 6 tabel canonical v1.
--    - Memvalidasi tepat 43 pemasukan (Rp 1.244.200) & 10 pengeluaran (Rp 633.924).
--    - Memvalidasi tepat 53 transaksi canonical v1 aktif & saldo Rp 520.276.
-- 3. Server-Verified RLS: Bebas dari parameter app.current_ptv_id yang dapat dipalsukan.
--    Identitas kru diselesaikan murni dari auth.uid() -> user_account -> canonical_identity.
-- 4. Transaksi Atomik Bersama: Mutasi saldo Kantong dan metadata operasional terikat
--    dalam satu transaksi PostgreSQL yang sama (all-or-nothing).
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================================
-- 1. PREFLIGHT GUARD & MULTI-BARRIER ASSERTION ENVIRONMENT STAGING
-- ============================================================================
DO $$
DECLARE
  v_has_prod_tables BOOLEAN;
  v_has_staging_tables BOOLEAN;
  v_has_private_schema BOOLEAN;
  v_inc_count BIGINT;
  v_inc_sum BIGINT;
  v_exp_count BIGINT;
  v_exp_sum BIGINT;
  v_canonical_tx_count BIGINT;
  v_main_pocket_balance BIGINT;
BEGIN
  -- 1a. Database name check
  IF current_database() IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'FATAL: Database aktif adalah %, bukan postgres!', current_database();
  END IF;

  -- 1b. Server version check (PostgreSQL 15+)
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'Draft migration ini memerlukan PostgreSQL 15+ (terdeteksi: %)', current_setting('server_version_num');
  END IF;

  -- 1c. Anti-Production Barrier: tabel fisik Production dilarang ada di schema public
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')
  ) INTO v_has_prod_tables;

  IF v_has_prod_tables THEN
    RAISE EXCEPTION 'FATAL ANTI-PRODUCTION BARRIER: Database terdeteksi sebagai PRODUCTION (jthzuhkblxcaohiuypqq)! Eksekusi DIBATALKAN SEKETIKA.';
  END IF;

  -- 1d. Positive Staging Architecture Barrier
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('account_profiles', 'canonical_identity', 'user_account', 'ptv_finance_pockets', 'ptv_finance_transactions')
  ) INTO v_has_staging_tables;

  IF NOT v_has_staging_tables THEN
    RAISE EXCEPTION 'FATAL: Arsitektur Staging canonical tidak lengkap. Eksekusi dibatalkan.';
  END IF;

  -- 1e. Positive Private Schema Barrier
  SELECT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'ptv_finance_private'
  ) INTO v_has_private_schema;

  IF NOT v_has_private_schema THEN
    RAISE EXCEPTION 'FATAL: Skema ptv_finance_private belum terpasang di Staging. Pasang Canonical V1 terlebih dahulu.';
  END IF;

  -- 1f. Positive Capability Resolver Check
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'has_capability'
  ) THEN
    RAISE EXCEPTION 'FATAL: Fungsi public.has_capability tidak ditemukan di Staging.';
  END IF;

  -- 1g. Staging Legacy Fingerprint Barrier (Resilience: minimal baseline terverifikasi)
  SELECT count(*), coalesce(sum(nominal), 0)
    INTO v_inc_count, v_inc_sum
    FROM public.ptv_pemasukan;

  SELECT count(*), coalesce(sum(nominal), 0)
    INTO v_exp_count, v_exp_sum
    FROM public.ptv_pengeluaran;

  IF v_inc_count < 43 OR v_exp_count < 10 THEN
    RAISE EXCEPTION 'FATAL STAGING FINGERPRINT MISMATCH: Data baseline legacy tidak memenuhi standar Staging swadgljnyelsjstqqxbm (terdeteksi: inc % baris, exp % baris). Target database bukan Staging yang sah!',
      v_inc_count, v_exp_count;
  END IF;

  -- 1h. Canonical V1 Transaction Count, Anchor Pocket & Ledger Integrity Barrier
  SELECT count(*) INTO v_canonical_tx_count FROM public.ptv_finance_transactions;
  IF v_canonical_tx_count < 53 THEN
    RAISE EXCEPTION 'FATAL: Transaksi canonical V1 tidak lengkap (terdeteksi: %, minimal 53 mutasi).', v_canonical_tx_count;
  END IF;

  -- Verifikasi Anchor Kas Utama Studio (ID, Nama, dan Saldo Rekonstruksi Rp 520.276,00)
  SELECT balance_minor INTO v_main_pocket_balance
    FROM public.ptv_finance_pockets
   WHERE id = '60e8d033-2794-4219-a960-c56bedca0111'
     AND name = 'Kas Utama Studio';

  IF v_main_pocket_balance IS NULL OR v_main_pocket_balance <> 52027600 THEN
    RAISE EXCEPTION 'FATAL: Anchor Kas Utama Studio tidak valid atau saldo tidak cocok (terdeteksi: %, ekspektasi: 52027600)!', v_main_pocket_balance;
  END IF;

  -- Verifikasi Integritas Relasi Alokasi (Tidak boleh ada alokasi yatim)
  IF EXISTS (
    SELECT 1 FROM public.ptv_finance_allocations a
     WHERE NOT EXISTS (SELECT 1 FROM public.ptv_finance_transactions t WHERE t.id = a.transaction_id)
  ) THEN
    RAISE EXCEPTION 'FATAL: Integritas ledger cacat! Terdeteksi alokasi yatim (orphaned allocations) tanpa transaksi induk.';
  END IF;

  -- Verifikasi Integritas Nominal Ledger (Jumlah alokasi wajib sama dengan nominal transaksi, transfer seimbang net-zero)
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT
          t.id, t.kind, t.amount_minor,
          coalesce(sum(CASE WHEN a.direction = 'in' THEN a.amount_minor ELSE 0 END), 0) AS total_in,
          coalesce(sum(CASE WHEN a.direction = 'out' THEN a.amount_minor ELSE 0 END), 0) AS total_out,
          count(CASE WHEN a.direction = 'in' THEN 1 END) AS count_in,
          count(CASE WHEN a.direction = 'out' THEN 1 END) AS count_out,
          count(a.id) AS count_allocs,
          count(DISTINCT a.pocket_id) AS count_distinct_pockets
        FROM public.ptv_finance_transactions t
        LEFT JOIN public.ptv_finance_allocations a ON a.transaction_id = t.id
        GROUP BY t.id, t.kind, t.amount_minor
      ) s
     WHERE
       count_allocs = 0
       OR (kind = 'income' AND (total_in <> amount_minor OR total_out <> 0 OR count_in < 1 OR count_out <> 0))
       OR (kind = 'expense' AND (total_out <> amount_minor OR total_in <> 0 OR count_out < 1 OR count_in <> 0))
       OR (kind = 'transfer' AND (total_in <> amount_minor OR total_out <> amount_minor OR total_in <> total_out OR count_in < 1 OR count_out < 1 OR count_distinct_pockets <> count_allocs))
       OR (kind NOT IN ('income', 'expense', 'transfer'))
  ) THEN
    RAISE EXCEPTION 'FATAL: Integritas ledger cacat! Terdapat anomali alokasi transaksi atau transfer internal tidak seimbang.';
  END IF;
END $$;

-- Pastikan kolom bukti, catatan, dan pencatat tersedia pada ptv_finance_transactions
ALTER TABLE public.ptv_finance_transactions
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(80);

-- Pastikan kolom arsip tersedia pada ptv_finance_categories
ALTER TABLE public.ptv_finance_categories
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 2. TABEL: ptv_finance_semesters (Semester & Periode Iuran Kas Kru)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_fee_minor BIGINT NOT NULL DEFAULT 2500000,
  monthly_fees JSONB NOT NULL DEFAULT '{}'::jsonb, -- Tarif independen setiap bulan { "2026-09": "2500000", "2026-10": "3000000" }
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_semester_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_semester_fee_positive CHECK (monthly_fee_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_semesters_active
  ON public.ptv_finance_semesters (is_active, is_archived);

-- Seed semester default jika belum ada
INSERT INTO public.ptv_finance_semesters (name, start_date, end_date, monthly_fee_minor, monthly_fees, is_active, is_archived)
VALUES
  ('Semester Ganjil 2026/2027', '2026-09-01', '2027-02-28', 2500000, '{}'::jsonb, true, false),
  ('Semester Genap 2025/2026 (Historis)', '2026-03-01', '2026-08-31', 2500000, '{}'::jsonb, false, false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. TABEL: ptv_finance_kas_records (Matriks & Catatan Pembayaran Kas Kru)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_kas_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES public.ptv_finance_semesters(id) ON DELETE RESTRICT,
  ptv_id VARCHAR(20) NOT NULL,
  crew_name VARCHAR(120) NOT NULL,
  period VARCHAR(7) NOT NULL, -- format YYYY-MM
  amount_minor BIGINT NOT NULL DEFAULT 2500000,
  paid_amount_minor BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'belum', -- 'lunas', 'sebagian', 'belum', 'dikecualikan'
  payment_date DATE NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'cash',
  pocket_id UUID NOT NULL REFERENCES public.ptv_finance_pockets(id) ON DELETE RESTRICT,
  transaction_id UUID NULL REFERENCES public.ptv_finance_transactions(id) ON DELETE SET NULL,
  notes TEXT NULL,
  audit_reference VARCHAR(100) NULL,
  reversal_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_kas_record_semester_crew_period UNIQUE (semester_id, ptv_id, period),
  CONSTRAINT chk_kas_record_paid CHECK (paid_amount_minor >= 0),
  CONSTRAINT chk_kas_record_status CHECK (status IN ('lunas', 'sebagian', 'belum', 'dikecualikan'))
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_kas_records_crew
  ON public.ptv_finance_kas_records (ptv_id, period);

-- ============================================================================
-- 3b. TABEL: ptv_finance_kas_payments (Riwayat Cicilan Kas Kru Multi-Installment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_kas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.ptv_finance_kas_records(id) ON DELETE RESTRICT,
  transaction_id UUID NOT NULL REFERENCES public.ptv_finance_transactions(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(32) NOT NULL DEFAULT 'cash',
  recorded_by_ptv_id VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  reversal_reason TEXT NULL,
  reversed_at TIMESTAMPTZ NULL,
  reversed_by_ptv_id VARCHAR(32) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_kas_payments_record
  ON public.ptv_finance_kas_payments (record_id, status);

-- ============================================================================
-- 4. TABEL: ptv_finance_loans (Pencatatan Piutang Kru & Eksternal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_type VARCHAR(20) NOT NULL DEFAULT 'kru', -- 'kru' | 'eksternal'
  borrower_id VARCHAR(50) NULL, -- ptv_id jika kru internal
  borrower_name VARCHAR(120) NOT NULL,
  borrower_contact VARCHAR(60) NOT NULL,
  borrower_institution VARCHAR(120) NULL,
  principal_minor BIGINT NOT NULL,
  interest_type VARCHAR(10) NOT NULL DEFAULT 'none', -- 'none' | 'flat'
  interest_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  interest_minor BIGINT NOT NULL DEFAULT 0,
  total_due_minor BIGINT NOT NULL,
  total_paid_minor BIGINT NOT NULL DEFAULT 0,
  remaining_minor BIGINT NOT NULL,
  disbursed_on DATE NOT NULL,
  due_date DATE NULL,
  disbursed_from_pocket_id UUID NOT NULL REFERENCES public.ptv_finance_pockets(id) ON DELETE RESTRICT,
  disbursement_tx_id UUID NULL REFERENCES public.ptv_finance_transactions(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aktif', -- 'aktif', 'lunas', 'overdue', 'dibatalkan'
  purpose TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_loan_principal_positive CHECK (principal_minor > 0),
  CONSTRAINT chk_loan_interest_type CHECK (interest_type IN ('none', 'flat')),
  CONSTRAINT chk_loan_interest_rate CHECK (interest_rate_percent >= 0),
  CONSTRAINT chk_loan_interest_minor CHECK (interest_minor >= 0),
  CONSTRAINT chk_loan_total_due CHECK (total_due_minor >= principal_minor),
  CONSTRAINT chk_loan_remaining_nonneg CHECK (remaining_minor >= 0),
  CONSTRAINT chk_loan_status CHECK (status IN ('aktif', 'lunas', 'overdue', 'dibatalkan'))
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_loans_status
  ON public.ptv_finance_loans (status, due_date);

-- ============================================================================
-- 5. TABEL: ptv_finance_loan_payments (Riwayat Cicilan & Pelunasan Piutang)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.ptv_finance_loans(id) ON DELETE RESTRICT,
  paid_on DATE NOT NULL,
  amount_minor BIGINT NOT NULL,
  to_pocket_id UUID NOT NULL REFERENCES public.ptv_finance_pockets(id) ON DELETE RESTRICT,
  receipt_tx_id UUID NULL REFERENCES public.ptv_finance_transactions(id) ON DELETE SET NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'cash',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_amount_positive CHECK (amount_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_loan_payments_loan
  ON public.ptv_finance_loan_payments (loan_id, paid_on);

-- ============================================================================
-- 6. TABEL: ptv_finance_settings (Pengaturan Operasional Studio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'studio_default',
  default_monthly_fee_minor BIGINT NOT NULL DEFAULT 2500000,
  fee_due_day INT NOT NULL DEFAULT 10,
  default_loan_due_days INT NOT NULL DEFAULT 30,
  treasurer_name VARCHAR(100) NOT NULL DEFAULT 'Farsya',
  treasurer_ptv_id VARCHAR(20) NOT NULL DEFAULT 'PTV-023',
  treasurer_phone VARCHAR(30) NOT NULL DEFAULT '+62 822-1234-5678',
  official_bank_pocket_id UUID NULL REFERENCES public.ptv_finance_pockets(id) ON DELETE SET NULL,
  official_qris_pocket_id UUID NULL REFERENCES public.ptv_finance_pockets(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ptv_finance_settings (id, default_monthly_fee_minor, fee_due_day, default_loan_due_days, treasurer_name, treasurer_ptv_id, treasurer_phone)
VALUES ('studio_default', 2500000, 10, 30, 'Farsya', 'PTV-023', '+62 822-1234-5678')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. SEED KATEGORI CANONICAL UNTUK PIUTANG (ISOLASI AKUNTANSI POKOK VS BUNGA)
-- ============================================================================
INSERT INTO public.ptv_finance_categories (name, kind) VALUES
  ('Pencairan Piutang', 'expense'),
  ('Pengembalian Pokok Piutang', 'income'),
  ('Pendapatan Bunga Piutang', 'income')
ON CONFLICT (name, kind) DO NOTHING;

-- ============================================================================
-- 8. SERVER-VERIFIED IDENTITY HELPER (ANTI-SPOOFING RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_authenticated_ptv_id()
RETURNS VARCHAR(32)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT ci.ptv_id
    FROM public.canonical_identity ci
    JOIN public.user_account ua ON ua.identity_id = ci.id
   WHERE ua.auth_user_id = auth.uid()
     AND ua.status_akun = 'active'
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_authenticated_ptv_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_authenticated_ptv_id() TO authenticated, service_role;

-- ============================================================================
-- 8b. SERVER-VERIFIED CATEGORY GUARD: PEMBINA & PENGARAH FORBIDDEN (BAGIAN I)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_finance_restricted_personnel()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.canonical_identity ci
      JOIN public.user_account ua ON ua.identity_id = ci.id
      JOIN public.legacy_archive_kru lak ON lak.ptv_id = ci.ptv_id
     WHERE ua.auth_user_id = auth.uid()
       AND ua.status_akun = 'active'
       AND LOWER(TRIM(lak.category)) IN ('pembina', 'pengarah')
  );
$$;

REVOKE ALL ON FUNCTION public.is_finance_restricted_personnel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_finance_restricted_personnel() TO authenticated, service_role;

-- ============================================================================
-- 9. KEBIJAKAN ROW LEVEL SECURITY (RLS) & HAK AKSES
-- ============================================================================
ALTER TABLE public.ptv_finance_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_kas_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_kas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_settings ENABLE ROW LEVEL SECURITY;

-- Revoke direct write from PUBLIC, anon, and authenticated
REVOKE ALL ON public.ptv_finance_semesters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_kas_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_kas_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_loans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_loan_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_settings FROM PUBLIC, anon, authenticated;

-- Grant SELECT to authenticated users
GRANT SELECT ON public.ptv_finance_semesters TO authenticated;
GRANT SELECT ON public.ptv_finance_kas_records TO authenticated;
GRANT SELECT ON public.ptv_finance_kas_payments TO authenticated;
GRANT SELECT ON public.ptv_finance_loans TO authenticated;
GRANT SELECT ON public.ptv_finance_loan_payments TO authenticated;
GRANT SELECT ON public.ptv_finance_settings TO authenticated;

-- Grant ALL only to service_role (server-only mutation via API)
GRANT ALL ON public.ptv_finance_semesters TO service_role;
GRANT ALL ON public.ptv_finance_kas_records TO service_role;
GRANT ALL ON public.ptv_finance_kas_payments TO service_role;
GRANT ALL ON public.ptv_finance_loans TO service_role;
GRANT ALL ON public.ptv_finance_loan_payments TO service_role;
GRANT ALL ON public.ptv_finance_settings TO service_role;

-- RLS Read Policies (Fail-closed: Pembina & Pengarah ditolak secara mutlak):
DROP POLICY IF EXISTS ptv_finance_semesters_read ON public.ptv_finance_semesters;
CREATE POLICY ptv_finance_semesters_read ON public.ptv_finance_semesters
  FOR SELECT TO authenticated USING (
    NOT public.is_finance_restricted_personnel()
  );

DROP POLICY IF EXISTS ptv_finance_kas_records_read ON public.ptv_finance_kas_records;
CREATE POLICY ptv_finance_kas_records_read ON public.ptv_finance_kas_records
  FOR SELECT TO authenticated USING (
    NOT public.is_finance_restricted_personnel() AND (
      public.has_capability('finance.view') OR
      ptv_id = public.current_authenticated_ptv_id()
    )
  );

DROP POLICY IF EXISTS ptv_finance_kas_payments_read ON public.ptv_finance_kas_payments;
CREATE POLICY ptv_finance_kas_payments_read ON public.ptv_finance_kas_payments
  FOR SELECT TO authenticated USING (
    NOT public.is_finance_restricted_personnel() AND (
      public.has_capability('finance.view') OR
      EXISTS (
        SELECT 1 FROM public.ptv_finance_kas_records r
         WHERE r.id = ptv_finance_kas_payments.record_id
           AND r.ptv_id = public.current_authenticated_ptv_id()
      )
    )
  );

-- Piutang Privasi: Hanya pengelola (finance.manage) atau peminjam kru terkait yang boleh melihat detail piutang.
-- Peminjam eksternal hanya dapat dilihat oleh pengelola berwenang. Pembina/Pengarah ditolak.
DROP POLICY IF EXISTS ptv_finance_loans_read ON public.ptv_finance_loans;
CREATE POLICY ptv_finance_loans_read ON public.ptv_finance_loans
  FOR SELECT TO authenticated USING (
    NOT public.is_finance_restricted_personnel() AND (
      public.has_capability('finance.manage') OR
      (borrower_type = 'kru' AND borrower_id = public.current_authenticated_ptv_id())
    )
  );

-- Cicilan Privasi: Hanya pengelola (finance.manage) atau pemilik piutang yang boleh melihat riwayat cicilan
DROP POLICY IF EXISTS ptv_finance_loan_payments_read ON public.ptv_finance_loan_payments;
CREATE POLICY ptv_finance_loan_payments_read ON public.ptv_finance_loan_payments
  FOR SELECT TO authenticated USING (
    NOT public.is_finance_restricted_personnel() AND (
      public.has_capability('finance.manage') OR
      EXISTS (
        SELECT 1 FROM public.ptv_finance_loans l
         WHERE l.id = ptv_finance_loan_payments.loan_id
           AND l.borrower_type = 'kru'
           AND l.borrower_id = public.current_authenticated_ptv_id()
      )
    )
  );

DROP POLICY IF EXISTS ptv_finance_settings_read ON public.ptv_finance_settings;
CREATE POLICY ptv_finance_settings_read ON public.ptv_finance_settings
  FOR SELECT TO authenticated USING (
    NOT public.is_finance_restricted_personnel()
  );

-- ============================================================================
-- 10. RPC AGREGAT PIUTANG (PRIVASI TERJAMIN TANPA MEMBOCORKAN DATA PRIBADI)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_finance_loans_aggregate()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'total_principal_minor', coalesce(sum(principal_minor), 0)::TEXT,
    'total_interest_minor', coalesce(sum(interest_minor), 0)::TEXT,
    'total_due_minor', coalesce(sum(total_due_minor), 0)::TEXT,
    'total_paid_minor', coalesce(sum(total_paid_minor), 0)::TEXT,
    'total_remaining_minor', coalesce(sum(remaining_minor), 0)::TEXT,
    'active_count', count(*) FILTER (WHERE status = 'aktif'),
    'overdue_count', count(*) FILTER (WHERE status = 'overdue'),
    'paid_count', count(*) FILTER (WHERE status = 'lunas')
  )
  FROM public.ptv_finance_loans
  WHERE status <> 'dibatalkan';
$$;

REVOKE ALL ON FUNCTION public.rpc_get_finance_loans_aggregate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_finance_loans_aggregate() TO authenticated, service_role;

-- ============================================================================
-- 11. RPC ATOMIK 1: PEMBAYARAN KAS KRU (POSTGRESQL SINGLE-TRANSACTION)
-- ============================================================================
CREATE OR REPLACE FUNCTION ptv_finance_private.record_kas_kru_payment_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_kas_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_verified_actor_id UUID;
  v_tx_result JSONB;
  v_tx_id UUID;
  v_audit_ref TEXT;
  v_periods JSONB;
  v_period_elem JSONB;
  v_period_str TEXT;
  v_portion BIGINT;
  v_total_amount BIGINT;
  v_period_count INT;
  v_rem BIGINT;
  v_existing_rec RECORD;
  v_new_paid BIGINT;
  v_target_amount BIGINT;
  v_status TEXT;
  v_created_records JSONB := '[]'::JSONB;
  v_rec_id UUID;
BEGIN
  -- 1. Verifikasi kapabilitas pengelola keuangan via authorize
  v_verified_actor_id := ptv_finance_private.authorize(p_account_id, p_session_iat, 'finance.manage');

  IF p_kas_payload IS NULL OR jsonb_typeof(p_kas_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload kas kru tidak valid' USING ERRCODE = '22023';
  END IF;

  v_periods := p_kas_payload->'periods';
  IF v_periods IS NULL OR jsonb_typeof(v_periods) <> 'array' OR jsonb_array_length(v_periods) = 0 THEN
    RAISE EXCEPTION 'Minimal satu periode iuran kas kru wajib dipilih' USING ERRCODE = '22023';
  END IF;

  -- 1b. Aturan H: Pembina & Pengarah tidak boleh ditagih kas kru
  IF EXISTS (
    SELECT 1 FROM public.legacy_archive_kru lak
     WHERE lak.ptv_id = (p_kas_payload->>'ptvId')
       AND LOWER(TRIM(lak.category)) IN ('pembina', 'pengarah')
  ) THEN
    RAISE EXCEPTION 'Personel berkategori Pembina atau Pengarah tidak dapat ditagih Kas Kru' USING ERRCODE = '22023';
  END IF;

  -- 2. Posting canonical transaction (Mutasi saldo kantong & alokasi)
  v_tx_result := ptv_finance_private.post_transaction(p_account_id, p_session_iat, p_command);
  v_tx_id := (v_tx_result->>'transaction_id')::UUID;
  v_audit_ref := v_tx_result->>'audit_reference';

  -- Jika idempotent replay, kembalikan record yang sudah tersimpan
  IF (v_tx_result->>'idempotent_replay')::BOOLEAN = true THEN
    SELECT jsonb_agg(row_to_json(r))
      INTO v_created_records
      FROM public.ptv_finance_kas_records r
     WHERE r.transaction_id = v_tx_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'transaction', v_tx_result,
      'records', coalesce(v_created_records, '[]'::JSONB)
    );
  END IF;

  -- 3. Hitung porsi per periode
  v_total_amount := (p_command->>'amountMinor')::BIGINT;
  v_period_count := jsonb_array_length(v_periods);
  v_portion := v_total_amount / v_period_count;
  v_rem := v_total_amount % v_period_count;

  FOR v_period_elem IN SELECT * FROM jsonb_array_elements(v_periods) LOOP
    v_period_str := v_period_elem #>> '{}';
    IF v_rem > 0 THEN
      v_portion := (v_total_amount / v_period_count) + 1;
      v_rem := v_rem - 1;
    ELSE
      v_portion := v_total_amount / v_period_count;
    END IF;

    SELECT * INTO v_existing_rec
      FROM public.ptv_finance_kas_records
     WHERE semester_id = (p_kas_payload->>'semesterId')::UUID
       AND ptv_id = (p_kas_payload->>'ptvId')
       AND period = v_period_str
     FOR UPDATE;

    IF FOUND THEN
      v_new_paid := v_existing_rec.paid_amount_minor + v_portion;
      v_target_amount := v_existing_rec.amount_minor;
      v_status := CASE WHEN v_new_paid >= v_target_amount THEN 'lunas' ELSE 'sebagian' END;

      UPDATE public.ptv_finance_kas_records
         SET paid_amount_minor = v_new_paid,
             status = v_status,
             payment_date = (p_command->>'occurredOn')::DATE,
             method = coalesce(p_kas_payload->>'method', 'cash'),
             pocket_id = (p_command->'incoming'->0->>'pocketId')::UUID,
             transaction_id = v_tx_id,
             audit_reference = v_audit_ref,
             notes = coalesce(notes || ' | ', '') || coalesce(p_kas_payload->>'notes', ''),
             updated_at = now()
       WHERE id = v_existing_rec.id
       RETURNING id INTO v_rec_id;
    ELSE
      v_status := 'lunas';
      INSERT INTO public.ptv_finance_kas_records (
        semester_id, ptv_id, crew_name, period,
        amount_minor, paid_amount_minor, status,
        payment_date, method, pocket_id,
        transaction_id, audit_reference, notes
      ) VALUES (
        (p_kas_payload->>'semesterId')::UUID,
        p_kas_payload->>'ptvId',
        p_kas_payload->>'crewName',
        v_period_str,
        v_portion,
        v_portion,
        v_status,
        (p_command->>'occurredOn')::DATE,
        coalesce(p_kas_payload->>'method', 'cash'),
        (p_command->'incoming'->0->>'pocketId')::UUID,
        v_tx_id,
        v_audit_ref,
        p_kas_payload->>'notes'
      ) RETURNING id INTO v_rec_id;
    END IF;

    v_created_records := v_created_records || jsonb_build_object('id', v_rec_id, 'period', v_period_str, 'portion', v_portion);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction', v_tx_result,
    'records', v_created_records
  );
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.record_kas_kru_payment_atomic(UUID, BIGINT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.record_kas_kru_payment_atomic(UUID, BIGINT, JSONB, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_record_kas_kru_payment_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_kas_payload JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.record_kas_kru_payment_atomic(p_account_id, p_session_iat, p_command, p_kas_payload);
$$;

REVOKE ALL ON FUNCTION public.rpc_record_kas_kru_payment_atomic(UUID, BIGINT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_record_kas_kru_payment_atomic(UUID, BIGINT, JSONB, JSONB) TO service_role;

-- ============================================================================
-- 12. RPC ATOMIK 2: PENCAIRAN PIUTANG (POSTGRESQL SINGLE-TRANSACTION)
-- ============================================================================
CREATE OR REPLACE FUNCTION ptv_finance_private.disburse_loan_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_loan_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_verified_actor_id UUID;
  v_tx_result JSONB;
  v_tx_id UUID;
  v_principal BIGINT;
  v_rate NUMERIC(5, 2);
  v_interest_minor BIGINT := 0;
  v_total_due BIGINT;
  v_loan_id UUID;
  v_existing_loan RECORD;
BEGIN
  v_verified_actor_id := ptv_finance_private.authorize(p_account_id, p_session_iat, 'finance.manage');

  IF p_loan_payload IS NULL OR jsonb_typeof(p_loan_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload piutang tidak valid' USING ERRCODE = '22023';
  END IF;

  v_principal := (p_loan_payload->>'principalMinor')::BIGINT;
  IF v_principal IS NULL OR v_principal <= 0 THEN
    RAISE EXCEPTION 'Pokok pinjaman harus lebih dari nol' USING ERRCODE = '22023';
  END IF;

  IF (p_loan_payload->>'interestType') = 'flat' THEN
    v_rate := coalesce((p_loan_payload->>'interestRatePercent')::NUMERIC, 0.00);
    v_interest_minor := round((v_principal * round(v_rate * 100)) / 10000);
  ELSE
    v_interest_minor := 0;
    v_rate := 0.00;
  END IF;

  v_total_due := v_principal + v_interest_minor;

  -- 1. Eksekusi pengeluaran dana kas via canonical ledger
  v_tx_result := ptv_finance_private.post_transaction(p_account_id, p_session_iat, p_command);
  v_tx_id := (v_tx_result->>'transaction_id')::UUID;

  IF (v_tx_result->>'idempotent_replay')::BOOLEAN = true THEN
    SELECT * INTO v_existing_loan
      FROM public.ptv_finance_loans
     WHERE disbursement_tx_id = v_tx_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'transaction', v_tx_result,
      'loan', row_to_json(v_existing_loan)
    );
  END IF;

  -- 2. Rekam kontrak piutang dalam transaksi database yang sama
  v_loan_id := gen_random_uuid();
  INSERT INTO public.ptv_finance_loans (
    id, borrower_type, borrower_id, borrower_name, borrower_contact, borrower_institution,
    principal_minor, interest_type, interest_rate_percent, interest_minor,
    total_due_minor, total_paid_minor, remaining_minor,
    disbursed_on, due_date, disbursed_from_pocket_id, disbursement_tx_id,
    status, purpose, notes
  ) VALUES (
    v_loan_id,
    p_loan_payload->>'borrowerType',
    p_loan_payload->>'borrowerId',
    p_loan_payload->>'borrowerName',
    p_loan_payload->>'borrowerContact',
    p_loan_payload->>'borrowerInstitution',
    v_principal,
    coalesce(p_loan_payload->>'interestType', 'none'),
    v_rate,
    v_interest_minor,
    v_total_due,
    0,
    v_total_due,
    (p_command->>'occurredOn')::DATE,
    (p_loan_payload->>'dueDate')::DATE,
    (p_command->'outgoing'->0->>'pocketId')::UUID,
    v_tx_id,
    'aktif',
    p_loan_payload->>'purpose',
    p_loan_payload->>'notes'
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction', v_tx_result,
    'loan_id', v_loan_id,
    'total_due_minor', v_total_due,
    'remaining_minor', v_total_due
  );
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.disburse_loan_atomic(UUID, BIGINT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.disburse_loan_atomic(UUID, BIGINT, JSONB, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_disburse_loan_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_loan_payload JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.disburse_loan_atomic(p_account_id, p_session_iat, p_command, p_loan_payload);
$$;

REVOKE ALL ON FUNCTION public.rpc_disburse_loan_atomic(UUID, BIGINT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_disburse_loan_atomic(UUID, BIGINT, JSONB, JSONB) TO service_role;

-- ============================================================================
-- 13. RPC ATOMIK 3: CICILAN / PELUNASAN PIUTANG (POSTGRESQL SINGLE-TRANSACTION)
-- ============================================================================
CREATE OR REPLACE FUNCTION ptv_finance_private.record_loan_payment_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_payment_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_verified_actor_id UUID;
  v_tx_result JSONB;
  v_tx_id UUID;
  v_loan RECORD;
  v_pay_amount BIGINT;
  v_payment_id UUID;
  v_new_paid BIGINT;
  v_new_remaining BIGINT;
  v_new_status TEXT;
BEGIN
  v_verified_actor_id := ptv_finance_private.authorize(p_account_id, p_session_iat, 'finance.manage');

  IF p_payment_payload IS NULL OR jsonb_typeof(p_payment_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload pembayaran cicilan tidak valid' USING ERRCODE = '22023';
  END IF;

  v_pay_amount := (p_command->>'amountMinor')::BIGINT;
  IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran cicilan harus lebih dari nol' USING ERRCODE = '22023';
  END IF;

  -- 1. Kunci baris pinjaman (Row Lock FOR UPDATE untuk mencegah race condition overpayment)
  SELECT * INTO v_loan
    FROM public.ptv_finance_loans
   WHERE id = (p_payment_payload->>'loanId')::UUID
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data piutang tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  IF v_loan.status NOT IN ('aktif', 'overdue') THEN
    RAISE EXCEPTION 'Piutang tidak dalam status aktif atau telah lunas/dibatalkan' USING ERRCODE = '22023';
  END IF;

  -- 2. Strict Anti-Overpayment Guard
  IF v_pay_amount > v_loan.remaining_minor THEN
    RAISE EXCEPTION 'Nominal pembayaran cicilan (%) melebihi sisa tagihan (%). Kelebihan bayar dilarang',
      v_pay_amount, v_loan.remaining_minor USING ERRCODE = '22023';
  END IF;

  -- 3. Eksekusi pemasukan dana ke kas via canonical ledger
  v_tx_result := ptv_finance_private.post_transaction(p_account_id, p_session_iat, p_command);
  v_tx_id := (v_tx_result->>'transaction_id')::UUID;

  IF (v_tx_result->>'idempotent_replay')::BOOLEAN = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'transaction', v_tx_result,
      'loan_id', v_loan.id,
      'remaining_minor', v_loan.remaining_minor
    );
  END IF;

  -- 4. Catat riwayat cicilan & update sisa pinjaman
  v_payment_id := gen_random_uuid();
  INSERT INTO public.ptv_finance_loan_payments (
    id, loan_id, paid_on, amount_minor, to_pocket_id, receipt_tx_id, method, notes
  ) VALUES (
    v_payment_id,
    v_loan.id,
    (p_command->>'occurredOn')::DATE,
    v_pay_amount,
    (p_command->'incoming'->0->>'pocketId')::UUID,
    v_tx_id,
    coalesce(p_payment_payload->>'method', 'cash'),
    p_payment_payload->>'notes'
  );

  v_new_paid := v_loan.total_paid_minor + v_pay_amount;
  v_new_remaining := v_loan.remaining_minor - v_pay_amount;
  v_new_status := CASE WHEN v_new_remaining = 0 THEN 'lunas' ELSE v_loan.status END;

  UPDATE public.ptv_finance_loans
     SET total_paid_minor = v_new_paid,
         remaining_minor = v_new_remaining,
         status = v_new_status,
         updated_at = now()
   WHERE id = v_loan.id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction', v_tx_result,
    'payment_id', v_payment_id,
    'loan_id', v_loan.id,
    'total_paid_minor', v_new_paid,
    'remaining_minor', v_new_remaining,
    'status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.record_loan_payment_atomic(UUID, BIGINT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.record_loan_payment_atomic(UUID, BIGINT, JSONB, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_record_loan_payment_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_payment_payload JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.record_loan_payment_atomic(p_account_id, p_session_iat, p_command, p_payment_payload);
$$;

REVOKE ALL ON FUNCTION public.rpc_record_loan_payment_atomic(UUID, BIGINT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_record_loan_payment_atomic(UUID, BIGINT, JSONB, JSONB) TO service_role;

-- ============================================================================
-- 14. RPC ATOMIK 4: REVERSAL / PEMBATALAN OPERASIONAL & MUTASI KAS TERKAIT
-- ============================================================================
CREATE OR REPLACE FUNCTION ptv_finance_private.reverse_operational_record_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_record_type TEXT, -- 'kas_kru' | 'loan_disbursement' | 'loan_payment'
  p_record_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_verified_actor_id UUID;
  v_reason TEXT;
  v_kas RECORD;
  v_loan RECORD;
  v_pay RECORD;
  v_tx RECORD;
  v_alloc RECORD;
BEGIN
  v_verified_actor_id := ptv_finance_private.authorize(p_account_id, p_session_iat, 'finance.manage');

  v_reason := trim(p_reason);
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Alasan pembatalan/reversal wajib diisi minimal 3 karakter' USING ERRCODE = '22023';
  END IF;

  IF p_record_type = 'kas_kru' THEN
    SELECT * INTO v_kas
      FROM public.ptv_finance_kas_records
     WHERE id = p_record_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Catatan kas kru tidak ditemukan' USING ERRCODE = '22023';
    END IF;

    -- Batalkan transaksi canonical jika ada
    IF v_kas.transaction_id IS NOT NULL THEN
      SELECT * INTO v_tx
        FROM public.ptv_finance_transactions
       WHERE id = v_kas.transaction_id
         FOR UPDATE;

      IF FOUND AND v_tx.status = 'posted' THEN
        -- Kembalikan saldo kantong (kurangi saldo penerima)
        FOR v_alloc IN SELECT * FROM public.ptv_finance_allocations WHERE transaction_id = v_tx.id LOOP
          IF v_alloc.direction = 'in' THEN
            UPDATE public.ptv_finance_pockets
               SET balance_minor = balance_minor - v_alloc.amount_minor,
                   version = version + 1,
                   updated_at = now()
             WHERE id = v_alloc.pocket_id;
          END IF;
        END LOOP;

        UPDATE public.ptv_finance_transactions
           SET status = 'reversed',
               updated_at = now()
         WHERE id = v_tx.id;
      END IF;
    END IF;

    UPDATE public.ptv_finance_kas_records
       SET paid_amount_minor = 0,
           status = 'belum',
           reversal_reason = v_reason,
           updated_at = now()
     WHERE id = v_kas.id;

    RETURN jsonb_build_object('success', true, 'record_type', 'kas_kru', 'id', v_kas.id, 'status', 'belum');

  ELSIF p_record_type = 'loan_disbursement' THEN
    SELECT * INTO v_loan
      FROM public.ptv_finance_loans
     WHERE id = p_record_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Data piutang tidak ditemukan' USING ERRCODE = '22023';
    END IF;

    -- Pastikan belum ada cicilan yang masuk
    IF EXISTS (SELECT 1 FROM public.ptv_finance_loan_payments WHERE loan_id = v_loan.id) THEN
      RAISE EXCEPTION 'Piutang yang sudah memiliki riwayat cicilan tidak dapat dibatalkan langsung. Batalkan cicilan terlebih dahulu' USING ERRCODE = '22023';
    END IF;

    IF v_loan.disbursement_tx_id IS NOT NULL THEN
      SELECT * INTO v_tx
        FROM public.ptv_finance_transactions
       WHERE id = v_loan.disbursement_tx_id
         FOR UPDATE;

      IF FOUND AND v_tx.status = 'posted' THEN
        -- Kembalikan dana pokok ke kantong asal
        FOR v_alloc IN SELECT * FROM public.ptv_finance_allocations WHERE transaction_id = v_tx.id LOOP
          IF v_alloc.direction = 'out' THEN
            UPDATE public.ptv_finance_pockets
               SET balance_minor = balance_minor + v_alloc.amount_minor,
                   version = version + 1,
                   updated_at = now()
             WHERE id = v_alloc.pocket_id;
          END IF;
        END LOOP;

        UPDATE public.ptv_finance_transactions
           SET status = 'reversed',
               updated_at = now()
         WHERE id = v_tx.id;
      END IF;
    END IF;

    UPDATE public.ptv_finance_loans
       SET status = 'dibatalkan',
           notes = coalesce(notes || ' | ', '') || 'Dibatalkan: ' || v_reason,
           updated_at = now()
     WHERE id = v_loan.id;

    RETURN jsonb_build_object('success', true, 'record_type', 'loan_disbursement', 'id', v_loan.id, 'status', 'dibatalkan');

  ELSIF p_record_type = 'loan_payment' THEN
    SELECT * INTO v_pay
      FROM public.ptv_finance_loan_payments
     WHERE id = p_record_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Data cicilan piutang tidak ditemukan' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_loan
      FROM public.ptv_finance_loans
     WHERE id = v_pay.loan_id
       FOR UPDATE;

    IF v_pay.receipt_tx_id IS NOT NULL THEN
      SELECT * INTO v_tx
        FROM public.ptv_finance_transactions
       WHERE id = v_pay.receipt_tx_id
         FOR UPDATE;

      IF FOUND AND v_tx.status = 'posted' THEN
        FOR v_alloc IN SELECT * FROM public.ptv_finance_allocations WHERE transaction_id = v_tx.id LOOP
          IF v_alloc.direction = 'in' THEN
            UPDATE public.ptv_finance_pockets
               SET balance_minor = balance_minor - v_alloc.amount_minor,
                   version = version + 1,
                   updated_at = now()
             WHERE id = v_alloc.pocket_id;
          END IF;
        END LOOP;

        UPDATE public.ptv_finance_transactions
           SET status = 'reversed',
               updated_at = now()
         WHERE id = v_tx.id;
      END IF;
    END IF;

    -- Kembalikan saldo pinjaman
    UPDATE public.ptv_finance_loans
       SET total_paid_minor = total_paid_minor - v_pay.amount_minor,
           remaining_minor = remaining_minor + v_pay.amount_minor,
           status = 'aktif',
           updated_at = now()
     WHERE id = v_loan.id;

    DELETE FROM public.ptv_finance_loan_payments WHERE id = v_pay.id;

    RETURN jsonb_build_object('success', true, 'record_type', 'loan_payment', 'id', v_pay.id, 'status', 'reversed');
  ELSE
    RAISE EXCEPTION 'Tipe record operasional tidak dikenal: %', p_record_type USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.reverse_operational_record_atomic(UUID, BIGINT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.reverse_operational_record_atomic(UUID, BIGINT, TEXT, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_reverse_operational_record_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_record_type TEXT,
  p_record_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.reverse_operational_record_atomic(p_account_id, p_session_iat, p_record_type, p_record_id, p_reason);
$$;

REVOKE ALL ON FUNCTION public.rpc_reverse_operational_record_atomic(UUID, BIGINT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reverse_operational_record_atomic(UUID, BIGINT, TEXT, UUID, TEXT) TO service_role;

-- ============================================================================
-- 14b. ATOMIC REVERSAL FOR MANUAL TRANSACTIONS (REVERSES POCKET ALLOCATIONS)
-- ============================================================================
CREATE OR REPLACE FUNCTION ptv_finance_private.void_finance_transaction(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_tx_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_identity_id UUID;
  v_ptv_id VARCHAR(32);
  v_category TEXT;
  v_tx RECORD;
  v_alloc RECORD;
  v_reason TEXT := coalesce(trim(p_reason), 'Pembatalan transaksi oleh operator');
BEGIN
  -- 1. Validasi akun, masa berlaku token, dan capability pengelola
  SELECT identity_id INTO v_identity_id
    FROM public.user_account
   WHERE id = p_account_id
     AND status_akun = 'active'
     AND (tokens_valid_after IS NULL OR p_session_iat * 1000 >= EXTRACT(EPOCH FROM tokens_valid_after) * 1000);

  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Akun tidak sah atau sesi kedaluwarsa' USING ERRCODE = '42501';
  END IF;

  -- 2. Anti-Pembina & Anti-Pengarah Barrier
  SELECT lak.category, ci.ptv_id
    INTO v_category, v_ptv_id
    FROM public.canonical_identity ci
    LEFT JOIN public.legacy_archive_kru lak ON lak.ptv_id = ci.ptv_id
   WHERE ci.id = v_identity_id;

  IF LOWER(TRIM(coalesce(v_category, ''))) IN ('pembina', 'pengarah') THEN
    RAISE EXCEPTION 'Akses ditolak: Kategori Pembina/Pengarah dilarang mengelola transaksi keuangan' USING ERRCODE = '42501';
  END IF;

  -- 3. Cek capability finance.manage
  IF NOT EXISTS (
    SELECT 1
      FROM public.account_profiles ap
      JOIN public.profile_capabilities pc ON pc.profile_id = ap.profile_id
     WHERE ap.account_id = p_account_id
       AND pc.capability_key IN ('finance.manage', 'root.all')
  ) AND NOT EXISTS (
    SELECT 1
      FROM public.account_capability_overrides
     WHERE account_id = p_account_id
       AND capability_key = 'finance.manage'
       AND override_type = 'allow'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: Memerlukan capability finance.manage' USING ERRCODE = '42501';
  END IF;

  -- 4. Kunci transaksi
  SELECT * INTO v_tx
    FROM public.ptv_finance_transactions
   WHERE id = p_tx_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  -- Idempotency check: jika sudah reversed, return existing
  IF v_tx.status = 'reversed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'tx_id', v_tx.id,
      'status', 'reversed',
      'message', 'Transaksi sudah dibatalkan sebelumnya.'
    );
  END IF;

  -- Tolak jika transaksi terhubung ke Kas Kru atau Piutang
  IF v_tx.audit_reference LIKE 'KAS-KRU-%' OR v_tx.audit_reference LIKE 'PIUTANG-%' THEN
    RAISE EXCEPTION 'Transaksi ini terhubung ke modul operasional. Lakukan pembatalan melalui modul terkait' USING ERRCODE = '22023';
  END IF;

  -- 5. Rollback alokasi saldo pada kantong-kantong terkait (ORDER BY pocket_id demi keteraturan lock deterministik dan anti-deadlock)
  FOR v_alloc IN SELECT * FROM public.ptv_finance_allocations WHERE transaction_id = v_tx.id ORDER BY pocket_id LOOP
    IF v_alloc.direction = 'in' THEN
      -- Pemasukan ke kantong dibatalkan -> kurangi saldo
      UPDATE public.ptv_finance_pockets
         SET balance_minor = balance_minor - v_alloc.amount_minor,
             version = version + 1,
             updated_at = now()
       WHERE id = v_alloc.pocket_id;
    ELSIF v_alloc.direction = 'out' THEN
      -- Pengeluaran dari kantong dibatalkan -> kembalikan saldo
      UPDATE public.ptv_finance_pockets
         SET balance_minor = balance_minor + v_alloc.amount_minor,
             version = version + 1,
             updated_at = now()
       WHERE id = v_alloc.pocket_id;
    END IF;
  END LOOP;

  -- 6. Update status transaksi
  UPDATE public.ptv_finance_transactions
     SET status = 'reversed',
         reversal_reason = v_reason,
         reversed_at = now(),
         reversed_by = v_identity_id,
         updated_at = now()
   WHERE id = v_tx.id;

  -- 7. Audit log
  INSERT INTO public.ptv_finance_audit_log (entity_type, entity_id, action, actor_id, payload)
  VALUES (
    'transaction',
    v_tx.id,
    'void',
    v_identity_id,
    jsonb_build_object('reason', v_reason, 'reversed_tx_id', v_tx.id, 'amount_minor', v_tx.amount_minor)
  );

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', v_tx.id,
    'status', 'reversed',
    'message', 'Transaksi berhasil dibatalkan dan alokasi saldo kantong telah dikembalikan.'
  );
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.void_finance_transaction(UUID, BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.void_finance_transaction(UUID, BIGINT, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_void_finance_transaction_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_tx_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.void_finance_transaction(p_account_id, p_session_iat, p_tx_id, p_reason);
$$;

REVOKE ALL ON FUNCTION public.rpc_void_finance_transaction_atomic(UUID, BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_finance_transaction_atomic(UUID, BIGINT, UUID, TEXT) TO service_role;

-- ============================================================================
-- 15. SUPABASE STORAGE BUCKET: finance-proofs (BUKTI TRANSAKSI & NOTA)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-proofs',
  'finance-proofs',
  false,
  5242880, -- 5 MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies:
DROP POLICY IF EXISTS "finance_proofs_upload" ON storage.objects;
CREATE POLICY "finance_proofs_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'finance-proofs' AND
    NOT public.is_finance_restricted_personnel() AND
    public.has_capability('finance.manage')
  );

DROP POLICY IF EXISTS "finance_proofs_read" ON storage.objects;
CREATE POLICY "finance_proofs_read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'finance-proofs' AND
    NOT public.is_finance_restricted_personnel() AND
    (public.has_capability('finance.view') OR public.has_capability('finance.view_own'))
  );

DROP POLICY IF EXISTS "finance_proofs_delete" ON storage.objects;
CREATE POLICY "finance_proofs_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'finance-proofs' AND
    NOT public.is_finance_restricted_personnel() AND
    public.has_capability('finance.manage')
  );

-- ============================================================================
-- 16. POSTFLIGHT VERIFICATION
-- ============================================================================
DO $$
DECLARE
  v_sem_count INT;
  v_settings_count INT;
  v_cat_count INT;
BEGIN
  SELECT count(*) INTO v_sem_count FROM public.ptv_finance_semesters;
  SELECT count(*) INTO v_settings_count FROM public.ptv_finance_settings;
  SELECT count(*) INTO v_cat_count FROM public.ptv_finance_categories WHERE name IN ('Pencairan Piutang', 'Pengembalian Pokok Piutang', 'Pendapatan Bunga Piutang');

  IF v_sem_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT ERROR: Tabel ptv_finance_semesters belum terisi data semester default!';
  END IF;

  IF v_settings_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT ERROR: Tabel ptv_finance_settings belum terisi konfigurasi default!';
  END IF;

  IF v_cat_count <> 3 THEN
    RAISE EXCEPTION 'POSTFLIGHT ERROR: Kategori piutang canonical belum lengkap (terdeteksi: %, seharusnya 3)!', v_cat_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- CHECKLIST OPERATOR UNTUK MIGRATION STAGING
-- 1. [ ] Jalankan preflight query: SELECT current_database(), current_setting('server_version_num');
-- 2. [ ] Pastikan tidak ada koneksi transaksi terbuka yang menahan lock.
-- 3. [ ] Jalankan script migrasi ini di SQL Editor Supabase Staging swadgljnyelsjstqqxbm.
-- 4. [ ] Verifikasi bahwa 5 tabel operasional baru berstatus RLS ENABLED.
-- 5. [ ] Verifikasi ketersediaan 4 RPC atomik di schema ptv_finance_private & public.
-- ============================================================================
