-- Read-only validation template. Actual snapshot/clone use requires operator approval.
-- Output is a PRIVATE restore manifest: keep outside Git/logs; never include real row values.
-- Run before and after restore on the same approved logical scope; compare every field.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- If importing the pg_dump exported snapshot, SET TRANSACTION SNAPSHOT must be placed HERE, before any SELECT.
SET LOCAL TIME ZONE 'UTC';
WITH table_digests AS (
SELECT 'ptv_finance_pockets' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_pockets x
UNION ALL
SELECT 'ptv_finance_categories' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_categories x
UNION ALL
SELECT 'ptv_finance_transactions' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_transactions x
UNION ALL
SELECT 'ptv_finance_allocations' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_allocations x
UNION ALL
SELECT 'ptv_finance_source_references' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_source_references x
UNION ALL
SELECT 'ptv_finance_audit_log' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_audit_log x
UNION ALL
SELECT 'ptv_finance_semesters' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_semesters x
UNION ALL
SELECT 'ptv_finance_kas_records' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_kas_records x
UNION ALL
SELECT 'ptv_finance_kas_payments' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_kas_payments x
UNION ALL
SELECT 'ptv_finance_loans' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_loans x
UNION ALL
SELECT 'ptv_finance_loan_payments' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_loan_payments x
UNION ALL
SELECT 'ptv_finance_settings' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.ptv_finance_settings x
UNION ALL
SELECT 'canonical_identity' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.canonical_identity x
UNION ALL
SELECT 'user_account' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.user_account x
UNION ALL
SELECT 'organization_membership' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.organization_membership x
UNION ALL
SELECT 'account_profiles' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.account_profiles x
UNION ALL
SELECT 'account_capability_overrides' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.account_capability_overrides x
UNION ALL
SELECT 'profile_capabilities' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.profile_capabilities x
UNION ALL
SELECT 'access_profile' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.access_profile x
UNION ALL
SELECT 'capability_registry' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.capability_registry x
UNION ALL
SELECT 'auth_credentials' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.auth_credentials x
UNION ALL
SELECT 'auth_audit_log' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.auth_audit_log x
UNION ALL
SELECT 'legacy_archive_kru' AS table_name,count(*) AS row_count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]'),'UTF8')),'hex') AS data_sha256 FROM public.legacy_archive_kru x
), target_tables AS (
 SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,r.rolname AS owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
 WHERE n.nspname='public' AND c.relname IN(SELECT table_name FROM table_digests) AND c.relkind='r'
)
SELECT jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname,'owner',r.rolname,'acl',n.nspacl::text) ORDER BY n.nspname)
  FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname IN('public','ptv_finance_private','ptv_access_private','auth','storage')),
 'data',(SELECT jsonb_agg(to_jsonb(d) ORDER BY table_name) FROM table_digests d),
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',t.relname,'owner',t.owner,'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,
  'acl',(SELECT c.relacl::text FROM pg_class c WHERE c.oid=t.oid),
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,
   'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY t.relname) FROM target_tables t),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',c.conname,'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid)) ORDER BY t.relname,c.conname)
  FROM target_tables t JOIN pg_constraint c ON c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname)
  FROM pg_indexes WHERE schemaname='public' AND tablename IN(SELECT table_name FROM table_digests)),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',r.rolname,'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,
  'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')) ORDER BY n.nspname,p.proname,p.oid::regprocedure::text)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
  WHERE n.nspname IN('ptv_finance_private','ptv_access_private') OR(n.nspname='public' AND p.prokind='f' AND
  (p.proname ILIKE '%finance%' OR p.proname IN('has_capability','current_authenticated_ptv_id','rpc_record_kas_kru_payment_atomic',
   'rpc_disburse_loan_atomic','rpc_record_loan_payment_atomic','rpc_reverse_operational_record_atomic','rpc_manage_account_access','rpc_update_crew_personnel')))),
 'policies',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'using',qual,'check',with_check)
  ORDER BY schemaname,tablename,policyname) FROM pg_policies WHERE(schemaname='public' AND tablename IN(SELECT table_name FROM table_digests)) OR(schemaname='storage' AND tablename='objects')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',g.tgname,'enabled',g.tgenabled,'definition',pg_get_triggerdef(g.oid)) ORDER BY t.relname,g.tgname)
  FROM target_tables t JOIN pg_trigger g ON g.tgrelid=t.oid WHERE NOT g.tgisinternal),
 'roles',(SELECT jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit,'login',rolcanlogin) ORDER BY rolname)
  FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role')),
 'memberships',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname)
  FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE m.rolname IN('postgres','anon','authenticated','service_role')),
 'default_acl',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'owner',r.rolname,'type',d.defaclobjtype,'acl',d.defaclacl::text) ORDER BY n.nspname,r.rolname,d.defaclobjtype)
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace JOIN pg_roles r ON r.oid=d.defaclrole WHERE n.nspname IN('public','ptv_finance_private','ptv_access_private')),
 'sequences',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'name',sequencename,'owner',sequenceowner,
  'acl',(SELECT c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=s.schemaname AND c.relname=s.sequencename AND c.relkind='S'),
  'last_value',last_value,'increment',increment_by,'max',max_value,'cycle',cycle) ORDER BY schemaname,sequencename)
  FROM pg_sequences s WHERE schemaname IN('public','ptv_access_private','ptv_finance_private'))
) AS private_restore_manifest;
ROLLBACK;
