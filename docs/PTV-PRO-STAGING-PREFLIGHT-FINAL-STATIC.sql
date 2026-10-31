-- ============================================================================
-- PTV PRO — SUPABASE STAGING PREFLIGHT FINAL STATIC SUITE
-- ============================================================================
-- Subsystem: PTV PRO Staging Database & Supabase Security Architecture
-- Target Environment: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status: STATIC REVIEW ONLY — READY FOR HUMAN DBA MANUAL PREFLIGHT
-- Execution Mode: STRICTLY READ-ONLY (ZERO MUTATION, ZERO APPLICATION EXECUTION)
--
-- ATURAN KESELAMATAN MUTLAK (STRICT SAFETY RULES):
-- 1. READ-ONLY: Seluruh kueri hanya menjalankan SELECT against pg_catalog,
--    information_schema, dan pembacaan agregat skalar terbatas.
-- 2. ZERO MUTATION: Tidak mengandung DDL, DML, ALTER, DROP, TRUNCATE, GRANT,
--    REVOKE, maupun pemanggilan fungsi mutasi/RPC.
-- 3. ZERO PRIVACY LEAKAGE: Tidak mengeluarkan daftar identitas pribadi (identity_id),
--    token, credential, hash, payload surat, atau data anggota institusi.
-- 4. PEMISAHAN KETAT (TWO-PART SUITE):
--    - BAGIAN 1: Pemeriksaan Katalog Metadata Murni (Zero Data Read).
--    - BAGIAN 2: Pemeriksaan Agregat Baris Data Terbatas (Membaca data tabel
--      secara agregat; WAJIB memenuhi prasyarat keberadaan tabel dari Bagian 1).
-- 5. LARANGAN EKSEKUSI OTOMATIS: Kueri ini ditujukan untuk ditinjau oleh manusia
--    dan dijalankan secara manual oleh DBA berwenang melalui Supabase SQL Editor.
-- ============================================================================


-- ============================================================================
-- BAGIAN 1: PEMERIKSAAN KATALOG METADATA MURNI
-- (CATALOG & SCHEMA METADATA INSPECTION — ZERO TABLE DATA ACCESS)
-- ============================================================================
-- Karakteristik:
-- - Menargetkan hanya view katalog sistem (pg_catalog, information_schema).
-- - Tidak pernah membaca satu baris pun data tabel aplikasi.
-- - Aman dieksekusi terlepas dari apakah skema aplikasi kosong, terisi, atau rusak.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SEKSI 1: VERIFIKASI EKSTENSI SISTEM
-- Tujuan: Memastikan ekstensi inti PostgreSQL yang dibutuhkan skema telah terpasang.
-- Prasyarat: Akses pg_extension & pg_namespace (tersedia pada semua instance).
-- Batasan: Hanya memeriksa keberadaan dan versi terpasang.
-- ----------------------------------------------------------------------------
SELECT 
    extname AS extension_name,
    extversion AS installed_version,
    nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pgjwt')
ORDER BY extname;

-- ----------------------------------------------------------------------------
-- SEKSI 2: VERIFIKASI KEBERADAAN 36 TABEL KANONIKAL & DUKUNGAN PARTITIONED TABLE
-- Tujuan: Memverifikasi keberadaan seluruh 36 tabel kanonikal skema public,
--         tipe relasi (tabel standar 'r' vs tabel berpartisi 'p'),
--         status Row Level Security (RLS), dan status FORCE RLS.
-- Prasyarat: Tidak ada. Menggunakan CTE expected_tables dan LEFT JOIN ke pg_class.
-- Catatan Arsitektur:
-- Menggunakan pg_class c JOIN pg_namespace n secara langsung (bukan pg_tables saja)
-- agar tabel berpartisi (relkind = 'p') tidak salah dilaporkan sebagai MISSING.
-- ----------------------------------------------------------------------------
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'canonical_identity',
        'identity_contact',
        'user_account',
        'auth_credentials',
        'organization',
        'organization_division',
        'organization_membership',
        'access_profile',
        'capability_registry',
        'profile_capabilities',
        'account_profiles',
        'account_capability_overrides',
        'auth_audit_log',
        'ptv_login_history',
        'ptv_acara',
        'ptv_acara_rundown',
        'ptv_content_planner',
        'ptv_inventaris',
        'ptv_inventaris_unit',
        'ptv_nilai_inventaris',
        'ptv_peminjaman',
        'ptv_lapor_masalah',
        'ptv_lost_found',
        'ptv_surat_tugas',
        'ptv_surat_izin',
        'ptv_surat_barang',
        'ptv_keuangan',
        'ptv_pemasukan',
        'ptv_pengeluaran',
        'ptv_kas_kru',
        'ptv_kas_periode',
        'ptv_catatan',
        'ptv_kontak_eksternal',
        'ptv_notifications',
        'ptv_push_subscriptions',
        'ptv_pengumuman'
    ]) AS table_name
)
SELECT 
    et.table_name,
    CASE 
        WHEN c.relname IS NOT NULL THEN 'EXISTS' 
        ELSE 'MISSING' 
    END AS status,
    'public' AS schema_name,
    CASE 
        WHEN c.relkind = 'r' THEN 'ORDINARY TABLE'
        WHEN c.relkind = 'p' THEN 'PARTITIONED TABLE'
        WHEN c.relkind IS NOT NULL THEN 'RELKIND: ' || c.relkind::text
        ELSE 'NONE'
    END AS relation_type,
    COALESCE(c.relrowsecurity, FALSE) AS rls_enabled,
    COALESCE(c.relforcerowsecurity, FALSE) AS force_rls_enabled
