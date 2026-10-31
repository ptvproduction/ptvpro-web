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
