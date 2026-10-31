# PTV PRO — RPC Identity Hardening Final SQL Proposal

**Subsystem:** PTV PRO Database & Supabase Security Architecture  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Scope:** Usulan Lengkap SQL DDL & PL/pgSQL Hardening untuk 5 RPC Kanonikal  
**Authoritative Contracts:**  
- [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
- [`docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)  
- [`docs/PTV-PRO-PROJECT-ARCHITECTURE.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)  
- [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)  
- [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-PLAN.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-PLAN.md)  
- [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md)  
**Status:** **NOT READY — OPERATIONAL PREFLIGHT REQUIRED (ARCHITECTURAL DECISIONS FINALIZED — ZERO EXECUTION APPLIED)**  
**Revisi Terakhir:** 09 Oktober 2026 — Finalisasi Keputusan Arsitektur: (1) p_event_name disetujui Opsi 2 (kolom terstruktur nama_acara, implementasi DDL ditangguhkan); (2) Audit aktor pengembalian disetujui Opsi 6B (auth_audit_log, tanpa return_actor_id); (3) Hak baca SELECT surat wajib verifikasi preflight pg_policies (larangan policy spekulatif); (4) Penambahan PREFLIGHT 8-10. Nol SQL dieksekusi.

---

> [!CAUTION]
> **PERINGATAN WAJIB — ZERO EXECUTION APPLIED:**  
> Seluruh skrip SQL di dalam dokumen ini adalah **artefak usulan teknis yang BELUM DIJALANKAN ke database mana pun** (baik staging maupun production).  
> Dokumen ini disiapkan khusus untuk tinjauan manusia (*human review*). Operator database yang berwenang bertanggung jawab mengevaluasi dokumen ini dan menjalankan kueri inspeksi preflight (PREFLIGHT 1-10) sebelum mempertimbangkan eksekusi manual di masa mendatang.
>
> **Status Keputusan Final:** Keputusan arsitektur inti (Keputusan 1 s.d. 14) telah final secara konseptual. Eksekusi SQL di database staging tetap menunggu verifikasi live preflight oleh DBA manusia. Zero SQL executed.

---

## 1. Preflight Inspection Queries (Belum Dijalankan)

Kueri-kueri inspeksi berikut dirancang untuk dijalankan secara read-only oleh Database Administrator pada Supabase SQL Editor sebelum mengaplikasikan patch, guna memvalidasi kondisi awal skema, hak akses, dan integritas data:

```sql
-- ============================================================================
-- PREFLIGHT 1: Verifikasi Definisi dan Overload Fungsi Eksisting
-- ============================================================================
SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    r.rolname AS function_owner,
    p.prosecdef AS is_security_definer,
    array_to_string(p.proconfig, ', ') AS runtime_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname IN (
      'rpc_checkout_loan', 
      'rpc_submit_official_doc', 
      'rpc_return_loan', 
      'rpc_return_single_unit', 
      'rpc_get_next_inv_code'
  )
ORDER BY p.proname, identity_arguments;

-- ============================================================================
-- PREFLIGHT 2: Verifikasi Hak Akses (Grants) yang Berlaku
-- ============================================================================
SELECT 
    routine_schema,
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
      'rpc_checkout_loan', 
      'rpc_submit_official_doc', 
      'rpc_return_loan', 
      'rpc_return_single_unit', 
      'rpc_get_next_inv_code'
  )
ORDER BY routine_name, grantee;

-- ============================================================================
-- PREFLIGHT 3: Verifikasi Keberadaan Kolom diajukan_oleh pada Tabel Persuratan
-- ============================================================================
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang')
  AND column_name IN ('diajukan_oleh', 'disetujui_oleh')
ORDER BY table_name, column_name;

-- ============================================================================
-- PREFLIGHT 4: Verifikasi Pola & Format Penomoran Surat Eksisting
-- ============================================================================
SELECT 'ptv_surat_tugas' AS tabel, count(*) AS total_surat, MAX(nomor_surat) AS nomor_tertinggi FROM public.ptv_surat_tugas
UNION ALL
SELECT 'ptv_surat_izin', count(*), MAX(nomor_surat) FROM public.ptv_surat_izin
UNION ALL
SELECT 'ptv_surat_barang', count(*), MAX(nomor_surat) FROM public.ptv_surat_barang;

-- ============================================================================
-- PREFLIGHT 5: Verifikasi Hak CREATE pada Skema public (Mitigasi Hijacking)
-- ============================================================================
SELECT 
    r.rolname,
    has_schema_privilege(r.rolname, 'public', 'CREATE') AS has_create_on_public,
    has_schema_privilege(r.rolname, 'public', 'USAGE') AS has_usage_on_public
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'public')
ORDER BY r.rolname;

-- ============================================================================
-- PREFLIGHT 6: Verifikasi Ambiguitas Multi-Membership Aktif ptv_studio
-- ============================================================================
SELECT 
    identity_id, 
    count(*) AS current_studio_memberships_count
FROM public.organization_membership
WHERE organization_id = 'ptv_studio'
  AND is_current = TRUE
GROUP BY identity_id
HAVING count(*) > 1;

-- ============================================================================
-- PREFLIGHT 7: Verifikasi Status Hak Akses dan RLS Tabel Surat & Peminjaman
-- ============================================================================
SELECT 
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang', 'ptv_peminjaman', 'ptv_inventaris_unit');

-- ============================================================================
-- PREFLIGHT 8: Verifikasi Kebijakan RLS Aktual (pg_policies) pada Tabel Persuratan
-- (Keputusan 12: Dilarang membuat policy SELECT spekulatif tanpa bukti staging)
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang', 'ptv_peminjaman', 'ptv_inventaris_unit')
ORDER BY tablename, policyname;

-- ============================================================================
-- PREFLIGHT 9: Verifikasi Status Kolom nama_acara pada Tabel ptv_peminjaman
-- (Keputusan 2: Audit Opsi 2 sebelum penjadwalan DDL)
-- ============================================================================
SELECT 
    column_name, 
    data_type, 
    character_maximum_length, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ptv_peminjaman'
  AND column_name IN ('nama_acara', 'keperluan', 'actor_id');

-- ============================================================================
-- PREFLIGHT 10: Verifikasi Hak Akses Tabel Persuratan (Table Privileges)
-- ============================================================================
SELECT 
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang')
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY table_name, grantee, privilege_type;
```

---

## 2. Usulan Patch SQL Lengkap (Belum Dieksekusi)

Berikut adalah naskah SQL atomik yang mengimplementasikan seluruh perbaikan hardening sesuai keputusan arsitektur:

```sql
-- ============================================================================
-- PTV PRO — COMPREHENSIVE RPC IDENTITY HARDENING & ANTI-SPOOFING PATCH
-- Target Environment: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status: PROPOSED SCRIPT (UNEXECUTED)
-- ============================================================================

BEGIN;

-- ============================================================================
-- LANGKAH 1: DDL Penambahan Kolom diajukan_oleh pada Tabel Persuratan
-- (Keputusan 1: Pemisahan Pengaju dan Penyetuju Surat Resmi)
-- ============================================================================

-- 1.1 Tabel ptv_surat_tugas
ALTER TABLE public.ptv_surat_tugas 
ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ptv_surat_tugas_diajukan_oleh 
ON public.ptv_surat_tugas (diajukan_oleh);

-- 1.2 Tabel ptv_surat_izin
ALTER TABLE public.ptv_surat_izin 
ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ptv_surat_izin_diajukan_oleh 
ON public.ptv_surat_izin (diajukan_oleh);

-- 1.3 Tabel ptv_surat_barang
ALTER TABLE public.ptv_surat_barang 
ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ptv_surat_barang_diajukan_oleh 
ON public.ptv_surat_barang (diajukan_oleh);

-- Kebijakan Data Historis (Zero-Guessing Backfill Policy):
-- Kolom diajukan_oleh dibiarkan NULL untuk seluruh baris yang telah ada di database.
-- Data lama TIDAK disalin dari kolom disetujui_oleh demi menjaga kejujuran forensik audit.
COMMENT ON COLUMN public.ptv_surat_tugas.diajukan_oleh IS 'Identitas kanonikal pengaju surat tugas. Wajib diisi pada surat baru; NULL pada arsip historis pra-hardening.';
COMMENT ON COLUMN public.ptv_surat_izin.diajukan_oleh IS 'Identitas kanonikal pemohon surat izin. Wajib diisi pada surat baru; NULL pada arsip historis pra-hardening.';
COMMENT ON COLUMN public.ptv_surat_barang.diajukan_oleh IS 'Identitas kanonikal kru pembawa/pengaju surat barang. Wajib diisi pada surat baru; NULL pada arsip historis pra-hardening.';

-- 1.4 Penguncian Akses Pembuatan Langsung (Proteksi Penuh Kolom diajukan_oleh)
-- Menjamin pembuatan surat baru WAJIB melalui rpc_submit_official_doc demi mencegah pemalsuan pengaju.
REVOKE INSERT ON TABLE 
    public.ptv_surat_tugas, 
    public.ptv_surat_izin, 
    public.ptv_surat_barang 
FROM authenticated, anon, PUBLIC;

-- Catatan Alur Persetujuan (Approval Workflow Preservation):
-- Hak UPDATE pada kolom status dan disetujui_oleh tetap dipertahankan untuk role berwenang (documents.approve),
-- sementara kolom diajukan_oleh dan nomor_surat dilindungi dari perubahan pasca-penerbitan.
--
-- Catatan Kebijakan Akses Baca (SELECT Policy — Keputusan 12):
-- DILARANG membuat policy SELECT spekulatif tanpa bukti aktual dari staging.
-- Status RLS dan policy eksisting wajib diverifikasi via PREFLIGHT 8 sebelum merancang DDL policy pembacaan.

-- 1.5 Pembersihan Overload Warisan untuk Mencegah Ambiguitas PostgREST (PGRST203)
-- CATATAN: Langkah ini menghapus fungsi signature tanpa p_actor_id jika terbukti ada di staging via PREFLIGHT 1.
-- Parameter p_actor_id UUID DEFAULT NULL pada fungsi baru melayani pemanggil berparameter penuh maupun minimal.
DROP FUNCTION IF EXISTS public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[]);
DROP FUNCTION IF EXISTS public.rpc_submit_official_doc(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.rpc_return_loan(TEXT, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_return_single_unit(UUID, UUID, TEXT);


-- ============================================================================
-- LANGKAH 2: HARDENING RPC 1 — rpc_checkout_loan
-- (Resolusi Sesi, Anti-Spoofing, Validasi Unit, dan ORDER BY id Concurrency Lock)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_checkout_loan(
    p_transaction_id TEXT,
    p_borrower_name  TEXT,
    p_purpose        TEXT,
    p_out_date       DATE,
    p_due_date       DATE,
    p_event_name     TEXT,
    p_unit_ids       UUID[],
    p_actor_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_verified_identity_id UUID;
    v_account_id UUID;
    v_status_organisasi VARCHAR(16);
    v_member_count INT := 0;
    v_active_count INT := 0;
    v_deduped_unit_ids UUID[];
    v_unit_id UUID;
    v_count INT := 0;
BEGIN
    -- 2.1 Verifikasi Sesi Autentikasi Pengguna
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '28000';
    END IF;

    -- 2.2 Resolusi Identitas Kanonikal dari Akun Aktif
    SELECT ua.identity_id, ua.id
    INTO v_verified_identity_id, v_account_id
    FROM public.user_account ua
    WHERE ua.auth_user_id = auth.uid()
      AND ua.status_akun = 'active';

    IF v_verified_identity_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Valid active user account not found for current session' 
            USING ERRCODE = '28000';
    END IF;

    -- 2.3 Resolusi Status Keanggotaan PTV Studio (Deterministik & Fail-Closed, Keputusan 5)
    SELECT 
        COUNT(*), 
        COUNT(CASE WHEN om.status_organisasi = 'active' THEN 1 END),
        MAX(om.status_organisasi)
    INTO v_member_count, v_active_count, v_status_organisasi
    FROM public.organization_membership om
    WHERE om.identity_id = v_verified_identity_id
      AND om.organization_id = 'ptv_studio'
      AND om.is_current = TRUE;

    -- Fail-Closed jika terdeteksi anomali baris ganda
    IF v_member_count > 1 THEN
        RAISE EXCEPTION 'DATA_INTEGRITY_ERROR: Inconsistent membership state (multiple current memberships in ptv_studio)' 
            USING ERRCODE = '23514';
    END IF;

    -- Karantina Alumni / Anggota Inactive / Tanpa Keanggotaan Aktif (Fail-Closed)
    IF v_member_count = 0 OR v_status_organisasi != 'active' THEN
        RAISE EXCEPTION 'FORBIDDEN: Active organization membership required (current status: %)', 
            COALESCE(v_status_organisasi, 'none') USING ERRCODE = '42501';
    END IF;

    -- 2.4 Anti-Spoofing Strict Rejection (Keputusan 3)
    IF p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected (p_actor_id does not match authenticated session identity)' 
            USING ERRCODE = '42501';
    END IF;

    -- 2.5 Verifikasi Kapabilitas Otorisasi (Fail-Closed 3VL: IS NOT TRUE Mencegah Bypass Nilai NULL)
    IF public.has_capability('loans.checkout') IS NOT TRUE THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.checkout capability required' USING ERRCODE = 'P0001';
    END IF;

    -- 2.6 Validasi Input Parameter Dasar (Anti-NULL, Anti-Empty String)
    IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Transaction ID cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_borrower_name IS NULL OR btrim(p_borrower_name) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Borrower name cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_purpose IS NULL OR btrim(p_purpose) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Purpose cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_out_date IS NULL OR p_due_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Checkout date and due date are required' USING ERRCODE = '22023';
    END IF;

    IF p_due_date < p_out_date THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Due date cannot be earlier than checkout date' USING ERRCODE = '22023';
    END IF;

    -- 2.7 Validasi Array Unit (Anti-Null, Anti-Empty, Anti-Element-Null, Anti-Duplicate)
    IF p_unit_ids IS NULL OR cardinality(p_unit_ids) = 0 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Unit list cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF NULL = ANY(p_unit_ids) THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Unit IDs cannot contain null elements' USING ERRCODE = '22023';
    END IF;

    SELECT array_agg(DISTINCT u) INTO v_deduped_unit_ids FROM unnest(p_unit_ids) u;
    IF cardinality(v_deduped_unit_ids) != cardinality(p_unit_ids) THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Duplicate unit IDs detected in checkout basket' USING ERRCODE = '22023';
    END IF;

    -- 2.8 Pencegahan Duplikasi ID Transaksi (Advisory Lock Mencegah Race Condition Pemanggilan Paralel)
    PERFORM pg_advisory_xact_lock(hashtext(p_transaction_id));

    IF EXISTS (SELECT 1 FROM public.ptv_peminjaman WHERE transaction_id = p_transaction_id) THEN
        RAISE EXCEPTION 'DUPLICATE_TRANSACTION: Transaction ID % already exists', p_transaction_id 
            USING ERRCODE = '23505';
    END IF;

    -- 2.9 Penguncian Concurrency Deterministik (ORDER BY id Mencegah Deadlock)
    PERFORM id FROM public.ptv_inventaris_unit 
    WHERE id = ANY(v_deduped_unit_ids) AND status_peminjaman = 'tersedia' 
    ORDER BY id 
    FOR UPDATE;

    -- Verifikasi Ketersediaan Seluruh Unit yang Diminta
    IF (SELECT count(*) FROM public.ptv_inventaris_unit WHERE id = ANY(v_deduped_unit_ids) AND status_peminjaman = 'tersedia') != cardinality(v_deduped_unit_ids) THEN
        RAISE EXCEPTION 'UNIT_NOT_AVAILABLE: One or more selected units are already loaned, damaged, or missing' 
            USING ERRCODE = 'P0001';
    END IF;

    -- 2.10 Eksekusi Mutasi Atomik (actor_id SELALU menggunakan identitas terverifikasi sesi)
    -- Catatan Keputusan 2 (Final): Penambahan kolom nama_acara telah disetujui (Opsi 2).
    -- Sesuai arahan mutlak operator, implementasi DDL (ALTER TABLE ptv_peminjaman ADD COLUMN nama_acara ...)
    -- dan penulisan kolom ini pada INSERT ditangguhkan (deferred) sampai jadwal migrasi resmi.
    -- Nilai p_purpose tetap murni tanpa penggabungan teks sepihak p_event_name.
    FOREACH v_unit_id IN ARRAY v_deduped_unit_ids LOOP
        INSERT INTO public.ptv_peminjaman (
            transaction_id, unit_id, peminjam_nama, keperluan, 
            tanggal_pinjam, tenggat_kembali, status, actor_id
        ) VALUES (
            p_transaction_id, v_unit_id, p_borrower_name, p_purpose,
            p_out_date, p_due_date, 'dipinjam', v_verified_identity_id
        );

        UPDATE public.ptv_inventaris_unit 
        SET status_peminjaman = 'dipinjam', updated_at = now()
        WHERE id = v_unit_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'items_count', v_count,
        'verified_actor_id', v_verified_identity_id
    );
END;
$$;


-- ============================================================================
-- LANGKAH 3: HARDENING RPC 2 — rpc_submit_official_doc
-- (Pemisahan Pengaju/Penyetuju, Penomoran Bebas Lubang, dan Advisory Locks)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_official_doc(
    p_doc_type TEXT,
    p_payload  JSONB,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_verified_identity_id UUID;
    v_account_id UUID;
    v_status_organisasi VARCHAR(16);
    v_member_count INT := 0;
    v_active_count INT := 0;
    v_prefix TEXT;
    v_lock_id BIGINT;
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_month TEXT := to_char(CURRENT_DATE, 'MM');
    v_max_num INT;
    v_seq INT;
    v_nomor TEXT;
    v_doc_id UUID;
    v_initial_status VARCHAR(32) := 'diajukan';
    v_approver_identity_id UUID := NULL;
BEGIN
    -- 3.1 Verifikasi Sesi Autentikasi Pengguna
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '28000';
    END IF;

    -- 3.2 Resolusi Identitas Kanonikal dari Akun Aktif
    SELECT ua.identity_id, ua.id
    INTO v_verified_identity_id, v_account_id
    FROM public.user_account ua
    WHERE ua.auth_user_id = auth.uid()
      AND ua.status_akun = 'active';

    IF v_verified_identity_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Valid active user account not found for current session' 
            USING ERRCODE = '28000';
    END IF;

    -- 3.3 Verifikasi Status Keanggotaan Organisasi (Deterministik & Fail-Closed)
    SELECT 
        COUNT(*), 
        COUNT(CASE WHEN om.status_organisasi = 'active' THEN 1 END),
        MAX(om.status_organisasi)
    INTO v_member_count, v_active_count, v_status_organisasi
    FROM public.organization_membership om
    WHERE om.identity_id = v_verified_identity_id
      AND om.organization_id = 'ptv_studio'
      AND om.is_current = TRUE;

    IF v_member_count > 1 THEN
        RAISE EXCEPTION 'DATA_INTEGRITY_ERROR: Inconsistent membership state (multiple current memberships in ptv_studio)' 
            USING ERRCODE = '23514';
    END IF;

    IF v_member_count = 0 OR v_status_organisasi != 'active' THEN
        RAISE EXCEPTION 'FORBIDDEN: Active organization member required (current status: %)', 
            COALESCE(v_status_organisasi, 'none') USING ERRCODE = '42501';
    END IF;

    -- 3.4 Anti-Spoofing Strict Rejection (Keputusan 3)
    IF p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected (p_actor_id does not match authenticated session identity)' 
            USING ERRCODE = '42501';
    END IF;

    -- 3.5 Verifikasi Kapabilitas Pembuatan Dokumen (Fail-Closed 3VL: IS NOT TRUE Mencegah Bypass Nilai NULL)
    IF (public.has_capability('documents.request') IS NOT TRUE) AND (public.has_capability('documents.generate') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: documents.request or documents.generate capability required' USING ERRCODE = 'P0001';
    END IF;

    -- 3.6 Validasi Input Parameter Dasar & Payload JSONB
    IF p_doc_type IS NULL OR btrim(p_doc_type) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Document type cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) != 'object' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Payload must be a valid non-null JSON object' USING ERRCODE = '22023';
    END IF;

    -- Konfigurasi Prefix & Advisory Lock ID
    IF p_doc_type = 'tugas' THEN
        v_prefix := 'ST'; v_lock_id := 1002;
        IF p_payload ->> 'perihal' IS NULL OR btrim(p_payload ->> 'perihal') = '' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: perihal is required for surat tugas' USING ERRCODE = '22023';
        END IF;
        IF p_payload ->> 'tanggal_tugas' IS NULL OR btrim(p_payload ->> 'tanggal_tugas') = '' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: tanggal_tugas is required for surat tugas' USING ERRCODE = '22023';
        END IF;
        IF (p_payload ->> 'tanggal_tugas') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: tanggal_tugas must be a valid date in YYYY-MM-DD format' USING ERRCODE = '22023';
        END IF;
    ELSIF p_doc_type = 'izin' THEN
        v_prefix := 'SI'; v_lock_id := 1003;
        IF p_payload ->> 'nama_pemohon' IS NULL OR btrim(p_payload ->> 'nama_pemohon') = '' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: nama_pemohon is required for surat izin' USING ERRCODE = '22023';
        END IF;
        IF p_payload ->> 'alasan' IS NULL OR btrim(p_payload ->> 'alasan') = '' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: alasan is required for surat izin' USING ERRCODE = '22023';
        END IF;
        IF p_payload ->> 'tanggal_mulai' IS NULL OR p_payload ->> 'tanggal_selesai' IS NULL THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: tanggal_mulai and tanggal_selesai are required for surat izin' USING ERRCODE = '22023';
        END IF;
        IF (p_payload ->> 'tanggal_mulai') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (p_payload ->> 'tanggal_selesai') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: tanggal_mulai and tanggal_selesai must be valid dates in YYYY-MM-DD format' USING ERRCODE = '22023';
        END IF;
        IF (p_payload ->> 'tanggal_selesai')::DATE < (p_payload ->> 'tanggal_mulai')::DATE THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: tanggal_selesai cannot be earlier than tanggal_mulai' USING ERRCODE = '22023';
        END IF;
    ELSIF p_doc_type = 'barang' THEN
        v_prefix := 'SBB'; v_lock_id := 1004;
        IF p_payload ->> 'nama_pembawa' IS NULL OR btrim(p_payload ->> 'nama_pembawa') = '' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: nama_pembawa is required for surat barang' USING ERRCODE = '22023';
        END IF;
        IF p_payload ->> 'tujuan_lokasi' IS NULL OR btrim(p_payload ->> 'tujuan_lokasi') = '' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: tujuan_lokasi is required for surat barang' USING ERRCODE = '22023';
        END IF;
    ELSE
        RAISE EXCEPTION 'INVALID_DOC_TYPE: Unsupported doc type %', p_doc_type USING ERRCODE = '22023';
    END IF;

    -- Serialisasi Transaksi Penomoran Surat
    PERFORM pg_advisory_xact_lock(v_lock_id);

    -- 3.7 Penomoran Bebas Lubang & Bebas Truncation >999 (Gap-Resilient Safe Formatting)
    IF p_doc_type = 'tugas' THEN
        SELECT COALESCE(MAX(NULLIF(regexp_replace(substring(nomor_surat from '[0-9]+$'), '\D', '', 'g'), '')::INT), 0)
        INTO v_max_num
        FROM public.ptv_surat_tugas 
        WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        
        v_seq := v_max_num + 1;
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || 
            CASE WHEN v_seq < 1000 THEN LPAD(v_seq::TEXT, 3, '0') ELSE v_seq::TEXT END;

        INSERT INTO public.ptv_surat_tugas (
            nomor_surat, perihal, tanggal_tugas, kru_terlibat, 
            diajukan_oleh, disetujui_oleh, status
        ) VALUES (
            v_nomor, 
            p_payload ->> 'perihal', 
            (p_payload ->> 'tanggal_tugas')::DATE, 
            COALESCE(p_payload -> 'kru_terlibat', '[]'::jsonb), 
            v_verified_identity_id, 
            v_approver_identity_id, 
            v_initial_status
        ) RETURNING id INTO v_doc_id;

    ELSIF p_doc_type = 'izin' THEN
        SELECT COALESCE(MAX(NULLIF(regexp_replace(substring(nomor_surat from '[0-9]+$'), '\D', '', 'g'), '')::INT), 0)
        INTO v_max_num
        FROM public.ptv_surat_izin 
        WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';

        v_seq := v_max_num + 1;
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || 
            CASE WHEN v_seq < 1000 THEN LPAD(v_seq::TEXT, 3, '0') ELSE v_seq::TEXT END;

        INSERT INTO public.ptv_surat_izin (
            nomor_surat, nama_pemohon, alasan, tanggal_mulai, tanggal_selesai, 
            diajukan_oleh, disetujui_oleh, status
        ) VALUES (
            v_nomor, 
            p_payload ->> 'nama_pemohon', 
            p_payload ->> 'alasan', 
            (p_payload ->> 'tanggal_mulai')::DATE, 
            (p_payload ->> 'tanggal_selesai')::DATE, 
            v_verified_identity_id, 
            v_approver_identity_id, 
            v_initial_status
        ) RETURNING id INTO v_doc_id;

    ELSE -- p_doc_type = 'barang'
        SELECT COALESCE(MAX(NULLIF(regexp_replace(substring(nomor_surat from '[0-9]+$'), '\D', '', 'g'), '')::INT), 0)
        INTO v_max_num
        FROM public.ptv_surat_barang 
        WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';

        v_seq := v_max_num + 1;
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || 
            CASE WHEN v_seq < 1000 THEN LPAD(v_seq::TEXT, 3, '0') ELSE v_seq::TEXT END;

        INSERT INTO public.ptv_surat_barang (
            nomor_surat, nama_pembawa, tujuan_lokasi, daftar_barang, 
            diajukan_oleh, disetujui_oleh, status
        ) VALUES (
            v_nomor, 
            p_payload ->> 'nama_pembawa', 
            p_payload ->> 'tujuan_lokasi', 
            COALESCE(p_payload -> 'daftar_barang', '[]'::jsonb), 
            v_verified_identity_id, 
            v_approver_identity_id, 
            v_initial_status
        ) RETURNING id INTO v_doc_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'nomor_surat', v_nomor,
        'doc_id', v_doc_id,
        'status', v_initial_status,
        'diajukan_oleh', v_verified_identity_id,
        'disetujui_oleh', v_approver_identity_id
    );
END;
$$;


-- ============================================================================
-- LANGKAH 4: HARDENING RPC 3 — rpc_return_loan
-- (Resolusi Sesi, Anti-Spoofing, Penguncian Baris, dan Audit Pengembalian)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_return_loan(
    p_transaction_id   TEXT,
    p_back_date        DATE,
    p_condition_status TEXT,
    p_notes            TEXT,
    p_actor_id         UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_verified_identity_id UUID;
    v_account_id UUID;
    v_status_organisasi VARCHAR(16);
    v_member_count INT := 0;
    v_active_count INT := 0;
    v_unit_ids UUID[];
BEGIN
    -- 4.1 Verifikasi Sesi Autentikasi Pengguna
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '28000';
    END IF;

    -- 4.2 Resolusi Identitas Kanonikal Pemroses
    SELECT ua.identity_id, ua.id
    INTO v_verified_identity_id, v_account_id
    FROM public.user_account ua
    WHERE ua.auth_user_id = auth.uid()
      AND ua.status_akun = 'active';

    IF v_verified_identity_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Valid active user account not found for current session' 
            USING ERRCODE = '28000';
    END IF;

    -- 4.3 Verifikasi Keanggotaan Organisasi (Deterministik & Fail-Closed)
    SELECT 
        COUNT(*), 
        COUNT(CASE WHEN om.status_organisasi = 'active' THEN 1 END),
        MAX(om.status_organisasi)
    INTO v_member_count, v_active_count, v_status_organisasi
    FROM public.organization_membership om
    WHERE om.identity_id = v_verified_identity_id
      AND om.organization_id = 'ptv_studio'
      AND om.is_current = TRUE;

    IF v_member_count > 1 THEN
        RAISE EXCEPTION 'DATA_INTEGRITY_ERROR: Inconsistent membership state (multiple current memberships in ptv_studio)' 
            USING ERRCODE = '23514';
    END IF;

    IF v_member_count = 0 OR v_status_organisasi != 'active' THEN
        RAISE EXCEPTION 'FORBIDDEN: Active organization member required (current status: %)', 
            COALESCE(v_status_organisasi, 'none') USING ERRCODE = '42501';
    END IF;

    -- 4.4 Anti-Spoofing Strict Rejection (Keputusan 3)
    IF p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected (p_actor_id does not match authenticated session identity)' 
            USING ERRCODE = '42501';
    END IF;

    -- 4.5 Verifikasi Kapabilitas Pengembalian (Fail-Closed 3VL: IS NOT TRUE Mencegah Bypass Nilai NULL)
    IF public.has_capability('loans.return') IS NOT TRUE THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required' USING ERRCODE = 'P0001';
    END IF;

    -- 4.6 Validasi Input Parameter Dasar & Status Kondisi
    IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Transaction ID cannot be empty' USING ERRCODE = '22023';
    END IF;

    IF p_back_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Return date cannot be null' USING ERRCODE = '22023';
    END IF;

    IF p_condition_status IS NULL OR p_condition_status NOT IN ('bagus', 'rusak', 'perlu_servis') THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Invalid condition status (%). Allowed values: bagus, rusak, perlu_servis', 
            COALESCE(p_condition_status, 'null') USING ERRCODE = '22023';
    END IF;

    -- 4.7 Penguncian Baris Peminjaman Aktif FOR UPDATE (via Subquery Bebas Error Agregasi)
    SELECT array_agg(unit_id ORDER BY unit_id) INTO v_unit_ids
    FROM (
        SELECT unit_id
        FROM public.ptv_peminjaman
        WHERE transaction_id = p_transaction_id AND status = 'dipinjam'
        ORDER BY unit_id
        FOR UPDATE
    ) sub_loans;

    IF v_unit_ids IS NULL OR cardinality(v_unit_ids) = 0 THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: No active loans found for transaction %', p_transaction_id 
            USING ERRCODE = 'P0001';
    END IF;

    -- 4.7 Penguncian Unit Terkait dalam Urutan Deterministik
    PERFORM id FROM public.ptv_inventaris_unit
    WHERE id = ANY(v_unit_ids)
    ORDER BY id
    FOR UPDATE;

    -- 4.8 Mutasi Atomik Pengembalian Transaksi Penuh
    UPDATE public.ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = p_back_date,
        kondisi_kembali = p_condition_status,
        catatan = CASE 
            WHEN p_notes IS NOT NULL AND btrim(p_notes) != '' THEN 
                COALESCE(catatan, '') || ' | Kembali: ' || btrim(p_notes)
            ELSE catatan 
        END
    WHERE transaction_id = p_transaction_id AND status = 'dipinjam';

    UPDATE public.ptv_inventaris_unit
    SET status_peminjaman = CASE 
            WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' 
            ELSE 'tersedia' 
        END,
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = ANY(v_unit_ids);

    -- 4.9 Pencatatan Audit Log Forensik
    INSERT INTO public.auth_audit_log (
        actor_id, event_type, metadata
    ) VALUES (
        v_verified_identity_id, 
        'loan.return.full', 
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'returned_units_count', cardinality(v_unit_ids),
            'condition_status', p_condition_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'returned_units', cardinality(v_unit_ids),
        'processed_by', v_verified_identity_id
    );
END;
$$;


-- ============================================================================
-- LANGKAH 5: HARDENING RPC 4 — rpc_return_single_unit
-- (Resolusi Sesi, Anti-Spoofing, Pengembalian Parsial Aman, dan Audit Log)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_return_single_unit(
    p_loan_row_id      UUID,
    p_unit_id          UUID,
    p_condition_status TEXT,
    p_actor_id         UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_verified_identity_id UUID;
    v_account_id UUID;
    v_status_organisasi VARCHAR(16);
    v_member_count INT := 0;
    v_active_count INT := 0;
    v_unit_code TEXT;
    v_tx_id TEXT;
BEGIN
    -- 5.1 Verifikasi Sesi Autentikasi Pengguna
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '28000';
    END IF;

    -- 5.2 Resolusi Identitas Kanonikal Pemroses
    SELECT ua.identity_id, ua.id
    INTO v_verified_identity_id, v_account_id
    FROM public.user_account ua
    WHERE ua.auth_user_id = auth.uid()
      AND ua.status_akun = 'active';

    IF v_verified_identity_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Valid active user account not found for current session' 
            USING ERRCODE = '28000';
    END IF;

    -- 5.3 Verifikasi Keanggotaan Organisasi (Deterministik & Fail-Closed)
    SELECT 
        COUNT(*), 
        COUNT(CASE WHEN om.status_organisasi = 'active' THEN 1 END),
        MAX(om.status_organisasi)
    INTO v_member_count, v_active_count, v_status_organisasi
    FROM public.organization_membership om
    WHERE om.identity_id = v_verified_identity_id
      AND om.organization_id = 'ptv_studio'
      AND om.is_current = TRUE;

    IF v_member_count > 1 THEN
        RAISE EXCEPTION 'DATA_INTEGRITY_ERROR: Inconsistent membership state (multiple current memberships in ptv_studio)' 
            USING ERRCODE = '23514';
    END IF;

    IF v_member_count = 0 OR v_status_organisasi != 'active' THEN
        RAISE EXCEPTION 'FORBIDDEN: Active organization member required (current status: %)', 
            COALESCE(v_status_organisasi, 'none') USING ERRCODE = '42501';
    END IF;

    -- 5.4 Anti-Spoofing Strict Rejection (Keputusan 3)
    IF p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected (p_actor_id does not match authenticated session identity)' 
            USING ERRCODE = '42501';
    END IF;

    -- 5.5 Verifikasi Kapabilitas Pengembalian (Fail-Closed 3VL: IS NOT TRUE Mencegah Bypass Nilai NULL)
    IF public.has_capability('loans.return') IS NOT TRUE THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required' USING ERRCODE = 'P0001';
    END IF;

    -- 5.6 Validasi Input Parameter Dasar & Status Kondisi
    IF p_loan_row_id IS NULL OR p_unit_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Loan row ID and Unit ID are required' USING ERRCODE = '22023';
    END IF;

    IF p_condition_status IS NULL OR p_condition_status NOT IN ('bagus', 'rusak', 'perlu_servis') THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Invalid condition status (%). Allowed values: bagus, rusak, perlu_servis', 
            COALESCE(p_condition_status, 'null') USING ERRCODE = '22023';
    END IF;

    -- 5.7 Penguncian Baris Peminjaman Spesifik FOR UPDATE
    SELECT transaction_id INTO v_tx_id
    FROM public.ptv_peminjaman
    WHERE id = p_loan_row_id AND unit_id = p_unit_id AND status = 'dipinjam'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LOAN_NOT_ACTIVE: Specified loan row % is not active or already returned', 
            p_loan_row_id USING ERRCODE = 'P0001';
    END IF;

    -- 5.7 Penguncian Unit Spesifik FOR UPDATE
    SELECT kode_unit INTO v_unit_code
    FROM public.ptv_inventaris_unit
    WHERE id = p_unit_id
    FOR UPDATE;

    -- 5.8 Mutasi Atomik Pengembalian Parsial
    UPDATE public.ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = CURRENT_DATE,
        kondisi_kembali = p_condition_status
    WHERE id = p_loan_row_id AND unit_id = p_unit_id;

    UPDATE public.ptv_inventaris_unit
    SET status_peminjaman = CASE 
            WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' 
            ELSE 'tersedia' 
        END,
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = p_unit_id;

    -- 5.9 Pencatatan Audit Log Forensik
    INSERT INTO public.auth_audit_log (
        actor_id, event_type, metadata
    ) VALUES (
        v_verified_identity_id, 
        'loan.return.single', 
        jsonb_build_object(
            'loan_row_id', p_loan_row_id,
            'unit_id', p_unit_id,
            'kode_unit', v_unit_code,
            'transaction_id', v_tx_id,
            'condition_status', p_condition_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_row_id,
        'unit_id', p_unit_id,
        'kode_unit', v_unit_code,
        'status', 'dikembalikan',
        'processed_by', v_verified_identity_id
    );
END;
$$;


-- ============================================================================
-- LANGKAH 6: HARDENING RPC 5 — rpc_get_next_inv_code
-- (Pencabutan Akses Anonim & Penambahan Guard Kapabilitas Internal)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_next_inv_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_max_num BIGINT;
BEGIN
    -- 6.1 Guard Kapabilitas Internal (Fail-Closed 3VL, Keputusan 4)
    IF (auth.jwt() ->> 'role') = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        -- service_role diizinkan untuk kebutuhan migrasi/seeding backend
        NULL;
    ELSIF (public.has_capability('inventory.create') IS NOT TRUE) AND (public.has_capability('inventory.units.manage') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: inventory management capability required' USING ERRCODE = 'P0001';
    END IF;

    -- 6.2 Serialisasi Konkurensi Pembuatan Nomor Inventaris
    -- CATATAN AUDIT INV-NUM-01: Advisory lock 1001 diserialisasi dalam transaksi pemanggil.
    -- Fungsi ini bersifat advisory/suggester preview (hanya menyarankan kode berikutnya).
    -- Keamanan konkurensi alokasi final saat INSERT sepenuhnya dijamin oleh UNIQUE constraint pada public.ptv_inventaris(kode).
    PERFORM pg_advisory_xact_lock(1001);

    -- Ekstraksi angka murni hanya dari format INV-[0-9]+ (Mencegah polusi kode non-INV & integer overflow dengan BIGINT)
    SELECT COALESCE(MAX(NULLIF(substring(kode from '^INV-([0-9]+)$'), '')::BIGINT), 0)
    INTO v_max_num
    FROM public.ptv_inventaris
    WHERE kode ~ '^INV-[0-9]+$';

    -- Format aman bebas truncation rightwards saat melampaui 999 (LPAD 1000 -> 100 dihindari)
    RETURN 'INV-' || CASE 
        WHEN (v_max_num + 1) < 1000 THEN LPAD((v_max_num + 1)::TEXT, 3, '0')
        ELSE (v_max_num + 1)::TEXT 
    END;
END;
$$;


-- ============================================================================
-- LANGKAH 7: HAK AKSES DAN GRANTS (LEAST PRIVILEGE ENFORCEMENT)
-- (Pencabutan Akses PUBLIC, anon, dan service_role pada RPC interaktif pengguna;
--  Pembatasan hak eksekusi strictly ke role authenticated. service_role hanya diberikan pada rpc_get_next_inv_code)
-- ============================================================================

-- 7.1 rpc_checkout_loan (Strictly Human Session)
REVOKE ALL ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) TO authenticated;

-- 7.2 rpc_submit_official_doc (Strictly Human Session)
REVOKE ALL ON FUNCTION public.rpc_submit_official_doc(TEXT, JSONB, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submit_official_doc(TEXT, JSONB, UUID) TO authenticated;

-- 7.3 rpc_return_loan (Strictly Human Session)
REVOKE ALL ON FUNCTION public.rpc_return_loan(TEXT, DATE, TEXT, TEXT, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_return_loan(TEXT, DATE, TEXT, TEXT, UUID) TO authenticated;

-- 7.4 rpc_return_single_unit (Strictly Human Session)
REVOKE ALL ON FUNCTION public.rpc_return_single_unit(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_return_single_unit(UUID, UUID, TEXT, UUID) TO authenticated;

-- 7.5 rpc_get_next_inv_code (Keputusan 4: Didukung untuk authenticated & service_role backend seeding)
REVOKE ALL ON FUNCTION public.rpc_get_next_inv_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated, service_role;

-- 7.6 Refresh PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

COMMIT;
```

---

## 3. Postflight Verification Queries (Belum Dijalankan)

Kueri-kueri verifikasi berikut disiapkan untuk dijalankan pasca-patch guna mengonfirmasi keberhasilan aplikasi skema dan hak akses:

```sql
-- ============================================================================
-- POSTFLIGHT 1: Konfirmasi Keberadaan Kolom diajukan_oleh
-- ============================================================================
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang')
  AND column_name = 'diajukan_oleh';

-- ============================================================================
-- POSTFLIGHT 2: Konfirmasi Hak Akses (Pastikan anon dan PUBLIC Terhapus)
-- ============================================================================
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
      'rpc_checkout_loan', 
      'rpc_submit_official_doc', 
      'rpc_return_loan', 
      'rpc_return_single_unit', 
      'rpc_get_next_inv_code'
  )
  AND grantee IN ('PUBLIC', 'anon');
-- HASIL YANG DIHARAPKAN: 0 baris (Tidak ada hak eksekusi anon atau PUBLIC)

-- ============================================================================
-- POSTFLIGHT 3: Konfirmasi Signature & Search Path Fungsi pada pg_proc
-- ============================================================================
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_sec_definer,
    p.proconfig AS search_path_config
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN (
      'rpc_checkout_loan', 
      'rpc_submit_official_doc', 
      'rpc_return_loan', 
      'rpc_return_single_unit', 
      'rpc_get_next_inv_code'
  );
-- HASIL YANG DIHARAPKAN: prosecdef = true, proconfig memuat 'search_path=pg_catalog, public, auth'

-- ============================================================================
-- POSTFLIGHT 4: Deteksi Anomali Multi-Membership Aktif (Audit Integritas)
-- ============================================================================
SELECT 
    identity_id, 
    count(*) AS active_studio_count,
    array_agg(organization_id) AS conflicting_orgs
FROM public.organization_membership
WHERE is_current = true
GROUP BY identity_id
HAVING count(*) > 1;
-- HASIL YANG DIHARAPKAN: 0 baris (Jika > 0, anomali data harus diselesaikan manual)

-- ============================================================================
-- POSTFLIGHT 5: Konfirmasi Pencabutan Hak Akses Tabel Persuratan (Jalur Tulis Tunggal)
-- ============================================================================
SELECT 
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang')
  AND privilege_type = 'INSERT'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');
-- HASIL YANG DIHARAPKAN: 0 baris (Tidak ada role yang dapat melakukan direct INSERT selain SECURITY DEFINER)
```

---

## 4. Prosedur Rollback & Pemulihan Bencana (Disaster Recovery Runbook)

> [!IMPORTANT]
> **KLASIFIKASI & ANALISIS KEJUJURAN ROLLBACK (DISASTER RECOVERY ARCHITECTURE):**  
> 1. **Transactional Rollback (In-flight Failure):** Naskah patch pada Bagian 2 dibungkus sepenuhnya dalam transaksi atomik `BEGIN; ... COMMIT;`. Jika terjadi galat runtime atau kegagalan sintaks selama eksekusi patch, PostgreSQL secara otomatis membatalkan seluruh perubahan (`ROLLBACK;`) tanpa meninggalkan status parsial.
> 2. **Dilema Rollback Pasca-Commit (Post-Commit Reversion):**
>    - **Option A (Strict Baseline Revert):** Mengembalikan definisi 5 RPC secara harfiah ke naskah [`PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql).  
>      *Konsekuensi:* Parameter `p_actor_id UUID` kembali menjadi parameter wajib (8-arg / 5-arg tanpa default), hak eksekusi dikembalikan ke `authenticated, service_role`, `search_path = public, auth`, dan bug overflow penomoran inventaris kembali aktif. Pemanggil frontend modern yang mengirim `p_actor_id = NULL` atau tanpa parameter `p_actor_id` akan gagal jika overload dihapus.
>    - **Option B (Hybrid Safe Functional Revert — Direkomendasikan Jika Terjadi Regresi Logika):** Membatalkan logika validasi identitas sesi yang ketat (`v_auth_uid` & pengecekan `user_account`), mengembalikan fleksibilitas `p_actor_id`, namun **TETAP MEMPERTAHANKAN** perbaikan konkurensi (`ORDER BY id` locking), pengamanan nomor inventaris/surat, `search_path = pg_catalog, public, auth`, dan pencabutan hak akses `anon`/`PUBLIC`.
> 3. **Perlindungan Kolom Data:** Kolom `diajukan_oleh` pada tabel persuratan **TIDAK DIHAPUS** selama prosedur rollback untuk menjaga integritas data audit yang telah tersimpan.

```sql
-- ============================================================================
-- OPTION B: RECOMMENDED HYBRID SAFE FUNCTIONAL REVERT DDL
-- (Gunakan jika terjadi regresi logika identitas tetapi proteksi keamanan & konkurensi ingin dipertahankan)
-- Status: UNEXECUTED RECOVERY RUNBOOK
-- ============================================================================

BEGIN;

-- 4.1 Restorasi Hybrid RPC 1: rpc_checkout_loan
CREATE OR REPLACE FUNCTION public.rpc_checkout_loan(
    p_transaction_id TEXT,
    p_borrower_name  TEXT,
    p_purpose        TEXT,
    p_out_date       DATE,
    p_due_date       DATE,
    p_event_name     TEXT,
    p_unit_ids       UUID[],
    p_actor_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_unit_id UUID;
    v_count INT := 0;
BEGIN
    IF (public.has_capability('loans.checkout') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.checkout capability required';
    END IF;

    -- Concurrency Guard: Lock rows FOR UPDATE
    PERFORM id FROM public.ptv_inventaris_unit 
    WHERE id = ANY(p_unit_ids) AND status_peminjaman = 'tersedia' 
    ORDER BY id 
    FOR UPDATE;

    IF (SELECT count(*) FROM public.ptv_inventaris_unit WHERE id = ANY(p_unit_ids) AND status_peminjaman = 'tersedia') != array_length(p_unit_ids, 1) THEN
        RAISE EXCEPTION 'UNIT_NOT_AVAILABLE: One or more selected units are not available for loan';
    END IF;

    FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
        INSERT INTO public.ptv_peminjaman (
            transaction_id, unit_id, peminjam_nama, keperluan, 
            tanggal_pinjam, tenggat_kembali, status, actor_id
        ) VALUES (
            p_transaction_id, v_unit_id, p_borrower_name, p_purpose,
            p_out_date, p_due_date, 'dipinjam', p_actor_id
        );

        UPDATE public.ptv_inventaris_unit 
        SET status_peminjaman = 'dipinjam', updated_at = now()
        WHERE id = v_unit_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'items_count', v_count
    );
END;
$$;

-- 4.2 Restorasi Hybrid RPC 2: rpc_return_loan
CREATE OR REPLACE FUNCTION public.rpc_return_loan(
    p_transaction_id   TEXT,
    p_back_date        DATE,
    p_condition_status TEXT,
    p_notes            TEXT,
    p_actor_id         UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_unit_ids UUID[];
BEGIN
    IF (public.has_capability('loans.return') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required';
    END IF;

    SELECT array_agg(unit_id ORDER BY unit_id) INTO v_unit_ids
    FROM (
        SELECT unit_id
        FROM public.ptv_peminjaman
        WHERE transaction_id = p_transaction_id AND status = 'dipinjam'
        ORDER BY unit_id
        FOR UPDATE
    ) sub_loans;

    IF v_unit_ids IS NULL OR cardinality(v_unit_ids) = 0 THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: No active loans found for transaction %', p_transaction_id;
    END IF;

    PERFORM id FROM public.ptv_inventaris_unit
    WHERE id = ANY(v_unit_ids)
    ORDER BY id
    FOR UPDATE;

    UPDATE public.ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = p_back_date,
        kondisi_kembali = p_condition_status,
        catatan = COALESCE(catatan, '') || ' | ' || COALESCE(p_notes, '')
    WHERE transaction_id = p_transaction_id AND status = 'dipinjam';

    UPDATE public.ptv_inventaris_unit
    SET status_peminjaman = CASE WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' ELSE 'tersedia' END,
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = ANY(v_unit_ids);

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'returned_units', cardinality(v_unit_ids)
    );
END;
$$;

-- 4.3 Restorasi Hybrid RPC 3: rpc_return_single_unit
CREATE OR REPLACE FUNCTION public.rpc_return_single_unit(
    p_loan_row_id      UUID,
    p_unit_id          UUID,
    p_condition_status TEXT,
    p_actor_id         UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
    IF (public.has_capability('loans.return') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required';
    END IF;

    UPDATE public.ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = CURRENT_DATE,
        kondisi_kembali = p_condition_status
    WHERE id = p_loan_row_id AND unit_id = p_unit_id;

    UPDATE public.ptv_inventaris_unit
    SET status_peminjaman = CASE WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' ELSE 'tersedia' END,
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = p_unit_id;

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_row_id,
        'unit_id', p_unit_id
    );
END;
$$;

-- 4.4 Restorasi Hybrid RPC 4: rpc_get_next_inv_code
CREATE OR REPLACE FUNCTION public.rpc_get_next_inv_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_max_num BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(1001);

    SELECT COALESCE(MAX(NULLIF(substring(kode from '^INV-([0-9]+)$'), '')::BIGINT), 0)
    INTO v_max_num
    FROM public.ptv_inventaris
    WHERE kode ~ '^INV-[0-9]+$';

    RETURN 'INV-' || CASE 
        WHEN (v_max_num + 1) < 1000 THEN LPAD((v_max_num + 1)::TEXT, 3, '0')
        ELSE (v_max_num + 1)::TEXT 
    END;
END;
$$;

-- 4.5 Restorasi Hybrid RPC 5: rpc_submit_official_doc
CREATE OR REPLACE FUNCTION public.rpc_submit_official_doc(
    p_doc_type TEXT,
    p_payload  JSONB,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_prefix TEXT;
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_month TEXT := to_char(CURRENT_DATE, 'MM');
    v_seq INT;
    v_nomor TEXT;
    v_doc_id UUID;
BEGIN
    IF (public.has_capability('documents.request') IS NOT TRUE) AND (public.has_capability('documents.generate') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: documents capability required';
    END IF;

    IF p_doc_type = 'tugas' THEN
        v_prefix := 'ST';
        PERFORM pg_advisory_xact_lock(1002);
        SELECT count(*) + 1 INTO v_seq FROM public.ptv_surat_tugas WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || CASE WHEN v_seq < 1000 THEN LPAD(v_seq::TEXT, 3, '0') ELSE v_seq::TEXT END;
        INSERT INTO public.ptv_surat_tugas (nomor_surat, perihal, tanggal_tugas, kru_terlibat, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'perihal', (p_payload ->> 'tanggal_tugas')::DATE, COALESCE(p_payload -> 'kru_terlibat', '[]'::jsonb), p_actor_id)
        RETURNING id INTO v_doc_id;
    ELSIF p_doc_type = 'izin' THEN
        v_prefix := 'SI';
        PERFORM pg_advisory_xact_lock(1003);
        SELECT count(*) + 1 INTO v_seq FROM public.ptv_surat_izin WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || CASE WHEN v_seq < 1000 THEN LPAD(v_seq::TEXT, 3, '0') ELSE v_seq::TEXT END;
        INSERT INTO public.ptv_surat_izin (nomor_surat, nama_pemohon, alasan, tanggal_mulai, tanggal_selesai, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'nama_pemohon', p_payload ->> 'alasan', (p_payload ->> 'tanggal_mulai')::DATE, (p_payload ->> 'tanggal_selesai')::DATE, p_actor_id)
        RETURNING id INTO v_doc_id;
    ELSIF p_doc_type = 'barang' THEN
        v_prefix := 'SBB';
        PERFORM pg_advisory_xact_lock(1004);
        SELECT count(*) + 1 INTO v_seq FROM public.ptv_surat_barang WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || CASE WHEN v_seq < 1000 THEN LPAD(v_seq::TEXT, 3, '0') ELSE v_seq::TEXT END;
        INSERT INTO public.ptv_surat_barang (nomor_surat, nama_pembawa, tujuan_lokasi, daftar_barang, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'nama_pembawa', p_payload ->> 'tujuan_lokasi', COALESCE(p_payload -> 'daftar_barang', '[]'::jsonb), p_actor_id)
        RETURNING id INTO v_doc_id;
    ELSE
        RAISE EXCEPTION 'INVALID_DOC_TYPE: Unsupported doc type %', p_doc_type;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'nomor_surat', v_nomor,
        'doc_id', v_doc_id
    );
END;
$$;

-- 4.6 Pembatasan Hak Akses Aman (Strict Lockdown Re-enforcement)
REVOKE ALL ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_submit_official_doc(TEXT, JSONB, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submit_official_doc(TEXT, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_return_loan(TEXT, DATE, TEXT, TEXT, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_return_loan(TEXT, DATE, TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_return_single_unit(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_return_single_unit(UUID, UUID, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_get_next_inv_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

```sql
-- ============================================================================
-- OPTION A: STRICT LITERAL BASELINE REVERT DDL
-- (Gunakan HANYA jika ingin kembali 100% persis ke PTV-PRO-DATABASE-MIGRATION-REVISED.sql)
-- PERINGATAN: Parameter p_actor_id kembali WAJIB (tanpa DEFAULT), search_path = public, auth,
-- dan bug overflow nomor inventaris/surat kembali aktif.
-- ============================================================================

BEGIN;

-- 1. Restore rpc_checkout_loan persis baseline
CREATE OR REPLACE FUNCTION public.rpc_checkout_loan(
    p_transaction_id TEXT,
    p_borrower_name  TEXT,
    p_purpose        TEXT,
    p_out_date       DATE,
    p_due_date       DATE,
    p_event_name     TEXT,
    p_unit_ids       UUID[],
    p_actor_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_unit_id UUID;
    v_count INT := 0;
BEGIN
    IF NOT public.has_capability('loans.checkout') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.checkout capability required';
    END IF;

    PERFORM id FROM ptv_inventaris_unit 
    WHERE id = ANY(p_unit_ids) AND status_peminjaman = 'tersedia' 
    FOR UPDATE;

    IF (SELECT count(*) FROM ptv_inventaris_unit WHERE id = ANY(p_unit_ids) AND status_peminjaman = 'tersedia') != array_length(p_unit_ids, 1) THEN
        RAISE EXCEPTION 'UNIT_NOT_AVAILABLE: One or more selected units are already loaned or missing';
    END IF;

    FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
        INSERT INTO ptv_peminjaman (
            transaction_id, unit_id, peminjam_nama, keperluan, 
            tanggal_pinjam, tenggat_kembali, status, actor_id
        ) VALUES (
            p_transaction_id, v_unit_id, p_borrower_name, p_purpose,
            p_out_date, p_due_date, 'dipinjam', p_actor_id
        );

        UPDATE ptv_inventaris_unit 
        SET status_peminjaman = 'dipinjam', updated_at = now()
        WHERE id = v_unit_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'items_count', v_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) TO authenticated, service_role;

-- 2. Restore rpc_return_loan persis baseline
CREATE OR REPLACE FUNCTION public.rpc_return_loan(
    p_transaction_id   TEXT,
    p_back_date        DATE,
    p_condition_status TEXT,
    p_notes            TEXT,
    p_actor_id         UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_unit_ids UUID[];
BEGIN
    IF NOT public.has_capability('loans.return') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required';
    END IF;

    SELECT array_agg(unit_id) INTO v_unit_ids
    FROM ptv_peminjaman
    WHERE transaction_id = p_transaction_id AND status = 'dipinjam';

    IF v_unit_ids IS NULL OR array_length(v_unit_ids, 1) = 0 THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: No active loans found for transaction %', p_transaction_id;
    END IF;

    UPDATE ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = p_back_date,
        kondisi_kembali = p_condition_status,
        catatan = COALESCE(catatan, '') || ' | ' || COALESCE(p_notes, '')
    WHERE transaction_id = p_transaction_id AND status = 'dipinjam';

    UPDATE ptv_inventaris_unit
    SET status_peminjaman = 'tersedia',
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = ANY(v_unit_ids);

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'returned_units', array_length(v_unit_ids, 1)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_return_loan(TEXT, DATE, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_return_loan(TEXT, DATE, TEXT, TEXT, UUID) TO authenticated, service_role;

-- 3. Restore rpc_return_single_unit persis baseline
CREATE OR REPLACE FUNCTION public.rpc_return_single_unit(
    p_loan_row_id      UUID,
    p_unit_id          UUID,
    p_condition_status TEXT,
    p_actor_id         UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.has_capability('loans.return') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: loans.return capability required';
    END IF;

    UPDATE ptv_peminjaman
    SET status = 'dikembalikan',
        tanggal_kembali = CURRENT_DATE,
        kondisi_kembali = p_condition_status
    WHERE id = p_loan_row_id AND unit_id = p_unit_id;

    UPDATE ptv_inventaris_unit
    SET status_peminjaman = 'tersedia',
        kondisi = p_condition_status,
        updated_at = now()
    WHERE id = p_unit_id;

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_row_id,
        'unit_id', p_unit_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_return_single_unit(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_return_single_unit(UUID, UUID, TEXT, UUID) TO authenticated, service_role;

-- 4. Restore rpc_get_next_inv_code persis baseline
CREATE OR REPLACE FUNCTION public.rpc_get_next_inv_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_max_num INT;
BEGIN
    PERFORM pg_advisory_xact_lock(1001);

    SELECT COALESCE(MAX(NULLIF(regexp_replace(kode, '\D', '', 'g'), '')::INT), 0)
    INTO v_max_num
    FROM ptv_inventaris;

    RETURN 'INV-' || LPAD((v_max_num + 1)::TEXT, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_next_inv_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated, service_role;

-- 5. Restore rpc_submit_official_doc persis baseline
CREATE OR REPLACE FUNCTION public.rpc_submit_official_doc(
    p_doc_type TEXT,
    p_payload  JSONB,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_prefix TEXT;
    v_lock_id BIGINT;
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_month TEXT := to_char(CURRENT_DATE, 'MM');
    v_seq INT;
    v_nomor TEXT;
    v_doc_id UUID;
BEGIN
    IF NOT public.has_capability('documents.request') AND NOT public.has_capability('documents.generate') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: documents capability required';
    END IF;

    IF p_doc_type = 'tugas' THEN
        v_prefix := 'ST'; v_lock_id := 1002;
    ELSIF p_doc_type = 'izin' THEN
        v_prefix := 'SI'; v_lock_id := 1003;
    ELSIF p_doc_type = 'barang' THEN
        v_prefix := 'SBB'; v_lock_id := 1004;
    ELSE
        RAISE EXCEPTION 'INVALID_DOC_TYPE: %', p_doc_type;
    END IF;

    PERFORM pg_advisory_xact_lock(v_lock_id);

    IF p_doc_type = 'tugas' THEN
        SELECT count(*) + 1 INTO v_seq FROM ptv_surat_tugas WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 3, '0');
        INSERT INTO ptv_surat_tugas (nomor_surat, perihal, tanggal_tugas, kru_terlibat, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'perihal', (p_payload ->> 'tanggal_tugas')::DATE, p_payload -> 'kru_terlibat', p_actor_id)
        RETURNING id INTO v_doc_id;
    ELSIF p_doc_type = 'izin' THEN
        SELECT count(*) + 1 INTO v_seq FROM ptv_surat_izin WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 3, '0');
        INSERT INTO ptv_surat_izin (nomor_surat, nama_pemohon, alasan, tanggal_mulai, tanggal_selesai, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'nama_pemohon', p_payload ->> 'alasan', (p_payload ->> 'tanggal_mulai')::DATE, (p_payload ->> 'tanggal_selesai')::DATE, p_actor_id)
        RETURNING id INTO v_doc_id;
    ELSE
        SELECT count(*) + 1 INTO v_seq FROM ptv_surat_barang WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
        v_nomor := v_prefix || '-PTV/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 3, '0');
        INSERT INTO ptv_surat_barang (nomor_surat, nama_pembawa, tujuan_lokasi, daftar_barang, disetujui_oleh)
        VALUES (v_nomor, p_payload ->> 'nama_pembawa', p_payload ->> 'tujuan_lokasi', p_payload -> 'daftar_barang', p_actor_id)
        RETURNING id INTO v_doc_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'nomor_surat', v_nomor,
        'doc_id', v_doc_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_official_doc(TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_submit_official_doc(TEXT, JSONB, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