FROM expected_tables et
LEFT JOIN pg_class c 
    ON c.relname = et.table_name 
   AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND c.relkind IN ('r', 'p')
ORDER BY et.table_name;

-- ----------------------------------------------------------------------------
-- SEKSI 3: VERIFIKASI VIEW KOMPATIBILITAS (ptv_kru_legacy_compat)
-- Tujuan: Memeriksa keberadaan view kompatibilitas ptv_kru_legacy_compat di skema public.
-- Prasyarat: Akses information_schema.views.
-- Batasan: Hanya membaca metadata view.
-- ----------------------------------------------------------------------------
SELECT 
    table_name AS view_name,
    table_schema,
    is_updatable,
    is_insertable_into
FROM information_schema.views
WHERE table_schema = 'public' 
  AND table_name = 'ptv_kru_legacy_compat';

-- ----------------------------------------------------------------------------
-- SEKSI 4A: AUDIT 7 FUNGSI KANONIKAL & RPC (Public & Auth Schemas)
-- Target Fungsi:
--   1. jwt_custom_claims
--   2. has_capability
--   3. rpc_checkout_loan
--   4. rpc_return_loan
--   5. rpc_return_single_unit
--   6. rpc_get_next_inv_code
--   7. rpc_submit_official_doc
--
-- Tujuan Pemeriksaan:
-- - Memetakan seluruh overload signature yang eksis di katalog tanpa hasil hilang.
-- - Memeriksa skema penempatan (mendeteksi fungsi peninggalan di skema auth).
-- - Memeriksa atribut keamanan: SECURITY DEFINER vs SECURITY INVOKER.
-- - Memeriksa volatilitas: IMMUTABLE ('i'), STABLE ('s'), VOLATILE ('v').
-- - Memeriksa konfigurasi lokal GUC (p.proconfig, misal: search_path lokal).
-- - Memeriksa pemilik fungsi (owner_role).
--
-- CATATAN MENGENAI p.proconfig (Konfigurasi Lokal Fungsi):
-- Nilai p.proconfig HANYA merepresentasikan parameter konfigurasi lokal yang
-- disetel secara eksplisit pada badan fungsi (misal: SET search_path = ...).
-- Nilai ini BUKAN konfigurasi efektif sesi koneksi runtime secara keseluruhan.
-- Jika proconfig NULL, fungsi mengeksekusi dengan mewarisi search_path sesi pemanggil.
-- ----------------------------------------------------------------------------
WITH target_functions AS (
    SELECT unnest(ARRAY[
        'jwt_custom_claims',
        'has_capability',
        'rpc_checkout_loan',
        'rpc_return_loan',
        'rpc_return_single_unit',
        'rpc_get_next_inv_code',
        'rpc_submit_official_doc'
    ]) AS func_name
),
catalog_functions AS (
    SELECT 
        p.oid,
        p.proname,
        n.nspname AS schema_name,
        pg_get_function_identity_arguments(p.oid) AS identity_arguments,
        pg_get_function_arguments(p.oid) AS arguments,
        p.prosecdef AS is_security_definer,
        CASE p.provolatile
            WHEN 'i' THEN 'IMMUTABLE'
            WHEN 's' THEN 'STABLE'
            WHEN 'v' THEN 'VOLATILE'
            ELSE 'UNKNOWN'
        END AS volatility,
        array_to_string(p.proconfig, ', ') AS function_local_config,
        r.rolname AS owner_role
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname IN ('public', 'auth')
)
SELECT 
    tf.func_name,
    cf.schema_name,
    cf.proname AS function_name,
    CASE 
        WHEN cf.oid IS NOT NULL THEN 'EXISTS' 
        ELSE 'MISSING' 
    END AS status,
    cf.identity_arguments,
    cf.arguments,
    CASE 
        WHEN cf.is_security_definer IS TRUE THEN 'SECURITY DEFINER' 
        WHEN cf.is_security_definer IS FALSE THEN 'SECURITY INVOKER' 
        ELSE NULL 
    END AS security_type,
    cf.volatility,
    cf.function_local_config,
    cf.owner_role
