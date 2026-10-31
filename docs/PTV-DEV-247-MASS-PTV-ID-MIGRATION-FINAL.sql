-- ============================================================================
-- PTVPRO — MIGRASI MASSAL ID PTV FINAL (STAGING)
-- Sesi: PTV-DEV-247 | Target DB: Supabase Staging swadgljnyelsjstqqxbm
-- Eksekusi: Supabase SQL Editor (Database Owner / Superuser)
-- Sifat: Atomik, Idempotent, Non-Destruktif, Bebas Siklus Constraint
-- ============================================================================
-- Ringkasan:
--   - 91 Identitas resmi dimigrasikan ke ID PTV baru sesuai spreadsheet final.
--   - 3 Akun staging/test (PTV-STG-ADM, PTV-STG-KRU, PTV-TEST-171) dipertahankan.
--   - ID khusus dipertahankan: PTV-456, PTV-NIKSAN, PTV-PBS-01 s.d. PTV-PBS-12.
--   - Muhammad Hamdan Yuwafi Sulaim (b93d88de-346a-49a1-a291-cc48188fb917) -> PTV-015.
--   - Mekanisme 2-Fase 'TMP-0001' (8 char <= VARCHAR(16)) mencegah konflik UNIQUE(ptv_id)
--     pada 72 pertukaran ID.
--   - Seluruh relasi nomor diperbarui: canonical_identity, legacy_archive_kru,
--     ptv_finance_settings (Bendahara PTV-023 -> PTV-014), dan ptv_catatan.
-- ============================================================================

