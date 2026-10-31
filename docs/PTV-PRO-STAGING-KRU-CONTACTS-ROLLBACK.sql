-- ============================================================================
-- PTV PRO — STAGING KRU & KONTAK INTERNAL RECONCILIATION ROLLBACK
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status         : ROLLBACK SCRIPT (100% Lossless Restoration from Snapshot)
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

    -- 1.4 Precondition check: Verifikasi keberadaan ke-10 target record
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

    RAISE NOTICE 'SAFETY GUARD PASSED: Target Staging terverifikasi valid untuk rollback.';
END $$;

-- ============================================================================
-- 2. RESTORE METADATA_JSON LENGKAP 8 KONTAK PIMPINAN & KRU DARI SNAPSHOT
-- ============================================================================
-- PTV-001 (Muhammad Zidnal Falah)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": "110889049188755781319", "avatar_url": "https://progresiftv.id/wp-content/uploads/BUNG-JID_11zon-scaled-e1762584052186.webp", "created_at": "2026-04-29T23:30:52+00:00", "updated_at": "2026-10-04T00:37:10.863758+00:00", "wp_user_id": null, "role_legacy": "eksekutif", "oauth_provider": "google"}'::jsonb
WHERE archive_id = '5d1d2488-d8f3-4e6d-9b67-2d56c28c96fe'::uuid AND ptv_id = 'PTV-001';

-- PTV-003 (Muhammad Farras Zaidan Mubarok)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": "109152874428298363153", "avatar_url": "https://progresiftv.id/wp-content/uploads/ZDN_11zon-scaled-e1762675310293.webp", "created_at": "2026-04-29T23:30:52+00:00", "updated_at": "2026-10-12T16:29:47.463995+00:00", "wp_user_id": null, "role_legacy": "eksekutif", "oauth_provider": "google"}'::jsonb
WHERE archive_id = '92297427-bf28-46ef-a966-f23f9ab0fc5d'::uuid AND ptv_id = 'PTV-003';

-- PTV-005 (M. Gading Priangga)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": null, "avatar_url": null, "created_at": "2026-09-09T17:24:25.073789+00:00", "updated_at": "2026-09-23T08:37:11.846886+00:00", "wp_user_id": null, "role_legacy": "kru", "oauth_provider": null}'::jsonb
WHERE archive_id = '6d10b9cd-3220-4afb-bd1f-6c4594519f40'::uuid AND ptv_id = 'PTV-005';

-- PTV-011 (Indah Nur Laeli S.IP.)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": null, "avatar_url": "https://progresiftv.id/wp-content/uploads/WhatsApp-Image-2025-11-22-at-11.03.44-e1763784249883.webp", "created_at": "2026-04-29T23:30:52+00:00", "updated_at": "2026-09-27T15:42:34.890277+00:00", "wp_user_id": null, "role_legacy": "kru", "oauth_provider": null}'::jsonb
WHERE archive_id = '70de0c76-8d77-49c2-b104-3d69250e3677'::uuid AND ptv_id = 'PTV-011';

-- PTV-012 (Abuya KH. Agoes Ali Masyhuri)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": null, "avatar_url": "https://progresiftv.id/wp-content/uploads/IMG_0870-e1762628723120.webp", "created_at": "2026-04-29T23:30:52+00:00", "updated_at": "2026-09-27T15:42:35.414653+00:00", "wp_user_id": null, "role_legacy": "eksekutif", "oauth_provider": null}'::jsonb
WHERE archive_id = 'b96332bb-2ae5-46a7-8b4d-afb4e656ccb1'::uuid AND ptv_id = 'PTV-012';

-- PTV-013 (KH. Aria Muhammad Ali Lc., M.H.I.)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": null, "avatar_url": "https://progresiftv.id/wp-content/uploads/bbk-9_11zon-scaled-e1762628634170.webp", "created_at": "2026-04-29T23:30:52+00:00", "updated_at": "2026-09-27T15:42:36.071949+00:00", "wp_user_id": null, "role_legacy": "kru", "oauth_provider": null}'::jsonb
WHERE archive_id = '621782d8-f119-481f-a2d0-a24420f96f92'::uuid AND ptv_id = 'PTV-013';

-- PTV-029 (Muhammad Fahmi Izzudin)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": null, "avatar_url": "https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp", "created_at": "2026-04-29T23:30:52+00:00", "updated_at": "2026-09-27T15:42:45.407639+00:00", "wp_user_id": null, "role_legacy": "administrasi", "oauth_provider": null}'::jsonb
WHERE archive_id = 'c862a490-cdaa-4667-89f9-c87cd909f34b'::uuid AND ptv_id = 'PTV-029';

