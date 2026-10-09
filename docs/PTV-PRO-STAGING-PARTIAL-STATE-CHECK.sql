-- ============================================================================
-- PTV PRO — READ-ONLY STAGING PARTIAL STATE CHECK
-- ============================================================================
-- Purpose:
-- Safely inspect PostgreSQL catalog and schema metadata in Supabase Staging
-- to determine whether any objects from previous DDL attempts were committed.
--
-- STRICT SAFETY RULES:
-- 1. READ-ONLY: Executes only SELECT queries against pg_catalog & information_schema.
-- 2. ZERO DATA ACCESS: Never selects personal data, credentials, hashes, or table rows.
-- 3. ZERO MODIFICATION: Zero DDL, zero DML, zero ALTER, zero DROP, zero GRANT.
-- 4. Target Project: Staging only (swadgljnyelsjstqqxbm).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: EXTENSIONS CHECK
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
-- SECTION 2: CANONICAL TABLES EXISTENCE & RLS STATUS (36 Tables)
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
    CASE WHEN t.tablename IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status,
    COALESCE(t.schemaname, 'public') AS schema_name,
    t.rowsecurity AS rls_enabled
FROM expected_tables et
LEFT JOIN pg_tables t 
    ON t.tablename = et.table_name 
   AND t.schemaname = 'public'
ORDER BY et.table_name;

-- ----------------------------------------------------------------------------
-- SECTION 3: COMPATIBILITY VIEW CHECK (ptv_kru_legacy_compat)
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
-- SECTION 4: FUNCTIONS & RPC AUDIT (Across public & auth schemas)
-- Pre-filters catalog joins to public and auth schemas, displaying all overloads
-- along with security definition, arguments, and function-local GUC settings.
-- (Ref: PREFLIGHT 1 in PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md)
--
-- CATATAN MENGENAI p.proconfig (Konfigurasi Lokal Fungsi):
-- Nilai p.proconfig (misal: 'search_path=pg_catalog, public, auth') HANYA merepresentasikan
-- parameter GUC lokal yang disetel secara eksplisit pada definisi fungsi (SET search_path = ...).
-- Nilai ini BUKAN konfigurasi efektif sesi runtime koneksi pemanggil secara keseluruhan.
-- Konfigurasi lokal ini hanya aktif selama badan fungsi dieksekusi; sesi pemanggil
-- akan mengembalikan search_path sebelumnya setelah eksekusi selesai.
-- Jika proconfig bernilai NULL, fungsi mengeksekusi dengan mewarisi search_path sesi pemanggil.
-- Pemeriksaan ini bertujuan memverifikasi apakah fungsi memiliki konfigurasi lokal di katalog.
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
    cf.function_local_config,
    cf.owner_role
FROM target_functions tf
LEFT JOIN catalog_functions cf 
    ON cf.proname = tf.func_name
ORDER BY tf.func_name, cf.schema_name, cf.identity_arguments;

