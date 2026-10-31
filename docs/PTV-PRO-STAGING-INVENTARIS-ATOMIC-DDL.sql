-- ============================================================================
-- PTV PRO SUPER APP — INVENTARIS ATOMIC MUTATION & STORAGE DDL
-- ============================================================================
-- 
-- Target Database: Supabase Staging PostgreSQL (swadgljnyelsjstqqxbm.supabase.co)
-- Author: PTV Core Architecture
-- Date: 13 Oktober 2026
-- Purpose:
-- 1. Menyediakan stored procedure atomik rpc_create_inventaris() untuk
--    menyimpan master alat dan seluruh unit fisiknya dalam 1 transaksi database tunggal.
-- 2. Memastikan nomor inventaris aman dari race condition menggunakan advisory lock.
-- 3. Mengatur RLS policy INSERT pada ptv_inventaris & ptv_inventaris_unit untuk role authenticated.
-- 4. Menyiapkan storage bucket "inventory" dan policy akses publik/authenticated.
-- 
-- ATURAN OPERASIONAL:
-- - Tidak dijalankan secara otomatis pada sesi frontend.
-- - Siap direview dan dieksekusi oleh DBA / administrator Supabase staging.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. SCHEMA HARDENING: Kolom Kepemilikan & Hash Payload Idempotensi
-- ----------------------------------------------------------------------------

ALTER TABLE public.ptv_inventaris 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS request_payload_hash TEXT;

ALTER TABLE public.ptv_inventaris_unit
    ADD COLUMN IF NOT EXISTS nama_unit VARCHAR(128) NULL;

-- Ensure unique constraint on ptv_nilai_inventaris(inventaris_id) for upsert compatibility
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.ptv_nilai_inventaris'::regclass 
          AND contype = 'u' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ptv_nilai_inventaris'::regclass AND attname = 'inventaris_id')]
    ) THEN
        ALTER TABLE public.ptv_nilai_inventaris ADD CONSTRAINT uq_ptv_nilai_inventaris_id UNIQUE (inventaris_id);
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $;

