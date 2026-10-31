-- ============================================================================
-- PTV PRO — STAGING CATATAN BERSAMA COMPATIBILITY PATCH (REVISI FINAL)
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status         : STRICTLY STAGING ONLY — IDEMPOTENT DDL
--
-- TUJUAN:
-- Menyelaraskan tabel ptv_catatan di Staging agar mempertahankan seluruh atribut
-- operasional data Production (warna, tipe, tags, identitas penulis legacy)
-- dan kompatibel dengan UI PTVPRO tanpa merusak skema canonical (author_id & kategori).
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENHANCED MULTI-FACTOR SAFETY GUARD (STAGING ONLY)
-- ============================================================================
DO $$
DECLARE
    v_has_canonical BOOLEAN;
    v_has_staging_seed BOOLEAN;
    v_has_prod_legacy_tables BOOLEAN;
BEGIN
    -- 1. Positive check: canonical_identity must exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'canonical_identity'
    ) INTO v_has_canonical;

    -- 2. Positive check: Verify staging-specific seed identity exists
    SELECT EXISTS (
        SELECT 1 FROM public.canonical_identity 
        WHERE full_name ILIKE '%Staging%'
    ) INTO v_has_staging_seed;

    -- 3. Negative check: Physical legacy Production tables MUST NOT exist in public
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')
    ) INTO v_has_prod_legacy_tables;

    IF v_has_prod_legacy_tables THEN
        RAISE EXCEPTION 'FATAL ANTI-PRODUCTION BARRIER: Terdeteksi tabel fisik Production aktif (ptv_ebook/ptv_galeri/ptv_tugas). Database ini adalah PRODUCTION! Eksekusi DIBATALKAN SEKETIKA.';
    END IF;

    IF NOT v_has_canonical THEN
        RAISE EXCEPTION 'SAFETY GUARD: Tabel canonical_identity tidak ditemukan. Target bukan database PTVPRO Staging!';
    END IF;

    IF NOT v_has_staging_seed THEN
        RAISE EXCEPTION 'SAFETY GUARD: Identitas benih Staging tidak ditemukan di canonical_identity. Target bukan database Staging yang sah!';
    END IF;

    RAISE NOTICE 'SAFETY GUARD PASSED: Lingkungan Staging terverifikasi valid secara multi-faktor.';
END $$;

-- 1. Tambah kolom penunjang Catatan Bersama & Notulensi Rapat
ALTER TABLE public.ptv_catatan
    ADD COLUMN IF NOT EXISTS warna VARCHAR(32) NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS tipe VARCHAR(32) NOT NULL DEFAULT 'shared',
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS created_by_id VARCHAR(64) NULL;

-- 2. Pastikan kolom default kategori terpasang dengan baik
ALTER TABLE public.ptv_catatan
    ALTER COLUMN kategori SET DEFAULT 'umum';

-- 3. Indeks performa untuk query Catatan Bersama
CREATE INDEX IF NOT EXISTS idx_ptv_catatan_pinned_updated 
    ON public.ptv_catatan (is_pinned DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ptv_catatan_tipe 
    ON public.ptv_catatan (tipe);

COMMIT;
