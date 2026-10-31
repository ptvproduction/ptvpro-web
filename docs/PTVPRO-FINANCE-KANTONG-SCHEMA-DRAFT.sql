-- DRAFT v1 / BELUM DIEKSEKUSI. Memerlukan ACC operator; PostgreSQL 17 Staging.
-- Project Target Staging: swadgljnyelsjstqqxbm (db.swadgljnyelsjstqqxbm.supabase.co).
-- Rujukan spesifikasi: docs/PTVPRO-FINANCE-TRANSACTION-CONTRACT.md & src/products/hub/keuangan/financeCanonical.ts.
--
-- Prasyarat sebelum eksekusi kelak:
-- 1. Backup snapshot data & ACL Staging terbaru.
-- 2. Operator menyisipkan GUC konfirmasi:
--      SET LOCAL app.target_project_ref = 'swadgljnyelsjstqqxbm';
--      SET LOCAL app.finance_schema_acc_confirmed = 'yes';
-- 3. Semua tabel baru dibuat dengan RLS AKTIF dan direct write ditutup dari PUBLIC/anon/authenticated.
-- 4. Error apa pun: STOP, ROLLBACK; dilarang melanjutkan sebagian script.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL app.target_project_ref = 'swadgljnyelsjstqqxbm';
SET LOCAL app.finance_schema_acc_confirmed = 'yes';

-- ============================================================================
-- 1. GUARD & ASSERTION ENVIRONMENT STAGING
-- ============================================================================
DO $$
BEGIN
  IF current_setting('app.target_project_ref', true) IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN
    RAISE EXCEPTION 'Target Staging belum dikonfirmasi (swadgljnyelsjstqqxbm); hentikan eksekusi';
  END IF;
  IF current_setting('app.finance_schema_acc_confirmed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'ACC eksplisit operator untuk DDL schema Kantong belum diberikan';
  END IF;
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'Draft schema ini memerlukan PostgreSQL 17 atau lebih baru';
  END IF;
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

  -- Constraint jenis kantong
  CONSTRAINT check_pocket_kind CHECK (kind IN ('cash', 'bank', 'ewallet')),

  -- Validasi jenis akun:
  -- - cash: provider, account_number, account_holder WAJIB NULL
  -- - bank & ewallet: provider, account_number, account_holder WAJIB DIISI
  CONSTRAINT check_pocket_kind_details CHECK (
    (kind = 'cash' AND provider IS NULL AND account_number IS NULL AND account_holder IS NULL)
    OR
    (kind IN ('bank', 'ewallet') AND provider IS NOT NULL AND account_number IS NOT NULL AND account_holder IS NOT NULL)
  ),

  -- Versi optimistik OCC
  CONSTRAINT check_pocket_version CHECK (version >= 1),

  -- Saldo canonical dalam sen minor IDR: dilarang negatif
  CONSTRAINT check_pocket_balance_non_negative CHECK (balance_minor >= 0),

  -- Kelengkapan metadata QRIS: wajib lengkap semua atau kosong semua
  CONSTRAINT check_pocket_qris_metadata CHECK (
    (qris_asset_path IS NULL AND qris_merchant_name IS NULL AND qris_nmid IS NULL AND qris_verified_at IS NULL)
    OR
    (qris_asset_path IS NOT NULL AND qris_merchant_name IS NOT NULL AND qris_nmid IS NOT NULL AND qris_verified_at IS NOT NULL)
  ),

  -- Guard arsip: hanya boleh diarsipkan jika saldo terverifikasi nol
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
  CONSTRAINT unique_category_name_kind UNIQUE (name, kind)
);

CREATE INDEX IF NOT EXISTS idx_ptv_finance_categories_kind_active ON public.ptv_finance_categories (kind, is_active);

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

  -- Aturan kategori:
  -- - transfer: category_id WAJIB NULL
  -- - income & expense: category_id WAJIB DIISI
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

  -- Satu kantong hanya boleh muncul satu kali dalam transaksi yang sama
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
  -- Pencegahan rekonsiliasi ganda: satu record legacy hanya boleh dipetakan satu kali ke transaksi canonical
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

-- Trigger pelindung: ptv_finance_audit_log tidak boleh di-UPDATE atau di-DELETE
CREATE OR REPLACE FUNCTION public.fn_ptv_finance_prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log ptv_finance_audit_log bersifat immutable; dilarang UPDATE atau DELETE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON public.ptv_finance_audit_log;
CREATE TRIGGER trg_prevent_audit_tampering
  BEFORE UPDATE OR DELETE ON public.ptv_finance_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ptv_finance_prevent_audit_tampering();

