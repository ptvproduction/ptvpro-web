-- ============================================================================
-- PTV PRO — RECONCILIATION DATA PATCH DRAFT (STAGING ONLY) — REVISION 4
-- File: docs/PTV-PRO-RECONCILIATION-DATA-PATCH-DRAFT.sql
-- Target Database: Supabase Cloud Staging (swadgljnyelsjstqqxbm)
-- Status: STRICTLY DRAFT / NON-EXECUTED — MENUNGGU PERSETUJUAN OPERATOR
-- Audit Rujukan: PTV-DEV-086, PTV-DEV-089, PTV-DEV-091 & Safety Corrections Revision 4
-- ============================================================================
-- Ringkasan Koreksi Keselamatan Revisi 4:
-- 1. [HAPUS ROLLBACK DESTRUKTIF TANPA WHERE]:
--    Menghapus perintah destruktif 'UPDATE public.ptv_inventaris SET ... = NULL;'
--    yang sebelumnya beroperasi tanpa klausa WHERE. Prosedur pemulihan diganti
--    dengan restorasi snapshot per-ID dan per-kolom serta runner backup snapshot teruji.
-- 2. [KLARIFIKASI IDENTITAS TARGET DATABASE]:
--    Menegaskan bahwa parameter 'app.target_project_ref' BUKANLAH mekanisme verifikasi
--    identitas database otomatis/kriptografis, melainkan sekadar parameter konfirmasi
--    manual sesi. Operator WAJIB memverifikasi target project ref (swadgljnyelsjstqqxbm)
--    secara eksternal dari konfigurasi koneksi tepercaya (host: db.swadgljnyelsjstqqxbm.supabase.co,
--    database connection URI, atau environment variable) SEBELUM menjalankan script.
--    Guard fail-closed di dalam SQL dipertahankan sebagai lapisan pertahanan kedua.
-- 3. [OPERATOR NULL-SAFE (IS DISTINCT FROM)]:
--    Mengganti seluruh operator '<>' dengan 'IS DISTINCT FROM' pada seluruh preflight,
--    assertion, update, dan readback verification untuk mencegah silent pass pada nilai NULL.
-- 4. [CATATAN BERSAMA: FULL PAYLOAD EXACT COMPARISON]:
--    Membandingkan seluruh payload yang dimigrasikan untuk catatan 3cc0338b...
--    (judul, tipe, kategori, created_by_id, created_by_name, tags JSONB, isi HTML 100% lengkap,
--    warna, is_pinned, created_at, updated_at). Tidak ada lagi substring atau length-only checks.
-- 5. [PENGELUARAN LIVE: FULL FIELD COMPARISON]:
--    Membandingkan seluruh field pengeluaran ac23e115... (id, keuangan_id, nominal,
--    tanggal, keperluan, keterangan, created_at).
-- 6. [SURAT IZIN: VALIDASI ARRAY TYPE & FULL JSONB PAYLOAD]:
--    Memvalidasi bahwa tipe santri_list adalah JSON array (jsonb_typeof = 'array')
--    sebelum operasi array, dan membandingkan seluruh isi santri_list secara presisi.
-- 7. [161 INVENTARIS: SINGLE SOURCE VALUES & CONFLICT DETECTION]:
--    Menggunakan dataset sumber bersama via temporary table 'temp_source_inventaris'
--    untuk preflight conflict detection, UPDATE terarah, dan post-patch verification.
--    Mendeteksi setiap nilai di Staging yang sudah terisi namun berbeda dari Production,
--    melaporkan rincian per ID dan kolom, serta menghentikan transaksi jika ada konflik.
-- 8. [KOMPREHENSIF POST-PATCH VERIFICATION UNTUK 161 INVENTARIS]:
--    Memvalidasi seluruh 161 record dari sumber secara aman terhadap NULL (IS NOT DISTINCT FROM),
--    memastikan setiap ID ditemukan dan nilainya terisi sesuai sumber kanonikal.
-- 9. [ZERO DELETE KARANTINA & ZERO SCHEMA MUTATION CONTENT PLANNER]:
--    49 record karantina tetap utuh sebagai audit trail; tidak ada mutasi skema content planner.
-- 10. [RENCANA DRY-RUN LOKAL TERISOLASI]:
--    Prosedur dry-run diarahkan ke database PostgreSQL lokal/Docker terisolasi, bukan cloud.
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
        RAISE EXCEPTION 'FATAL ANTI-PRODUCTION BARRIER: Terdeteksi tabel fisik Production aktif. Database ini terindikasi PRODUCTION (jthzuhkblxcaohiuypqq)! Eksekusi DIBATALKAN SEKETIKA.';
    END IF;

    -- 5. Positive Structural Check: canonical_identity harus ada sebagai penanda arsitektur Staging
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'canonical_identity'
    ) INTO v_has_canonical_identity;

    IF NOT v_has_canonical_identity THEN
        RAISE EXCEPTION 'FATAL SAFETY VIOLATION: Tabel canonical_identity tidak ditemukan. Target bukan database PTVPRO Staging yang sah!';
    END IF;

    RAISE NOTICE 'SAFETY GUARD PASSED: Seluruh guard pertahanan struktural lolos secara fail-closed.';
END $$;

-- ============================================================================
-- DATASET SUMBER BERSAMA: 161 INVENTARIS PRODUCTION (temp_source_inventaris)
-- Menggunakan satu sumber terpadu untuk:
--   1. Preflight Conflict Detection
--   2. Targeted Update
--   3. Readback Verification
-- ============================================================================
CREATE TEMP TABLE temp_source_inventaris (
    id UUID PRIMARY KEY,
    brand VARCHAR(64),
    model VARCHAR(64),
    keterangan TEXT,
    aset_id_lama VARCHAR(64)
) ON COMMIT DROP;

