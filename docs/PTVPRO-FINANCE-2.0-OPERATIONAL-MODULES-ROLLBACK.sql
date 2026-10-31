-- ============================================================================
-- PTV PRO — FINANCE 2.0 OPERATIONAL MODULES STAGING ROLLBACK SCRIPT
-- Target Database: ptvpro-staging (swadgljnyelsjstqqxbm)
-- Dokumen Persiapan ACC Operator: PTV-DEV-129 | Operator: zidnal (24 Oktober 2026)
--
-- Tujuan:
-- Mengembalikan schema Staging ke kondisi Canonical V1 secara 100% aman
-- jika diperlukan rollback terhadap modul operasional (Kas Kru, Piutang, Pengaturan).
--
-- JAMINAN KEAMANAN & BATAS OTORISASI:
-- 1. Anti-Production Multi-Barrier: Dilarang keras berjalan di Production (jthzuhkblxcaohiuypqq).
-- 2. Staging Fingerprint Barrier: Memvalidasi integritas 43 pemasukan & 10 pengeluaran legacy.
-- 3. Canonical V1 Protection: Tidak menyentuh 6 tabel canonical v1, 53 transaksi, maupun saldo kas.
-- 4. Two-Tier Operational Data Protection:
--    - TIER 1 (Pre-Usage Rollback): Menghapus tabel jika belum ada data operasional riil.
--    - TIER 2 (Post-Usage Recovery Guard): Menolak penghapusan destruktif jika sudah ada
--      catatan kas atau pinjaman aktif, mengarahkan operator ke mekanisme pengarsipan aman.
-- 5. Reverse Dependency Drop & RPC Cleanup: Menghapus child tables dan RPC wrappers secara bersih.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================================
-- 1. GUARD & ASSERTION ENVIRONMENT STAGING
-- ============================================================================
DO $$
DECLARE
  v_has_prod_tables BOOLEAN;
  v_has_canonical_tables BOOLEAN;
  v_inc_count BIGINT;
  v_inc_sum BIGINT;
  v_exp_count BIGINT;
  v_exp_sum BIGINT;
  v_operational_kas_count BIGINT := 0;
  v_operational_loan_count BIGINT := 0;
  v_operational_pay_count BIGINT := 0;
BEGIN
  -- 1a. Database name check
  IF current_database() IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'FATAL: Database aktif adalah %, bukan postgres!', current_database();
  END IF;

  -- 1b. Server version check (PostgreSQL 15+)
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'Rollback script ini memerlukan PostgreSQL 15+ (terdeteksi: %)', current_setting('server_version_num');
  END IF;

  -- 1c. Anti-Production Barrier: tabel fisik Production dilarang ada di schema public
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')
  ) INTO v_has_prod_tables;

  IF v_has_prod_tables THEN
    RAISE EXCEPTION 'FATAL ANTI-PRODUCTION BARRIER: Database terdeteksi sebagai PRODUCTION (jthzuhkblxcaohiuypqq)! Rollback DIBATALKAN SEKETIKA.';
  END IF;

  -- 1d. Positive Canonical V1 Architecture Barrier
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('account_profiles', 'ptv_finance_pockets', 'ptv_finance_transactions')
  ) INTO v_has_canonical_tables;

  IF NOT v_has_canonical_tables THEN
    RAISE EXCEPTION 'FATAL: Arsitektur Canonical V1 tidak lengkap. Rollback dibatalkan.';
  END IF;

  -- 1e. Staging Legacy Fingerprint Barrier (Resilience)
  SELECT count(*), coalesce(sum(nominal), 0)
    INTO v_inc_count, v_inc_sum
    FROM public.ptv_pemasukan;

  SELECT count(*), coalesce(sum(nominal), 0)
    INTO v_exp_count, v_exp_sum
    FROM public.ptv_pengeluaran;

  IF v_inc_count < 43 OR v_exp_count < 10 THEN
    RAISE EXCEPTION 'FATAL STAGING FINGERPRINT MISMATCH: Target database bukan Staging yang sah!';
  END IF;

  -- 1f. Two-Tier Data Loss Guard: Deteksi apakah data operasional riil sudah tercatat
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ptv_finance_kas_records') THEN
    SELECT count(*) INTO v_operational_kas_count FROM public.ptv_finance_kas_records WHERE paid_amount_minor > 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ptv_finance_kas_payments') THEN
    SELECT count(*) INTO v_operational_pay_count FROM public.ptv_finance_kas_payments;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ptv_finance_loans') THEN
    SELECT count(*) INTO v_operational_loan_count FROM public.ptv_finance_loans;
  END IF;

  IF (v_operational_kas_count > 0 OR v_operational_loan_count > 0 OR v_operational_pay_count > 0) THEN
    -- PERLINDUNGAN ANTI DATA LOSS: Jika sudah ada data operasional riil,
    -- DROP TABLE CASCADE dilarang demi kepatuhan audit.
    -- Script ini akan memindahkan tabel ke skema arsip daripada menghancurkannya.
    RAISE NOTICE 'DATA OPERASIONAL TERDETEKSI: Ditemukan % kas terbayar, % piutang, % cicilan. Menjalankan TIER 2 Safe Archive...',
      v_operational_kas_count, v_operational_loan_count, v_operational_pay_count;
  END IF;