-- ============================================================================
-- 7. PENGAMANAN AKSES (RLS & PRIVILEGES)
-- ============================================================================
-- Aktifkan RLS pada seluruh tabel canonical Finance
ALTER TABLE public.ptv_finance_pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptv_finance_audit_log ENABLE ROW LEVEL SECURITY;

-- Cabut seluruh direct write dari PUBLIC, anon, dan authenticated
REVOKE ALL ON public.ptv_finance_pockets FROM PUBLIC, anon, authenticated RESTRICT;
REVOKE ALL ON public.ptv_finance_categories FROM PUBLIC, anon, authenticated RESTRICT;
REVOKE ALL ON public.ptv_finance_transactions FROM PUBLIC, anon, authenticated RESTRICT;
REVOKE ALL ON public.ptv_finance_allocations FROM PUBLIC, anon, authenticated RESTRICT;
REVOKE ALL ON public.ptv_finance_source_references FROM PUBLIC, anon, authenticated RESTRICT;
REVOKE ALL ON public.ptv_finance_audit_log FROM PUBLIC, anon, authenticated RESTRICT;

-- Berikan izin SELECT terkontrol bagi authenticated (akan disaring RLS atau dibaca melalui API server)
GRANT SELECT ON public.ptv_finance_pockets TO authenticated;
GRANT SELECT ON public.ptv_finance_categories TO authenticated;
GRANT SELECT ON public.ptv_finance_transactions TO authenticated;
GRANT SELECT ON public.ptv_finance_allocations TO authenticated;
GRANT SELECT ON public.ptv_finance_source_references TO authenticated;

-- Pastikan service_role memiliki akses penuh untuk backend adapter / RPC server
GRANT ALL ON public.ptv_finance_pockets TO service_role;
GRANT ALL ON public.ptv_finance_categories TO service_role;
GRANT ALL ON public.ptv_finance_transactions TO service_role;
GRANT ALL ON public.ptv_finance_allocations TO service_role;
GRANT ALL ON public.ptv_finance_source_references TO service_role;
GRANT ALL ON public.ptv_finance_audit_log TO service_role;

-- Kebijakan RLS SELECT untuk authenticated:
-- Pengguna hanya dapat membaca data jika memiliki capability finance.view atau finance.manage
CREATE POLICY ptv_finance_pockets_read_policy ON public.ptv_finance_pockets
  FOR SELECT TO authenticated
  USING (
    public.has_capability('finance.view') OR public.has_capability('finance.manage')
  );

CREATE POLICY ptv_finance_categories_read_policy ON public.ptv_finance_categories
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR public.has_capability('finance.view')
    OR public.has_capability('finance.manage')
  );

CREATE POLICY ptv_finance_transactions_read_policy ON public.ptv_finance_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_capability('finance.view') OR public.has_capability('finance.manage')
  );

CREATE POLICY ptv_finance_allocations_read_policy ON public.ptv_finance_allocations
  FOR SELECT TO authenticated
  USING (
    public.has_capability('finance.view') OR public.has_capability('finance.manage')
  );

CREATE POLICY ptv_finance_source_refs_read_policy ON public.ptv_finance_source_references
  FOR SELECT TO authenticated
  USING (
    public.has_capability('finance.view') OR public.has_capability('finance.manage')
  );

-- Tidak ada policy INSERT/UPDATE/DELETE untuk role klien (anon/authenticated).
-- Seluruh mutasi hanya boleh dilakukan melalui SECURITY DEFINER RPC server yang memverifikasi saldo,
-- lock, OCC versioning, alokasi seimbang, dan mencatat ptv_finance_audit_log secara atomik.

COMMIT;

-- ============================================================================
-- CATATAN ROLLBACK JIKA DIPERLUKAN (SEBELUM DATA LIVE DIMASUKKAN):
-- ============================================================================
-- DROP TABLE IF EXISTS public.ptv_finance_audit_log CASCADE;
-- DROP TABLE IF EXISTS public.ptv_finance_allocations CASCADE;
-- DROP TABLE IF EXISTS public.ptv_finance_transactions CASCADE;
-- DROP TABLE IF EXISTS public.ptv_finance_categories CASCADE;
-- DROP TABLE IF EXISTS public.ptv_finance_pockets CASCADE;
-- DROP FUNCTION IF EXISTS public.fn_ptv_finance_prevent_audit_tampering CASCADE;
