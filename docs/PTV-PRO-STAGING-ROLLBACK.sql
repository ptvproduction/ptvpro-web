-- ============================================================================
-- PTV PRO — STAGING MIGRATION FULL ROLLBACK & RESTORATION SCRIPT
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status         : STRICTLY STAGING ONLY — DETERMINISTIC RESTORATION SCRIPT
-- ============================================================================
-- Skrip ini memulihkan database Staging ke keadaan SEBELUM DDL & MIGRASI:
-- 1. Menghapus seluruh record hasil import batch migrasi pada tabel canonical.
-- 2. Memulihkan baseline seed data Staging eksisting (Inventaris test & unit).
-- 3. Menghapus seluruh tabel baru legacy_archive_* dan legacy_archive_unresolved.
-- 4. Mengembalikan struktur kolom patch ptv_catatan dan ptv_nilai_inventaris.
-- 5. Menjamin tabel identitas (canonical_identity, RBAC) TETAP UTUH.
-- ============================================================================

BEGIN;

-- ============================================================================
-- ANTI-PRODUCTION SAFETY GUARD
-- ============================================================================
DO $$
DECLARE
    v_has_prod_tables BOOLEAN;
    v_has_staging_seed BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')
    ) INTO v_has_prod_tables;

    IF v_has_prod_tables THEN
        RAISE EXCEPTION 'FATAL: Terdeteksi tabel fisik Production. Skrip ROLLBACK ini HANYA untuk database STAGING!';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.canonical_identity 
        WHERE full_name ILIKE '%Staging%'
    ) INTO v_has_staging_seed;

    IF NOT v_has_staging_seed THEN
        RAISE EXCEPTION 'SAFETY GUARD: Identitas benih Staging tidak ditemukan. Target bukan database Staging yang sah!';
    END IF;

    RAISE NOTICE 'SAFETY GUARD PASSED: Target terverifikasi database Staging.';
END $$;

-- ============================================================================
-- 1. BERSIHKAN DATA MIGRASI PADA TABEL CANONICAL OPERASIONAL
-- (Hapus record migrasi dengan mempertahankan data seed Staging)
-- ============================================================================
-- A. Nilai Inventaris: Kosongkan (karena baseline awal Staging bernilai 0 baris)
TRUNCATE TABLE public.ptv_nilai_inventaris CASCADE;

-- B. Inventaris Unit: Hapus data migrasi, sisakan/restore unit seed Staging
DELETE FROM public.ptv_inventaris_unit 
WHERE kode_unit NOT IN ('STG-INV-001-U1', 'STG-INV-001-U2');

-- C. Inventaris: Hapus data migrasi, sisakan item seed Staging
DELETE FROM public.ptv_inventaris 
WHERE kode NOT IN ('STG-INV-001');

-- D. Kosongkan tabel operasional yang baseline awalnya 0 baris di Staging
TRUNCATE TABLE public.ptv_catatan CASCADE;
TRUNCATE TABLE public.ptv_acara CASCADE;
TRUNCATE TABLE public.ptv_content_planner CASCADE;
TRUNCATE TABLE public.ptv_pengumuman CASCADE;
TRUNCATE TABLE public.ptv_kontak_eksternal CASCADE;
TRUNCATE TABLE public.ptv_pemasukan CASCADE;
TRUNCATE TABLE public.ptv_pengeluaran CASCADE;
TRUNCATE TABLE public.ptv_surat_izin CASCADE;
TRUNCATE TABLE public.ptv_peminjaman CASCADE;
TRUNCATE TABLE public.ptv_lapor_masalah CASCADE;
TRUNCATE TABLE public.ptv_kas_kru CASCADE;
TRUNCATE TABLE public.ptv_kas_periode CASCADE;

-- ============================================================================
-- 2. DROP TABEL-TABEL ARSIP LEGACY & KARANTINA BARU
-- ============================================================================
DROP TABLE IF EXISTS public.legacy_archive_kru CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_aset CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_request_aset CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_konten CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_galeri CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_ebook CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_portfolio CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_tugas CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_riwayat_tugas CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_update CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_izin CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_pendaftar CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_kas_kru CASCADE;
DROP TABLE IF EXISTS public.legacy_archive_unresolved CASCADE;
DROP TABLE IF EXISTS public.migration_log CASCADE;

-- ============================================================================
-- 3. RESTORE SEED DATA STAGING KE KONDISI PERSIS SEBELUM MIGRASI
-- ============================================================================
-- Pastikan item inventaris benih Staging ada
INSERT INTO public.ptv_inventaris (id, kode, nama_alat, kategori, spesifikasi, harga_beli, sumber_perolehan, created_at, updated_at)
VALUES (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'STG-INV-001',
    'Sony FX3 Cinema Line (Staging Test)',
    'Kamera',
    'Kamera cinema full-frame untuk pengujian staging',
    45000000,
    'Pengadaan Staging',
    '2026-10-14 10:30:00+00',
    '2026-10-14 10:30:00+00'
) ON CONFLICT (kode) DO UPDATE SET
    nama_alat = EXCLUDED.nama_alat,
    updated_at = now();

-- Pastikan unit benih Staging ada
INSERT INTO public.ptv_inventaris_unit (id, inventaris_id, kode_unit, nama_unit, nomor_seri, kondisi, status_peminjaman, lokasi_penyimpanan, created_at, updated_at)
VALUES 
(
    'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'STG-INV-001-U1',
    'Sony FX3 Body Only Unit 1',
    'SN-FX3-STG-001',
    'bagus',
    'tersedia',
    'Lemari A-1 Staging',
    '2026-10-14 10:30:00+00',
    '2026-10-14 10:30:00+00'
),
(
    'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f',
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    'STG-INV-001-U2',
    'Sony FX3 Body Only Unit 2',
    'SN-FX3-STG-002',
    'bagus',
    'tersedia',
    'Lemari A-1 Staging',
    '2026-10-14 10:30:00+00',
    '2026-10-14 10:30:00+00'
) ON CONFLICT (kode_unit) DO NOTHING;

-- ============================================================================
-- 4. VERIFIKASI KEUTUHAN IDENTITAS & RBAC STAGING (WAJIB 2 AKUN ASLI)
-- ============================================================================
DO $$
DECLARE
    v_canonical_count INTEGER;
    v_user_account_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_canonical_count FROM public.canonical_identity;
    SELECT COUNT(*) INTO v_user_account_count FROM public.user_account;

    IF v_canonical_count <> 2 OR v_user_account_count <> 2 THEN
        RAISE EXCEPTION 'ROLLBACK VERIFICATION FAILED: Jumlah canonical_identity (%) atau user_account (%) tidak sesuai baseline 2 akun!', v_canonical_count, v_user_account_count;
    END IF;

    RAISE NOTICE 'ROLLBACK BERHASIL: Database Staging telah pulih 100%% ke keadaan awal sebelum migrasi.';
END $$;

COMMIT;
