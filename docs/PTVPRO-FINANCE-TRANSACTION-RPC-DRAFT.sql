-- DRAFT v2 / BELUM DIEKSEKUSI. Memerlukan ACC operator; PostgreSQL 17 Staging.
-- Project Target Staging: swadgljnyelsjstqqxbm (db.swadgljnyelsjstqqxbm.supabase.co).
-- Rujukan: docs/PTVPRO-FINANCE-TRANSACTION-CONTRACT.md & src/products/hub/keuangan/financeCanonical.ts
--
-- Karakteristik Kunci Keamanan & Integritas:
-- 1. Anti-Spoofing: Identitas actor diverifikasi secara live melalui fungsi otorisasi backend
--    (user_account aktif, session_iat terhadap tokens_valid_after, keanggotaan ptv_studio aktif,
--    dan izin finance.manage). Klien dilarang menyuplai actor_id secara manual.
-- 2. Hak Akses & Privilege Terisolasi:
--    - Schema privat ptv_finance_private (REVOKE ALL dari PUBLIC/anon/authenticated, USAGE ke service_role).
--    - Fungsi inti SECURITY DEFINER dengan search_path ketat: pg_catalog, public, auth.
--    - Wrapper publik SECURITY INVOKER dengan search_path kosong ('').
--    - Izin EXECUTE hanya diberikan kepada service_role; ditolak mutlak dari klien browser langsung.
-- 3. Idempotensi Deterministik & Anti-Collision:
--    - Memakai pg_advisory_xact_lock pada hash idempotency key untuk serialisasi balapan request.
--    - Menghitung SHA-256 hash dari representasi kanonikal perintah.
--    - Jika key cocok & hash cocok & actor cocok => idempotent replay (aman, tanpa mutasi ganda).
--    - Jika key cocok tapi hash/actor berbeda => RAISE EXCEPTION 'Idempotency key collision' (ERRCODE 23505).
-- 4. Locking Deterministik Anti-Deadlock:
--    - Seluruh baris kantong dikunci via SELECT ... FOR UPDATE dengan urutan ID terurut ASC.
-- 5. Atomic Commit & Rollback:
--    - Seluruh mutasi (header, allocations, update saldo pockets, audit log, source references)
--    - dieksekusi dalam satu transaksi atomik. Kegagalan di tahap apa pun memicu ROLLBACK otomatis.
-- 6. Anti Double-Counting:
--    - Source references (ptv_pemasukan / ptv_pengeluaran) diikat dengan unique constraint.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Guard eksekusi
DO $$
BEGIN
  IF current_setting('app.target_project_ref', true) IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN
    RAISE EXCEPTION 'Target Staging belum dikonfirmasi (swadgljnyelsjstqqxbm); hentikan eksekusi';
  END IF;
  IF current_setting('app.finance_rpc_acc_confirmed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'ACC eksplisit operator untuk RPC transaksi multi-Kantong belum diberikan';
  END IF;
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'RPC ini memerlukan PostgreSQL 17 atau lebih baru';
  END IF;
END $$;

-- ============================================================================
-- 1. SCHEMA PRIVAT
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS ptv_finance_private;
REVOKE ALL ON SCHEMA ptv_finance_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ptv_finance_private TO service_role;

-- ============================================================================
-- 2. FUNGSI OTORISASI LIVE (ANTI-SPOOFING ACTOR)
-- ============================================================================
CREATE OR REPLACE FUNCTION ptv_finance_private.authorize(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_cap TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor UUID;
  v_valid_after TIMESTAMPTZ;
  v_count_current INT;
BEGIN
  -- Pastikan pemanggil backend menggunakan service_role (atau lingkungan testing khusus)
  IF COALESCE(current_setting('request.jwt.claims', true)::JSONB->>'role', '') <> 'service_role'
     AND current_setting('app.is_test_runner', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Server-only finance authorization required' USING ERRCODE = '42501';
  END IF;

  IF p_cap IS NULL OR p_cap NOT IN ('finance.view', 'finance.manage') THEN
    RAISE EXCEPTION 'Invalid finance capability requested: %', p_cap USING ERRCODE = '42501';
  END IF;

  -- 1. Verifikasi akun aktif dan session revocation timestamp
  SELECT identity_id, tokens_valid_after
    INTO v_actor, v_valid_after
    FROM public.user_account
   WHERE id = p_account_id AND status_akun = 'active';

  IF v_actor IS NULL OR p_session_iat IS NULL
     OR (v_valid_after IS NOT NULL AND p_session_iat < extract(epoch FROM v_valid_after)::BIGINT) THEN
    RAISE EXCEPTION 'Active unrevoked Hub session required' USING ERRCODE = '42501';
  END IF;

  -- 2. Verifikasi keanggotaan organisasi ptv_studio aktif
  SELECT count(*)
    INTO v_count_current
    FROM public.organization_membership
   WHERE identity_id = v_actor
     AND organization_id = 'ptv_studio'
     AND is_current = true
     AND status_organisasi = 'active';

  IF v_count_current <> 1 THEN
    RAISE EXCEPTION 'Unique active studio membership required' USING ERRCODE = '42501';
  END IF;

  -- 3. Verifikasi capability pengguna (cek deny override lalu allow/profile capabilities)
  IF EXISTS (
    SELECT 1 FROM public.account_capability_overrides
     WHERE account_id = p_account_id AND capability_key = p_cap AND override_type = 'deny'
  ) OR NOT (
    EXISTS (
      SELECT 1 FROM public.account_capability_overrides
       WHERE account_id = p_account_id AND capability_key = p_cap AND override_type = 'allow'
    ) OR EXISTS (
      SELECT 1 FROM public.account_profiles ap
        JOIN public.profile_capabilities pc ON pc.profile_id = ap.profile_id
       WHERE ap.account_id = p_account_id AND pc.capability_key = p_cap
    )
  ) THEN
    RAISE EXCEPTION 'Required finance capability missing: %', p_cap USING ERRCODE = '42501';
  END IF;

  -- Kembalikan ID identitas canonical yang terverifikasi
  RETURN v_actor;
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.authorize(UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.authorize(UUID, BIGINT, TEXT) TO service_role;

-- ============================================================================
-- 3. FUNGSI INTI MUTASI ATOMIK
-- ============================================================================
CREATE OR REPLACE FUNCTION ptv_finance_private.post_transaction(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_verified_actor_id UUID;
  v_version INT;
  v_idempotency_key UUID;
  v_operation TEXT;
  v_occurred_on DATE;
  v_description TEXT;
  v_currency TEXT;
  v_amount_minor BIGINT;
  v_category_id UUID;
  v_incoming JSONB;
  v_outgoing JSONB;
  v_source_refs JSONB;

  v_canonical_hash_input TEXT;
  v_command_hash VARCHAR(64);
  v_existing_tx RECORD;
  v_tx_id UUID;
  v_audit_ref TEXT;
  v_in_sum BIGINT := 0;
  v_out_sum BIGINT := 0;
  v_line JSONB;
  v_pocket_id UUID;
  v_line_amount BIGINT;

  v_sorted_pockets UUID[];
  v_pocket_record RECORD;
BEGIN
  -- 1. Otorisasi Actor melalui Backend (cegah spoofing)
  v_verified_actor_id := ptv_finance_private.authorize(p_account_id, p_session_iat, 'finance.manage');

  -- 2. Validasi Struktur Payload Dasar
  IF p_command IS NULL OR jsonb_typeof(p_command) <> 'object' THEN
    RAISE EXCEPTION 'Payload perintah transaksi tidak valid atau kosong' USING ERRCODE = '22023';
  END IF;

  v_version := (p_command->>'version')::INT;
  IF v_version <> 2 THEN
    RAISE EXCEPTION 'Versi envelope tidak didukung (harus versi 2)' USING ERRCODE = '22023';
  END IF;

  v_idempotency_key := (p_command->>'idempotencyKey')::UUID;
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key wajib berupa UUID yang valid' USING ERRCODE = '22023';
  END IF;

  -- 3. Advisory Lock untuk Mencegah Race Condition Pemanggilan Idempotency Key Ganda
  PERFORM pg_advisory_xact_lock(hashtext(v_idempotency_key::TEXT));

  v_operation := p_command->>'operation';
  IF v_operation NOT IN ('income', 'expense', 'transfer') THEN
    RAISE EXCEPTION 'Operasi tidak valid: % (harus income, expense, atau transfer)', v_operation USING ERRCODE = '22023';
  END IF;

  v_occurred_on := (p_command->>'occurredOn')::DATE;
  IF v_occurred_on IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi occurredOn wajib diisi' USING ERRCODE = '22023';
  END IF;

  v_description := trim(p_command->>'description');
  IF v_description IS NULL OR length(v_description) < 1 OR length(v_description) > 1000 THEN
    RAISE EXCEPTION 'Deskripsi transaksi wajib 1-1000 karakter' USING ERRCODE = '22023';
  END IF;

  v_currency := p_command->>'currency';
  IF v_currency IS DISTINCT FROM 'IDR' THEN
    RAISE EXCEPTION 'Mata uang hanya mendukung IDR' USING ERRCODE = '22023';
  END IF;

  v_amount_minor := (p_command->>'amountMinor')::BIGINT;
  IF v_amount_minor IS NULL OR v_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Nominal amountMinor harus bilangan bulat positif (minor integer)' USING ERRCODE = '22023';
  END IF;

  IF p_command->>'categoryId' IS NOT NULL THEN
    v_category_id := (p_command->>'categoryId')::UUID;
  ELSE
    v_category_id := NULL;
  END IF;

  v_incoming := COALESCE(p_command->'incoming', '[]'::JSONB);
  v_outgoing := COALESCE(p_command->'outgoing', '[]'::JSONB);
  v_source_refs := COALESCE(p_command->'sourceReferences', '[]'::JSONB);

  -- 4. Hitung SHA-256 Hash Kanonikal Perintah untuk Validasi Idempotensi Ketat
  v_canonical_hash_input := concat_ws('|',
    v_version::TEXT,
    v_operation,
    v_occurred_on::TEXT,
    v_description,
    v_currency,
    v_amount_minor::TEXT,
    COALESCE(v_category_id::TEXT, 'none'),
    v_incoming::TEXT,
    v_outgoing::TEXT,
    v_source_refs::TEXT
  );
  v_command_hash := encode(sha256(convert_to(v_canonical_hash_input, 'UTF8')), 'hex');

  -- 5. Pemeriksaan Idempotensi
  SELECT id, amount_minor, kind, status, occurred_on, command_hash, created_by
    INTO v_existing_tx
    FROM public.ptv_finance_transactions
   WHERE idempotency_key = v_idempotency_key;

  IF FOUND THEN
    -- Jika key sama, payload hash sama, dan actor sama => Idempotent Replay Aman
    IF v_existing_tx.command_hash = v_command_hash
       AND v_existing_tx.created_by = v_verified_actor_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_existing_tx.id,
        'status', v_existing_tx.status,
        'message', 'Transaksi sudah tercatat sebelumnya (idempotent replay)'
      );
    ELSE
      -- Jika key sama namun payload atau actor berbeda => Benturan Idempotensi Ilegal
      RAISE EXCEPTION 'Idempotency key % sudah digunakan dengan detail transaksi atau actor berbeda', v_idempotency_key
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- 6. Validasi Aturan Operasi & Kategori
  IF v_operation = 'transfer' THEN
    IF v_category_id IS NOT NULL THEN
      RAISE EXCEPTION 'Transaksi transfer internal tidak boleh memiliki kategori' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_category_id IS NULL THEN
      RAISE EXCEPTION 'Transaksi % wajib memiliki categoryId', v_operation USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.ptv_finance_categories
       WHERE id = v_category_id AND kind = v_operation AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Kategori % tidak valid atau tidak aktif untuk %', v_category_id, v_operation USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 7. Hitung dan Validasi Total Alokasi
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_incoming) LOOP
    v_line_amount := (v_line->>'amountMinor')::BIGINT;
    IF v_line_amount IS NULL OR v_line_amount <= 0 THEN
      RAISE EXCEPTION 'Alokasi incoming memiliki nominal tidak valid' USING ERRCODE = '22023';
    END IF;
    v_in_sum := v_in_sum + v_line_amount;
  END LOOP;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_outgoing) LOOP
    v_line_amount := (v_line->>'amountMinor')::BIGINT;
    IF v_line_amount IS NULL OR v_line_amount <= 0 THEN
      RAISE EXCEPTION 'Alokasi outgoing memiliki nominal tidak valid' USING ERRCODE = '22023';
    END IF;
    v_out_sum := v_out_sum + v_line_amount;
  END LOOP;

  IF v_operation = 'income' THEN
    IF v_in_sum <> v_amount_minor OR jsonb_array_length(v_outgoing) > 0 THEN
      RAISE EXCEPTION 'Total pemasukan (%) harus sama dengan amountMinor (%) dan outgoing harus kosong', v_in_sum, v_amount_minor USING ERRCODE = '22023';
    END IF;
  ELSIF v_operation = 'expense' THEN
    IF v_out_sum <> v_amount_minor OR jsonb_array_length(v_incoming) > 0 THEN
      RAISE EXCEPTION 'Total pengeluaran (%) harus sama dengan amountMinor (%) dan incoming harus kosong', v_out_sum, v_amount_minor USING ERRCODE = '22023';
    END IF;
  ELSIF v_operation = 'transfer' THEN
    IF v_in_sum <> v_amount_minor OR v_out_sum <> v_amount_minor THEN
      RAISE EXCEPTION 'Pada transfer, total asal (%) dan tujuan (%) harus seimbang dan sama dengan amountMinor (%)', v_out_sum, v_in_sum, v_amount_minor USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 8. Kunci Baris Kantong Terurut ASC (Deadlock Prevention)
  SELECT array_agg(DISTINCT p ORDER BY p ASC)
    INTO v_sorted_pockets
    FROM (
      SELECT (val->>'pocketId')::UUID AS p FROM jsonb_array_elements(v_incoming) val
      UNION
      SELECT (val->>'pocketId')::UUID AS p FROM jsonb_array_elements(v_outgoing) val
    ) sub;

  IF v_sorted_pockets IS NULL OR cardinality(v_sorted_pockets) = 0 THEN
    RAISE EXCEPTION 'Transaksi harus melibatkan setidaknya satu Kantong' USING ERRCODE = '22023';
  END IF;

  -- Kunci baris kantong secara berurutan
  PERFORM id
     FROM public.ptv_finance_pockets
    WHERE id = ANY(v_sorted_pockets)
    ORDER BY id ASC
      FOR UPDATE;

  IF (SELECT count(*) FROM public.ptv_finance_pockets WHERE id = ANY(v_sorted_pockets)) <> cardinality(v_sorted_pockets) THEN
    RAISE EXCEPTION 'Satu atau lebih Kantong yang dipilih tidak ditemukan di database' USING ERRCODE = '22023';
  END IF;

  -- Periksa status kantong dan kecukupan saldo
  FOR v_pocket_record IN
    SELECT id, name, archived, balance_minor, version
      FROM public.ptv_finance_pockets
     WHERE id = ANY(v_sorted_pockets)
     ORDER BY id ASC
  LOOP
    IF v_pocket_record.archived THEN
      RAISE EXCEPTION 'Kantong "%" (%) sudah diarsipkan; tidak dapat menerima transaksi', v_pocket_record.name, v_pocket_record.id USING ERRCODE = '22023';
    END IF;

    -- Hitung total pengeluaran dari kantong ini
    SELECT COALESCE(SUM((val->>'amountMinor')::BIGINT), 0)
      INTO v_out_sum
      FROM jsonb_array_elements(v_outgoing) val
     WHERE (val->>'pocketId')::UUID = v_pocket_record.id;

    IF v_out_sum > 0 AND v_pocket_record.balance_minor < v_out_sum THEN
      RAISE EXCEPTION 'Saldo kantong "%" tidak mencukupi (tersedia: %, dibutuhkan: %). Saldo negatif dilarang',
        v_pocket_record.name, v_pocket_record.balance_minor, v_out_sum USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- 9. Insert Header Transaksi Canonical
  v_tx_id := gen_random_uuid();
  v_audit_ref := 'AUDIT-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(v_tx_id::TEXT, 1, 8);

  INSERT INTO public.ptv_finance_transactions (
    id, occurred_on, description, kind, currency, amount_minor,
    category_id, status, idempotency_key, command_hash, audit_reference,
    created_by, created_at
  ) VALUES (
    v_tx_id, v_occurred_on, v_description, v_operation, 'IDR', v_amount_minor,
    v_category_id, 'posted', v_idempotency_key, v_command_hash, v_audit_ref,
    v_verified_actor_id, now()
  );

  -- 10. Insert Baris Alokasi & Mutasi Saldo Kantong
  -- Incoming allocations (arah 'in')
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_incoming) LOOP
    v_pocket_id := (v_line->>'pocketId')::UUID;
    v_line_amount := (v_line->>'amountMinor')::BIGINT;

    INSERT INTO public.ptv_finance_allocations (
      transaction_id, pocket_id, direction, amount_minor
    ) VALUES (
      v_tx_id, v_pocket_id, 'in', v_line_amount
    );

    UPDATE public.ptv_finance_pockets
       SET balance_minor = balance_minor + v_line_amount,
           version = version + 1,
           updated_at = now()
     WHERE id = v_pocket_id;
  END LOOP;

  -- Outgoing allocations (arah 'out')
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_outgoing) LOOP
    v_pocket_id := (v_line->>'pocketId')::UUID;
    v_line_amount := (v_line->>'amountMinor')::BIGINT;

    INSERT INTO public.ptv_finance_allocations (
      transaction_id, pocket_id, direction, amount_minor
    ) VALUES (
      v_tx_id, v_pocket_id, 'out', v_line_amount
    );

    UPDATE public.ptv_finance_pockets
       SET balance_minor = balance_minor - v_line_amount,
           version = version + 1,
           updated_at = now()
     WHERE id = v_pocket_id;
  END LOOP;

  -- 11. Catat Source References (Mencegah Rekonsiliasi Ganda)
  IF jsonb_array_length(v_source_refs) > 0 THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_source_refs) LOOP
      INSERT INTO public.ptv_finance_source_references (
        transaction_id, source_table, source_id
      ) VALUES (
        v_tx_id,
        v_line->>'kind',
        (v_line->>'id')::UUID
      );
    END LOOP;
  END IF;

  -- 12. Catat Audit Trail Immutable
  INSERT INTO public.ptv_finance_audit_log (
    entity_type, entity_id, action, actor_id, payload, occurred_at
  ) VALUES (
    'transaction', v_tx_id, 'post', v_verified_actor_id,
    jsonb_build_object(
      'command', p_command,
      'commandHash', v_command_hash,
      'auditReference', v_audit_ref,
      'amountMinor', v_amount_minor,
      'operation', v_operation
    ),
    now()
  );

  -- 13. Kembalikan Hasil Sukses
  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction_id', v_tx_id,
    'idempotency_key', v_idempotency_key,
    'command_hash', v_command_hash,
    'audit_reference', v_audit_ref,
    'status', 'posted'
  );
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.post_transaction(UUID, BIGINT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.post_transaction(UUID, BIGINT, JSONB) TO service_role;

-- ============================================================================
-- 4. PUBLIC WRAPPER (SERVER-ONLY RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_post_finance_transaction_server(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.post_transaction(p_account_id, p_session_iat, p_command);
$$;

REVOKE ALL ON FUNCTION public.rpc_post_finance_transaction_server(UUID, BIGINT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_post_finance_transaction_server(UUID, BIGINT, JSONB) TO service_role;

COMMIT;
