BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $pin$ BEGIN
 IF md5((SELECT system_identifier::text FROM pg_control_system())) <> '72737c1de8ff53d24950c9d2b30bd42d' THEN RAISE EXCEPTION 'STAGING_ONLY_171'; END IF;
END $pin$;
CREATE SCHEMA IF NOT EXISTS ptv_inventory_test_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA ptv_inventory_test_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA ptv_inventory_test_private TO service_role;
CREATE OR REPLACE FUNCTION ptv_inventory_test_private.manage(p_root jsonb,p_run uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions
AS $fn$
DECLARE actor uuid; identity uuid; target uuid; person uuid; secret text; revoked integer;
BEGIN
 PERFORM ptv_auth_private.require_server();
 IF coalesce(current_setting('auto_explain.log_nested_statements',true),'off')<>'off' OR current_setting('debug_print_parse')<>'off' OR current_setting('debug_print_plan')<>'off' OR current_setting('debug_print_rewritten')<>'off' THEN RAISE EXCEPTION 'PRIVATE_LOGGING_CONTEXT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF md5((SELECT system_identifier::text FROM pg_control_system())) <> '72737c1de8ff53d24950c9d2b30bd42d' THEN RAISE EXCEPTION 'STAGING_ONLY_171' USING ERRCODE='42501'; END IF;
 IF p_run IS NULL OR p_action NOT IN ('provision','read-phase','retire','status') OR p_action IS NULL OR jsonb_typeof(p_root)<>'object' OR octet_length(p_root::text)>2048 THEN RAISE EXCEPTION 'INVALID_TEST_REQUEST' USING ERRCODE='22023'; END IF;
 IF p_root->>'p_session_id' IS NULL OR public.rpc_portal_session_valid((p_root->>'p_actor')::uuid,(p_root->>'p_identity')::uuid,(p_root->>'p_iat')::bigint,(p_root->>'p_exp')::bigint,(p_root->>'p_session_id')::uuid,p_root->>'p_fingerprint') IS NOT TRUE THEN RAISE EXCEPTION 'LIVE_ROOT_SESSION_REQUIRED' USING ERRCODE='42501'; END IF;
 actor := (p_root->>'p_actor')::uuid; identity := (p_root->>'p_identity')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.account_profiles WHERE account_id=actor AND profile_id='root_executive')
 OR EXISTS(SELECT 1 FROM public.account_capability_overrides WHERE account_id=actor AND override_type='deny' AND capability_key IN ('hub.access','crew.permissions.manage'))
 OR (SELECT count(*) FROM public.organization_membership WHERE identity_id=identity AND organization_id='ptv_studio' AND is_current AND status_organisasi='active')<>1
 OR NOT EXISTS(SELECT 1 FROM ptv_auth_private.policy WHERE singleton AND enabled) THEN RAISE EXCEPTION 'ROOT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(171,1);
 SELECT a.id,i.id INTO target,person FROM public.user_account a JOIN public.canonical_identity i ON i.id=a.identity_id
 WHERE a.username='stg-inventory-neg-171' AND i.ptv_id='PTV-TEST-171' AND i.metadata->>'inventory_security_test'='PTV-DEV-171' AND i.metadata->>'run_id'=p_run::text;
 IF p_action='provision' THEN
  IF EXISTS(SELECT 1 FROM public.user_account WHERE username='stg-inventory-neg-171') OR EXISTS(SELECT 1 FROM public.canonical_identity WHERE ptv_id='PTV-TEST-171') THEN RAISE EXCEPTION 'TESTER_EXISTS_RETIRE_OR_RECONCILE'; END IF;
  target:=gen_random_uuid(); person:=gen_random_uuid(); secret:=encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO public.canonical_identity(id,ptv_id,full_name,metadata) VALUES(person,'PTV-TEST-171','STAGING INVENTORY TESTER 171',jsonb_build_object('inventory_security_test','PTV-DEV-171','run_id',p_run,'coordinator','PTV-002','purpose','temporary capability regression'));
  INSERT INTO public.organization_membership(identity_id,organization_id,position_title,status_organisasi,is_current) VALUES(person,'ptv_studio','Temporary security tester','active',true);
  INSERT INTO public.user_account(id,identity_id,username,status_akun,tokens_valid_after) VALUES(target,person,'stg-inventory-neg-171','active',clock_timestamp()-interval '2 seconds');
  INSERT INTO public.auth_credentials(account_id,password_hash,hash_algorithm,needs_rehash,password_updated_at) VALUES(target,extensions.crypt(secret,extensions.gen_salt('bf',10)),'bcrypt',false,clock_timestamp());
  INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type,reason) VALUES(target,'hub.access','allow','PTV-DEV-171 / Rouf consent');
  INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type,reason)
   SELECT target,c,'deny','PTV-DEV-171 / no mutation privileges' FROM unnest(ARRAY['inventory.create','inventory.edit','inventory.delete','inventory.units.manage','inventory.valuation.manage','loans.checkout','loans.return','damage.report','damage.qc.approve']) c;
  INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(identity,'inventory_test171_provisioned',jsonb_build_object('run_id',p_run,'account_id',target,'consent','Rouf plan169 confirmed by operator','phase','A'));
  RETURN jsonb_build_object('account_id',target,'identity_id',person,'username','stg-inventory-neg-171','password',secret);
 END IF;
 IF target IS NULL OR target=actor OR person=identity THEN RAISE EXCEPTION 'OWN_TESTER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_action='read-phase' THEN
  IF NOT EXISTS(SELECT 1 FROM public.user_account WHERE id=target AND status_akun='active') OR EXISTS(SELECT 1 FROM public.account_profiles WHERE account_id=target) THEN RAISE EXCEPTION 'TESTER_STATE_DRIFT'; END IF;
  INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type,reason)
   SELECT target,c,'allow','PTV-DEV-171 / phase B read only' FROM unnest(ARRAY['inventory.view','inventory.valuation.view','loans.view','damage.view']) c
   WHERE NOT EXISTS(SELECT 1 FROM public.account_capability_overrides WHERE account_id=target AND capability_key=c);
  INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(identity,'inventory_test171_read_phase',jsonb_build_object('run_id',p_run,'account_id',target));
 ELSIF p_action='retire' THEN
  UPDATE public.user_account SET status_akun='inactive',tokens_valid_after=clock_timestamp() WHERE id=target;
  UPDATE public.organization_membership SET status_organisasi='inactive' WHERE identity_id=person AND organization_id='ptv_studio';
  UPDATE ptv_auth_private.sessions SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE account_id=target;
  UPDATE public.auth_credentials SET password_hash=NULL,password_updated_at=clock_timestamp(),updated_at=clock_timestamp() WHERE account_id=target;
  DELETE FROM public.account_capability_overrides WHERE account_id=target;
  INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(identity,'inventory_test171_retired',jsonb_build_object('run_id',p_run,'account_id',target));
 END IF;
 SELECT count(*) INTO revoked FROM ptv_auth_private.sessions WHERE account_id=target AND revoked_at IS NULL AND expires_at>clock_timestamp();
 RETURN jsonb_build_object('account_id',target,'status',(SELECT status_akun FROM public.user_account WHERE id=target),'active_sessions',revoked,'credential_present',EXISTS(SELECT 1 FROM public.auth_credentials WHERE account_id=target AND password_hash IS NOT NULL),'uploaded_objects',(SELECT count(*) FROM storage.objects WHERE bucket_id='inventory' AND name LIKE 'catalog/portal/'||target::text||'/%'));
END $fn$;
REVOKE ALL ON FUNCTION ptv_inventory_test_private.manage(jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ptv_inventory_test_private.manage(jsonb,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.rpc_inventory_test171(p_root jsonb,p_run uuid,p_action text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $wrapper$
 SELECT ptv_inventory_test_private.manage(p_root,p_run,p_action);
$wrapper$;
REVOKE ALL ON FUNCTION public.rpc_inventory_test171(jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_test171(jsonb,uuid,text) TO service_role;
COMMIT;
