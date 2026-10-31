-- SUPERSEDED: gunakan supabase/migrations/20261029091743_annual_letter_numbering.sql.
-- Aturan operator 29 Oktober 2026: max + 1 per jenis/tahun; proposal gap-filling ini tidak untuk dieksekusi.
-- ============================================================================
-- PTVPRO — OFFICIAL LETTER NUMBERING ATOMIC GAP-FILLING PROPOSAL (REV 11)
-- Workspace: PTVPRO / PTV HUB
-- Environment: Supabase Staging (swadgljnyelsjstqqxbm) & Production
-- Status: DRAFT / PENDING OPERATOR ACC (DO NOT EXECUTE WITHOUT OPERATOR ACC)
-- URUTAN MIGRASI: STEP 2 (WAJIB DIJALANKAN SETELAH PTVPRO-SMART-NOTIFICATIONS-SCHEMA-DRAFT.sql)
-- ============================================================================
--
-- 1. LATAR BELAKANG & KETENTUAN OPERATOR (RELEASE-GATE FINAL CORRECTIONS REV 11)
--    Nomor Surat Izin yang telah diterbitkan pada periode 2026:
--      - 001/SI-PTV/X/2026 (Staging record otentik: id ff305b4f-0c0e-4abc-9da9-2556bdb1743c)
--      - 007/SI-PTV/X/2026 (Staging record otentik: id ea91b82d-ff86-41dc-bc87-d29c1a7f09f5)
--      - 009/SI-PTV/X/2026 (Terbit secara eksternal/offline - dikonfirmasi Operator)
--    Nomor historis resmi yang disinkronkan dari legacy selama masa transisi
--    wajib direkonsiliasi dan dilindungi di dalam registry permanen.
--
--    ATURAN UTAMA ALOKASI (DYNAMIC GAP-FILLING / SMALLEST AVAILABLE POSITIVE SEQUENCE):
--    "Gunakan nomor positif terkecil yang belum pernah diterbitkan dalam scope
--    jenis surat dan periode penomoran yang berlaku, dengan mempertimbangkan seluruh
--    riwayat legacy yang telah direkonsiliasi."
--    Alokasi penomoran bersifat dinamis dan tidak bergantung pada asumsi statis 002.
--    Jika selama masa transisi legacy menerbitkan nomor surat baru, sistem kanonikal
--    menghitung celah terkecil berikutnya secara otomatis dan konsisten.
--
--    BASELINE SURAT TUGAS & SURAT BARANG:
--      - ST (Surat Tugas): Baseline bersih = 0 (Surat perdana mulai dari 001/ST-PTV/X/2026 jika belum ada dari legacy).
--      - SBB (Surat Bukti Barang): Baseline bersih = 0 (Surat perdana mulai dari 001/SBB-PTV/X/2026 jika belum ada dari legacy).
--
-- 2. SASARAN ARSITEKTUR KANONIKAL & SECURITY GATES (REV 10 RELEASE-GATE HARDENING)
--    a. Proteksi RLS & Grants Eksplisit Registry (public.ptv_issued_letter_registry):
--       - RLS diaktifkan (ENABLE ROW LEVEL SECURITY).
--       - Hak akses DML langsung (INSERT, UPDATE, DELETE) DICABUT MUTLAK dari anon dan authenticated.
--       - Pengguna authenticated HANYA memiliki hak SELECT melalui RLS policy.
--       - Fungsi approval 'approve_ptv_document_atomic' berstatus SECURITY DEFINER
--         dengan pemilik 'postgres' (table owner), menjamin penulisan nomor surat
--         ke registry tetap berhasil secara atomik tanpa terhalang RLS.
--    b. Dependensi Migrasi Step 1 -> Step 2: Preflight assertion memverifikasi
--       ketersediaan recipient_identity_id pada ptv_notifications.
--    c. Sinkronisasi Registry Universal & NULL-Safe (SI, ST, SBB):
--       - Seluruh perbandingan atribut menggunakan operator 'IS DISTINCT FROM'
--         sehingga aman terhadap nilai NULL dan mendeteksi selisih secara akurat.
--       - Setiap anomali atribut, nomor, tahun, atau doc_id seketika menghentikan migrasi (HALT).
--    d. Validasi Format Nomor Surat Lengkap (Format Guard):
--       - Memvalidasi 4 segmen kanonikal: XXX / TAG / BULAN_ROMAWI / TAHUN.
--       - Sequence 1-9999, tag sesuai jenis dokumen, bulan Romawi I-XII, dan tahun 2000-2099.
--    e. Anti-Renumbering Protection:
--       - Jika dokumen belum berstatus 'disetujui' tetapi sudah memiliki nomor resmi,
--         prosedur MENOLAK pengalokasian nomor baru demi mencegah penimpaan nomor historis.
--    f. Ketepatan Approver Saat Retry:
--       - Mempertahankan approver asli dari database. Nilai NULL pada record historis
--         tetap NULL dengan status 'historical_unrecorded' tanpa substitusi ke pemanggil retry.
--    g. Function Owner Verification:
--       - Prosedur dan helper function ditetapkan secara eksplisit berpemilik 'postgres'.
--    h. Snapshot & Rollback Plan yang Terverifikasi Katalog PostgreSQL.
--
-- ============================================================================

