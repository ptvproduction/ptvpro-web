-- ============================================================================
-- PTVPRO — SMART NOTIFICATIONS PERSISTENCE & RLS HARDENING PROPOSAL (REV 9)
-- Workspace: PTVPRO / PTV HUB
-- Environment: Supabase Staging (swadgljnyelsjstqqxbm) & Production
-- Status: DRAFT / PENDING OPERATOR ACC (DO NOT EXECUTE WITHOUT OPERATOR ACC)
-- URUTAN MIGRASI: STEP 1 (WAJIB DIJALANKAN PERTAMA SEBELUM NUMBERING PROPOSAL)
-- ============================================================================
--
-- 1. LATAR BELAKANG & AUDIT KEAMANAN (RELEASE-GATE FINAL CORRECTIONS REV 9)
--    a. Dependensi Migrasi: File ini adalah STEP 1. Kolom baru pada ptv_notifications
--       (recipient_identity_id, is_protected, idempotency_key) wajib ditambahkan
--       sebelum prosedur approval dokumen dapat menerbitkan notifikasi.
--    b. Pembatasan Ketat INSERT Policy (Eliminasi Seluruh Celah Permisif):
--       - Kondisi permisif tipe = 'approval' dan actor_identity_id DIHAPUS TOTAL.
--       - Direct INSERT bagi anon dan authenticated DICABUT MUTLAK pada level tabel grant.
--       - Policy INSERT HANYA mengizinkan context terpercaya: auth.role() = 'service_role'
--         atau procedure owner PostgreSQL (current_user = 'postgres' / session_user = 'postgres').
--       - Tabel ptv_notifications TIDAK mengaktifkan FORCE ROW LEVEL SECURITY,
--         sehingga prosedur database SECURITY DEFINER milik postgres dapat menyisipkan
--         notifikasi secara atomik tanpa bergantung pada klaim JWT client.
--    c. Kepemilikan Fungsi (Function Owner Verification):
--       - Seluruh fungsi trigger dan RPC ditetapkan secara eksplisit berpemilik 'postgres'.
--    d. Pembersihan Dinamis RLS: Menghapus SELURUH policy yang ada di pg_policies
--       pada tabel ptv_notifications tanpa menyisakan policy permisif tak dikenal.
--    e. Pembatasan Hak Eksekusi: dispatch_smart_notification dicabut mutlak dari
--       PUBLIC, anon, dan authenticated; HANYA diberikan ke service_role.
--    f. Proteksi Anti-Tamper: Trigger trg_protect_notification_fields mengunci seluruh
--       kolom kecuali is_read untuk akun pengguna biasa.
--    g. Proteksi Hapus: DELETE hanya diizinkan untuk notifikasi milik sendiri yang TIDAK
--       berstatus terkunci (is_protected = FALSE).
--    h. Rollback Presisi (Restorable & Non-Destructive):
--       - Mencabut UPDATE dan DELETE tambahan dari authenticated jika di-rollback.
--       - Memulihkan baseline grants dan default select policy Staging tanpa merusak data.
--
-- 2. PREFLIGHT REQUIREMENT
--    - Backup tabel public.ptv_notifications sebelum menjalankan script:
--      pg_dump -h <host> -U postgres -d postgres -t public.ptv_notifications > backup_ptv_notifications_before_patch.sql
--
-- ============================================================================

BEGIN;

