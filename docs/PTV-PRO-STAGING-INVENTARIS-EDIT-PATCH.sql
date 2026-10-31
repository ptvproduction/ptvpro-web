-- ============================================================================
-- PTV PRO STAGING INVENTARIS EDIT PATCH
-- File: docs/PTV-PRO-STAGING-INVENTARIS-EDIT-PATCH.sql
-- Target: Supabase Cloud Staging (swadgljnyelsjstqqxbm)
-- ============================================================================
-- Ringkasan:
-- 1. Penambahan kolom resmi 'nama_unit' pada tabel public.ptv_inventaris_unit
-- 2. Function RPC atomik 'rpc_update_inventaris' untuk edit data master & unit fisik
-- 3. Proteksi otorisasi RBAC (inventory.edit & inventory.units.manage)
-- 4. Proteksi integritas relasi (anti-cross-asset mutation)
-- 5. Proteksi pemisahan kondisi fisik dari status peminjaman
-- ============================================================================

BEGIN;

-- 1. Penambahan Kolom nama_unit pada ptv_inventaris_unit
ALTER TABLE public.ptv_inventaris_unit 
ADD COLUMN IF NOT EXISTS nama_unit VARCHAR(128) NULL;

-- 2. Function Atomik Tunggal: rpc_update_inventaris
CREATE OR REPLACE FUNCTION public.rpc_update_inventaris(
    p_master JSONB,
    p_units JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_caller_auth_id UUID;
    v_master_id UUID;
    v_existing_master RECORD;
    v_nama_alat VARCHAR(255);
    v_kategori VARCHAR(64);
    v_spesifikasi TEXT;
    v_sumber_perolehan VARCHAR(128);
    v_lokasi_default VARCHAR(128);
    v_foto_url TEXT;
    v_expected_updated_at TIMESTAMPTZ;
    v_unit JSONB;
    v_unit_id UUID;
    v_unit_nama VARCHAR(128);
    v_unit_sn VARCHAR(128);
    v_unit_kondisi VARCHAR(32);
    v_unit_lokasi VARCHAR(128);
    v_unit_belongs_to_master BOOLEAN;
    v_result JSONB;
BEGIN
    -- 1. Identifikasi Sesi Pemanggil & Verifikasi Otorisasi (Fail-Closed)
    v_caller_auth_id := auth.uid();

    IF (auth.jwt() ->> 'role') = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        NULL; -- Service role bypasses capability check
    ELSIF (public.has_capability('inventory.edit') IS NOT TRUE) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: kapabilitas inventory.edit diperlukan untuk mengedit data alat'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Validasi Master ID
    IF (p_master ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_master_id := (p_master ->> 'id')::UUID;
    ELSE
        RAISE EXCEPTION 'VALIDATION_ERROR: ID master inventaris wajib berupa UUID valid'
            USING ERRCODE = '22023';
    END IF;

    -- 3. Row-level Lock pada Master Record
    SELECT * INTO v_existing_master
    FROM public.ptv_inventaris
    WHERE id = v_master_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Alat inventaris dengan ID % tidak ditemukan', v_master_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 4. Optimistic Concurrency Check (jika expected_updated_at dikirim klien)
    IF (p_master ? 'expected_updated_at') AND (p_master ->> 'expected_updated_at') IS NOT NULL THEN
        BEGIN
            v_expected_updated_at := (p_master ->> 'expected_updated_at')::TIMESTAMPTZ;
            -- Toleransi selisih mikrodetik pembulatan client/server (500ms)
            IF v_existing_master.updated_at > (v_expected_updated_at + INTERVAL '500 milliseconds') THEN
                RAISE EXCEPTION 'CONCURRENCY_CONFLICT: Data alat telah diubah oleh pengguna lain. Silakan muat ulang halaman sebelum menyimpan perubahan.'
                    USING ERRCODE = '40001';
            END IF;
        EXCEPTION WHEN invalid_datetime_format THEN
            NULL; -- Format tanggal tidak valid diabaikan, lanjutkan simpan
        END;
    END IF;

    -- 5. Normalisasi Parameter Master
    v_nama_alat := TRIM(COALESCE(p_master ->> 'nama_alat', ''));
    v_kategori := TRIM(COALESCE(p_master ->> 'kategori', ''));
    v_spesifikasi := NULLIF(TRIM(COALESCE(p_master ->> 'spesifikasi', '')), '');
    v_sumber_perolehan := NULLIF(TRIM(COALESCE(p_master ->> 'sumber_perolehan', '')), '');
    v_lokasi_default := NULLIF(TRIM(COALESCE(p_master ->> 'lokasi_penyimpanan', '')), '');
    
    -- Foto: Jika key 'foto_url' ada di payload (meskipun null/empty), gunakan nilainya; jika tidak ada di JSON, pertahankan foto_url lama
    IF (p_master ? 'foto_url') THEN
        v_foto_url := NULLIF(TRIM(COALESCE(p_master ->> 'foto_url', '')), '');
    ELSE
        v_foto_url := v_existing_master.foto_url;
    END IF;

    IF v_nama_alat IS NULL OR v_nama_alat = '' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Nama alat tidak boleh kosong'
            USING ERRCODE = '22023';
    END IF;

    IF v_kategori IS NULL OR v_kategori = '' THEN
        v_kategori := v_existing_master.kategori;
    END IF;

    -- 6. Update Master Alat (KODE, ID, CREATED_BY TIDAK BOLEH BERUBAH)
    UPDATE public.ptv_inventaris
    SET
        nama_alat = v_nama_alat,
        kategori = v_kategori,
        spesifikasi = v_spesifikasi,
        sumber_perolehan = COALESCE(v_sumber_perolehan, v_existing_master.sumber_perolehan),
        foto_url = v_foto_url,
        updated_at = now()
    WHERE id = v_master_id;

    -- 7. Update Unit-Unit Fisik (Jika disediakan)
    IF p_units IS NOT NULL AND jsonb_typeof(p_units) = 'array' AND jsonb_array_length(p_units) > 0 THEN
        -- Verifikasi kapabilitas pengelolaan unit fisik
        IF (auth.jwt() ->> 'role') <> 'service_role' 
           AND current_setting('request.jwt.claim.role', true) <> 'service_role'
           AND (public.has_capability('inventory.units.manage') IS NOT TRUE AND public.has_capability('inventory.edit') IS NOT TRUE) THEN
            RAISE EXCEPTION 'UNAUTHORIZED: kapabilitas inventory.units.manage diperlukan untuk memperbarui rincian unit'
                USING ERRCODE = '42501';
        END IF;

        FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
        LOOP
            -- Validasi Unit ID format UUID
            IF NOT ((v_unit ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
                RAISE EXCEPTION 'VALIDATION_ERROR: ID unit fisik wajib berupa UUID valid'
                    USING ERRCODE = '22023';
            END IF;
            v_unit_id := (v_unit ->> 'id')::UUID;

            -- ANTI-CROSS-ASSET MUTATION: Pastikan unit memang milik master inventaris ini
            SELECT EXISTS (
                SELECT 1 FROM public.ptv_inventaris_unit
                WHERE id = v_unit_id AND inventaris_id = v_master_id
            ) INTO v_unit_belongs_to_master;

            IF NOT v_unit_belongs_to_master THEN
                RAISE EXCEPTION 'CROSS_ASSET_VIOLATION: Unit fisik % bukan milik master inventaris %', v_unit_id, v_master_id
                    USING ERRCODE = '42501';
            END IF;

            v_unit_nama := NULLIF(TRIM(COALESCE(v_unit ->> 'nama_unit', '')), '');
            v_unit_sn := NULLIF(TRIM(COALESCE(v_unit ->> 'nomor_seri', '')), '');
            v_unit_kondisi := LOWER(TRIM(COALESCE(v_unit ->> 'kondisi', 'bagus')));
            v_unit_lokasi := NULLIF(TRIM(COALESCE(v_unit ->> 'lokasi_penyimpanan', '')), '');

            -- Normalisasi kondisi valid
            IF v_unit_kondisi NOT IN ('bagus', 'rusak', 'perlu_servis') THEN
                v_unit_kondisi := 'bagus';
            END IF;

            -- UPDATE UNIT: HANYA ubah nama_unit, nomor_seri, kondisi, dan lokasi.
            -- PENTING: status_peminjaman TIDAK DISENTUH agar unit yang sedang dipinjam
            -- tidak berubah menjadi tersedia secara keliru!
            UPDATE public.ptv_inventaris_unit
            SET
                nama_unit = v_unit_nama,
                nomor_seri = v_unit_sn,
                kondisi = v_unit_kondisi,
                lokasi_penyimpanan = COALESCE(v_unit_lokasi, v_lokasi_default, lokasi_penyimpanan),
                updated_at = now()
            WHERE id = v_unit_id AND inventaris_id = v_master_id;
        END LOOP;
    END IF;

    -- 8. Return JSON Master Terbaru
    SELECT jsonb_build_object(
        'id', id,
        'kode', kode,
        'nama_alat', nama_alat,
        'kategori', kategori,
        'spesifikasi', spesifikasi,
        'foto_url', foto_url,
        'sumber_perolehan', sumber_perolehan,
        'updated_at', updated_at
    ) INTO v_result
    FROM public.ptv_inventaris
    WHERE id = v_master_id;

    RETURN v_result;
END;
$$;

-- 3. Hak Eksekusi Fungsi rpc_update_inventaris
REVOKE ALL ON FUNCTION public.rpc_update_inventaris(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_inventaris(JSONB, JSONB) TO authenticated, service_role;

COMMIT;