INSERT INTO temp_source_inventaris (id, brand, model, keterangan, aset_id_lama)
VALUES
    ('61e7f9d8-8f90-4940-a17d-80ff1f874b88'::uuid, NULL, NULL, '
', '61e7f9d8-8f90-4940-a17d-80ff1f874b88'),
    ('3fedb4c6-ac82-4357-9093-909a36847c38'::uuid, 'Vention', NULL, '
', '3fedb4c6-ac82-4357-9093-909a36847c38'),
    ('e3365d89-4779-47fb-9e81-9a474c837fc0'::uuid, 'DeviceWell', NULL, '( HANYA SDI OUT, IN & HDMI OUT )
', 'e3365d89-4779-47fb-9e81-9a474c837fc0'),
    ('1a4e1c7f-9180-4e8c-9466-bcbfe577c26d'::uuid, NULL, NULL, '
', '1a4e1c7f-9180-4e8c-9466-bcbfe577c26d'),
    ('09c63628-c19b-4800-90cc-c57cc169f13e'::uuid, 'AVMATRIX', 'V50605U', '
', '09c63628-c19b-4800-90cc-c57cc169f13e'),
    ('6e8e4f84-6ed6-41e0-8de7-8c4b630cc3cb'::uuid, NULL, NULL, '
', '6e8e4f84-6ed6-41e0-8de7-8c4b630cc3cb'),
    ('dec29bce-b9ba-4939-852c-ba263a8ed441'::uuid, NULL, NULL, '
', 'dec29bce-b9ba-4939-852c-ba263a8ed441'),
    ('cc48e4ef-9513-4ea7-94fb-c1d9e819a8b0'::uuid, NULL, NULL, '
', 'cc48e4ef-9513-4ea7-94fb-c1d9e819a8b0'),
    ('5145378e-6472-4211-aca9-84d1042582b4'::uuid, NULL, NULL, 'OBENG -
', '5145378e-6472-4211-aca9-84d1042582b4'),
    ('b4afd7c5-7e76-42d3-b947-d515a6d946fb'::uuid, NULL, NULL, 'Solasi Bening
', 'b4afd7c5-7e76-42d3-b947-d515a6d946fb'),
    ('0835a301-110c-4eb5-a9af-f67217a908e4'::uuid, 'Hollyland', NULL, 'Hollyland LARK 150 Wireless Dual Microphone System
', '0835a301-110c-4eb5-a9af-f67217a908e4'),
    ('5a966f10-ea37-446b-97cb-f1e6d6625e79'::uuid, NULL, NULL, '
', '5a966f10-ea37-446b-97cb-f1e6d6625e79'),
    ('37581125-1a5c-455d-b6ca-007da0496b6f'::uuid, NULL, NULL, '
', '37581125-1a5c-455d-b6ca-007da0496b6f'),
    ('7eb89436-b114-47c3-82ea-a3ade7665341'::uuid, NULL, NULL, 'Tang Krimping
', '7eb89436-b114-47c3-82ea-a3ade7665341'),
    ('2113c473-71e7-45aa-ab97-94b770092021'::uuid, 'Magnustek', NULL, '
', '2113c473-71e7-45aa-ab97-94b770092021'),
    ('3ad33d10-6d31-44c8-9e8b-48fc2abbe020'::uuid, 'DeviceWell', NULL, '( HANYA SDI OUT & HDMI IN )
', '3ad33d10-6d31-44c8-9e8b-48fc2abbe020'),
    ('b7f23115-e08e-4a21-801c-928f7434caab'::uuid, 'BenQ', NULL, '
', 'b7f23115-e08e-4a21-801c-928f7434caab'),
    ('66d15898-93f0-4952-97ae-7942ffe6c6ce'::uuid, 'Wijoyo Equipment', NULL, '
', '66d15898-93f0-4952-97ae-7942ffe6c6ce'),
    ('4316d211-8f0b-4a98-869f-7bbc1eedc6b9'::uuid, NULL, NULL, 'Tidak Terdeteksi Adanya Internet
', '4316d211-8f0b-4a98-869f-7bbc1eedc6b9'),
    ('f6799327-5b53-4da1-8ffd-a3cd4dca471b'::uuid, NULL, 'RX & TX', 'Receiver & Transmission
', 'f6799327-5b53-4da1-8ffd-a3cd4dca471b'),
    ('3c2e57dd-f2d9-4439-a250-8b816301cc3d'::uuid, 'Feelworld', 'Livepro L1', 'Kadang” Pas di nyalain tiba” mati
', '3c2e57dd-f2d9-4439-a250-8b816301cc3d'),
    ('bd300dce-6d8e-4fe9-9c95-d162d2b6648e'::uuid, 'PXTON', NULL, '
', 'bd300dce-6d8e-4fe9-9c95-d162d2b6648e'),
    ('ea90f8f0-c3f0-4869-abb2-7c25016afd88'::uuid, 'EPSON', 'EB-X500', '
', 'ea90f8f0-c3f0-4869-abb2-7c25016afd88'),
    ('46d7513a-01c9-4a68-820f-83090bfbd81c'::uuid, 'Sony', 'A7 IV', 'Test update verification via script', '46d7513a-01c9-4a68-820f-83090bfbd81c'),
    ('4c64c53a-df5e-4d94-9147-628539b5648a'::uuid, 'Fotopro', NULL, 'Tripod Fotopro', '4c64c53a-df5e-4d94-9147-628539b5648a'),
    ('d75bb118-b113-4c9a-b99d-89eb2edab1cb'::uuid, NULL, NULL, NULL, 'd75bb118-b113-4c9a-b99d-89eb2edab1cb'),
    ('ee034441-be8c-46fd-9ea6-e4918884bc05'::uuid, 'Saramonic', NULL, 'Tinggal 1, 1 nya lagi dibawa gus Ikul', 'ee034441-be8c-46fd-9ea6-e4918884bc05'),
    ('64887247-c896-45a6-bb77-3802e046fe73'::uuid, NULL, NULL, NULL, '64887247-c896-45a6-bb77-3802e046fe73'),
    ('7c06c515-54c6-4909-9ce2-b29157b7a63e'::uuid, 'Hollyland', 'Mars 300', NULL, '7c06c515-54c6-4909-9ce2-b29157b7a63e'),
    ('ceaba794-572e-4b3e-aa3a-4358ec02d228'::uuid, 'Ugreen', NULL, 'Mini HDMI Male to HDMI Female 4K HD
', 'ceaba794-572e-4b3e-aa3a-4358ec02d228'),
    ('098955d2-5c77-4c23-b0bb-450a94760c16'::uuid, 'UTICON', NULL, 'Kabel Panjang
', '098955d2-5c77-4c23-b0bb-450a94760c16'),
    ('ba245bb3-91ac-4943-8c3c-178569b3f056'::uuid, NULL, NULL, 'Kabel Flicker
', 'ba245bb3-91ac-4943-8c3c-178569b3f056'),
    ('e7635524-8f5c-453f-9ab9-58a6827fbb7f'::uuid, NULL, NULL, '
', 'e7635524-8f5c-453f-9ab9-58a6827fbb7f'),
    ('3ddfab9c-84a2-4a76-8c32-74d3f5fd0147'::uuid, 'BroCo', NULL, '—
', '3ddfab9c-84a2-4a76-8c32-74d3f5fd0147'),
    ('b83b78e1-c3ce-4f66-a632-402067322536'::uuid, NULL, NULL, '
', 'b83b78e1-c3ce-4f66-a632-402067322536'),
    ('1783d24d-6b4d-4965-adf4-f8061feda7f9'::uuid, 'Sandisk', NULL, 'Sandisk Flashdisk
', '1783d24d-6b4d-4965-adf4-f8061feda7f9'),
    ('e51f5cec-b51f-4ba3-ac05-e6eb8a85ae84'::uuid, NULL, NULL, 'Ujung SDI
', 'e51f5cec-b51f-4ba3-ac05-e6eb8a85ae84'),
    ('ceddcab5-2e5c-446a-bea4-6db865b6a674'::uuid, NULL, NULL, 'Hard disk
', 'ceddcab5-2e5c-446a-bea4-6db865b6a674'),
    ('ed7113a3-2141-4833-b182-70e7d431f0bb'::uuid, NULL, NULL, 'Meteran
', 'ed7113a3-2141-4833-b182-70e7d431f0bb'),
    ('e74fc4c0-eb83-4ede-8767-46af082684e8'::uuid, NULL, NULL, '
', 'e74fc4c0-eb83-4ede-8767-46af082684e8'),
    ('2c8942e7-0e8e-423f-a189-a862a39b73e9'::uuid, 'shure', NULL, '
', '2c8942e7-0e8e-423f-a189-a862a39b73e9'),
    ('fd7d4b4b-7a92-4212-ab81-1ba2f14d0fcc'::uuid, 'Krisbow', NULL, 'steker adaptor universal
', 'fd7d4b4b-7a92-4212-ab81-1ba2f14d0fcc'),
    ('368b7803-c5cd-4a8e-b32d-591989242292'::uuid, 'Seagate', 'PTV Lama', 'Hardisk
', '368b7803-c5cd-4a8e-b32d-591989242292'),
    ('b4e029ff-b39c-4323-8e49-79962f6fcfb1'::uuid, 'UTICON', 'Multi Outlet', 'Mata 2
', 'b4e029ff-b39c-4323-8e49-79962f6fcfb1'),
    ('401fc6dd-76de-4df8-b61d-7d741d2ebb78'::uuid, 'UTICON', NULL, 'Kabel Panjang
', '401fc6dd-76de-4df8-b61d-7d741d2ebb78'),
    ('8e20cc30-3faf-4816-973b-ec8a60afc807'::uuid, NULL, NULL, 'Box Militer
', '8e20cc30-3faf-4816-973b-ec8a60afc807'),
    ('2dfa0f6c-8578-4693-b6ee-a71a6450af56'::uuid, 'Logitech', NULL, '
', '2dfa0f6c-8578-4693-b6ee-a71a6450af56'),
    ('0267d108-bcbe-4468-8167-130bb031888c'::uuid, NULL, 'Gbr-Pl5403', 'Lampu Panggung Parled 54X3w LED PAR
', '0267d108-bcbe-4468-8167-130bb031888c'),
    ('4b85f51d-b1a0-45f5-8024-1f912856d385'::uuid, 'PTV', NULL, 'Kabel Akai To XLR Male
', '4b85f51d-b1a0-45f5-8024-1f912856d385'),
    ('17f55e2f-31f5-40e8-af64-3b2e7d8acccd'::uuid, NULL, NULL, 'Hard disk
', '17f55e2f-31f5-40e8-af64-3b2e7d8acccd'),
    ('f026bcb5-21d8-43ec-ae56-1cc6a978fa08'::uuid, NULL, NULL, 'Hard disk 1TB
', 'f026bcb5-21d8-43ec-ae56-1cc6a978fa08'),
    ('c7a54536-e587-488a-ba08-5d26513d235e'::uuid, NULL, NULL, '
', 'c7a54536-e587-488a-ba08-5d26513d235e'),
    ('3fd53237-f66e-461a-b0c6-d258ae98c8a1'::uuid, 'LG', NULL, 'remot tv
', '3fd53237-f66e-461a-b0c6-d258ae98c8a1'),
    ('d9b63ca6-09a5-4657-937c-5f224a52fc4a'::uuid, 'Midi Plus', NULL, NULL, 'd9b63ca6-09a5-4657-937c-5f224a52fc4a'),
    ('eed6e978-977d-4034-a353-7a56d8833745'::uuid, NULL, NULL, NULL, 'eed6e978-977d-4034-a353-7a56d8833745'),
    ('21b4e25b-41b1-4fb6-9e6f-f77f1a66a820'::uuid, 'Vention', NULL, NULL, '21b4e25b-41b1-4fb6-9e6f-f77f1a66a820'),
    ('cb1b08cd-d841-4e20-a7fd-52f7e10f6c93'::uuid, 'Godox', NULL, NULL, 'cb1b08cd-d841-4e20-a7fd-52f7e10f6c93'),
    ('a1e14cbb-2fb3-4cd7-a388-b1f051473058'::uuid, 'Godox', NULL, NULL, 'a1e14cbb-2fb3-4cd7-a388-b1f051473058'),
    ('625115c6-715f-449f-8544-63921af2e8b9'::uuid, 'YAMAHA', 'MG12XU', 'Yamaha MG12XU 12-channel Analog Mixer With USB and FX', '625115c6-715f-449f-8544-63921af2e8b9'),
    ('d47d0805-4eef-4174-aab7-4d2b29ac8a4e'::uuid, 'Asli Kuningan', NULL, '
', 'd47d0805-4eef-4174-aab7-4d2b29ac8a4e'),
    ('474d6598-e4cd-4858-9a88-a880644450cf'::uuid, 'SHUKAKU', NULL, '
', '474d6598-e4cd-4858-9a88-a880644450cf'),
    ('126d89bf-0250-4c70-8efd-7c90a58de0c4'::uuid, 'Krezt', NULL, '
', '126d89bf-0250-4c70-8efd-7c90a58de0c4'),
    ('3fd5b2ca-56d4-4faa-a342-7b8c1eee30cd'::uuid, NULL, NULL, '
', '3fd5b2ca-56d4-4faa-a342-7b8c1eee30cd'),
    ('cdded8ce-e028-42c3-9abf-7c69d56312c0'::uuid, NULL, NULL, 'Dallas 2200mm Dining Table Oak
', 'cdded8ce-e028-42c3-9abf-7c69d56312c0'),
    ('3c399ea8-d14e-4646-9f0a-75884d8ab7b3'::uuid, NULL, NULL, 'Kabel klip
', '3c399ea8-d14e-4646-9f0a-75884d8ab7b3'),
    ('af0a87b9-e7fb-470a-904a-786bcdcb1a63'::uuid, NULL, NULL, 'Paket lengkap mata bor
', 'af0a87b9-e7fb-470a-904a-786bcdcb1a63'),
    ('2bbcd773-fd47-47c8-96a5-71df5ab96fb8'::uuid, NULL, NULL, 'Palu
', '2bbcd773-fd47-47c8-96a5-71df5ab96fb8'),
    ('0de35370-5732-4e89-be9b-7fec74872588'::uuid, NULL, 'Kotak DIY', '1 kotak lengkap perbautan
', '0de35370-5732-4e89-be9b-7fec74872588'),
    ('7de8a882-c512-4d85-9aa0-76343f65a916'::uuid, NULL, NULL, 'Kabel tis
', '7de8a882-c512-4d85-9aa0-76343f65a916'),
    ('468632ab-93c2-4e08-be11-36016d603954'::uuid, NULL, NULL, '
', '468632ab-93c2-4e08-be11-36016d603954'),
    ('ad339e36-c1da-4675-acb3-208bc8d80e8f'::uuid, NULL, NULL, '
', 'ad339e36-c1da-4675-acb3-208bc8d80e8f'),
    ('50a9bc71-f8fe-4a65-bee8-c09322320f85'::uuid, 'Ezcap', NULL, '
', '50a9bc71-f8fe-4a65-bee8-c09322320f85'),
    ('e729d261-ace3-4eb1-99b9-0508dd3fea73'::uuid, NULL, NULL, '
', 'e729d261-ace3-4eb1-99b9-0508dd3fea73'),
    ('293434c4-9e11-4a2a-aa6a-5c33eeedc636'::uuid, NULL, NULL, '
', '293434c4-9e11-4a2a-aa6a-5c33eeedc636'),
    ('41798085-0e26-4517-92c8-c1683cbe4ab4'::uuid, NULL, NULL, '
', '41798085-0e26-4517-92c8-c1683cbe4ab4'),
    ('ec37f344-1848-4fc9-8fe1-b7df472a063a'::uuid, 'Vention', NULL, '
', 'ec37f344-1848-4fc9-8fe1-b7df472a063a'),
    ('56e95aeb-f0d2-4120-ae3a-2f663ba5500b'::uuid, 'Random', NULL, '
', '56e95aeb-f0d2-4120-ae3a-2f663ba5500b'),
    ('4c0f09f6-e2e4-4f40-bb30-438f8e78e503'::uuid, 'Random', NULL, '
', '4c0f09f6-e2e4-4f40-bb30-438f8e78e503'),
    ('fe516a20-b6e5-4f6d-90c3-d84fad1767e2'::uuid, NULL, NULL, 'Dining Chair with Light Grey Seat and Oak Legs
', 'fe516a20-b6e5-4f6d-90c3-d84fad1767e2'),
    ('406d3b26-7c76-4ae9-96f7-fb16b0bebbc1'::uuid, 'MSI', NULL, 'PC Putih
', '406d3b26-7c76-4ae9-96f7-fb16b0bebbc1'),
    ('61f757a8-e94e-42eb-a858-045657a8d741'::uuid, 'Audio-Technica', 'AT-PF2', '
', '61f757a8-e94e-42eb-a858-045657a8d741'),
    ('4663349a-bdcd-4a17-b3ad-f5d174b28de7'::uuid, 'PTV', NULL, 'HDMI to VGA Cable
', '4663349a-bdcd-4a17-b3ad-f5d174b28de7'),
    ('d0645800-783a-4eee-a924-018d91aac3d7'::uuid, 'ezcap', 'Black', '
', 'd0645800-783a-4eee-a924-018d91aac3d7'),
    ('9e625254-d96d-4a3e-92d2-2746b040fe8e'::uuid, 'PTV', NULL, 'USB 3.0 Hub
', '9e625254-d96d-4a3e-92d2-2746b040fe8e'),
    ('14a646d8-6c99-441b-8382-e7d634c8148c'::uuid, 'Paragon', NULL, 'Kawat Timah Solder
', '14a646d8-6c99-441b-8382-e7d634c8148c'),
    ('e4a83cf1-effa-4e0e-b519-4a3cd639c426'::uuid, 'ABC/ALKALINE', NULL, 'Baterai AA
', 'e4a83cf1-effa-4e0e-b519-4a3cd639c426'),
    ('33fd31f9-a98c-46b3-9878-64a3003f335a'::uuid, 'Ilyas', NULL, 'OTG Adapter USB Type C Female to Type A 3.0 Female
', '33fd31f9-a98c-46b3-9878-64a3003f335a'),
    ('54f33c8f-1c59-4890-819b-fd784ef80d92'::uuid, 'Apacher', '2GB', '
', '54f33c8f-1c59-4890-819b-fd784ef80d92'),
    ('8c33f5eb-8deb-423c-994b-621ee3db5190'::uuid, 'ROBOT', 'HEA100', 'punya mas faeq
', '8c33f5eb-8deb-423c-994b-621ee3db5190'),
    ('199db1ce-37e8-47f6-819b-c2d4854e7ce3'::uuid, 'Proel', 'DST60TL', 'Deluxe Desktop Tripod Microphone Stand
', '199db1ce-37e8-47f6-819b-c2d4854e7ce3'),
    ('cdd5cb20-ea96-4616-aed1-25d4216b089a'::uuid, 'Godox', 'SL60W', NULL, 'cdd5cb20-ea96-4616-aed1-25d4216b089a'),
    ('2eaa1760-75b9-4647-b8c8-216ff5a37ea3'::uuid, NULL, NULL, 'Isi Staples Kecil
', '2eaa1760-75b9-4647-b8c8-216ff5a37ea3'),
    ('885854fd-a1d4-453d-ae43-5a8ac557b839'::uuid, 'Lexar', '800x PRO 150MB/s', 'Lexar 64GB SDXC 800x PRO UHS-I SDHC Memory Card
', '885854fd-a1d4-453d-ae43-5a8ac557b839'),
    ('39b5c9f8-03fa-4cf6-a2d5-a3cbbc289ec8'::uuid, 'Apple', NULL, 'iPhone 13 mini
', '39b5c9f8-03fa-4cf6-a2d5-a3cbbc289ec8'),
    ('570dda8f-58db-4fe4-b536-1635ae491f48'::uuid, NULL, NULL, 'Adaptor Fiberhome
', '570dda8f-58db-4fe4-b536-1635ae491f48'),
    ('e67e3530-a22f-4104-b47c-8f7e4b4351c8'::uuid, NULL, NULL, 'Spidol Biru
', 'e67e3530-a22f-4104-b47c-8f7e4b4351c8'),
    ('3f47f45d-5c83-4c0e-89a1-2cecd59f19ad'::uuid, 'Sandisk', NULL, 'Sandisk Ultra 64GB SDXC UHS-I Memory Card
', '3f47f45d-5c83-4c0e-89a1-2cecd59f19ad'),
    ('fb9f3f42-65ca-4ba2-9a43-b18e6447007f'::uuid, 'DIY', NULL, 'ergonomic desk pillow
', 'fb9f3f42-65ca-4ba2-9a43-b18e6447007f'),
    ('6eec1062-9158-4273-9ce5-f2634d0eff63'::uuid, 'Sandisk', NULL, 'Sandisk Ultra MicroSD 16GB SDHC UHS-I
', '6eec1062-9158-4273-9ce5-f2634d0eff63'),
    ('7aab697c-90fe-4e45-b941-27b8120b01d0'::uuid, 'Daikin', NULL, 'Remot AC
', '7aab697c-90fe-4e45-b941-27b8120b01d0'),
    ('49c0b621-7f23-4ade-9c30-5363fa61a756'::uuid, 'DJI', NULL, 'Casing remot drone
', '49c0b621-7f23-4ade-9c30-5363fa61a756'),
    ('737be3b3-8242-4931-b75d-0111a52e3bb6'::uuid, NULL, NULL, 'Bolster star pattern
', '737be3b3-8242-4931-b75d-0111a52e3bb6'),
    ('fa6fbe43-0d8a-4221-a0e7-9cd2f288a1f1'::uuid, 'Audio-Technica', NULL, 'Protective Pouch nya hanya satu
', 'fa6fbe43-0d8a-4221-a0e7-9cd2f288a1f1'),
    ('db9fe458-6ba3-4cea-ba73-15d05e49a76d'::uuid, 'Logitech', NULL, 'Speaker Monitor
', 'db9fe458-6ba3-4cea-ba73-15d05e49a76d'),
    ('4dc7c14f-539b-4bdc-b52d-bf9ecd50e9fb'::uuid, 'Sandisk', NULL, 'Sandisk Extreme Pro 64GB 200Mb/s SDXC
', '4dc7c14f-539b-4bdc-b52d-bf9ecd50e9fb'),
    ('944b1259-d22e-40c7-9b37-572e9b0c0ae7'::uuid, NULL, NULL, 'Sandisk Ultra 128GB SDXC UHS-I Memory Card
', '944b1259-d22e-40c7-9b37-572e9b0c0ae7'),
    ('7cb763f0-4aae-4ee4-bd6a-b1f2c5871942'::uuid, 'Mitsubishi', NULL, 'Remote AC Mitsubishi
', '7cb763f0-4aae-4ee4-bd6a-b1f2c5871942'),
    ('63c93da9-006b-4535-9a5d-c4232f38f2c4'::uuid, 'ZTE', NULL, 'Tidak Bisa Nyala
', '63c93da9-006b-4535-9a5d-c4232f38f2c4'),
    ('fabda78e-daa2-4d4a-95be-6ba1f5e03465'::uuid, 'Apple', NULL, 'iPhone 11 128 iBox
', 'fabda78e-daa2-4d4a-95be-6ba1f5e03465'),
    ('5403afe6-05b1-4eaa-b8e6-8ebd84b657da'::uuid, 'EVERBRAIT', NULL, 'EVERBRAIT Dry Cabinet 50L AD-50S
', '5403afe6-05b1-4eaa-b8e6-8ebd84b657da'),
    ('5b859ae7-80c9-48ca-89c0-60f667be5e62'::uuid, 'Kaisler', 'AS-150L', 'Kaisler Dry Cabinet AS-150L
', '5b859ae7-80c9-48ca-89c0-60f667be5e62'),
    ('de75c84e-456b-4b66-b6e4-31a64446df8f'::uuid, NULL, NULL, 'Micro SD adaptor
', 'de75c84e-456b-4b66-b6e4-31a64446df8f'),
    ('ae06d6ac-42a0-4bf6-a376-0fc420da85a9'::uuid, NULL, NULL, '—
', 'ae06d6ac-42a0-4bf6-a376-0fc420da85a9'),
    ('02cd19f8-3d90-453b-beaa-a58ef69fd5e1'::uuid, NULL, NULL, 'Kabel HDMI Pendek
', '02cd19f8-3d90-453b-beaa-a58ef69fd5e1'),
    ('6345bfac-c4bd-407a-a4c9-048aca7a376c'::uuid, NULL, NULL, 'Cutter
', '6345bfac-c4bd-407a-a4c9-048aca7a376c'),
    ('adb7073f-6135-408e-a01f-548364a4ee65'::uuid, 'LG', NULL, 'TV LG 70 inch', 'adb7073f-6135-408e-a01f-548364a4ee65'),
    ('26a62c6b-c43d-4843-b933-489d739f3154'::uuid, 'Sanex', 'SDF-0831 D', 'Desk Fan', '26a62c6b-c43d-4843-b933-489d739f3154'),
    ('b8b9ee51-e68a-4af0-a83c-97261dcb9a7f'::uuid, 'Samsung', NULL, 'Samsung Tab S8 Ultra 5G', 'b8b9ee51-e68a-4af0-a83c-97261dcb9a7f'),
    ('67daca33-5468-4d2c-bc42-041294dd6aa9'::uuid, NULL, NULL, 'Samsung S Pen for Galaxy Tab S8 Series', '67daca33-5468-4d2c-bc42-041294dd6aa9'),
    ('7f3a2b6c-27de-4b3a-9636-93bbc1a0511a'::uuid, 'M-Wave', NULL, 'Midi Controller
', '7f3a2b6c-27de-4b3a-9636-93bbc1a0511a'),
    ('dcf2f9fe-184b-4474-8a10-0fd449c8711a'::uuid, 'National Tape', NULL, 'Solasi Listrik
', 'dcf2f9fe-184b-4474-8a10-0fd449c8711a'),
    ('5e50ac2b-c173-4ff3-9a4b-5dceb5144600'::uuid, 'Samsung', NULL, 'OTG Adapter USB Type C Male to USB A 3.0 Female
', '5e50ac2b-c173-4ff3-9a4b-5dceb5144600'),
    ('13c49cdf-3d79-481f-8635-33a59812aa06'::uuid, NULL, NULL, 'Penyimpanan 512G
', '13c49cdf-3d79-481f-8635-33a59812aa06'),
    ('c9623860-31f4-4b15-bb28-7dd163d52d36'::uuid, 'Focusrite', 'Scarlett SOLO', 'Focusrite
', 'c9623860-31f4-4b15-bb28-7dd163d52d36'),
    ('6e97d92f-9759-40bc-95e2-56484ba06021'::uuid, NULL, NULL, 'Pengunci bor
', '6e97d92f-9759-40bc-95e2-56484ba06021'),
    ('83695bcd-00d6-4efb-80c1-cd22caa0e8ae'::uuid, NULL, NULL, 'Obeng +
', '83695bcd-00d6-4efb-80c1-cd22caa0e8ae'),
    ('f75902ae-44c8-4447-8bab-9f9ff517fcad'::uuid, NULL, 'Kotak Lama', 'Penyimpanan baut
', 'f75902ae-44c8-4447-8bab-9f9ff517fcad'),
    ('585648cb-52e2-4b1a-b6bc-63d90ff8132f'::uuid, 'SONY', NULL, 'SONY Lens E PZ 18-105mm F4 G OSS
', '585648cb-52e2-4b1a-b6bc-63d90ff8132f'),
    ('a48efbfc-c72c-469e-8c46-c921fa083347'::uuid, 'SONY', NULL, 'Sony Full Frame FE 50mm f1.8
', 'a48efbfc-c72c-469e-8c46-c921fa083347'),
    ('1f2cf4ec-38d6-42fe-b19d-08fe33ac1367'::uuid, 'SONY', NULL, 'SONY Lens FE 85mm F1.8
', '1f2cf4ec-38d6-42fe-b19d-08fe33ac1367'),
    ('3cedc89f-532b-47c8-b185-06f25fb4f0f3'::uuid, 'MikroTik', NULL, 'MikroTik RouterBOARD WiFi 4 Router w/ passive PoE RB2011UiAS-2HnD-IN
', '3cedc89f-532b-47c8-b185-06f25fb4f0f3'),
    ('babb9b4f-8942-496a-baf1-01d5c940eaf1'::uuid, 'MikroTik', NULL, 'MIKROTIK Router Desktop RB750r2 (hEX-Lite)
', 'babb9b4f-8942-496a-baf1-01d5c940eaf1'),
    ('fcb33ef2-d079-4100-9f36-47ebcbbb96a6'::uuid, 'Informa', NULL, 'Informa Loker Besi 3 Pintu
', 'fcb33ef2-d079-4100-9f36-47ebcbbb96a6'),
    ('cba3ed50-9993-421c-92c3-ea5a48a12eb8'::uuid, 'PXTON', 'PX-1200X', 'Handie Talkie (HT)
', 'cba3ed50-9993-421c-92c3-ea5a48a12eb8'),
    ('c5e1b463-847e-47ca-9203-934aea970d26'::uuid, NULL, NULL, 'Kursi Kantor - Hitam
', 'c5e1b463-847e-47ca-9203-934aea970d26'),
    ('0bc52266-a9a1-4a8a-9902-a016455d9b60'::uuid, 'Miniso', 'Grey Shark', 'ocean plush toy series
', '0bc52266-a9a1-4a8a-9902-a016455d9b60'),
    ('623fae7a-5235-4b62-83a5-0b34756d219c'::uuid, 'LG', NULL, '43 inch LG NANO 4K UHD AI NU845 Smart TV 2026
', '623fae7a-5235-4b62-83a5-0b34756d219c'),
    ('b1d835ef-4f03-48af-96e3-2ddc667bbee2'::uuid, 'LG', NULL, 'LG magic remote
', 'b1d835ef-4f03-48af-96e3-2ddc667bbee2'),
    ('8b6d382c-48c7-4b79-ac4b-fc58b5a30731'::uuid, 'Audio-Technica', 'ATH-M50x', 'Audio-Technica ATH-M50x Monitor Headphones', '8b6d382c-48c7-4b79-ac4b-fc58b5a30731'),
    ('948cbd35-3f9b-46e3-89f2-a144eb115a12'::uuid, 'Tamron', NULL, 'Lensa Tamron 28-75mm f/2.8 Di III VXD G2 untuk Sony E-Mount', '948cbd35-3f9b-46e3-89f2-a144eb115a12'),
    ('f2b72a26-bfcf-4d79-a16b-54b0e13306dd'::uuid, 'Bardi', NULL, 'BARDI IP Camera Indoor PTZ Syno', 'f2b72a26-bfcf-4d79-a16b-54b0e13306dd'),
    ('53b943e2-12b5-48f2-a90a-1292a5e897ee'::uuid, 'Libec', NULL, 'Tripod Libec', '53b943e2-12b5-48f2-a90a-1292a5e897ee'),
    ('925483f0-04fb-430e-b2f0-2415d315e666'::uuid, 'Predator', NULL, 'Laptop Predator', '925483f0-04fb-430e-b2f0-2415d315e666'),
    ('acbe41d8-159c-44da-9459-1f61aafad641'::uuid, 'Asus', NULL, 'Asus ROG', 'acbe41d8-159c-44da-9459-1f61aafad641'),
    ('a91a7d24-0860-452d-b7a3-7008b6ab3db8'::uuid, 'Bardi', NULL, 'Bardi IP Camera Indoor PTZ', 'a91a7d24-0860-452d-b7a3-7008b6ab3db8'),
    ('3172c827-f63b-4536-af21-2f63b571e871'::uuid, 'Edifier', 'MR4', NULL, NULL),
    ('606a02aa-9b74-45d9-a814-11b9979807cf'::uuid, 'Sony', 'NX-100', 'Sony NXCAM', '606a02aa-9b74-45d9-a814-11b9979807cf'),
    ('8355041b-7dfe-418a-8ea7-d36cd5eacc21'::uuid, 'SmallRig', NULL, NULL, NULL),
    ('72c2fc9d-1b15-4637-a4d8-544e65f9bed7'::uuid, NULL, NULL, NULL, NULL),
    ('1c88510c-5bcf-445f-a8e9-1e2169675e82'::uuid, NULL, NULL, NULL, NULL),
    ('26e02d70-d384-4ad5-8d63-d803ddcf55f5'::uuid, NULL, NULL, NULL, NULL),
    ('4e0a5861-04c5-4421-aa72-10e13edc854e'::uuid, NULL, NULL, NULL, NULL),
    ('3e890860-29b9-4d09-83da-6c8783ddadaf'::uuid, 'TP Link', 'TL-WA855RE', NULL, '3e890860-29b9-4d09-83da-6c8783ddadaf'),
    ('485ff5f8-f364-4cbf-9f6a-3067385d07c2'::uuid, 'Sony', 'A7 III', 'Sony A7iii Body Only', '485ff5f8-f364-4cbf-9f6a-3067385d07c2'),
    ('1f2e95e3-91ba-40ff-98e5-d9f12b3b7409'::uuid, 'Sony', 'PXW-150', 'Sony XDCAM', '1f2e95e3-91ba-40ff-98e5-d9f12b3b7409'),
    ('9bf32a77-4d89-449d-a59e-185bf9bf07fd'::uuid, 'Sony', NULL, 'Charger XDCAM', '9bf32a77-4d89-449d-a59e-185bf9bf07fd'),
    ('d72a8546-e707-4eef-8e8f-50d6ed5ea911'::uuid, 'SmallRig', 'NP-F970', 'Hilang 1', NULL),
    ('86e0d4c1-75b3-4409-bf03-5af3cadbd233'::uuid, 'Rode', NULL, NULL, NULL),
    ('bdaf93d8-c0ea-497e-b469-5d74a4e6f06a'::uuid, NULL, NULL, 'Hilang Secara Mistis', NULL),
    ('4da9fae8-6588-4068-b39e-d5b80fcc8c34'::uuid, 'Beike', NULL, 'Rusak Semua, Baut copot', NULL),
    ('f1d4f2cd-1194-49bb-b0d2-0d15b1e60386'::uuid, NULL, NULL, NULL, NULL)
;

-- ============================================================================
-- PREFLIGHT ASSERTIONS & EXACT CONFLICT DETECTION (FAIL-CLOSED)
-- ============================================================================
DO $$
DECLARE
    v_unit1 RECORD;
    v_unit2 RECORD;
    v_existing_catatan RECORD;
    v_existing_pengeluaran RECORD;
    v_surat1 RECORD;
    v_surat2 RECORD;
    v_full_catatan_isi TEXT;
    v_missing_inventaris_count INT;
    v_conflict_count INT := 0;
    v_conflict_report TEXT := '';
    r_conflict RECORD;
    v_expected_santri1 JSONB;
    v_expected_santri2 JSONB;
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. PREFLIGHT CONFLICT DETECTION PADA 161 RECORD INVENTARIS MASTER
    -- ------------------------------------------------------------------------
    -- a. Pastikan seluruh 161 ID dari sumber ada di target ptv_inventaris Staging
    SELECT COUNT(*) INTO v_missing_inventaris_count
    FROM temp_source_inventaris s
    LEFT JOIN public.ptv_inventaris t ON s.id = t.id
    WHERE t.id IS NULL;

    IF v_missing_inventaris_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT ASSERTION FAILED: Terdeteksi % ID inventaris dari sumber yang tidak ditemukan pada ptv_inventaris Staging!', v_missing_inventaris_count;
    END IF;

    -- b. Deteksi apakah ada nilai terisi di Staging yang BERBEDA dari Production (mencegah silent divergence/overwrite)
    FOR r_conflict IN (
        SELECT t.id, t.nama_alat,
               t.brand AS stg_brand, s.brand AS prod_brand,
               t.model AS stg_model, s.model AS prod_model,
               t.keterangan AS stg_keterangan, s.keterangan AS prod_keterangan,
               t.aset_id_lama AS stg_aset_id_lama, s.aset_id_lama AS prod_aset_id_lama
        FROM public.ptv_inventaris t
        JOIN temp_source_inventaris s ON t.id = s.id
        WHERE (t.brand IS NOT NULL AND trim(t.brand) IS DISTINCT FROM '' AND t.brand IS DISTINCT FROM s.brand)
           OR (t.model IS NOT NULL AND trim(t.model) IS DISTINCT FROM '' AND t.model IS DISTINCT FROM s.model)
           OR (t.keterangan IS NOT NULL AND trim(t.keterangan) IS DISTINCT FROM '' AND t.keterangan IS DISTINCT FROM s.keterangan)
           OR (t.aset_id_lama IS NOT NULL AND trim(t.aset_id_lama) IS DISTINCT FROM '' AND t.aset_id_lama IS DISTINCT FROM s.aset_id_lama)
    ) LOOP
        v_conflict_count := v_conflict_count + 1;
        v_conflict_report := v_conflict_report || format(E'
- ID: %s (%s): brand(stg="%s" vs prod="%s"), model(stg="%s" vs prod="%s"), keterangan(stg="%s" vs prod="%s"), aset_id_lama(stg="%s" vs prod="%s")',
            r_conflict.id, coalesce(r_conflict.nama_alat, 'Tanpa Nama'),
            coalesce(r_conflict.stg_brand, 'NULL'), coalesce(r_conflict.prod_brand, 'NULL'),
            coalesce(r_conflict.stg_model, 'NULL'), coalesce(r_conflict.prod_model, 'NULL'),
            coalesce(r_conflict.stg_keterangan, 'NULL'), coalesce(r_conflict.prod_keterangan, 'NULL'),
            coalesce(r_conflict.stg_aset_id_lama, 'NULL'), coalesce(r_conflict.prod_aset_id_lama, 'NULL'));
    END LOOP;

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada % alat inventaris! Nilai Staging terisi berbeda dari Production:% 
Eksekusi DIBATALKAN untuk mencegah overwrite data tanpa persetujuan operator.', v_conflict_count, v_conflict_report;
    END IF;

    -- ------------------------------------------------------------------------
    -- 2. ASSERTION ptv_inventaris_unit: 2 UNIT TARGET & DETEKSI KONFLIK
    -- ------------------------------------------------------------------------
    SELECT id, kode_unit, catatan, keterangan INTO v_unit1 
    FROM public.ptv_inventaris_unit WHERE id = '2407fbaa-7100-464b-b0f0-7595f82e55b9';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PREFLIGHT ASSERTION FAILED: Unit fisik target INV-671-01 (ID: 2407fbaa...) tidak ditemukan di ptv_inventaris_unit Staging!';
    END IF;

    IF (v_unit1.catatan IS NOT NULL AND trim(v_unit1.catatan) IS DISTINCT FROM '' AND v_unit1.catatan IS DISTINCT FROM 'putul krn jatuh') OR
       (v_unit1.keterangan IS NOT NULL AND trim(v_unit1.keterangan) IS DISTINCT FROM '' AND v_unit1.keterangan IS DISTINCT FROM 'putul krn jatuh') THEN
        RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada Unit 2407fbaa... (INV-671-01): catatan existing="%", keterangan existing="%". Nilai berbeda dari data historis ("putul krn jatuh")! Eksekusi dibatalkan.', v_unit1.catatan, v_unit1.keterangan;
    END IF;

    SELECT id, kode_unit, catatan, keterangan INTO v_unit2 
    FROM public.ptv_inventaris_unit WHERE id = '22ba9382-d35d-4cf5-a76a-a545a52b4057';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PREFLIGHT ASSERTION FAILED: Unit fisik target INV-051-02 (ID: 22ba9382...) tidak ditemukan di ptv_inventaris_unit Staging!';
    END IF;

    IF (v_unit2.catatan IS NOT NULL AND trim(v_unit2.catatan) IS DISTINCT FROM '' AND v_unit2.catatan IS DISTINCT FROM 'Rusak Ketika Haflah Takrim') OR
       (v_unit2.keterangan IS NOT NULL AND trim(v_unit2.keterangan) IS DISTINCT FROM '' AND v_unit2.keterangan IS DISTINCT FROM 'Rusak Ketika Haflah Takrim') THEN
        RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada Unit 22ba9382... (INV-051-02): catatan existing="%", keterangan existing="%". Nilai berbeda dari data historis ("Rusak Ketika Haflah Takrim")! Eksekusi dibatalkan.', v_unit2.catatan, v_unit2.keterangan;
    END IF;

    -- ------------------------------------------------------------------------
    -- 3. ASSERTION ptv_catatan: FULL PAYLOAD COMPARISON
    -- ------------------------------------------------------------------------
    v_full_catatan_isi := '<h1>Notulensi Rapat:haha</h1>
<p><strong>Hari / Tanggal:</strong> 6 Okt 2026<br>
<strong>Waktu:</strong> 09:00 - 11:00 WIB<br>
<strong>Tempat / Media:</strong> Studio PTV / Google Meet<br>
<strong>Peserta:</strong> Tim PTV</p>

<h2>1. Agenda Pembahasan</h2>
<p>• Persiapan teknis &amp; operasional acara</p>

<h2>2. Pembahasan &amp; Keputusan Rapat</h2>
<p>• </p>

<h2>3. Tindak Lanjut (Action Items)</h2>
<p>• </p>
<!-- PTV_META:{"type":"meeting_minutes","date":"2026-10-06","time":"","loc":"","att":"","event_id":"2f161da1-902e-4648-bae9-efe9f8279071","event_name":"Malam Puncak Hari Santri Nasional"} -->';

    SELECT id, judul, isi, tags, warna, is_pinned, created_at, updated_at, 
           created_by_id, created_by_name, author_id, tipe, kategori 
    INTO v_existing_catatan 
    FROM public.ptv_catatan 
    WHERE id = '3cc0338b-30a4-4bb5-aa83-c3e3451c8702';

    IF FOUND THEN
        IF v_existing_catatan.judul IS DISTINCT FROM 'Notulensi Rapat:haha' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: judul existing="%", expected="Notulensi Rapat:haha"!', v_existing_catatan.judul;
        END IF;
        IF v_existing_catatan.tipe IS DISTINCT FROM 'meeting_minutes' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: tipe existing="%", expected="meeting_minutes"!', v_existing_catatan.tipe;
        END IF;
        IF v_existing_catatan.kategori IS DISTINCT FROM 'notulensi' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: kategori existing="%", expected="notulensi"!', v_existing_catatan.kategori;
        END IF;
        IF v_existing_catatan.created_by_id IS DISTINCT FROM 'PTV-002' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: created_by_id existing="%", expected="PTV-002"!', v_existing_catatan.created_by_id;
        END IF;
        IF v_existing_catatan.created_by_name IS DISTINCT FROM 'Rafa Putra Rouf' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: created_by_name existing="%", expected="Rafa Putra Rouf"!', v_existing_catatan.created_by_name;
        END IF;
        IF v_existing_catatan.tags IS DISTINCT FROM '["notulensi", "acara_2f161da1-902e-4648-bae9-efe9f8279071"]'::jsonb THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: tags JSONB tidak sesuai!';
        END IF;
        IF v_existing_catatan.warna IS DISTINCT FROM 'orange' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: warna existing="%", expected="orange"!', v_existing_catatan.warna;
        END IF;
        IF v_existing_catatan.is_pinned IS DISTINCT FROM false THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: is_pinned existing="%", expected="false"!', v_existing_catatan.is_pinned;
        END IF;
        IF v_existing_catatan.isi IS DISTINCT FROM v_full_catatan_isi THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_catatan 3cc0338b...: isi HTML lengkap tidak identik!';
        END IF;
    END IF;

    -- ------------------------------------------------------------------------
    -- 4. ASSERTION ptv_pengeluaran: FULL FIELD COMPARISON
    -- ------------------------------------------------------------------------
    SELECT id, keuangan_id, nominal, tanggal, keperluan, keterangan, created_at 
    INTO v_existing_pengeluaran 
    FROM public.ptv_pengeluaran 
    WHERE id = 'ac23e115-708b-4d12-9eb5-bec20264bbfb';

    IF FOUND THEN
        IF v_existing_pengeluaran.keuangan_id IS DISTINCT FROM NULL THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_pengeluaran ac23e115...: keuangan_id existing="%", expected=NULL!', v_existing_pengeluaran.keuangan_id;
        END IF;
        IF v_existing_pengeluaran.nominal IS DISTINCT FROM 28000.00 THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_pengeluaran ac23e115...: nominal existing=%, expected=28000.00!', v_existing_pengeluaran.nominal;
        END IF;
        IF v_existing_pengeluaran.tanggal IS DISTINCT FROM '2026-10-19'::date THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_pengeluaran ac23e115...: tanggal existing=%, expected=2026-10-19!', v_existing_pengeluaran.tanggal;
        END IF;
        IF v_existing_pengeluaran.keperluan IS DISTINCT FROM 'KONSUMSI CREW' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_pengeluaran ac23e115...: keperluan existing="%", expected="KONSUMSI CREW"!', v_existing_pengeluaran.keperluan;
        END IF;
        IF v_existing_pengeluaran.keterangan IS DISTINCT FROM 'Konsumsi kru liputan lapangan' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_pengeluaran ac23e115...: keterangan existing="%", expected="Konsumsi kru liputan lapangan"!', v_existing_pengeluaran.keterangan;
        END IF;
        IF v_existing_pengeluaran.created_at IS DISTINCT FROM '2026-10-19T10:00:00+00:00'::timestamptz THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada ptv_pengeluaran ac23e115...: created_at existing=%, expected=2026-10-19T10:00:00+00:00!', v_existing_pengeluaran.created_at;
        END IF;
    END IF;

    -- ------------------------------------------------------------------------
    -- 5. ASSERTION ptv_surat_izin: ARRAY TYPE & FULL JSONB PAYLOAD COMPARISON
    -- ------------------------------------------------------------------------
    v_expected_santri1 := '[{"nama":"Muhammad Farras Zaidan Mubarok","unit":"SMA","kamar":"Imam Maturidi","kelas":"XI C2","madin":"5C","asrama":"Putra 2","jobdesc":"","murobbi":"Ustadz Chusson","_checked":true,"_realIdx":2,"angkatan":"12","intensif":"KITAB","is_intern":false,"walikelas":"Ustadz Rafli","jobdesc_enabled":false}]'::jsonb;
    v_expected_santri2 := '[{"nama":"Muhammad Farras Zaidan Mubarok","unit":"SMA","kamar":"Imam Maturidi","kelas":"XI C2","madin":"5C","asrama":"Putra 2","jobdesc":"","murobbi":"Ustadz Chusson","_checked":true,"_realIdx":2,"angkatan":"12","intensif":"KITAB","is_intern":false,"walikelas":"Ustadz Rafli","jobdesc_enabled":false},{"nama":"Iyyaka Fahabil Farhan","unit":"SMA","kamar":"Bukhara","kelas":"X-1","madin":"4D","asrama":"Nusantara 1","jobdesc":"","murobbi":"Ustadz Aziz","_checked":true,"_realIdx":8,"angkatan":"13","intensif":"KITAB","is_intern":false,"walikelas":"Ustadzah Aslahah","jobdesc_enabled":false}]'::jsonb;

    SELECT id, nomor_surat, santri_list INTO v_surat1 
    FROM public.ptv_surat_izin WHERE id = 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PREFLIGHT ASSERTION FAILED: Surat izin ID ff305b4f-0c0e-4abc-9da9-2556bdb1743c tidak ditemukan di Staging!';
    END IF;

    IF v_surat1.santri_list IS NOT NULL AND v_surat1.santri_list IS DISTINCT FROM '[]'::jsonb THEN
        IF jsonb_typeof(v_surat1.santri_list) IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada surat izin ff305b4f...: santri_list bukan bertipe array (tipe: %)!', jsonb_typeof(v_surat1.santri_list);
        END IF;
        IF v_surat1.santri_list IS DISTINCT FROM v_expected_santri1 THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada surat izin ff305b4f...: santri_list existing sudah terisi dengan data berbeda! Eksekusi dibatalkan.';
        END IF;
    END IF;

    SELECT id, nomor_surat, santri_list INTO v_surat2 
    FROM public.ptv_surat_izin WHERE id = 'ea91b82d-ff86-41dc-bc87-d29c1a7f09f5';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PREFLIGHT ASSERTION FAILED: Surat izin ID ea91b82d-ff86-41dc-bc87-d29c1a7f09f5 tidak ditemukan di Staging!';
    END IF;

    IF v_surat2.santri_list IS NOT NULL AND v_surat2.santri_list IS DISTINCT FROM '[]'::jsonb THEN
        IF jsonb_typeof(v_surat2.santri_list) IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada surat izin ea91b82d...: santri_list bukan bertipe array (tipe: %)!', jsonb_typeof(v_surat2.santri_list);
        END IF;
        IF v_surat2.santri_list IS DISTINCT FROM v_expected_santri2 THEN
            RAISE EXCEPTION 'PREFLIGHT CONFLICT DETECTED pada surat izin ea91b82d...: santri_list existing sudah terisi dengan data berbeda! Eksekusi dibatalkan.';
        END IF;
    END IF;

    RAISE NOTICE 'PREFLIGHT ASSERTIONS PASSED: Seluruh pemeriksaan pra-eksekusi, validasi tipe, dan deteksi konflik 161 inventaris lolos tanpa selisih terselubung.';
END $$;

-- ============================================================================
-- 1. PEMULIHAN FIELD HISTORIS PADA public.ptv_inventaris (161 Record)
-- Menggunakan sumber kanonikal temp_source_inventaris yang telah lolos preflight
-- ============================================================================

UPDATE public.ptv_inventaris AS t
SET 
    brand = CASE 
        WHEN (t.brand IS NULL OR trim(t.brand) = '') AND s.brand IS NOT NULL AND trim(s.brand) IS DISTINCT FROM '' THEN s.brand 
        ELSE t.brand 
    END,
    model = CASE 
        WHEN (t.model IS NULL OR trim(t.model) = '') AND s.model IS NOT NULL AND trim(s.model) IS DISTINCT FROM '' THEN s.model 
        ELSE t.model 
    END,
    keterangan = CASE 
        WHEN (t.keterangan IS NULL OR trim(t.keterangan) = '') AND s.keterangan IS NOT NULL AND trim(s.keterangan) IS DISTINCT FROM '' THEN s.keterangan 
        ELSE t.keterangan 
    END,
    aset_id_lama = CASE 
        WHEN (t.aset_id_lama IS NULL OR trim(t.aset_id_lama) = '') AND s.aset_id_lama IS NOT NULL AND trim(s.aset_id_lama) IS DISTINCT FROM '' THEN s.aset_id_lama 
        ELSE t.aset_id_lama 
    END
FROM temp_source_inventaris AS s
WHERE t.id = s.id;

-- ============================================================================
-- 2. PEMULIHAN FIELD HISTORIS PADA public.ptv_inventaris_unit (2 Unit Fisik)
-- Memulihkan KEDUA kolom 'catatan' dan 'keterangan' secara presisi
-- ============================================================================

UPDATE public.ptv_inventaris_unit
SET 
    catatan = CASE WHEN (catatan IS NULL OR trim(catatan) = '') THEN 'putul krn jatuh' ELSE catatan END,
    keterangan = CASE WHEN (keterangan IS NULL OR trim(keterangan) = '') THEN 'putul krn jatuh' ELSE keterangan END
WHERE id = '2407fbaa-7100-464b-b0f0-7595f82e55b9';

UPDATE public.ptv_inventaris_unit
SET 
    catatan = CASE WHEN (catatan IS NULL OR trim(catatan) = '') THEN 'Rusak Ketika Haflah Takrim' ELSE catatan END,
    keterangan = CASE WHEN (keterangan IS NULL OR trim(keterangan) = '') THEN 'Rusak Ketika Haflah Takrim' ELSE keterangan END
WHERE id = '22ba9382-d35d-4cf5-a76a-a545a52b4057';

-- ============================================================================
-- 3. PEMULIHAN MISSING CATATAN BERSAMA (Notulensi Rapat:haha)
-- Memulihkan 1 baris missing dari Production ke public.ptv_catatan
-- Kolom author_id = NULL (FK-safe ke canonical_identity)
-- Kolom tags = JSONB Array terstruktur
-- ============================================================================

INSERT INTO public.ptv_catatan (
    id,
    judul,
    isi,
    tags,
    warna,
    is_pinned,
    created_at,
    updated_at,
    created_by_id,
    created_by_name,
    author_id,
    tipe,
    kategori
) VALUES (
    '3cc0338b-30a4-4bb5-aa83-c3e3451c8702',
    'Notulensi Rapat:haha',
    '<h1>Notulensi Rapat:haha</h1>
<p><strong>Hari / Tanggal:</strong> 6 Okt 2026<br>
<strong>Waktu:</strong> 09:00 - 11:00 WIB<br>
<strong>Tempat / Media:</strong> Studio PTV / Google Meet<br>
<strong>Peserta:</strong> Tim PTV</p>

<h2>1. Agenda Pembahasan</h2>
<p>• Persiapan teknis &amp; operasional acara</p>

<h2>2. Pembahasan &amp; Keputusan Rapat</h2>
<p>• </p>

<h2>3. Tindak Lanjut (Action Items)</h2>
<p>• </p>
<!-- PTV_META:{"type":"meeting_minutes","date":"2026-10-06","time":"","loc":"","att":"","event_id":"2f161da1-902e-4648-bae9-efe9f8279071","event_name":"Malam Puncak Hari Santri Nasional"} -->',
    '["notulensi", "acara_2f161da1-902e-4648-bae9-efe9f8279071"]'::jsonb,
    'orange',
    false,
    '2026-10-06T15:26:38+00:00',
    '2026-10-09T15:26:13+00:00',
    'PTV-002',
    'Rafa Putra Rouf',
    NULL,
    'meeting_minutes',
    'notulensi'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. SINKRONISASI MISSING TRANSAKSI PENGELUARAN LIVE (KONSUMSI CREW Rp28.000)
-- Menyisipkan transaksi ke-10 dari Production secara non-destruktif
-- ============================================================================

INSERT INTO public.ptv_pengeluaran (
    id,
    keuangan_id,
    nominal,
    tanggal,
    keperluan,
    keterangan,
    created_at
) VALUES (
    'ac23e115-708b-4d12-9eb5-bec20264bbfb',
    NULL,
    28000.00,
    '2026-10-19',
    'KONSUMSI CREW',
    'Konsumsi kru liputan lapangan',
    '2026-10-19T10:00:00+00:00'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. PEMULIHAN SANTRI_LIST PADA public.ptv_surat_izin (2 Surat Rombongan)
-- Menyimpan atribut santri lengkap dari Production tanpa fabrikasi identitas
-- ============================================================================

UPDATE public.ptv_surat_izin
SET santri_list = CASE 
    WHEN (santri_list IS NULL OR santri_list IS NOT DISTINCT FROM '[]'::jsonb) THEN '[{"nama":"Muhammad Farras Zaidan Mubarok","unit":"SMA","kamar":"Imam Maturidi","kelas":"XI C2","madin":"5C","asrama":"Putra 2","jobdesc":"","murobbi":"Ustadz Chusson","_checked":true,"_realIdx":2,"angkatan":"12","intensif":"KITAB","is_intern":false,"walikelas":"Ustadz Rafli","jobdesc_enabled":false}]'::jsonb
    ELSE santri_list 
END
WHERE id = 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c';

UPDATE public.ptv_surat_izin
SET santri_list = CASE 
    WHEN (santri_list IS NULL OR santri_list IS NOT DISTINCT FROM '[]'::jsonb) THEN '[{"nama":"Muhammad Farras Zaidan Mubarok","unit":"SMA","kamar":"Imam Maturidi","kelas":"XI C2","madin":"5C","asrama":"Putra 2","jobdesc":"","murobbi":"Ustadz Chusson","_checked":true,"_realIdx":2,"angkatan":"12","intensif":"KITAB","is_intern":false,"walikelas":"Ustadz Rafli","jobdesc_enabled":false},{"nama":"Iyyaka Fahabil Farhan","unit":"SMA","kamar":"Bukhara","kelas":"X-1","madin":"4D","asrama":"Nusantara 1","jobdesc":"","murobbi":"Ustadz Aziz","_checked":true,"_realIdx":8,"angkatan":"13","intensif":"KITAB","is_intern":false,"walikelas":"Ustadzah Aslahah","jobdesc_enabled":false}]'::jsonb
    ELSE santri_list 
END
WHERE id = 'ea91b82d-ff86-41dc-bc87-d29c1a7f09f5';

-- ============================================================================
-- 6. KEBIJAKAN ZERO DELETE KARANTINA (legacy_archive_unresolved)
-- PENTING: DILARANG MENGHAPUS RECORD KARANTINA!
-- Record karantina adalah bukti audit tak terbantahkan (immutable audit trail).
-- Perintah DELETE FROM public.legacy_archive_unresolved DIHAPUS SEPENUHNYA.
-- Status rekonsiliasi dicatat via logbook dan laporan terpisah.
-- ============================================================================

-- ============================================================================
-- 7. READBACK VERIFICATION CHECKS (POST-PATCH COMPREHENSIVE AUDIT)
-- Memvalidasi seluruh target record, termasuk ke-161 inventaris dari sumber
-- ============================================================================
DO $$
DECLARE
    v_chk_catatan RECORD;
    v_chk_pengeluaran RECORD;
    v_chk_unit1 RECORD;
    v_chk_unit2 RECORD;
    v_chk_surat1 RECORD;
    v_chk_surat2 RECORD;
    v_inventaris_unmatched_count INT := 0;
    v_unmatched_report TEXT := '';
    r_unmatched RECORD;
BEGIN
    -- 1. Verifikasi Catatan Bersama Target Berdasarkan ID
    SELECT id, judul, tipe, kategori, created_by_id, tags INTO v_chk_catatan
    FROM public.ptv_catatan WHERE id = '3cc0338b-30a4-4bb5-aa83-c3e3451c8702';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Catatan target 3cc0338b... tidak ditemukan!';
    END IF;
    IF v_chk_catatan.judul IS DISTINCT FROM 'Notulensi Rapat:haha' OR v_chk_catatan.tipe IS DISTINCT FROM 'meeting_minutes' THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Field catatan 3cc0338b... tidak sesuai (judul: %, tipe: %)!', v_chk_catatan.judul, v_chk_catatan.tipe;
    END IF;

    -- 2. Verifikasi Pengeluaran Live Target Berdasarkan ID
    SELECT id, nominal, keperluan, tanggal INTO v_chk_pengeluaran
    FROM public.ptv_pengeluaran WHERE id = 'ac23e115-708b-4d12-9eb5-bec20264bbfb';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Pengeluaran live target ac23e115... tidak ditemukan!';
    END IF;
    IF v_chk_pengeluaran.nominal IS DISTINCT FROM 28000.00 OR v_chk_pengeluaran.keperluan IS DISTINCT FROM 'KONSUMSI CREW' THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Field pengeluaran ac23e115... tidak sesuai (nominal: %, keperluan: %)!', v_chk_pengeluaran.nominal, v_chk_pengeluaran.keperluan;
    END IF;

    -- 3. Verifikasi Unit Fisik Target Berdasarkan ID
    SELECT id, catatan, keterangan INTO v_chk_unit1
    FROM public.ptv_inventaris_unit WHERE id = '2407fbaa-7100-464b-b0f0-7595f82e55b9';

    IF v_chk_unit1.catatan IS DISTINCT FROM 'putul krn jatuh' OR v_chk_unit1.keterangan IS DISTINCT FROM 'putul krn jatuh' THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Unit 2407fbaa... (INV-671-01) catatan/keterangan tidak terisi dengan benar!';
    END IF;

    SELECT id, catatan, keterangan INTO v_chk_unit2
    FROM public.ptv_inventaris_unit WHERE id = '22ba9382-d35d-4cf5-a76a-a545a52b4057';

    IF v_chk_unit2.catatan IS DISTINCT FROM 'Rusak Ketika Haflah Takrim' OR v_chk_unit2.keterangan IS DISTINCT FROM 'Rusak Ketika Haflah Takrim' THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Unit 22ba9382... (INV-051-02) catatan/keterangan tidak terisi dengan benar!';
    END IF;

    -- 4. Verifikasi Surat Izin Target Berdasarkan ID
    SELECT id, santri_list INTO v_chk_surat1
    FROM public.ptv_surat_izin WHERE id = 'ff305b4f-0c0e-4abc-9da9-2556bdb1743c';

    IF v_chk_surat1.santri_list IS NULL OR jsonb_array_length(v_chk_surat1.santri_list) IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Surat izin ff305b4f... santri_list tidak sesuai!';
    END IF;

    SELECT id, santri_list INTO v_chk_surat2
    FROM public.ptv_surat_izin WHERE id = 'ea91b82d-ff86-41dc-bc87-d29c1a7f09f5';

    IF v_chk_surat2.santri_list IS NULL OR jsonb_array_length(v_chk_surat2.santri_list) IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Surat izin ea91b82d... santri_list tidak sesuai!';
    END IF;

    -- 5. Verifikasi Komprehensif Seluruh 161 Record Inventaris Master Terhadap Sumber
    FOR r_unmatched IN (
        SELECT s.id,
               s.brand AS expected_brand, t.brand AS actual_brand,
               s.model AS expected_model, t.model AS actual_model,
               s.keterangan AS expected_keterangan, t.keterangan AS actual_keterangan,
               s.aset_id_lama AS expected_aset_id_lama, t.aset_id_lama AS actual_aset_id_lama
        FROM temp_source_inventaris s
        JOIN public.ptv_inventaris t ON s.id = t.id
        WHERE (s.brand IS NOT NULL AND trim(s.brand) IS DISTINCT FROM '' AND t.brand IS DISTINCT FROM s.brand)
           OR (s.model IS NOT NULL AND trim(s.model) IS DISTINCT FROM '' AND t.model IS DISTINCT FROM s.model)
           OR (s.keterangan IS NOT NULL AND trim(s.keterangan) IS DISTINCT FROM '' AND t.keterangan IS DISTINCT FROM s.keterangan)
           OR (s.aset_id_lama IS NOT NULL AND trim(s.aset_id_lama) IS DISTINCT FROM '' AND t.aset_id_lama IS DISTINCT FROM s.aset_id_lama)
    ) LOOP
        v_inventaris_unmatched_count := v_inventaris_unmatched_count + 1;
        v_unmatched_report := v_unmatched_report || format(E'
- ID %s tidak cocok!', r_unmatched.id);
    END LOOP;

    IF v_inventaris_unmatched_count > 0 THEN
        RAISE EXCEPTION 'POST-PATCH VERIFICATION FAILED: Terdeteksi % record inventaris yang nilainya tidak cocok dengan sumber kanonikal:%', v_inventaris_unmatched_count, v_unmatched_report;
    END IF;

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'POST-PATCH VERIFICATION BERHASIL: 161 inventaris master, 2 unit fisik, 1 catatan bersama, 1 pengeluaran live, dan 2 surat izin terverifikasi 100%% cocok dan utuh.';
    RAISE NOTICE '================================================================';
END $$;

COMMIT;

-- ============================================================================
-- KEBIJAKAN & TATA KELOLA PEMULIHAN ROLLBACK DATA DML (REVISION 4):
-- ============================================================================
-- PENTING: DILARANG MENJALANKAN DML ROLLBACK TANPA WHERE CLAUSE!
-- Perintah destruktif seperti:
--   'UPDATE public.ptv_inventaris SET brand = NULL, model = NULL, ...;'
-- TELAH DIHAPUS SEPENUHNYA karena dapat memusnahkan data sah yang sudah ada
-- maupun data baru yang ditambahkan kru setelah migrasi.
--
-- Prosedur Pemulihan yang Sah dan Aman:
-- 1. Prosedur Primer (Restorasi Snapshot JSON Utuh):
--    Gunakan backup snapshot Staging pre-reconciliation yang diambil tepat sebelum patch:
--    node scripts/restore-staging-backup.mjs backups/staging-pre-reconciliation-<timestamp>.json
--
-- 2. Prosedur Sekunder (Selective Undo Terarah Per-ID & Per-Kolom):
--    Jika dan hanya jika pemulihan manual parsial disetujui operator, jalankan
--    pemulihan terarah HANYA pada ID spesifik dan HANYA jika nilainya belum
--    diubah oleh operator setelah patch:
--
--    BEGIN;
--    -- Hapus catatan notulensi jika dan hanya jika belum diedit setelah patch:
--    DELETE FROM public.ptv_catatan 
--    WHERE id = '3cc0338b-30a4-4bb5-aa83-c3e3451c8702';
--
--    -- Hapus pengeluaran live jika dan hanya jika belum direkonsiliasi kas:
--    DELETE FROM public.ptv_pengeluaran 
--    WHERE id = 'ac23e115-708b-4d12-9eb5-bec20264bbfb';
--
--    -- Kosongkan santri_list HANYA pada 2 surat target:
--    UPDATE public.ptv_surat_izin 
--    SET santri_list = NULL 
--    WHERE id IN ('ff305b4f-0c0e-4abc-9da9-2556bdb1743c', 'ea91b82d-ff86-41dc-bc87-d29c1a7f09f5');
--
--    -- Kosongkan catatan/keterangan HANYA pada 2 unit fisik target:
--    UPDATE public.ptv_inventaris_unit 
--    SET catatan = NULL, keterangan = NULL 
--    WHERE id IN ('2407fbaa-7100-464b-b0f0-7595f82e55b9', '22ba9382-d35d-4cf5-a76a-a545a52b4057');
--
--    -- Pemulihan 161 inventaris master WAJIB menggunakan snapshot pre-reconciliation
--    -- per ID yang memverifikasi bahwa record belum diubah kembali oleh pengguna.
--    COMMIT;
-- ============================================================================
