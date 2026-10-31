-- Operator review only. No cloud SQL was executed by this sprint.
-- Run on the approved target before ACC execution; retain results privately.
BEGIN TRANSACTION READ ONLY;
SELECT current_database(),current_user,current_setting('server_version'),system_identifier::text
FROM pg_control_system();
SELECT to_regclass('auth.sessions') AS native_session_table;
SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='auth' AND table_name='sessions' AND column_name IN('id','user_id','not_after');
SELECT has_table_privilege(current_user,'auth.sessions','SELECT') AS definer_owner_can_verify_session;
SELECT tab,role_name,has_table_privilege(role_name,'public.'||tab,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS unsafe_direct_access_store_write
FROM unnest(ARRAY['user_account','canonical_identity','organization_membership','account_profiles','account_capability_overrides','profile_capabilities','access_profile','capability_registry','auth_credentials'])tab
CROSS JOIN unnest(ARRAY['anon','authenticated','service_role'])role_name;

-- Bind the physical identifier to swadgljnyelsjstqqxbm through a trusted connection.
-- Compare owners/definitions/ACLs with the reviewed encrypted schema backup.
SELECT n.nspname,p.proname,p.oid::regprocedure AS signature,r.rolname AS owner,
 p.prosecdef,p.proconfig,p.proacl,md5(pg_get_functiondef(p.oid)) AS definition_fingerprint
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname='ptv_finance_private' OR (n.nspname='public' AND (p.proname ILIKE '%finance%' OR p.proname IN
 ('rpc_post_finance_transaction_server','rpc_get_finance_loans_aggregate','rpc_record_kas_kru_payment_atomic',
 'rpc_disburse_loan_atomic','rpc_record_loan_payment_atomic','rpc_reverse_operational_record_atomic',
 'rpc_void_finance_transaction_atomic','rpc_finance_visible_transactions_server')))
ORDER BY n.nspname,p.proname;
SELECT schemaname,tablename,policyname,roles,cmd,permissive,qual,with_check
FROM pg_policies WHERE tablename LIKE 'ptv_finance_%'
 OR (schemaname='storage' AND tablename='objects') ORDER BY schemaname,tablename,policyname;
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'ptv_finance_%'
ORDER BY table_name,ordinal_position;

-- Existing inconsistent payment histories must be reviewed, never repaired automatically.
SELECT count(*) AS kas_records_with_unexplained_paid_total
FROM public.ptv_finance_kas_records r
WHERE r.paid_amount_minor<>(SELECT coalesce(sum(p.amount_minor),0) FROM public.ptv_finance_kas_payments p WHERE p.record_id=r.id AND p.status='posted');
SELECT count(*) AS loans_with_unexplained_paid_or_remaining
FROM public.ptv_finance_loans l
WHERE l.total_paid_minor<>(SELECT coalesce(sum(p.amount_minor),0) FROM public.ptv_finance_loan_payments p
 JOIN public.ptv_finance_transactions t ON t.id=p.receipt_tx_id WHERE p.loan_id=l.id AND t.status='posted')
 OR l.remaining_minor<>l.total_due_minor-l.total_paid_minor;
SELECT count(*) AS loan_payments_without_ledger_reference
FROM public.ptv_finance_loan_payments WHERE receipt_tx_id IS NULL;
SELECT count(*) AS negative_balances FROM public.ptv_finance_pockets WHERE balance_minor<0;
SELECT count(*) AS historical_rows_without_reviewed_visibility
FROM public.ptv_finance_transactions t WHERE coalesce(to_jsonb(t)->'operational_envelope'->>'kind','') NOT IN('general','kas_kru','loan_disbursement','loan_payment');
SELECT count(*) AS orphan_allocations FROM public.ptv_finance_allocations a
LEFT JOIN public.ptv_finance_transactions t ON t.id=a.transaction_id WHERE t.id IS NULL;

-- These counts describe preparation gaps; they do not select or modify people.
SELECT count(*) AS canonical_people_without_explicit_category
FROM public.canonical_identity ci
WHERE coalesce(ci.metadata->>'category','') NOT IN('Kru','Pembina','Pengarah')
 AND NOT EXISTS(SELECT 1 FROM public.legacy_archive_kru a WHERE a.canonical_identity_id=ci.id AND a.metadata_json->>'category' IN('Kru','Pembina','Pengarah'));
SELECT count(*) AS people_without_verified_finance_join_month
FROM public.canonical_identity WHERE coalesce(metadata->>'finance_join_month','') !~ '^\d{4}-(0[1-9]|1[0-2])$';
SELECT count(*) AS canonical_targets_with_multiple_archives FROM (
 SELECT canonical_identity_id FROM public.legacy_archive_kru WHERE canonical_identity_id IS NOT NULL GROUP BY canonical_identity_id HAVING count(*)>1
) duplicates;
ROLLBACK;
