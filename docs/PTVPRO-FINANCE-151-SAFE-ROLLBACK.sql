-- Safe recovery mode, not a restoration of vulnerable definitions or grants.
-- Preserves new columns, posted/reversed history, secure SELECT/RLS and audit.
-- Apply only after ACC and verification of the physical Staging database.
BEGIN;
DO $$ BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN('','{}')
 OR (SELECT system_identifier::text FROM pg_control_system())<>'__ACC_STAGING_PHYSICAL_SYSTEM_IDENTIFIER__' THEN
 RAISE EXCEPTION 'approved direct staging administration required'; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='ptv_finance_private' AND p.proname NOT IN('personnel_category','can_account','native_account','owns_finance','visible_transaction','authorize')) OR (n.nspname='public' AND p.proname IN('rpc_finance_admin_mutation_server','rpc_post_finance_transaction_server','rpc_record_kas_kru_payment_atomic','rpc_disburse_loan_atomic','rpc_record_loan_payment_atomic','rpc_reverse_operational_record_atomic','rpc_void_finance_transaction_atomic')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.signature);
 END LOOP;
END $$;
-- Do not DROP the reversal columns or restore the former public aggregate grant.
COMMIT;
