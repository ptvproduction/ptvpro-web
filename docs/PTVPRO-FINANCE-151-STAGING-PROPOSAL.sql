-- GENERATED REVIEW PROPOSAL ONLY; no database client.
-- docs/PTVPRO-FINANCE-TRANSACTION-RPC-DRAFT.sql: 1863765361e28220f8a090794aa52dc7cf8e1225414a1c7ddbea1184565ac0b4
-- docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql: d7cdd05b05931470f7daf8dc7f72d58f4df70dae117a6d1203d1e59d11b42958
-- docs/PTVPRO-FINANCE-151-HARDENING-SOURCE.sql: 5b330f86d25f5ce54eee4630aca09287b34a78a2fabea789ca9232eeb56bf298
-- docs/PTVPRO-FINANCE-151-POLICIES.sql: 9769e5c20532efffd19ad88624d3777149e06c5440fb6194d265d63410980853
-- docs/PTVPRO-FINANCE-151-ADMIN-RPC.sql: 459ae862bc539b93b4eea4b4e2b53fe70d18261cde36f300d5ca25fec15242c4
-- REVIEW SOURCE ONLY. Build with scripts/build-finance-151.mjs; no cloud execution.
-- Existing RPC names/contracts are retained. No identities or historical rows are rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN('','{}')
 OR (SELECT system_identifier::text FROM pg_control_system())<>'__ACC_STAGING_PHYSICAL_SYSTEM_IDENTIFIER__' THEN
 RAISE EXCEPTION 'approved direct staging administration required'; END IF;
