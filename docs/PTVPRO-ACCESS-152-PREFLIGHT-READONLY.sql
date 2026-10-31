-- Read-only supplement to Access149 preflight. Operator-approved Staging connection only.
-- No passwords, hashes, subjects, emails, tokens or identifying account rows in output.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT current_database(),current_user,version();
SELECT table_schema,table_name,column_name,data_type FROM information_schema.columns
 WHERE (table_schema='auth' AND table_name='sessions' AND column_name IN ('id','user_id','not_after'))
 OR (table_schema='public' AND table_name='user_account' AND column_name IN ('auth_user_id','tokens_valid_after','lockout_until','failed_login_attempts'))
 OR (table_schema='public' AND table_name='auth_credentials' AND column_name IN ('account_id','password_hash','hash_algorithm','updated_at'))
 ORDER BY table_schema,table_name,column_name;
SELECT count(*) AS account_count,
 count(*) FILTER(WHERE status_akun='active') AS active_accounts,
 count(*) FILTER(WHERE lockout_until>now()) AS locked_accounts
FROM public.user_account;
SELECT count(*) AS credential_rows,
 count(*) FILTER(WHERE password_hash IS NOT NULL) AS rows_with_hash,
 count(*) FILTER(WHERE password_hash ~ '^\$2[aby]\$10\$[./A-Za-z0-9]{53}$' AND hash_algorithm='bcrypt') AS compatible_format_candidates,
 count(*) FILTER(WHERE oauth_provider='google' AND nullif(trim(oauth_subject_id),'') IS NOT NULL) AS google_bindings
FROM public.auth_credentials;
SELECT count(*) AS duplicate_provider_bindings FROM (
 SELECT oauth_provider,oauth_subject_id FROM public.auth_credentials
 WHERE nullif(trim(oauth_subject_id),'') IS NOT NULL GROUP BY oauth_provider,oauth_subject_id HAVING count(*)>1
) groups_to_reconcile;
SELECT p.oid::regprocedure::text AS signature,p.prosecdef,r.rolname AS owner,p.proconfig,p.proacl,
 has_table_privilege(r.oid,'auth.sessions','SELECT') AS owner_can_check_native_sessions
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname='public' AND p.proname='has_capability';
SELECT rolname,has_table_privilege(oid,'auth.sessions','SELECT') AS native_sessions_read,
 has_table_privilege(oid,'public.auth_credentials','UPDATE') AS credentials_direct_update
FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
ROLLBACK;