-- 1. TAMBAH KOLOM IDENTITAS PENERIMA & IDEMPOTENCY KEY (ADITIF & NON-DESTRUKTIF)
ALTER TABLE public.ptv_notifications
    ADD COLUMN IF NOT EXISTS recipient_identity_id UUID NULL REFERENCES public.canonical_identity(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS recipient_ptv_id VARCHAR(32) NULL,
    ADD COLUMN IF NOT EXISTS actor_identity_id UUID NULL REFERENCES public.canonical_identity(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS entity_id VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS action_url VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160) NULL,
    ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. INDEKS PERFORMA & IDEMPOTENCY UNIQUE CONSTRAINT
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptv_notifications_idempotency
    ON public.ptv_notifications (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ptv_notifications_recipient
    ON public.ptv_notifications (recipient_ptv_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ptv_notifications_identity
    ON public.ptv_notifications (recipient_identity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ptv_notifications_target_role
    ON public.ptv_notifications (target_role, created_at DESC)
    WHERE target_role IS NOT NULL;

-- 3. TRIGGER ANTI-TAMPER: HANYA IS_READ YANG DAPAT DIUBAH PENGGUNA
CREATE OR REPLACE FUNCTION public.trg_protect_notification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- service_role diizinkan penuh untuk keperluan internal backend
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Pengguna biasa DILARANG KERAS memodifikasi selain status is_read
    IF (OLD.id IS DISTINCT FROM NEW.id)
       OR (OLD.tipe IS DISTINCT FROM NEW.tipe)
       OR (OLD.judul IS DISTINCT FROM NEW.judul)
       OR (OLD.pesan IS DISTINCT FROM NEW.pesan)
       OR (OLD.target_role IS DISTINCT FROM NEW.target_role)
       OR (OLD.created_at IS DISTINCT FROM NEW.created_at)
       OR (OLD.recipient_identity_id IS DISTINCT FROM NEW.recipient_identity_id)
       OR (OLD.recipient_ptv_id IS DISTINCT FROM NEW.recipient_ptv_id)
       OR (OLD.actor_identity_id IS DISTINCT FROM NEW.actor_identity_id)
       OR (OLD.entity_type IS DISTINCT FROM NEW.entity_type)
       OR (OLD.entity_id IS DISTINCT FROM NEW.entity_id)
       OR (OLD.action_url IS DISTINCT FROM NEW.action_url)
       OR (OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key)
       OR (OLD.is_protected IS DISTINCT FROM NEW.is_protected) THEN
        RAISE EXCEPTION 'FORBIDDEN: Pengguna hanya diizinkan memperbarui status baca (is_read)'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_protect_notification_fields() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_ptv_notifications_protect_fields ON public.ptv_notifications;
CREATE TRIGGER trg_ptv_notifications_protect_fields
    BEFORE UPDATE ON public.ptv_notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_protect_notification_fields();

-- 4. KEBIJAKAN ROW LEVEL SECURITY (RLS) TINGKAT TINGGI
ALTER TABLE public.ptv_notifications ENABLE ROW LEVEL SECURITY;

-- 4.0 PEMBERSIHAN DINAMIS SELURUH POLICY LAMA DI PG_POLICIES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'ptv_notifications'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.ptv_notifications;';
    END LOOP;
END $$;

-- 4.1 SELECT POLICY: Mengutamakan identitas kanonikal penerima & akun aktif
CREATE POLICY ptv_notifications_select_policy ON public.ptv_notifications
    FOR SELECT
    USING (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 
            FROM public.user_account ua 
            WHERE ua.auth_user_id = auth.uid() 
              AND ua.status_akun = 'active'
              AND (
                  ptv_notifications.recipient_identity_id = ua.identity_id
                  OR ptv_notifications.recipient_ptv_id = (
                      SELECT ci.ptv_id 
                      FROM public.canonical_identity ci 
                      WHERE ci.id = ua.identity_id
                  )
                  OR ptv_notifications.target_role = 'all'
              )
        )
    );

-- 4.2 UPDATE POLICY: Hanya untuk menandai is_read pada notifikasi sendiri
CREATE POLICY ptv_notifications_update_policy ON public.ptv_notifications
    FOR UPDATE
    USING (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 
            FROM public.user_account ua 
            WHERE ua.auth_user_id = auth.uid() 
              AND ua.status_akun = 'active'
              AND (
                  ptv_notifications.recipient_identity_id = ua.identity_id
                  OR ptv_notifications.recipient_ptv_id = (
                      SELECT ci.ptv_id 
                      FROM public.canonical_identity ci 
                      WHERE ci.id = ua.identity_id
                  )
              )
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 
            FROM public.user_account ua 
            WHERE ua.auth_user_id = auth.uid() 
              AND ua.status_akun = 'active'
              AND (
                  ptv_notifications.recipient_identity_id = ua.identity_id
                  OR ptv_notifications.recipient_ptv_id = (
                      SELECT ci.ptv_id 
                      FROM public.canonical_identity ci 
                      WHERE ci.id = ua.identity_id
                  )
              )
        )
    );

-- 4.3 DELETE POLICY: Hanya dapat menghapus notifikasi sendiri yang TIDAK diproteksi
CREATE POLICY ptv_notifications_delete_policy ON public.ptv_notifications
    FOR DELETE
    USING (
        auth.role() = 'service_role'
        OR (
            ptv_notifications.is_protected = FALSE
            AND EXISTS (
                SELECT 1 
                FROM public.user_account ua 
                WHERE ua.auth_user_id = auth.uid() 
                  AND ua.status_akun = 'active'
                  AND (
                      ptv_notifications.recipient_identity_id = ua.identity_id
                      OR ptv_notifications.recipient_ptv_id = (
                          SELECT ci.ptv_id 
                          FROM public.canonical_identity ci 
                          WHERE ci.id = ua.identity_id
                      )
                  )
            )
        )
    );

-- 4.4 INSERT POLICY & TABLE GRANTS (HANYA BACKEND / DATABASE PRODUCER TEPERCAYA)
-- Direct client INSERT via PostgREST dicabut mutlak dari PUBLIC, anon, dan authenticated!
REVOKE INSERT ON TABLE public.ptv_notifications FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.ptv_notifications TO service_role;
GRANT SELECT, UPDATE, DELETE ON TABLE public.ptv_notifications TO authenticated;

-- Kebijakan INSERT KETAT: HANYA mengizinkan service_role atau procedure database terpercaya (current_user = 'postgres')
CREATE POLICY ptv_notifications_insert_policy ON public.ptv_notifications
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role'
        OR current_user = 'postgres'
        OR session_user = 'postgres'
    );

-- 5. TRUSTED PRODUCER RPC: AUDIT SELURUH OVERLOAD & DEFINISI TUNGGAL
-- 5.1 Cabut & Drop seluruh overload terdahulu
DROP FUNCTION IF EXISTS public.dispatch_smart_notification(VARCHAR, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN);
DROP FUNCTION IF EXISTS public.dispatch_smart_notification(VARCHAR, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS public.dispatch_smart_notification;

-- 5.2 Buat RPC kanonikal terproteksi
CREATE OR REPLACE FUNCTION public.dispatch_smart_notification(
    p_tipe VARCHAR(32),
    p_judul VARCHAR(255),
    p_pesan TEXT,
    p_recipient_identity_id UUID DEFAULT NULL,
    p_recipient_ptv_id VARCHAR(32) DEFAULT NULL,
    p_target_role VARCHAR(32) DEFAULT NULL,
    p_entity_type VARCHAR(64) DEFAULT NULL,
    p_entity_id VARCHAR(128) DEFAULT NULL,
    p_action_url VARCHAR(255) DEFAULT NULL,
    p_idempotency_key VARCHAR(160) DEFAULT NULL,
    p_is_protected BOOLEAN DEFAULT FALSE,
    p_actor_identity_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_inserted_id UUID;
    v_actor_id UUID;
BEGIN
    -- Validasi caller: Jika dipanggil dari sesi auth selain service_role, pastikan akun aktif
    IF auth.role() = 'service_role' THEN
        v_actor_id := p_actor_identity_id;
    ELSE
        SELECT ua.identity_id INTO v_actor_id
        FROM public.user_account ua
        WHERE ua.auth_user_id = auth.uid() AND ua.status_akun = 'active';

        IF v_actor_id IS NULL THEN
            RAISE EXCEPTION 'UNAUTHORIZED: Akun aktif tidak ditemukan untuk dispatch notifikasi'
                USING ERRCODE = '28000';
        END IF;
    END IF;

    -- Validasi parameter minimal
    IF p_judul IS NULL OR btrim(p_judul) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Judul notifikasi tidak boleh kosong' USING ERRCODE = '22023';
    END IF;

    -- Concurrency-Safe Idempotent Insert menggunakan ON CONFLICT DO NOTHING
    IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) != '' THEN
        INSERT INTO public.ptv_notifications (
            tipe, judul, pesan, target_role,
            recipient_identity_id, recipient_ptv_id, actor_identity_id,
            entity_type, entity_id, action_url,
            idempotency_key, is_protected, is_read, created_at
        ) VALUES (
            COALESCE(p_tipe, 'info'),
            p_judul,
            p_pesan,
            p_target_role,
            p_recipient_identity_id,
            p_recipient_ptv_id,
            v_actor_id,
            p_entity_type,
            p_entity_id,
            p_action_url,
            p_idempotency_key,
            COALESCE(p_is_protected, FALSE),
            FALSE,
            now()
        )
        ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
        RETURNING id INTO v_inserted_id;

        -- Jika insert dilewati karena record sudah ada, ambil record yang sudah ada
        IF v_inserted_id IS NULL THEN
            SELECT id INTO v_inserted_id
            FROM public.ptv_notifications
            WHERE idempotency_key = p_idempotency_key;

            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'notification_id', v_inserted_id,
                'message', 'Notifikasi dengan idempotency_key ini sudah tercatat sebelumnya'
            );
        END IF;
    ELSE
        -- Insert non-idempotent biasa
        INSERT INTO public.ptv_notifications (
            tipe, judul, pesan, target_role,
            recipient_identity_id, recipient_ptv_id, actor_identity_id,
            entity_type, entity_id, action_url,
            idempotency_key, is_protected, is_read, created_at
        ) VALUES (
            COALESCE(p_tipe, 'info'),
            p_judul,
            p_pesan,
            p_target_role,
            p_recipient_identity_id,
            p_recipient_ptv_id,
            v_actor_id,
            p_entity_type,
            p_entity_id,
            p_action_url,
            NULL,
            COALESCE(p_is_protected, FALSE),
            FALSE,
            now()
        ) RETURNING id INTO v_inserted_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'notification_id', v_inserted_id
    );
