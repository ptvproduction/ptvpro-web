-- ============================================================================
-- PTV PRO — RECONCILIATION SCHEMA PATCH DRAFT (STAGING ONLY) — REVISION 4
-- File: docs/PTV-PRO-RECONCILIATION-SCHEMA-PATCH-DRAFT.sql
-- Target Database: Supabase Cloud Staging (swadgljnyelsjstqqxbm)
-- Status: STRICTLY DRAFT / NON-EXECUTED — MENUNGGU PERSETUJUAN OPERATOR
-- Audit Rujukan: PTV-DEV-086, PTV-DEV-089, PTV-DEV-091 & Safety Corrections Revision 4
-- ============================================================================
-- Ringkasan Koreksi Keselamatan Revisi 4:
-- 1. [KLARIFIKASI IDENTITAS TARGET DATABASE]:
--    Menegaskan bahwa parameter 'app.target_project_ref' BUKANLAH mekanisme verifikasi
--    identitas database otomatis/kriptografis, melainkan sekadar parameter konfirmasi
--    manual sesi. Operator WAJIB memverifikasi target project ref (swadgljnyelsjstqqxbm)
--    secara eksternal dari konfigurasi koneksi tepercaya (host: db.swadgljnyelsjstqqxbm.supabase.co,
--    database connection URI, atau environment variable) SEBELUM menjalankan script.
--    Guard fail-closed di dalam SQL dipertahankan sebagai lapisan pertahanan kedua (defense-in-depth).
-- 2. [ELIMINASI DROP COLUMN OTOMATIS SAAT ROLLBACK]:
--    Menghapus skrip otomatisasi DROP COLUMN. Menggantinya dengan panduan tata kelola:
--    mencatat kolom apa saja yang dibuat patch, mewajibkan pemeriksaan dependensi
--    (views, trigger, foreign keys, fungsi, query aplikasi), memeriksa perubahan
--    data sesudah migrasi, serta mewajibkan persetujuan tertulis operator sebelum
--    penghapusan kolom skema.
-- 3. [PRESERVASI INVENTARIS DDL]: Menjamin wadah field brand (VARCHAR(64)), model (VARCHAR(64)),
--    keterangan (TEXT), dan aset_id_lama (VARCHAR(64) string UUID) tersedia secara aditif.
-- 4. [PRESERVASI UNIT FISIK DDL]: Menambahkan kedua kolom catatan TEXT dan keterangan TEXT.
-- 5. [PRESERVASI SURAT IZIN DDL]: Menambahkan kolom santri_list JSONB.
-- 6. [STATUS KETAT]: STRICTLY REVIEW-ONLY / BLOCKED. Tidak ada mutasi DDL/DML yang dieksekusi.
-- ============================================================================

-- ============================================================================
-- PRASYARAT KONEKSI EKSTERNAL & KONFIRMASI SESI:
-- 1. Verifikasi Host Eksternal (DI LUAR SQL):
--    Pastikan client SQL (psql, DBeaver, TablePlus, atau Supabase Studio) terhubung
--    ke endpoint resmi Staging:
--    Host: db.swadgljnyelsjstqqxbm.supabase.co
--    Project Ref: swadgljnyelsjstqqxbm
-- 2. Konfigurasi Sesi Manual di dalam transaksi:
--    SET LOCAL app.target_project_ref = 'swadgljnyelsjstqqxbm';
--    SET LOCAL app.confirm_staging_reconciliation = 'STAGING_CONFIRMED';
-- ============================================================================

BEGIN;

-- ============================================================================
-- ANTI-PRODUCTION MULTI-FACTOR SAFETY GUARD & MANUAL CONFIRMATION CHECK
-- ============================================================================
DO $$
DECLARE
    v_target_ref TEXT;
    v_safety_override TEXT;
    v_has_prod_legacy_tables BOOLEAN;
    v_has_canonical_identity BOOLEAN;