-- ----------------------------------------------------------------------------
-- 1. STORED PROCEDURE: public.rpc_create_inventaris
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_create_inventaris(
    p_master JSONB,
    p_units  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_caller_auth_id UUID;
    v_client_id UUID;
    v_new_inv_id UUID;
    v_kode VARCHAR(32);
    v_nama_alat VARCHAR(255);
    v_kategori VARCHAR(64);
    v_unit RECORD;
    v_units_count INT := 0;
    v_result JSONB;
    v_calculated_payload_hash TEXT;
    v_existing_created_by UUID;
    v_existing_payload_hash TEXT;
    v_existing_kode VARCHAR(32);
    v_existing_nama VARCHAR(255);
    v_existing_kategori VARCHAR(64);
BEGIN
    -- 1. Identifikasi Sesi Pemanggil & Pemeriksaan Hak Akses (Fail-Closed 3VL)
    v_caller_auth_id := auth.uid();

    IF (auth.jwt() ->> 'role') = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        NULL; -- Service role bypasses capability check
    ELSIF v_caller_auth_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required'
            USING ERRCODE = '28000';
    ELSIF (public.has_capability('inventory.create') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: kapabilitas inventory.create diperlukan untuk menambah alat baru'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Advisory Lock di Awal Operasi: Menjamin serialisasi operasi konkurensi
    -- Mencegah duplikasi atau race condition saat dua pengajuan dengan request ID sama tiba bersamaan
    PERFORM pg_advisory_xact_lock(1001);

    -- 3. Validasi Format Client UUID (RFC 4122)
    IF (p_master ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_client_id := (p_master ->> 'id')::UUID;
    ELSE
        v_client_id := NULL;
    END IF;

    -- Normalisasi parameter master alat
    v_kode := UPPER(TRIM(COALESCE(p_master ->> 'kode', '')));
    v_nama_alat := TRIM(COALESCE(p_master ->> 'nama_alat', ''));
    v_kategori := TRIM(COALESCE(p_master ->> 'kategori', 'Lainnya'));

    IF v_nama_alat IS NULL OR v_nama_alat = '' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Nama alat tidak boleh kosong'
            USING ERRCODE = '22023';
    END IF;

    -- Hitung deterministic payload hash dari master (tanpa id/request_id) dan units
    -- JSONB secara otomatis mengurutkan keys sehingga menghasilkan representasi teks yang stabil
    v_calculated_payload_hash := md5(
        (p_master - 'id' - 'request_id')::text || '::' || COALESCE(p_units::text, '[]')
    );

    -- 4. Pemeriksaan Idempotensi: Jika master record dengan UUID ini sudah ada di database
    IF v_client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.ptv_inventaris WHERE id = v_client_id) THEN
        SELECT 
            created_by,
            request_payload_hash,
            kode,
            nama_alat,
            kategori
        INTO 
            v_existing_created_by,
            v_existing_payload_hash,
            v_existing_kode,
            v_existing_nama,
            v_existing_kategori
        FROM public.ptv_inventaris
        WHERE id = v_client_id;

        -- A. Validasi Kepemilikan Operasi (Ownership Verification):
        -- Hanya pemilik operasi asli (auth.uid() yang sama) atau service_role yang berhak menerima replay
        IF v_caller_auth_id IS NOT NULL 
           AND v_existing_created_by IS NOT NULL 
           AND v_existing_created_by <> v_caller_auth_id 
           AND (auth.jwt() ->> 'role') <> 'service_role' THEN
            RAISE EXCEPTION 'FORBIDDEN: Request ID % terdaftar atas kepemilikan akun lain', v_client_id
                USING ERRCODE = '42501';
        END IF;

        -- B. Validasi Kesesuaian Payload (Anti-Payload-Mismatch):
        -- Request ID sama dengan payload berbeda DILARANG diam-diam dianggap berhasil!
        IF v_existing_payload_hash IS NOT NULL AND v_existing_payload_hash <> v_calculated_payload_hash THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Request ID "%" telah digunakan sebelumnya dengan payload data alat yang berbeda', v_client_id
                USING ERRCODE = '23505';
        ELSIF (v_existing_nama <> v_nama_alat OR v_existing_kategori <> v_kategori) THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Request ID "%" telah digunakan sebelumnya dengan data berbeda (nama: "%", kategori: "%")', 
                v_client_id, v_existing_nama, v_existing_kategori
                USING ERRCODE = '23505';
        END IF;

        -- C. Return Record Idempoten yang Aman
        SELECT jsonb_build_object(
            'id', id,
            'kode', kode,
            'nama_alat', nama_alat,
            'kategori', kategori,
            'total_unit', (SELECT count(*)::INT FROM public.ptv_inventaris_unit WHERE inventaris_id = v_client_id),
            'status', 'success',
            'idempotent_replay', true
        ) INTO v_result
        FROM public.ptv_inventaris
        WHERE id = v_client_id;

        RETURN v_result;
    END IF;

    -- 5. Alokasi Kode Otomatis di Dalam Transaksi (jika kode kosong atau 'AUTO')
    IF v_kode = '' OR v_kode = 'AUTO' THEN
        DECLARE
            v_max_num BIGINT;
        BEGIN
            SELECT COALESCE(MAX(NULLIF(substring(kode from '^INV-([0-9]+)$'), '')::BIGINT), 0)
            INTO v_max_num
            FROM public.ptv_inventaris
            WHERE kode ~ '^INV-[0-9]+$';

            v_kode := 'INV-' || CASE 
                WHEN (v_max_num + 1) < 1000 THEN LPAD((v_max_num + 1)::TEXT, 3, '0')
                ELSE (v_max_num + 1)::TEXT 
            END;
        END;
    END IF;

    -- 6. Pengecekan Duplikasi Kode Unik
    IF EXISTS (SELECT 1 FROM public.ptv_inventaris WHERE kode = v_kode) THEN
        RAISE EXCEPTION 'DUPLICATE_CODE: Kode inventaris "%" sudah terdaftar di database', v_kode
            USING ERRCODE = '23505';
    END IF;

    -- Tentukan ID master (gunakan ID idempotency dari klien jika valid, atau buat baru)
    v_new_inv_id := COALESCE(v_client_id, gen_random_uuid());

    -- 7. Insert Master Record ke ptv_inventaris
    INSERT INTO public.ptv_inventaris (
        id,
        kode,
        nama_alat,
        kategori,
        spesifikasi,
        foto_url,
        harga_beli,
        sumber_perolehan,
        created_by,
        request_payload_hash,
        created_at,
        updated_at
    ) VALUES (
        v_new_inv_id,
        v_kode,
        v_nama_alat,
        v_kategori,
        NULLIF(TRIM(p_master ->> 'spesifikasi'), ''),
        NULLIF(TRIM(p_master ->> 'foto_url'), ''),
        NULL, -- harga_beli SELALU NULL di ptv_inventaris untuk mencegah kebocoran data dan double-write
        COALESCE(NULLIF(TRIM(p_master ->> 'sumber_perolehan'), ''), 'Yayasan'),
        v_caller_auth_id,
        v_calculated_payload_hash,
        now(),
        now()
    );

    -- Sinkronisasi Valuasi: Jika harga_beli diberikan, catat ke ptv_nilai_inventaris (terisolasi RLS)
    IF NULLIF(p_master ->> 'harga_beli', '')::NUMERIC IS NOT NULL AND NULLIF(p_master ->> 'harga_beli', '')::NUMERIC > 0 THEN
        INSERT INTO public.ptv_nilai_inventaris (
            inventaris_id,
            nilai_perolehan,
            nilai_buku_saat_ini,
            tanggal_valuasi,
            catatan_akuntansi,
            updated_at
        ) VALUES (
            v_new_inv_id,
            NULLIF(p_master ->> 'harga_beli', '')::NUMERIC,
            NULLIF(p_master ->> 'harga_beli', '')::NUMERIC,
            CURRENT_DATE,
            'Tercatat otomatis saat pendaftaran master alat',
            now()
        )
        ON CONFLICT (inventaris_id) DO UPDATE SET
            nilai_perolehan = EXCLUDED.nilai_perolehan,
            nilai_buku_saat_ini = EXCLUDED.nilai_buku_saat_ini,
            updated_at = now();
    END IF;

    -- 8. Insert Seluruh Unit Fisik dari Array JSON p_units
    IF p_units IS NOT NULL AND jsonb_array_length(p_units) > 0 THEN
        FOR v_unit IN SELECT * FROM jsonb_to_recordset(p_units) AS (
            kode_unit VARCHAR(64),
            nomor_seri VARCHAR(128),
            kondisi VARCHAR(32),
            status_peminjaman VARCHAR(32),
            lokasi_penyimpanan VARCHAR(128)
        )
        LOOP
            v_units_count := v_units_count + 1;
            INSERT INTO public.ptv_inventaris_unit (
                inventaris_id,
                kode_unit,
                nomor_seri,
                kondisi,
                status_peminjaman,
                lokasi_penyimpanan,
                created_at,
                updated_at
            ) VALUES (
                v_new_inv_id,
                COALESCE(NULLIF(UPPER(TRIM(v_unit.kode_unit)), ''), v_kode || '-U' || LPAD(v_units_count::TEXT, 2, '0')),
                NULLIF(TRIM(v_unit.nomor_seri), ''),
                COALESCE(NULLIF(TRIM(v_unit.kondisi), ''), 'bagus'),
                COALESCE(NULLIF(TRIM(v_unit.status_peminjaman), ''), 'tersedia'),
                COALESCE(NULLIF(TRIM(v_unit.lokasi_penyimpanan), ''), 'Studio PTV'),
                now(),
                now()
            );
        END LOOP;
    ELSE
        -- Default: buat minimal 1 unit fisik jika payload kosong
        INSERT INTO public.ptv_inventaris_unit (
            inventaris_id,
            kode_unit,
            nomor_seri,
            kondisi,
            status_peminjaman,
            lokasi_penyimpanan,
            created_at,
            updated_at
        ) VALUES (
            v_new_inv_id,
            v_kode || '-U01',
            NULL,
            'bagus',
            'tersedia',
            'Studio PTV',
            now(),
            now()
        );
        v_units_count := 1;
    END IF;

    -- 9. Bentuk Respon JSONB
    SELECT jsonb_build_object(
        'id', v_new_inv_id,
        'kode', v_kode,
        'nama_alat', v_nama_alat,
        'kategori', v_kategori,
        'total_unit', v_units_count,
        'status', 'success'
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Izin Eksekusi Fungsi RPC
REVOKE ALL ON FUNCTION public.rpc_create_inventaris(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_inventaris(JSONB, JSONB) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) POLICIES FOR INVENTARIS
-- ----------------------------------------------------------------------------

ALTER TABLE public.ptv_inventaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_inventaris_unit ENABLE ROW LEVEL SECURITY;

-- Policy SELECT (Semua kru dan pengguna internal dapat membaca katalog inventaris)
DROP POLICY IF EXISTS "inventaris_select_policy" ON public.ptv_inventaris;
CREATE POLICY "inventaris_select_policy" ON public.ptv_inventaris
    FOR SELECT TO authenticated
    USING (public.has_capability('inventory.view') IS TRUE);

DROP POLICY IF EXISTS "inventaris_unit_select_policy" ON public.ptv_inventaris_unit;
CREATE POLICY "inventaris_unit_select_policy" ON public.ptv_inventaris_unit
    FOR SELECT TO authenticated
    USING (public.has_capability('inventory.view') IS TRUE);

-- Policy INSERT (Hanya pengguna dengan kapabilitas inventory.create)
DROP POLICY IF EXISTS "inventaris_insert_policy" ON public.ptv_inventaris;
CREATE POLICY "inventaris_insert_policy" ON public.ptv_inventaris
    FOR INSERT TO authenticated
    WITH CHECK (public.has_capability('inventory.create') IS TRUE);

DROP POLICY IF EXISTS "inventaris_unit_insert_policy" ON public.ptv_inventaris_unit;
CREATE POLICY "inventaris_unit_insert_policy" ON public.ptv_inventaris_unit
    FOR INSERT TO authenticated
    WITH CHECK (public.has_capability('inventory.create') IS TRUE);

-- Policy UPDATE (Pengguna dengan kapabilitas inventory.edit atau inventory.units.manage)
DROP POLICY IF EXISTS "inventaris_update_policy" ON public.ptv_inventaris;
CREATE POLICY "inventaris_update_policy" ON public.ptv_inventaris
    FOR UPDATE TO authenticated
    USING (public.has_capability('inventory.edit') IS TRUE);

DROP POLICY IF EXISTS "inventaris_unit_update_policy" ON public.ptv_inventaris_unit;
CREATE POLICY "inventaris_unit_update_policy" ON public.ptv_inventaris_unit
    FOR UPDATE TO authenticated
    USING (
        public.has_capability('inventory.edit') IS TRUE OR
        public.has_capability('inventory.units.manage') IS TRUE
    );

-- Policy DELETE (Hanya peran pengelola dengan kapabilitas inventory.delete)
DROP POLICY IF EXISTS "inventaris_delete_policy" ON public.ptv_inventaris;
CREATE POLICY "inventaris_delete_policy" ON public.ptv_inventaris
    FOR DELETE TO authenticated
    USING (public.has_capability('inventory.delete') IS TRUE);

DROP POLICY IF EXISTS "inventaris_unit_delete_policy" ON public.ptv_inventaris_unit;
CREATE POLICY "inventaris_unit_delete_policy" ON public.ptv_inventaris_unit
    FOR DELETE TO authenticated
    USING (public.has_capability('inventory.delete') IS TRUE);

-- ----------------------------------------------------------------------------
-- 3. SUPABASE STORAGE BUCKET & POLICIES ("inventory")
-- ----------------------------------------------------------------------------

-- Pembuatan bucket 'inventory' jika belum ada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inventory',
    'inventory',
    true,
    15728640, -- 15MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

-- Policy Storage: Publik dapat melihat foto katalog
DROP POLICY IF EXISTS "inventory_public_view" ON storage.objects;
CREATE POLICY "inventory_public_view" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'inventory');

-- Policy Storage: Hanya pengguna terautentikasi dengan hak inventory.create/edit yang boleh mengunggah
DROP POLICY IF EXISTS "inventory_authenticated_upload" ON storage.objects;
CREATE POLICY "inventory_authenticated_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'inventory' AND
        (public.has_capability('inventory.create') IS TRUE OR public.has_capability('inventory.edit') IS TRUE)
    );

-- Policy Storage: Penghapusan file sementara milik pengguna sendiri (cleanup orphan / upload session)
-- Dibatasi secara mutlak HANYA untuk file milik pengguna yang BELUM DIREFERENSIKAN oleh alat di ptv_inventaris.
-- Begitu alat berhasil tersimpan dan mereferensikan foto_url, foto TIDAK DAPAT dihapus oleh owner-cleanup!
DROP POLICY IF EXISTS "inventory_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "inventory_owner_cleanup" ON storage.objects;
CREATE POLICY "inventory_owner_cleanup" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'inventory' AND
        owner = auth.uid() AND
        public.has_capability('inventory.create') IS TRUE AND
        NOT EXISTS (
            SELECT 1 FROM public.ptv_inventaris pi
            WHERE pi.foto_url IS NOT NULL 
              AND pi.foto_url LIKE '%' || storage.objects.name
        )
    );