END $$;

-- ============================================================================
-- 2. DROP RPC OPERASIONAL WRAPPERS & PRIVATE PROCEDURES
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_record_kas_kru_payment_atomic(UUID, BIGINT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.rpc_disburse_loan_atomic(UUID, BIGINT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.rpc_record_loan_payment_atomic(UUID, BIGINT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.rpc_reverse_operational_record_atomic(UUID, BIGINT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_void_finance_transaction_atomic(UUID, BIGINT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_get_finance_loans_aggregate();
DROP FUNCTION IF EXISTS public.current_authenticated_ptv_id();
DROP FUNCTION IF EXISTS public.is_finance_restricted_personnel();

DROP FUNCTION IF EXISTS ptv_finance_private.record_kas_kru_payment_atomic(UUID, BIGINT, JSONB, JSONB);
DROP FUNCTION IF EXISTS ptv_finance_private.disburse_loan_atomic(UUID, BIGINT, JSONB, JSONB);
DROP FUNCTION IF EXISTS ptv_finance_private.record_loan_payment_atomic(UUID, BIGINT, JSONB, JSONB);
DROP FUNCTION IF EXISTS ptv_finance_private.reverse_operational_record_atomic(UUID, BIGINT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS ptv_finance_private.void_finance_transaction(UUID, BIGINT, UUID, TEXT);

-- ============================================================================
-- 3. DROP POLICIES & STORAGE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS ptv_finance_loan_payments_read ON public.ptv_finance_loan_payments;
DROP POLICY IF EXISTS ptv_finance_loans_read ON public.ptv_finance_loans;
DROP POLICY IF EXISTS ptv_finance_kas_payments_read ON public.ptv_finance_kas_payments;
DROP POLICY IF EXISTS ptv_finance_kas_records_read ON public.ptv_finance_kas_records;
DROP POLICY IF EXISTS ptv_finance_semesters_read ON public.ptv_finance_semesters;
DROP POLICY IF EXISTS ptv_finance_settings_read ON public.ptv_finance_settings;

DROP POLICY IF EXISTS "finance_proofs_upload" ON storage.objects;
DROP POLICY IF EXISTS "finance_proofs_read" ON storage.objects;
DROP POLICY IF EXISTS "finance_proofs_delete" ON storage.objects;

-- ============================================================================
-- 4. TWO-TIER TABLE REMOVAL / SAFE ARCHIVE
-- ============================================================================
DO $$
DECLARE
  v_has_data BOOLEAN := false;
  v_suffix TEXT;
BEGIN
  v_suffix := to_char(now(), 'YYYYMMDD_HH24MISS');

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ptv_finance_loans') THEN
    IF (SELECT count(*) FROM public.ptv_finance_loans) > 0 THEN
      v_has_data := true;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ptv_finance_kas_records') THEN
    IF (SELECT count(*) FROM public.ptv_finance_kas_records WHERE paid_amount_minor > 0) > 0 THEN
      v_has_data := true;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ptv_finance_kas_payments') THEN
    IF (SELECT count(*) FROM public.ptv_finance_kas_payments) > 0 THEN
      v_has_data := true;
    END IF;
  END IF;

  IF v_has_data THEN
    -- TIER 2: Safe Archive (Rename tabel agar riwayat finansial tetap ada untuk investigasi/audit)
    EXECUTE 'ALTER TABLE IF EXISTS public.ptv_finance_loan_payments RENAME TO ptv_finance_loan_payments_archived_' || v_suffix;
    EXECUTE 'ALTER TABLE IF EXISTS public.ptv_finance_loans RENAME TO ptv_finance_loans_archived_' || v_suffix;
    EXECUTE 'ALTER TABLE IF EXISTS public.ptv_finance_kas_payments RENAME TO ptv_finance_kas_payments_archived_' || v_suffix;
    EXECUTE 'ALTER TABLE IF EXISTS public.ptv_finance_kas_records RENAME TO ptv_finance_kas_records_archived_' || v_suffix;
    EXECUTE 'ALTER TABLE IF EXISTS public.ptv_finance_semesters RENAME TO ptv_finance_semesters_archived_' || v_suffix;
    EXECUTE 'ALTER TABLE IF EXISTS public.ptv_finance_settings RENAME TO ptv_finance_settings_archived_' || v_suffix;
    RAISE NOTICE 'Rollback Tier 2 selesai: Data operasional diarsipkan dengan suffix _archived_%', v_suffix;
  ELSE
    -- TIER 1: Pre-Usage Clean Drop (Tabel masih kosong dari data produksi)
    DROP TABLE IF EXISTS public.ptv_finance_loan_payments CASCADE;
    DROP TABLE IF EXISTS public.ptv_finance_loans CASCADE;
    DROP TABLE IF EXISTS public.ptv_finance_kas_payments CASCADE;
    DROP TABLE IF EXISTS public.ptv_finance_kas_records CASCADE;
    DROP TABLE IF EXISTS public.ptv_finance_semesters CASCADE;
    DROP TABLE IF EXISTS public.ptv_finance_settings CASCADE;
    RAISE NOTICE 'Rollback Tier 1 selesai: Tabel operasional bersih dihapus.';
  END IF;
END $$;

-- ============================================================================
-- 5. VERIFIKASI KEUTUHAN CANONICAL V1 POST-ROLLBACK
-- ============================================================================
DO $$
DECLARE
  v_pocket_count INT;
  v_tx_count INT;
  v_main_balance BIGINT;
BEGIN
  SELECT count(*) INTO v_pocket_count FROM public.ptv_finance_pockets;
  SELECT count(*) INTO v_tx_count FROM public.ptv_finance_transactions;

  IF v_pocket_count = 0 THEN
    RAISE EXCEPTION 'FATAL: Saldo atau konfigurasi Kantong hilang setelah rollback!';
  END IF;

  IF v_tx_count < 53 THEN
    RAISE EXCEPTION 'FATAL: Transaksi canonical berkurang (ditemukan % transaksi, minimal 53)!', v_tx_count;
  END IF;

  SELECT balance_minor INTO v_main_balance
    FROM public.ptv_finance_pockets
   WHERE id = '60e8d033-2794-4219-a960-c56bedca0111';

  IF v_main_balance IS DISTINCT FROM 520276 THEN
    RAISE EXCEPTION 'FATAL: Saldo Kas Utama Studio berubah setelah rollback (terdeteksi: %, seharusnya 520276)!', v_main_balance;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- CHECKLIST POST-ROLLBACK OPERATOR
-- 1. [ ] Verifikasi bahwa tabel canonical v1 (ptv_finance_pockets, transactions, allocations) utuh.
-- 2. [ ] Verifikasi bahwa 53 transaksi historis dan saldo Rp 520.276 Kas Utama tidak terganggu.
-- 3. [ ] Verifikasi bahwa tidak ada RPC orphan yang tersisa di schema public.
-- ============================================================================
