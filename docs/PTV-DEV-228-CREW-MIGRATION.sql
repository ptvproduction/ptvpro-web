-- ==============================================================================
-- PTV-DEV-228: FINAL CANONICAL IDENTITY & MEMBERSHIP MIGRATION SCRIPT
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Generated: 2026-10-30
-- Karakteristik:
-- 1. Idempotensi Ganda (Decoupled Identity & Organization Membership Check).
-- 2. Zero Data Loss: Semua 67 personel unik (60 alumni/nonaktif, 7 pengarah/pembina/kru) termigrasi.
-- 3. FK Constraint Compliant:
--    - legacy_id = NULL (kolom bigint).
--    - division_id strictly maps to organization_division ('technical', 'editor', 'layouter', 'creative', 'engagements') or NULL (for Pengarah/Pembina/Operasional).
-- 4. Proteksi Akun & Hardening: Tidak membuat akun login otomatis, status alumni tetap inactive.
-- 5. Perlindungan Akun Testing & Sistem: PTV-STG-ADM, PTV-STG-KRU, PTV-TEST-171 tetap utuh.
-- 6. Penautan Balik Penuh: Memperbarui canonical_identity_id pada legacy_archive_kru.
-- ==============================================================================

DO $$
DECLARE
  v_identity_id uuid;
  v_now timestamptz := now();
