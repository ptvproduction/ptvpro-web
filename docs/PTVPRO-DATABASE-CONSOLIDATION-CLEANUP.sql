-- ============================================================================
-- PTV PRO — DATABASE CONSOLIDATION & CLEANUP SCRIPT (PTV-DEV-229 SAFE ISOLATED)
-- Target Project: swadgljnyelsjstqqxbm (PostgreSQL / Supabase Cloud)
-- Mode: Safe Targeted Cleanup (Zero DROP CASCADE, Zero Data Loss)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP TESTING & DUPLICATE VIEWS / RPC
-- ----------------------------------------------------------------------------

-- Drop view ptv_kru_legacy_compat (view kompatibilitas lama yang tidak lagi dipakai)
DROP VIEW IF EXISTS public.ptv_kru_legacy_compat;

-- Drop RPC testing inventory 171
DROP FUNCTION IF EXISTS public.rpc_inventory_test171();

-- ----------------------------------------------------------------------------
-- 2. DROP VERIFIED ISOLATED EMPTY TABLES (0 ROWS & TANPA DEPENDENSI ASING)
-- Seluruh tabel di bawah ini terbukti 0 baris dan tidak memiliki relasi foreign key dari tabel lain.
-- ----------------------------------------------------------------------------

-- Tabel WordPress & Legacy Archive Kosong (0 baris, tanpa dependensi)
DROP TABLE IF EXISTS public.legacy_archive_catatan_bersama;
DROP TABLE IF EXISTS public.legacy_archive_izin;
DROP TABLE IF EXISTS public.legacy_archive_galeri;
DROP TABLE IF EXISTS public.legacy_archive_konten;
DROP TABLE IF EXISTS public.legacy_archive_portfolio;
DROP TABLE IF EXISTS public.legacy_archive_request_aset;
DROP TABLE IF EXISTS public.legacy_archive_riwayat_tugas;
DROP TABLE IF EXISTS public.legacy_archive_tugas;
DROP TABLE IF EXISTS public.legacy_archive_update;
DROP TABLE IF EXISTS public.migration_log;

-- Tabel Testing & Auth Kosong (0 baris, tanpa dependensi)
DROP TABLE IF EXISTS public.identity_contact;
DROP TABLE IF EXISTS public.ptv_login_history;
DROP TABLE IF EXISTS public.ptv_push_subscriptions;
DROP TABLE IF EXISTS public.ptv_acara_rundown;
DROP TABLE IF EXISTS public.ptv_portal_announcements;

-- Tabel Kas Kru Legacy Kosong (0 baris, tanpa dependensi)
DROP TABLE IF EXISTS public.ptv_kas_kru;
DROP TABLE IF EXISTS public.ptv_kas_periode;

-- ----------------------------------------------------------------------------
-- 3. TABEL YANG TETAP DIPERTAHANKAN (SAFETY & HISTORICAL INTEGRITY)
-- Tabel di bawah ini DILARANG DIHAPUS demi menjaga integritas data dan dependensi:
-- - ptv_keuangan             (Dipertahankan karena dirujuk foreign key ptv_pemasukan & ptv_pengeluaran)
-- - ptv_pemasukan            (43 baris histori pemasukan)
-- - ptv_pengeluaran          (10 baris histori pengeluaran)
-- - legacy_archive_kru       (94 baris: arsip lengkap data kru & audit trail)
-- - legacy_archive_kas_kru   (38 baris: arsip pembayaran kas kru historis)
-- - legacy_archive_aset      (75 baris: arsip inventaris aset legacy)
-- - legacy_archive_unresolved (49 baris: arsip data rekonsiliasi)
-- - auth_credentials        (3 baris: kredensial auth & Google subject OAuth)
-- ----------------------------------------------------------------------------

-- ============================================================================
-- VERIFIKASI KEBERSIHAN STRUKTUR DATABASE POST-CLEANUP
-- ============================================================================
SELECT 
  (SELECT count(*) FROM public.canonical_identity) AS total_canonical_identities,
  (SELECT count(*) FROM public.organization_membership) AS total_organization_memberships,
  (SELECT count(*) FROM public.user_account) AS total_user_accounts,
  (SELECT count(*) FROM public.ptv_finance_transactions) AS total_finance_transactions,
  (SELECT count(*) FROM public.ptv_inventaris) AS total_inventaris,
  (SELECT count(*) FROM public.ptv_inventaris_unit) AS total_inventaris_units;
