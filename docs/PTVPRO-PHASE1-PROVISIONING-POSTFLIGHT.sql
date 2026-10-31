-- READ ONLY. Results require every expected boolean true, not merely a successful query.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT md5(system_identifier::text)='72737c1de8ff53d24950c9d2b30bd42d' AS staging_fingerprint_matches FROM pg_control_system();
SELECT count(*)=2 AS exactly_two_targets,
 count(DISTINCT u.id)=2 AND count(DISTINCT i.id)=2 AS independent_accounts_identities,
 bool_and(i.id::text=i.metadata->>'legacy_uuid') AS historical_uuid_preserved,
 bool_and(u.status_akun='inactive' AND u.auth_user_id IS NULL) AS inactive_without_native_auth,
 bool_and(NOT EXISTS(SELECT FROM public.auth_credentials c WHERE c.account_id=u.id)) AS no_credentials_before_enrollment,
 bool_and((SELECT count(*)=1 FROM public.account_profiles p WHERE p.account_id=u.id AND p.profile_id='crew')
  AND (SELECT count(*)=1 FROM public.account_profiles p WHERE p.account_id=u.id)) AS only_approved_crew_profile,
 bool_and(NOT EXISTS(SELECT FROM public.account_capability_overrides o WHERE o.account_id=u.id)) AS no_overrides,
 bool_and((SELECT count(*)=1 FROM public.organization_membership m WHERE m.identity_id=i.id AND m.organization_id='ptv_studio' AND m.is_current)) AS single_current_membership
FROM public.canonical_identity i JOIN public.user_account u ON u.identity_id=i.id
WHERE i.ptv_id IN ('PTV-001','PTV-002');
SELECT NOT EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive') AS root_zero,
 (SELECT count(*)=1 AND bool_and(NOT enabled) FROM ptv_auth_private.policy) AS policy_off,
 NOT EXISTS(SELECT FROM public.user_account u JOIN public.canonical_identity i ON i.id=u.identity_id
 WHERE i.ptv_id IN ('PTV-STG-ADM','PTV-STG-KRU') AND u.status_akun<>'inactive') AS testing_still_inactive;
-- Compare private pre/post digests separately: archives, testing rows, historical modules, grants/RLS/policies.
-- Expect +2 canonical, +2 membership, +2 account, +2 crew-profile, +1 receipt; no other row changes.
ROLLBACK;
