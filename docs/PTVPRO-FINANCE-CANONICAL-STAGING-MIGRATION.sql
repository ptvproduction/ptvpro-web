-- ============================================================================
-- PTV PRO — FINANCE 2.0 CANONICAL COMPLETE STAGING MIGRATION (HARDENED v3)
-- Project Target Staging: swadgljnyelsjstqqxbm (db.swadgljnyelsjstqqxbm.supabase.co)
-- Sesi: PTV-DEV-115 | ACC Operator: zidnal (21 Oktober 2026)
--
-- Karakteristik & Jaminan:
-- 1. 100% Aditif: Hanya membuat 6 tabel ptv_finance_* dan 1 schema privat.
--    TIDAK MENGUBAH, MENGHAPUS, ATAU MERUBAH TABEL/DATA LEGACY (53 baris tetap utuh).
-- 2. Anti-Spoofing: Verifikasi actor live melalui ptv_finance_private.authorize.
-- 3. Idempotensi Deterministik: Menghitung SHA-256 hash payload, menolak tabrakan key.
-- 4. Anti-Deadlock: Penguncian baris kantong terurut ASC (FOR UPDATE).
-- 5. Zero Direct Write: RLS aktif di seluruh tabel, write hanya via RPC/service_role.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================================
-- 1. GUARD & ASSERTION ENVIRONMENT STAGING (BUKTI STRUKTURAL NYATA)
-- ============================================================================
DO $$
DECLARE
  v_has_prod_tables BOOLEAN;
  v_has_staging_tables BOOLEAN;
BEGIN
  -- 1a. Database name check
  IF current_database() IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'FATAL: Database aktif adalah %, bukan postgres!', current_database();
  END IF;

  -- 1b. PostgreSQL version check (memerlukan PG 17+)
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'Draft schema ini memerlukan PostgreSQL 17 atau lebih baru (terdeteksi: %)', current_setting('server_version_num');
  END IF;

  -- 1c. Anti-Production Barrier: tabel fisik Production dilarang ada di public schema
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('ptv_ebook', 'ptv_galeri', 'ptv_tugas', 'ptv_aset', 'ptv_pendaftar')
  ) INTO v_has_prod_tables;

  IF v_has_prod_tables THEN
    RAISE EXCEPTION 'FATAL ANTI-PRODUCTION BARRIER: Terdeteksi tabel fisik Production aktif (ptv_ebook/ptv_aset/dll). Database ini terindikasi PRODUCTION (jthzuhkblxcaohiuypqq)! Eksekusi DIBATALKAN SEKETIKA.';
  END IF;

  -- 1d. Positive Staging Architecture Barrier: tabel arsitektur Staging modern wajib ada
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'account_profiles'
  ) INTO v_has_staging_tables;

  IF NOT v_has_staging_tables THEN
    RAISE EXCEPTION 'FATAL: Tabel arsitektur Staging (account_profiles) tidak ditemukan. Eksekusi dibatalkan.';
  END IF;

  -- 1e. Positive Capability Resolver Check: fungsi resolver has_capability wajib ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'has_capability'
  ) THEN
    RAISE EXCEPTION 'FATAL: Fungsi public.has_capability tidak ditemukan di Staging.';
  END IF;

  -- 1f. Definitive Staging Fingerprint Barrier:
  -- Data legacy staging swadgljnyelsjstqqxbm memiliki tepat:
  -- 43 baris ptv_pemasukan dengan total nominal Rp 1.244.200
  -- 10 baris ptv_pengeluaran dengan total nominal Rp 633.924
  -- Di database Production, jumlah dan total transaksi jauh lebih besar.
  DECLARE
    v_inc_count BIGINT;
    v_inc_sum BIGINT;
    v_exp_count BIGINT;
    v_exp_sum BIGINT;
  BEGIN
    SELECT count(*), coalesce(sum(nominal), 0)
      INTO v_inc_count, v_inc_sum
      FROM public.ptv_pemasukan;

    SELECT count(*), coalesce(sum(nominal), 0)
      INTO v_exp_count, v_exp_sum
      FROM public.ptv_pengeluaran;

    IF v_inc_count <> 43 OR v_inc_sum <> 1244200
       OR v_exp_count <> 10 OR v_exp_sum <> 633924 THEN
      RAISE EXCEPTION 'FATAL STAGING FINGERPRINT MISMATCH: Data baseline legacy tidak cocok dengan Staging swadgljnyelsjstqqxbm (terdeteksi: inc % baris Rp %, exp % baris Rp %). Target database bukan Staging yang sah!',
        v_inc_count, v_inc_sum, v_exp_count, v_exp_sum;
    END IF;
  END;
