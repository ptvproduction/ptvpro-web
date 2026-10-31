-- ============================================================================
-- PTV PRO — STAGING MIGRATION ADDITIVE PATCH: CATATAN & INV-001 SEED RESOLUTION
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status         : STRICTLY STAGING ONLY — ZERO DESTRUCTIVE OPERATIONS
-- ============================================================================

BEGIN;

-- 1. ENHANCED MULTI-FACTOR SAFETY GUARD (STAGING & PREREQUISITE VALIDATION)
DO $$
DECLARE
    v_has_canonical BOOLEAN;
    v_has_staging_seed BOOLEAN;
    v_has_prod_legacy_tables BOOLEAN;
    v_target_seed_count INTEGER;
    v_target_unit_count INTEGER;
    v_conflict_code_exists BOOLEAN;
BEGIN
    -- 1.1 Positive check: canonical_identity exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'canonical_identity'
    ) INTO v_has_canonical;

    -- 1.2 Positive check: Staging seed identity exists
    SELECT EXISTS (
        SELECT 1 FROM public.canonical_identity 
        WHERE full_name ILIKE '%Staging%'
    ) INTO v_has_staging_seed;

    -- 1.3 Negative check: Physical Production tables must NOT exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')
    ) INTO v_has_prod_legacy_tables;

    IF v_has_prod_legacy_tables THEN
        RAISE EXCEPTION 'FATAL ANTI-PRODUCTION BARRIER: Terdeteksi tabel fisik Production aktif! Eksekusi DIBATALKAN SEKETIKA.';
    END IF;

    IF NOT v_has_canonical OR NOT v_has_staging_seed THEN
        RAISE EXCEPTION 'SAFETY GUARD: Target bukan database PTVPRO Staging yang sah!';
    END IF;

    -- 1.4 Prerequisite check: Pastikan target seed staging tepat 1 master inventaris
    SELECT COUNT(*) FROM public.ptv_inventaris
    WHERE id = '17cd759f-57fc-409d-98ab-14db3f8e5224' AND kode = 'INV-001'
    INTO v_target_seed_count;

    IF v_target_seed_count <> 1 THEN
        RAISE EXCEPTION 'SAFETY GUARD: Target seed staging INV-001 (id: 17cd759f-57fc-409d-98ab-14db3f8e5224) tidak ditemukan atau kondisi awal telah berubah! Ditemukan: %', v_target_seed_count;
    END IF;

    -- 1.5 Prerequisite check: Pastikan tepat 2 unit terhubung ke seed staging
    SELECT COUNT(*) FROM public.ptv_inventaris_unit
    WHERE inventaris_id = '17cd759f-57fc-409d-98ab-14db3f8e5224'
    INTO v_target_unit_count;

    IF v_target_unit_count <> 2 THEN
        RAISE EXCEPTION 'SAFETY GUARD: Jumlah unit seed staging tidak tepat 2 (ditemukan: %). Transaksi dibatalkan.', v_target_unit_count;
    END IF;

    -- 1.6 Prerequisite check: Pastikan kode baru INV-STG-001 belum digunakan
    SELECT EXISTS (
        SELECT 1 FROM public.ptv_inventaris WHERE kode = 'INV-STG-001'
    ) INTO v_conflict_code_exists;

    IF v_conflict_code_exists THEN
        RAISE EXCEPTION 'SAFETY GUARD: Kode INV-STG-001 sudah ada di database Staging!';
    END IF;

    RAISE NOTICE 'SAFETY GUARD PASSED: Lingkungan Staging dan seluruh kondisi awal terverifikasi valid secara presisi.';
END $$;

-- 2. ADDITIVE SCHEMA: Tambah kolom catatan pada ptv_nilai_inventaris
ALTER TABLE public.ptv_nilai_inventaris
    ADD COLUMN IF NOT EXISTS catatan TEXT NULL;

-- 3. ADDITIVE SCHEMA: Tambah kolom metadata_json pada legacy_archive_kru
ALTER TABLE public.legacy_archive_kru
    ADD COLUMN IF NOT EXISTS metadata_json JSONB NULL;

-- 4. RESOLUSI KONFLIK INV-001: Preservasi Ganda (Seed Staging & Data Produksi)
-- Mengubah kode alat uji staging menjadi INV-STG-001 tanpa mengubah UUID asli (17cd759f-57fc-409d-98ab-14db3f8e5224)
-- sehingga unit INV-001 asli dari Production dapat masuk dengan kode canonical INV-001.
UPDATE public.ptv_inventaris_unit
SET kode_unit = REPLACE(kode_unit, 'INV-001-', 'INV-STG-001-')
WHERE inventaris_id = '17cd759f-57fc-409d-98ab-14db3f8e5224';

UPDATE public.ptv_inventaris
SET kode = 'INV-STG-001'
WHERE id = '17cd759f-57fc-409d-98ab-14db3f8e5224' AND kode = 'INV-001';

COMMIT;
