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

-- CORE_POST_TRANSACTION_151

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

-- LOAN_DISBURSEMENT_151

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

-- WRAPPERS_AND_POLICIES_151
COMMIT;
