-- NEW SEPARATE SIGNED ACC REQUIRED. Offline template only; never executed in cloud by this task.
-- Revert ONLY the Root assignment introduced by the consumed bootstrap marker, preserve all accounts/history.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $revert$
DECLARE plan jsonb:='__APPROVED_BOOTSTRAP_JSON__'::jsonb; original jsonb; root_id uuid; recovery_id uuid; version_now timestamptz; profiles_now jsonb;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
 THEN RAISE EXCEPTION 'trusted direct administrative SQL only' USING ERRCODE='42501'; END IF;
 IF plan->>'purpose' IS DISTINCT FROM 'first_root_bootstrap_revert' OR plan->>'projectRef' IS DISTINCT FROM 'swadgljnyelsjstqqxbm'
   OR plan->>'databaseSystemIdentifier' IS DISTINCT FROM (SELECT system_identifier::text FROM pg_control_system())
   OR plan->>'expiresAt' IS NULL OR (plan->>'expiresAt')::timestamptz<=clock_timestamp()
   OR coalesce(plan->>'approvalSha256','') !~ '^[0-9a-f]{64}$' OR coalesce(plan->>'approverKeySha256','') !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'invalid revert approval or database' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(149,1);
 LOCK TABLE public.account_profiles,public.auth_audit_log IN SHARE ROW EXCLUSIVE MODE;
 SELECT metadata INTO original FROM public.auth_audit_log WHERE id=(plan->>'bootstrapEventId')::bigint AND event_type='root_bootstrap_completed';
 IF original IS NULL OR EXISTS(SELECT 1 FROM public.auth_audit_log WHERE event_type='root_bootstrap_rolled_back' AND metadata->>'bootstrap_event_id'=plan->>'bootstrapEventId')
 THEN RAISE EXCEPTION 'bootstrap missing or already reverted' USING ERRCODE='42501'; END IF;
 root_id:=(original->>'root_account_id')::uuid; recovery_id:=(original->>'recovery_account_id')::uuid;
 IF NOT ptv_access_private.usable_google_login(recovery_id) OR NOT ptv_access_private.can_account(recovery_id,'crew.permissions.manage')
 THEN RAISE EXCEPTION 'recovery login required before revert' USING ERRCODE='42501'; END IF;
 SELECT updated_at INTO version_now FROM public.user_account WHERE id=root_id FOR UPDATE;
 SELECT coalesce(jsonb_agg(profile_id ORDER BY profile_id),'[]') INTO profiles_now FROM public.account_profiles WHERE account_id=root_id;
 IF version_now IS DISTINCT FROM (original->>'root_applied_version')::timestamptz
   OR profiles_now IS DISTINCT FROM (SELECT jsonb_agg(v ORDER BY v) FROM jsonb_array_elements_text((original->'root_previous_profiles')||jsonb_build_array('root_executive')) v)
 THEN RAISE EXCEPTION 'changed Root state requires manual recovery review' USING ERRCODE='40001'; END IF;
 REVOKE ALL ON FUNCTION public.rpc_manage_account_access(uuid,bigint,jsonb),public.rpc_update_crew_personnel(uuid,bigint,uuid,jsonb) FROM service_role;
 REVOKE ALL ON FUNCTION ptv_access_private.manage_account_access(uuid,bigint,jsonb),ptv_access_private.update_crew_personnel(uuid,bigint,uuid,jsonb) FROM service_role;
 PERFORM set_config('ptv.root_admin_approval_sha256',plan->>'approvalSha256',true);
 DELETE FROM public.account_profiles WHERE account_id=root_id AND profile_id='root_executive';
 UPDATE public.user_account SET tokens_valid_after=clock_timestamp(),updated_at=clock_timestamp() WHERE id IN (root_id,recovery_id);
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(NULL,'root_bootstrap_rolled_back',jsonb_build_object(
   'bootstrap_event_id',plan->>'bootstrapEventId','root_account_id',root_id,'recovery_account_id',recovery_id,
   'approval_sha256',plan->>'approvalSha256','approver_key_sha256',plan->>'approverKeySha256','db_session_user',session_user,'db_role',current_user));
 -- Keep root_bootstrap_completed forever. Revert never reopens initial bootstrap.
END;
$revert$;
COMMIT;