FROM target_functions tf
LEFT JOIN catalog_functions cf 
    ON cf.proname = tf.func_name
ORDER BY tf.func_name, cf.schema_name, cf.identity_arguments;

-- ----------------------------------------------------------------------------
-- SEKSI 4B: AUDIT HAK AKSES EKSEKUSI RUTIN (ROUTINE EXECUTE PRIVILEGES)
-- Tujuan: Memverifikasi grant eksplisit hak EXECUTE pada 7 fungsi target
--         untuk role: anon, authenticated, service_role, dan pseudo-role PUBLIC.
--
-- CATATAN KETERBATASAN VISIBILITAS information_schema.routine_privileges:
-- View information_schema menyaring baris berdasarkan peran pemanggil aktif (CURRENT_USER).
-- Jalankan kueri ini menggunakan role administratif ('postgres' / DBA) agar seluruh
-- grant terlihat secara lengkap.
-- Kueri ini mencakup pemeriksaan pseudo-role 'PUBLIC'.
-- ----------------------------------------------------------------------------
SELECT 
    routine_schema,
    routine_name,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema IN ('public', 'auth')
  AND routine_name IN (
      'jwt_custom_claims',
      'has_capability',
      'rpc_checkout_loan',
      'rpc_return_loan',
      'rpc_return_single_unit',
      'rpc_get_next_inv_code',
      'rpc_submit_official_doc'
  )
  AND (grantee IN ('anon', 'authenticated', 'service_role') OR UPPER(grantee) = 'PUBLIC')
ORDER BY routine_name, routine_schema, grantee, privilege_type;

-- ----------------------------------------------------------------------------
-- SEKSI 5A: AUDIT HAK AKSES SKEMA PUBLIC (USAGE & CREATE PRIVILEGES)
-- Ref: PREFLIGHT 5 Proposal — Mitigasi Schema Hijacking
--
-- PERBAIKAN ARSITEKTURAL TERHADAP PSEUDO-ROLE PUBLIC:
-- Di PostgreSQL, 'PUBLIC' adalah keyword pseudo-role/implicit group, BUKAN baris
-- di tabel katalog pg_roles (pg_authid). Kueri lama yang mencari 'FROM pg_roles
-- WHERE rolname IN (..., 'public')' melewatkan pemeriksaan PUBLIC karena 0 baris cocok.
-- Kueri berikut menggunakan CTE target_roles dan LEFT JOIN ke pg_roles untuk:
-- 1. Memeriksa hak USAGE dan CREATE secara aman pada role 'anon', 'authenticated',
--    'service_role', dan pseudo-role 'public'.
-- 2. Mengamankan pemanggilan has_schema_privilege agar tidak crash jika role
--    tertentu belum terdaftar di pg_roles.
-- ----------------------------------------------------------------------------
WITH target_roles(target_role) AS (
    VALUES ('anon'), ('authenticated'), ('service_role'), ('public')
)
SELECT 
    tr.target_role,
    CASE 
        WHEN tr.target_role = 'public' THEN 'PSEUDO-ROLE (IMPLICIT GROUP)'
        WHEN r.rolname IS NOT NULL THEN 'ROLE DEFINED'
        ELSE 'ROLE NOT FOUND'
    END AS role_status,
    CASE 
        WHEN tr.target_role = 'public' OR r.rolname IS NOT NULL THEN 
            has_schema_privilege(tr.target_role, 'public', 'USAGE')
        ELSE NULL 
    END AS has_usage_on_public,
    CASE 
        WHEN tr.target_role = 'public' OR r.rolname IS NOT NULL THEN 
            has_schema_privilege(tr.target_role, 'public', 'CREATE')
        ELSE NULL 
    END AS has_create_on_public
