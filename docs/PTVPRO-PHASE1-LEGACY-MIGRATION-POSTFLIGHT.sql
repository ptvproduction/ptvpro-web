-- READ ONLY after an explicitly approved batch. Bind the reviewed operation and count, never infer them.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
WITH targets AS (
 SELECT i.id AS identity_id,u.id AS account_id,u.status_akun,u.auth_user_id,i.metadata
 FROM public.canonical_identity i JOIN public.user_account u ON u.identity_id=i.id
 WHERE i.metadata->>'provision_operation'='__APPROVED_OPERATION_UUID__'
)
SELECT jsonb_build_object(
 'target_count_matches',(SELECT count(*)=__APPROVED_TARGET_COUNT__ FROM targets),
 'historical_uuid_preserved',(SELECT bool_and(identity_id::text=metadata->>'legacy_uuid') FROM targets),
 'accounts_inactive',(SELECT bool_and(status_akun='inactive' AND auth_user_id IS NULL) FROM targets),
 'single_current_membership',NOT EXISTS(SELECT FROM targets t WHERE (SELECT count(*) FROM public.organization_membership m WHERE m.identity_id=t.identity_id AND m.organization_id='ptv_studio' AND m.is_current)<>1),
 'only_crew_profile',NOT EXISTS(SELECT FROM targets t WHERE (SELECT count(*) FROM public.account_profiles p WHERE p.account_id=t.account_id AND p.profile_id='crew')<>1 OR (SELECT count(*) FROM public.account_profiles p WHERE p.account_id=t.account_id)<>1),
 'no_credentials',NOT EXISTS(SELECT FROM public.auth_credentials c JOIN targets t ON t.account_id=c.account_id),
 'no_overrides',NOT EXISTS(SELECT FROM public.account_capability_overrides o JOIN targets t ON t.account_id=o.account_id),
 'single_pair_or_batch_receipt',(SELECT count(*)=1 FROM public.auth_audit_log WHERE event_type='initial_accounts_provisioned' AND metadata->>'operation_id'='__APPROVED_OPERATION_UUID__'),
 'gate_off',(SELECT count(*)=1 AND bool_and(NOT enabled) FROM ptv_auth_private.policy),
 'root_zero',NOT EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive')
);
-- Independently compare private baseline digests: testing rows, all archive/history/actor rows, grants/RLS/policies.
-- Expected delta only N canonical/membership/account/crew-profile rows plus one batch receipt.
ROLLBACK;