END $$;
DO $$ DECLARE tab text; actor_role text; BEGIN
 FOREACH tab IN ARRAY ARRAY['user_account','canonical_identity','organization_membership','account_profiles','account_capability_overrides','profile_capabilities','access_profile','capability_registry','auth_credentials'] LOOP
  FOREACH actor_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_table_privilege(actor_role,'public.'||tab,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'reviewed access149 preparation required before Finance hardening'; END IF;
  END LOOP;
 END LOOP;
END $$;
CREATE SCHEMA IF NOT EXISTS ptv_finance_private;
REVOKE ALL ON SCHEMA ptv_finance_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA ptv_finance_private TO service_role;
ALTER TABLE public.ptv_finance_transactions ADD COLUMN IF NOT EXISTS operational_envelope jsonb;
ALTER TABLE public.ptv_finance_loan_payments
 ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted' CHECK(status IN('posted','reversed')),
 ADD COLUMN IF NOT EXISTS reversal_reason text,
 ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
 ADD COLUMN IF NOT EXISTS reversed_by uuid;
ALTER TABLE public.ptv_finance_transactions
 ADD COLUMN IF NOT EXISTS reversal_reason text,
 ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
 ADD COLUMN IF NOT EXISTS reversed_by uuid;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.ptv_finance_kas_records r WHERE r.paid_amount_minor<>(SELECT coalesce(sum(p.amount_minor),0) FROM public.ptv_finance_kas_payments p WHERE p.record_id=r.id AND p.status='posted'))
 OR EXISTS(SELECT 1 FROM public.ptv_finance_loans l WHERE l.total_paid_minor<>(SELECT coalesce(sum(p.amount_minor),0) FROM public.ptv_finance_loan_payments p WHERE p.loan_id=l.id AND p.status='posted') OR l.remaining_minor<>l.total_due_minor-l.total_paid_minor)
 OR EXISTS(SELECT 1 FROM public.ptv_finance_loan_payments p LEFT JOIN public.ptv_finance_transactions t ON t.id=p.receipt_tx_id WHERE p.receipt_tx_id IS NULL OR p.status IS DISTINCT FROM t.status)
 OR EXISTS(SELECT 1 FROM public.ptv_finance_kas_payments p JOIN public.ptv_finance_transactions t ON t.id=p.transaction_id WHERE p.status IS DISTINCT FROM t.status) THEN
 RAISE EXCEPTION 'historical installments require explicit reconciliation; no automatic repair'; END IF;
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.personnel_category(p_identity uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE n int; cat text; fallback_cat text;
BEGIN
 SELECT metadata->>'category' INTO fallback_cat FROM public.canonical_identity WHERE id=p_identity;
 SELECT count(*),min(metadata_json->>'category') INTO n,cat FROM public.legacy_archive_kru WHERE canonical_identity_id=p_identity;
 IF n>1 OR (n=1 AND fallback_cat IS NOT NULL AND cat IS DISTINCT FROM fallback_cat) THEN RETURN NULL; END IF;
 IF n=0 THEN cat:=fallback_cat; END IF;
 RETURN CASE WHEN cat IN('Kru','Pembina','Pengarah') THEN cat ELSE NULL END;
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.can_account(p_account uuid,p_iat bigint,p_cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_account a
 WHERE a.id=p_account AND a.status_akun='active' AND (a.lockout_until IS NULL OR a.lockout_until<=now())
 AND p_iat>0 AND p_iat<=extract(epoch FROM now()) AND (a.tokens_valid_after IS NULL OR p_iat>=ceil(extract(epoch FROM a.tokens_valid_after)))
 AND ptv_finance_private.personnel_category(a.identity_id)='Kru'
 AND (SELECT count(*) FROM public.organization_membership m WHERE m.identity_id=a.identity_id AND m.organization_id='ptv_studio' AND m.is_current)=1
 AND EXISTS(SELECT 1 FROM public.organization_membership m WHERE m.identity_id=a.identity_id AND m.organization_id='ptv_studio' AND m.is_current AND m.status_organisasi='active')
 AND NOT EXISTS(SELECT 1 FROM public.account_capability_overrides o WHERE o.account_id=a.id AND o.capability_key=p_cap AND o.override_type='deny')
 AND (EXISTS(SELECT 1 FROM public.account_capability_overrides o WHERE o.account_id=a.id AND o.capability_key=p_cap AND o.override_type='allow')
 OR EXISTS(SELECT 1 FROM public.account_profiles ap JOIN public.profile_capabilities pc ON pc.profile_id=ap.profile_id WHERE ap.account_id=a.id AND pc.capability_key=p_cap)))
$$;

CREATE OR REPLACE FUNCTION ptv_finance_private.authorize(p_account_id uuid,p_session_iat bigint,p_cap text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role'
 OR coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' THEN
 RAISE EXCEPTION 'server-only finance authorization required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(151,1);
 -- Freeze account/grant changes for this financial transaction, including new deny rows.
 LOCK TABLE public.user_account,public.organization_membership,public.account_profiles,public.profile_capabilities,public.account_capability_overrides,public.canonical_identity,public.legacy_archive_kru IN SHARE MODE;
 IF p_cap NOT IN('hub.access','finance.view','finance.manage','finance.operator') OR p_cap IS NULL
 OR NOT ptv_finance_private.can_account(p_account_id,p_session_iat,'hub.access')
 OR NOT ptv_finance_private.can_account(p_account_id,p_session_iat,p_cap) THEN
 RAISE EXCEPTION 'active unrevoked finance capability required' USING ERRCODE='42501'; END IF;
 SELECT identity_id INTO STRICT actor FROM public.user_account WHERE id=p_account_id;
 RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.native_account()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE account_id uuid; claims jsonb; issued bigint; expires bigint;
BEGIN
 claims:=auth.jwt();
 IF jsonb_typeof(claims->'iat') IS DISTINCT FROM 'number' OR jsonb_typeof(claims->'exp') IS DISTINCT FROM 'number'
 OR coalesce(claims->>'iat','') !~ '^[0-9]{1,10}$' OR coalesce(claims->>'exp','') !~ '^[0-9]{1,10}$'
 THEN RETURN NULL; END IF;
 issued:=(claims->>'iat')::bigint; expires:=(claims->>'exp')::bigint;
 IF auth.uid() IS NULL OR issued IS NULL OR expires IS NULL OR expires<=extract(epoch FROM now()) OR expires<=issued THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=(claims->>'session_id')::uuid AND s.user_id=auth.uid()
   AND (s.not_after IS NULL OR s.not_after>now())) THEN RETURN NULL; END IF;
 SELECT id INTO STRICT account_id FROM public.user_account WHERE auth_user_id=auth.uid();
 IF NOT ptv_finance_private.can_account(account_id,issued,'hub.access') THEN RETURN NULL; END IF;
 RETURN account_id;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.finance_can_native(p_cap text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE account_id uuid;
BEGIN
 account_id:=ptv_finance_private.native_account();
 IF account_id IS NULL THEN RETURN false; END IF;
 RETURN coalesce(ptv_finance_private.can_account(account_id,(auth.jwt()->>'iat')::bigint,p_cap),false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE OR REPLACE FUNCTION public.current_authenticated_ptv_id()
RETURNS varchar(32) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ci.ptv_id::varchar(32) FROM public.user_account a JOIN public.canonical_identity ci ON ci.id=a.identity_id WHERE a.id=ptv_finance_private.native_account()
$$;
CREATE OR REPLACE FUNCTION public.is_finance_restricted_personnel()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT ptv_finance_private.native_account() IS NULL $$;

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

  PERFORM pg_advisory_xact_lock(151,1);
  -- 2. Validasi Struktur Payload Dasar
  IF p_command IS NULL OR jsonb_typeof(p_command) <> 'object' THEN
    RAISE EXCEPTION 'Payload perintah transaksi tidak valid atau kosong' USING ERRCODE = '22023';
  END IF;

  v_version := (p_command->>'version')::INT;
  IF v_version IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Versi envelope tidak didukung (harus versi 2)' USING ERRCODE = '22023';
  END IF;

  v_idempotency_key := (p_command->>'idempotencyKey')::UUID;
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key wajib berupa UUID yang valid' USING ERRCODE = '22023';
  END IF;

  -- 3. Advisory Lock untuk Mencegah Race Condition Pemanggilan Idempotency Key Ganda
  PERFORM pg_advisory_xact_lock(hashtext(v_idempotency_key::TEXT));

  v_operation := p_command->>'operation';
  IF v_operation IS NULL OR v_operation NOT IN ('income', 'expense', 'transfer') THEN
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
  v_command_hash := encode(sha256(convert_to(v_canonical_hash_input || CASE WHEN p_command ? '_operational' THEN '|' || (p_command->'_operational')::text ELSE '' END, 'UTF8')), 'hex');

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
    created_by, created_at, operational_envelope
  ) VALUES (
    v_tx_id, v_occurred_on, v_description, v_operation, 'IDR', v_amount_minor,
    v_category_id, 'posted', v_idempotency_key, v_command_hash, v_audit_ref,
    v_verified_actor_id, now(), coalesce(p_command->'_operational',jsonb_build_object('kind','general','account',p_account_id))
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

CREATE OR REPLACE FUNCTION ptv_finance_private.operational_command(p_account uuid,p_command jsonb,p_kind text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_command ? '_operational' THEN
 RAISE EXCEPTION 'invalid operational envelope' USING ERRCODE='22023'; END IF;
 RETURN p_command||jsonb_build_object('_operational',jsonb_build_object('account',p_account,'kind',p_kind,'payload',p_payload));
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.operational_replay(p_account uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tx public.ptv_finance_transactions;
BEGIN
 SELECT * INTO tx FROM public.ptv_finance_transactions WHERE idempotency_key=(p_command->>'idempotencyKey')::uuid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF tx.operational_envelope IS DISTINCT FROM p_command->'_operational' THEN RAISE EXCEPTION 'operational idempotency conflict' USING ERRCODE='23505'; END IF;
 -- Core validates the canonical command hash and actor before any status/remaining checks.
 RETURN ptv_finance_private.post_transaction(p_account,(SELECT floor(extract(epoch FROM now()))::bigint),p_command);
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.record_kas_kru_payment_atomic(p_account_id uuid,p_session_iat bigint,p_command jsonb,p_kas_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; cmd jsonb; result jsonb; sem public.ptv_finance_semesters; person uuid; member_ptv text;
 periods text[]; period_value text; period_date date; fee bigint; part bigint; total bigint; remainder bigint; rec public.ptv_finance_kas_records;
 tx uuid; record_ids jsonb:='[]'; join_month text;
BEGIN
 actor:=ptv_finance_private.authorize(p_account_id,p_session_iat,'finance.manage');
 cmd:=ptv_finance_private.operational_command(p_account_id,p_command,'kas_kru',p_kas_payload);
 result:=ptv_finance_private.operational_replay(p_account_id,cmd);
 IF result IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'transaction',result); END IF;
 SELECT * INTO STRICT sem FROM public.ptv_finance_semesters WHERE id=(p_kas_payload->>'semesterId')::uuid FOR UPDATE;
 IF NOT sem.is_active OR sem.is_archived THEN RAISE EXCEPTION 'semester is not active'; END IF;
 SELECT id,ptv_id INTO STRICT person,member_ptv FROM public.canonical_identity WHERE ptv_id=p_kas_payload->>'ptvId';
 IF ptv_finance_private.personnel_category(person) IS DISTINCT FROM 'Kru'
 OR (SELECT count(*) FROM public.organization_membership WHERE identity_id=person AND organization_id='ptv_studio' AND is_current)=0
 OR (SELECT count(*) FROM public.organization_membership WHERE identity_id=person AND organization_id='ptv_studio' AND is_current)<>1
 OR NOT EXISTS(SELECT 1 FROM public.organization_membership WHERE identity_id=person AND organization_id='ptv_studio' AND is_current AND status_organisasi='active') THEN RAISE EXCEPTION 'verified active operational crew required'; END IF;
 -- Imported_at is not a joining date. This explicit value requires reviewed provenance.
 SELECT metadata->>'finance_join_month' INTO join_month FROM public.canonical_identity WHERE id=person;
 IF join_month IS NULL OR join_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'verified joining month required'; END IF;
 IF jsonb_typeof(p_kas_payload->'periods') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid periods'; END IF;
 SELECT array_agg(value ORDER BY value) INTO periods FROM jsonb_array_elements_text(p_kas_payload->'periods');
 IF coalesce(cardinality(periods),0)=0 OR cardinality(periods)<>(SELECT count(DISTINCT x) FROM unnest(periods)x) THEN RAISE EXCEPTION 'duplicate or empty periods'; END IF;
 IF cmd->>'operation' IS DISTINCT FROM 'income' OR jsonb_array_length(cmd->'incoming')<>1 OR jsonb_array_length(cmd->'outgoing')<>0
 OR cmd->'incoming'->0->>'pocketId' IS DISTINCT FROM p_kas_payload->>'pocketId' THEN RAISE EXCEPTION 'Kas command does not match payload'; END IF;
 total:=(cmd->>'amountMinor')::bigint;
 IF total IS NULL OR total<cardinality(periods) THEN RAISE EXCEPTION 'invalid installment amount'; END IF;
 remainder:=total%cardinality(periods);
 FOREACH period_value IN ARRAY periods LOOP
  IF period_value !~ '^\d{4}-(0[1-9]|1[0-2])$' OR period_value<join_month THEN RAISE EXCEPTION 'invalid or pre-joining period'; END IF;
  period_date:=(period_value||'-01')::date;
  IF date_trunc('month',period_date)<date_trunc('month',sem.start_date) OR date_trunc('month',period_date)>date_trunc('month',sem.end_date) THEN RAISE EXCEPTION 'period outside semester'; END IF;
  fee:=coalesce((sem.monthly_fees->>period_value)::bigint,sem.monthly_fee_minor);
  IF fee IS NULL OR fee<=0 THEN RAISE EXCEPTION 'invalid semester tariff'; END IF;
  part:=total/cardinality(periods)+CASE WHEN remainder>0 THEN 1 ELSE 0 END; remainder:=greatest(remainder-1,0);
  INSERT INTO public.ptv_finance_kas_records(semester_id,ptv_id,crew_name,period,amount_minor,paid_amount_minor,status,pocket_id)
   SELECT sem.id,member_ptv,ci.full_name,period_value,fee,0,'belum',(p_kas_payload->>'pocketId')::uuid FROM public.canonical_identity ci WHERE ci.id=person
   ON CONFLICT(semester_id,ptv_id,period) DO NOTHING;
  SELECT * INTO STRICT rec FROM public.ptv_finance_kas_records WHERE semester_id=sem.id AND ptv_id=member_ptv AND period=period_value FOR UPDATE;
  IF rec.amount_minor<>fee THEN RAISE EXCEPTION 'existing tariff requires explicit reconciliation'; END IF;
  IF rec.status='dikecualikan' OR part>fee-rec.paid_amount_minor THEN RAISE EXCEPTION 'waived period or overpayment'; END IF;
  record_ids:=record_ids||jsonb_build_object('id',rec.id,'amount',part);
 END LOOP;
 result:=ptv_finance_private.post_transaction(p_account_id,p_session_iat,cmd); tx:=(result->>'transaction_id')::uuid;
 FOR rec IN SELECT r.* FROM public.ptv_finance_kas_records r WHERE r.id IN(SELECT (v->>'id')::uuid FROM jsonb_array_elements(record_ids)v) ORDER BY r.id LOOP
  SELECT (v->>'amount')::bigint INTO part FROM jsonb_array_elements(record_ids)v WHERE v->>'id'=rec.id::text;
  INSERT INTO public.ptv_finance_kas_payments(record_id,transaction_id,amount_minor,paid_at,payment_method,recorded_by_ptv_id)
   VALUES(rec.id,tx,part,(cmd->>'occurredOn')::date,coalesce(p_kas_payload->>'method','cash'),(SELECT ptv_id FROM public.canonical_identity WHERE id=actor));
  UPDATE public.ptv_finance_kas_records SET paid_amount_minor=paid_amount_minor+part,status=CASE WHEN paid_amount_minor+part=amount_minor THEN 'lunas' ELSE 'sebagian' END,
   transaction_id=tx,payment_date=(cmd->>'occurredOn')::date,updated_at=now() WHERE id=rec.id;
 END LOOP;
 RETURN jsonb_build_object('success',true,'transaction',result,'records',record_ids);
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.disburse_loan_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_loan_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_verified_actor_id UUID;
  v_tx_result JSONB;
  v_tx_id UUID;
  v_principal BIGINT;
  v_rate NUMERIC(5, 2);
  v_interest_minor BIGINT := 0;
  v_total_due BIGINT;
  v_loan_id UUID;
  v_existing_loan RECORD;
BEGIN
  v_verified_actor_id := ptv_finance_private.authorize(p_account_id, p_session_iat, 'finance.manage');

  p_command:=ptv_finance_private.operational_command(p_account_id,p_command,'loan_disbursement',p_loan_payload);
  v_tx_result:=ptv_finance_private.operational_replay(p_account_id,p_command);
  IF v_tx_result IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'transaction',v_tx_result); END IF;
  IF p_loan_payload->>'borrowerType' IS NULL OR p_loan_payload->>'borrowerType' NOT IN('kru','eksternal')
    OR nullif(trim(p_loan_payload->>'borrowerName'),'') IS NULL OR nullif(trim(p_loan_payload->>'borrowerContact'),'') IS NULL
    OR nullif(trim(p_loan_payload->>'purpose'),'') IS NULL THEN RAISE EXCEPTION 'invalid borrower details'; END IF;
  IF p_loan_payload->>'borrowerType'='kru' AND NOT EXISTS(SELECT 1 FROM public.canonical_identity ci
    WHERE ci.ptv_id=p_loan_payload->>'borrowerId' AND ptv_finance_private.personnel_category(ci.id)='Kru'
    AND (SELECT count(*) FROM public.organization_membership m WHERE m.identity_id=ci.id AND m.organization_id='ptv_studio' AND m.is_current)=1
    AND EXISTS(SELECT 1 FROM public.organization_membership m WHERE m.identity_id=ci.id AND m.organization_id='ptv_studio' AND m.is_current AND m.status_organisasi='active'))
    THEN RAISE EXCEPTION 'verified internal borrower required'; END IF;
  IF p_loan_payload->>'interestType' IS NULL OR p_loan_payload->>'interestType' NOT IN('none','flat')
    OR coalesce((p_loan_payload->>'interestRatePercent')::numeric,0)<0
    OR coalesce((p_loan_payload->>'interestRatePercent')::numeric,0)<>round(coalesce((p_loan_payload->>'interestRatePercent')::numeric,0),2)
    OR (p_loan_payload->>'interestType'='none' AND coalesce((p_loan_payload->>'interestRatePercent')::numeric,0)<>0)
    OR (p_loan_payload->>'borrowerType'='eksternal' AND nullif(p_loan_payload->>'borrowerId','') IS NOT NULL)
    THEN RAISE EXCEPTION 'invalid interest terms or external borrower identity'; END IF;
  IF p_loan_payload IS NULL OR jsonb_typeof(p_loan_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload piutang tidak valid' USING ERRCODE = '22023';
  END IF;

  v_principal := (p_loan_payload->>'principalMinor')::BIGINT;
  IF v_principal IS NULL OR v_principal <= 0 THEN
    RAISE EXCEPTION 'Pokok pinjaman harus lebih dari nol' USING ERRCODE = '22023';
  END IF;

  IF (p_loan_payload->>'interestType') = 'flat' THEN
    v_rate := coalesce((p_loan_payload->>'interestRatePercent')::NUMERIC, 0.00);
    v_interest_minor := round((v_principal * round(v_rate * 100)) / 10000);
  ELSE
    v_interest_minor := 0;
    v_rate := 0.00;
  END IF;

  v_total_due := v_principal + v_interest_minor;

  IF p_command->>'operation' IS DISTINCT FROM 'expense' OR (p_command->>'amountMinor')::bigint IS DISTINCT FROM v_principal
    OR p_command->>'occurredOn' IS DISTINCT FROM p_loan_payload->>'disbursedOn' OR jsonb_array_length(p_command->'outgoing')<>1
    OR p_command->'outgoing'->0->>'pocketId' IS DISTINCT FROM p_loan_payload->>'disbursedFromPocketId'
    OR (p_loan_payload->>'interestMinor')::bigint IS DISTINCT FROM v_interest_minor OR (p_loan_payload->>'totalDueMinor')::bigint IS DISTINCT FROM v_total_due
    OR ((p_loan_payload->>'dueDate')::date < (p_loan_payload->>'disbursedOn')::date)
    THEN RAISE EXCEPTION 'disbursement command does not match contract'; END IF;
  -- 1. Eksekusi pengeluaran dana kas via canonical ledger
  v_tx_result := ptv_finance_private.post_transaction(p_account_id, p_session_iat, p_command);
  v_tx_id := (v_tx_result->>'transaction_id')::UUID;

  IF (v_tx_result->>'idempotent_replay')::BOOLEAN = true THEN
    SELECT * INTO v_existing_loan
      FROM public.ptv_finance_loans
     WHERE disbursement_tx_id = v_tx_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'transaction', v_tx_result,
      'loan', row_to_json(v_existing_loan)
    );
  END IF;

  -- 2. Rekam kontrak piutang dalam transaksi database yang sama
  v_loan_id := gen_random_uuid();
  INSERT INTO public.ptv_finance_loans (
    id, borrower_type, borrower_id, borrower_name, borrower_contact, borrower_institution,
    principal_minor, interest_type, interest_rate_percent, interest_minor,
    total_due_minor, total_paid_minor, remaining_minor,
    disbursed_on, due_date, disbursed_from_pocket_id, disbursement_tx_id,
    status, purpose, notes
  ) VALUES (
    v_loan_id,
    p_loan_payload->>'borrowerType',
    p_loan_payload->>'borrowerId',
    p_loan_payload->>'borrowerName',
    p_loan_payload->>'borrowerContact',
    p_loan_payload->>'borrowerInstitution',
    v_principal,
    coalesce(p_loan_payload->>'interestType', 'none'),
    v_rate,
    v_interest_minor,
    v_total_due,
    0,
    v_total_due,
    (p_command->>'occurredOn')::DATE,
    (p_loan_payload->>'dueDate')::DATE,
    (p_command->'outgoing'->0->>'pocketId')::UUID,
    v_tx_id,
    'aktif',
    p_loan_payload->>'purpose',
    p_loan_payload->>'notes'
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction', v_tx_result,
    'loan_id', v_loan_id,
    'total_due_minor', v_total_due,
    'remaining_minor', v_total_due
  );
END;
$$;

CREATE OR REPLACE FUNCTION ptv_finance_private.record_loan_payment_atomic(p_account_id uuid,p_session_iat bigint,p_command jsonb,p_payment_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; cmd jsonb; result jsonb; loan public.ptv_finance_loans; amount_value bigint; payment_id uuid;
BEGIN
 actor:=ptv_finance_private.authorize(p_account_id,p_session_iat,'finance.manage');
 cmd:=ptv_finance_private.operational_command(p_account_id,p_command,'loan_payment',p_payment_payload);
 result:=ptv_finance_private.operational_replay(p_account_id,cmd);
 IF result IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'transaction',result); END IF;
 SELECT * INTO STRICT loan FROM public.ptv_finance_loans WHERE id=(p_payment_payload->>'loanId')::uuid FOR UPDATE;
 amount_value:=(cmd->>'amountMinor')::bigint;
 IF loan.status NOT IN('aktif','overdue') OR amount_value IS NULL OR amount_value<=0 OR amount_value>loan.remaining_minor THEN RAISE EXCEPTION 'invalid repayment or overpayment'; END IF;
 IF cmd->>'operation' IS DISTINCT FROM 'income' OR amount_value IS DISTINCT FROM (p_payment_payload->>'amountMinor')::bigint
 OR cmd->>'occurredOn' IS DISTINCT FROM p_payment_payload->>'paidOn' OR jsonb_array_length(cmd->'incoming')<>1
 OR cmd->'incoming'->0->>'pocketId' IS DISTINCT FROM p_payment_payload->>'toPocketId' THEN RAISE EXCEPTION 'repayment command does not match payload'; END IF;
 result:=ptv_finance_private.post_transaction(p_account_id,p_session_iat,cmd);
 INSERT INTO public.ptv_finance_loan_payments(loan_id,paid_on,amount_minor,to_pocket_id,receipt_tx_id,method,notes)
 VALUES(loan.id,(cmd->>'occurredOn')::date,amount_value,(p_payment_payload->>'toPocketId')::uuid,(result->>'transaction_id')::uuid,coalesce(p_payment_payload->>'method','cash'),p_payment_payload->>'notes') RETURNING id INTO payment_id;
 UPDATE public.ptv_finance_loans SET total_paid_minor=total_paid_minor+amount_value,remaining_minor=remaining_minor-amount_value,
 status=CASE WHEN remaining_minor=amount_value THEN 'lunas' WHEN due_date<CURRENT_DATE THEN 'overdue' ELSE 'aktif' END,updated_at=now() WHERE id=loan.id;
 RETURN jsonb_build_object('success',true,'transaction',result,'payment_id',payment_id,'loan_id',loan.id);
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.reverse_transaction_151(p_account uuid,p_iat bigint,p_tx uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; tx public.ptv_finance_transactions; a record;
BEGIN
 actor:=ptv_finance_private.authorize(p_account,p_iat,'finance.manage');
 IF p_reason IS NULL OR length(trim(p_reason))<1 OR length(p_reason)>1000 THEN RAISE EXCEPTION 'reversal reason required'; END IF;
 SELECT * INTO STRICT tx FROM public.ptv_finance_transactions WHERE id=p_tx FOR UPDATE;
 IF tx.status='reversed' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true,'tx_id',p_tx); END IF;
 IF EXISTS(SELECT 1 FROM public.ptv_finance_loans l JOIN public.ptv_finance_loan_payments lp ON lp.loan_id=l.id WHERE l.disbursement_tx_id=p_tx AND lp.status='posted') THEN RAISE EXCEPTION 'reverse active repayments first'; END IF;
 PERFORM p.id FROM public.ptv_finance_pockets p WHERE p.id IN(SELECT pocket_id FROM public.ptv_finance_allocations WHERE transaction_id=p_tx) ORDER BY p.id FOR UPDATE;
 FOR a IN SELECT * FROM public.ptv_finance_allocations WHERE transaction_id=p_tx ORDER BY pocket_id LOOP
  IF a.direction='in' THEN
   UPDATE public.ptv_finance_pockets SET balance_minor=balance_minor-a.amount_minor,version=version+1,updated_at=now() WHERE id=a.pocket_id AND balance_minor>=a.amount_minor AND NOT archived;
  ELSE
   UPDATE public.ptv_finance_pockets SET balance_minor=balance_minor+a.amount_minor,version=version+1,updated_at=now() WHERE id=a.pocket_id AND NOT archived;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient balance or archived reversal pocket'; END IF;
 END LOOP;
 UPDATE public.ptv_finance_kas_payments SET status='reversed',reversal_reason=p_reason,reversed_at=now(),reversed_by_ptv_id=(SELECT ptv_id FROM public.canonical_identity WHERE id=actor) WHERE transaction_id=p_tx AND status='posted';
 UPDATE public.ptv_finance_kas_records r SET paid_amount_minor=(SELECT coalesce(sum(amount_minor),0) FROM public.ptv_finance_kas_payments p WHERE p.record_id=r.id AND p.status='posted'),
 status=CASE WHEN r.status='dikecualikan' THEN r.status WHEN (SELECT coalesce(sum(amount_minor),0) FROM public.ptv_finance_kas_payments p WHERE p.record_id=r.id AND p.status='posted')=0 THEN 'belum'
 WHEN (SELECT coalesce(sum(amount_minor),0) FROM public.ptv_finance_kas_payments p WHERE p.record_id=r.id AND p.status='posted')=r.amount_minor THEN 'lunas' ELSE 'sebagian' END,
 transaction_id=(SELECT p.transaction_id FROM public.ptv_finance_kas_payments p WHERE p.record_id=r.id AND p.status='posted' ORDER BY p.created_at DESC,p.id DESC LIMIT 1),
 payment_date=(SELECT p.paid_at FROM public.ptv_finance_kas_payments p WHERE p.record_id=r.id AND p.status='posted' ORDER BY p.created_at DESC,p.id DESC LIMIT 1),
 reversal_reason=p_reason,updated_at=now() WHERE r.id IN(SELECT record_id FROM public.ptv_finance_kas_payments WHERE transaction_id=p_tx);
 UPDATE public.ptv_finance_loan_payments SET status='reversed',reversal_reason=p_reason,reversed_at=now(),reversed_by=actor WHERE receipt_tx_id=p_tx AND status='posted';
 UPDATE public.ptv_finance_loans l SET total_paid_minor=(SELECT coalesce(sum(amount_minor),0) FROM public.ptv_finance_loan_payments p WHERE p.loan_id=l.id AND p.status='posted'),
 remaining_minor=l.total_due_minor-(SELECT coalesce(sum(amount_minor),0) FROM public.ptv_finance_loan_payments p WHERE p.loan_id=l.id AND p.status='posted'),status=CASE WHEN l.due_date<CURRENT_DATE THEN 'overdue' ELSE 'aktif' END,updated_at=now()
 WHERE l.id IN(SELECT loan_id FROM public.ptv_finance_loan_payments WHERE receipt_tx_id=p_tx);
 UPDATE public.ptv_finance_loans SET status='dibatalkan',updated_at=now() WHERE disbursement_tx_id=p_tx;
 UPDATE public.ptv_finance_transactions SET status='reversed',reversal_reason=p_reason,reversed_at=now(),reversed_by=actor WHERE id=p_tx;
 INSERT INTO public.ptv_finance_audit_log(entity_type,entity_id,action,actor_id,payload) VALUES('transaction',p_tx,'reverse',actor,jsonb_build_object('reason',p_reason));
 RETURN jsonb_build_object('success',true,'tx_id',p_tx,'status','reversed');
END $$;

CREATE OR REPLACE FUNCTION ptv_finance_private.void_finance_transaction(p_account_id uuid,p_session_iat bigint,p_tx_id uuid,p_reason text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT ptv_finance_private.reverse_transaction_151(p_account_id,p_session_iat,p_tx_id,p_reason) $$;
CREATE OR REPLACE FUNCTION ptv_finance_private.reverse_operational_record_atomic(p_account_id uuid,p_session_iat bigint,p_record_type text,p_record_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tx uuid;
BEGIN
 PERFORM ptv_finance_private.authorize(p_account_id,p_session_iat,'finance.manage');
 CASE p_record_type
 WHEN 'kas_kru' THEN
  SELECT transaction_id INTO STRICT tx FROM public.ptv_finance_kas_records WHERE id=p_record_id;
  -- Record-level cancellation is ambiguous after multiple installments: require a payment UUID.
  IF (SELECT count(*) FROM public.ptv_finance_kas_payments WHERE record_id=p_record_id AND status='posted')<>1 THEN RAISE EXCEPTION 'select an explicit installment for reversal'; END IF;
  SELECT transaction_id INTO STRICT tx FROM public.ptv_finance_kas_payments WHERE record_id=p_record_id AND status='posted';
 WHEN 'kas_payment' THEN SELECT transaction_id INTO STRICT tx FROM public.ptv_finance_kas_payments WHERE id=p_record_id;
 WHEN 'loan_disbursement' THEN SELECT disbursement_tx_id INTO STRICT tx FROM public.ptv_finance_loans WHERE id=p_record_id;
 WHEN 'loan_payment' THEN SELECT receipt_tx_id INTO STRICT tx FROM public.ptv_finance_loan_payments WHERE id=p_record_id;
 ELSE RAISE EXCEPTION 'invalid operational reversal type'; END CASE;
 IF tx IS NULL THEN RAISE EXCEPTION 'historical record has no reversible transaction'; END IF;
 RETURN ptv_finance_private.reverse_transaction_151(p_account_id,p_session_iat,tx,p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_post_finance_transaction_server(p_account_id uuid,p_session_iat bigint,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF p_command ? '_operational' THEN RAISE EXCEPTION 'reserved operational envelope'; END IF;
 RETURN ptv_finance_private.post_transaction(p_account_id,p_session_iat,p_command); END $$;

CREATE OR REPLACE FUNCTION public.rpc_record_kas_kru_payment_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_kas_payload JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.record_kas_kru_payment_atomic(p_account_id, p_session_iat, p_command, p_kas_payload);
$$;
CREATE OR REPLACE FUNCTION public.rpc_disburse_loan_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_loan_payload JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.disburse_loan_atomic(p_account_id, p_session_iat, p_command, p_loan_payload);
$$;
CREATE OR REPLACE FUNCTION public.rpc_record_loan_payment_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_command JSONB,
  p_payment_payload JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.record_loan_payment_atomic(p_account_id, p_session_iat, p_command, p_payment_payload);
$$;
CREATE OR REPLACE FUNCTION public.rpc_reverse_operational_record_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_record_type TEXT,
  p_record_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.reverse_operational_record_atomic(p_account_id, p_session_iat, p_record_type, p_record_id, p_reason);
$$;
CREATE OR REPLACE FUNCTION public.rpc_void_finance_transaction_atomic(
  p_account_id UUID,
  p_session_iat BIGINT,
  p_tx_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ptv_finance_private.void_finance_transaction(p_account_id, p_session_iat, p_tx_id, p_reason);
$$;
CREATE OR REPLACE FUNCTION public.fn_ptv_finance_prevent_audit_tampering()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 RAISE EXCEPTION 'Finance audit is immutable' USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION public.fn_ptv_finance_prevent_audit_tampering() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON public.ptv_finance_audit_log;
CREATE TRIGGER trg_prevent_audit_tampering BEFORE UPDATE OR DELETE ON public.ptv_finance_audit_log FOR EACH ROW EXECUTE FUNCTION public.fn_ptv_finance_prevent_audit_tampering();
DROP TRIGGER IF EXISTS finance151_audit_no_truncate ON public.ptv_finance_audit_log;
CREATE TRIGGER finance151_audit_no_truncate BEFORE TRUNCATE ON public.ptv_finance_audit_log FOR EACH STATEMENT EXECUTE FUNCTION public.fn_ptv_finance_prevent_audit_tampering();

CREATE OR REPLACE FUNCTION ptv_finance_private.owns_finance(p_account uuid,p_iat bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ptv_finance_private.can_account(p_account,p_iat,'hub.access')
 AND NOT EXISTS(SELECT 1 FROM public.account_capability_overrides WHERE account_id=p_account AND capability_key='finance.view_own' AND override_type='deny')
 AND (ptv_finance_private.can_account(p_account,p_iat,'finance.view_own') OR EXISTS(SELECT 1 FROM public.account_profiles WHERE account_id=p_account AND profile_id IN('crew','eksekutif','root_executive')))
$$;
CREATE OR REPLACE FUNCTION public.finance_own_native()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(ptv_finance_private.owns_finance(ptv_finance_private.native_account(),(auth.jwt()->>'iat')::bigint),false)
$$;
CREATE OR REPLACE FUNCTION ptv_finance_private.visible_transaction(p_account uuid,p_iat bigint,p_tx uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ptv_finance_private.can_account(p_account,p_iat,'hub.access') AND (
 ptv_finance_private.can_account(p_account,p_iat,'finance.manage') OR (
 (ptv_finance_private.can_account(p_account,p_iat,'finance.view') OR ptv_finance_private.can_account(p_account,p_iat,'finance.operator'))
 AND EXISTS(SELECT 1 FROM public.ptv_finance_transactions WHERE id=p_tx AND operational_envelope->>'kind' IN('general','kas_kru'))
 AND NOT EXISTS(SELECT 1 FROM public.ptv_finance_loans WHERE disbursement_tx_id=p_tx)
 AND NOT EXISTS(SELECT 1 FROM public.ptv_finance_loan_payments WHERE receipt_tx_id=p_tx)
 AND NOT EXISTS(SELECT 1 FROM public.ptv_finance_transactions WHERE id=p_tx AND operational_envelope->>'kind' IN('loan_disbursement','loan_payment')))
 OR (ptv_finance_private.owns_finance(p_account,p_iat) AND EXISTS(
 SELECT 1 FROM public.ptv_finance_loans l JOIN public.user_account a ON a.id=p_account JOIN public.canonical_identity ci ON ci.id=a.identity_id
 WHERE l.borrower_type='kru' AND l.borrower_id=ci.ptv_id AND (l.disbursement_tx_id=p_tx OR EXISTS(SELECT 1 FROM public.ptv_finance_loan_payments lp WHERE lp.loan_id=l.id AND lp.receipt_tx_id=p_tx))))
 )
$$;
CREATE OR REPLACE FUNCTION public.finance_visible_transaction(p_tx uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(ptv_finance_private.visible_transaction(ptv_finance_private.native_account(),(auth.jwt()->>'iat')::bigint,p_tx),false)
$$;
CREATE OR REPLACE FUNCTION public.rpc_finance_visible_transactions_server(p_account_id uuid,p_session_iat bigint,p_transaction_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid; manager boolean; global_scope boolean; visible jsonb;
BEGIN
 actor:=ptv_finance_private.authorize(p_account_id,p_session_iat,'hub.access');
 manager:=ptv_finance_private.can_account(p_account_id,p_session_iat,'finance.manage');
 global_scope:=manager OR ptv_finance_private.can_account(p_account_id,p_session_iat,'finance.view') OR ptv_finance_private.can_account(p_account_id,p_session_iat,'finance.operator');
 IF NOT global_scope AND NOT ptv_finance_private.owns_finance(p_account_id,p_session_iat) THEN RAISE EXCEPTION 'finance read permission required' USING ERRCODE='42501'; END IF;
 IF coalesce(cardinality(p_transaction_ids),0)>1000 THEN RAISE EXCEPTION 'scope request too large'; END IF;
 SELECT coalesce(jsonb_agg(DISTINCT t),'[]'::jsonb) INTO visible FROM unnest(p_transaction_ids)t WHERE ptv_finance_private.visible_transaction(p_account_id,p_session_iat,t);
 RETURN jsonb_build_object('identityId',actor,'canManage',manager,'global',global_scope,'visibleTransactionIds',visible);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_get_finance_loans_aggregate()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT (public.finance_can_native('finance.view') OR public.finance_can_native('finance.manage') OR public.finance_can_native('finance.operator') OR public.finance_own_native()) THEN
 RAISE EXCEPTION 'finance read permission required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('total_principal_minor',coalesce(sum(principal_minor),0)::text,'total_interest_minor',coalesce(sum(interest_minor),0)::text,
 'total_due_minor',coalesce(sum(total_due_minor),0)::text,'total_paid_minor',coalesce(sum(total_paid_minor),0)::text,'total_remaining_minor',coalesce(sum(remaining_minor),0)::text,
 'active_count',count(*) FILTER(WHERE status='aktif'),'overdue_count',count(*) FILTER(WHERE status='overdue'),'paid_count',count(*) FILTER(WHERE status='lunas')) INTO result
 FROM public.ptv_finance_loans WHERE status<>'dibatalkan' AND (
 public.finance_can_native('finance.manage') OR public.finance_can_native('finance.view') OR public.finance_can_native('finance.operator')
 OR (borrower_type='kru' AND borrower_id=public.current_authenticated_ptv_id()));
 RETURN result;
END $$;

DO $policies$
DECLARE tab text; rule text; r record;
 private_entries regprocedure[]:=ARRAY[
 'ptv_finance_private.authorize(uuid,bigint,text)'::regprocedure,'ptv_finance_private.can_account(uuid,bigint,text)'::regprocedure,
 'ptv_finance_private.owns_finance(uuid,bigint)'::regprocedure,'ptv_finance_private.visible_transaction(uuid,bigint,uuid)'::regprocedure,
 'ptv_finance_private.post_transaction(uuid,bigint,jsonb)'::regprocedure,'ptv_finance_private.record_kas_kru_payment_atomic(uuid,bigint,jsonb,jsonb)'::regprocedure,
 'ptv_finance_private.disburse_loan_atomic(uuid,bigint,jsonb,jsonb)'::regprocedure,'ptv_finance_private.record_loan_payment_atomic(uuid,bigint,jsonb,jsonb)'::regprocedure,
 'ptv_finance_private.reverse_operational_record_atomic(uuid,bigint,text,uuid,text)'::regprocedure,'ptv_finance_private.void_finance_transaction(uuid,bigint,uuid,text)'::regprocedure];
 public_entries regprocedure[]:=ARRAY[
 'public.rpc_post_finance_transaction_server(uuid,bigint,jsonb)'::regprocedure,'public.rpc_record_kas_kru_payment_atomic(uuid,bigint,jsonb,jsonb)'::regprocedure,
 'public.rpc_disburse_loan_atomic(uuid,bigint,jsonb,jsonb)'::regprocedure,'public.rpc_record_loan_payment_atomic(uuid,bigint,jsonb,jsonb)'::regprocedure,
 'public.rpc_reverse_operational_record_atomic(uuid,bigint,text,uuid,text)'::regprocedure,'public.rpc_void_finance_transaction_atomic(uuid,bigint,uuid,text)'::regprocedure,
 'public.rpc_finance_visible_transactions_server(uuid,bigint,uuid[])'::regprocedure];
BEGIN
 FOR tab,rule IN SELECT * FROM (VALUES
 ('ptv_finance_pockets', '(public.finance_can_native(''finance.view'') OR public.finance_can_native(''finance.manage'') OR public.finance_can_native(''finance.operator''))'),
 ('ptv_finance_categories','(public.finance_can_native(''finance.view'') OR public.finance_can_native(''finance.manage'') OR public.finance_can_native(''finance.operator''))'),
 ('ptv_finance_transactions','public.finance_visible_transaction(id)'),
 ('ptv_finance_allocations','public.finance_visible_transaction(transaction_id)'),
 ('ptv_finance_source_references','public.finance_visible_transaction(transaction_id)'),
 ('ptv_finance_audit_log','public.finance_can_native(''finance.manage'')'),
 ('ptv_finance_semesters','(public.finance_can_native(''finance.view'') OR public.finance_can_native(''finance.manage'') OR public.finance_own_native())'),
 ('ptv_finance_settings','(public.finance_can_native(''finance.view'') OR public.finance_can_native(''finance.manage''))'),
 ('ptv_finance_kas_records','(public.finance_can_native(''finance.manage'') OR (public.finance_own_native() AND ptv_id=public.current_authenticated_ptv_id()))'),
 ('ptv_finance_kas_payments','(public.finance_can_native(''finance.manage'') OR (public.finance_own_native() AND EXISTS(SELECT 1 FROM public.ptv_finance_kas_records r WHERE r.id=record_id AND r.ptv_id=public.current_authenticated_ptv_id())))'),
 ('ptv_finance_loans','(public.finance_can_native(''finance.manage'') OR (public.finance_own_native() AND borrower_type=''kru'' AND borrower_id=public.current_authenticated_ptv_id()))'),
 ('ptv_finance_loan_payments','(public.finance_can_native(''finance.manage'') OR (public.finance_own_native() AND EXISTS(SELECT 1 FROM public.ptv_finance_loans l WHERE l.id=loan_id AND l.borrower_type=''kru'' AND l.borrower_id=public.current_authenticated_ptv_id())))')
 )v(t,p) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('DROP POLICY IF EXISTS finance151_read ON public.%I',tab);
  EXECUTE format('DROP POLICY IF EXISTS finance151_read_guard ON public.%I',tab);
  EXECUTE format('CREATE POLICY finance151_read ON public.%I FOR SELECT TO authenticated USING(%s)',tab,rule);
  EXECUTE format('CREATE POLICY finance151_read_guard ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING(%s)',tab,rule);
  EXECUTE format('DROP POLICY IF EXISTS finance151_insert_guard ON public.%I',tab);
  EXECUTE format('DROP POLICY IF EXISTS finance151_update_guard ON public.%I',tab);
  EXECUTE format('DROP POLICY IF EXISTS finance151_delete_guard ON public.%I',tab);
  EXECUTE format('CREATE POLICY finance151_insert_guard ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false)',tab);
  EXECUTE format('CREATE POLICY finance151_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false)',tab);
  EXECUTE format('CREATE POLICY finance151_delete_guard ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING(false)',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated,service_role',tab);
  EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM service_role',tab);
 END LOOP;
 -- Every private function defaults to no client EXECUTE, including newly created helpers.
 FOR r IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ptv_finance_private' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.signature);
  IF r.signature=ANY(private_entries) THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
  END IF;
 END LOOP;
 FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND (p.proname IN('rpc_post_finance_transaction_server','rpc_record_kas_kru_payment_atomic','rpc_disburse_loan_atomic','rpc_record_loan_payment_atomic','rpc_reverse_operational_record_atomic','rpc_void_finance_transaction_atomic','rpc_finance_visible_transactions_server')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.signature);
  IF r.signature=ANY(public_entries) THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature); END IF;
 END LOOP;
END $policies$;
-- Managed Storage policies are installed separately by their existing owner.
REVOKE ALL ON FUNCTION public.finance_can_native(text),public.finance_own_native(),public.finance_visible_transaction(uuid),public.current_authenticated_ptv_id(),public.is_finance_restricted_personnel(),public.rpc_get_finance_loans_aggregate() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_can_native(text),public.finance_own_native(),public.finance_visible_transaction(uuid),public.current_authenticated_ptv_id(),public.is_finance_restricted_personnel(),public.rpc_get_finance_loans_aggregate() TO authenticated;

-- Review source; included inside the guarded Finance151 transaction.
ALTER TABLE public.ptv_finance_categories ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.ptv_finance_transactions ADD COLUMN IF NOT EXISTS notes text, ADD COLUMN IF NOT EXISTS proof_url text;
CREATE OR REPLACE FUNCTION ptv_finance_private.admin_mutation(p_account_id uuid,p_session_iat bigint,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; entity uuid; before_row jsonb; after_row jsonb; fields jsonb;
 tab text; audit_action text; result_key text; k text; label text;
BEGIN
 actor:=ptv_finance_private.authorize(p_account_id,p_session_iat,'finance.manage');
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 IF p_action IN('create_pocket','update_pocket','archive_pocket') THEN
  tab:='ptv_finance_pockets';result_key:='pocket';
  IF p_action<>'create_pocket' THEN
   entity:=(p_payload->>'pocketId')::uuid;
   SELECT to_jsonb(p) INTO STRICT before_row FROM public.ptv_finance_pockets p WHERE id=entity FOR UPDATE;
   IF (before_row->>'archived')::boolean THEN RAISE EXCEPTION 'Kantong sudah diarsipkan.'; END IF;
   IF jsonb_typeof(p_payload->'expectedVersion') IS DISTINCT FROM 'number' OR (p_payload->>'expectedVersion')::numeric IS DISTINCT FROM (before_row->>'version')::numeric THEN RAISE EXCEPTION 'Versi kantong berubah. Muat ulang.' USING ERRCODE='40001'; END IF;
  END IF;
  IF p_action='archive_pocket' THEN
   IF (before_row->>'balance_minor')::bigint<>0 THEN RAISE EXCEPTION 'Arsip memerlukan saldo nol.'; END IF;
   UPDATE public.ptv_finance_pockets SET archived=true,version=version+1,updated_at=now() WHERE id=entity RETURNING to_jsonb(ptv_finance_pockets) INTO after_row;
   audit_action:='archive';
  ELSE
   fields:=p_payload->'pocket';
   IF jsonb_typeof(fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid pocket'; END IF;
   FOR k IN SELECT jsonb_object_keys(fields) LOOP
    IF k NOT IN('name','kind','provider','accountNumber','accountHolder') OR jsonb_typeof(fields->k)<>'string' THEN RAISE EXCEPTION 'invalid pocket field'; END IF;
   END LOOP;
   label:=trim(fields->>'name');
   IF coalesce(length(label),0) NOT BETWEEN 1 AND 80 OR coalesce(fields->>'kind','') NOT IN('cash','bank','ewallet')
    OR fields->>'provider' IS NULL OR fields->>'accountNumber' IS NULL OR fields->>'accountHolder' IS NULL
    OR length(fields->>'provider')>80 OR length(fields->>'accountNumber')>64 OR length(fields->>'accountHolder')>120 THEN RAISE EXCEPTION 'invalid pocket fields'; END IF;
   IF (fields->>'kind'='cash' AND concat(fields->>'provider',fields->>'accountNumber',fields->>'accountHolder')<>'')
    OR (fields->>'kind'<>'cash' AND (trim(fields->>'provider')='' OR trim(fields->>'accountNumber')='' OR trim(fields->>'accountHolder')='')) THEN RAISE EXCEPTION 'invalid account information'; END IF;
   IF p_action='create_pocket' THEN
    INSERT INTO public.ptv_finance_pockets(name,kind,provider,account_number,account_holder,balance_minor,version,archived)
    VALUES(label,fields->>'kind',nullif(trim(fields->>'provider'),''),nullif(trim(fields->>'accountNumber'),''),nullif(trim(fields->>'accountHolder'),''),0,1,false)
    RETURNING id,to_jsonb(ptv_finance_pockets) INTO entity,after_row;
    audit_action:='create';
   ELSE
    UPDATE public.ptv_finance_pockets SET name=label,kind=fields->>'kind',provider=nullif(trim(fields->>'provider'),''),account_number=nullif(trim(fields->>'accountNumber'),''),account_holder=nullif(trim(fields->>'accountHolder'),''),version=version+1,updated_at=now()
    WHERE id=entity RETURNING to_jsonb(ptv_finance_pockets) INTO after_row;
    audit_action:='update';
   END IF;
  END IF;
 ELSIF p_action IN('create_category','update_category','archive_category','restore_category') THEN
  tab:='ptv_finance_categories';result_key:='category';
  IF p_action<>'create_category' THEN
   entity:=(p_payload->>'id')::uuid;
   SELECT to_jsonb(c) INTO STRICT before_row FROM public.ptv_finance_categories c WHERE id=entity FOR UPDATE;
   IF lower(trim(before_row->>'name')) IN('iuran kas kru','pencairan piutang','pengembalian pokok piutang','pendapatan bunga piutang') THEN RAISE EXCEPTION 'Kategori sistem dilindungi.'; END IF;
  END IF;
  IF p_action IN('create_category','update_category') THEN
   label:=trim(p_payload->>'name');
   IF jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR coalesce(length(label),0) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'invalid category name'; END IF;
   IF p_action='create_category' THEN
    IF coalesce(p_payload->>'kind','') NOT IN('income','expense') THEN RAISE EXCEPTION 'invalid category kind'; END IF;
    INSERT INTO public.ptv_finance_categories(name,kind,is_active) VALUES(label,p_payload->>'kind',true) RETURNING id,to_jsonb(ptv_finance_categories) INTO entity,after_row;
    audit_action:='create';
   ELSE
    UPDATE public.ptv_finance_categories SET name=label WHERE id=entity RETURNING to_jsonb(ptv_finance_categories) INTO after_row;
    audit_action:='update';
   END IF;
  ELSE
   UPDATE public.ptv_finance_categories SET is_active=(p_action='restore_category'),is_archived=(p_action='archive_category') WHERE id=entity RETURNING to_jsonb(ptv_finance_categories) INTO after_row;
   audit_action:=CASE WHEN p_action='archive_category' THEN 'archive' ELSE 'update' END;
  END IF;
 ELSIF p_action='update_transaction' THEN
  tab:='ptv_finance_transactions';result_key:='transaction';audit_action:='update';entity:=(p_payload->>'txId')::uuid;
  fields:=p_payload->'updates';
  IF jsonb_typeof(fields) IS DISTINCT FROM 'object' OR fields='{}'::jsonb THEN RAISE EXCEPTION 'invalid metadata'; END IF;
  FOR k IN SELECT jsonb_object_keys(fields) LOOP
   IF k NOT IN('description','occurredOn','categoryId','notes','proofUrl') OR jsonb_typeof(fields->k)<>'string' THEN RAISE EXCEPTION 'Only transaction metadata may be edited.'; END IF;
  END LOOP;
  SELECT to_jsonb(t) INTO STRICT before_row FROM public.ptv_finance_transactions t WHERE id=entity FOR UPDATE;
  IF before_row->>'status'<>'posted' THEN RAISE EXCEPTION 'Transaksi dibatalkan tidak dapat diedit.'; END IF;
  IF fields ? 'description' AND length(trim(fields->>'description')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid description'; END IF;
  IF fields ? 'occurredOn' AND (fields->>'occurredOn' !~ '^\d{4}-\d{2}-\d{2}$') THEN RAISE EXCEPTION 'invalid date'; END IF;
  IF fields ? 'categoryId' AND NOT EXISTS(SELECT 1 FROM public.ptv_finance_categories WHERE id=(fields->>'categoryId')::uuid AND is_active AND kind=before_row->>'kind') THEN RAISE EXCEPTION 'invalid category'; END IF;
  UPDATE public.ptv_finance_transactions SET
   description=CASE WHEN fields ? 'description' THEN trim(fields->>'description') ELSE description END,
   occurred_on=CASE WHEN fields ? 'occurredOn' THEN (fields->>'occurredOn')::date ELSE occurred_on END,
   category_id=CASE WHEN fields ? 'categoryId' THEN (fields->>'categoryId')::uuid ELSE category_id END,
   notes=CASE WHEN fields ? 'notes' THEN trim(fields->>'notes') ELSE notes END,
   proof_url=CASE WHEN fields ? 'proofUrl' THEN trim(fields->>'proofUrl') ELSE proof_url END
  WHERE id=entity RETURNING to_jsonb(ptv_finance_transactions) INTO after_row;
 ELSE RAISE EXCEPTION 'unsupported finance action' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.ptv_finance_audit_log(entity_type,entity_id,action,actor_id,payload)
 VALUES(result_key,entity,audit_action,actor,jsonb_build_object('before',before_row,'after',after_row));
 RETURN jsonb_build_object('success',true,result_key,after_row);
END $$;
CREATE OR REPLACE FUNCTION public.rpc_finance_admin_mutation_server(p_account_id uuid,p_session_iat bigint,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT ptv_finance_private.admin_mutation(p_account_id,p_session_iat,p_action,p_payload)
$$;
REVOKE ALL ON FUNCTION ptv_finance_private.admin_mutation(uuid,bigint,text,jsonb),public.rpc_finance_admin_mutation_server(uuid,bigint,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION ptv_finance_private.admin_mutation(uuid,bigint,text,jsonb),public.rpc_finance_admin_mutation_server(uuid,bigint,text,jsonb) TO service_role;

COMMIT;