FROM target_roles tr
LEFT JOIN pg_roles r ON r.rolname = tr.target_role
ORDER BY tr.target_role;

-- ----------------------------------------------------------------------------
-- SEKSI 5B: REKAP STATUS RLS & JUMLAH POLICY PADA 15 TABEL OPERASIONAL
-- Ref: PREFLIGHT 7 Proposal
-- Target: 15 tabel inti (keuangan, identitas/auth, persuratan, inventaris/peminjaman).
--
-- DUKUNGAN PARTITIONED TABLE & CATATAN SEMANTIK DEFAULT DENY:
-- 1. Menggunakan pg_class c dengan c.relkind IN ('r', 'p') agar tabel berpartisi
--    terdeteksi dengan benar.
-- 2. Menampilkan relrowsecurity (RLS) dan relforcerowsecurity (FORCE RLS).
-- 3. Semantik Keamanan: Tabel dengan rls_enabled = TRUE dan policy_count = 0
--    TIDAK deny-all universal. Kondisi ini adalah DEFAULT DENY khusus bagi peran biasa
--    (non-owner tanpa BYPASSRLS). Pemilik tabel, superuser, dan role BYPASSRLS
--    tetap dapat mengakses KECUALI jika FORCE RLS aktif pada tabel tersebut.
-- ----------------------------------------------------------------------------
WITH audited_tables AS (
    SELECT unnest(ARRAY[
        'ptv_keuangan', 'ptv_pemasukan', 'ptv_pengeluaran', 'ptv_kas_kru',
        'ptv_nilai_inventaris', 'identity_contact', 'auth_credentials',
        'ptv_push_subscriptions', 'auth_audit_log', 'canonical_identity',
        'ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang',
        'ptv_peminjaman', 'ptv_inventaris_unit'
    ]) AS table_name
)
SELECT 
    at.table_name,
    'public' AS schema_name,
    CASE 
        WHEN c.relname IS NULL THEN 'MISSING TABLE'
        WHEN c.relrowsecurity IS TRUE THEN 'RLS ENABLED'
        ELSE 'RLS DISABLED'
    END AS rls_status,
    COALESCE(c.relforcerowsecurity, FALSE) AS force_rls_enabled,
    COUNT(p.policyname) AS policy_count,
    CASE 
        WHEN c.relname IS NULL THEN 'TABLE NOT FOUND'
        WHEN c.relrowsecurity IS TRUE AND COUNT(p.policyname) = 0 THEN 
            'DEFAULT DENY FOR UNPRIVILEGED (0 POLICIES; OWNER/BYPASSRLS EXEMPT UNLESS FORCED)'
        WHEN c.relrowsecurity IS TRUE THEN 'ACTIVE POLICIES'
        ELSE 'NO RLS'
    END AS policy_state
FROM audited_tables at
LEFT JOIN pg_class c
    ON c.relname = at.table_name
   AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND c.relkind IN ('r', 'p')
LEFT JOIN pg_policies p 
    ON p.tablename = at.table_name 
   AND p.schemaname = 'public'
GROUP BY at.table_name, c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY at.table_name;

-- ----------------------------------------------------------------------------
-- SEKSI 5C: AUDIT DEFINISI DETAIL KEBIJAKAN RLS (pg_policies)
-- Ref: PREFLIGHT 8 Proposal
-- Tujuan: Memeriksa isi klausul USING (qual), WITH CHECK, role yang dituju,
--         dan tipe perintah (SELECT, INSERT, UPDATE, DELETE, ALL) pada 15 tabel.
-- ----------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command_type,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'ptv_keuangan', 'ptv_pemasukan', 'ptv_pengeluaran', 'ptv_kas_kru',
      'ptv_nilai_inventaris', 'identity_contact', 'auth_credentials',
      'ptv_push_subscriptions', 'auth_audit_log', 'canonical_identity',
      'ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang',
      'ptv_peminjaman', 'ptv_inventaris_unit'
  )
ORDER BY tablename, policyname;

