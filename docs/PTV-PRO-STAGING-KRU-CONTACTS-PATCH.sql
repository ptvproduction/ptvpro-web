-- ============================================================================
-- PTV PRO — STAGING KRU & KONTAK INTERNAL RECONCILIATION PATCH
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status         : PENDING OPERATOR APPROVAL (STRICTLY DO NOT EXECUTE WITHOUT APPROVAL)
-- Backup Ref     : backups/staging-legacy-archive-kru-pre-contacts-migration-2026-10-19.json
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENHANCED MULTI-FACTOR SAFETY & PRECONDITION GUARD (STAGING ONLY)
-- ============================================================================
DO $$
DECLARE
    v_has_canonical BOOLEAN;
    v_has_staging_seed BOOLEAN;
    v_has_prod_legacy_tables BOOLEAN;
    v_target_match_count INTEGER;
    v_p17_baseline_name VARCHAR;
    v_uji_baseline_status VARCHAR;
BEGIN
    -- 1.1 Positive check: canonical_identity must exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'canonical_identity'
    ) INTO v_has_canonical;

    -- 1.2 Positive check: Verify staging seed exists
    SELECT EXISTS (
        SELECT 1 FROM public.canonical_identity 
        WHERE full_name ILIKE '%Staging%'
    ) INTO v_has_staging_seed;

    -- 1.3 Negative check: Physical legacy Production tables MUST NOT exist
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

    -- 1.4 Precondition check: Verifikasi keberadaan ke-10 target record unik berdasarkan archive_id & ptv_id
    SELECT COUNT(*) FROM public.legacy_archive_kru
    WHERE archive_id IN (
        '5d1d2488-d8f3-4e6d-9b67-2d56c28c96fe'::uuid, -- PTV-001
        '92297427-bf28-46ef-a966-f23f9ab0fc5d'::uuid, -- PTV-003
        '6d10b9cd-3220-4afb-bd1f-6c4594519f40'::uuid, -- PTV-005
        '70de0c76-8d77-49c2-b104-3d69250e3677'::uuid, -- PTV-011
        'b96332bb-2ae5-46a7-8b4d-afb4e656ccb1'::uuid, -- PTV-012
        '621782d8-f119-481f-a2d0-a24420f96f92'::uuid, -- PTV-013
        'c862a490-cdaa-4667-89f9-c87cd909f34b'::uuid, -- PTV-029
        '6ef3a725-b8cd-4db4-b660-8713a3615c20'::uuid, -- PTV-035
        '7d6d3ddd-7c1a-41de-bb3b-4c0ff49593ce'::uuid, -- PTV-017
        'cdcf02ac-0fa3-45d6-9ae7-5788654d2810'::uuid  -- PTV-UJI-2712
    )
    INTO v_target_match_count;

    IF v_target_match_count <> 10 THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: Tepat 10 archive_id target wajib ditemukan di legacy_archive_kru. Ditemukan: %', v_target_match_count;
    END IF;

    -- 1.5 Baseline check: PTV-017 harus sesuai baseline pra-patch
    SELECT full_name FROM public.legacy_archive_kru
    WHERE archive_id = '7d6d3ddd-7c1a-41de-bb3b-4c0ff49593ce'::uuid AND ptv_id = 'PTV-017'
    INTO v_p17_baseline_name;

    IF v_p17_baseline_name IS NULL OR (v_p17_baseline_name NOT ILIKE '%Testing%' AND v_p17_baseline_name NOT ILIKE '%Hamdan%') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: Identitas awal PTV-017 tidak sesuai baseline (% )', v_p17_baseline_name;
    END IF;

    -- 1.6 Baseline check: PTV-UJI-2712 harus ada
    SELECT status FROM public.legacy_archive_kru
    WHERE archive_id = 'cdcf02ac-0fa3-45d6-9ae7-5788654d2810'::uuid AND ptv_id = 'PTV-UJI-2712'
    INTO v_uji_baseline_status;

    IF v_uji_baseline_status IS NULL THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: Record PTV-UJI-2712 tidak ditemukan!';
    END IF;

    RAISE NOTICE 'SAFETY & PRECONDITION PASSED: Target Staging 10 baris valid dan siap diperbarui.';
END $$;

-- ============================================================================
-- 2. REKONSILIASI 8 NOMOR TELEPON/WHATSAPP OTENTIK KE METADATA_JSON
-- ============================================================================
-- Target 1: PTV-001 (Muhammad Zidnal Falah)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '6285334340616')
WHERE archive_id = '5d1d2488-d8f3-4e6d-9b67-2d56c28c96fe'::uuid AND ptv_id = 'PTV-001';

-- Target 2: PTV-003 (Muhammad Farras Zaidan Mubarok)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '6282143741822')
WHERE archive_id = '92297427-bf28-46ef-a966-f23f9ab0fc5d'::uuid AND ptv_id = 'PTV-003';

-- Target 3: PTV-005 (M. Gading Priangga)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '6285156849438')
WHERE archive_id = '6d10b9cd-3220-4afb-bd1f-6c4594519f40'::uuid AND ptv_id = 'PTV-005';

-- Target 4: PTV-011 (Indah Nur Laeli S.IP.)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '6281249844113')
WHERE archive_id = '70de0c76-8d77-49c2-b104-3d69250e3677'::uuid AND ptv_id = 'PTV-011';

-- Target 5: PTV-012 (Abuya KH. Agoes Ali Masyhuri)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '6282143055550')
WHERE archive_id = 'b96332bb-2ae5-46a7-8b4d-afb4e656ccb1'::uuid AND ptv_id = 'PTV-012';

