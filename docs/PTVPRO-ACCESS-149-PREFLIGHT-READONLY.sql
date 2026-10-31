-- PROPOSAL ONLY; NOT EXECUTED. Requires operator ACC even for future SQL testing.
-- Run only on verified staging swadgljnyelsjstqqxbm. No credentials or PII in exported results.
BEGIN TRANSACTION READ ONLY;
-- Privileged read only; record this privately in the signed manifest, not as an operator identity.
SELECT system_identifier::text AS database_system_identifier FROM pg_control_system();
SELECT profile_id,capability_key FROM public.profile_capabilities WHERE profile_id='root_executive' ORDER BY capability_key;
SELECT count(*) root_assignments FROM public.account_profiles WHERE profile_id='root_executive';
SELECT event_type,count(*) FROM public.auth_audit_log WHERE event_type IN ('root_bootstrap_completed','root_bootstrap_rolled_back','portal_login_verified') GROUP BY event_type;
SELECT t.tgname,c.relname,p.proname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE NOT t.tgisinternal AND c.oid IN ('public.account_profiles'::regclass,'public.auth_audit_log'::regclass);
SELECT count(*) archive_rows,
 count(*) FILTER(WHERE canonical_identity_id IS NULL) unlinked_rows
FROM public.legacy_archive_kru;
SELECT count(*) duplicate_groups FROM
 (SELECT ptv_id FROM public.legacy_archive_kru GROUP BY ptv_id HAVING count(*)>1) d;
SELECT count(*) ambiguous_memberships FROM
 (SELECT identity_id FROM public.organization_membership
 WHERE organization_id='ptv_studio' AND is_current GROUP BY identity_id HAVING count(*)<>1) d;
SELECT count(*) missing_or_ambiguous_memberships FROM public.user_account a WHERE
 (SELECT count(*) FROM public.organization_membership m WHERE m.identity_id=a.identity_id
 AND m.organization_id='ptv_studio' AND m.is_current)<>1;
SELECT count(*) linked_identity_mismatch FROM public.legacy_archive_kru l
 LEFT JOIN public.canonical_identity i ON i.id=l.canonical_identity_id
 WHERE l.canonical_identity_id IS NOT NULL AND (i.id IS NULL OR i.ptv_id IS DISTINCT FROM l.ptv_id);
SELECT count(*) google_credential_candidates FROM public.user_account a
 WHERE a.status_akun='active' AND EXISTS(SELECT 1 FROM public.auth_credentials c
 WHERE c.account_id=a.id AND c.oauth_provider='google' AND nullif(trim(c.oauth_subject_id),'') IS NOT NULL);
-- Candidates above are NOT proof of successful login or recovery capability.
SELECT n.nspname,p.proname,p.prosecdef,r.rolname owner,p.proconfig,p.proacl,
 pg_get_functiondef(p.oid) definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname='ptv_access_private' OR (n.nspname='public' AND p.proname IN
 ('has_capability','rpc_manage_account_access','rpc_update_crew_personnel'));
-- Capture all relevant policies: helper dependencies may cross modules.
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND (coalesce(qual,'') ILIKE '%has_capability%'
 OR coalesce(with_check,'') ILIKE '%has_capability%'
 OR tablename IN ('user_account','account_profiles','account_capability_overrides','organization_membership','legacy_archive_kru','auth_credentials'));
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN
 ('user_account','account_profiles','account_capability_overrides','organization_membership','canonical_identity','legacy_archive_kru','auth_credentials','auth_audit_log','access_profile','profile_capabilities','capability_registry');
ROLLBACK;
