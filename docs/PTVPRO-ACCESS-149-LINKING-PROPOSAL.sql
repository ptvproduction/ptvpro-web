-- PROPOSAL ONLY: NOT EXECUTED. STAGING swadgljnyelsjstqqxbm ONLY after ACC.
-- Linking existing canonical identities only. NO account/identity provisioning, credentials or permission writes.
-- Prerequisite: hardened 149 bundle + two independently verified recovery logins.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- New reserved index; preflight must ensure no existing object with this name.
CREATE UNIQUE INDEX canonical_identity_legacy_provenance_149_uidx ON public.canonical_identity
 ((metadata->>'legacy_source_project'),(metadata->>'legacy_source_table'),(metadata->>'legacy_uuid'))
 WHERE metadata ?& ARRAY['legacy_source_project','legacy_source_table','legacy_uuid'];
CREATE FUNCTION ptv_access_private.link_legacy_personnel(
 p_actor uuid,p_iat bigint,p_archive uuid,p_identity uuid,p_legacy_uuid uuid,
 p_expected_version timestamptz,p_identity_version timestamptz,p_manifest_sha256 text,p_review_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.legacy_archive_kru%rowtype; i public.canonical_identity%rowtype; actor_identity uuid; old_meta jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(149,1);
 PERFORM ptv_access_private.authorize(p_actor,p_iat,'crew.permissions.manage');
 IF p_archive IS NULL OR p_identity IS NULL OR p_legacy_uuid IS NULL OR p_manifest_sha256 IS NULL
   OR p_manifest_sha256 !~ '^[0-9a-f]{64}$' OR length(trim(coalesce(p_review_reference,'')))<8
 THEN RAISE EXCEPTION 'reviewed manifest required' USING ERRCODE='22023'; END IF;
 SELECT identity_id INTO actor_identity FROM public.user_account WHERE id=p_actor;
 SELECT * INTO a FROM public.legacy_archive_kru WHERE archive_id=p_archive FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'archive missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO i FROM public.canonical_identity WHERE id=p_identity FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'canonical migration required; never provision from linking RPC' USING ERRCODE='22023'; END IF;
 IF i.id=actor_identity OR EXISTS(SELECT 1 FROM public.user_account u JOIN public.account_profiles p ON p.account_id=u.id
   WHERE u.identity_id=i.id AND p.profile_id='root_executive')
 THEN RAISE EXCEPTION 'self or Root identity protected' USING ERRCODE='42501'; END IF;
 IF lower(trim(coalesce(a.production_id,'')))<>p_legacy_uuid::text OR a.ptv_id IS DISTINCT FROM i.ptv_id
   OR i.metadata->>'legacy_source_project' IS DISTINCT FROM 'jthzuhkblxcaohiuypqq'
   OR i.metadata->>'legacy_source_table' IS DISTINCT FROM 'ptv_kru'
   OR i.metadata->>'legacy_uuid' IS DISTINCT FROM p_legacy_uuid::text
 THEN RAISE EXCEPTION 'immutable provenance not established' USING ERRCODE='22023'; END IF;
 IF a.status IN ('test_quarantine','quarantine') OR a.metadata_json->>'created_by_test'='true'
   OR (SELECT count(*) FROM public.legacy_archive_kru WHERE lower(trim(production_id))=lower(trim(a.production_id)))<>1
   OR (SELECT count(*) FROM public.legacy_archive_kru WHERE upper(trim(ptv_id))=upper(trim(a.ptv_id)))<>1
   OR EXISTS(SELECT 1 FROM public.legacy_archive_kru WHERE canonical_identity_id=i.id AND archive_id<>a.archive_id)
   OR EXISTS(SELECT 1 FROM public.canonical_identity WHERE id<>i.id AND metadata->>'legacy_source_project'='jthzuhkblxcaohiuypqq'
     AND metadata->>'legacy_source_table'='ptv_kru' AND metadata->>'legacy_uuid'=p_legacy_uuid::text)
 THEN RAISE EXCEPTION 'duplicate or quarantine requires manual decision' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.organization_membership WHERE identity_id=i.id AND organization_id='ptv_studio' AND is_current)<>1
   OR (SELECT count(*) FROM public.user_account WHERE identity_id=i.id)>1
 THEN RAISE EXCEPTION 'ambiguous target relationships' USING ERRCODE='22023'; END IF;
 PERFORM ptv_access_private.assert_recovery();
 -- A person can have zero accounts. No account is inserted or enabled here.
 IF a.canonical_identity_id=i.id AND a.metadata_json->>'link_manifest_sha256'=p_manifest_sha256 AND a.reconciliation_status='linked' THEN
   RETURN jsonb_build_object('success',true,'no_op',true);
 END IF;
 IF a.canonical_identity_id IS NOT NULL THEN RAISE EXCEPTION 'existing link is immutable here' USING ERRCODE='42501'; END IF;
 IF p_expected_version IS NULL OR p_identity_version IS NULL
   OR coalesce((a.metadata_json->>'updated_at')::timestamptz,a.imported_at) IS DISTINCT FROM p_expected_version
   OR i.updated_at IS DISTINCT FROM p_identity_version
 THEN RAISE EXCEPTION 'stale reconciliation' USING ERRCODE='40001'; END IF;
 old_meta:=coalesce(a.metadata_json,'{}'::jsonb);
 UPDATE public.legacy_archive_kru SET canonical_identity_id=i.id,reconciliation_status='linked',
   metadata_json=old_meta||jsonb_build_object('link_manifest_sha256',p_manifest_sha256,'updated_at',clock_timestamp())
 WHERE archive_id=a.archive_id;
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(actor_identity,'legacy_personnel_linked',
   jsonb_build_object('archive_id',a.archive_id,'canonical_identity_id',i.id,'manifest_sha256',p_manifest_sha256,
     'review_reference',p_review_reference,'previous_link',a.canonical_identity_id,'previous_reconciliation_status',a.reconciliation_status,'previous_version',p_expected_version));
 RETURN jsonb_build_object('success',true,'no_op',false);
END;
$$;
CREATE FUNCTION public.rpc_link_legacy_personnel(
 p_actor uuid,p_iat bigint,p_archive uuid,p_identity uuid,p_legacy_uuid uuid,
 p_expected_version timestamptz,p_identity_version timestamptz,p_manifest_sha256 text,p_review_reference text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT ptv_access_private.link_legacy_personnel(p_actor,p_iat,p_archive,p_identity,p_legacy_uuid,p_expected_version,p_identity_version,p_manifest_sha256,p_review_reference);
$$;
REVOKE ALL ON FUNCTION ptv_access_private.link_legacy_personnel(uuid,bigint,uuid,uuid,uuid,timestamptz,timestamptz,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rpc_link_legacy_personnel(uuid,bigint,uuid,uuid,uuid,timestamptz,timestamptz,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ptv_access_private.link_legacy_personnel(uuid,bigint,uuid,uuid,uuid,timestamptz,timestamptz,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_link_legacy_personnel(uuid,bigint,uuid,uuid,uuid,timestamptz,timestamptz,text,text) TO service_role;
COMMIT;