-- ----------------------------------------------------------------------------
-- SECTION 4B: ROUTINE EXECUTE PRIVILEGES & GRANTS (Target Functions)
-- Verifies actual EXECUTE privileges granted to anon, authenticated, public, service_role.
-- (Ref: PREFLIGHT 2 in PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md)
--
-- CATATAN KETERBATASAN VISIBILITAS information_schema.routine_privileges:
-- View information_schema hanya menampilkan hak akses pada rutin di mana role saat ini
-- bertindak sebagai grantor, grantee, atau pemilik objek.
-- Untuk melihat seluruh hak akses secara lengkap tanpa penyaringan hak pengguna aktif,
-- kueri ini disarankan dijalankan oleh role administratif ('postgres' / DBA).
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
-- SECTION 5A: RLS STATUS & POLICY COUNT SUMMARY PER TABLE
-- Shows rowsecurity status, force_rls status, and policy count per table.
--
-- CATATAN SEMANTIK KEAMANAN RLS POSTGRESQL:
-- Tabel dengan rowsecurity = TRUE dan policy_count = 0 TIDAK beroperasi sebagai
-- deny-all universal. Kondisi ini adalah DEFAULT DENY khusus bagi peran biasa (non-owner)
-- yang tidak memiliki atribut BYPASSRLS (misalnya role 'anon' dan 'authenticated').
-- Pengecualian penting:
-- 1. Superuser selalu mem-bypass RLS.
-- 2. Pemilik tabel (table owner) secara default mem-bypass RLS KECUALI jika
--    FORCE ROW LEVEL SECURITY (c.relforcerowsecurity) diaktifkan pada tabel tersebut.
-- 3. Role dengan atribut BYPASSRLS selalu mem-bypass seluruh pemeriksaan RLS.
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
    COALESCE(t.schemaname, 'public') AS schema_name,
    CASE 
        WHEN t.tablename IS NULL THEN 'MISSING TABLE'
        WHEN t.rowsecurity IS TRUE THEN 'RLS ENABLED'
        ELSE 'RLS DISABLED'
    END AS rls_status,
    COALESCE(c.relforcerowsecurity, FALSE) AS force_rls_enabled,
    COUNT(p.policyname) AS policy_count,
    CASE 
        WHEN t.tablename IS NULL THEN 'TABLE NOT FOUND'
        WHEN t.rowsecurity IS TRUE AND COUNT(p.policyname) = 0 THEN 
            'DEFAULT DENY FOR UNPRIVILEGED (0 POLICIES; OWNER/BYPASSRLS/SUPERUSER EXEMPT UNLESS FORCED)'
        WHEN t.rowsecurity IS TRUE THEN 'ACTIVE POLICIES'
        ELSE 'NO RLS'
    END AS policy_state
FROM audited_tables at
LEFT JOIN pg_tables t 
    ON t.tablename = at.table_name 
   AND t.schemaname = 'public'
LEFT JOIN pg_class c
    ON c.relname = at.table_name
   AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND c.relkind = 'r'
LEFT JOIN pg_policies p 
    ON p.tablename = at.table_name 
   AND p.schemaname = 'public'
GROUP BY at.table_name, t.schemaname, t.tablename, t.rowsecurity, c.relforcerowsecurity
ORDER BY at.table_name;

