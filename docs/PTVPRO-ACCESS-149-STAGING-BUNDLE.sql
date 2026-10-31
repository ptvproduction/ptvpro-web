-- GENERATED PROPOSAL ONLY. NOT EXECUTED. ACC required; staging swadgljnyelsjstqqxbm only.
-- Regenerate with node scripts/build-access-149-proposal.mjs. Review input hashes before ACC.
-- docs/PTVPRO-ACCESS-149-PROPOSAL.sql sha256=db277a6319a846ab54719c93662281326b74bc5584137a3b384340408f103367
-- docs/PTVPRO-ACCESS-149-RLS-PROPOSAL.sql sha256=10a7f02d38f7cf4476e3337ecb87ec47e418f9e682400b43b3f087467fffb0a4
-- Mode: NORMAL: VERIFIED ROOT/RECOVERY REQUIRED
BEGIN;
-- PROPOSAL ONLY / PTV-DEV-149 / STAGING swadgljnyelsjstqqxbm
-- Belum dijalankan. Memerlukan ACC operator. Tidak mengubah profil/capability bisnis.
-- Jalankan sebagai satu transaksi setelah snapshot schema dan tinjauan; tidak untuk Production.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE SCHEMA IF NOT EXISTS ptv_access_private;
REVOKE ALL ON SCHEMA ptv_access_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ptv_access_private TO service_role;
-- Sensitive writes must use reviewed definer RPCs or direct operator SQL, never broad Data API grants.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.user_account,public.account_profiles,public.account_capability_overrides,
 public.auth_credentials,public.organization_membership,public.canonical_identity,public.access_profile,public.capability_registry,public.profile_capabilities
 FROM anon,authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.auth_audit_log FROM anon,authenticated;
REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.auth_audit_log FROM service_role;
GRANT INSERT ON public.auth_audit_log TO service_role;

-- Guard triggers do not grant privileges. Root assignment and its consumed marker require a direct approved admin transaction.
CREATE FUNCTION ptv_access_private.guard_root_profile_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF (TG_OP<>'INSERT' AND OLD.profile_id='root_executive') OR (TG_OP<>'DELETE' AND NEW.profile_id='root_executive') THEN
   IF session_user<>'postgres' OR current_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
     OR coalesce(current_setting('ptv.root_admin_approval_sha256',true),'') !~ '^[0-9a-f]{64}$'
   THEN RAISE EXCEPTION 'Root assignment requires approved direct administration' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
CREATE TRIGGER guard_root_profile_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.account_profiles
 FOR EACH ROW EXECUTE FUNCTION ptv_access_private.guard_root_profile_mutation();
CREATE FUNCTION ptv_access_private.guard_bootstrap_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'protected access or audit truncate forbidden' USING ERRCODE='42501'; END IF;
 IF TG_OP<>'INSERT' AND OLD.event_type IN ('root_bootstrap_completed','root_bootstrap_rolled_back') THEN
   RAISE EXCEPTION 'bootstrap audit marker is immutable' USING ERRCODE='42501';
 END IF;
 IF TG_OP<>'DELETE' AND NEW.event_type IN ('root_bootstrap_completed','root_bootstrap_rolled_back') THEN
   IF session_user<>'postgres' OR current_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
     OR coalesce(current_setting('ptv.root_admin_approval_sha256',true),'') !~ '^[0-9a-f]{64}$'
     OR NEW.metadata->>'approval_sha256' IS DISTINCT FROM current_setting('ptv.root_admin_approval_sha256',true)
   THEN RAISE EXCEPTION 'bootstrap audit requires approved direct administration' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
CREATE TRIGGER guard_bootstrap_audit BEFORE INSERT OR UPDATE OR DELETE ON public.auth_audit_log
 FOR EACH ROW EXECUTE FUNCTION ptv_access_private.guard_bootstrap_audit();
CREATE TRIGGER guard_bootstrap_audit_truncate BEFORE TRUNCATE ON public.auth_audit_log
 FOR EACH STATEMENT EXECUTE FUNCTION ptv_access_private.guard_bootstrap_audit();