BEGIN;

-- 0. PREFLIGHT DEPENDENCY ASSERTION (MEMASTIKAN STEP 1 SUDAH DIJALANKAN)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'ptv_notifications' 
          AND column_name = 'recipient_identity_id'
    ) THEN
        RAISE EXCEPTION 'MIGRATION DEPENDENCY ERROR: Kolom recipient_identity_id belum ada pada tabel ptv_notifications. Jalankan PTVPRO-SMART-NOTIFICATIONS-SCHEMA-DRAFT.sql (Step 1) terlebih dahulu!'
            USING ERRCODE = '42703';
    END IF;
END $$;

-- 1. REGISTRY PERMANEN NOMOR SURAT TERBIT & HISTORIS TERLINDUNGI
CREATE TABLE IF NOT EXISTS public.ptv_issued_letter_registry (
    doc_type VARCHAR(10) NOT NULL,            -- 'SI', 'ST', 'SBB'
    year_period INT NOT NULL,                 -- e.g. 2026
    seq_number INT NOT NULL,                  -- e.g. 1, 7, 9
    nomor_surat VARCHAR(64) NOT NULL,         -- e.g. '001/SI-PTV/X/2026'
    source VARCHAR(32) NOT NULL DEFAULT 'issued', -- 'issued', 'historical_reserved'
    doc_id UUID NULL,                         -- Referensi dokumen (NULL jika reservasi historis)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (doc_type, year_period, seq_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ptv_issued_letter_registry_no
    ON public.ptv_issued_letter_registry (nomor_surat);

-- 1.0 KEPEMILIKAN TABEL, RLS & GRANTS KETAT REGISTRY (RELEASE-GATE HARDENING)
ALTER TABLE public.ptv_issued_letter_registry OWNER TO postgres;
ALTER TABLE public.ptv_issued_letter_registry ENABLE ROW LEVEL SECURITY;

-- Cabut SELURUH izin langsung dari PUBLIC, anon, dan authenticated
REVOKE ALL ON TABLE public.ptv_issued_letter_registry FROM PUBLIC, anon, authenticated;

-- Berikan HANYA SELECT kepada authenticated dan service_role (Audit & Verifikasi Terbaca)
-- anon dan authenticated DILARANG KERAS melakukan INSERT, UPDATE, atau DELETE langsung
GRANT SELECT ON TABLE public.ptv_issued_letter_registry TO authenticated, service_role;
GRANT ALL ON TABLE public.ptv_issued_letter_registry TO service_role;

-- Kebijakan RLS:
-- 1. SELECT Policy: authenticated & service_role dapat membaca registry nomor surat
DROP POLICY IF EXISTS ptv_issued_letter_registry_select_policy ON public.ptv_issued_letter_registry;
CREATE POLICY ptv_issued_letter_registry_select_policy
    ON public.ptv_issued_letter_registry
    FOR SELECT
    TO authenticated, service_role
    USING (true);

-- 2. WRITE Policy: Menolak akses DML langsung dari anon dan authenticated.
-- Hanya service_role atau internal postgres context yang diizinkan jika dievaluasi via RLS.
DROP POLICY IF EXISTS ptv_issued_letter_registry_write_policy ON public.ptv_issued_letter_registry;
CREATE POLICY ptv_issued_letter_registry_write_policy
    ON public.ptv_issued_letter_registry
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 1.1 AUDIT, VALIDASI FORMAT LENGKAP & SINKRONISASI NULL-SAFE (SI, ST, SBB)
DO $$
DECLARE
    v_rec RECORD;
    v_exists RECORD;
    v_seq INT;
    v_year INT;
    v_parts TEXT[];
    v_001_found BOOLEAN := FALSE;
    v_007_found BOOLEAN := FALSE;
BEGIN
    -- ========================================================================
    -- A. Universal audit & sync untuk seluruh ptv_surat_izin
    -- ========================================================================
    FOR v_rec IN (
        SELECT id, nomor_surat, created_at, 'SI' AS doc_type
        FROM public.ptv_surat_izin
        WHERE nomor_surat IS NOT NULL 
          AND nomor_surat NOT IN ('', '—') 
          AND nomor_surat NOT LIKE 'DRAFT%'
    ) LOOP
        -- 1. Validasi Jumlah Segmen (Wajib tepat 4 segmen)
        v_parts := string_to_array(v_rec.nomor_surat, '/');
        IF array_length(v_parts, 1) IS DISTINCT FROM 4 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_izin memiliki format nomor surat tidak valid (% segmen): "%". Format resmi wajib 4 segmen (XXX/TAG/BULAN/TAHUN).',
                v_rec.id, array_length(v_parts, 1), v_rec.nomor_surat
                USING ERRCODE = '22023';
        END IF;
        
        -- 2. Validasi Segmen 1: Sequence numerik 3-4 digit (1..9999)
        IF v_parts[1] !~ '^[0-9]{3,4}$' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_izin memiliki nomor urut non-numerik: "%". Laporkan ke operator untuk rekonsiliasi.',
                v_rec.id, v_parts[1]
                USING ERRCODE = '22023';
        END IF;
        v_seq := v_parts[1]::INT;
        IF v_seq < 1 OR v_seq > 9999 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_izin memiliki nomor urut di luar batas (1-9999): %',
                v_rec.id, v_seq
                USING ERRCODE = '22023';
        END IF;

        -- 3. Validasi Segmen 2: Tag jenis surat harus 'SI-PTV'
        IF v_parts[2] IS DISTINCT FROM 'SI-PTV' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_izin memiliki tag jenis tidak cocok: "%" (diharapkan SI-PTV).',
                v_rec.id, v_parts[2]
                USING ERRCODE = '22023';
        END IF;

        -- 4. Validasi Segmen 3: Bulan Romawi kanonikal
        IF v_parts[3] NOT IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII') THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_izin memiliki bulan Romawi tidak valid: "%".',
                v_rec.id, v_parts[3]
                USING ERRCODE = '22023';
        END IF;

        -- 5. Validasi Segmen 4: Tahun numerik 4 digit
        IF v_parts[4] !~ '^[0-9]{4}$' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_izin memiliki tahun tidak valid: "%".',
                v_rec.id, v_parts[4]
                USING ERRCODE = '22023';
        END IF;
        v_year := v_parts[4]::INT;
        IF v_year < 2000 OR v_year > 2099 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_izin memiliki tahun di luar rentang valid: %',
                v_rec.id, v_year
                USING ERRCODE = '22023';
        END IF;

        IF v_seq = 1 THEN v_001_found := TRUE; END IF;
        IF v_seq = 7 THEN v_007_found := TRUE; END IF;

        -- Periksa di registry dengan NULL-Safe comparison (IS DISTINCT FROM)
        SELECT * INTO v_exists FROM public.ptv_issued_letter_registry
        WHERE doc_type = 'SI' AND year_period = v_year AND seq_number = v_seq;

        IF FOUND THEN
            IF (v_exists.nomor_surat IS DISTINCT FROM v_rec.nomor_surat)
               OR (v_exists.doc_id IS DISTINCT FROM v_rec.id)
               OR (v_exists.source IS DISTINCT FROM 'issued') THEN
                RAISE EXCEPTION 'MIGRATION HALTED: Konflik registry pada SI tahun % urutan % (nomor: %, doc_id: %). Data tidak cocok dengan fisik database!', 
                    v_year, v_seq, v_rec.nomor_surat, v_rec.id
                    USING ERRCODE = '23505';
            END IF;
        ELSE
            INSERT INTO public.ptv_issued_letter_registry (doc_type, year_period, seq_number, nomor_surat, source, doc_id, created_at)
            VALUES ('SI', v_year, v_seq, v_rec.nomor_surat, 'issued', v_rec.id, now());
        END IF;
    END LOOP;

    -- Validasi bahwa dokumen historis wajib 001 dan 007 benar-benar ditemukan
    IF NOT v_001_found THEN
        RAISE EXCEPTION 'MIGRATION HALTED: Dokumen historis 001/SI-PTV/X/2026 tidak ditemukan pada tabel ptv_surat_izin'
            USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_007_found THEN
        RAISE EXCEPTION 'MIGRATION HALTED: Dokumen historis 007/SI-PTV/X/2026 tidak ditemukan pada tabel ptv_surat_izin'
            USING ERRCODE = 'P0002';
    END IF;

    -- ========================================================================
    -- B. Universal audit & sync untuk seluruh ptv_surat_tugas
    -- ========================================================================
    FOR v_rec IN (
        SELECT id, nomor_surat, created_at, 'ST' AS doc_type
        FROM public.ptv_surat_tugas
        WHERE nomor_surat IS NOT NULL 
          AND nomor_surat NOT IN ('', '—') 
          AND nomor_surat NOT LIKE 'DRAFT%'
    ) LOOP
        v_parts := string_to_array(v_rec.nomor_surat, '/');
        IF array_length(v_parts, 1) IS DISTINCT FROM 4 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_tugas memiliki format nomor surat tidak valid (% segmen): "%". Format resmi wajib 4 segmen.',
                v_rec.id, array_length(v_parts, 1), v_rec.nomor_surat
                USING ERRCODE = '22023';
        END IF;
        
        IF v_parts[1] !~ '^[0-9]{3,4}$' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_tugas memiliki urutan non-numerik: "%"',
                v_rec.id, v_parts[1]
                USING ERRCODE = '22023';
        END IF;
        v_seq := v_parts[1]::INT;
        IF v_seq < 1 OR v_seq > 9999 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_tugas memiliki urutan di luar rentang: %',
                v_rec.id, v_seq
                USING ERRCODE = '22023';
        END IF;

        IF v_parts[2] IS DISTINCT FROM 'ST-PTV' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_tugas memiliki tag tidak cocok: "%" (diharapkan ST-PTV).',
                v_rec.id, v_parts[2]
                USING ERRCODE = '22023';
        END IF;

        IF v_parts[3] NOT IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII') THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_tugas memiliki bulan Romawi tidak valid: "%"',
                v_rec.id, v_parts[3]
                USING ERRCODE = '22023';
        END IF;

        IF v_parts[4] !~ '^[0-9]{4}$' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_tugas memiliki format tahun tidak valid: "%"',
                v_rec.id, v_parts[4]
                USING ERRCODE = '22023';
        END IF;
        v_year := v_parts[4]::INT;
        IF v_year < 2000 OR v_year > 2099 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_tugas memiliki tahun di luar batas: %',
                v_rec.id, v_year
                USING ERRCODE = '22023';
        END IF;

        SELECT * INTO v_exists FROM public.ptv_issued_letter_registry
        WHERE doc_type = 'ST' AND year_period = v_year AND seq_number = v_seq;

        IF FOUND THEN
            IF (v_exists.nomor_surat IS DISTINCT FROM v_rec.nomor_surat)
               OR (v_exists.doc_id IS DISTINCT FROM v_rec.id)
               OR (v_exists.source IS DISTINCT FROM 'issued') THEN
                RAISE EXCEPTION 'MIGRATION HALTED: Konflik registry pada ST tahun % urutan % (nomor: %, doc_id: %). Data tidak cocok dengan fisik database!', 
                    v_year, v_seq, v_rec.nomor_surat, v_rec.id
                    USING ERRCODE = '23505';
            END IF;
        ELSE
            INSERT INTO public.ptv_issued_letter_registry (doc_type, year_period, seq_number, nomor_surat, source, doc_id, created_at)
            VALUES ('ST', v_year, v_seq, v_rec.nomor_surat, 'issued', v_rec.id, now());
        END IF;
    END LOOP;

    -- ========================================================================
    -- C. Universal audit & sync untuk seluruh ptv_surat_barang
    -- ========================================================================
    FOR v_rec IN (
        SELECT id, nomor_surat, created_at, 'SBB' AS doc_type
        FROM public.ptv_surat_barang
        WHERE nomor_surat IS NOT NULL 
          AND nomor_surat NOT IN ('', '—') 
          AND nomor_surat NOT LIKE 'DRAFT%'
    ) LOOP
        v_parts := string_to_array(v_rec.nomor_surat, '/');
        IF array_length(v_parts, 1) IS DISTINCT FROM 4 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_barang memiliki format nomor surat tidak valid (% segmen): "%". Format resmi wajib 4 segmen.',
                v_rec.id, array_length(v_parts, 1), v_rec.nomor_surat
                USING ERRCODE = '22023';
        END IF;
        
        IF v_parts[1] !~ '^[0-9]{3,4}$' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_barang memiliki urutan non-numerik: "%"',
                v_rec.id, v_parts[1]
                USING ERRCODE = '22023';
        END IF;
        v_seq := v_parts[1]::INT;
        IF v_seq < 1 OR v_seq > 9999 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_barang memiliki urutan di luar batas: %',
                v_rec.id, v_seq
                USING ERRCODE = '22023';
        END IF;

        IF v_parts[2] IS DISTINCT FROM 'SBB-PTV' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_barang memiliki tag tidak cocok: "%" (diharapkan SBB-PTV).',
                v_rec.id, v_parts[2]
                USING ERRCODE = '22023';
        END IF;

        IF v_parts[3] NOT IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII') THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_barang memiliki bulan Romawi tidak valid: "%"',
                v_rec.id, v_parts[3]
                USING ERRCODE = '22023';
        END IF;

        IF v_parts[4] !~ '^[0-9]{4}$' THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_barang memiliki format tahun tidak valid: "%"',
                v_rec.id, v_parts[4]
                USING ERRCODE = '22023';
        END IF;
        v_year := v_parts[4]::INT;
        IF v_year < 2000 OR v_year > 2099 THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Dokumen ID % pada ptv_surat_barang memiliki tahun di luar batas: %',
                v_rec.id, v_year
                USING ERRCODE = '22023';
        END IF;

        SELECT * INTO v_exists FROM public.ptv_issued_letter_registry
        WHERE doc_type = 'SBB' AND year_period = v_year AND seq_number = v_seq;

        IF FOUND THEN
            IF (v_exists.nomor_surat IS DISTINCT FROM v_rec.nomor_surat)
               OR (v_exists.doc_id IS DISTINCT FROM v_rec.id)
               OR (v_exists.source IS DISTINCT FROM 'issued') THEN
                RAISE EXCEPTION 'MIGRATION HALTED: Konflik registry pada SBB tahun % urutan % (nomor: %, doc_id: %). Data tidak cocok dengan fisik database!', 
                    v_year, v_seq, v_rec.nomor_surat, v_rec.id
                    USING ERRCODE = '23505';
            END IF;
        ELSE
            INSERT INTO public.ptv_issued_letter_registry (doc_type, year_period, seq_number, nomor_surat, source, doc_id, created_at)
            VALUES ('SBB', v_year, v_seq, v_rec.nomor_surat, 'issued', v_rec.id, now());
        END IF;
    END LOOP;

    -- ========================================================================
    -- D. Reservasi Khusus Nomor 009 (Terbit Offline/Eksternal - NULL-Safe)
    -- ========================================================================
    SELECT * INTO v_exists FROM public.ptv_issued_letter_registry 
    WHERE doc_type = 'SI' AND year_period = 2026 AND seq_number = 9;

    IF FOUND THEN
        IF (v_exists.nomor_surat IS DISTINCT FROM '009/SI-PTV/X/2026')
           OR (v_exists.source IS DISTINCT FROM 'historical_reserved')
           OR (v_exists.doc_id IS NOT NULL) THEN
            RAISE EXCEPTION 'MIGRATION HALTED: Konflik atribut registry pada nomor 009. Nomor 009 harus berstatus historical_reserved dengan doc_id NULL.'
                USING ERRCODE = '23505';
        END IF;
    ELSE
        INSERT INTO public.ptv_issued_letter_registry (doc_type, year_period, seq_number, nomor_surat, source, doc_id, created_at)
        VALUES ('SI', 2026, 9, '009/SI-PTV/X/2026', 'historical_reserved', NULL, now());
    END IF;
END $$;

-- 1.2 POST-SEED REGISTRY ASSERTION (VERIFIKASI AKHIR REGISTRY SEBELUM PROSEDUR DIBUKA)
DO $$
BEGIN
    -- Verifikasi 001, 007, 009 terdaftar dengan tepat
    IF NOT EXISTS (
        SELECT 1 FROM public.ptv_issued_letter_registry 
        WHERE doc_type = 'SI' AND year_period = 2026 AND seq_number = 1 
          AND nomor_surat = '001/SI-PTV/X/2026' AND source = 'issued'
    ) OR NOT EXISTS (
        SELECT 1 FROM public.ptv_issued_letter_registry 
        WHERE doc_type = 'SI' AND year_period = 2026 AND seq_number = 7 
          AND nomor_surat = '007/SI-PTV/X/2026' AND source = 'issued'
    ) OR NOT EXISTS (
        SELECT 1 FROM public.ptv_issued_letter_registry 
        WHERE doc_type = 'SI' AND year_period = 2026 AND seq_number = 9 
          AND nomor_surat = '009/SI-PTV/X/2026' AND source = 'historical_reserved' AND doc_id IS NULL
    ) THEN
        RAISE EXCEPTION 'MIGRATION ASSERTION FAILED: Verifikasi akhir registry gagal untuk nomor 001, 007, atau 009.'
            USING ERRCODE = 'P0003';
    END IF;

    -- Verifikasi Gap-Filling: Menghitung nomor urut positif terkecil yang belum terpakai secara dinamis
    -- Menjamin tidak bergantung pada asumsi kaku 002 jika sebelum rilis legacy telah menerbitkan nomor tersebut.
    DECLARE
        v_next_seq INT;
    BEGIN
        SELECT COALESCE(
            (SELECT s.candidate
             FROM generate_series(1, 10000) AS s(candidate)
             WHERE NOT EXISTS (
                 SELECT 1 FROM public.ptv_issued_letter_registry r
                 WHERE r.doc_type = 'SI' AND r.year_period = 2026 AND r.seq_number = s.candidate
             )
             LIMIT 1),
            1
        ) INTO v_next_seq;

        IF v_next_seq IS NULL OR v_next_seq < 1 THEN
            RAISE EXCEPTION 'MIGRATION ASSERTION FAILED: Gagal menghitung nomor urut terkecil berikutnya untuk SI 2026!'
                USING ERRCODE = 'P0003';
        END IF;

        RAISE NOTICE 'POST-SEED GAP-FILLING VERIFIED: Nomor urut berikutnya yang tersedia untuk SI 2026 adalah urutan %.', v_next_seq;
    END;
END $$;

-- 2. UNIQUE CONSTRAINT PADA KOLOM NOMOR SURAT DI KETIGA TABEL DOKUMEN
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ptv_surat_izin_nomor_surat'
    ) THEN
        ALTER TABLE public.ptv_surat_izin
            ADD CONSTRAINT uq_ptv_surat_izin_nomor_surat UNIQUE (nomor_surat);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ptv_surat_tugas_nomor_surat'
    ) THEN
        ALTER TABLE public.ptv_surat_tugas
            ADD CONSTRAINT uq_ptv_surat_tugas_nomor_surat UNIQUE (nomor_surat);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ptv_surat_barang_nomor_surat'
    ) THEN
        ALTER TABLE public.ptv_surat_barang
            ADD CONSTRAINT uq_ptv_surat_barang_nomor_surat UNIQUE (nomor_surat);
    END IF;
