-- TEMPLATE ONLY. Unsigned/unrendered template fails. Not executed; Staging only after operator ACC.
-- Render offline with prepare-root-bootstrap-149.mjs; no public RPC or permanent bootstrap function.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $bootstrap$
DECLARE plan jsonb:='__APPROVED_BOOTSTRAP_JSON__'::jsonb;
 r public.user_account%rowtype; b public.user_account%rowtype; rc public.auth_credentials%rowtype; bc public.auth_credentials%rowtype;
 target jsonb; current_profiles jsonb; current_overrides jsonb; marker bigint; selected public.user_account%rowtype;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
 THEN RAISE EXCEPTION 'trusted direct administrative SQL only' USING ERRCODE='42501'; END IF;
 IF plan->>'databaseSystemIdentifier' IS DISTINCT FROM (SELECT system_identifier::text FROM pg_control_system())
 THEN RAISE EXCEPTION 'wrong database cluster' USING ERRCODE='42501'; END IF;
 IF plan->>'projectRef' IS DISTINCT FROM 'swadgljnyelsjstqqxbm' OR plan->>'purpose' IS DISTINCT FROM 'first_root_bootstrap'
   OR plan->>'independentOwnersConfirmed' IS DISTINCT FROM 'true' OR plan->>'expiresAt' IS NULL OR plan->>'issuedAt' IS NULL OR (plan->>'expiresAt')::timestamptz<=clock_timestamp()
   OR (plan->>'issuedAt')::timestamptz>clock_timestamp()
   OR (plan->>'expiresAt')::timestamptz-(plan->>'issuedAt')::timestamptz>interval '24 hours'
   OR coalesce(plan->>'approvalSha256','') !~ '^[0-9a-f]{64}$' OR coalesce(plan->>'approverKeySha256','') !~ '^[0-9a-f]{64}$'
   OR coalesce(plan->>'independenceEvidenceSha256','') !~ '^[0-9a-f]{64}$' OR coalesce(plan->>'portalE2EEvidenceSha256','') !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'invalid or expired approval' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(149,1);
 LOCK TABLE public.account_profiles,public.auth_audit_log,public.profile_capabilities,public.account_capability_overrides,public.organization_membership IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.account_profiles WHERE profile_id='root_executive')
   OR EXISTS(SELECT 1 FROM public.auth_audit_log WHERE event_type IN ('root_bootstrap_completed','root_bootstrap_rolled_back'))
 THEN RAISE EXCEPTION 'first Root bootstrap already consumed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.access_profile WHERE id='root_executive')
   OR NOT EXISTS(SELECT 1 FROM public.profile_capabilities WHERE profile_id='root_executive' AND capability_key='crew.permissions.manage')
 THEN RAISE EXCEPTION 'existing Root profile unavailable' USING ERRCODE='22023'; END IF;
 IF (SELECT coalesce(jsonb_agg(capability_key ORDER BY capability_key),'[]') FROM public.profile_capabilities WHERE profile_id='root_executive')
   IS DISTINCT FROM (SELECT coalesce(jsonb_agg(v ORDER BY v),'[]') FROM jsonb_array_elements_text(plan->'expectedRootCapabilities') v)
 THEN RAISE EXCEPTION 'Root capability catalog changed after approval' USING ERRCODE='40001'; END IF;
 -- Stable order for selected account row locks, including noncooperating administrative writers.
 PERFORM 1 FROM public.user_account WHERE id IN ((plan->'root'->>'accountId')::uuid,(plan->'recovery'->>'accountId')::uuid) ORDER BY id FOR UPDATE;
 SELECT * INTO r FROM public.user_account WHERE id=(plan->'root'->>'accountId')::uuid;
 SELECT * INTO b FROM public.user_account WHERE id=(plan->'recovery'->>'accountId')::uuid;
 IF r.id IS NULL OR b.id IS NULL OR r.id=b.id OR r.identity_id=b.identity_id
   OR r.identity_id IS DISTINCT FROM (plan->'root'->>'identityId')::uuid
   OR b.identity_id IS DISTINCT FROM (plan->'recovery'->>'identityId')::uuid
   OR (r.auth_user_id IS NOT NULL AND r.auth_user_id=b.auth_user_id)
 THEN RAISE EXCEPTION 'selected accounts are not independent' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.auth_credentials WHERE account_id IN (r.id,b.id) ORDER BY account_id FOR UPDATE;
 SELECT * INTO rc FROM public.auth_credentials WHERE account_id=r.id;
 SELECT * INTO bc FROM public.auth_credentials WHERE account_id=b.id;
 IF to_regprocedure('ptv_auth_private.independent_credentials(uuid,uuid)') IS NOT NULL THEN
   IF NOT ptv_auth_private.independent_credentials(r.id,b.id) THEN RAISE EXCEPTION 'independent credentials missing' USING ERRCODE='42501'; END IF;
 ELSE
   IF rc.account_id IS NULL OR bc.account_id IS NULL OR rc.oauth_subject_id IS NOT DISTINCT FROM bc.oauth_subject_id
   THEN RAISE EXCEPTION 'independent credentials missing' USING ERRCODE='42501'; END IF;
 END IF;
 FOR target IN SELECT value FROM jsonb_array_elements(jsonb_build_array(plan->'root',plan->'recovery')) LOOP
   SELECT * INTO selected FROM public.user_account WHERE id=(target->>'accountId')::uuid;
   SELECT coalesce(jsonb_agg(profile_id ORDER BY profile_id),'[]') INTO current_profiles FROM public.account_profiles WHERE account_id=selected.id;
   SELECT coalesce(jsonb_agg(jsonb_build_object('capability',capability_key,'type',override_type) ORDER BY capability_key,override_type),'[]')
     INTO current_overrides FROM public.account_capability_overrides WHERE account_id=selected.id;
   IF selected.updated_at IS DISTINCT FROM (target->>'accountVersion')::timestamptz
     OR current_profiles IS DISTINCT FROM (SELECT coalesce(jsonb_agg(v ORDER BY v),'[]') FROM jsonb_array_elements_text(target->'expectedProfiles') v)
     OR current_overrides IS DISTINCT FROM (SELECT coalesce(jsonb_agg(v ORDER BY v->>'capability',v->>'type'),'[]') FROM jsonb_array_elements(target->'expectedOverrides') v)
     OR NOT EXISTS(SELECT 1 FROM public.auth_credentials WHERE account_id=selected.id AND updated_at=(target->>'credentialVersion')::timestamptz)
   THEN RAISE EXCEPTION 'stale account approval' USING ERRCODE='40001'; END IF;
   IF to_regprocedure('ptv_auth_private.usable_portal_login(uuid,bigint)') IS NOT NULL THEN
     IF NOT ptv_auth_private.usable_portal_login(selected.id,(target->>'loginProofId')::bigint) THEN RAISE EXCEPTION 'verified portal login required' USING ERRCODE='42501'; END IF;
   ELSE
     IF NOT ptv_access_private.usable_google_login(selected.id,(target->>'loginProofId')::bigint) THEN RAISE EXCEPTION 'verified portal login required' USING ERRCODE='42501'; END IF;
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.auth_audit_log WHERE id=(target->>'loginProofId')::bigint AND created_at>=clock_timestamp()-interval '24 hours')
   THEN RAISE EXCEPTION 'fresh verified portal login required' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF NOT ptv_access_private.can_account(b.id,'crew.permissions.manage') THEN RAISE EXCEPTION 'recovery administrator lacks existing permission' USING ERRCODE='42501'; END IF;
 PERFORM set_config('ptv.root_admin_approval_sha256',plan->>'approvalSha256',true);
 INSERT INTO public.account_profiles(account_id,profile_id) VALUES(r.id,'root_executive');
 IF NOT ptv_access_private.can_account(r.id,'crew.permissions.manage') THEN RAISE EXCEPTION 'Root deny override prevents recovery' USING ERRCODE='42501'; END IF;
 UPDATE public.user_account SET tokens_valid_after=clock_timestamp(),updated_at=clock_timestamp() WHERE id IN (r.id,b.id);
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(NULL,'root_bootstrap_completed',jsonb_build_object(
   'root_account_id',r.id,'recovery_account_id',b.id,'root_credential_version',rc.updated_at,'recovery_credential_version',bc.updated_at,
   'root_previous_profiles',plan->'root'->'expectedProfiles','root_applied_version',(SELECT updated_at FROM public.user_account WHERE id=r.id),
   'root_login_proof_id',plan->'root'->>'loginProofId','recovery_login_proof_id',plan->'recovery'->>'loginProofId',
   'approval_sha256',plan->>'approvalSha256','approver_key_sha256',plan->>'approverKeySha256',
   'approval_reference',plan->>'approvalReference','independence_evidence_sha256',plan->>'independenceEvidenceSha256',
   'portal_e2e_evidence_sha256',plan->>'portalE2EEvidenceSha256','template_sha256',plan->>'templateSha256','db_session_user',session_user,'db_role',current_user)) RETURNING id INTO marker;
 PERFORM ptv_access_private.assert_recovery();
 -- Only ordinary reviewed mutation wrappers/implementations are opened. Bootstrap itself leaves no callable object.
 GRANT EXECUTE ON FUNCTION public.rpc_manage_account_access(uuid,bigint,jsonb),public.rpc_update_crew_personnel(uuid,bigint,uuid,jsonb) TO service_role;
 GRANT EXECUTE ON FUNCTION ptv_access_private.manage_account_access(uuid,bigint,jsonb),ptv_access_private.update_crew_personnel(uuid,bigint,uuid,jsonb) TO service_role;
END;
$bootstrap$;
COMMIT;