DO $$
DECLARE
  v_count_ci INT;
  v_count_tmp INT;
  v_count_unmigrated INT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  RAISE NOTICE '=== MEMULAI MIGRASI MASSAL ID PTV FINAL (PTV-DEV-247) ===';

  -- --------------------------------------------------------------------------
  -- 1. PREFLIGHT SAFETY GUARDS
  -- --------------------------------------------------------------------------
  -- Pastikan tabel canonical_identity memiliki tepat 94 baris
  SELECT count(*) INTO v_count_ci FROM public.canonical_identity;
  IF v_count_ci <> 94 THEN
    RAISE EXCEPTION 'PREFLIGHT GAGAL: Jumlah baris canonical_identity (%) bukan 94!', v_count_ci;
  END IF;

  -- Pastikan identitas Hamdan utama ada
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_identity 
    WHERE id = 'b93d88de-346a-49a1-a291-cc48188fb917'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT GAGAL: Identitas utama Hamdan (b93d88de-346a-49a1-a291-cc48188fb917) tidak ditemukan!';
  END IF;

  -- Pastikan identitas duplikat Hamdan TIDAK ada di canonical_identity
  IF EXISTS (
    SELECT 1 FROM public.canonical_identity 
    WHERE id = '48bf9cce-66a3-4e21-8569-6f8cdbdf6c63'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT GAGAL: Identitas duplikat Hamdan (48bf9cce-66a3-4e21-8569-6f8cdbdf6c63) masih ada!';
  END IF;

  -- Pastikan 3 akun staging/test ada
  IF (
    SELECT count(*) FROM public.canonical_identity 
    WHERE id IN (
      'd00893ac-3d6b-4da8-b12f-2353cea729aa', -- PTV-STG-ADM
      'b93d89c8-457f-4bad-a99b-edbb06af0482', -- PTV-STG-KRU
      '57bb9724-6a71-46ba-ac3b-35a922261b56'  -- PTV-TEST-171
    )
  ) <> 3 THEN
    RAISE EXCEPTION 'PREFLIGHT GAGAL: Akun staging/test tidak lengkap!';
  END IF;

  RAISE NOTICE 'Langkah 1 Berhasil: Preflight safety guards lolos 100%%.';

  -- --------------------------------------------------------------------------
  -- 2. FASE 1: RELOKASI KE ID SEMENTARA (ANTI-COLLISION UNIQUE CONSTRAINT)
  -- --------------------------------------------------------------------------
  -- Mengalihkan 91 identitas yang dimigrasi ke format kompak 'TMP-0001' s.d. 'TMP-0091'
  -- (panjang 8 karakter, aman untuk kolom VARCHAR(16)) untuk mengosongkan
  -- seluruh ID target dan mencegah pelanggaran UNIQUE(ptv_id) selama pertukaran.
  WITH numbered AS (
    SELECT id, 'TMP-' || LPAD(row_number() OVER (ORDER BY id)::text, 4, '0') AS tmp_id
    FROM public.canonical_identity
    WHERE id NOT IN (
      'd00893ac-3d6b-4da8-b12f-2353cea729aa',
      'b93d89c8-457f-4bad-a99b-edbb06af0482',
      '57bb9724-6a71-46ba-ac3b-35a922261b56'
    )
  )
  UPDATE public.canonical_identity ci
  SET ptv_id = numbered.tmp_id,
      updated_at = v_now
  FROM numbered
  WHERE ci.id = numbered.id;

  SELECT count(*) INTO v_count_tmp 
  FROM public.canonical_identity 
  WHERE ptv_id LIKE 'TMP-%';

  IF v_count_tmp <> 91 THEN
    RAISE EXCEPTION 'FASE 1 GAGAL: Jumlah record sementara (%) bukan 91!', v_count_tmp;
  END IF;

  RAISE NOTICE 'Langkah 2 Berhasil: 91 identitas dialihkan ke ID sementara TMP-0001..TMP-0091 (bebas tabrakan).';

  -- --------------------------------------------------------------------------
  -- 3. FASE 2: PENETAPAN ID PTV BARU FINAL
  -- --------------------------------------------------------------------------
  -- PTV-006: Muhammad Izzur Fauzil Adhim (sebelumnya PTV-016)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-006', updated_at = v_now WHERE id = '15cf3fd3-ef0a-4eb4-afb8-360747514e7b';
  -- PTV-007: Muhammad Farras Zaidan Mubarok (sebelumnya PTV-003)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-007', updated_at = v_now WHERE id = '23f8a9cf-cb4e-4543-8207-7aef92692ead';
  -- PTV-008: Rafa Putra Rouf (sebelumnya PTV-002)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-008', updated_at = v_now WHERE id = '02cade6b-16df-426a-b7b7-a59c60581187';
  -- PTV-009: Taqiu Rabbani Fadillah (sebelumnya PTV-033)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-009', updated_at = v_now WHERE id = '23265396-401c-409a-a0d1-09dbc95507ca';
  -- PTV-010: Nasshar Rasikh Arsyadiano (sebelumnya PTV-031)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-010', updated_at = v_now WHERE id = '29dc4b45-9465-4d90-9cb3-051438f067b7';
  -- PTV-011: Ganesha Axl Fersalley (sebelumnya PTV-025)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-011', updated_at = v_now WHERE id = '10572ebd-da93-4a89-a6ef-f46c53120616';
  -- PTV-012: Aqil Afzal Al Farisi (sebelumnya PTV-020)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-012', updated_at = v_now WHERE id = '0200ce68-10bb-45a3-8422-49ec5ce376ef';
  -- PTV-013: Arventza Martins (sebelumnya PTV-021)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-013', updated_at = v_now WHERE id = '323176b7-5448-4681-a573-ce842a1d9f1d';
  -- PTV-014: Farsya Naufal Rahmandika (sebelumnya PTV-023)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-014', updated_at = v_now WHERE id = '0f97447d-bc24-48e0-948d-e36b1f53049d';
  -- PTV-015: Muhammad Hamdan Yuwafi Sulaim (sebelumnya PTV-017)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-015', updated_at = v_now WHERE id = 'b93d88de-346a-49a1-a291-cc48188fb917';
  -- PTV-016: Dzaki Alita Sejahtera (sebelumnya PTV-022)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-016', updated_at = v_now WHERE id = '4380044d-ca1c-4795-b735-6b7679de78b9';
  -- PTV-017: Ahmad Royyan Syauqie (sebelumnya PTV-019)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-017', updated_at = v_now WHERE id = '4e6f7e9f-4084-4228-a565-88a50b13b1df';
  -- PTV-018: Iyyaka Fahabil Farhan (sebelumnya PTV-026)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-018', updated_at = v_now WHERE id = '13db53b8-517a-44d5-b6db-b1eb204cf442';
  -- PTV-019: Muhammad Fahmi Izzudin (sebelumnya PTV-029)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-019', updated_at = v_now WHERE id = '0314c1a4-c5f7-4afc-a6c6-b7f281a70f0b';
  -- PTV-020: Muhammad Daghfal Faizullah (sebelumnya PTV-028)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-020', updated_at = v_now WHERE id = '73ee2fcd-f736-4258-b4cf-9e1745546c4c';
  -- PTV-021: Rex Ruizhi Gajendra (sebelumnya PTV-032)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-021', updated_at = v_now WHERE id = 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8';
  -- PTV-022: Malik Gundhaya Wiriarsa (sebelumnya PTV-027)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-022', updated_at = v_now WHERE id = '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0';
  -- PTV-023: Muhammad Isa (sebelumnya PTV-030)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-023', updated_at = v_now WHERE id = 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c';
  -- PTV-024: Fathur Rahmanhadi Saputra (sebelumnya PTV-024)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-024', updated_at = v_now WHERE id = '22d7d714-f163-46d5-b691-46455eb8a28a';
  -- PTV-025: Abyan Zahir Wijaksono (sebelumnya PTV-004)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-025', updated_at = v_now WHERE id = '860322f9-15bf-42b0-a5ec-77f29f89b3f9';
  -- PTV-026: Ziddan Arzaqi (sebelumnya PTV-034)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-026', updated_at = v_now WHERE id = 'e3508a62-0f90-4154-b0f1-51abd66182cf';
  -- PTV-027: Arham Putra Nur Baasith (sebelumnya PTV-006)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-027', updated_at = v_now WHERE id = 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c';
  -- PTV-028: Luthfi Maulana Kholil (sebelumnya PTV-061)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-028', updated_at = v_now WHERE id = '72d00739-84a4-42c9-90aa-8b41e656c51d';
  -- PTV-029: Nauris Firdaus Rofauddin (sebelumnya PTV-075)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-029', updated_at = v_now WHERE id = '46252d55-ac71-44ca-a99e-8eab88e6fc59';
  -- PTV-030: Rizqi Kevin Melodi (sebelumnya PTV-083)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-030', updated_at = v_now WHERE id = '90ec48ac-746e-44c7-ac17-3e2f3edb54c3';
  -- PTV-031: Ahmad Daffa Khoiri Falih (sebelumnya PTV-039)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-031', updated_at = v_now WHERE id = '10133fe6-90d3-446f-b363-ecd57b82b6bb';
  -- PTV-032: Alfi Aufarul Anwar (sebelumnya PTV-044)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-032', updated_at = v_now WHERE id = '547b7657-4a50-41ba-a469-b868219da26f';
  -- PTV-033: Nafis Azizi Riza (sebelumnya PTV-071)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-033', updated_at = v_now WHERE id = '69846327-12bf-418b-851e-9f2fa777fd60';
  -- PTV-034: Naufal Arsy Katon (sebelumnya PTV-072)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-034', updated_at = v_now WHERE id = '213473b6-2320-4353-9c36-5b8c5afc7058';
  -- PTV-035: Rahardian Asyam Zuhdi (sebelumnya PTV-077)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-035', updated_at = v_now WHERE id = '2b639791-aea9-4aca-881b-27eb807e1d68';
  -- PTV-036: Ikzaaz Abd (sebelumnya PTV-059)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-036', updated_at = v_now WHERE id = '8f0884e2-d4fc-432b-90f8-12ac718ceb6f';
  -- PTV-037: Muhammad Azkal Azkia (sebelumnya PTV-063)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-037', updated_at = v_now WHERE id = 'e33ac363-a93d-4431-86a8-8100071dd17c';
  -- PTV-038: Muhammad Maulana Mukti Nanang (sebelumnya PTV-067)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-038', updated_at = v_now WHERE id = '1bc54af0-afd9-464a-a039-2bea6a3613ee';
  -- PTV-039: Muhammad Razzan Ramadhana (sebelumnya PTV-069)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-039', updated_at = v_now WHERE id = '0ec6754d-eaf3-46f3-97aa-93917be1cf84';
  -- PTV-040: Wahyudi (sebelumnya PTV-090)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-040', updated_at = v_now WHERE id = 'bd839620-8462-4ba2-a526-7a861bb26dc1';
  -- PTV-041: Zaheed Sabiq Azhar (sebelumnya PTV-091)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-041', updated_at = v_now WHERE id = '9548c97c-7c20-445f-b282-cee6b8debae5';
  -- PTV-042: Ahmad Nolan Furjah (sebelumnya PTV-042)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-042', updated_at = v_now WHERE id = '862b6f55-6664-4070-8487-45cda5cd4f68';
  -- PTV-043: Akhmad Sefril Hawari (sebelumnya PTV-043)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-043', updated_at = v_now WHERE id = 'c54ee2b6-6f1b-4763-bce0-5c1c6897cf17';
  -- PTV-044: Dafangga Raffi Ahmad (sebelumnya PTV-008)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-044', updated_at = v_now WHERE id = '9c6539c6-7ddf-4725-81a2-ac19a2bed92b';
  -- PTV-045: Naufal Wahana (sebelumnya PTV-074)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-045', updated_at = v_now WHERE id = 'aa388083-7e2f-4c55-a227-c02d2e5c20dc';
  -- PTV-046: Raihan Adz Dzikra (sebelumnya PTV-078)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-046', updated_at = v_now WHERE id = '977a960d-7333-4186-9e6d-0ab24989ffda';
  -- PTV-047: Sholahuddin Adam Zaeni (sebelumnya PTV-085)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-047', updated_at = v_now WHERE id = '1291e3df-edff-4381-9fd9-14434ff0f19b';
  -- PTV-048: Abdul Wahid Tamimi (sebelumnya PTV-037)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-048', updated_at = v_now WHERE id = '6c3b262b-7f9e-4f43-810a-a634c1585780';
  -- PTV-049: Bradie Naradithya Rifiyansyah (sebelumnya PTV-048)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-049', updated_at = v_now WHERE id = '73f741a6-0c65-436e-b731-10854a7a8ba1';
  -- PTV-050: Dzulkhifly Izha Qondias (sebelumnya PTV-050)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-050', updated_at = v_now WHERE id = 'd21fd211-c90e-4331-b796-6a0cce6ae310';
  -- PTV-051: Farrel Dimas Saputra (sebelumnya PTV-009)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-051', updated_at = v_now WHERE id = '032a2c48-2de7-4571-bbc7-e5455d79b5f1';
  -- PTV-052: Muhammad Iqbal Azinuddin Hazmi (sebelumnya PTV-065)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-052', updated_at = v_now WHERE id = '0a158602-9e94-42dc-8da6-4ebf5c8aa988';
  -- PTV-053: Muhammad Kiswah Mubarok (sebelumnya PTV-066)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-053', updated_at = v_now WHERE id = 'b8932495-c4c2-4bb6-b98b-c5907d44345f';
  -- PTV-054: Muhammad Rafli Rizqullah (sebelumnya PTV-010)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-054', updated_at = v_now WHERE id = '8e0563fd-e05d-4c3c-9386-a10cd61bd3b1';
  -- PTV-055: Ramzy Fauzan Ma''arif (sebelumnya PTV-080)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-055', updated_at = v_now WHERE id = '3c1620e1-5110-447c-bdd6-96400d063cb7';
  -- PTV-056: Rizqi Muhammad Sahrul Ramadhani (sebelumnya PTV-084)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-056', updated_at = v_now WHERE id = 'a32cfdbb-d26d-4457-9c8e-9432ff529ce2';
  -- PTV-057: Faiq Admaja Wibowo (sebelumnya PTV-052)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-057', updated_at = v_now WHERE id = 'cd9da3d8-2c1e-404a-b6a7-b2f72d2461f5';
  -- PTV-058: Gathfaan Nur'' Akmal (sebelumnya PTV-054)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-058', updated_at = v_now WHERE id = '8a049b14-cb94-4dc6-842c-ea1c6245cc98';
  -- PTV-059: Ramadhan Bima Arifin (sebelumnya PTV-079)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-059', updated_at = v_now WHERE id = '076a5c84-945f-4af3-9b44-20f5e10a067f';
  -- PTV-060: Rasya Putra Arofah (sebelumnya PTV-081)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-060', updated_at = v_now WHERE id = 'a21dfe6b-01fd-4b58-a4da-032928d0140b';
  -- PTV-061: Adi Maulana (sebelumnya PTV-038)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-061', updated_at = v_now WHERE id = 'b15287c1-1bd0-4f88-81d6-e2291af754ba';
  -- PTV-062: Arundaya Maulana Hariadi (sebelumnya PTV-047)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-062', updated_at = v_now WHERE id = 'baa61d75-b121-435c-ac69-2d76224fc1ea';
  -- PTV-063: Bagaskara Arrasyad Diansaputra (sebelumnya PTV-007)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-063', updated_at = v_now WHERE id = '2131e2e5-7e0d-4024-a8fa-440df426429a';
  -- PTV-064: Dani Raihan Fawwaz Raissa (sebelumnya PTV-049)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-064', updated_at = v_now WHERE id = '29457fc0-b7e7-46f7-9dd9-8a5e857ad62a';
  -- PTV-065: Faler Endy Fadlinazich (sebelumnya PTV-053)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-065', updated_at = v_now WHERE id = 'fe1109a4-59a9-4d03-ace0-6fd4db44e033';
  -- PTV-066: Hafizh Wiryamanggala (sebelumnya PTV-056)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-066', updated_at = v_now WHERE id = '781a239a-2383-4660-8daa-e220c47a6c43';
  -- PTV-067: Muhammad Nizar Nadhem (sebelumnya PTV-068)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-067', updated_at = v_now WHERE id = 'e06f2d03-683b-46c0-aa5b-32400b8d26bd';
  -- PTV-068: Naufal Sirajuddin (sebelumnya PTV-073)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-068', updated_at = v_now WHERE id = 'cde0033c-eb8d-463d-9590-4529dd39f0f4';
  -- PTV-069: Rasya Dwi Maharta (sebelumnya PTV-036)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-069', updated_at = v_now WHERE id = '23b21c03-d6c5-4858-83b5-82e7d805ba66';
  -- PTV-070: Syarif Hasan Billah Rabbani (sebelumnya PTV-086)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-070', updated_at = v_now WHERE id = '4a761e1e-75e1-4f2b-b3a0-2e81a0102ddd';
  -- PTV-071: Tobias Yardan Subijanto (sebelumnya PTV-087)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-071', updated_at = v_now WHERE id = '2b75694d-b8b2-44cc-842f-93e8b2975ec4';
  -- PTV-072: Tristan Camillo Juliatmoko (sebelumnya PTV-088)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-072', updated_at = v_now WHERE id = '71ff0b59-10b6-4592-8756-2533500a4790';
  -- PTV-073: Zidan Zamzamy (sebelumnya PTV-092)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-073', updated_at = v_now WHERE id = '55fb2c7b-604b-441f-8f64-ca783410512d';
  -- PTV-074: Erist Silva Agung Naraya (sebelumnya PTV-051)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-074', updated_at = v_now WHERE id = 'f04cf7ba-81e5-47c7-bcf2-2487763111e6';
  -- PTV-075: Hauna Ittasaqa Rumara (sebelumnya PTV-058)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-075', updated_at = v_now WHERE id = '99ecc99e-2a99-4975-8ecb-07dba06fd6fc';
  -- PTV-076: Ilyas Kareem Rakhman (sebelumnya PTV-060)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-076', updated_at = v_now WHERE id = '90bba6a2-34fc-4234-b559-0aa8539fbd7e';
  -- PTV-077: Rayhan Bayhaqi Wibisono (sebelumnya PTV-082)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-077', updated_at = v_now WHERE id = 'ca15b36b-0450-4446-9c42-6c8386372ba4';
  -- PTV-078: Ghaissan Azky (sebelumnya PTV-055)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-078', updated_at = v_now WHERE id = 'e037310d-ce34-427a-9460-20954b45502f';
  -- PTV-079: Ahmad Dzulfikri Basit (sebelumnya PTV-040)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-079', updated_at = v_now WHERE id = '7f7b0ad0-aaa1-4cbe-bc56-e6cf21c68293';
  -- PTV-080: Ahmad Faiz Dzulfikri (sebelumnya PTV-041)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-080', updated_at = v_now WHERE id = 'f1d1703e-3795-45e3-90b1-2eab9883f4a5';
  -- PTV-081: Haikal Pramana (sebelumnya PTV-057)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-081', updated_at = v_now WHERE id = 'ef3a8d7c-8916-4a9c-9211-a93dcbb9b412';
  -- PTV-082: Raden Attaziya Anindyaveda Priyonggo (sebelumnya PTV-076)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-082', updated_at = v_now WHERE id = '7c4fe9c1-41fb-4e23-b2f8-c130afc929a0';
  -- PTV-456: Muhammad Zidnal Falah (sebelumnya PTV-001)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-456', updated_at = v_now WHERE id = '8fb1aa38-c469-4dc5-9392-8588f7a71e39';
  -- PTV-NIKSAN: Niki Santri (sebelumnya PTV-018)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-NIKSAN', updated_at = v_now WHERE id = '0fef4539-8fe1-424e-b215-74d917c14be3';
  -- PTV-PBS-01: Abuya KH. Agoes Ali Masyhuri (sebelumnya PTV-012)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-01', updated_at = v_now WHERE id = '09c3bcf8-3a85-47ef-a7b6-980e4a814225';
  -- PTV-PBS-02: KH. Aria Muhammad Ali Lc., M.H.I. (sebelumnya PTV-013)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-02', updated_at = v_now WHERE id = 'f8ec423a-6756-4ffd-9e7d-858d0cf6fc3e';
  -- PTV-PBS-03: Agus Dr. H. M. Robith Fuad Lc. (sebelumnya PTV-014)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-03', updated_at = v_now WHERE id = '91da1b9a-9f0a-45db-aa84-7b64f36ecbf8';
  -- PTV-PBS-04: Agus H. Shohibul Burhan Ali S.IP. (sebelumnya PTV-015)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-04', updated_at = v_now WHERE id = '856eeb5a-5c2e-40f7-81dc-2535dc0110eb';
  -- PTV-PBS-05: Indah Nur Laeli S.IP. (sebelumnya PTV-011)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-05', updated_at = v_now WHERE id = '6bad355b-f70d-4051-b85b-dde2bfe557b4';
  -- PTV-PBS-06: Mochammad Wildan Rohadatul Aisy S.H. (sebelumnya PTV-035)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-06', updated_at = v_now WHERE id = '397e410c-8932-4839-8128-0b71c88162df';
  -- PTV-PBS-07: M. Gading Priangga (sebelumnya PTV-005)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-07', updated_at = v_now WHERE id = '37675f89-0e28-479d-9cfd-c82b374da057';
  -- PTV-PBS-08: Alm. Habib Ali Zaenal Abidin Yahya (sebelumnya PTV-045)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-08', updated_at = v_now WHERE id = '1dd55330-243a-479e-a5fc-40e267d22fab';
  -- PTV-PBS-09: Aqila Nur Rahmalia (sebelumnya PTV-046)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-09', updated_at = v_now WHERE id = 'a4fc4657-87ea-447c-aed1-0d204c56c8a1';
  -- PTV-PBS-10: Moh. Adkha Hidayatulloh S.Sos. (sebelumnya PTV-062)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-10', updated_at = v_now WHERE id = 'dd43e4e8-127e-4feb-99a8-075138be621b';
  -- PTV-PBS-11: Nadira Megananda (sebelumnya PTV-070)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-11', updated_at = v_now WHERE id = '8de38394-a91c-4f12-8048-a1e16bc51d94';
  -- PTV-PBS-12: Ustadz Agus Salim S.E. (sebelumnya PTV-089)
  UPDATE public.canonical_identity SET ptv_id = 'PTV-PBS-12', updated_at = v_now WHERE id = 'ddcdc02b-1615-4dbf-a7f7-dcc5d54b0588';

  RAISE NOTICE 'Langkah 3 Berhasil: Seluruh 91 identitas telah ditetapkan ke ID baru.';

  -- --------------------------------------------------------------------------
  -- 4. PEMBARUAN TABEL ARSIP LEGACY (legacy_archive_kru)
  -- --------------------------------------------------------------------------
  -- Menyelaraskan ptv_id pada legacy_archive_kru yang terhubung ke canonical identity,
  -- dengan mengecualikan arsip duplikat historis (is_duplicate_archive = true).
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-006' WHERE canonical_identity_id = '15cf3fd3-ef0a-4eb4-afb8-360747514e7b' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-007' WHERE canonical_identity_id = '23f8a9cf-cb4e-4543-8207-7aef92692ead' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-008' WHERE canonical_identity_id = '02cade6b-16df-426a-b7b7-a59c60581187' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-009' WHERE canonical_identity_id = '23265396-401c-409a-a0d1-09dbc95507ca' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-010' WHERE canonical_identity_id = '29dc4b45-9465-4d90-9cb3-051438f067b7' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-011' WHERE canonical_identity_id = '10572ebd-da93-4a89-a6ef-f46c53120616' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-012' WHERE canonical_identity_id = '0200ce68-10bb-45a3-8422-49ec5ce376ef' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-013' WHERE canonical_identity_id = '323176b7-5448-4681-a573-ce842a1d9f1d' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-014' WHERE canonical_identity_id = '0f97447d-bc24-48e0-948d-e36b1f53049d' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-015' WHERE canonical_identity_id = 'b93d88de-346a-49a1-a291-cc48188fb917' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-016' WHERE canonical_identity_id = '4380044d-ca1c-4795-b735-6b7679de78b9' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-017' WHERE canonical_identity_id = '4e6f7e9f-4084-4228-a565-88a50b13b1df' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-018' WHERE canonical_identity_id = '13db53b8-517a-44d5-b6db-b1eb204cf442' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-019' WHERE canonical_identity_id = '0314c1a4-c5f7-4afc-a6c6-b7f281a70f0b' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-020' WHERE canonical_identity_id = '73ee2fcd-f736-4258-b4cf-9e1745546c4c' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-021' WHERE canonical_identity_id = 'aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-022' WHERE canonical_identity_id = '0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-023' WHERE canonical_identity_id = 'a5198b2d-e6c2-4c93-945a-3a8f25698d6c' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-024' WHERE canonical_identity_id = '22d7d714-f163-46d5-b691-46455eb8a28a' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-025' WHERE canonical_identity_id = '860322f9-15bf-42b0-a5ec-77f29f89b3f9' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-026' WHERE canonical_identity_id = 'e3508a62-0f90-4154-b0f1-51abd66182cf' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-027' WHERE canonical_identity_id = 'ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-028' WHERE canonical_identity_id = '72d00739-84a4-42c9-90aa-8b41e656c51d' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-029' WHERE canonical_identity_id = '46252d55-ac71-44ca-a99e-8eab88e6fc59' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-030' WHERE canonical_identity_id = '90ec48ac-746e-44c7-ac17-3e2f3edb54c3' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-031' WHERE canonical_identity_id = '10133fe6-90d3-446f-b363-ecd57b82b6bb' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-032' WHERE canonical_identity_id = '547b7657-4a50-41ba-a469-b868219da26f' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-033' WHERE canonical_identity_id = '69846327-12bf-418b-851e-9f2fa777fd60' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-034' WHERE canonical_identity_id = '213473b6-2320-4353-9c36-5b8c5afc7058' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-035' WHERE canonical_identity_id = '2b639791-aea9-4aca-881b-27eb807e1d68' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-036' WHERE canonical_identity_id = '8f0884e2-d4fc-432b-90f8-12ac718ceb6f' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-037' WHERE canonical_identity_id = 'e33ac363-a93d-4431-86a8-8100071dd17c' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-038' WHERE canonical_identity_id = '1bc54af0-afd9-464a-a039-2bea6a3613ee' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-039' WHERE canonical_identity_id = '0ec6754d-eaf3-46f3-97aa-93917be1cf84' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-040' WHERE canonical_identity_id = 'bd839620-8462-4ba2-a526-7a861bb26dc1' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-041' WHERE canonical_identity_id = '9548c97c-7c20-445f-b282-cee6b8debae5' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-042' WHERE canonical_identity_id = '862b6f55-6664-4070-8487-45cda5cd4f68' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-043' WHERE canonical_identity_id = 'c54ee2b6-6f1b-4763-bce0-5c1c6897cf17' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-044' WHERE canonical_identity_id = '9c6539c6-7ddf-4725-81a2-ac19a2bed92b' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-045' WHERE canonical_identity_id = 'aa388083-7e2f-4c55-a227-c02d2e5c20dc' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-046' WHERE canonical_identity_id = '977a960d-7333-4186-9e6d-0ab24989ffda' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-047' WHERE canonical_identity_id = '1291e3df-edff-4381-9fd9-14434ff0f19b' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-048' WHERE canonical_identity_id = '6c3b262b-7f9e-4f43-810a-a634c1585780' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-049' WHERE canonical_identity_id = '73f741a6-0c65-436e-b731-10854a7a8ba1' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-050' WHERE canonical_identity_id = 'd21fd211-c90e-4331-b796-6a0cce6ae310' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-051' WHERE canonical_identity_id = '032a2c48-2de7-4571-bbc7-e5455d79b5f1' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-052' WHERE canonical_identity_id = '0a158602-9e94-42dc-8da6-4ebf5c8aa988' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-053' WHERE canonical_identity_id = 'b8932495-c4c2-4bb6-b98b-c5907d44345f' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-054' WHERE canonical_identity_id = '8e0563fd-e05d-4c3c-9386-a10cd61bd3b1' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-055' WHERE canonical_identity_id = '3c1620e1-5110-447c-bdd6-96400d063cb7' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-056' WHERE canonical_identity_id = 'a32cfdbb-d26d-4457-9c8e-9432ff529ce2' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-057' WHERE canonical_identity_id = 'cd9da3d8-2c1e-404a-b6a7-b2f72d2461f5' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-058' WHERE canonical_identity_id = '8a049b14-cb94-4dc6-842c-ea1c6245cc98' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-059' WHERE canonical_identity_id = '076a5c84-945f-4af3-9b44-20f5e10a067f' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-060' WHERE canonical_identity_id = 'a21dfe6b-01fd-4b58-a4da-032928d0140b' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-061' WHERE canonical_identity_id = 'b15287c1-1bd0-4f88-81d6-e2291af754ba' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-062' WHERE canonical_identity_id = 'baa61d75-b121-435c-ac69-2d76224fc1ea' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-063' WHERE canonical_identity_id = '2131e2e5-7e0d-4024-a8fa-440df426429a' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-064' WHERE canonical_identity_id = '29457fc0-b7e7-46f7-9dd9-8a5e857ad62a' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-065' WHERE canonical_identity_id = 'fe1109a4-59a9-4d03-ace0-6fd4db44e033' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-066' WHERE canonical_identity_id = '781a239a-2383-4660-8daa-e220c47a6c43' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-067' WHERE canonical_identity_id = 'e06f2d03-683b-46c0-aa5b-32400b8d26bd' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-068' WHERE canonical_identity_id = 'cde0033c-eb8d-463d-9590-4529dd39f0f4' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-069' WHERE canonical_identity_id = '23b21c03-d6c5-4858-83b5-82e7d805ba66' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-070' WHERE canonical_identity_id = '4a761e1e-75e1-4f2b-b3a0-2e81a0102ddd' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-071' WHERE canonical_identity_id = '2b75694d-b8b2-44cc-842f-93e8b2975ec4' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-072' WHERE canonical_identity_id = '71ff0b59-10b6-4592-8756-2533500a4790' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-073' WHERE canonical_identity_id = '55fb2c7b-604b-441f-8f64-ca783410512d' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-074' WHERE canonical_identity_id = 'f04cf7ba-81e5-47c7-bcf2-2487763111e6' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-075' WHERE canonical_identity_id = '99ecc99e-2a99-4975-8ecb-07dba06fd6fc' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-076' WHERE canonical_identity_id = '90bba6a2-34fc-4234-b559-0aa8539fbd7e' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-077' WHERE canonical_identity_id = 'ca15b36b-0450-4446-9c42-6c8386372ba4' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-078' WHERE canonical_identity_id = 'e037310d-ce34-427a-9460-20954b45502f' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-079' WHERE canonical_identity_id = '7f7b0ad0-aaa1-4cbe-bc56-e6cf21c68293' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-080' WHERE canonical_identity_id = 'f1d1703e-3795-45e3-90b1-2eab9883f4a5' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-081' WHERE canonical_identity_id = 'ef3a8d7c-8916-4a9c-9211-a93dcbb9b412' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-082' WHERE canonical_identity_id = '7c4fe9c1-41fb-4e23-b2f8-c130afc929a0' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-456' WHERE canonical_identity_id = '8fb1aa38-c469-4dc5-9392-8588f7a71e39' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-NIKSAN' WHERE canonical_identity_id = '0fef4539-8fe1-424e-b215-74d917c14be3' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-01' WHERE canonical_identity_id = '09c3bcf8-3a85-47ef-a7b6-980e4a814225' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-02' WHERE canonical_identity_id = 'f8ec423a-6756-4ffd-9e7d-858d0cf6fc3e' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-03' WHERE canonical_identity_id = '91da1b9a-9f0a-45db-aa84-7b64f36ecbf8' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-04' WHERE canonical_identity_id = '856eeb5a-5c2e-40f7-81dc-2535dc0110eb' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-05' WHERE canonical_identity_id = '6bad355b-f70d-4051-b85b-dde2bfe557b4' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-06' WHERE canonical_identity_id = '397e410c-8932-4839-8128-0b71c88162df' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-07' WHERE canonical_identity_id = '37675f89-0e28-479d-9cfd-c82b374da057' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-08' WHERE canonical_identity_id = '1dd55330-243a-479e-a5fc-40e267d22fab' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-09' WHERE canonical_identity_id = 'a4fc4657-87ea-447c-aed1-0d204c56c8a1' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-10' WHERE canonical_identity_id = 'dd43e4e8-127e-4feb-99a8-075138be621b' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-11' WHERE canonical_identity_id = '8de38394-a91c-4f12-8048-a1e16bc51d94' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');
  UPDATE public.legacy_archive_kru SET ptv_id = 'PTV-PBS-12' WHERE canonical_identity_id = 'ddcdc02b-1615-4dbf-a7f7-dcc5d54b0588' AND (metadata_json->>'is_duplicate_archive' IS NULL OR metadata_json->>'is_duplicate_archive' <> 'true');

  RAISE NOTICE 'Langkah 4 Berhasil: Seluruh arsip legacy kru aktif diselaraskan dengan ID baru.';

  -- --------------------------------------------------------------------------
  -- 5. PEMBARUAN REFERENSI RELASIONAL (ptv_finance_settings & ptv_catatan)
  -- --------------------------------------------------------------------------
  -- 5.1 Bendahara Farsya Naufal Rahmandika dimigrasikan dari PTV-023 ke PTV-014
  UPDATE public.ptv_finance_settings
  SET treasurer_ptv_id = 'PTV-014',
      updated_at = v_now
  WHERE treasurer_ptv_id = 'PTV-023';

  -- 5.2 Catatan operasional yang mencatat ID lama
  -- PTV-001 (Muhammad Zidnal Falah) -> PTV-456
  UPDATE public.ptv_catatan
  SET created_by_id = 'PTV-456',
      updated_at = v_now
  WHERE created_by_id = 'PTV-001';

  -- PTV-032 (Rex Ruizhi Gajendra) -> PTV-028
  UPDATE public.ptv_catatan
  SET created_by_id = 'PTV-028',
      updated_at = v_now
  WHERE created_by_id = 'PTV-032';

  RAISE NOTICE 'Langkah 5 Berhasil: Referensi ptv_finance_settings dan ptv_catatan diperbarui.';

  -- --------------------------------------------------------------------------
  -- 6. VERIFIKASI PASCA-MIGRASI (POSTFLIGHT INTEGRITY CHECKS)
  -- --------------------------------------------------------------------------
  -- 6.1 Pastikan tidak ada ID sementara yang tertinggal
  SELECT count(*) INTO v_count_tmp 
  FROM public.canonical_identity 
  WHERE ptv_id LIKE 'TMP-%';
  
  IF v_count_tmp > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Masih ada % record dengan ID sementara!', v_count_tmp;
  END IF;

  -- 6.2 Pastikan total baris canonical_identity tetap persis 94
  SELECT count(*) INTO v_count_ci FROM public.canonical_identity;
  IF v_count_ci <> 94 THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Total baris canonical_identity berubah menjadi %!', v_count_ci;
  END IF;

  -- 6.3 Pastikan tidak ada duplikasi ID PTV di canonical_identity
  IF (
    SELECT count(DISTINCT ptv_id) FROM public.canonical_identity
  ) <> 94 THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Ditemukan duplikasi nilai ptv_id di canonical_identity!';
  END IF;

  -- 6.4 Verifikasi ID khusus
  -- PTV-456: Muhammad Zidnal Falah
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_identity 
    WHERE id = '8fb1aa38-c469-4dc5-9392-8588f7a71e39' AND ptv_id = 'PTV-456'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-456 tidak sesuai untuk Muhammad Zidnal Falah!';
  END IF;

  -- PTV-NIKSAN: Niki Santri
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_identity 
    WHERE id = '0fef4539-8fe1-424e-b215-74d917c14be3' AND ptv_id = 'PTV-NIKSAN'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-NIKSAN tidak sesuai untuk Niki Santri!';
  END IF;

  -- PTV-015: Muhammad Hamdan Yuwafi Sulaim
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_identity 
    WHERE id = 'b93d88de-346a-49a1-a291-cc48188fb917' AND ptv_id = 'PTV-015'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-015 tidak sesuai untuk Muhammad Hamdan Yuwafi Sulaim!';
  END IF;

  -- PTV-PBS-01 s.d. PTV-PBS-12
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '09c3bcf8-3a85-47ef-a7b6-980e4a814225' AND ptv_id = 'PTV-PBS-01') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-01 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = 'f8ec423a-6756-4ffd-9e7d-858d0cf6fc3e' AND ptv_id = 'PTV-PBS-02') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-02 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '91da1b9a-9f0a-45db-aa84-7b64f36ecbf8' AND ptv_id = 'PTV-PBS-03') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-03 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '856eeb5a-5c2e-40f7-81dc-2535dc0110eb' AND ptv_id = 'PTV-PBS-04') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-04 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '6bad355b-f70d-4051-b85b-dde2bfe557b4' AND ptv_id = 'PTV-PBS-05') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-05 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '397e410c-8932-4839-8128-0b71c88162df' AND ptv_id = 'PTV-PBS-06') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-06 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '37675f89-0e28-479d-9cfd-c82b374da057' AND ptv_id = 'PTV-PBS-07') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-07 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '1dd55330-243a-479e-a5fc-40e267d22fab' AND ptv_id = 'PTV-PBS-08') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-08 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = 'a4fc4657-87ea-447c-aed1-0d204c56c8a1' AND ptv_id = 'PTV-PBS-09') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-09 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = 'dd43e4e8-127e-4feb-99a8-075138be621b' AND ptv_id = 'PTV-PBS-10') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-10 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '8de38394-a91c-4f12-8048-a1e16bc51d94' AND ptv_id = 'PTV-PBS-11') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-11 tidak sesuai!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = 'ddcdc02b-1615-4dbf-a7f7-dcc5d54b0588' AND ptv_id = 'PTV-PBS-12') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: PTV-PBS-12 tidak sesuai!';
  END IF;

  -- 6.5 Verifikasi akun staging/test tidak berubah
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = 'd00893ac-3d6b-4da8-b12f-2353cea729aa' AND ptv_id = 'PTV-STG-ADM') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Akun PTV-STG-ADM berubah!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = 'b93d89c8-457f-4bad-a99b-edbb06af0482' AND ptv_id = 'PTV-STG-KRU') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Akun PTV-STG-KRU berubah!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canonical_identity WHERE id = '57bb9724-6a71-46ba-ac3b-35a922261b56' AND ptv_id = 'PTV-TEST-171') THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Akun PTV-TEST-171 berubah!';
  END IF;

  -- 6.6 Verifikasi referensi bendahara
  IF NOT EXISTS (
    SELECT 1 FROM public.ptv_finance_settings 
    WHERE id = 'studio_default' AND treasurer_ptv_id = 'PTV-014'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Referensi bendahara di ptv_finance_settings bukan PTV-014!';
  END IF;

  -- 6.7 Verifikasi catatan
  IF EXISTS (SELECT 1 FROM public.ptv_catatan WHERE created_by_id IN ('PTV-001', 'PTV-032')) THEN
    RAISE EXCEPTION 'POSTFLIGHT GAGAL: Masih ada catatan dengan created_by_id lama PTV-001/PTV-032!';
  END IF;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'SUKSES: MIGRASI MASSAL ID PTV FINAL SELESAI 100%%';
  RAISE NOTICE 'Identitas Dimigrasikan: 91 personel';
  RAISE NOTICE 'Akun Staging Dipertahankan: 3 akun';
  RAISE NOTICE 'Total Canonical Identities: 94 personel (0 duplikasi)';
  RAISE NOTICE 'Referensi Diperbarui: canonical_identity, legacy_archive_kru,';
  RAISE NOTICE '                     ptv_finance_settings, ptv_catatan';
  RAISE NOTICE '====================================================================';
END $$;
