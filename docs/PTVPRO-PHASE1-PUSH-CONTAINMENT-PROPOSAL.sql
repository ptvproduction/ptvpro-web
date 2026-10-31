-- LOCAL PROPOSAL ONLY. Separate Staging ACC required; never restore the auth.uid-only policy.
-- Current application has no direct push-registration writer. A future writer must authorize server-side.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $contain$
DECLARE baseline text; after_state text;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres'
  OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
  OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
  OR (SELECT system_identifier::text FROM pg_control_system())<>'__APPROVED_DATABASE_SYSTEM_IDENTIFIER__'
 THEN RAISE EXCEPTION 'approved direct Staging administrator required'; END IF;
 PERFORM pg_advisory_xact_lock(149,1);
 LOCK TABLE public.ptv_push_subscriptions,public.auth_audit_log IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive')
  OR NOT EXISTS(SELECT FROM ptv_auth_private.policy WHERE singleton AND NOT enabled)
  OR NOT EXISTS(SELECT FROM pg_class WHERE oid='public.ptv_push_subscriptions'::regclass AND relrowsecurity)
  OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='ptv_push_subscriptions')<>2
  OR NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename='ptv_push_subscriptions' AND policyname='allow_client_insert_sub' AND cmd='INSERT' AND with_check IN ('(auth.uid() IS NOT NULL)','false'))
  OR NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename='ptv_push_subscriptions' AND policyname='block_client_read_sub' AND cmd='SELECT' AND qual='false')
 THEN RAISE EXCEPTION 'prebootstrap policy baseline drift'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'[]')) INTO baseline FROM public.ptv_push_subscriptions s;
 ALTER POLICY allow_client_insert_sub ON public.ptv_push_subscriptions WITH CHECK(false);
 REVOKE ALL ON public.ptv_push_subscriptions FROM PUBLIC,anon,authenticated;
 IF EXISTS(SELECT FROM (VALUES('anon'),('authenticated')) r(name) WHERE has_table_privilege(name,'public.ptv_push_subscriptions','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 THEN RAISE EXCEPTION 'client privilege containment failed'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'[]')) INTO after_state FROM public.ptv_push_subscriptions s;
 IF after_state IS DISTINCT FROM baseline THEN RAISE EXCEPTION 'subscription data changed'; END IF;
 IF NOT EXISTS(SELECT FROM public.auth_audit_log WHERE event_type='phase1_push_access_contained') THEN
  INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(NULL,'phase1_push_access_contained',jsonb_build_object('scope','direct_native_push_registration','database_principal',session_user,'data_preserved',true));
 END IF;
 IF (SELECT count(*) FROM public.auth_audit_log WHERE event_type='phase1_push_access_contained')<>1 THEN RAISE EXCEPTION 'single containment receipt required'; END IF;
END $contain$;
COMMIT;
-- Failure before COMMIT rolls back this transaction. After COMMIT keep this default-deny state.
-- Recovery: reviewed server-authorized writer or forward repair with new ACC, never re-grant the old bypass.