CREATE TRIGGER guard_root_profiles_truncate BEFORE TRUNCATE ON public.account_profiles
 FOR EACH STATEMENT EXECUTE FUNCTION ptv_access_private.guard_bootstrap_audit();

CREATE FUNCTION ptv_access_private.can_account(p_id uuid, p_cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.user_account a
   JOIN public.organization_membership m ON m.identity_id=a.identity_id AND m.organization_id='ptv_studio' AND m.is_current
   JOIN public.capability_registry r ON r.key=p_cap
   WHERE a.id=p_id AND a.status_akun='active'
     AND m.status_organisasi IN ('active','inactive')
     AND (m.status_organisasi='active' OR NOT r.is_mutation)
     AND (SELECT count(*) FROM public.organization_membership mm WHERE mm.identity_id=a.identity_id AND mm.organization_id='ptv_studio' AND mm.is_current)=1
     AND NOT EXISTS(SELECT 1 FROM public.account_capability_overrides o WHERE o.account_id=a.id AND o.capability_key=p_cap AND o.override_type='deny')
     AND (EXISTS(SELECT 1 FROM public.account_capability_overrides o WHERE o.account_id=a.id AND o.capability_key=p_cap AND o.override_type='allow')
       OR EXISTS(SELECT 1 FROM public.account_profiles ap JOIN public.profile_capabilities pc ON pc.profile_id=ap.profile_id WHERE ap.account_id=a.id AND pc.capability_key=p_cap))
 );