-- ----------------------------------------------------------------------------
-- SECTION 5B: DETAILED ROW LEVEL SECURITY POLICIES DEFINITIONS
-- Inspects existing policies, permitted commands (SELECT, INSERT, etc.), and roles.
-- (Ref: PREFLIGHT 8 in PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md)
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
-- SECTION 5C: TABLE ACCESS PRIVILEGES & GRANTS (Surat, Peminjaman, Unit)
-- Verifies table-level grants (SELECT, INSERT, UPDATE, DELETE) for unprivileged roles.
-- (Ref: PREFLIGHT 10 in PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md)
--
-- CATATAN KETERBATASAN VISIBILITAS information_schema.table_privileges:
-- Menurut standar SQL dan implementasi PostgreSQL, view information_schema hanya
-- menampilkan privilege pada objek di mana pengguna saat ini (CURRENT_USER) bertindak
-- sebagai grantor, grantee, atau pemilik tabel/superuser.
-- Jika kueri ini dijalankan oleh role unprivileged (misal: 'anon'), PostgreSQL
-- akan menyembunyikan baris privilege milik role lain.
-- Disarankan menjalankan kueri ini menggunakan role administratif ('postgres' / DBA)
-- untuk mengamati hak akses seluruh peran, termasuk penugasan kepada pseudo-role 'PUBLIC'.
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
-- SECTION 5D: AUDIT STATUS KOLOM KHUSUS (nama_acara, diajukan_oleh, disetujui_oleh)
-- Verifies column existence before planning or executing any DDL.
-- (Ref: PREFLIGHT 3 & 9 in PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md)
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
-- SECTION 6: PTV PRO OBJECT COUNT SUMMARY
-- Precedence: AND (LIKE 'ptv\_%' ESCAPE '\' OR tablename IN (...)) membatasi
-- hitungan tabel ke schemaname = 'public' dengan literal underscore escaping.
-- target_ptv_functions_in_auth_schema_count memeriksa secara spesifik keberadaan
-- 2 fungsi institusional ('has_capability', 'jwt_custom_claims') di dalam skema 'auth'.
-- ----------------------------------------------------------------------------
SELECT 
    (
        SELECT count(*) 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND (
              tablename LIKE 'ptv\_%' ESCAPE '\'
              OR tablename IN (
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

-- ----------------------------------------------------------------------------
-- SECTION 7: CROSS-REFERENCE TO PREFLIGHT INSPECTION SUITE
-- ----------------------------------------------------------------------------
-- Dokumen ini memetakan kueri inspeksi katalog terhadap PREFLIGHT 1 s.d. 10
-- pada proposal migrasi (docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md):
--   - PREFLIGHT 1: Definisi fungsi, overload signature & proconfig lokal (Section 4)
--   - PREFLIGHT 2: Hak akses rutin / routine privileges (Section 4B)
--   - PREFLIGHT 3: Keberadaan kolom diajukan_oleh pada tabel surat (Section 5D)
--   - PREFLIGHT 4: Format sufiks nomor surat historis (Kueri di proposal)
--   - PREFLIGHT 5: Pemeriksaan hak CREATE pada skema public (Kueri di proposal)
--   - PREFLIGHT 6: Pemeriksaan anomali multi-membership aktif (Kueri di proposal)
--   - PREFLIGHT 7: Status keberadaan tabel & RLS (Section 2 & Section 5A)
--   - PREFLIGHT 8: Definisi kebijakan pg_policies (Section 5B)
--   - PREFLIGHT 9: Status kolom nama_acara pada ptv_peminjaman (Section 5D)
--   - PREFLIGHT 10: Hak akses tabel / table privileges (Section 5C)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 8: CONSTRAINTS AUDIT (PK, FK, UNIQUE, CHECK CONSTRAINTS)
-- Memeriksa seluruh constraint yang terpasang pada 36 tabel kanonikal
-- ----------------------------------------------------------------------------
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    CASE contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'c' THEN 'CHECK'
        WHEN 'x' THEN 'EXCLUSION'
        ELSE contype::TEXT
    END AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
ORDER BY table_name, constraint_type, constraint_name;

-- ----------------------------------------------------------------------------
-- SECTION 9: INDEXES AUDIT (B-TREE & COVERING INDEXES)
-- Memeriksa seluruh indeks yang terdaftar pada tabel kanonikal
-- ----------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ----------------------------------------------------------------------------
-- SECTION 10: TRIGGERS AUDIT
-- Memeriksa seluruh database triggers aktif di skema public
-- ----------------------------------------------------------------------------
SELECT 
    trigger_schema,
    event_object_table AS table_name,
    trigger_name,
    action_timing,
    event_manipulation,
    action_orientation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ----------------------------------------------------------------------------
-- SECTION 11: SEQUENCES & IDENTITY COLUMNS AUDIT
-- Memeriksa seluruh sequence yang terdaftar
-- ----------------------------------------------------------------------------
SELECT 
    sequence_schema,
    sequence_name,
    data_type,
    start_value,
    minimum_value,
    maximum_value,
    increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- ----------------------------------------------------------------------------
-- SECTION 12: OBJECT DEPENDENCIES AUDIT (Custom Functions & Views)
-- Memeriksa dependensi objek untuk fungsi dan view kanonikal
-- ----------------------------------------------------------------------------
SELECT 
    cl.relname AS dependent_view_or_table,
    cl.relkind AS object_type,
    p.proname AS referenced_function
FROM pg_depend d
JOIN pg_class cl ON cl.oid = d.objid
JOIN pg_proc p ON p.oid = d.refobjid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'has_capability', 'jwt_custom_claims', 'rpc_checkout_loan', 
      'rpc_return_loan', 'rpc_return_single_unit', 'rpc_get_next_inv_code', 
      'rpc_submit_official_doc'
  )
ORDER BY dependent_view_or_table;

-- ----------------------------------------------------------------------------
-- SECTION 13: CANONICAL SEED DATA AGGREGATION AUDIT (ZERO DATA LEAKAGE)
-- Memverifikasi jumlah baris master data kanonikal murni secara agregat
-- ----------------------------------------------------------------------------
SELECT 'organization' AS table_name, count(*) AS row_count, 2 AS expected_count FROM public.organization
UNION ALL
SELECT 'organization_division', count(*), 5 FROM public.organization_division
UNION ALL
SELECT 'access_profile', count(*), 5 FROM public.access_profile
UNION ALL
SELECT 'capability_registry', count(*), 53 FROM public.capability_registry
UNION ALL
SELECT 'profile_capabilities', count(*), 177 FROM public.profile_capabilities;

-- ----------------------------------------------------------------------------
-- SECTION 14: CANDIDATE CONTRACT DRIFT RECONCILIATION SUMMARY
-- Rekonsiliasi katalog otomatis: Mengklasifikasikan status kepatuhan objek
-- ----------------------------------------------------------------------------
WITH contract_checks AS (
    -- Cek kolom diajukan_oleh pada surat tugas
    SELECT 
        'ptv_surat_tugas.diajukan_oleh' AS check_item,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'ptv_surat_tugas' AND column_name = 'diajukan_oleh'
        ) THEN 'PASS' ELSE 'DRIFT / MISSING' END AS reconciliation_status,
        'Kolom kanonikal pemisahan pengaju dan penyetuju surat' AS notes
    UNION ALL
    -- Cek kolom diajukan_oleh pada surat izin
    SELECT 
        'ptv_surat_izin.diajukan_oleh',
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'ptv_surat_izin' AND column_name = 'diajukan_oleh'
        ) THEN 'PASS' ELSE 'DRIFT / MISSING' END,
        'Kolom kanonikal pemisahan pemohon surat izin'
    UNION ALL
    -- Cek kolom diajukan_oleh pada surat barang
    SELECT 
        'ptv_surat_barang.diajukan_oleh',
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'ptv_surat_barang' AND column_name = 'diajukan_oleh'
        ) THEN 'PASS' ELSE 'DRIFT / MISSING' END,
        'Kolom kanonikal pemisahan pengaju surat barang'
    UNION ALL
    -- Cek foreign key constraint diajukan_oleh pada surat tugas (Target: canonical_identity, Action: RESTRICT)
    SELECT 
        'ptv_surat_tugas.diajukan_oleh_fk',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
            WHERE c.conrelid = 'public.ptv_surat_tugas'::regclass
              AND c.contype = 'f'
              AND a.attname = 'diajukan_oleh'
              AND c.confrelid = 'public.canonical_identity'::regclass
              AND c.confdeltype = 'r'
        ) THEN 'PASS' ELSE 'DRIFT / FK MISCONFIGURED' END,
        'Foreign key constraint diajukan_oleh -> public.canonical_identity(id) ON DELETE RESTRICT'
    UNION ALL
    -- Cek foreign key constraint diajukan_oleh pada surat izin (Target: canonical_identity, Action: RESTRICT)
    SELECT 
        'ptv_surat_izin.diajukan_oleh_fk',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
            WHERE c.conrelid = 'public.ptv_surat_izin'::regclass
              AND c.contype = 'f'
              AND a.attname = 'diajukan_oleh'
              AND c.confrelid = 'public.canonical_identity'::regclass
              AND c.confdeltype = 'r'
        ) THEN 'PASS' ELSE 'DRIFT / FK MISCONFIGURED' END,
        'Foreign key constraint diajukan_oleh -> public.canonical_identity(id) ON DELETE RESTRICT'
    UNION ALL
    -- Cek foreign key constraint diajukan_oleh pada surat barang (Target: canonical_identity, Action: RESTRICT)
    SELECT 
        'ptv_surat_barang.diajukan_oleh_fk',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
            WHERE c.conrelid = 'public.ptv_surat_barang'::regclass
              AND c.contype = 'f'
              AND a.attname = 'diajukan_oleh'
              AND c.confrelid = 'public.canonical_identity'::regclass
              AND c.confdeltype = 'r'
        ) THEN 'PASS' ELSE 'DRIFT / FK MISCONFIGURED' END,
        'Foreign key constraint diajukan_oleh -> public.canonical_identity(id) ON DELETE RESTRICT'
    UNION ALL
    -- Cek keberadaan has_capability di public
    SELECT 
        'public.has_capability',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'has_capability'
        ) THEN 'PASS' ELSE 'DRIFT / MISSING' END,
        'Fungsi kapabilitas wajib berada di skema public'
    UNION ALL
    -- Cek ketidakhadiran fungsi di schema auth (mencegah error 42501)
    SELECT 
        'auth schema clean from custom funcs',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'auth' AND p.proname IN ('has_capability', 'jwt_custom_claims')
        ) THEN 'PASS' ELSE 'BREACH / FOUND IN AUTH SCHEMA' END,
        'Skema terkelola auth tidak boleh memuat fungsi kustom ptv'
    UNION ALL
    -- Cek hak eksekusi anon pada rpc_checkout_loan
    SELECT 
        'rpc_checkout_loan anon revocation',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.routine_privileges
            WHERE routine_schema = 'public' AND routine_name = 'rpc_checkout_loan'
              AND grantee IN ('anon', 'PUBLIC')
        ) THEN 'PASS' ELSE 'LEAK / ANON CAN EXECUTE' END,
        'Role anon dilarang memiliki hak eksekusi RPC checkout'
    UNION ALL
    -- Cek hak eksekusi anon pada rpc_submit_official_doc
    SELECT 
        'rpc_submit_official_doc anon revocation',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.routine_privileges
            WHERE routine_schema = 'public' AND routine_name = 'rpc_submit_official_doc'
              AND grantee IN ('anon', 'PUBLIC')
        ) THEN 'PASS' ELSE 'LEAK / ANON CAN EXECUTE' END,
        'Role anon dilarang memiliki hak eksekusi RPC submit official doc'
    UNION ALL
    -- Cek hak eksekusi anon pada rpc_return_loan
    SELECT 
        'rpc_return_loan anon revocation',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.routine_privileges
            WHERE routine_schema = 'public' AND routine_name = 'rpc_return_loan'
              AND grantee IN ('anon', 'PUBLIC')
        ) THEN 'PASS' ELSE 'LEAK / ANON CAN EXECUTE' END,
        'Role anon dilarang memiliki hak eksekusi RPC return loan'
    UNION ALL
    -- Cek hak eksekusi anon pada rpc_return_single_unit
    SELECT 
        'rpc_return_single_unit anon revocation',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.routine_privileges
            WHERE routine_schema = 'public' AND routine_name = 'rpc_return_single_unit'
              AND grantee IN ('anon', 'PUBLIC')
        ) THEN 'PASS' ELSE 'LEAK / ANON CAN EXECUTE' END,
        'Role anon dilarang memiliki hak eksekusi RPC return single unit'
    UNION ALL
    -- Cek hak eksekusi anon pada rpc_get_next_inv_code
    SELECT 
        'rpc_get_next_inv_code anon revocation',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.routine_privileges
            WHERE routine_schema = 'public' AND routine_name = 'rpc_get_next_inv_code'
              AND grantee IN ('anon', 'PUBLIC')
        ) THEN 'PASS' ELSE 'LEAK / ANON CAN EXECUTE' END,
        'Role anon dilarang memiliki hak eksekusi RPC inv code'
    UNION ALL
    -- Cek hak eksekusi anon pada jwt_custom_claims
    SELECT 
        'jwt_custom_claims anon revocation',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.routine_privileges
            WHERE routine_schema = 'public' AND routine_name = 'jwt_custom_claims'
              AND grantee IN ('anon', 'PUBLIC')
        ) THEN 'PASS' ELSE 'LEAK / ANON CAN EXECUTE' END,
        'Role anon dilarang memiliki hak eksekusi jwt claims injector'
)
SELECT 
    check_item,
    reconciliation_status,
    notes