-- ----------------------------------------------------------------------------
-- SEKSI 5D: AUDIT HAK AKSES TABEL (TABLE ACCESS PRIVILEGES)
-- Ref: PREFLIGHT 10 Proposal
-- Target: Tabel persuratan, peminjaman, dan inventaris unit.
--
-- CATATAN KETERBATASAN VISIBILITAS information_schema.table_privileges:
-- Seperti routine_privileges, view ini menyaring baris berdasarkan hak CURRENT_USER.
-- Jalankan kueri ini menggunakan role administratif ('postgres' / DBA) untuk
-- melihat seluruh grant efektif, termasuk penugasan kepada pseudo-role 'PUBLIC'.
-- ----------------------------------------------------------------------------
SELECT 
    table_schema,
    table_name,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
      'ptv_surat_tugas', 
      'ptv_surat_izin', 
      'ptv_surat_barang', 
      'ptv_peminjaman', 
      'ptv_inventaris_unit'
  )
  AND (grantee IN ('anon', 'authenticated', 'service_role') OR UPPER(grantee) = 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- ----------------------------------------------------------------------------
-- SEKSI 5E: AUDIT STATUS KEBERADAAN KOLOM KHUSUS
-- Ref: PREFLIGHT 3 & PREFLIGHT 9 Proposal
-- Memeriksa apakah kolom baru/kritis sudah terbuat atau belum:
--   - ptv_peminjaman: 'nama_acara', 'keperluan', 'actor_id'
--   - ptv_surat_*: 'diajukan_oleh', 'disetujui_oleh'
-- ----------------------------------------------------------------------------
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      (table_name = 'ptv_peminjaman' AND column_name IN ('nama_acara', 'keperluan', 'actor_id'))
      OR (table_name IN ('ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang') AND column_name IN ('diajukan_oleh', 'disetujui_oleh'))
  )
ORDER BY table_name, column_name;

-- ----------------------------------------------------------------------------
-- SEKSI 6: REKAPITULASI HITUNGAN OBJEK SKEMA PUBLIC
-- Tujuan: Memberikan ringkasan kuantitatif cepat objek institusional.
-- Fitur:
--   1. Partition-aware table count via pg_class (relkind IN ('r', 'p')).
--   2. Precedence AND/OR presisi membatasi hitungan ke schema public.
--   3. Literal underscore escaping ('ptv\_%').
--   4. target_ptv_functions_in_auth_schema_count memeriksa spesifik 2 fungsi
--      institusional ('has_capability', 'jwt_custom_claims') di dalam skema 'auth'.
-- ----------------------------------------------------------------------------
SELECT 
    (
        SELECT count(*) 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND (
              c.relname LIKE 'ptv\_%' ESCAPE '\'
              OR c.relname IN (
                  'canonical_identity', 'identity_contact', 'user_account', 
                  'auth_credentials', 'organization', 'organization_division', 
                  'organization_membership', 'access_profile', 'capability_registry', 
                  'profile_capabilities', 'account_profiles', 
                  'account_capability_overrides', 'auth_audit_log'
              )
          )
    ) AS public_tables_count,
    (
        SELECT count(*) 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
          AND table_name = 'ptv_kru_legacy_compat'
    ) AS views_count,
    (
        SELECT count(*) 
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public' 
          AND p.proname IN (
              'has_capability', 'jwt_custom_claims', 'rpc_checkout_loan', 
              'rpc_return_loan', 'rpc_return_single_unit', 'rpc_get_next_inv_code', 
              'rpc_submit_official_doc'
          )
    ) AS public_functions_count,
    (
        SELECT count(*) 
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'auth' 
          AND p.proname IN ('has_capability', 'jwt_custom_claims')
    ) AS target_ptv_functions_in_auth_schema_count,
    (
        SELECT count(*) 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) AS total_rls_policies_count;



