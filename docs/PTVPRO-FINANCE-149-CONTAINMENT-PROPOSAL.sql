-- PROPOSAL ONLY. Belum dijalankan atau diuji pada PostgreSQL/cloud.
-- ACC terpisah: pembatasan sementara; BUKAN migrasi penyelesaian B01-B04.
-- Wajib backup dan rehearsal clone. Tidak mengubah data, fungsi, policy atau histori.
-- Operator harus membandingkan physical system identifier dengan project Staging
-- swadgljnyelsjstqqxbm melalui koneksi administratif tepercaya sebelum BEGIN.
-- Placeholder sengaja membuat proposal ini tidak dapat dijalankan apa adanya.
BEGIN;
DO $guard$
BEGIN
  IF session_user <> 'postgres' OR current_user <> 'postgres'
     OR COALESCE(current_setting('request.jwt.claims', true), '') NOT IN ('', '{}') THEN
    RAISE EXCEPTION 'Koneksi administratif langsung diperlukan';
  END IF;
  IF (SELECT system_identifier::text FROM pg_control_system())
     <> '__ACC_STAGING_PHYSICAL_SYSTEM_IDENTIFIER__' THEN
    RAISE EXCEPTION 'Physical database tidak cocok dengan ACC Staging';
  END IF;
END;
$guard$;

REVOKE ALL ON FUNCTION public.rpc_get_finance_loans_aggregate()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_record_kas_kru_payment_atomic(uuid,bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION ptv_finance_private.record_kas_kru_payment_atomic(uuid,bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_disburse_loan_atomic(uuid,bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION ptv_finance_private.disburse_loan_atomic(uuid,bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_record_loan_payment_atomic(uuid,bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION ptv_finance_private.record_loan_payment_atomic(uuid,bigint,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_reverse_operational_record_atomic(uuid,bigint,text,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION ptv_finance_private.reverse_operational_record_atomic(uuid,bigint,text,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  public.ptv_finance_semesters, public.ptv_finance_kas_records,
  public.ptv_finance_kas_payments, public.ptv_finance_loans,
  public.ptv_finance_loan_payments, public.ptv_finance_settings
  FROM PUBLIC, anon, authenticated, service_role;

-- Baca canonical, posting canonical dan pembatalan canonical tidak dibuka/diganti.
-- Snapshot ACL efektif dan inheritance perlu dibandingkan pada clone serta Staging;
-- REVOKE langsung tidak membuktikan tidak adanya grant melalui role lain.
COMMIT;