-- PTV-035 (Mochammad Wildan Rohadatul Aisy S.H.)
UPDATE public.legacy_archive_kru
SET metadata_json = '{"nim": null, "jurusan": null, "oauth_uid": null, "avatar_url": "https://progresiftv.id/wp-content/uploads/WhatsApp-Image-2026-07-28-at-14.28.44-1-scaled.webp", "created_at": "2026-04-29T23:30:52+00:00", "updated_at": "2026-09-27T15:42:48.891626+00:00", "wp_user_id": null, "role_legacy": "kru", "oauth_provider": "google"}'::jsonb
WHERE archive_id = '6ef3a725-b8cd-4db4-b660-8713a3615c20'::uuid AND ptv_id = 'PTV-035';

-- ============================================================================
-- 3. RESTORE FIELD & IDENTITAS LENGKAP PTV-017 PERSIS SESUAI SNAPSHOT
-- ============================================================================
UPDATE public.legacy_archive_kru
SET full_name = 'Kru Testing Integrasi',
    jabatan = 'Asisten Kamera',
    divisi = 'Technical',
    angkatan = 'Additional',
    status = 'aktif',
    photo_url = NULL,
    telepon_masked = '****7890',
    reconciliation_status = 'unlinked',
    metadata_json = '{"nim": "123456789", "jurusan": "Multimedia", "oauth_uid": null, "avatar_url": null, "created_at": "2026-09-23T05:29:26.054965+00:00", "updated_at": "2026-09-28T23:35:44.037911+00:00", "wp_user_id": null, "role_legacy": "kru", "oauth_provider": null}'::jsonb
WHERE archive_id = '7d6d3ddd-7c1a-41de-bb3b-4c0ff49593ce'::uuid AND ptv_id = 'PTV-017';

-- ============================================================================
-- 4. RESTORE STATUS PTV-UJI-2712 PERSIS SESUAI SNAPSHOT
-- ============================================================================
UPDATE public.legacy_archive_kru
SET status = 'nonaktif',
    reconciliation_status = 'unlinked'
WHERE archive_id = 'cdcf02ac-0fa3-45d6-9ae7-5788654d2810'::uuid AND ptv_id = 'PTV-UJI-2712';

-- ============================================================================
-- 5. POST-CONDITION VERIFICATION GUARD
-- ============================================================================
DO $$
DECLARE
    v_rolled_phone_count INTEGER;
    v_p17_name VARCHAR;
    v_p17_telepon VARCHAR;
    v_uji_status VARCHAR;
    v_total_kru_count INTEGER;
BEGIN
    -- 5.1 Pastikan 0 record dari 8 kontak yang memiliki telepon di metadata_json
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
    INTO v_rolled_phone_count;

    IF v_rolled_phone_count <> 0 THEN
        RAISE EXCEPTION 'POST-CONDITION ROLLBACK FAILED: Masih ada % record yang memiliki field telepon di metadata_json!', v_rolled_phone_count;
    END IF;

    -- 5.2 Pastikan PTV-017 kembali persis ke snapshot
    SELECT full_name, telepon_masked FROM public.legacy_archive_kru
    WHERE archive_id = '7d6d3ddd-7c1a-41de-bb3b-4c0ff49593ce'::uuid
    INTO v_p17_name, v_p17_telepon;

    IF v_p17_name <> 'Kru Testing Integrasi' OR v_p17_telepon <> '****7890' THEN
        RAISE EXCEPTION 'POST-CONDITION ROLLBACK FAILED: Data PTV-017 tidak kembali ke snapshot asli (name: %, tel: %)', v_p17_name, v_p17_telepon;
    END IF;

    -- 5.3 Pastikan PTV-UJI-2712 kembali ke status nonaktif
    SELECT status FROM public.legacy_archive_kru
    WHERE archive_id = 'cdcf02ac-0fa3-45d6-9ae7-5788654d2810'::uuid
    INTO v_uji_status;

    IF v_uji_status <> 'nonaktif' THEN
        RAISE EXCEPTION 'POST-CONDITION ROLLBACK FAILED: Status PTV-UJI-2712 tidak kembali ke nonaktif (% )', v_uji_status;
    END IF;

    -- 5.4 Total baris harus tetap 94
    SELECT COUNT(*) FROM public.legacy_archive_kru INTO v_total_kru_count;
    IF v_total_kru_count <> 94 THEN
        RAISE EXCEPTION 'POST-CONDITION ROLLBACK FAILED: Total baris berubah! Ditemukan: %', v_total_kru_count;
    END IF;

    RAISE NOTICE 'POST-CONDITION ROLLBACK PASSED: Database kembali 100%% ke baseline snapshot pra-patch.';
END $$;

COMMIT;