BEGIN
    -- 1. Konfirmasi Manual Target Project Ref (Fail-Closed Barrier)
    -- CATATAN: Ini adalah konfirmasi manual sesi, BUKAN bukti identitas host.
    -- Keabsahan host wajib dipastikan dari parameter koneksi sebelum script dijalankan.
    BEGIN
        v_target_ref := current_setting('app.target_project_ref', true);
    EXCEPTION WHEN OTHERS THEN
        v_target_ref := NULL;
    END;

    IF v_target_ref IS NULL OR v_target_ref IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN
        RAISE EXCEPTION 'FATAL SAFETY VIOLATION: Konfirmasi manual app.target_project_ref tidak disetel ke swadgljnyelsjstqqxbm (Ditemukan: %). Operator wajib menyetel: SET LOCAL app.target_project_ref = ''swadgljnyelsjstqqxbm''; setelah memverifikasi host koneksi eksternal!', coalesce(v_target_ref, 'NULL');
    END IF;

    -- 2. Verifikasi Token Konfirmasi Sesi (Fail-Closed Barrier)
    BEGIN
        v_safety_override := current_setting('app.confirm_staging_reconciliation', true);
    EXCEPTION WHEN OTHERS THEN
        v_safety_override := NULL;
    END;

    IF v_safety_override IS NULL OR v_safety_override IS DISTINCT FROM 'STAGING_CONFIRMED' THEN
        RAISE EXCEPTION 'FATAL SAFETY VIOLATION: Token konfirmasi app.confirm_staging_reconciliation tidak disetel ke STAGING_CONFIRMED (Ditemukan: %). Operator wajib menyetel: SET LOCAL app.confirm_staging_reconciliation = ''STAGING_CONFIRMED''; sebelum menjalankan script!', coalesce(v_safety_override, 'NULL');
    END IF;

    -- 3. Verifikasi Nama Database Aktif
    IF current_database() IS DISTINCT FROM 'postgres' THEN
        RAISE EXCEPTION 'FATAL SAFETY VIOLATION: Nama database aktif adalah %, bukan postgres!', current_database();
    END IF;

    -- 4. Negative Structural Check: Tabel fisik legacy Production DILARANG ADA di public schema
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')
    ) INTO v_has_prod_legacy_tables;

    IF v_has_prod_legacy_tables THEN
        RAISE EXCEPTION 'FATAL ANTI-PRODUCTION BARRIER: Terdeteksi tabel fisik Production aktif (ptv_ebook/ptv_aset/ptv_pendaftar). Database ini terindikasi PRODUCTION (jthzuhkblxcaohiuypqq)! Eksekusi DIBATALKAN SEKETIKA.';
    END IF;

    -- 5. Positive Structural Check: canonical_identity harus ada sebagai penanda arsitektur Staging
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'canonical_identity'
    ) INTO v_has_canonical_identity;

    IF NOT v_has_canonical_identity THEN
        RAISE EXCEPTION 'FATAL SAFETY VIOLATION: Tabel canonical_identity tidak ditemukan. Struktur target tidak memenuhi arsitektur PTVPRO Staging!';
    END IF;

    RAISE NOTICE 'SAFETY GUARD PASSED: Seluruh guard pertahanan struktural lolos secara fail-closed.';
END $$;

-- ============================================================================
-- 1. INVENTARIS MASTER (public.ptv_inventaris) — ADDITIVE COLUMNS
-- ============================================================================
-- Menambahkan wadah atribut historis dari MySQL/Production tanpa mengubah tipe data existing.
-- PENTING: aset_id_lama adalah VARCHAR(64) untuk menampung format UUID 36-karakter legacy.
ALTER TABLE public.ptv_inventaris
    ADD COLUMN IF NOT EXISTS brand VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS model VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS keterangan TEXT NULL,
    ADD COLUMN IF NOT EXISTS aset_id_lama VARCHAR(64) NULL;

COMMENT ON COLUMN public.ptv_inventaris.brand IS 'Merk/Brand produsen alat (misal: Sony, Godox, Canon) — 100 record terisi di Production';
COMMENT ON COLUMN public.ptv_inventaris.model IS 'Model spesifik alat (misal: FX3, SL60W) — 31 record terisi di Production';
COMMENT ON COLUMN public.ptv_inventaris.keterangan IS 'Catatan operasional dan kondisi umum studio warisan legacy — 143 record terisi di Production';
COMMENT ON COLUMN public.ptv_inventaris.aset_id_lama IS 'ID referensi aset pada database legacy (string UUID 36-karakter) — 150 record terisi di Production';

-- ============================================================================
-- 2. INVENTARIS UNIT FISIK (public.ptv_inventaris_unit) — ADDITIVE COLUMNS
-- ============================================================================
-- Memisahkan 'catatan' (riwayat fisik/kerusakan) dan 'keterangan' (keterangan operasional)
-- sebagai dua entitas terpisah untuk mempertahankan keduanya tanpa reduksi data.
ALTER TABLE public.ptv_inventaris_unit
    ADD COLUMN IF NOT EXISTS catatan TEXT NULL,
    ADD COLUMN IF NOT EXISTS keterangan TEXT NULL;

COMMENT ON COLUMN public.ptv_inventaris_unit.catatan IS 'Catatan histori fisik khusus unit (misal riwayat kerusakan/insiden pada 2 unit fisik)';
COMMENT ON COLUMN public.ptv_inventaris_unit.keterangan IS 'Keterangan kondisi operasional spesifik per unit fisik';