$$;
CREATE FUNCTION ptv_access_private.authorize(p_actor uuid,p_iat bigint,p_cap text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public AS $$
BEGIN
 IF session_user <> 'postgres' AND coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','') <> 'service_role' THEN
   RAISE EXCEPTION 'server only' USING ERRCODE='42501';
 END IF;
 IF p_actor IS NULL OR p_iat IS NULL OR p_iat<=0 OR p_iat>extract(epoch FROM clock_timestamp()) OR NOT EXISTS(SELECT 1 FROM public.user_account WHERE id=p_actor AND status_akun='active' AND (tokens_valid_after IS NULL OR to_timestamp(p_iat)>=tokens_valid_after))
   OR NOT ptv_access_private.can_account(p_actor,'hub.access') OR NOT ptv_access_private.can_account(p_actor,p_cap) THEN
   RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
END;
$$;
-- Server-side login evidence is necessary, but human ownership/E2E independence still needs operator approval.
CREATE FUNCTION ptv_access_private.usable_google_login(p_id uuid,p_proof bigint DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_account a JOIN public.auth_credentials c ON c.account_id=a.id
 WHERE a.id=p_id AND a.status_akun='active' AND (a.lockout_until IS NULL OR a.lockout_until<=now())
 AND ptv_access_private.can_account(a.id,'hub.access')
 AND c.oauth_provider='google' AND nullif(trim(c.oauth_subject_id),'') IS NOT NULL
 AND (SELECT count(*) FROM public.auth_credentials cc WHERE cc.oauth_provider='google' AND cc.oauth_subject_id=c.oauth_subject_id)=1
 AND EXISTS(SELECT 1 FROM public.auth_audit_log l WHERE l.event_type='portal_login_verified' AND l.actor_id=a.identity_id
   AND l.metadata->>'account_id'=a.id::text AND l.metadata->>'proof_version'='1' AND l.metadata->>'login_route'='vercel_google'
   AND (p_proof IS NULL OR l.id=p_proof) AND l.created_at>=c.updated_at
   AND (l.metadata->>'credential_version')::timestamptz=c.updated_at));
$$;
CREATE FUNCTION ptv_access_private.assert_recovery() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE attestation jsonb; root_id uuid; recovery_id uuid;
BEGIN
 SELECT metadata INTO attestation FROM public.auth_audit_log WHERE event_type='root_bootstrap_completed' ORDER BY id LIMIT 1;
 IF attestation IS NULL THEN RAISE EXCEPTION 'bootstrap recovery attestation missing' USING ERRCODE='42501'; END IF;
 root_id:=(attestation->>'root_account_id')::uuid; recovery_id:=(attestation->>'recovery_account_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.user_account r JOIN public.user_account b ON b.id=recovery_id
   JOIN public.auth_credentials rc ON rc.account_id=r.id JOIN public.auth_credentials bc ON bc.account_id=b.id
   WHERE r.id=root_id AND r.id<>b.id AND r.identity_id<>b.identity_id
   AND (r.auth_user_id IS NULL OR b.auth_user_id IS NULL OR r.auth_user_id<>b.auth_user_id)
   AND rc.oauth_subject_id<>bc.oauth_subject_id
   AND rc.updated_at=(attestation->>'root_credential_version')::timestamptz
   AND bc.updated_at=(attestation->>'recovery_credential_version')::timestamptz
   AND EXISTS(SELECT 1 FROM public.account_profiles WHERE account_id=r.id AND profile_id='root_executive')
   AND ptv_access_private.can_account(r.id,'crew.permissions.manage') AND ptv_access_private.can_account(b.id,'crew.permissions.manage')
   AND ptv_access_private.usable_google_login(r.id) AND ptv_access_private.usable_google_login(b.id))
 THEN RAISE EXCEPTION 'independent recovery administrator missing' USING ERRCODE='42501'; END IF;
END;
$$;

CREATE FUNCTION ptv_access_private.manage_account_access(p_actor_account_id uuid,p_session_iat bigint,p_change jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public AS $$
DECLARE
 target public.user_account%rowtype;
 actor public.user_account%rowtype;
 before_state jsonb;
 new_profiles text[];
 new_allow text[];
 new_deny text[];
 key text;
 new_status text;
BEGIN
 -- Seluruh mutasi akses dan status personel memakai kunci sama, lalu reotorisasi.
 PERFORM pg_advisory_xact_lock(149,1);
 PERFORM ptv_access_private.authorize(p_actor_account_id,p_session_iat,'crew.permissions.manage');
 SELECT * INTO actor FROM public.user_account WHERE id=p_actor_account_id FOR UPDATE;
 SELECT * INTO target FROM public.user_account WHERE id=(p_change->>'accountId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'account missing' USING ERRCODE='22023'; END IF;
 IF target.id=actor.id OR target.identity_id=actor.identity_id THEN RAISE EXCEPTION 'self mutation forbidden' USING ERRCODE='42501'; END IF;
 IF target.updated_at IS DISTINCT FROM (p_change->>'expectedVersion')::timestamptz THEN RAISE EXCEPTION 'stale version' USING ERRCODE='40001'; END IF;
 IF coalesce((p_change->>'confirmed')::boolean,false) IS NOT TRUE OR length(trim(coalesce(p_change->>'reason','')))<5 THEN RAISE EXCEPTION 'confirmation and reason required' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_change->'profiles') IS DISTINCT FROM 'array' OR jsonb_typeof(p_change->'allowed') IS DISTINCT FROM 'array' OR jsonb_typeof(p_change->'denied') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid permission arrays' USING ERRCODE='22023'; END IF;
 SELECT array_agg(value) INTO new_profiles FROM jsonb_array_elements_text(p_change->'profiles');
 SELECT coalesce(array_agg(value),ARRAY[]::text[]) INTO new_allow FROM jsonb_array_elements_text(p_change->'allowed');
 SELECT coalesce(array_agg(value),ARRAY[]::text[]) INTO new_deny FROM jsonb_array_elements_text(p_change->'denied');
 new_status:=p_change->>'status';
 IF new_status NOT IN ('active','inactive') OR new_status IS NULL OR coalesce(cardinality(new_profiles),0)=0 THEN RAISE EXCEPTION 'invalid status/profile' USING ERRCODE='22023'; END IF;
 IF 'root_executive'=ANY(new_profiles) OR EXISTS(SELECT 1 FROM public.account_profiles p JOIN public.user_account a ON a.id=p.account_id WHERE a.identity_id=target.identity_id AND p.profile_id='root_executive') THEN RAISE EXCEPTION 'root protected' USING ERRCODE='42501'; END IF;
 IF new_allow && new_deny THEN RAISE EXCEPTION 'conflicting overrides' USING ERRCODE='22023'; END IF;
 IF cardinality(new_profiles)<>(SELECT count(distinct v) FROM unnest(new_profiles)v) OR cardinality(new_allow)<>(SELECT count(distinct v) FROM unnest(new_allow)v) OR cardinality(new_deny)<>(SELECT count(distinct v) FROM unnest(new_deny)v) THEN RAISE EXCEPTION 'duplicate entries' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(new_profiles)v WHERE NOT EXISTS(SELECT 1 FROM public.access_profile WHERE id=v)) OR EXISTS(SELECT 1 FROM unnest(new_allow||new_deny)v WHERE NOT EXISTS(SELECT 1 FROM public.capability_registry registry WHERE registry.key=v)) THEN RAISE EXCEPTION 'unknown permission' USING ERRCODE='22023'; END IF;
 -- Tidak dapat mendelegasikan kemampuan di luar izin efektif aktor.
 FOR key IN SELECT capability_key FROM public.profile_capabilities WHERE profile_id=ANY(new_profiles) UNION SELECT unnest(new_allow) LOOP
   IF NOT key=ANY(new_deny) AND NOT ptv_access_private.can_account(actor.id,key) THEN RAISE EXCEPTION 'delegation exceeds actor' USING ERRCODE='42501'; END IF;
 END LOOP;
 SELECT jsonb_build_object('status',target.status_akun,'profiles',(SELECT coalesce(jsonb_agg(profile_id),'[]'::jsonb) FROM public.account_profiles WHERE account_id=target.id),
 'overrides',(SELECT coalesce(jsonb_agg(jsonb_build_object('capability',capability_key,'type',override_type)),'[]'::jsonb) FROM public.account_capability_overrides WHERE account_id=target.id)) INTO before_state;
 DELETE FROM public.account_profiles WHERE account_id=target.id;
 INSERT INTO public.account_profiles(account_id,profile_id) SELECT target.id,unnest(new_profiles);
 DELETE FROM public.account_capability_overrides WHERE account_id=target.id;
 INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type,reason,granted_by)
 SELECT target.id,v,'allow',p_change->>'reason',actor.identity_id FROM unnest(new_allow)v
 UNION ALL SELECT target.id,v,'deny',p_change->>'reason',actor.identity_id FROM unnest(new_deny)v;
 UPDATE public.user_account SET status_akun=new_status,tokens_valid_after=clock_timestamp(),updated_at=clock_timestamp() WHERE id=target.id;
 PERFORM ptv_access_private.assert_recovery();
 IF NOT EXISTS(SELECT 1 FROM public.user_account a WHERE ptv_access_private.can_account(a.id,'hub.access') AND ptv_access_private.can_account(a.id,'crew.permissions.manage')) THEN RAISE EXCEPTION 'last administrator protected' USING ERRCODE='42501'; END IF;
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(actor.identity_id,'account_access_changed',jsonb_build_object('target_account_id',target.id,'before',before_state,'after',p_change));
 RETURN jsonb_build_object('success',true);