END $$;

-- 3. HELPER FUNCTION: KONVERSI BULAN KE ANGKA ROMAWI KANONIKAL (VOLATILITAS IMMUTABLE MURNI)
CREATE OR REPLACE FUNCTION public.to_roman_month(p_date DATE)
RETURNS VARCHAR(8)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_month INT;
BEGIN
    IF p_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_date tidak boleh null pada to_roman_month' USING ERRCODE = '22004';
    END IF;

    v_month := EXTRACT(MONTH FROM p_date)::INT;
    RETURN CASE v_month
        WHEN 1 THEN 'I'
        WHEN 2 THEN 'II'
        WHEN 3 THEN 'III'
        WHEN 4 THEN 'IV'
        WHEN 5 THEN 'V'
        WHEN 6 THEN 'VI'
        WHEN 7 THEN 'VII'
        WHEN 8 THEN 'VIII'
        WHEN 9 THEN 'IX'
        WHEN 10 THEN 'X'
        WHEN 11 THEN 'XI'
        WHEN 12 THEN 'XII'
        ELSE 'X'
    END;
END;
$$;

ALTER FUNCTION public.to_roman_month(DATE) OWNER TO postgres;

-- 4. FUNCTION UTAMA: APPROVAL DOKUMEN & ALOKASI NOMOR GAP TERKECIL ATOMIK (REV 9 HARDENED)