-- ============================================================================
-- BAGIAN 2: PEMERIKSAAN AGREGAT BARIS DATA TERBATAS
-- (DATA ROW AGGREGATE INSPECTION — ACCESSES TABLE ROWS, ZERO PII, SCALAR ONLY)
-- ============================================================================
-- PERINGATAN DAN PRASYARAT MUTLAK:
-- 1. Kueri di bawah ini MEMBACA BARIS DATA FISIK TABEL (Table Row Data Access),
--    BUKAN sekadar membaca katalog metadata seperti Bagian 1.
-- 2. PRASYARAT WAJIB: Kueri di Bagian 2 HANYA BOLEH DIJALANKAN JIKA tabel terkait
--    (ptv_surat_tugas, ptv_surat_izin, ptv_surat_barang, organization_membership)
--    dilaporkan berstatus 'EXISTS' pada hasil eksekusi Bagian 1 (Seksi 2).
-- 3. Jika tabel belum ada, kueri di Bagian 2 AKAN GAGAL dengan error
--    'relation "public.ptv_surat_..." does not exist'.
-- 4. KEBIJAKAN PRIVASI KETAT (ZERO PII / ZERO CONTENT):
--    - Kueri penomoran surat HANYA menghasilkan agregat jumlah dan nilai nomor tertinggi.
--      Dilarang memilih kolom isi surat, nama pemohon, atau keterangan.
--    - Kueri membership HANYA menghasilkan agregat skalar jumlah akun anomali.
--      Dilarang memilih identity_id, nama anggota, nomor kontak, atau UUID santri/kru.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SEKSI 7: AUDIT AGREGAT POLA & FORMAT PENOMORAN SURAT HISTORIS
-- Ref: PREFLIGHT 4 Proposal
-- Prasyarat: Tabel ptv_surat_tugas, ptv_surat_izin, ptv_surat_barang berstatus 'EXISTS'.
--
-- Tujuan Pemeriksaan:
-- - Mengetahui total volume surat yang telah diterbitkan pada database staging.
-- - Mengetahui nomor surat tertinggi (lexicographical/sequential).
-- - Menghitung jumlah surat yang memiliki nomor terisi vs NULL.
-- - Menghitung anomali format (nomor yang tidak mengandung prefix '-PTV/').
-- - ZERO ISI SURAT: Tidak menampilkan teks keperluan, payload, atau nama pengaju.
-- ----------------------------------------------------------------------------
SELECT 
    'ptv_surat_tugas' AS nama_tabel,
    count(*) AS total_surat,
    count(nomor_surat) AS jumlah_nomor_terisi,
    count(*) - count(nomor_surat) AS jumlah_nomor_null,
    MAX(nomor_surat) AS nomor_surat_tertinggi,
    count(CASE WHEN nomor_surat NOT LIKE '%-PTV/%' THEN 1 END) AS count_format_non_standar
FROM public.ptv_surat_tugas
UNION ALL
SELECT 
    'ptv_surat_izin',
    count(*),
    count(nomor_surat),
    count(*) - count(nomor_surat),
    MAX(nomor_surat),
    count(CASE WHEN nomor_surat NOT LIKE '%-PTV/%' THEN 1 END)
FROM public.ptv_surat_izin
UNION ALL
SELECT 
    'ptv_surat_barang',
    count(*),
    count(nomor_surat),
    count(*) - count(nomor_surat),
    MAX(nomor_surat),
    count(CASE WHEN nomor_surat NOT LIKE '%-PTV/%' THEN 1 END)
FROM public.ptv_surat_barang;

-- ----------------------------------------------------------------------------
-- SEKSI 8: AUDIT AGREGAT ANOMALI MULTI-MEMBERSHIP AKTIF (ORGANISASI ptv_studio)
-- Ref: PREFLIGHT 6 Proposal
-- Prasyarat: Tabel organization_membership berstatus 'EXISTS'.
--
-- PERBAIKAN ARSITEKTURAL KEAMANAN & PRIVASI (ZERO PII / ZERO UUID LEAKAGE):
-- Kueri lama pada proposal awal menghasilkan baris dengan kolom 'identity_id',
-- yang mengekspos identifier spesifik anggota kru/santri ke log inspeksi.
-- Kueri di bawah ini diperbaiki menjadi SKALAR AGREGAT MURNI:
-- 1. Menghitung jumlah identitas yang memiliki lebih dari satu membership aktif
--    pada organisasi 'ptv_studio' (is_current = TRUE).
-- 2. Menghitung duplikasi maksimum per identitas.
-- 3. Jika total_identities_with_multiple_current_memberships = 0, data bersih.
-- 4. Tidak ada UUID, nama anggota, hash, atau PII yang diekspos ke hasil preflight.
-- ----------------------------------------------------------------------------
SELECT 
    count(*) AS total_identities_with_multiple_current_memberships,
    COALESCE(MAX(membership_count), 0) AS max_duplicate_count_per_identity
FROM (
    SELECT 
        identity_id, 
        count(*) AS membership_count
    FROM public.organization_membership
    WHERE organization_id = 'ptv_studio'
      AND is_current = TRUE
    GROUP BY identity_id
    HAVING count(*) > 1
) anomaly_subquery;

-- ============================================================================
-- AKHIR DOKUMEN PREFLIGHT STATIC SQL
-- DOKUMEN INI TIDAK BOLEH DIEKSEKUSI OLEH SISTEM OTOMATIS.
-- SERAHKAN KEPADA DBA MANUSIA UNTUK EVALUASI MANUAL DI SUPABASE SQL EDITOR.
-- ============================================================================