END;
$$;
CREATE FUNCTION public.rpc_manage_account_access(p_actor_account_id uuid,p_session_iat bigint,p_change jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ptv_access_private.manage_account_access(p_actor_account_id,p_session_iat,p_change); $$;

-- Sinkronisasi personel yang sudah terhubung; tidak membuat/mengubah akun login/profil akses.
CREATE FUNCTION ptv_access_private.update_crew_personnel(p_actor_account_id uuid,p_session_iat bigint,p_archive_id uuid,p_updates jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE rec public.legacy_archive_kru%rowtype; actor_identity uuid; cat text; new_status text; mapped_division text; mapped_cohort bigint; before_state jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(149,1);
 PERFORM ptv_access_private.authorize(p_actor_account_id,p_session_iat,CASE WHEN p_updates - ARRAY['version','id','archive_id','ptv_id','status_kru'] = '{}'::jsonb THEN 'crew.status.manage' ELSE 'crew.edit' END);
 SELECT identity_id INTO actor_identity FROM public.user_account WHERE id=p_actor_account_id;
 SELECT * INTO rec FROM public.legacy_archive_kru WHERE archive_id=p_archive_id FOR UPDATE;
 IF NOT FOUND OR rec.canonical_identity_id IS NULL THEN RAISE EXCEPTION 'linked personnel missing' USING ERRCODE='22023'; END IF;
 IF rec.canonical_identity_id=actor_identity THEN RAISE EXCEPTION 'self personnel mutation forbidden' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_account a JOIN public.account_profiles p ON p.account_id=a.id
   WHERE a.identity_id=rec.canonical_identity_id AND p.profile_id='root_executive')
 THEN RAISE EXCEPTION 'Root personnel protected' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.legacy_archive_kru WHERE canonical_identity_id=rec.canonical_identity_id)<>1
   OR (SELECT count(*) FROM public.legacy_archive_kru WHERE ptv_id=rec.ptv_id)<>1
   OR NOT EXISTS(SELECT 1 FROM public.canonical_identity WHERE id=rec.canonical_identity_id AND ptv_id=rec.ptv_id)
 THEN RAISE EXCEPTION 'identity reconciliation required' USING ERRCODE='22023'; END IF;
 before_state:=jsonb_build_object('status',rec.status,'category',rec.metadata_json->>'category','division',rec.divisi,'cohort',rec.angkatan);
 IF jsonb_typeof(p_updates) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(p_updates) e
   WHERE e.key NOT IN ('version','id','archive_id','ptv_id','status_kru','category','division','angkatan','full_name','position','foto_url','phone','email','nim','jurusan')
   OR e.value='null'::jsonb)
 THEN RAISE EXCEPTION 'invalid personnel fields' USING ERRCODE='22023'; END IF;
 IF (p_updates->>'version')::timestamptz IS DISTINCT FROM coalesce((rec.metadata_json->>'updated_at')::timestamptz,rec.imported_at) THEN RAISE EXCEPTION 'stale personnel version' USING ERRCODE='40001'; END IF;
 IF p_updates ?| ARRAY['role','username','status_akun','assigned_profiles','allowed_overrides','denied_overrides','password','oauth_email','oauth_uid','oauth_provider','metadata_json','canonical_identity_id','auth_user_id'] THEN RAISE EXCEPTION 'account fields forbidden' USING ERRCODE='42501'; END IF;
 IF p_updates ? 'ptv_id' AND p_updates->>'ptv_id'<>rec.ptv_id THEN RAISE EXCEPTION 'immutable ptv id' USING ERRCODE='22023'; END IF;
 IF p_updates ? 'status_kru' AND (p_updates->>'status_kru') IS DISTINCT FROM (CASE WHEN rec.status='aktif' THEN 'Aktif' ELSE 'Nonaktif' END) THEN
   PERFORM ptv_access_private.authorize(p_actor_account_id,p_session_iat,'crew.status.manage');
   IF p_updates->>'status_kru' NOT IN ('Aktif','Nonaktif') THEN RAISE EXCEPTION 'invalid membership' USING ERRCODE='22023'; END IF;
   IF rec.canonical_identity_id=actor_identity THEN RAISE EXCEPTION 'self membership mutation forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 cat:=coalesce(p_updates->>'category',rec.metadata_json->>'category');
 IF cat IS NULL OR cat NOT IN ('Kru','Pembina','Pengarah') THEN RAISE EXCEPTION 'explicit category reconciliation required' USING ERRCODE='22023'; END IF;
 IF p_updates ?| ARRAY['category','division','angkatan','position'] THEN
   PERFORM ptv_access_private.authorize(p_actor_account_id,p_session_iat,'crew.permissions.manage');
 END IF;
 IF cat='Kru' THEN
   SELECT id INTO mapped_division FROM public.organization_division
     WHERE id=CASE lower(coalesce(p_updates->>'division',rec.divisi)) WHEN 'engagement' THEN 'engagements' ELSE lower(coalesce(p_updates->>'division',rec.divisi)) END;
   IF mapped_division IS NULL THEN RAISE EXCEPTION 'division reconciliation required' USING ERRCODE='22023'; END IF;
   IF coalesce(p_updates->>'angkatan',rec.angkatan,'') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'cohort reconciliation required' USING ERRCODE='22023'; END IF;
   mapped_cohort:=coalesce(p_updates->>'angkatan',rec.angkatan)::bigint;
   IF mapped_cohort<1 OR mapped_cohort>2147483647 THEN RAISE EXCEPTION 'invalid cohort' USING ERRCODE='22023'; END IF;
 END IF;
 IF cat='Kru' AND p_updates ? 'division' AND p_updates->>'division' IS DISTINCT FROM rec.divisi AND p_updates->>'division' NOT IN ('Editor','Layouter','Technical','Engagement') THEN RAISE EXCEPTION 'invalid division' USING ERRCODE='22023'; END IF;
 IF p_updates ? 'full_name' AND length(trim(p_updates->>'full_name'))<2 THEN RAISE EXCEPTION 'invalid name' USING ERRCODE='22023'; END IF;
 new_status:=CASE WHEN p_updates ? 'status_kru' THEN CASE WHEN p_updates->>'status_kru'='Aktif' THEN 'aktif' ELSE 'nonaktif' END ELSE rec.status END;
 UPDATE public.legacy_archive_kru SET full_name=coalesce(p_updates->>'full_name',full_name),jabatan=coalesce(p_updates->>'position',jabatan),
 divisi=CASE WHEN cat<>'Kru' THEN NULL ELSE coalesce(p_updates->>'division',divisi) END,
 angkatan=CASE WHEN cat<>'Kru' THEN NULL ELSE coalesce(p_updates->>'angkatan',angkatan) END,status=new_status,
 photo_url=CASE WHEN p_updates ? 'foto_url' THEN nullif(p_updates->>'foto_url','') ELSE photo_url END,
 telepon_masked=CASE WHEN p_updates ? 'phone' THEN p_updates->>'phone' ELSE telepon_masked END,
 email_masked=CASE WHEN p_updates ? 'email' THEN p_updates->>'email' ELSE email_masked END,
 metadata_json=coalesce(metadata_json,'{}'::jsonb)||jsonb_build_object('category',cat,'updated_at',clock_timestamp(),'updated_by_account_id',p_actor_account_id)
   || (SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(p_updates) WHERE key IN ('nim','jurusan'))
 WHERE archive_id=p_archive_id RETURNING * INTO rec;
 UPDATE public.canonical_identity SET full_name=rec.full_name,avatar_url=rec.photo_url,updated_at=clock_timestamp() WHERE id=rec.canonical_identity_id;
 IF (SELECT count(*) FROM public.organization_membership WHERE identity_id=rec.canonical_identity_id AND organization_id='ptv_studio' AND is_current)<>1 THEN RAISE EXCEPTION 'ambiguous membership' USING ERRCODE='22023'; END IF;
 UPDATE public.organization_membership SET position_title=rec.jabatan,cohort=CASE WHEN cat='Kru' THEN mapped_cohort::int ELSE NULL END,
 division_id=CASE WHEN cat<>'Kru' THEN NULL ELSE mapped_division END,
 status_organisasi=CASE WHEN rec.status='aktif' THEN 'active' ELSE 'inactive' END,updated_at=clock_timestamp()
 WHERE identity_id=rec.canonical_identity_id AND organization_id='ptv_studio' AND is_current;
 -- Old signed sessions become unusable in endpoints checking token cutoff.
 UPDATE public.user_account SET tokens_valid_after=clock_timestamp(),updated_at=clock_timestamp() WHERE identity_id=rec.canonical_identity_id;
 PERFORM ptv_access_private.assert_recovery();
 IF NOT EXISTS(SELECT 1 FROM public.user_account a WHERE ptv_access_private.can_account(a.id,'hub.access') AND ptv_access_private.can_account(a.id,'crew.permissions.manage')) THEN RAISE EXCEPTION 'last administrator protected' USING ERRCODE='42501'; END IF;
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(actor_identity,'personnel_updated',jsonb_build_object('archive_id',p_archive_id,'changed_fields',(SELECT jsonb_agg(key) FROM jsonb_object_keys(p_updates)key),'before',before_state,'after',jsonb_build_object('status',rec.status,'category',cat,'division',rec.divisi,'cohort',rec.angkatan)));
 RETURN to_jsonb(rec);
