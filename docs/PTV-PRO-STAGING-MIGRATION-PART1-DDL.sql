-- ============================================================================
-- PTV PRO — STAGING MIGRATION PART 1: DDL TABEL ARSIP LEGACY & ZERO-LOSS NET
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status         : STRICTLY STAGING ONLY — ZERO SILENT DATA LOSS ARCHITECTURE
--
-- ATURAN KESELAMATAN WAJIB:
-- 1. Anti-Production Barrier: Pengecekan multi-faktor (positif & negatif).
-- 2. Tabel arsip menggunakan prefix legacy_archive_* (terisolasi total dari app).
-- 3. production_id bertipe VARCHAR(64) agar aman menampung integer, bigint, maupun UUID.
-- 4. source_key VARCHAR(128) UNIQUE NOT NULL sebagai jangkar IDEMPOTENCY.
-- 5. ON CONFLICT (source_key) DO NOTHING menjamin re-run aman tanpa duplikasi.
-- 6. PII Masking wajib diterapkan pada email dan kontak.
-- 7. ZERO DATA LOSS: Menyediakan legacy_archive_kas_kru & legacy_archive_unresolved.
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

    -- Evaluasi Keamanan Bertingkat:
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

-- ============================================================================
-- 1. legacy_archive_kru (Arsip seluruh kru Production/legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_kru (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    ptv_id VARCHAR(32),
    full_name VARCHAR(255),
    username VARCHAR(128),
    divisi VARCHAR(128),
    jabatan VARCHAR(128),
    angkatan VARCHAR(32),
    status VARCHAR(64),
    role_legacy VARCHAR(64),
    avatar_url TEXT,
    email_masked VARCHAR(255),
    phone_masked VARCHAR(64),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_kru_source_key ON legacy_archive_kru(source_key);
CREATE INDEX IF NOT EXISTS idx_legacy_archive_kru_ptv_id ON legacy_archive_kru(ptv_id);

-- ============================================================================
-- 2. legacy_archive_aset (Data aset legacy non-inventaris)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_aset (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    kode VARCHAR(64),
    nama VARCHAR(255),
    kategori VARCHAR(128),
    spesifikasi TEXT,
    lokasi VARCHAR(255),
    kondisi VARCHAR(64),
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_aset_source_key ON legacy_archive_aset(source_key);

-- ============================================================================
-- 3. legacy_archive_request_aset (Riwayat permintaan aset legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_request_aset (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    nama_pemohon VARCHAR(255),
    nama_barang VARCHAR(255),
    alasan TEXT,
    status VARCHAR(64),
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_req_aset_source_key ON legacy_archive_request_aset(source_key);

-- ============================================================================
-- 4. legacy_archive_konten (Konten media publikasi legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_konten (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    judul VARCHAR(255),
    kategori VARCHAR(128),
    link_media TEXT,
    deskripsi TEXT,
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_konten_source_key ON legacy_archive_konten(source_key);

-- ============================================================================
-- 5. legacy_archive_galeri (Dokumentasi foto/galeri legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_galeri (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    judul VARCHAR(255),
    album VARCHAR(128),
    foto_url TEXT,
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_galeri_source_key ON legacy_archive_galeri(source_key);

-- ============================================================================
-- 6. legacy_archive_ebook (Buku panduan & SOP legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_ebook (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    judul VARCHAR(255),
    penulis VARCHAR(255),
    kategori VARCHAR(128),
    file_url TEXT,
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_ebook_source_key ON legacy_archive_ebook(source_key);

-- ============================================================================
-- 7. legacy_archive_portfolio (Portofolio karya liputan legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_portfolio (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    judul VARCHAR(255),
    klien VARCHAR(255),
    kategori VARCHAR(128),
    tahun VARCHAR(16),
    link_portfolio TEXT,
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_portfolio_source_key ON legacy_archive_portfolio(source_key);

-- ============================================================================
-- 8. legacy_archive_tugas (Manajemen tugas penugasan kru legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_tugas (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    nama_tugas VARCHAR(255),
    kru_penanggung_jawab VARCHAR(255),
    deadline DATE,
    status_tugas VARCHAR(64),
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_tugas_source_key ON legacy_archive_tugas(source_key);

-- ============================================================================
-- 9. legacy_archive_riwayat_tugas (Log riwayat penyelesaian tugas legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_riwayat_tugas (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    tugas_id VARCHAR(64),
    status_sebelumnya VARCHAR(64),
    status_baru VARCHAR(64),
    catatan_perubahan TEXT,
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_riw_tugas_source_key ON legacy_archive_riwayat_tugas(source_key);

-- ============================================================================
-- 10. legacy_archive_update (Changelog & update sistem portal legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_update (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    versi VARCHAR(32),
    catatan_rilis TEXT,
    tanggal_rilis DATE,
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_update_source_key ON legacy_archive_update(source_key);

-- ============================================================================
-- 11. legacy_archive_izin (Permohonan izin kru legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_izin (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    nama_kru VARCHAR(255),
    alasan_izin TEXT,
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    status_approval VARCHAR(64),
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_izin_source_key ON legacy_archive_izin(source_key);

-- ============================================================================
-- 12. legacy_archive_pendaftar (Data pendaftar rekruitmen kru legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_pendaftar (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    nama VARCHAR(255),
    divisi_pilihan VARCHAR(128),
    angkatan VARCHAR(32),
    email_masked VARCHAR(255),
    telepon_masked VARCHAR(64),
    status_seleksi VARCHAR(64),
    metadata_json JSONB NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_pendaftar_source_key ON legacy_archive_pendaftar(source_key);

-- ============================================================================
-- 13. legacy_archive_kas_kru (Preservasi Data 38 Kas Kru Production)
-- Menyimpan riwayat iuran kru legacy secara utuh tanpa FK blocking
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_kas_kru (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(128) NOT NULL UNIQUE,
    production_id VARCHAR(64),
    kru_id VARCHAR(64),
    kru_ptv_id VARCHAR(32),
    kru_nama VARCHAR(255),
    periode_bulan VARCHAR(32),
    tagihan NUMERIC(15,2) DEFAULT 0,
    dibayar NUMERIC(15,2) DEFAULT 0,
    sisa NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(64),
    tanggal_bayar VARCHAR(32),
    metode_bayar VARCHAR(64),
    catatan TEXT,
    bukti_url TEXT,
    dicatat_oleh_id VARCHAR(64),
    dicatat_oleh_nama VARCHAR(255),
    reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'pending_identity', -- ('reconciled', 'pending_identity', 'unlinked')
    canonical_identity_id UUID NULL REFERENCES canonical_identity(id),
    raw_payload JSONB NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_kas_kru_source_key ON legacy_archive_kas_kru(source_key);
CREATE INDEX IF NOT EXISTS idx_legacy_archive_kas_kru_status ON legacy_archive_kas_kru(reconciliation_status);

-- ============================================================================
-- 14. legacy_archive_unresolved (Zero-Loss Quarantine Net)
-- Menampung setiap record dari tabel mana pun yang memiliki anomali FK
-- ============================================================================
CREATE TABLE IF NOT EXISTS legacy_archive_unresolved (
    quarantine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table VARCHAR(64) NOT NULL,
    source_id VARCHAR(128) NOT NULL,
    reason TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_unresolved_source UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_unresolved_table ON legacy_archive_unresolved(source_table);

-- ============================================================================
-- 15. ptv_catatan Compatibility Patch (Catatan Bersama & Notulensi Rapat)
-- ============================================================================
ALTER TABLE public.ptv_catatan
    ADD COLUMN IF NOT EXISTS warna VARCHAR(32) NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS tipe VARCHAR(32) NOT NULL DEFAULT 'shared',
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS created_by_id VARCHAR(64) NULL;

ALTER TABLE public.ptv_catatan
    ALTER COLUMN kategori SET DEFAULT 'umum';

CREATE INDEX IF NOT EXISTS idx_ptv_catatan_pinned_updated 
    ON public.ptv_catatan (is_pinned DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ptv_catatan_tipe 
    ON public.ptv_catatan (tipe);

-- ============================================================================

-- ============================================================================
-- 15b. ptv_nilai_inventaris Compatibility Patch (Preservasi Penuh Metadata)
-- ============================================================================
ALTER TABLE public.ptv_nilai_inventaris
    ADD COLUMN IF NOT EXISTS vendor VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS nomor_invoice VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS sumber_perolehan VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(64) NOT NULL DEFAULT 'Aktif',
    ADD COLUMN IF NOT EXISTS nilai_residu NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dokumen_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(128) NULL;

-- 16. migration_log (Audit trail mutasi data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS migration_log (
    id BIGSERIAL PRIMARY KEY,
    batch_name VARCHAR(64) NOT NULL,
    source_table VARCHAR(64) NOT NULL,
    target_table VARCHAR(64) NOT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    migrated_records INTEGER NOT NULL DEFAULT 0,
    skipped_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    execution_status VARCHAR(32) NOT NULL DEFAULT 'completed'
        CHECK (execution_status IN ('pending', 'running', 'completed', 'partial', 'failed')),
    notes TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- 17. Security: Enable RLS on all archive tables
-- ============================================================================
ALTER TABLE legacy_archive_kru ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_aset ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_request_aset ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_konten ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_galeri ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_ebook ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_riwayat_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_update ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_izin ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_pendaftar ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_kas_kru ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_archive_unresolved ENABLE ROW LEVEL SECURITY;

COMMIT;
