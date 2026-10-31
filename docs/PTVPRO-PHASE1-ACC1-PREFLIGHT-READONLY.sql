-- PREPARED ONLY. Fresh Staging read-only ACC is required before using this file.
-- Verify approved ref swadgljnyelsjstqqxbm and TLS host externally, then compare physical fingerprint.
-- This file does not certify Vercel environment or stop application writers.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT current_user,session_user,current_setting('transaction_read_only') AS read_only,
 current_setting('server_version') AS postgres_version,
 md5(system_identifier::text)='72737c1de8ff53d24950c9d2b30bd42d' AS matches_staging153_cluster
FROM pg_control_system();
SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role');
SELECT to_regnamespace('ptv_access_private') IS NULL AS prep149_not_installed,
 to_regnamespace('ptv_auth_private') IS NULL AS lifecycle_not_installed;
SELECT table_schema,table_name,column_name,data_type,is_nullable
FROM information_schema.columns WHERE
 (table_schema='auth' AND table_name='sessions' AND column_name IN('id','user_id','not_after')) OR
 (table_schema='public' AND table_name='auth_credentials' AND column_name IN('account_id','password_hash','hash_algorithm','needs_rehash','password_updated_at','updated_at')) OR
 (table_schema='public' AND table_name='user_account' AND column_name IN('id','identity_id','auth_user_id','status_akun','lockout_until','tokens_valid_after','updated_at'))
ORDER BY table_schema,table_name,ordinal_position;
SELECT coalesce(has_table_privilege('postgres',to_regclass('auth.sessions'),'SELECT'),false) AS owner_can_read_native_sessions;
SELECT owner.rolname AS creator,coalesce(n.nspname,'GLOBAL') AS schema,d.defaclobjtype,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,a.privilege_type,a.is_grantable
FROM pg_default_acl d JOIN pg_roles owner ON owner.oid=d.defaclrole
LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
WHERE owner.rolname='postgres' ORDER BY schema,d.defaclobjtype,grantee,a.privilege_type;
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN('user_account','canonical_identity','organization_membership','account_profiles','account_capability_overrides','auth_credentials','access_profile','capability_registry','profile_capabilities','auth_audit_log')
ORDER BY table_name,grantee,privilege_type;
SELECT p.oid::regprocedure::text AS function,p.prosecdef,p.proconfig,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN('ptv_access_private','ptv_auth_private') OR
 (n.nspname='public' AND p.proname IN('has_capability','rpc_manage_account_access','rpc_update_crew_personnel','rpc_portal_login_begin','rpc_portal_login_finish','rpc_portal_session_valid','rpc_portal_session_revoke','rpc_portal_google_session'));
SELECT (SELECT count(*) FROM public.user_account) AS accounts,
 (SELECT count(*) FROM public.canonical_identity) AS identities,
 (SELECT count(*) FROM public.organization_membership) AS memberships,
 (SELECT count(*) FROM public.auth_credentials) AS credentials,
 (SELECT count(*) FROM auth.sessions) AS native_sessions,
 (SELECT count(*) FROM public.legacy_archive_kru) AS personnel_archives,
 (SELECT count(*) FROM public.account_profiles WHERE profile_id='root_executive') AS root_assignments,
 (SELECT count(*) FROM public.auth_audit_log WHERE event_type IN('root_bootstrap_completed','root_bootstrap_rolled_back','password_credential_enrolled','legacy_personnel_linked')) AS protected_events;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND (coalesce(qual,'') ILIKE '%has_capability%' OR coalesce(with_check,'') ILIKE '%has_capability%')
ORDER BY tablename,policyname;
ROLLBACK;