END;
$$;
CREATE FUNCTION public.rpc_update_crew_personnel(p_actor_account_id uuid,p_session_iat bigint,p_archive_id uuid,p_updates jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ptv_access_private.update_crew_personnel(p_actor_account_id,p_session_iat,p_archive_id,p_updates); $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ptv_access_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ptv_access_private.manage_account_access(uuid,bigint,jsonb),ptv_access_private.update_crew_personnel(uuid,bigint,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_manage_account_access(uuid,bigint,jsonb),public.rpc_update_crew_personnel(uuid,bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_manage_account_access(uuid,bigint,jsonb),public.rpc_update_crew_personnel(uuid,bigint,uuid,jsonb) TO service_role;
DO $$ BEGIN PERFORM ptv_access_private.assert_recovery(); END $$;

-- PROPOSAL ONLY. ACC operator wajib. Staging swadgljnyelsjstqqxbm saja.
-- Bind identity/status to database on EVERY call, including tokens containing account_id.
CREATE OR REPLACE FUNCTION public.has_capability(p_capability text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $$
DECLARE a public.user_account%rowtype; org_status text; mutation boolean; sensitive boolean; iat bigint;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 IF (SELECT count(*) FROM public.user_account WHERE auth_user_id=auth.uid())<>1 THEN RETURN false; END IF;
 SELECT * INTO a FROM public.user_account WHERE auth_user_id=auth.uid();
 IF a.status_akun IS DISTINCT FROM 'active' THEN RETURN false; END IF;
 IF (SELECT count(*) FROM public.organization_membership WHERE identity_id=a.identity_id AND organization_id='ptv_studio' AND is_current)<>1 THEN RETURN false; END IF;
 SELECT status_organisasi INTO org_status FROM public.organization_membership WHERE identity_id=a.identity_id AND organization_id='ptv_studio' AND is_current;
 IF org_status IS NULL OR org_status NOT IN ('active','inactive') THEN RETURN false; END IF;
 SELECT is_mutation,is_sensitive INTO mutation,sensitive FROM public.capability_registry WHERE key=p_capability;
 IF NOT FOUND THEN RETURN false; END IF;
 IF org_status='inactive' AND mutation THEN RETURN false; END IF;
 iat:=nullif(auth.jwt()->>'iat','')::bigint;
 IF a.tokens_valid_after IS NOT NULL AND (iat IS NULL OR to_timestamp(iat)<a.tokens_valid_after) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.account_capability_overrides WHERE account_id=a.id AND capability_key=p_capability AND override_type='deny') THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.account_capability_overrides WHERE account_id=a.id AND capability_key=p_capability AND override_type='allow')
   OR EXISTS(SELECT 1 FROM public.account_profiles ap JOIN public.profile_capabilities pc ON pc.profile_id=ap.profile_id WHERE ap.account_id=a.id AND pc.capability_key=p_capability);
END;
$$;
-- Existing EXECUTE grants and existing RLS policies are retained; no new data-access policy.

COMMIT;
