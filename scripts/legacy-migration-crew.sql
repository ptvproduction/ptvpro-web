-- ============================================================================
-- [BLOCKED / JANGAN DIJALANKAN] PTV PRO - LEGACY CREW MIGRATION SQL (DEPRECATED)
-- STATUS: DILARANG KERAS DIJALANKAN!
-- ALASAN: Script ini otomatis membuat canonical_identity dan user_account
--         dari data kru legacy serta memuat data pribadi tanpa masking.
-- PERATURAN OPERATOR: Data kru legacy HANYA boleh diimpor ke tabel terisolasi
--                     legacy_archive_kru melalui PTV-PRO-STAGING-MIGRATION-PART2-IMPORT.sql.
-- ============================================================================

DO $$
BEGIN
    RAISE EXCEPTION 'SAFETY BLOCK: scripts/legacy-migration-crew.sql DILARANG DIJALANKAN sesuai kebijakan migrasi!';
END $$;

-- ============================================================================
-- PTV PRO — FIXED LEGACY CREW MIGRATION SQL (89 KRU)
-- Target Database: Supabase PostgreSQL (swadgljnyelsjstqqxbm)
-- Source: C:\Users\zidna\Local Sites\ptvrebuild\app\sql\local.sql
-- Schema Alignment:
--   organization.id = 'ptv_studio' (VARCHAR 32)
--   organization_division.id in ('technical', 'editor', 'layouter', 'creative', 'engagements')
--   access_profile.id in ('root_executive', 'eksekutif', 'kepolo_kepali', 'crew', 'pembina')
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_ident_id UUID;
    v_acc_id UUID;
    v_div_id VARCHAR(32);
    v_prof_id VARCHAR(32);