-- Policy Storage: Penghapusan foto alat tersimpan oleh pengelola inventaris berwenang
-- Dibedakan secara tegas dari hak create/edit: hanya peran dengan hak hapus/kelola penuh
DROP POLICY IF EXISTS "inventory_manager_delete" ON storage.objects;
CREATE POLICY "inventory_manager_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'inventory' AND
        (public.has_capability('inventory.delete') IS TRUE OR public.has_capability('inventory.manage') IS TRUE)
    );

-- Policy Storage: Pembaruan file foto oleh editor/manager
DROP POLICY IF EXISTS "inventory_authenticated_update" ON storage.objects;
CREATE POLICY "inventory_authenticated_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'inventory' AND
        (public.has_capability('inventory.edit') IS TRUE OR public.has_capability('inventory.manage') IS TRUE)
    );

-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 4. VALUATION ISOLATION TRIGGER (Quarantine harga_beli from ptv_inventaris)
-- ----------------------------------------------------------------------------
-- Desain Bersih: Mencegah harga_beli disimpan pada tabel katalog master ptv_inventaris.
-- Menghilangkan kelemahan AFTER INSERT (dead tuples / update-back pada baris yang sudah tersimpan).
-- Seluruh valuasi aset resmi dikelola secara atomik oleh rpc_create_inventaris ke ptv_nilai_inventaris.

CREATE OR REPLACE FUNCTION public.fn_sanitize_inventaris_harga_beli()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
    -- Menjamin kolom harga_beli pada katalog master ptv_inventaris SELALU NULL sebelum ditulis ke heap disk.
    -- Ini mencegah kebocoran valuasi ke katalog operasional dan meniadakan dead tuples self-update.
    IF NEW.harga_beli IS NOT NULL THEN
        NEW.harga_beli := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_isolate_inventaris_valuation ON public.ptv_inventaris;
DROP TRIGGER IF EXISTS trg_sanitize_inventaris_harga_beli ON public.ptv_inventaris;

CREATE TRIGGER trg_sanitize_inventaris_harga_beli
    BEFORE INSERT OR UPDATE OF harga_beli ON public.ptv_inventaris
    FOR EACH ROW
    WHEN (NEW.harga_beli IS NOT NULL)
    EXECUTE FUNCTION public.fn_sanitize_inventaris_harga_beli();

COMMIT;