END;
$$;

ALTER FUNCTION public.dispatch_smart_notification(VARCHAR, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, UUID) OWNER TO postgres;

-- BATASAN OTORISASI MUTLAK:
-- Cabut izin pemanggilan fungsi ini dari PUBLIC, anon, dan authenticated!
-- Hanya service_role yang dapat memanggil fungsi ini secara eksternal.
REVOKE ALL ON FUNCTION public.dispatch_smart_notification(VARCHAR, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_smart_notification(VARCHAR, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, UUID) TO service_role;

-- ============================================================================
-- 6. SNAPSHOT PRE-MIGRATION & ROLLBACK PLAN LENGKAP (RESTORE TO BASELINE)
--    Snapshot konfigurasi objek sebelum Step 1 (diverifikasi via katalog PostgreSQL Staging):
--      - Tabel public.ptv_notifications: ADA (Owner: postgres, RLS Enabled).
--      - Kolom baseline asli: id, tipe, judul, pesan, target_role, is_read, created_at.
--      - Kolom baru (recipient_identity_id, is_protected, idempotency_key, dll): BELUM ADA.
--      - Trigger trg_ptv_notifications_protect_fields: BELUM ADA pada baseline Staging.
--      - Fungsi public.trg_protect_notification_fields(): BELUM ADA pada baseline Staging.
--      - Fungsi public.dispatch_smart_notification(...): BELUM ADA pada baseline Staging.
--      - Policy baseline asli: ptv_notifications_default_select (FOR SELECT TO authenticated, service_role).
--      - Grants baseline asli: SELECT untuk anon & authenticated; ALL untuk postgres & service_role.
--
--    SKRIP ROLLBACK (Jalankan blok ini jika terjadi kegagalan atau pembatalan migrasi):
--
--    -- Step R.1: Hapus Trigger & Prosedur Baru
--    DROP TRIGGER IF EXISTS trg_ptv_notifications_protect_fields ON public.ptv_notifications;
--    DROP FUNCTION IF EXISTS public.trg_protect_notification_fields();
--    DROP FUNCTION IF EXISTS public.dispatch_smart_notification(VARCHAR, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, UUID);
--
--    -- Step R.2: Hapus Policy Hasil Patch
--    DROP POLICY IF EXISTS ptv_notifications_insert_policy ON public.ptv_notifications;
--    DROP POLICY IF EXISTS ptv_notifications_delete_policy ON public.ptv_notifications;
--    DROP POLICY IF EXISTS ptv_notifications_update_policy ON public.ptv_notifications;
--    DROP POLICY IF EXISTS ptv_notifications_select_policy ON public.ptv_notifications;
--
--    -- Step R.3: Restorasi Baseline Policy Asli (Supabase Default)
--    CREATE POLICY ptv_notifications_default_select ON public.ptv_notifications
--        FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
--
--    -- Step R.4: Restorasi Grants Baseline Staging (Mencabut hak mutasi dari authenticated & memulihkan baseline)
--    REVOKE ALL ON TABLE public.ptv_notifications FROM PUBLIC, anon, authenticated;
--    GRANT SELECT ON public.ptv_notifications TO anon, authenticated;
--    GRANT ALL ON public.ptv_notifications TO postgres, service_role;
--
--    -- Step R.5: Hapus Indeks Performa Tambahan
--    DROP INDEX IF EXISTS idx_ptv_notifications_target_role;
--    DROP INDEX IF EXISTS idx_ptv_notifications_identity;
--    DROP INDEX IF EXISTS idx_ptv_notifications_recipient;
--    DROP INDEX IF EXISTS idx_ptv_notifications_idempotency;
--
--    -- Step R.6: Jaminan Integritas Data & Anti-Loss Protection:
--    -- Data notifikasi yang sudah ada beserta kolom baru TIDAK di-DROP agar tidak terjadi kehilangan data.
-- ============================================================================

COMMIT;