FROM contract_checks
ORDER BY check_item;

-- ----------------------------------------------------------------------------
-- SECTION 15: READ-ONLY PRE-MIGRATION ORPHAN AUDIT FOR diajukan_oleh
-- Purpose: Pre-flight counting and listing of affected rows before applying FK constraint.
-- STRICTLY READ-ONLY: Never modifies, nullifies, or deletes data.
-- ----------------------------------------------------------------------------

-- 15A. Dynamic Safe Inspection (Works whether column exists or not)
DO $$
DECLARE
    v_has_col BOOLEAN;
    v_cnt BIGINT;
    r RECORD;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'SECTION 15: PRE-MIGRATION ORPHAN AUDIT (diajukan_oleh)';
    RAISE NOTICE '=======================================================';

    -- 1. ptv_surat_tugas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ptv_surat_tugas' AND column_name = 'diajukan_oleh'
    ) INTO v_has_col;

    IF NOT v_has_col THEN
        RAISE NOTICE 'ptv_surat_tugas: Column diajukan_oleh does NOT exist yet. (Orphan count = 0, CLEAN).';
    ELSE
        EXECUTE 'SELECT COUNT(*) FROM public.ptv_surat_tugas WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_tugas.diajukan_oleh)' INTO v_cnt;
        RAISE NOTICE 'ptv_surat_tugas: Orphan count = %', v_cnt;
        IF v_cnt > 0 THEN
            FOR r IN EXECUTE 'SELECT id, nomor_surat, diajukan_oleh FROM public.ptv_surat_tugas WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_tugas.diajukan_oleh)' LOOP
                RAISE WARNING '  ORPHAN ROW in ptv_surat_tugas: id=%, nomor_surat=%, diajukan_oleh=%', r.id, r.nomor_surat, r.diajukan_oleh;
            END LOOP;
        END IF;
    END IF;

    -- 2. ptv_surat_izin
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ptv_surat_izin' AND column_name = 'diajukan_oleh'
    ) INTO v_has_col;

    IF NOT v_has_col THEN
        RAISE NOTICE 'ptv_surat_izin: Column diajukan_oleh does NOT exist yet. (Orphan count = 0, CLEAN).';
    ELSE
        EXECUTE 'SELECT COUNT(*) FROM public.ptv_surat_izin WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_izin.diajukan_oleh)' INTO v_cnt;
        RAISE NOTICE 'ptv_surat_izin: Orphan count = %', v_cnt;
        IF v_cnt > 0 THEN
            FOR r IN EXECUTE 'SELECT id, nomor_surat, diajukan_oleh FROM public.ptv_surat_izin WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_izin.diajukan_oleh)' LOOP
                RAISE WARNING '  ORPHAN ROW in ptv_surat_izin: id=%, nomor_surat=%, diajukan_oleh=%', r.id, r.nomor_surat, r.diajukan_oleh;
            END LOOP;
        END IF;
    END IF;

    -- 3. ptv_surat_barang
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ptv_surat_barang' AND column_name = 'diajukan_oleh'
    ) INTO v_has_col;

    IF NOT v_has_col THEN
        RAISE NOTICE 'ptv_surat_barang: Column diajukan_oleh does NOT exist yet. (Orphan count = 0, CLEAN).';
    ELSE
        EXECUTE 'SELECT COUNT(*) FROM public.ptv_surat_barang WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_barang.diajukan_oleh)' INTO v_cnt;
        RAISE NOTICE 'ptv_surat_barang: Orphan count = %', v_cnt;
        IF v_cnt > 0 THEN
            FOR r IN EXECUTE 'SELECT id, nomor_surat, diajukan_oleh FROM public.ptv_surat_barang WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_barang.diajukan_oleh)' LOOP
                RAISE WARNING '  ORPHAN ROW in ptv_surat_barang: id=%, nomor_surat=%, diajukan_oleh=%', r.id, r.nomor_surat, r.diajukan_oleh;
            END LOOP;
        END IF;
    END IF;
END $$;

-- 15B. Standalone SELECT Detail Queries (Applicable if columns already exist)
-- ptv_surat_tugas detail:
-- SELECT 'ptv_surat_tugas' AS tbl, id, nomor_surat, diajukan_oleh, created_at FROM public.ptv_surat_tugas WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_tugas.diajukan_oleh);
-- ptv_surat_izin detail:
-- SELECT 'ptv_surat_izin' AS tbl, id, nomor_surat, diajukan_oleh, created_at FROM public.ptv_surat_izin WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_izin.diajukan_oleh);
-- ptv_surat_barang detail:
-- SELECT 'ptv_surat_barang' AS tbl, id, nomor_surat, diajukan_oleh, created_at FROM public.ptv_surat_barang WHERE diajukan_oleh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canonical_identity ci WHERE ci.id = ptv_surat_barang.diajukan_oleh);
-- ============================================================================