END $$;

-- ============================================================================
-- 2. TABEL: ptv_finance_pockets (Kantong / Rekening / Kas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_pockets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  provider VARCHAR(80) NULL,
  account_number VARCHAR(64) NULL,
  account_holder VARCHAR(120) NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  balance_minor BIGINT NOT NULL DEFAULT 0,
  qris_asset_path TEXT NULL,
  qris_merchant_name TEXT NULL,
  qris_nmid TEXT NULL,
  qris_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_pocket_kind CHECK (kind IN ('cash', 'bank', 'ewallet')),
  CONSTRAINT check_pocket_name_length CHECK (length(trim(name)) >= 1),
  CONSTRAINT check_pocket_kind_details CHECK (
    (kind = 'cash' AND provider IS NULL AND account_number IS NULL AND account_holder IS NULL)
    OR
    (kind IN ('bank', 'ewallet') AND provider IS NOT NULL AND account_number IS NOT NULL AND account_holder IS NOT NULL)
  ),
  CONSTRAINT check_pocket_version CHECK (version >= 1),
  CONSTRAINT check_pocket_balance_non_negative CHECK (balance_minor >= 0),
  CONSTRAINT check_pocket_qris_metadata CHECK (
    (qris_asset_path IS NULL AND qris_merchant_name IS NULL AND qris_nmid IS NULL AND qris_verified_at IS NULL)
    OR
    (qris_asset_path IS NOT NULL AND qris_merchant_name IS NOT NULL AND qris_nmid IS NOT NULL AND qris_verified_at IS NOT NULL)
  ),
  CONSTRAINT check_pocket_archive_zero_balance CHECK (
    NOT archived OR balance_minor = 0
  )
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_pockets_archived ON public.ptv_finance_pockets (archived);
CREATE INDEX IF NOT EXISTS idx_ptv_finance_pockets_kind ON public.ptv_finance_pockets (kind);

-- ============================================================================
-- 3. TABEL: ptv_finance_categories (Kategori Transaksi Canonical)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_category_kind CHECK (kind IN ('income', 'expense')),
  CONSTRAINT check_category_name_length CHECK (length(trim(name)) >= 1),
  CONSTRAINT unique_category_name_kind UNIQUE (name, kind)
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_categories_kind_active ON public.ptv_finance_categories (kind, is_active);

-- Seed kategori canonical awal secara aditif dan idempoten
INSERT INTO public.ptv_finance_categories (name, kind) VALUES
  ('Kas Masuk / Operasional', 'income'),
  ('Iuran Kru', 'income'),
  ('Jasa Produksi / Liputan', 'income'),
  ('Donasi & Sponsor', 'income'),
  ('Lain-lain (Pemasukan)', 'income'),
  ('Operasional Studio', 'expense'),
  ('Konsumsi & Logistik', 'expense'),
  ('Transportasi', 'expense'),
  ('Peralatan & Perlengkapan', 'expense'),
  ('Pemeliharaan Alat', 'expense'),
  ('Lain-lain (Pengeluaran)', 'expense')
ON CONFLICT (name, kind) DO NOTHING;

-- ============================================================================
-- 4. TABEL: ptv_finance_transactions (Header Transaksi Multi-Kantong)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_on DATE NOT NULL,
  description TEXT NOT NULL,
  kind VARCHAR(20) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
  amount_minor BIGINT NOT NULL,
  category_id UUID NULL REFERENCES public.ptv_finance_categories(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'posted',
  idempotency_key UUID NOT NULL UNIQUE,
  command_hash VARCHAR(64) NOT NULL,
  audit_reference TEXT NOT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_tx_kind CHECK (kind IN ('income', 'expense', 'transfer')),
  CONSTRAINT check_tx_currency CHECK (currency = 'IDR'),
  CONSTRAINT check_tx_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT check_tx_status CHECK (status IN ('posted', 'reversed')),
  CONSTRAINT check_tx_category_rule CHECK (
    (kind = 'transfer' AND category_id IS NULL)
    OR
    (kind IN ('income', 'expense') AND category_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_transactions_occurred ON public.ptv_finance_transactions (occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_ptv_finance_transactions_kind ON public.ptv_finance_transactions (kind);
CREATE INDEX IF NOT EXISTS idx_ptv_finance_transactions_status ON public.ptv_finance_transactions (status);

-- ============================================================================
-- 5. TABEL: ptv_finance_allocations (Baris Alokasi Multi-Kantong)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.ptv_finance_transactions(id) ON DELETE RESTRICT,
  pocket_id UUID NOT NULL REFERENCES public.ptv_finance_pockets(id) ON DELETE RESTRICT,
  direction VARCHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_allocation_direction CHECK (direction IN ('in', 'out')),
  CONSTRAINT check_allocation_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT unique_tx_pocket UNIQUE (transaction_id, pocket_id)
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_allocations_tx ON public.ptv_finance_allocations (transaction_id);
CREATE INDEX IF NOT EXISTS idx_ptv_finance_allocations_pocket ON public.ptv_finance_allocations (pocket_id);

-- ============================================================================
-- 6. TABEL: ptv_finance_source_references (Relasi Sumber Legacy & Anti Double-Counting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_source_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.ptv_finance_transactions(id) ON DELETE RESTRICT,
  source_table VARCHAR(30) NOT NULL,
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_source_table CHECK (source_table IN ('ptv_pemasukan', 'ptv_pengeluaran')),
  CONSTRAINT unique_source_record_mapping UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_source_refs_tx ON public.ptv_finance_source_references (transaction_id);
CREATE INDEX IF NOT EXISTS idx_ptv_finance_source_refs_src ON public.ptv_finance_source_references (source_table, source_id);

-- ============================================================================
-- 7. TABEL: ptv_finance_audit_log (Audit Trail Immutable Append-Only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ptv_finance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(30) NOT NULL,
  actor_id UUID NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_audit_entity CHECK (entity_type IN ('pocket', 'category', 'transaction', 'source_reference')),
  CONSTRAINT check_audit_action CHECK (action IN ('create', 'update', 'archive', 'post', 'reverse'))
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_audit_entity ON public.ptv_finance_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ptv_finance_audit_occurred ON public.ptv_finance_audit_log (occurred_at DESC);

CREATE OR REPLACE FUNCTION public.fn_ptv_finance_prevent_audit_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log ptv_finance_audit_log bersifat immutable; dilarang UPDATE atau DELETE' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON public.ptv_finance_audit_log;
CREATE TRIGGER trg_prevent_audit_tampering
  BEFORE UPDATE OR DELETE ON public.ptv_finance_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ptv_finance_prevent_audit_tampering();

-- ============================================================================
-- 8. PENGAMANAN AKSES (RLS & PRIVILEGES)
-- ============================================================================
ALTER TABLE public.ptv_finance_pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ptv_finance_pockets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_source_references FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ptv_finance_audit_log FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.ptv_finance_pockets TO authenticated;
GRANT SELECT ON public.ptv_finance_categories TO authenticated;
GRANT SELECT ON public.ptv_finance_transactions TO authenticated;
GRANT SELECT ON public.ptv_finance_allocations TO authenticated;
GRANT SELECT ON public.ptv_finance_source_references TO authenticated;

GRANT ALL ON public.ptv_finance_pockets TO service_role;
GRANT ALL ON public.ptv_finance_categories TO service_role;
GRANT ALL ON public.ptv_finance_transactions TO service_role;
GRANT ALL ON public.ptv_finance_allocations TO service_role;
GRANT ALL ON public.ptv_finance_source_references TO service_role;
GRANT ALL ON public.ptv_finance_audit_log TO service_role;

-- Kebijakan RLS SELECT authenticated (memanfaatkan has_capability live, aman dijalankan ulang)
DROP POLICY IF EXISTS ptv_finance_pockets_read_policy ON public.ptv_finance_pockets;
CREATE POLICY ptv_finance_pockets_read_policy ON public.ptv_finance_pockets
  FOR SELECT TO authenticated
  USING (public.has_capability('finance.view') OR public.has_capability('finance.manage'));

DROP POLICY IF EXISTS ptv_finance_categories_read_policy ON public.ptv_finance_categories;
CREATE POLICY ptv_finance_categories_read_policy ON public.ptv_finance_categories
  FOR SELECT TO authenticated
  USING (
    (public.has_capability('finance.view') AND is_active = true)
    OR public.has_capability('finance.manage')
  );

DROP POLICY IF EXISTS ptv_finance_transactions_read_policy ON public.ptv_finance_transactions;
CREATE POLICY ptv_finance_transactions_read_policy ON public.ptv_finance_transactions
  FOR SELECT TO authenticated
  USING (public.has_capability('finance.view') OR public.has_capability('finance.manage'));

DROP POLICY IF EXISTS ptv_finance_allocations_read_policy ON public.ptv_finance_allocations;
CREATE POLICY ptv_finance_allocations_read_policy ON public.ptv_finance_allocations
  FOR SELECT TO authenticated
  USING (public.has_capability('finance.view') OR public.has_capability('finance.manage'));

DROP POLICY IF EXISTS ptv_finance_source_refs_read_policy ON public.ptv_finance_source_references;
CREATE POLICY ptv_finance_source_refs_read_policy ON public.ptv_finance_source_references
  FOR SELECT TO authenticated
  USING (public.has_capability('finance.view') OR public.has_capability('finance.manage'));

-- ============================================================================
-- 9. SCHEMA PRIVAT & FUNGSI OTORISASI LIVE
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS ptv_finance_private;
REVOKE ALL ON SCHEMA ptv_finance_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ptv_finance_private TO service_role;

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
  -- Server-only authorization: Caller session harus merupakan direct database session postgres (misal SQL Editor / test runner terisolasi)
  -- ATAU request dari PostgREST dengan klaim service_role.
  -- CATATAN KEAMANAN: Di dalam SECURITY DEFINER, current_user selalu berubah menjadi function owner ('postgres'),
  -- sehingga caller asli WAJIB diperiksa via session_user atau request.jwt.claims->>'role', bukan current_user.
  IF session_user IS DISTINCT FROM 'postgres'
     AND COALESCE(current_setting('request.jwt.claims', true)::JSONB->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Server-only finance authorization required' USING ERRCODE = '42501';
  END IF;

  IF p_cap IS NULL OR p_cap NOT IN ('finance.view', 'finance.manage') THEN
    RAISE EXCEPTION 'Invalid finance capability requested: %', p_cap USING ERRCODE = '42501';
  END IF;

  SELECT identity_id, tokens_valid_after
    INTO v_actor, v_valid_after
    FROM public.user_account
   WHERE id = p_account_id AND status_akun = 'active';

  IF v_actor IS NULL OR p_session_iat IS NULL
     OR (v_valid_after IS NOT NULL AND p_session_iat < extract(epoch FROM v_valid_after)::BIGINT) THEN
    RAISE EXCEPTION 'Active unrevoked Hub session required' USING ERRCODE = '42501';
  END IF;

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

  RETURN v_actor;
END;
$$;

REVOKE ALL ON FUNCTION ptv_finance_private.authorize(UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ptv_finance_private.authorize(UUID, BIGINT, TEXT) TO service_role;

-- ============================================================================
-- 10. FUNGSI INTI MUTASI ATOMIK MULTI-KANTONG
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
  v_verified_actor_id := ptv_finance_private.authorize(p_account_id, p_session_iat, 'finance.manage');

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

  IF jsonb_typeof(v_incoming) <> 'array' THEN
    RAISE EXCEPTION 'Field incoming wajib berupa JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_outgoing) <> 'array' THEN
    RAISE EXCEPTION 'Field outgoing wajib berupa JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_source_refs) <> 'array' THEN
    RAISE EXCEPTION 'Field sourceReferences wajib berupa JSON array' USING ERRCODE = '22023';
  END IF;

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

  SELECT id, amount_minor, kind, status, occurred_on, command_hash, created_by
    INTO v_existing_tx
    FROM public.ptv_finance_transactions
   WHERE idempotency_key = v_idempotency_key;

  IF FOUND THEN
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
      RAISE EXCEPTION 'Idempotency key % sudah digunakan dengan detail transaksi atau actor berbeda', v_idempotency_key
        USING ERRCODE = '23505';
    END IF;
  END IF;

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

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_incoming) LOOP
    IF jsonb_typeof(v_line) <> 'object' THEN
      RAISE EXCEPTION 'Elemen alokasi incoming harus berupa JSON object' USING ERRCODE = '22023';
    END IF;
    IF (v_line->>'pocketId') IS NULL
       OR (v_line->>'pocketId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Alokasi incoming wajib memiliki pocketId berupa UUID valid non-null' USING ERRCODE = '22023';
    END IF;
    v_line_amount := (v_line->>'amountMinor')::BIGINT;
    IF v_line_amount IS NULL OR v_line_amount <= 0 THEN
      RAISE EXCEPTION 'Alokasi incoming memiliki nominal tidak valid' USING ERRCODE = '22023';
    END IF;
    v_in_sum := v_in_sum + v_line_amount;
  END LOOP;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_outgoing) LOOP
    IF jsonb_typeof(v_line) <> 'object' THEN
      RAISE EXCEPTION 'Elemen alokasi outgoing harus berupa JSON object' USING ERRCODE = '22023';
    END IF;
    IF (v_line->>'pocketId') IS NULL
       OR (v_line->>'pocketId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Alokasi outgoing wajib memiliki pocketId berupa UUID valid non-null' USING ERRCODE = '22023';
    END IF;
    v_line_amount := (v_line->>'amountMinor')::BIGINT;
    IF v_line_amount IS NULL OR v_line_amount <= 0 THEN
      RAISE EXCEPTION 'Alokasi outgoing memiliki nominal tidak valid' USING ERRCODE = '22023';
    END IF;
    v_out_sum := v_out_sum + v_line_amount;
  END LOOP;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_source_refs) LOOP
    IF jsonb_typeof(v_line) <> 'object' THEN
      RAISE EXCEPTION 'Elemen sourceReferences harus berupa JSON object' USING ERRCODE = '22023';
    END IF;
    IF (v_line->>'kind') IS NULL OR (v_line->>'kind') NOT IN ('pemasukan', 'pengeluaran') THEN
      RAISE EXCEPTION 'sourceReference kind harus berupa pemasukan atau pengeluaran' USING ERRCODE = '22023';
    END IF;
    IF (v_line->>'id') IS NULL
       OR (v_line->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'sourceReference id wajib berupa UUID valid non-null' USING ERRCODE = '22023';
    END IF;
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
  -- Validasi anti-duplikasi kantong dalam satu transaksi (mencegah asal sekaligus tujuan atau kantong ganda)
  IF (
    SELECT count(*)
      FROM (
        SELECT (val->>'pocketId')::UUID AS p FROM jsonb_array_elements(v_incoming) val
        UNION ALL
        SELECT (val->>'pocketId')::UUID AS p FROM jsonb_array_elements(v_outgoing) val
      ) all_allocs
  ) <> (
    SELECT count(DISTINCT p)
      FROM (
        SELECT (val->>'pocketId')::UUID AS p FROM jsonb_array_elements(v_incoming) val
        UNION ALL
        SELECT (val->>'pocketId')::UUID AS p FROM jsonb_array_elements(v_outgoing) val
      ) uniq_allocs
  ) THEN
    RAISE EXCEPTION 'Kantong tidak boleh berulang dalam satu transaksi atau menjadi asal sekaligus tujuan' USING ERRCODE = '22023';
  END IF;

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

  PERFORM id
     FROM public.ptv_finance_pockets
    WHERE id = ANY(v_sorted_pockets)
    ORDER BY id ASC
      FOR UPDATE;

  IF (SELECT count(*) FROM public.ptv_finance_pockets WHERE id = ANY(v_sorted_pockets)) <> cardinality(v_sorted_pockets) THEN
    RAISE EXCEPTION 'Satu atau lebih Kantong yang dipilih tidak ditemukan di database' USING ERRCODE = '22023';
  END IF;

  FOR v_pocket_record IN
    SELECT id, name, archived, balance_minor, version
      FROM public.ptv_finance_pockets
     WHERE id = ANY(v_sorted_pockets)
     ORDER BY id ASC
  LOOP
    IF v_pocket_record.archived THEN
      RAISE EXCEPTION 'Kantong "%" (%) sudah diarsipkan; tidak dapat menerima transaksi', v_pocket_record.name, v_pocket_record.id USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM((val->>'amountMinor')::BIGINT), 0)
      INTO v_out_sum
      FROM jsonb_array_elements(v_outgoing) val
     WHERE (val->>'pocketId')::UUID = v_pocket_record.id;

    IF v_out_sum > 0 AND v_pocket_record.balance_minor < v_out_sum THEN
      RAISE EXCEPTION 'Saldo kantong "%" tidak mencukupi (tersedia: %, dibutuhkan: %). Saldo negatif dilarang',
        v_pocket_record.name, v_pocket_record.balance_minor, v_out_sum USING ERRCODE = '22023';
    END IF;
  END LOOP;

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
-- 11. PUBLIC WRAPPER (SERVER-ONLY RPC)
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
