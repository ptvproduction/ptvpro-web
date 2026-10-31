-- ============================================================================
-- PTVPRO — REKONSILIASI DUPLIKASI IDENTITAS HAMDAN (STAGING ONLY)
-- Sesi: PTV-DEV-237 | Target DB: Supabase Staging swadgljnyelsjstqqxbm
-- Eksekusi: Atomik dalam satu transaksi blok PL/pgSQL dengan proteksi penuh
-- ============================================================================

DO $$
DECLARE
  v_primary_id UUID := 'b93d88de-346a-49a1-a291-cc48188fb917';   -- PTV-017 (Primary)
  v_duplicate_id UUID := '48bf9cce-66a3-4e21-8569-6f8cdbdf6c63'; -- PTV-064 (Duplicate to merge)
  v_gus_burhan_id UUID := '856eeb5a-5c2e-40f7-81dc-2535dc0110eb';-- PTV-015 (Protected)
  
  v_primary_record public.canonical_identity%ROWTYPE;
  v_duplicate_record public.canonical_identity%ROWTYPE;
  v_gus_burhan_record public.canonical_identity%ROWTYPE;
  
  v_primary_mem_id UUID;
  v_duplicate_mem_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_merged_meta JSONB;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. PREFLIGHT SAFETY GUARDS & INTEGRITY CHECK
  -- --------------------------------------------------------------------------
  
  -- 1.1 Pastikan identitas utama PTV-017 ada dan valid
  SELECT * INTO v_primary_record 
  FROM public.canonical_identity 
  WHERE id = v_primary_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SAFETY GUARD: Identitas utama PTV-017 (%) tidak ditemukan!', v_primary_id;
  END IF;

  IF v_primary_record.ptv_id <> 'PTV-017' THEN
    RAISE EXCEPTION 'SAFETY GUARD: PTV ID identitas utama bukan PTV-017 (didapat %)!', v_primary_record.ptv_id;
  END IF;

  -- 1.2 Pastikan identitas duplikat PTV-064 ada dan valid
  SELECT * INTO v_duplicate_record 
  FROM public.canonical_identity 
  WHERE id = v_duplicate_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'INFO: Identitas duplikat % sudah tidak ada atau sudah digabung sebelumnya.', v_duplicate_id;
  ELSE
    IF v_duplicate_record.ptv_id <> 'PTV-064' THEN
      RAISE EXCEPTION 'SAFETY GUARD: PTV ID identitas duplikat bukan PTV-064 (didapat %)!', v_duplicate_record.ptv_id;
    END IF;
  END IF;

  -- 1.3 Pastikan identitas Gus Burhan (PTV-015) terlindungi dan tidak berubah
  SELECT * INTO v_gus_burhan_record 
  FROM public.canonical_identity 
  WHERE ptv_id = 'PTV-015';

  IF NOT FOUND OR v_gus_burhan_record.id <> v_gus_burhan_id THEN
    RAISE EXCEPTION 'SAFETY GUARD: Identitas resmi PTV-015 (Gus Burhan) tidak sesuai atau hilang!';
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. GABUNGKAN DATA METADATA KE IDENTITAS UTAMA (PTV-017)
  -- --------------------------------------------------------------------------
  v_merged_meta := v_primary_record.metadata || jsonb_build_object(
    'divisi', 'Technical',
    'jabatan', 'Technical',
    'angkatan', '12',
    'status', 'nonaktif',
    'reconciled_duplicate_uuid', v_duplicate_id,
    'reconciled_duplicate_ptv_id', 'PTV-064',
    'reconciled_at', v_now,
    'reconciled_by', 'PTV-DEV-237'
  );

  UPDATE public.canonical_identity 
  SET metadata = v_merged_meta,
      updated_at = v_now
  WHERE id = v_primary_id;

  RAISE NOTICE 'Langkah 2 Berhasil: Metadata PTV-017 diperbarui dengan data rekonsiliasi.';

  -- --------------------------------------------------------------------------
  -- 3. REKONSILIASI ORGANIZATION MEMBERSHIP (ANTI KEANGGOTAAN GANDA)
  -- --------------------------------------------------------------------------
  -- Cari membership primary
  SELECT id INTO v_primary_mem_id 
  FROM public.organization_membership 
  WHERE identity_id = v_primary_id AND organization_id = 'ptv_studio' 
  LIMIT 1;

  IF v_primary_mem_id IS NOT NULL THEN
    UPDATE public.organization_membership
    SET division_id = 'technical',
        status_organisasi = 'inactive',
        position_title = 'Technical',
        cohort = 12,
        updated_at = v_now
    WHERE id = v_primary_mem_id;
    RAISE NOTICE 'Langkah 3.1 Berhasil: Membership PTV-017 disinkronkan ke technical/inactive/cohort 12.';
  END IF;

  -- Hapus membership duplikat agar tidak ada keanggotaan ganda di ptv_studio
  DELETE FROM public.organization_membership 
  WHERE identity_id = v_duplicate_id;
  RAISE NOTICE 'Langkah 3.2 Berhasil: Membership duplikat dieliminasi dari organization_membership.';

  -- --------------------------------------------------------------------------
  -- 4. PERTAHANKAN ARSIP LEGACY KRU (HISTORI UTUH DENGAN LINK KANONIKAL)
  -- --------------------------------------------------------------------------
  -- Arahkan referensi canonical pada arsip PTV-064 ke UUID identitas utama,
  -- tanpa mengubah ptv_id historis ('PTV-064')
  UPDATE public.legacy_archive_kru 
  SET canonical_identity_id = v_primary_id,
      reconciliation_status = 'linked',
      metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'is_duplicate_archive', true,
        'reconciliation_note', 'Merged into canonical identity ' || v_primary_id::text || ' (PTV-017) by PTV-DEV-237',
        'reconciled_at', v_now
      )
  WHERE ptv_id = 'PTV-064';

  RAISE NOTICE 'Langkah 4 Berhasil: Arsip legacy PTV-064 terhubung ke canonical identity utama.';

  -- --------------------------------------------------------------------------
  -- 5. HAPUS RECORD CANONICAL DUPLIKAT
  -- --------------------------------------------------------------------------
  DELETE FROM public.canonical_identity 
  WHERE id = v_duplicate_id;

  RAISE NOTICE 'Langkah 5 Berhasil: Record canonical duplikat PTV-064 berhasil dihapus.';

  -- --------------------------------------------------------------------------
  -- 6. VERIFIKASI AKHIR ATOMIK
  -- --------------------------------------------------------------------------
  -- Pastikan tepat satu canonical identity untuk Hamdan
  IF (SELECT count(*) FROM public.canonical_identity WHERE full_name ILIKE '%Hamdan%') <> 1 THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: Ditemukan jumlah canonical identity Hamdan selain 1!';
  END IF;

  -- Pastikan canonical identity Hamdan yang tersisa adalah PTV-017 dengan UUID utama
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_identity 
    WHERE id = v_primary_id AND ptv_id = 'PTV-017'
  ) THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: PTV-017 tidak ditemukan pada canonical_identity!';
  END IF;

  -- Pastikan PTV-064 tidak lagi ada di canonical_identity
  IF EXISTS (
    SELECT 1 FROM public.canonical_identity WHERE ptv_id = 'PTV-064' OR id = v_duplicate_id
  ) THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: PTV-064 masih ditemukan di canonical_identity!';
  END IF;

  -- Pastikan Gus Burhan (PTV-015) tetap utuh
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_identity 
    WHERE id = v_gus_burhan_id AND ptv_id = 'PTV-015'
  ) THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: Identitas PTV-015 terganggu!';
  END IF;

  -- Pastikan tepat satu membership untuk Hamdan
  IF (SELECT count(*) FROM public.organization_membership WHERE identity_id = v_primary_id) <> 1 THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: Jumlah membership Hamdan tidak tepat 1!';
  END IF;

  -- Pastikan kedua arsip legacy menunjuk ke canonical identity utama
  IF (
    SELECT count(*) FROM public.legacy_archive_kru 
    WHERE ptv_id IN ('PTV-017', 'PTV-064') AND canonical_identity_id = v_primary_id
  ) <> 2 THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: Arsip legacy PTV-017 & PTV-064 tidak keduanya menunjuk ke primary ID!';
  END IF;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'SUKSES: REKONSILIASI DUPLIKASI IDENTITAS HAMDAN SELESAI 100%%';
  RAISE NOTICE 'Primary Canonical: PTV-017 (%)', v_primary_id;
  RAISE NOTICE 'Gus Burhan Protected: PTV-015 (%)', v_gus_burhan_id;
  RAISE NOTICE 'Arsip Terhubung: PTV-017 & PTV-064 -> %', v_primary_id;
  RAISE NOTICE '====================================================================';
END $$;