BEGIN

    -- ------------------------------------------------------------------------
    -- Kru: PTV-001 (Muhammad Zidnal Falah)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-001', 'Muhammad Zidnal Falah', '855', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-001';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'muhammadzidnalfalah', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF 'inimarbott@gmail.com' IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, 'inimarbott@gmail.com', now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', NULL, 'Petugas / Pembina', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = NULL, position_title = 'Petugas / Pembina', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'eksekutif', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-002 (Rafa Putra Ro\)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-002', 'Rafa Putra Ro\', '867', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-002';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'rouf', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF 'rafaputrarouf@gmail.com' IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, 'rafaputrarouf@gmail.com', now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'layouter', 'Layouter', 12, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'layouter', position_title = 'Layouter', cohort = 12, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'eksekutif', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-003 (Muhammad Farras Zaidan Mubarok)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-003', 'Muhammad Farras Zaidan Mubarok', '862', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-003';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'zaidan', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 12, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 12, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-005 (M. Gading Priangga)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-005', 'M. Gading Priangga', '15440', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-005';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'gading', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', NULL, 'Pembina PTV', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = NULL, position_title = 'Pembina PTV', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-007 (Bagaskara Arrasyad Diansaputra)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-007', 'Bagaskara Arrasyad Diansaputra', '877', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-007';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_007', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-008 (Dafangga Raffi Ahmad)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-008', 'Dafangga Raffi Ahmad', '900', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-008';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_008', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 7, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 7, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-009 (Farrel Dimas Saputra)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-009', 'Farrel Dimas Saputra', '898', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-009';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_009', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-010 (Muhammad Rafli Rizqullah)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-010', 'Muhammad Rafli Rizqullah', '896', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-010';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_010', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-011 (Rasya Putra Arofah)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-011', 'Rasya Putra Arofah', '890', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-011';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_011', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 9, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 9, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-012 (Ramadhan Bima Arifin)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-012', 'Ramadhan Bima Arifin', '889', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-012';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_012', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 9, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 9, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-013 (Dani Raihan Fawwaz Raissa)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-013', 'Dani Raihan Fawwaz Raissa', '886', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-013';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_013', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-014 (Naufal Sirajuddin)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-014', 'Naufal Sirajuddin', '882', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-014';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_014', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-015 (Faler Endy Fadlinazich)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-015', 'Faler Endy Fadlinazich', '878', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-015';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_015', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-016 (Erist Silva Agung Naraya)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-016', 'Erist Silva Agung Naraya', '872', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-016';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_016', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 11, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 11, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-017 (Muhammad Hamdan Yuwafi Sulaim)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-017', 'Muhammad Hamdan Yuwafi Sulaim', '864', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-017';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_017', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Technical', 12, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Technical', cohort = 12, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-018 (Moh. Adkha Hidayatulloh S.Sos.)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-018', 'Moh. Adkha Hidayatulloh S.Sos.', '854', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-018';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_018', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Pembina', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Pembina', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-019 (Alm. Habib Ali Zaenal Abidin Yahya)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-019', 'Alm. Habib Ali Zaenal Abidin Yahya', '853', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-019';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_019', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Pembina', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Pembina', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-020 (Indah Nur Laeli S.IP.)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-020', 'Indah Nur Laeli S.IP.', '848', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-020';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_020', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', NULL, 'Pembina', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = NULL, position_title = 'Pembina', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-021 (Muhammad Fahmi Izzudin)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-021', 'Muhammad Fahmi Izzudin', '15443', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-021';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_021', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-022 (Zaheed Sabiq Azhar)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-022', 'Zaheed Sabiq Azhar', '906', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-022';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_022', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 6, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 6, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-023 (Ahmad Nolan Furjah)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-023', 'Ahmad Nolan Furjah', '902', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-023';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_023', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 7, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 7, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-024 (Dzulkhifly Izha Qondias)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-024', 'Dzulkhifly Izha Qondias', '894', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-024';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_024', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Technical', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Technical', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-025 (Rasya Dwi Maharta)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-025', 'Rasya Dwi Maharta', '876', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-025';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_025', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Technical', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Technical', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-026 (Ilyas Kareem Rakhman)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-026', 'Ilyas Kareem Rakhman', '870', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-026';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_026', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Photographer', 11, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Photographer', cohort = 11, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-027 (Abuya KH. Agoes Ali Masyhuri)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-027', 'Abuya KH. Agoes Ali Masyhuri', '15432', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-027';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_027', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', NULL, 'Pendiri dan Pengasuh', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = NULL, position_title = 'Pendiri dan Pengasuh', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'eksekutif', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-028 (Luthfi Maulana Kholil)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-028', 'Luthfi Maulana Kholil', '919', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-028';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_028', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 3, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 3, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-029 (Wahyudi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-029', 'Wahyudi', '911', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-029';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_029', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 6, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 6, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-030 (Arventza Martins)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-030', 'Arventza Martins', '869', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-030';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_030', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 12, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 12, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-031 (Abdul Wahid Tamimi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-031', 'Abdul Wahid Tamimi', '899', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-031';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_031', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-032 (Muhammad Kiswah Mubarok)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-032', 'Muhammad Kiswah Mubarok', '897', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-032';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_032', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-033 (Bradie Naradithya Rifiyansyah)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-033', 'Bradie Naradithya Rifiyansyah', '895', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-033';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_033', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-034 (Hafizh Wiryamanggala)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-034', 'Hafizh Wiryamanggala', '883', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-034';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_034', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-035 (Rayhan Bayhaqi Wibisono)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-035', 'Rayhan Bayhaqi Wibisono', '873', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-035';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_035', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Photographer', 11, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Photographer', cohort = 11, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-036 (KH. Aria Muhammad Ali Lc., M.H.I.)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-036', 'KH. Aria Muhammad Ali Lc., M.H.I.', '845', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-036';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_036', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Ketua Yayasan', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Ketua Yayasan', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-037 (Agus Salim S.E.)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-037', 'Agus Salim S.E.', '852', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-037';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_037', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Pembina', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Pembina', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-038 (Rizqi Muhammad Sahrul Ramadhani)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-038', 'Rizqi Muhammad Sahrul Ramadhani', '893', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-038';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_038', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-039 (Agus Dr. H. M. Robith Fuadi Lc.)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-039', 'Agus Dr. H. M. Robith Fuadi Lc.', '846', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-039';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_039', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Direktur', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Direktur', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-040 (Taqiu Rabbani Fadillah)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-040', 'Taqiu Rabbani Fadillah', '858', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-040';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_040', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Technical', 13, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Technical', cohort = 13, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-041 (Agus H. Shohibul Burhan Ali S.IP.)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-041', 'Agus H. Shohibul Burhan Ali S.IP.', '847', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-041';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_041', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Wakil Direktur', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Wakil Direktur', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-042 (Farsya Naufal Rahmandika)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-042', 'Farsya Naufal Rahmandika', '866', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-042';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_042', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 12, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 12, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-043 (Ganesha Axl Fersalley)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-043', 'Ganesha Axl Fersalley', '871', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-043';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_043', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 11, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 11, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-044 (Ghaissan Azky Al Ghifari)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-044', 'Ghaissan Azky Al Ghifari', '15438', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-044';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_044', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-045 (Iyyaka Fahabil Farhan)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-045', 'Iyyaka Fahabil Farhan', '859', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-045';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_045', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor Video', 13, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor Video', cohort = 13, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-046 (Muhammad Izzur Fauzil Adhim)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-046', 'Muhammad Izzur Fauzil Adhim', '856', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-046';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'izzur', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Director', 11, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Director', cohort = 11, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-047 (Nauris Firdaus Rofauddin)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-047', 'Nauris Firdaus Rofauddin', '918', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-047';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_047', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 3, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 3, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-048 (Alfi Aufarul Anwar)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-048', 'Alfi Aufarul Anwar', '915', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-048';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_048', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 5, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 5, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-049 (Ahmad Daffa Khoiri Falih)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-049', 'Ahmad Daffa Khoiri Falih', '914', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-049';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_049', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 5, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 5, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-050 (Nafis Azizi Riza)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-050', 'Nafis Azizi Riza', '912', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-050';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_050', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 5, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 5, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-051 (Muhammad Razzan Ramadhana)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-051', 'Muhammad Razzan Ramadhana', '909', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-051';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_051', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 6, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 6, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-052 (Muhammad Maulana Mukti Nanang)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-052', 'Muhammad Maulana Mukti Nanang', '908', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-052';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_052', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Technical', 6, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Technical', cohort = 6, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-053 (Ikzaaz Abd)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-053', 'Ikzaaz Abd', '907', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-053';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_053', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 6, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 6, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-054 (Akhmad Sefril Hawari)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-054', 'Akhmad Sefril Hawari', '904', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-054';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_054', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Executive', 7, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Executive', cohort = 7, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-055 (Raihan Adz Dzikra)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-055', 'Raihan Adz Dzikra', '901', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-055';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_055', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 7, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 7, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-056 (Muhammad Iqbal Azinuddin Hazmi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-056', 'Muhammad Iqbal Azinuddin Hazmi', '892', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-056';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_056', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-057 (Ramzy Fauzan Ma\)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-057', 'Ramzy Fauzan Ma\', '891', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-057';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_057', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Director', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Director', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-058 (Gathfaan Nur\)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-058', 'Gathfaan Nur\', '888', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-058';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_058', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Layouter', 9, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Layouter', cohort = 9, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-059 (Faiq Admaja Wibowo)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-059', 'Faiq Admaja Wibowo', '887', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-059';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_059', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 9, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 9, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-060 (Tristan Camillo Juliatmoko)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-060', 'Tristan Camillo Juliatmoko', '881', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-060';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_060', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-061 (Hauna Ittasaqa Rumara)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-061', 'Hauna Ittasaqa Rumara', '874', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-061';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_061', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Technical', 11, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Technical', cohort = 11, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-062 (Syarif Hassan Billah Robbani)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-062', 'Syarif Hassan Billah Robbani', '15450', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-062';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_062', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-063 (Muhammad Nizar Nadhmi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-063', 'Muhammad Nizar Nadhmi', '15445', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-063';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_063', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-064 (Nadira Megananda)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-064', 'Nadira Megananda', '851', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-064';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_064', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Pembina Bag. Creative', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Pembina Bag. Creative', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-065 (Aqila Nur Rahmalia)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-065', 'Aqila Nur Rahmalia', '850', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-065';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_065', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Pembina Bag. Creative', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Pembina Bag. Creative', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-066 (Rizqi Kevin Melodi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-066', 'Rizqi Kevin Melodi', '917', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-066';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_066', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 3, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 3, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-067 (Naufal Arsy Katon)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-067', 'Naufal Arsy Katon', '913', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-067';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_067', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 5, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 5, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-068 (Muhammad Azkal Azkia)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-068', 'Muhammad Azkal Azkia', '910', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-068';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_068', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 6, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 6, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-069 (Naufal Wahana)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-069', 'Naufal Wahana', '905', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-069';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_069', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 7, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 7, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-070 (Sholahuddin Adam Zaeni)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-070', 'Sholahuddin Adam Zaeni', '903', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-070';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_070', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Creative', 7, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Creative', cohort = 7, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-071 (Ahmad Faiz Dzulfikri)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-071', 'Ahmad Faiz Dzulfikri', '15434', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-071';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_071', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-072 (Aqil Afzal Al Farisi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-072', 'Aqil Afzal Al Farisi', '863', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-072';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_072', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 12, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 12, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-073 (Haikal Pramana Cahyo)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-073', 'Haikal Pramana Cahyo', '15439', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-073';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_073', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-074 (Mochammad Wildan Rohadatul Aisy S.H.)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-074', 'Mochammad Wildan Rohadatul Aisy S.H.', '849', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-074';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_074', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', NULL, 'Pembina Bag. Program', NULL, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = NULL, position_title = 'Pembina Bag. Program', cohort = NULL, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'pembina', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-075 (Adi Maulana)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-075', 'Adi Maulana', '885', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-075';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_075', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editor', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editor', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-076 (Arundaya Maulana Hariadi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-076', 'Arundaya Maulana Hariadi', '884', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-076';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_076', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Editorial', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Editorial', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-077 (Zidan Zamzamy)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-077', 'Zidan Zamzamy', '879', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-077';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_077', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Technical', 10, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Technical', cohort = 10, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-078 (Rahardian Asyam Zuhdi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-078', 'Rahardian Asyam Zuhdi', '916', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-078';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_078', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 5, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 5, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-079 (Tobias Yardan Subijanto)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-079', 'Tobias Yardan Subijanto', '15451', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-079';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_079', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-080 (Raden Attaziya Anindyaveda Priyonggo)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-080', 'Raden Attaziya Anindyaveda Priyonggo', '15448', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-080';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_080', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-081 (Ahmad Royyan Syauqie)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-081', 'Ahmad Royyan Syauqie', '15435', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-081';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_081', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'layouter', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'layouter', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-082 (Ziddan Arzaqi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-082', 'Ziddan Arzaqi', '15452', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-082';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_082', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'layouter', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'layouter', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-083 (Malik Gunadhya Wiriarsa)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-083', 'Malik Gunadhya Wiriarsa', '15441', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-083';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_083', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'editor', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'editor', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-084 (Achmad Sulthanul Hakim Asyrafi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-084', 'Achmad Sulthanul Hakim Asyrafi', '15433', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-084';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_084', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-085 (Muhammad Isa)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-085', 'Muhammad Isa', '15444', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-085';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_085', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'layouter', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'layouter', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-086 (Dzaki Alta Sejahtera)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-086', 'Dzaki Alta Sejahtera', '15436', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-086';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_086', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-087 (Rex Ruizhi Gajendra)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-087', 'Rex Ruizhi Gajendra', '15449', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-087';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_087', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'editor', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'editor', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-088 (Nasshar Rasikh Arsyadiano)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-088', 'Nasshar Rasikh Arsyadiano', '15447', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-088';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_088', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-089 (Muhammad Daghfal Faizullah)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-089', 'Muhammad Daghfal Faizullah', '15442', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-089';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_089', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'editor', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'editor', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-090 (Fathur Rahmanhadi Saputra)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-090', 'Fathur Rahmanhadi Saputra', '15437', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-090';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_090', 'active', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'editor', 'Kru', 8, 'active', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'editor', position_title = 'Kru', cohort = 8, status_organisasi = 'active', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

    -- ------------------------------------------------------------------------
    -- Kru: PTV-091 (Muhammad Xavier Alfarizi)
    -- ------------------------------------------------------------------------
    INSERT INTO public.canonical_identity (id, ptv_id, full_name, legacy_id, created_at, updated_at)
    VALUES (gen_random_uuid(), 'PTV-091', 'Muhammad Xavier Alfarizi', '15446', now(), now())
    ON CONFLICT (ptv_id) DO UPDATE SET full_name = EXCLUDED.full_name, legacy_id = EXCLUDED.legacy_id
    RETURNING id INTO v_ident_id;

    IF v_ident_id IS NULL THEN
        SELECT id INTO v_ident_id FROM public.canonical_identity WHERE ptv_id = 'PTV-091';
    END IF;

    -- Akun Pengguna
    INSERT INTO public.user_account (id, identity_id, username, status_akun, created_at, updated_at)
    VALUES (gen_random_uuid(), v_ident_id, 'kru_ptv_091', 'inactive', now(), now())
    ON CONFLICT (identity_id) DO UPDATE SET username = EXCLUDED.username, status_akun = EXCLUDED.status_akun
    RETURNING id INTO v_acc_id;

    IF v_acc_id IS NULL THEN
        SELECT id INTO v_acc_id FROM public.user_account WHERE identity_id = v_ident_id;
    END IF;

    -- Kontak Pribadi (Email)
    IF NULL IS NOT NULL THEN
        INSERT INTO public.identity_contact (id, identity_id, email_pribadi, created_at, updated_at)
        VALUES (gen_random_uuid(), v_ident_id, NULL, now(), now())
        ON CONFLICT (identity_id) DO UPDATE SET email_pribadi = EXCLUDED.email_pribadi;
    END IF;

    -- Membership Organisasi (PTV Studio)
    IF NOT EXISTS (SELECT 1 FROM public.organization_membership WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio') THEN
        INSERT INTO public.organization_membership (
            id, identity_id, organization_id, division_id, position_title, cohort, status_organisasi, period_start, is_current, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_ident_id, 'ptv_studio', 'creative', 'Kru', 8, 'inactive', CURRENT_DATE, TRUE, now(), now()
        );
    ELSE
        UPDATE public.organization_membership 
        SET division_id = 'creative', position_title = 'Kru', cohort = 8, status_organisasi = 'inactive', updated_at = now()
        WHERE identity_id = v_ident_id AND organization_id = 'ptv_studio';
    END IF;

    -- Penugasan Profil Akses
    INSERT INTO public.account_profiles (account_id, profile_id, assigned_at)
    VALUES (v_acc_id, 'crew', now())
    ON CONFLICT (account_id, profile_id) DO NOTHING;

END $$;

COMMIT;
