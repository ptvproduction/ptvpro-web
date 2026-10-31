-- Staging-only freeze. No request/GUC/role bypass; all financial DML is rejected.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres'
 OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN('','{}')
 OR (SELECT system_identifier::text FROM pg_control_system())<>'__ACC_STAGING_PHYSICAL_SYSTEM_IDENTIFIER__'
 THEN RAISE EXCEPTION 'verified staging administration required'; END IF;
END $$;
LOCK TABLE public.ptv_finance_allocations,public.ptv_finance_audit_log,
 public.ptv_finance_categories,public.ptv_finance_kas_payments,
 public.ptv_finance_kas_records,public.ptv_finance_loan_payments,
 public.ptv_finance_loans,public.ptv_finance_pockets,
 public.ptv_finance_semesters,public.ptv_finance_settings,
 public.ptv_finance_source_references,public.ptv_finance_transactions,
 public.ptv_kas_kru,public.ptv_kas_periode,public.ptv_keuangan,
 public.ptv_pemasukan,public.ptv_pengeluaran IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA IF NOT EXISTS ptv_finance_maintenance;
REVOKE ALL ON SCHEMA ptv_finance_maintenance FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION ptv_finance_maintenance.reject_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'FINANCE_MAINTENANCE: database writes are frozen' USING ERRCODE='55000';
END $$;
REVOKE ALL ON FUNCTION ptv_finance_maintenance.reject_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['ptv_finance_allocations','ptv_finance_audit_log',
 'ptv_finance_categories','ptv_finance_kas_payments','ptv_finance_kas_records',
 'ptv_finance_loan_payments','ptv_finance_loans','ptv_finance_pockets',
 'ptv_finance_semesters','ptv_finance_settings','ptv_finance_source_references',
 'ptv_finance_transactions','ptv_kas_kru','ptv_kas_periode','ptv_keuangan',
 'ptv_pemasukan','ptv_pengeluaran'] LOOP
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||tab)::regclass AND tgname='finance151_database_freeze') THEN
   RAISE EXCEPTION 'freeze already exists; verify instead of replacing it';
  END IF;
  EXECUTE format('CREATE TRIGGER finance151_database_freeze BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION ptv_finance_maintenance.reject_write()',tab);
  EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER finance151_database_freeze',tab);
 END LOOP;
END $$;
COMMIT;