-- Target 6: PTV-013 (KH. Aria Muhammad Ali Lc., M.H.I.)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '6281217678155')
WHERE archive_id = '621782d8-f119-481f-a2d0-a24420f96f92'::uuid AND ptv_id = 'PTV-013';

-- Target 7: PTV-029 (Muhammad Fahmi Izzudin)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '62895400381155')
WHERE archive_id = 'c862a490-cdaa-4667-89f9-c87cd909f34b'::uuid AND ptv_id = 'PTV-029';

-- Target 8: PTV-035 (Mochammad Wildan Rohadatul Aisy S.H.)
UPDATE public.legacy_archive_kru
SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('telepon', '6285195902495')
WHERE archive_id = '6ef3a725-b8cd-4db4-b660-8713a3615c20'::uuid AND ptv_id = 'PTV-035';

-- ============================================================================
-- 3. REKONSILIASI IDENTITAS OTENTIK PTV-017 (MUHAMMAD HAMDAN YUWAFI SULAIM)
-- ============================================================================
UPDATE public.legacy_archive_kru
SET full_name = 'Muhammad Hamdan Yuwafi Sulaim',
    jabatan = 'Technical',
    divisi = 'Operasional',
    angkatan = '12',
    photo_url = 'https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp',
    telepon_masked = NULL,
    metadata_json = (COALESCE(metadata_json, '{}'::jsonb) - 'telepon') || jsonb_build_object('avatar_url', 'https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp')
WHERE archive_id = '7d6d3ddd-7c1a-41de-bb3b-4c0ff49593ce'::uuid AND ptv_id = 'PTV-017';

-- ============================================================================
-- 4. KARANTINA RECORD UJI SINTETIS PTV-UJI-2712
-- ============================================================================
UPDATE public.legacy_archive_kru
SET status = 'test_quarantine',
    reconciliation_status = 'unlinked'
WHERE archive_id = 'cdcf02ac-0fa3-45d6-9ae7-5788654d2810'::uuid AND ptv_id = 'PTV-UJI-2712';

-- ============================================================================
-- 5. POST-CONDITION VERIFICATION GUARD
-- ============================================================================
DO $$
DECLARE
    v_updated_phone_count INTEGER;
    v_p17_new_name VARCHAR;
    v_p17_photo VARCHAR;
    v_uji_status VARCHAR;
    v_total_kru_count INTEGER;
BEGIN
    -- 5.1 Pastikan tepat 8 baris memiliki telepon di metadata_json
    SELECT COUNT(*) FROM public.legacy_archive_kru
    WHERE archive_id IN (
        '5d1d2488-d8f3-4e6d-9b67-2d56c28c96fe'::uuid,
        '92297427-bf28-46ef-a966-f23f9ab0fc5d'::uuid,
        '6d10b9cd-3220-4afb-bd1f-6c4594519f40'::uuid,
        '70de0c76-8d77-49c2-b104-3d69250e3677'::uuid,
        'b96332bb-2ae5-46a7-8b4d-afb4e656ccb1'::uuid,
        '621782d8-f119-481f-a2d0-a24420f96f92'::uuid,
        'c862a490-cdaa-4667-89f9-c87cd909f34b'::uuid,
        '6ef3a725-b8cd-4db4-b660-8713a3615c20'::uuid
    ) AND (metadata_json->>'telepon') IS NOT NULL
    INTO v_updated_phone_count;

    IF v_updated_phone_count <> 8 THEN
        RAISE EXCEPTION 'POST-CONDITION FAILED: Tepat 8 pimpinan/kru wajib memiliki metadata telepon. Terverifikasi: %', v_updated_phone_count;
    END IF;

    -- 5.2 Pastikan PTV-017 terupdate dan photo_url berupa URL valid (bukan markdown)
    SELECT full_name, photo_url FROM public.legacy_archive_kru
    WHERE archive_id = '7d6d3ddd-7c1a-41de-bb3b-4c0ff49593ce'::uuid
    INTO v_p17_new_name, v_p17_photo;

    IF v_p17_new_name <> 'Muhammad Hamdan Yuwafi Sulaim' THEN
        RAISE EXCEPTION 'POST-CONDITION FAILED: Nama PTV-017 gagal diperbarui (% )', v_p17_new_name;
    END IF;

    IF v_p17_photo NOT LIKE 'https://%' OR v_p17_photo LIKE '%[%' OR v_p17_photo LIKE '%(%' THEN
        RAISE EXCEPTION 'POST-CONDITION FAILED: photo_url PTV-017 bukan URL absolut bersih (% )', v_p17_photo;
    END IF;

    -- 5.3 Pastikan PTV-UJI-2712 berstatus test_quarantine
    SELECT status FROM public.legacy_archive_kru
    WHERE archive_id = 'cdcf02ac-0fa3-45d6-9ae7-5788654d2810'::uuid
    INTO v_uji_status;

    IF v_uji_status <> 'test_quarantine' THEN
        RAISE EXCEPTION 'POST-CONDITION FAILED: Status PTV-UJI-2712 gagal dikarantina (% )', v_uji_status;
    END IF;

    -- 5.4 Pastikan total baris legacy_archive_kru tidak berubah (tetap 94)
    SELECT COUNT(*) FROM public.legacy_archive_kru INTO v_total_kru_count;
    IF v_total_kru_count <> 94 THEN
        RAISE EXCEPTION 'POST-CONDITION FAILED: Total baris legacy_archive_kru berubah! Awal: 94, Sekarang: %', v_total_kru_count;
    END IF;

    RAISE NOTICE 'POST-CONDITION PASSED: Seluruh rekonsiliasi kontak internal berhasil 100%%.';
END $$;

COMMIT;