-- 4.1 Pembersihan Bersih Seluruh Signature & Overload Lama
DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT);
DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID);

-- 4.2 Definisi Tunggal RPC Kanonikal
CREATE OR REPLACE FUNCTION public.approve_ptv_document_atomic(
    p_doc_type VARCHAR(10),
    p_doc_id UUID,
    p_note TEXT DEFAULT NULL,
    p_approver_identity_id UUID DEFAULT NULL -- Parameter deprecated untuk kompatibilitas frontend, nilainya dioverride demi anti-spoofing
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_target_table TEXT;
    v_current_status TEXT;
    v_current_no TEXT;
    v_existing_approver UUID;
    v_effective_date DATE;
    v_year INT;
    v_roman_month VARCHAR(8);
    v_tag VARCHAR(16);
    v_next_seq INT;
    v_formatted_no VARCHAR(64);
    v_caller_identity_id UUID;
    v_diajukan_oleh UUID;
    v_doc_subject TEXT;
BEGIN
    IF p_doc_type NOT IN ('SI', 'ST', 'SBB') THEN
        RAISE EXCEPTION 'Jenis dokumen tidak valid: %', p_doc_type USING ERRCODE = '22023';
    END IF;

    -- 0. VERIFIKASI KEWENANGAN APPROVAL PEJABAT (CANONICAL CAPABILITY CHECK)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Sesi autentikasi dibutuhkan untuk pengesahan dokumen'
            USING ERRCODE = '28000';
    END IF;

    -- Resolusi identitas kanonikal pejabat yang mengesahkan (Anti-Spoofing Mutlak dari auth.uid())
    SELECT ua.identity_id INTO v_caller_identity_id
    FROM public.user_account ua
    WHERE ua.auth_user_id = auth.uid() AND ua.status_akun = 'active';

    IF v_caller_identity_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Akun aktif tidak ditemukan untuk sesi pemanggil'
            USING ERRCODE = '28000';
    END IF;

    -- Validasi kapabilitas documents.approve (Fail-Closed, TIDAK ADA fuzzy match teks jabatan)
    IF (public.has_capability('documents.approve') IS NOT TRUE) THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM public.user_account ua
            JOIN public.account_profiles ap ON ap.account_id = ua.id
            JOIN public.access_profile prof ON prof.id = ap.profile_id
            WHERE ua.auth_user_id = auth.uid()
              AND ua.status_akun = 'active'
              AND prof.name IN ('root', 'superadmin')
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN: Pengesahan dokumen memerlukan kapabilitas resmi documents.approve'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_tag := CASE
        WHEN p_doc_type = 'ST' THEN 'ST-PTV'
        WHEN p_doc_type = 'SBB' THEN 'SBB-PTV'
        ELSE 'SI-PTV'
    END;

    v_target_table := CASE
        WHEN p_doc_type = 'ST' THEN 'ptv_surat_tugas'
        WHEN p_doc_type = 'SBB' THEN 'ptv_surat_barang'
        ELSE 'ptv_surat_izin'
    END;

    -- 1. Lock baris dokumen spesifik dan baca status eksisting (Row-Level Locking)
    -- Menggunakan nama kolom yang terverifikasi secara nyata di database Staging
    IF p_doc_type = 'SI' THEN
        SELECT status, nomor_surat, COALESCE(tanggal_mulai, created_at::DATE, CURRENT_DATE), diajukan_oleh, COALESCE(alasan, 'Izin Santri'), disetujui_oleh
        INTO v_current_status, v_current_no, v_effective_date, v_diajukan_oleh, v_doc_subject, v_existing_approver
        FROM public.ptv_surat_izin
        WHERE id = p_doc_id
        FOR UPDATE;
    ELSIF p_doc_type = 'ST' THEN
        SELECT status, nomor_surat, COALESCE(tanggal_tugas, created_at::DATE, CURRENT_DATE), diajukan_oleh, COALESCE(perihal, 'Tugas Resmi'), disetujui_oleh
        INTO v_current_status, v_current_no, v_effective_date, v_diajukan_oleh, v_doc_subject, v_existing_approver
        FROM public.ptv_surat_tugas
        WHERE id = p_doc_id
        FOR UPDATE;
    ELSE
        SELECT status, nomor_surat, COALESCE(created_at::DATE, CURRENT_DATE), diajukan_oleh, COALESCE(tujuan_lokasi, 'Penggunaan Barang'), disetujui_oleh
        INTO v_current_status, v_current_no, v_effective_date, v_diajukan_oleh, v_doc_subject, v_existing_approver
        FROM public.ptv_surat_barang
        WHERE id = p_doc_id
        FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dokumen ID % pada tabel % tidak ditemukan', p_doc_id, v_target_table
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Idempotency Guard: Pertahankan nomor dan APPROVER ASLI (JANGAN GANTI DENGAN CALLER RETRY JIKA NULL!)
    IF LOWER(TRIM(COALESCE(v_current_status, ''))) = 'disetujui' 
       AND v_current_no IS NOT NULL 
       AND v_current_no NOT IN ('', '—') 
       AND v_current_no NOT LIKE 'DRAFT%' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Dokumen sudah disetujui sebelumnya',
            'nomor_surat', v_current_no,
            'doc_id', p_doc_id,
            'doc_type', p_doc_type,
            'disetujui_oleh', v_existing_approver, -- APPROVER ASLI TETAP UTUH (BISA NULL PADA RECORD HISTORIS)
            'approver_status', CASE WHEN v_existing_approver IS NULL THEN 'historical_unrecorded' ELSE 'verified' END
        );
    END IF;

    -- 2.1 Anti-Renumbering Guard: Jika dokumen belum disetujui tetapi sudah memiliki nomor resmi,
    -- tolak alokasi nomor baru untuk mencegah penimpaan nomor sepihak!
    IF LOWER(TRIM(COALESCE(v_current_status, ''))) != 'disetujui'
       AND v_current_no IS NOT NULL
       AND v_current_no NOT IN ('', '—')
       AND v_current_no NOT LIKE 'DRAFT%' THEN
        RAISE EXCEPTION 'DATA ANOMALY (ANTI-RENUMBERING): Dokumen ID % pada % berstatus "%" tetapi sudah memiliki nomor resmi "%". Alokasi nomor baru dibatalkan untuk mencegah renumbering. Lakukan rekonsiliasi manual!',
            p_doc_id, v_target_table, v_current_status, v_current_no
            USING ERRCODE = '22023';
    END IF;

    -- Validasi Status Dokumen Berdasarkan Allowlist: Hanya status pending yang boleh disetujui
    IF LOWER(TRIM(COALESCE(v_current_status, ''))) NOT IN ('menunggu', 'draft', 'revisi', 'diajukan') THEN
        RAISE EXCEPTION 'INVALID_OPERATION: Dokumen dengan status % tidak dapat disetujui', v_current_status
            USING ERRCODE = '22023';
    END IF;

    v_year := EXTRACT(YEAR FROM v_effective_date)::INT;
    v_roman_month := public.to_roman_month(v_effective_date);

    -- 3. EXCLUSIVE TRANSACTIONAL ADVISORY LOCK PER (JENIS SURAT, TAHUN)
    PERFORM pg_advisory_xact_lock(hashtext(p_doc_type || '-' || v_year::TEXT));

    -- 4. CARI NOMOR POSITIF TERKECIL YANG BELUM TERBIT (GAP-FILLING)
    SELECT gs.n
    INTO v_next_seq
    FROM generate_series(1, 9999) AS gs(n)
    LEFT JOIN public.ptv_issued_letter_registry reg
        ON reg.doc_type = p_doc_type
       AND reg.year_period = v_year
       AND reg.seq_number = gs.n
    WHERE reg.seq_number IS NULL
    ORDER BY gs.n ASC
    LIMIT 1;

    IF v_next_seq IS NULL THEN
        RAISE EXCEPTION 'Alokasi nomor habis untuk jenis % pada tahun %', p_doc_type, v_year
            USING ERRCODE = '23505';
    END IF;

    v_formatted_no := LPAD(v_next_seq::TEXT, 3, '0') || '/' || v_tag || '/' || v_roman_month || '/' || v_year::TEXT;

    -- 5. CATAT SECARA PERMANEN KE REGISTRY
    INSERT INTO public.ptv_issued_letter_registry (
        doc_type, year_period, seq_number, nomor_surat, source, doc_id, created_at
    ) VALUES (
        p_doc_type, v_year, v_next_seq, v_formatted_no, 'issued', p_doc_id, now()
    );

    -- 6. MUTASIKAN DOKUMEN KE STATUS DISETUJUI DALAM TRANSAKSI YANG SAMA
    IF p_doc_type = 'SI' THEN
        UPDATE public.ptv_surat_izin
        SET status = 'disetujui',
            nomor_surat = v_formatted_no,
            disetujui_oleh = v_caller_identity_id
        WHERE id = p_doc_id;
    ELSIF p_doc_type = 'ST' THEN
        UPDATE public.ptv_surat_tugas
        SET status = 'disetujui',
            nomor_surat = v_formatted_no,
            disetujui_oleh = v_caller_identity_id
        WHERE id = p_doc_id;
    ELSE
        UPDATE public.ptv_surat_barang
        SET status = 'disetujui',
            nomor_surat = v_formatted_no,
            disetujui_oleh = v_caller_identity_id
        WHERE id = p_doc_id;
    END IF;

    -- 7. TERBITKAN SMART NOTIFICATION RESMI SECARA OTOMATIS (TRUSTED PRODUCER BINDING)
    IF v_diajukan_oleh IS NOT NULL THEN
        INSERT INTO public.ptv_notifications (
            tipe, judul, pesan, target_role,
            recipient_identity_id, actor_identity_id,
            entity_type, entity_id, action_url,
            idempotency_key, is_protected, is_read, created_at
        ) VALUES (
            'approval',
            'Surat ' || v_tag || ' Disetujui (' || v_formatted_no || ')',
            'Pengajuan surat ' || v_doc_subject || ' telah disetujui resmi dengan nomor ' || v_formatted_no || '.',
            NULL,
            v_diajukan_oleh,
            v_caller_identity_id,
            'document',
            p_doc_id::TEXT,
            '/hub/dokumen-saya?doc=' || v_formatted_no,
            'doc_approved_' || p_doc_id::TEXT || '_' || v_formatted_no,
            TRUE,
            FALSE,
            now()
        )
        ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'nomor_surat', v_formatted_no,
        'sequence', v_next_seq,
        'doc_id', p_doc_id,
        'doc_type', p_doc_type,
        'disetujui_oleh', v_caller_identity_id,
        'approver_status', 'verified',
        'approved_at', now()
    );