BEGIN
  RAISE NOTICE 'Memulai migrasi 67 kru ke canonical_identity dan organization_membership...';

  -- ============================================================================
  -- Personel: Bagaskara Arrasyad Diansaputra (PTV-007) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-007';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-007',
      'Bagaskara Arrasyad Diansaputra',
      'https://progresiftv.id/wp-content/uploads/GAS_11zon-scaled-e1762585022483.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/GAS_11zon-scaled-e1762585022483.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-25T02:50:08.490748+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"b4b7bdbc-28c2-4c58-82e7-fbe399bffecd","production_id":"0e6db594-caf5-43bf-b2d1-0f7027331bd7","angkatan":"10","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-007' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Dafangga Raffi Ahmad (PTV-008) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-008';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-008',
      'Dafangga Raffi Ahmad',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"test_ping":1793305262083,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-25T02:53:07.106219+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"cdd97c2e-f2e7-4c7e-af00-b298dceb6f7b","production_id":"14282fde-5c4c-4acd-83d0-2314f88124be","angkatan":"7","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      7,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-008' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Farrel Dimas Saputra (PTV-009) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-009';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-009',
      'Farrel Dimas Saputra',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:28:25.915694+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"aa4e00f7-5b9e-4fe2-9533-cf8cc090c274","production_id":"22120ff9-43fe-4a86-b4d8-1dea2933ae1c","angkatan":"8","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-009' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Rafli Rizqullah (PTV-010) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-010';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-010',
      'Muhammad Rafli Rizqullah',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:28:26.436807+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"fa077220-fc89-43dc-883d-0ee9daa82ef7","production_id":"22deb165-a7c0-41db-9cbf-4a288b475004","angkatan":"8","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-010' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Indah Nur Laeli S.IP. (PTV-011) | Divisi Asli: Pembina | Status: aktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-011';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-011',
      'Indah Nur Laeli S.IP.',
      'https://progresiftv.id/wp-content/uploads/WhatsApp-Image-2025-11-22-at-11.03.44-e1763784249883.webp',
      NULL,
      '{"nim":null,"jurusan":null,"telepon":"6281249844113","oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/WhatsApp-Image-2025-11-22-at-11.03.44-e1763784249883.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-10-19T10:47:54.724Z","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"original_phone":"6281249844113","updated_by_account_id":"bcd64337-3511-459b-a2b1-4d027b926fb7","migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"70de0c76-8d77-49c2-b104-3d69250e3677","production_id":"0057afb6-df80-4eb6-9078-7860aa3c219a","angkatan":"Pembina","divisi":"Pembina","jabatan":"Pembina PTV","email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Pembina PTV',
      NULL,
      'active',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-011' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Abuya KH. Agoes Ali Masyhuri (PTV-012) | Divisi Asli: Pengarah | Status: aktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-012';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-012',
      'Abuya KH. Agoes Ali Masyhuri',
      'https://progresiftv.id/wp-content/uploads/IMG_0870-e1762628723120.webp',
      NULL,
      '{"nim":null,"jurusan":null,"telepon":"6282143055550","oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/IMG_0870-e1762628723120.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-10-19T10:45:05.421Z","wp_user_id":null,"role_legacy":"eksekutif","oauth_provider":null,"original_phone":"6282143055550","updated_by_account_id":"bcd64337-3511-459b-a2b1-4d027b926fb7","migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"b96332bb-2ae5-46a7-8b4d-afb4e656ccb1","production_id":"25012ae3-cd9b-4d6e-b303-3243bb866811","angkatan":"Pengarah","divisi":"Pengarah","jabatan":"Pendiri dan Pengasuh","email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Pendiri dan Pengasuh',
      NULL,
      'active',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-012' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: KH. Aria Muhammad Ali Lc., M.H.I. (PTV-013) | Divisi Asli: Pengarah | Status: aktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-013';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-013',
      'KH. Aria Muhammad Ali Lc., M.H.I.',
      'https://progresiftv.id/wp-content/uploads/bbk-9_11zon-scaled-e1762628634170.webp',
      NULL,
      '{"nim":null,"jurusan":null,"telepon":"6281217678155","oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/bbk-9_11zon-scaled-e1762628634170.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-10-19T10:45:23.152Z","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"original_phone":"6281217678155","updated_by_account_id":"bcd64337-3511-459b-a2b1-4d027b926fb7","migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"621782d8-f119-481f-a2d0-a24420f96f92","production_id":"614c8b03-7033-4eb6-aed9-53babdc8c427","angkatan":"Pengarah","divisi":"Pengarah","jabatan":"Direktur Yayasan","email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Direktur Yayasan',
      NULL,
      'active',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-013' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Agus Dr. H. M. Robith Fuad Lc. (PTV-014) | Divisi Asli: Pengarah | Status: aktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-014';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-014',
      'Agus Dr. H. M. Robith Fuad Lc.',
      'https://progresiftv.id/wp-content/uploads/kunjungan-menteri-agama-40_11zon-scaled-e1762628619653.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/kunjungan-menteri-agama-40_11zon-scaled-e1762628619653.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-10-19T10:46:24.354Z","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"updated_by_account_id":"bcd64337-3511-459b-a2b1-4d027b926fb7","migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"a11983db-fdc6-4e19-ab00-b777cc0cb99a","production_id":"1cd5aada-d2fe-4356-aaec-04a2100f3d5e","angkatan":"Pengarah","divisi":"Pengarah","jabatan":"Presdir PT. Progresif Digital Media","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Presdir PT. Progresif Digital Media',
      NULL,
      'active',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-014' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Agus H. Shohibul Burhan Ali S.IP. (PTV-015) | Divisi Asli: Pengarah | Status: aktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-015';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-015',
      'Agus H. Shohibul Burhan Ali S.IP.',
      'https://progresiftv.id/wp-content/uploads/gus-burhan-e1762628652181.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/gus-burhan-e1762628652181.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-10-19T10:46:37.359Z","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"updated_by_account_id":"bcd64337-3511-459b-a2b1-4d027b926fb7","migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"12e26fa0-1424-4264-81a5-21c19341b4d9","production_id":"79aac80f-1e1c-40c9-b025-66ce2f1ebdd7","angkatan":"Pengarah","divisi":"Pengarah","jabatan":"Wadir PT. Progresif Digital Media","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Wadir PT. Progresif Digital Media',
      NULL,
      'active',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-015' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Hamdan Yuwafi Sulaim (PTV-017) | Divisi Asli: Operasional | Status: aktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-017';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-017',
      'Muhammad Hamdan Yuwafi Sulaim',
      'https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp',
      NULL,
      '{"nim":"123456789","jurusan":"Multimedia","oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp","created_at":"2026-09-23T05:29:26.054965+00:00","updated_at":"2026-09-28T23:35:44.037911+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"7d6d3ddd-7c1a-41de-bb3b-4c0ff49593ce","production_id":"27078e8c-c74d-41f0-bac2-1fd8a79ee039","angkatan":"12","divisi":"Operasional","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Technical',
      12,
      'active',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-017' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Niki Santri (PTV-018) | Divisi Asli: Layouter | Status: aktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-018';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-018',
      'Niki Santri',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"category":"Kru","oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-09-23T16:33:28.545982+00:00","updated_at":"2026-10-30T06:26:03.540Z","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"username_updated_at":"2026-10-30T06:26:11.271Z","username_updated_by":"c08952de-a8ff-48e0-8182-ac0bb7ac6767","updated_by_account_id":"c08952de-a8ff-48e0-8182-ac0bb7ac6767","migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"befdaae9-93e4-413b-9be7-f1f060a9dbae","production_id":"59ab2d82-285c-4b61-bcd7-3b8ce0e1bd4f","angkatan":"0","divisi":"Layouter","jabatan":"Media Santri Putri","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Media Santri Putri',
      0,
      'active',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-018' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Abdul Wahid Tamimi (PTV-037) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-037';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-037',
      'Abdul Wahid Tamimi',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:24.289365+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"3868c05a-3018-4a3a-9e10-65c1f4ec75cf","production_id":"5858eba1-42cb-4c04-9394-fe555de87732","angkatan":"8","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-037' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Adi Maulana (PTV-038) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-038';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-038',
      'Adi Maulana',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:24.675892+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"06fc28fd-6363-42f7-86db-adc34a983640","production_id":"2a6e8308-4eb2-4d26-a90d-db3c30ee1f6a","angkatan":"10","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-038' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ahmad Daffa Khoiri Falih (PTV-039) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-039';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-039',
      'Ahmad Daffa Khoiri Falih',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:25.123486+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"b1f67667-05c9-4275-8f33-85c3a7ab2c37","production_id":"53905fcc-65d4-4702-a686-bc447f2c1cb0","angkatan":"5","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      5,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-039' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ahmad Dzulfikri Basit (PTV-040) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-040';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-040',
      'Ahmad Dzulfikri Basit',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-09-22T21:10:44.162998+00:00","updated_at":"2026-09-28T23:31:25.495658+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"208d9caa-0ff0-4686-bb7b-fc17e693b959","production_id":"b1644781-8fa7-472d-9eea-b86cae4e2918","angkatan":"13","divisi":"Technical","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Technical',
      13,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-040' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ahmad Faiz Dzulfikri (PTV-041) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-041';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-041',
      'Ahmad Faiz Dzulfikri',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:25.902667+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"5057a183-fff3-42cd-bf94-db695b806549","production_id":"cafb4bf5-0b6b-4280-885b-eba4fe5e656f","angkatan":"13","divisi":"Technical","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Technical',
      13,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-041' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ahmad Nolan Furjah (PTV-042) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-042';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-042',
      'Ahmad Nolan Furjah',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:26.243625+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"9621c535-29c7-4934-9fee-9168b94c29fb","production_id":"0b697731-8e1f-4469-bbd3-3761e97b0c02","angkatan":"7","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      7,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-042' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Akhmad Sefril Hawari (PTV-043) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-043';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-043',
      'Akhmad Sefril Hawari',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:26.652995+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"e4828470-76e6-4009-bf48-49a9129f0ee6","production_id":"5082660c-65fe-431d-984e-2f23836202ed","angkatan":"7","divisi":"Technical","jabatan":"Executive","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Executive',
      7,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-043' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Alfi Aufarul Anwar (PTV-044) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-044';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-044',
      'Alfi Aufarul Anwar',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:27.051273+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"6f4ba41e-1758-4eb4-a264-4bf56cc3bde6","production_id":"7f8f97ee-07a9-44f8-a00b-b199fc143d86","angkatan":"5","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      5,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-044' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Alm. Habib Ali Zaenal Abidin Yahya (PTV-045) | Divisi Asli: Pembina | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-045';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-045',
      'Alm. Habib Ali Zaenal Abidin Yahya',
      'https://progresiftv.id/wp-content/uploads/DSCN1421-scaled-e1763575335817.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/DSCN1421-scaled-e1763575335817.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:27.431942+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"e2b439ab-c06f-4caa-aef9-42aab30b5d8b","production_id":"1fba5d99-89f1-4f3e-ae17-4015a04d9219","angkatan":"Pembina","divisi":"Pembina","jabatan":"Pembina","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Pembina',
      NULL,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-045' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Aqila Nur Rahmalia (PTV-046) | Divisi Asli: Pembina | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-046';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-046',
      'Aqila Nur Rahmalia',
      'https://progresiftv.id/wp-content/uploads/Gemini_Generated_Image_l1dnoql1dnoql1dn.png',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/Gemini_Generated_Image_l1dnoql1dnoql1dn.png","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:27.81498+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"a8055247-3068-4c37-9683-1bc391308cb6","production_id":"0dbe4b7a-3057-4068-9a4a-8d744c88f0be","angkatan":"Pembina","divisi":"Pembina","jabatan":"Pembina Bag. Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Pembina Bag. Creative',
      NULL,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-046' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Arundaya Maulana Hariadi (PTV-047) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-047';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-047',
      'Arundaya Maulana Hariadi',
      'https://progresiftv.id/wp-content/uploads/ChatGPT-Image-1-Mei-2026-21.45.43.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/ChatGPT-Image-1-Mei-2026-21.45.43.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:28.147904+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"3dec3f0a-ec80-4f90-b45b-01b49b2eeb2b","production_id":"18a53090-fa46-4aeb-ad5a-3dab126d00a6","angkatan":"10","divisi":"Editor","jabatan":"Editorial","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editorial',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-047' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Bradie Naradithya Rifiyansyah (PTV-048) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-048';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-048',
      'Bradie Naradithya Rifiyansyah',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:28.569882+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"9a58d8b9-1445-401f-8e43-e2c3fe2acd2c","production_id":"032a9b4e-852b-4740-bc83-fda6063faea8","angkatan":"8","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-048' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Dani Raihan Fawwaz Raissa (PTV-049) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-049';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-049',
      'Dani Raihan Fawwaz Raissa',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:28.909513+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"f5343a6a-90dd-4174-8823-b9eb989174e6","production_id":"183ac6c1-2932-4ebe-918d-102bf3226421","angkatan":"10","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-049' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Dzulkhifly Izha Qondias (PTV-050) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-050';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-050',
      'Dzulkhifly Izha Qondias',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:29.236397+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"a125539b-ea67-40d9-8889-ad1e12a98e8c","production_id":"0451f3f3-b69f-415e-a343-76a9fc33e8b9","angkatan":"8","divisi":"Technical","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Technical',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-050' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Erist Silva Agung Naraya (PTV-051) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-051';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-051',
      'Erist Silva Agung Naraya',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:29.591626+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"0d08bdca-e488-4bc6-9a50-571e829cf91c","production_id":"90ec2c87-67d2-452e-9ccf-167779e186ca","angkatan":"11","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      11,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-051' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Faiq Admaja Wibowo (PTV-052) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-052';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-052',
      'Faiq Admaja Wibowo',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:29.990482+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"87c66ffe-197e-4427-b366-53d1e51ec035","production_id":"85ffbf10-5a7b-4727-a75e-0c233d434c0d","angkatan":"9","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      9,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-052' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Faler Endy Fadlinazich (PTV-053) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-053';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-053',
      'Faler Endy Fadlinazich',
      'https://progresiftv.id/wp-content/uploads/endy-scaled-e1763790685372.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/endy-scaled-e1763790685372.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:30.380237+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"657858b0-9dcb-4382-adf8-df86d58d6823","production_id":"31a4fcf4-4a52-410e-8898-98ef2d9de3a7","angkatan":"10","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-053' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Gathfaan Nur' Akmal (PTV-054) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-054';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-054',
      'Gathfaan Nur'' Akmal',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:30.761456+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"4f118f83-0281-4f7c-a1dd-1ae775fd85d7","production_id":"5c6c21f6-70fd-4ccf-8740-f9fc64549820","angkatan":"9","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      9,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-054' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ghaissan Azky (PTV-055) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-055';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-055',
      'Ghaissan Azky',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-09-22T21:10:43.781907+00:00","updated_at":"2026-09-28T23:31:31.151515+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"efc91f05-e79e-4c8c-93c6-ca7a6aba2b79","production_id":"09a1dd78-476f-4b95-8ba6-73eced5c6a28","angkatan":"12","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      12,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-055' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Hafizh Wiryamanggala (PTV-056) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-056';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-056',
      'Hafizh Wiryamanggala',
      'https://progresiftv.id/wp-content/uploads/PIZ_11zon-scaled-e1762675430751.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/PIZ_11zon-scaled-e1762675430751.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:31.500114+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"92e7288c-9f89-4780-9c8c-667c6ad5d75b","production_id":"37d358b9-439c-46b1-9352-9c40a7575457","angkatan":"10","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-056' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Haikal Pramana (PTV-057) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-057';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-057',
      'Haikal Pramana',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-09-22T21:10:44.506159+00:00","updated_at":"2026-09-28T23:31:31.859626+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"a56c4bab-3b0e-47e1-aa87-7f7e626ceb02","production_id":"d28a44e4-ada2-4eec-b7fb-dcc9aeb9f229","angkatan":"13","divisi":"Editor","jabatan":"Editor Video","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor Video',
      13,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-057' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Hauna Ittasaqa Rumara (PTV-058) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-058';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-058',
      'Hauna Ittasaqa Rumara',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:32.21052+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"ec3dcdb2-6608-49ad-ba98-7d8906411452","production_id":"03fdbc4f-5aed-485f-a668-5e716cb5f546","angkatan":"11","divisi":"Technical","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Technical',
      11,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-058' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ikzaaz Abd (PTV-059) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-059';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-059',
      'Ikzaaz Abd',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:32.56208+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"4e937bb0-d105-4f43-a20d-684ed5dae0b5","production_id":"aed8b76f-d533-4d15-8c2e-471bd83fb242","angkatan":"6","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      6,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-059' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ilyas Kareem Rakhman (PTV-060) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-060';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-060',
      'Ilyas Kareem Rakhman',
      'https://progresiftv.id/wp-content/uploads/ilyas-2-scaled-e1763790577920.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/ilyas-2-scaled-e1763790577920.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:32.895679+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"cfab005c-7472-46b0-9769-b407e0a5f36e","production_id":"4fa41a72-79bc-43a8-8226-eb3b9f9fda07","angkatan":"11","divisi":"Technical","jabatan":"Photographer","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Photographer',
      11,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-060' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Luthfi Maulana Kholil (PTV-061) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-061';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-061',
      'Luthfi Maulana Kholil',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:33.263116+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"0a650e46-1152-4cf3-a0d8-0a83ca441fcf","production_id":"66dbaa78-961c-4a77-be4f-2a8a0697960e","angkatan":"3","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      3,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-061' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Moh. Adkha Hidayatulloh S.Sos. (PTV-062) | Divisi Asli: Pembina | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-062';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-062',
      'Moh. Adkha Hidayatulloh S.Sos.',
      'https://progresiftv.id/wp-content/uploads/2026/DSCN1421-scaled-e1763575335817.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/2026/DSCN1421-scaled-e1763575335817.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:33.64419+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"803710e0-55ee-409f-9e0a-046b5b5380bb","production_id":"17b7837a-7990-4d7d-8940-0f11e13dc83f","angkatan":"Pembina","divisi":"Pembina","jabatan":"Pembina","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Pembina',
      NULL,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-062' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Azkal Azkia (PTV-063) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-063';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-063',
      'Muhammad Azkal Azkia',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:33.992539+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"00cf54a2-3659-40ad-abc5-68dc77cd709e","production_id":"4aced51b-3bc0-4888-bd49-a67a7d1d0089","angkatan":"6","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      6,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-063' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Hamdan Yuwafi Sulaim (PTV-064) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-064';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-064',
      'Muhammad Hamdan Yuwafi Sulaim',
      'https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:34.49872+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"f67cae83-8bf1-4562-92f3-49180a369214","production_id":"2022dfbb-3d32-4ba3-89c4-6c47fc45d0af","angkatan":"12","divisi":"Technical","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Technical',
      12,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-064' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Iqbal Azinuddin Hazmi (PTV-065) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-065';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-065',
      'Muhammad Iqbal Azinuddin Hazmi',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:34.871002+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"c97f083c-d5d4-43c2-a83e-0fb59308d648","production_id":"484b7ec4-58fa-4ee5-bb66-afac19df43f6","angkatan":"8","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-065' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Kiswah Mubarok (PTV-066) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-066';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-066',
      'Muhammad Kiswah Mubarok',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:35.209788+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"b5733b50-07ce-4858-a5d7-766eee46e4e2","production_id":"160d7dd2-1d15-43b8-814a-ceca451f9b4e","angkatan":"8","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-066' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Maulana Mukti Nanang (PTV-067) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-067';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-067',
      'Muhammad Maulana Mukti Nanang',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:35.55812+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"e2c879ce-a55e-47ba-b66c-5f5ee25317e3","production_id":"6a19c356-28a5-48dd-8876-6eceb88ec0cd","angkatan":"6","divisi":"Technical","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Technical',
      6,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-067' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Nizar Nadhem (PTV-068) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-068';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-068',
      'Muhammad Nizar Nadhem',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-09-22T21:10:42.818734+00:00","updated_at":"2026-09-28T23:31:35.903621+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"af02ad77-1d3c-4a49-93ee-af8c6789e9bb","production_id":"5379c20a-282f-408a-9bf8-d84d1caa1332","angkatan":"10","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-068' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Muhammad Razzan Ramadhana (PTV-069) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-069';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-069',
      'Muhammad Razzan Ramadhana',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:36.215895+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"be6832c5-4c5f-4fc9-b2b2-81282164f1e2","production_id":"261325a0-510d-4515-aa05-0417a66a8950","angkatan":"6","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      6,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-069' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Nadira Megananda (PTV-070) | Divisi Asli: Pembina | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-070';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-070',
      'Nadira Megananda',
      'https://progresiftv.id/wp-content/uploads/Gemini_Generated_Image_l1dnoql1dnoql1dn.png',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/Gemini_Generated_Image_l1dnoql1dnoql1dn.png","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:36.538252+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"eef2c45e-397e-4c9e-846d-d5f00e992cdf","production_id":"1efe4a04-50d0-471c-ae00-bf380d6cb783","angkatan":"Pembina","divisi":"Pembina","jabatan":"Pembina Bag. Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Pembina Bag. Creative',
      NULL,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-070' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Nafis Azizi Riza (PTV-071) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-071';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-071',
      'Nafis Azizi Riza',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:36.904587+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"f5a7247f-e587-4e08-959c-7384d1cec1ad","production_id":"777cef18-e46b-41b0-9289-46170a0b83cd","angkatan":"5","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      5,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-071' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Naufal Arsy Katon (PTV-072) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-072';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-072',
      'Naufal Arsy Katon',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:37.243206+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"0cbc81df-b587-4daf-ba8b-f89b82047732","production_id":"4ee7a67c-ca3e-4835-ace3-64b3b5955e0b","angkatan":"5","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      5,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-072' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Naufal Sirajuddin (PTV-073) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-073';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-073',
      'Naufal Sirajuddin',
      'https://progresiftv.id/wp-content/uploads/IDCARD00057_11zon-scaled-e1762675405930.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/IDCARD00057_11zon-scaled-e1762675405930.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:37.566666+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"8f8546d3-8eb6-4559-9b78-2e53c3268919","production_id":"03a7f201-e0d8-4ab1-8559-f40209761c7d","angkatan":"10","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-073' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Naufal Wahana (PTV-074) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-074';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-074',
      'Naufal Wahana',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:37.927308+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"0008fb7e-3b57-44c1-a88d-172135554d21","production_id":"43eee85d-09a7-4ddf-b77d-b76beb6f35bf","angkatan":"7","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      7,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-074' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Nauris Firdaus Rofauddin (PTV-075) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-075';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-075',
      'Nauris Firdaus Rofauddin',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:38.30795+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"3dc52654-698f-4791-8d3c-96106768efd6","production_id":"037ad510-24ce-4b53-b2dd-d2694ef1fbe1","angkatan":"3","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      3,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-075' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Raden Attaziya Anindyaveda Priyonggo (PTV-076) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-076';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-076',
      'Raden Attaziya Anindyaveda Priyonggo',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-06-19T04:27:26+00:00","updated_at":"2026-09-28T23:31:38.672427+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"fe65136f-9aee-4497-9831-674169621231","production_id":"4bf926f8-5dee-4ae9-b18d-c63a4ae4f442","angkatan":"13","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      13,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-076' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Rahardian Asyam Zuhdi (PTV-077) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-077';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-077',
      'Rahardian Asyam Zuhdi',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:39.050433+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"673ecf76-6d69-42b6-81d3-dea5e18bda99","production_id":"0989a4b8-7b0d-4c14-ac7b-9b0710fd834d","angkatan":"5","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      5,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-077' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Raihan Adz Dzikra (PTV-078) | Divisi Asli: Layouter | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-078';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-078',
      'Raihan Adz Dzikra',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:39.415408+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"de08655b-b9f2-4167-9b1c-6e937aa5239a","production_id":"0cbfdd23-e0c8-4cc1-80da-69e2e3e997af","angkatan":"7","divisi":"Layouter","jabatan":"Layouter","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'layouter',
      'Layouter',
      7,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-078' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ramadhan Bima Arifin (PTV-079) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-079';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-079',
      'Ramadhan Bima Arifin',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:39.786561+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"cf10ed7e-d148-4da5-b3a2-5cd0686bcfdc","production_id":"19e13f6a-e505-4016-acda-71134fffd5ae","angkatan":"9","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      9,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-079' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ramzy Fauzan Ma'arif (PTV-080) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-080';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-080',
      'Ramzy Fauzan Ma''arif',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:40.180096+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"808eff31-6219-49a9-9098-450a4601d5bf","production_id":"aef43c37-e216-464e-9e1e-c41af4c6a0ae","angkatan":"8","divisi":"Technical","jabatan":"Director","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Director',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-080' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Rasya Putra Arofah (PTV-081) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-081';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-081',
      'Rasya Putra Arofah',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:40.556349+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"706d99b7-ce4a-42b8-87e3-86a06e14bf27","production_id":"1c0b3614-fecb-4d93-8a2b-a1c2a306cc60","angkatan":"9","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      9,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-081' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Rayhan Bayhaqi Wibisono (PTV-082) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-082';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-082',
      'Rayhan Bayhaqi Wibisono',
      'https://progresiftv.id/wp-content/uploads/KNTG_11zon-scaled-e1762628105187.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/KNTG_11zon-scaled-e1762628105187.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:40.952331+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"93753287-a0c1-4507-a766-4c34a72a5489","production_id":"1faf938e-2425-46bf-b305-0b0bba69eb3a","angkatan":"11","divisi":"Technical","jabatan":"Photographer","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Photographer',
      11,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-082' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Rizqi Kevin Melodi (PTV-083) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-083';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-083',
      'Rizqi Kevin Melodi',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:41.378998+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"baab1224-8ef8-4bf6-8ae4-70c42ebb410f","production_id":"206e9da3-348b-4256-a726-0a503d466de8","angkatan":"3","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      3,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-083' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Rizqi Muhammad Sahrul Ramadhani (PTV-084) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-084';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-084',
      'Rizqi Muhammad Sahrul Ramadhani',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:41.747372+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"ca2fc021-ecd4-44bb-92cb-9040db140dc3","production_id":"122b84b3-ba8d-4f9f-9230-5797f65be0ae","angkatan":"8","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      8,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-084' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Sholahuddin Adam Zaeni (PTV-085) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-085';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-085',
      'Sholahuddin Adam Zaeni',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:42.077522+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"c980e3a4-d858-45b5-a8b9-bc9316171c3e","production_id":"2968d365-038c-497d-937c-c2e20b69d8c6","angkatan":"7","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      7,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-085' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Syarif Hasan Billah Rabbani (PTV-086) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-086';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-086',
      'Syarif Hasan Billah Rabbani',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-09-22T21:10:43.22151+00:00","updated_at":"2026-09-28T23:31:42.480128+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"92389209-c819-42ce-8de5-2156c7953aa7","production_id":"1d4a991f-0179-4b76-8c94-78f4dadb45e6","angkatan":"10","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-086' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Tobias Yardan Subijanto (PTV-087) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-087';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-087',
      'Tobias Yardan Subijanto',
      NULL,
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":null,"created_at":"2026-05-09T14:50:55+00:00","updated_at":"2026-09-28T23:31:42.88338+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"5a640bde-56bb-4d4e-98f2-859b85781389","production_id":"18e1dc8b-95ad-4cdb-bcfd-960552021ddf","angkatan":"10","divisi":"Technical","jabatan":"Kru","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Kru',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-087' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Tristan Camillo Juliatmoko (PTV-088) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-088';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-088',
      'Tristan Camillo Juliatmoko',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:43.259003+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"5bac0ba2-af00-49ca-895f-37b9b50f6d13","production_id":"29f52543-cb9d-4f4b-afbc-0e152f9e6ca4","angkatan":"10","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-088' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Ustadz Agus Salim S.E. (PTV-089) | Divisi Asli: Pembina | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-089';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-089',
      'Ustadz Agus Salim S.E.',
      'https://progresiftv.id/wp-content/uploads/ZED00219@1.5x.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/ZED00219@1.5x.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:43.637497+00:00","wp_user_id":null,"role_legacy":"kru","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"2b03d847-280a-4e0f-bb7a-650de95b3f17","production_id":"2aa9e257-f132-4b64-9128-7566c240ee16","angkatan":"Pembina","divisi":"Pembina","jabatan":"Pembina","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      NULL,
      'Pembina',
      NULL,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-089' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Wahyudi (PTV-090) | Divisi Asli: Editor | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-090';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-090',
      'Wahyudi',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:43.97101+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"0bb6991d-07b5-42e6-9e6c-3c93f89cc482","production_id":"504669ea-4d58-4e81-a1f1-5b791b053f17","angkatan":"6","divisi":"Editor","jabatan":"Editor","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'editor',
      'Editor',
      6,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-090' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Zaheed Sabiq Azhar (PTV-091) | Divisi Asli: Engagement | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-091';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-091',
      'Zaheed Sabiq Azhar',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:44.343796+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"469617fd-b07d-420e-9746-cc526cfc7178","production_id":"4470318a-060f-4d94-bbfa-9b78f891c3a2","angkatan":"6","divisi":"Engagement","jabatan":"Creative","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'engagements',
      'Creative',
      6,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-091' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Personel: Zidan Zamzamy (PTV-092) | Divisi Asli: Technical | Status: nonaktif
  -- ============================================================================
  v_identity_id := NULL;

  -- 1. Pemeriksaan / Pembuatan canonical_identity
  SELECT id INTO v_identity_id FROM public.canonical_identity WHERE ptv_id = 'PTV-092';

  IF v_identity_id IS NULL THEN
    INSERT INTO public.canonical_identity (
      ptv_id,
      full_name,
      avatar_url,
      legacy_id,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      'PTV-092',
      'Zidan Zamzamy',
      'https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp',
      NULL,
      '{"nim":null,"jurusan":null,"oauth_uid":null,"avatar_url":"https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp","created_at":"2026-04-29T23:30:52+00:00","updated_at":"2026-09-28T23:31:44.677277+00:00","wp_user_id":null,"role_legacy":"member","oauth_provider":null,"migrated_by":"PTV-DEV-228","migrated_at":"2026-10-30T07:28:00Z","legacy_archive_id":"562723a0-0922-4678-84c3-6c4c3f6f95d9","production_id":"0c3766f6-07dd-48af-a03f-277ea8460e33","angkatan":"10","divisi":"Technical","jabatan":"Technical","telepon":null,"email":null,"alamat":null,"tanggal_lahir":null}'::jsonb,
      v_now,
      v_now
    ) RETURNING id INTO v_identity_id;
  END IF;

  -- 2. Pemeriksaan / Pembuatan organization_membership (Idempotensi terpisah)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_membership 
    WHERE identity_id = v_identity_id AND organization_id = 'ptv_studio'
  ) THEN
    INSERT INTO public.organization_membership (
      identity_id,
      organization_id,
      division_id,
      position_title,
      cohort,
      status_organisasi,
      period_start,
      is_current,
      created_at,
      updated_at
    ) VALUES (
      v_identity_id,
      'ptv_studio',
      'technical',
      'Technical',
      10,
      'inactive',
      CURRENT_DATE,
      true,
      v_now,
      v_now
    );
  END IF;

  -- 3. Penautan kembali ke legacy_archive_kru (termasuk jika dijalankan berulang)
  UPDATE public.legacy_archive_kru
  SET canonical_identity_id = v_identity_id,
      reconciliation_status = 'linked'
  WHERE ptv_id = 'PTV-092' 
    AND (canonical_identity_id IS NULL OR canonical_identity_id != v_identity_id);

  -- ============================================================================
  -- Sinkronisasi Penautan 25 Kru Kanonikal Existing pada legacy_archive_kru
  -- ============================================================================
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '0200ce68-10bb-45a3-8422-49ec5ce376ef', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-020' AND (canonical_identity_id IS NULL OR canonical_identity_id != '0200ce68-10bb-45a3-8422-49ec5ce376ef');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '02cade6b-16df-426a-b7b7-a59c60581187', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-002' AND (canonical_identity_id IS NULL OR canonical_identity_id != '02cade6b-16df-426a-b7b7-a59c60581187');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '0314c1a4-c5f7-4afc-a6c6-b7f281a70f0b', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-029' AND (canonical_identity_id IS NULL OR canonical_identity_id != '0314c1a4-c5f7-4afc-a6c6-b7f281a70f0b');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-027' AND (canonical_identity_id IS NULL OR canonical_identity_id != '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '0f97447d-bc24-48e0-948d-e36b1f53049d', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-023' AND (canonical_identity_id IS NULL OR canonical_identity_id != '0f97447d-bc24-48e0-948d-e36b1f53049d');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '10572ebd-da93-4a89-a6ef-f46c53120616', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-025' AND (canonical_identity_id IS NULL OR canonical_identity_id != '10572ebd-da93-4a89-a6ef-f46c53120616');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '13db53b8-517a-44d5-b6db-b1eb204cf442', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-026' AND (canonical_identity_id IS NULL OR canonical_identity_id != '13db53b8-517a-44d5-b6db-b1eb204cf442');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '15cf3fd3-ef0a-4eb4-afb8-360747514e7b', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-016' AND (canonical_identity_id IS NULL OR canonical_identity_id != '15cf3fd3-ef0a-4eb4-afb8-360747514e7b');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '22d7d714-f163-46d5-b691-46455eb8a28a', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-024' AND (canonical_identity_id IS NULL OR canonical_identity_id != '22d7d714-f163-46d5-b691-46455eb8a28a');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '23265396-401c-409a-a0d1-09dbc95507ca', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-033' AND (canonical_identity_id IS NULL OR canonical_identity_id != '23265396-401c-409a-a0d1-09dbc95507ca');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '23b21c03-d6c5-4858-83b5-82e7d805ba66', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-036' AND (canonical_identity_id IS NULL OR canonical_identity_id != '23b21c03-d6c5-4858-83b5-82e7d805ba66');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '23f8a9cf-cb4e-4543-8207-7aef92692ead', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-003' AND (canonical_identity_id IS NULL OR canonical_identity_id != '23f8a9cf-cb4e-4543-8207-7aef92692ead');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '29dc4b45-9465-4d90-9cb3-051438f067b7', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-031' AND (canonical_identity_id IS NULL OR canonical_identity_id != '29dc4b45-9465-4d90-9cb3-051438f067b7');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '323176b7-5448-4681-a573-ce842a1d9f1d', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-021' AND (canonical_identity_id IS NULL OR canonical_identity_id != '323176b7-5448-4681-a573-ce842a1d9f1d');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '37675f89-0e28-479d-9cfd-c82b374da057', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-005' AND (canonical_identity_id IS NULL OR canonical_identity_id != '37675f89-0e28-479d-9cfd-c82b374da057');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '397e410c-8932-4839-8128-0b71c88162df', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-035' AND (canonical_identity_id IS NULL OR canonical_identity_id != '397e410c-8932-4839-8128-0b71c88162df');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '4380044d-ca1c-4795-b735-6b7679de78b9', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-022' AND (canonical_identity_id IS NULL OR canonical_identity_id != '4380044d-ca1c-4795-b735-6b7679de78b9');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '4e6f7e9f-4084-4228-a565-88a50b13b1df', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-019' AND (canonical_identity_id IS NULL OR canonical_identity_id != '4e6f7e9f-4084-4228-a565-88a50b13b1df');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '73ee2fcd-f736-4258-b4cf-9e1745546c4c', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-028' AND (canonical_identity_id IS NULL OR canonical_identity_id != '73ee2fcd-f736-4258-b4cf-9e1745546c4c');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '860322f9-15bf-42b0-a5ec-77f29f89b3f9', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-004' AND (canonical_identity_id IS NULL OR canonical_identity_id != '860322f9-15bf-42b0-a5ec-77f29f89b3f9');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = '8fb1aa38-c469-4dc5-9392-8588f7a71e39', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-001' AND (canonical_identity_id IS NULL OR canonical_identity_id != '8fb1aa38-c469-4dc5-9392-8588f7a71e39');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-030' AND (canonical_identity_id IS NULL OR canonical_identity_id != 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-032' AND (canonical_identity_id IS NULL OR canonical_identity_id != 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-006' AND (canonical_identity_id IS NULL OR canonical_identity_id != 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c');
  UPDATE public.legacy_archive_kru SET canonical_identity_id = 'e3508a62-0f90-4154-b0f1-51abd66182cf', reconciliation_status = 'linked' WHERE ptv_id = 'PTV-034' AND (canonical_identity_id IS NULL OR canonical_identity_id != 'e3508a62-0f90-4154-b0f1-51abd66182cf');

  RAISE NOTICE 'Migrasi selesai sukses.';
END $$;

-- ==============================================================================
-- QUERY VERIFIKASI HASIL EKSEKUSI
-- ==============================================================================
SELECT 
  (SELECT count(*) FROM public.canonical_identity) AS total_canonical_identities,
  (SELECT count(*) FROM public.canonical_identity WHERE ptv_id LIKE 'PTV-STG%' OR ptv_id LIKE 'PTV-TEST%') AS total_identitas_testing_sistem,
  (SELECT count(*) FROM public.canonical_identity WHERE ptv_id NOT LIKE 'PTV-STG%' AND ptv_id NOT LIKE 'PTV-TEST%') AS total_personel_asli,
  (SELECT count(*) FROM public.organization_membership) AS total_organization_memberships,
  (SELECT count(*) FROM public.user_account) AS total_akun_login,
  (SELECT count(*) FROM public.legacy_archive_kru WHERE canonical_identity_id IS NOT NULL) AS total_arsip_tertata;