-- ============================================================================
-- 3. SURAT IZIN SANTRI (public.ptv_surat_izin) — ADDITIVE COLUMN
-- ============================================================================
-- Menyimpan array terstruktur data santri rombongan (kamar, kelas, murobbi, dll)
ALTER TABLE public.ptv_surat_izin
    ADD COLUMN IF NOT EXISTS santri_list JSONB NULL;

COMMENT ON COLUMN public.ptv_surat_izin.santri_list IS 'Array JSON daftar santri lengkap rombongan izin (kamar, kelas, murobbi, angkatan, dll)';

-- ============================================================================
-- 4. KONTINJENSI CONTENT PLANNER / MOMENTUM (MEMERLUKAN KEPUTUSAN OPERATOR)
-- ============================================================================
-- CATATAN KEAMANAN ARSITEKTURAL:
-- Relaksasi constraint ''ALTER COLUMN platform DROP NOT NULL'' TIDAK DIJALANKAN SECARA OTOMATIS
-- demi melindungi integritas aturan penerbitan konten publikasi.
-- Rekomendasi Utama: Pertahankan 2 momentum kalender tanpa platform di dalam
-- tabel arsip karantina (legacy_archive_unresolved) sampai skema dedicated momentum disetujui.
--
-- JIKA DAN HANYA JIKA Operator menyetujui fungsi ganda ptv_content_planner
-- untuk momentum kalender, blok di bawah ini dapat diaktifkan:
/*
-- BLOK KONTINJENSI (HANYA DENGAN PERSETUJUAN TERTULIS OPERATOR):
ALTER TABLE public.ptv_content_planner
    ALTER COLUMN platform DROP NOT NULL;

ALTER TABLE public.ptv_content_planner
    ADD COLUMN IF NOT EXISTS kategori VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS subkategori VARCHAR(64) NULL;

COMMENT ON COLUMN public.ptv_content_planner.kategori IS 'Kategori momentum kalender (Event Hijriyah, Event Masehi, dll)';
COMMENT ON COLUMN public.ptv_content_planner.subkategori IS 'Subkategori atau channel publikasi opsional';
*/

COMMIT;

-- ============================================================================
-- KEBIJAKAN & TATA KELOLA ROLLBACK SKEMA DDL (REVISION 4):
-- ============================================================================
-- PENTING: DILARANG MELAKUKAN DROP COLUMN SECARA OTOMATIS!
--
-- 1. Daftar Kolom yang Dibuat oleh Patch Ini:
--    a. public.ptv_inventaris:
--       - brand VARCHAR(64) NULL
--       - model VARCHAR(64) NULL
--       - keterangan TEXT NULL
--       - aset_id_lama VARCHAR(64) NULL
--    b. public.ptv_inventaris_unit:
--       - catatan TEXT NULL
--       - keterangan TEXT NULL
--    c. public.ptv_surat_izin:
--       - santri_list JSONB NULL
--
-- 2. Prasyarat Wajib Sebelum Melakukan Penghapusan Kolom:
--    a. Dependensi Skema: Periksa apakah ada VIEWS, TRIGGERS, FUNCTIONS, INDEXES,
--       atau FOREIGN KEYS yang bergantung pada kolom-kolom di atas.
--    b. Dependensi Aplikasi: Periksa apakah kode frontend atau backend API
--       (misal inventarisService, perizinanService) telah membaca atau menulis
--       ke kolom-kolom ini.
--    c. Audit Data Post-Migrasi: Periksa apakah ada data baru yang ditambahkan
--       oleh pengguna/kru ke kolom-kolom ini setelah migrasi selesai. Menghapus
--       kolom akan memusnahkan data baru tersebut secara permanen!
--    d. Persetujuan Tertulis: Penghapusan kolom WAJIB memperoleh persetujuan
--       tertulis eksplisit dari Operator Zidna.
--
-- 3. Panduan Eksekusi Rollback Manual (Hanya Jika Seluruh Prasyarat di Atas Terpenuhi):
--    Jika dan hanya jika operator telah memverifikasi ketiadaan dependensi dan
--    memutuskan untuk mencabut kolom-kolom aditif:
--
--    BEGIN;
--    ALTER TABLE public.ptv_inventaris
--        DROP COLUMN IF EXISTS brand,
--        DROP COLUMN IF EXISTS model,
--        DROP COLUMN IF EXISTS keterangan,
--        DROP COLUMN IF EXISTS aset_id_lama;
--
--    ALTER TABLE public.ptv_inventaris_unit
--        DROP COLUMN IF EXISTS catatan,
--        DROP COLUMN IF EXISTS keterangan;
--
--    ALTER TABLE public.ptv_surat_izin
--        DROP COLUMN IF EXISTS santri_list;
--    COMMIT;
-- ============================================================================