END;
$$;

ALTER FUNCTION public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID) OWNER TO postgres;

-- Izin Eksekusi RPC:
REVOKE ALL ON FUNCTION public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.to_roman_month(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.to_roman_month(DATE) TO authenticated, service_role;

-- ============================================================================
-- 5. SNAPSHOT PRE-MIGRATION & ROLLBACK PLAN LENGKAP (RESTORE TO BASELINE)
--    Snapshot konfigurasi objek sebelum Step 2 (diverifikasi via katalog PostgreSQL Staging):
--      - Tabel public.ptv_issued_letter_registry: BELUM ADA pada baseline Staging.
--      - Fungsi public.approve_ptv_document_atomic: BELUM ADA pada baseline Staging.
--      - Fungsi public.to_roman_month(DATE): BELUM ADA pada baseline Staging.
--      - Constraint uq_ptv_surat_izin_nomor_surat: BELUM ADA pada baseline Staging.
--      - Constraint uq_ptv_surat_tugas_nomor_surat: BELUM ADA pada baseline Staging.
--      - Constraint uq_ptv_surat_barang_nomor_surat: BELUM ADA pada baseline Staging.
--
--    SKRIP ROLLBACK (Jalankan blok ini jika terjadi kegagalan atau pembatalan migrasi):
--
--    -- Step R.1: Hapus Seluruh Overload Fungsi Baru
--    DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT, UUID);
--    DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, UUID, TEXT);
--    DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID, TEXT);
--    DROP FUNCTION IF EXISTS public.approve_ptv_document_atomic(VARCHAR, UUID);
--    DROP FUNCTION IF EXISTS public.to_roman_month(DATE);
--
--    -- Step R.2: Hapus Unique Constraints Nomor Surat
--    ALTER TABLE public.ptv_surat_izin DROP CONSTRAINT IF EXISTS uq_ptv_surat_izin_nomor_surat;
--    ALTER TABLE public.ptv_surat_tugas DROP CONSTRAINT IF EXISTS uq_ptv_surat_tugas_nomor_surat;
--    ALTER TABLE public.ptv_surat_barang DROP CONSTRAINT IF EXISTS uq_ptv_surat_barang_nomor_surat;
--
--    -- Step R.3: Hapus Policy & Cabut Grants Registry
--    DROP POLICY IF EXISTS ptv_issued_letter_registry_write_policy ON public.ptv_issued_letter_registry;
--    DROP POLICY IF EXISTS ptv_issued_letter_registry_select_policy ON public.ptv_issued_letter_registry;
--    REVOKE ALL ON TABLE public.ptv_issued_letter_registry FROM PUBLIC, anon, authenticated, service_role;
--
--    -- Step R.4: Jaminan Integritas Data & Anti-Loss Protection:
--    -- Tabel public.ptv_issued_letter_registry BESERTA SELURUH BARIS HISTORISNYA
--    -- DILARANG DI-DROP dan DILARANG DI-DELETE/TRUNCATE agar jejak integritas penomoran
--    -- nomor resmi yang telah sah tetap terlindungi secara permanen.
-- ============================================================================

COMMIT;
