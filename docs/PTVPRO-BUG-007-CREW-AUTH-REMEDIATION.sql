-- ============================================================================
-- PTVPRO — BUG-007: CREW ACCOUNT AUTHENTICATION & CREDENTIALS REMEDIATION
-- Target Database: Supabase Staging swadgljnyelsjstqqxbm
-- Executable via Supabase SQL Editor (Admin Postgres Session)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. RPC: rpc_admin_set_password
-- Izinkan service_role (backend API) menyimpan/mengatur ulang hash kata sandi
-- pada tabel public.auth_credentials secara aman dengan audit log lengkap.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_set_password(
  p_account_id uuid,
  p_password_hash text,
  p_actor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_acc public.user_account%rowtype;
  v_now timestamptz := clock_timestamp();
BEGIN
  -- 1. Validasi pemanggil: Wajib service_role
  IF coalesce(current_setting('role', true), '') <> 'service_role'
     AND coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya backend service_role yang diizinkan.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validasi format parameter
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_account_id wajib disertakan.' USING ERRCODE = '22023';
  END IF;

  IF p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$10\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'Format password_hash tidak valid (wajib bcrypt cost 10).' USING ERRCODE = '22023';
  END IF;

  -- 3. Pastikan user_account ada
  SELECT * INTO v_acc FROM public.user_account WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun dengan ID % tidak ditemukan.', p_account_id USING ERRCODE = 'P0002';
  END IF;

  -- 4. Upsert ke public.auth_credentials
  INSERT INTO public.auth_credentials (
    account_id,
    hash_algorithm,
    password_hash,
    needs_rehash,
    password_updated_at,
    updated_at
  ) VALUES (
    p_account_id,
    'bcrypt',
    p_password_hash,
    false,
    v_now,
    v_now
  )
  ON CONFLICT (account_id) DO UPDATE SET
    hash_algorithm = 'bcrypt',
    password_hash = EXCLUDED.password_hash,
    needs_rehash = false,
    password_updated_at = v_now,
    updated_at = v_now;

  -- 5. Perbarui tokens_valid_after pada user_account untuk membatalkan sesi lama
  UPDATE public.user_account
  SET tokens_valid_after = v_now,
      updated_at = v_now
  WHERE id = p_account_id;

  -- 6. Catat riwayat ke auth_audit_log
  INSERT INTO public.auth_audit_log (
    actor_id,
    event_type,
    metadata
  ) VALUES (
    p_actor_id,
    'password_set_by_admin',
    jsonb_build_object(
      'target_account_id', p_account_id,
      'target_username', v_acc.username,
      'updated_at', v_now,
      'source', 'rpc_admin_set_password'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'account_id', p_account_id,
    'username', v_acc.username,
    'updated_at', v_now
  );
END;
$$;

-- Cabut akses dari public & role tidak berizin, berikan hanya ke service_role
REVOKE ALL ON FUNCTION public.rpc_admin_set_password(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_set_password(uuid, text, uuid) TO service_role;


-- ----------------------------------------------------------------------------
-- 2. RPC: rpc_admin_create_crew_account
-- Buat akun login baru secara atomik: user_account + account_profiles + auth_credentials
-- Dijalankan oleh ROOT dari Manajemen Kru via backend API.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_create_crew_account(
  p_identity_id uuid,
  p_username text,
  p_password_hash text,
  p_actor_id uuid DEFAULT NULL,
  p_profile_id text DEFAULT 'crew'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_identity public.canonical_identity%rowtype;
  v_account_id uuid;
  v_now timestamptz := clock_timestamp();
  v_clean_username text;
BEGIN
  -- 1. Validasi pemanggil: Wajib service_role
  IF coalesce(current_setting('role', true), '') <> 'service_role'
     AND coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya backend service_role yang diizinkan.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validasi parameter input
  IF p_identity_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_identity_id wajib disertakan.' USING ERRCODE = '22023';
  END IF;

  v_clean_username := lower(trim(p_username));
  IF v_clean_username IS NULL OR length(v_clean_username) < 3 OR length(v_clean_username) > 30 THEN
    RAISE EXCEPTION 'Username wajib 3-30 karakter.' USING ERRCODE = '22023';
  END IF;

  IF p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$10\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'Format password_hash tidak valid (wajib bcrypt cost 10).' USING ERRCODE = '22023';
  END IF;

  -- 3. Pastikan identitas kanonikal ada
  SELECT * INTO v_identity FROM public.canonical_identity WHERE id = p_identity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Identitas kanonikal % tidak ditemukan.', p_identity_id USING ERRCODE = 'P0002';
  END IF;

  -- 4. Periksa apakah username sudah dipakai oleh identitas lain
  IF EXISTS (
    SELECT 1 FROM public.user_account
    WHERE lower(username) = v_clean_username AND identity_id <> p_identity_id
  ) THEN
    RAISE EXCEPTION 'Username @% sudah digunakan akun lain.', v_clean_username USING ERRCODE = '23505';
  END IF;

  -- 5. Cari atau buat record di public.user_account
  SELECT id INTO v_account_id FROM public.user_account WHERE identity_id = p_identity_id;

  IF v_account_id IS NOT NULL THEN
    -- Akun sudah ada: update username & aktifkan status_akun
    UPDATE public.user_account
    SET username = v_clean_username,
        status_akun = 'active',
        tokens_valid_after = v_now,
        lockout_until = NULL,
        failed_login_attempts = 0,
        updated_at = v_now
    WHERE id = v_account_id;
  ELSE
    -- Akun baru: generate UUID dan buat record
    v_account_id := gen_random_uuid();
    INSERT INTO public.user_account (
      id,
      identity_id,
      username,
      status_akun,
      failed_login_attempts,
      lockout_until,
      tokens_valid_after,
      created_at,
      updated_at
    ) VALUES (
      v_account_id,
      p_identity_id,
      v_clean_username,
      'active',
      0,
      NULL,
      v_now,
      v_now,
      v_now
    );
  END IF;

  -- 6. Pasangkan profil akses di public.account_profiles
  INSERT INTO public.account_profiles (
    account_id,
    profile_id,
    assigned_at
  ) VALUES (
    v_account_id,
    coalesce(nullif(trim(p_profile_id), ''), 'crew'),
    v_now
  )
  ON CONFLICT (account_id, profile_id) DO NOTHING;

  -- 7. Simpan kredensial ke public.auth_credentials
  INSERT INTO public.auth_credentials (
    account_id,
    hash_algorithm,
    password_hash,
    needs_rehash,
    password_updated_at,
    updated_at
  ) VALUES (
    v_account_id,
    'bcrypt',
    p_password_hash,
    false,
    v_now,
    v_now
  )
  ON CONFLICT (account_id) DO UPDATE SET
    hash_algorithm = 'bcrypt',
    password_hash = EXCLUDED.password_hash,
    needs_rehash = false,
    password_updated_at = v_now,
    updated_at = v_now;

  -- 8. Catat audit log permanen
  INSERT INTO public.auth_audit_log (
    actor_id,
    event_type,
    metadata
  ) VALUES (
    p_actor_id,
    'crew_account_provisioned',
    jsonb_build_object(
      'target_account_id', v_account_id,
      'target_identity_id', p_identity_id,
      'target_ptv_id', v_identity.ptv_id,
      'username', v_clean_username,
      'profile_id', coalesce(nullif(trim(p_profile_id), ''), 'crew'),
      'status_akun', 'active',
      'source', 'rpc_admin_create_crew_account',
      'created_at', v_now
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'identity_id', p_identity_id,
    'ptv_id', v_identity.ptv_id,
    'username', v_clean_username,
    'profile_id', coalesce(nullif(trim(p_profile_id), ''), 'crew'),
    'status_akun', 'active'
  );
END;
$$;

-- Cabut akses dari public & role tidak berizin, berikan hanya ke service_role
REVOKE ALL ON FUNCTION public.rpc_admin_create_crew_account(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_crew_account(uuid, text, text, uuid, text) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. SINKRONISASI KREDENSIAL AKUN KRU EXISTING
-- A. Sinkronisasi Akun Rex Ruizhi Gajendra (PTV-032 / username: rex)
--    Pindahkan hash dari metadata_json arsip ke auth_credentials
-- ----------------------------------------------------------------------------
INSERT INTO public.auth_credentials (
  account_id,
  hash_algorithm,
  password_hash,
  needs_rehash,
  password_updated_at,
  updated_at
)
SELECT
  ua.id,
  'bcrypt',
  arc.metadata_json->>'password_hash',
  false,
  clock_timestamp(),
  clock_timestamp()
FROM public.user_account ua
JOIN public.canonical_identity ci ON ci.id = ua.identity_id
JOIN public.legacy_archive_kru arc ON arc.ptv_id = ci.ptv_id
WHERE ua.username = 'rex'
  AND arc.metadata_json->>'password_hash' IS NOT NULL
ON CONFLICT (account_id) DO UPDATE SET
  hash_algorithm = 'bcrypt',
  password_hash = EXCLUDED.password_hash,
  needs_rehash = false,
  password_updated_at = clock_timestamp(),
  updated_at = clock_timestamp();

-- Pastikan akun rex berstatus active dan memiliki profil crew
UPDATE public.user_account SET status_akun = 'active', tokens_valid_after = clock_timestamp() WHERE username = 'rex';
INSERT INTO public.account_profiles (account_id, profile_id)
SELECT id, 'crew' FROM public.user_account WHERE username = 'rex'
ON CONFLICT (account_id, profile_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- B. Aktivasi & Kredensial Akun Testing Kru Lapangan: kru_staging (PTV-STG-KRU)
--    Password default testing: KruStaging2026!
--    Hash: $2b$10$4g7.PQJhvt55jOHbtrETF.qfmSM7GNmZywHPexxrLW3zlUSjdCLRC
-- ----------------------------------------------------------------------------
UPDATE public.user_account
SET status_akun = 'active',
    tokens_valid_after = clock_timestamp(),
    updated_at = clock_timestamp()
WHERE username = 'kru_staging';

INSERT INTO public.account_profiles (account_id, profile_id)
SELECT id, 'crew' FROM public.user_account WHERE username = 'kru_staging'
ON CONFLICT (account_id, profile_id) DO NOTHING;

INSERT INTO public.auth_credentials (
  account_id,
  hash_algorithm,
  password_hash,
  needs_rehash,
  password_updated_at,
  updated_at
)
SELECT
  id,
  'bcrypt',
  '$2b$10$4g7.PQJhvt55jOHbtrETF.qfmSM7GNmZywHPexxrLW3zlUSjdCLRC',
  false,
  clock_timestamp(),
  clock_timestamp()
FROM public.user_account
WHERE username = 'kru_staging'
ON CONFLICT (account_id) DO UPDATE SET
  hash_algorithm = 'bcrypt',
  password_hash = EXCLUDED.password_hash,
  needs_rehash = false,
  password_updated_at = clock_timestamp(),
  updated_at = clock_timestamp();


-- ----------------------------------------------------------------------------
-- C. Pastikan seluruh akun di user_account memiliki profil minimal 'crew'
-- ----------------------------------------------------------------------------
INSERT INTO public.account_profiles (account_id, profile_id)
SELECT ua.id, 'crew'
FROM public.user_account ua
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_profiles ap WHERE ap.account_id = ua.id
)
ON CONFLICT (account_id, profile_id) DO NOTHING;

COMMIT;

-- ----------------------------------------------------------------------------
-- 4. VERIFIKASI AKHIR KESIAPAN AKUN
-- ----------------------------------------------------------------------------
SELECT
  ua.username,
  ci.ptv_id,
  ci.full_name,
  ua.status_akun,
  (ac.password_hash IS NOT NULL) AS has_password_hash,
  (SELECT array_agg(profile_id) FROM public.account_profiles WHERE account_id = ua.id) AS assigned_profiles,
  (SELECT count(*) FROM public.organization_membership WHERE identity_id = ci.id AND organization_id = 'ptv_studio' AND is_current) AS studio_membership_count
FROM public.user_account ua
JOIN public.canonical_identity ci ON ci.id = ua.identity_id
LEFT JOIN public.auth_credentials ac ON ac.account_id = ua.id
WHERE ua.username IN ('jid', 'rouf', 'rex', 'kru_staging', 'admin_staging', 'pojel')
ORDER BY ua.username;
