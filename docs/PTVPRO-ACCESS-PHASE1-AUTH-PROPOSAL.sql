-- LOCAL PROPOSAL. Install after Access149 preparation + Access152, never through a public API.
-- Staging only after separate ACC. Default policy is disabled. No accounts/Root assignments are created.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF session_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
 OR (SELECT system_identifier::text FROM pg_control_system())<>'__APPROVED_DATABASE_SYSTEM_IDENTIFIER__'
 THEN RAISE EXCEPTION 'approved direct administrative connection required' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('ptv_access_private.can_account(uuid,text)') IS NULL THEN RAISE EXCEPTION 'Access149 required'; END IF;
END $$;
CREATE SCHEMA ptv_auth_private;
REVOKE ALL ON SCHEMA ptv_auth_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE ptv_auth_private.policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false,
 window_seconds integer NOT NULL DEFAULT 900 CHECK(window_seconds BETWEEN 60 AND 3600),
 account_limit integer NOT NULL DEFAULT 5 CHECK(account_limit BETWEEN 1 AND 30),
 ingress_limit integer NOT NULL DEFAULT 30 CHECK(ingress_limit BETWEEN 1 AND 300),
 session_seconds integer NOT NULL DEFAULT 604800 CHECK(session_seconds BETWEEN 300 AND 604800)
);
INSERT INTO ptv_auth_private.policy(singleton) VALUES(true);
CREATE TABLE ptv_auth_private.buckets(key text PRIMARY KEY,window_start bigint NOT NULL,used integer NOT NULL CHECK(used>0),updated_at timestamptz NOT NULL);
CREATE TABLE ptv_auth_private.attempts(
 id uuid PRIMARY KEY,secret_hash text NOT NULL CHECK(secret_hash~'^[0-9a-f]{64}$'),
 identifier_key text NOT NULL,ingress_key text NOT NULL,account_id uuid REFERENCES public.user_account(id),
 identity_id uuid,account_version timestamptz,credential_version timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,
 completed boolean NOT NULL DEFAULT false,session_fingerprint text
);
CREATE INDEX attempts_expiry ON ptv_auth_private.attempts(expires_at);
CREATE TABLE ptv_auth_private.sessions(
 fingerprint text PRIMARY KEY CHECK(fingerprint~'^[0-9a-f]{64}$'),session_id uuid UNIQUE,
 account_id uuid NOT NULL REFERENCES public.user_account(id),identity_id uuid NOT NULL,
 issued_at bigint NOT NULL,expires_at timestamptz NOT NULL,credential_version timestamptz,
 revoked_at timestamptz,route text NOT NULL CHECK(route IN('password','google','legacy'))
);
CREATE INDEX sessions_expiry ON ptv_auth_private.sessions(expires_at);
CREATE UNIQUE INDEX auth_password_enrollment_operation ON public.auth_audit_log ((metadata->>'enrollment_id')) WHERE event_type='password_credential_enrolled';
ALTER TABLE ptv_auth_private.policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_auth_private.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_auth_private.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptv_auth_private.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ptv_auth_private FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION ptv_auth_private.require_server() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF coalesce(current_setting('role',true),'')<>'service_role'
 OR coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role'
 THEN RAISE EXCEPTION 'trusted server only' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION ptv_auth_private.take_budget(p_key text,p_limit integer,p_window integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE slot bigint; used_count integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('portal-auth:'||p_key,0));
 slot:=floor(extract(epoch FROM clock_timestamp())/p_window)::bigint;
 INSERT INTO ptv_auth_private.buckets(key,window_start,used,updated_at) VALUES(p_key,slot,1,clock_timestamp())
 ON CONFLICT(key) DO UPDATE SET used=CASE WHEN buckets.window_start=slot THEN least(buckets.used+1,p_limit+1) ELSE 1 END,
 window_start=slot,updated_at=clock_timestamp() RETURNING used INTO used_count;
 RETURN used_count<=p_limit;
END $$;
CREATE FUNCTION public.rpc_portal_login_begin(p_id uuid,p_secret_hash text,p_identifier text,p_identifier_key text,p_ingress_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE config ptv_auth_private.policy%rowtype; ticket ptv_auth_private.attempts%rowtype; a public.user_account%rowtype; c public.auth_credentials%rowtype; matches integer; allowed boolean; budget_key text;
BEGIN
 PERFORM ptv_auth_private.require_server();
 SELECT * INTO config FROM ptv_auth_private.policy WHERE singleton;
 IF NOT config.enabled THEN RETURN jsonb_build_object('enabled',false); END IF;
 IF p_id IS NULL OR p_secret_hash IS NULL OR p_secret_hash!~'^[0-9a-f]{64}$' OR p_identifier_key IS NULL OR p_identifier_key!~'^[0-9a-f]{64}$'
 OR p_ingress_key IS NULL OR p_ingress_key!~'^[0-9a-f]{64}$' OR nullif(trim(p_identifier),'') IS NULL OR length(p_identifier)>254
 THEN RAISE EXCEPTION 'invalid login request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('portal-attempt:'||p_id::text,0));
 SELECT * INTO ticket FROM ptv_auth_private.attempts WHERE id=p_id;
 IF FOUND THEN
   IF ticket.secret_hash<>p_secret_hash OR ticket.identifier_key<>p_identifier_key OR ticket.ingress_key<>p_ingress_key THEN RAISE EXCEPTION 'attempt binding mismatch' USING ERRCODE='42501'; END IF;
   IF ticket.completed OR ticket.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('enabled',true,'allowed',false); END IF;
   SELECT * INTO c FROM public.auth_credentials WHERE account_id=ticket.account_id AND updated_at=ticket.credential_version;
   RETURN jsonb_build_object('enabled',true,'allowed',true,'account_id',ticket.account_id,'identity_id',ticket.identity_id,'hash',c.password_hash,'session_seconds',config.session_seconds);
 END IF;
 allowed:=ptv_auth_private.take_budget('ip:'||p_ingress_key,config.ingress_limit,config.window_seconds);
 IF NOT allowed THEN RETURN jsonb_build_object('enabled',true,'allowed',false,'retry_after',config.window_seconds); END IF;
 SELECT count(*) INTO matches FROM public.user_account u JOIN public.canonical_identity i ON i.id=u.identity_id
 WHERE lower(u.username)=lower(trim(p_identifier)) OR upper(i.ptv_id)=upper(trim(p_identifier));
 IF matches=1 THEN
   SELECT u.* INTO a FROM public.user_account u JOIN public.canonical_identity i ON i.id=u.identity_id
   WHERE lower(u.username)=lower(trim(p_identifier)) OR upper(i.ptv_id)=upper(trim(p_identifier));
   SELECT * INTO c FROM public.auth_credentials WHERE account_id=a.id;
 END IF;
 budget_key:=CASE WHEN a.id IS NULL THEN 'unknown:'||p_identifier_key ELSE 'account:'||a.id::text END;
 IF NOT ptv_auth_private.take_budget(budget_key,config.account_limit,config.window_seconds) THEN RETURN jsonb_build_object('enabled',true,'allowed',false,'retry_after',config.window_seconds); END IF;
 INSERT INTO ptv_auth_private.attempts(id,secret_hash,identifier_key,ingress_key,account_id,identity_id,account_version,credential_version,expires_at)
 VALUES(p_id,p_secret_hash,p_identifier_key,p_ingress_key,a.id,a.identity_id,a.updated_at,c.updated_at,clock_timestamp()+interval '2 minutes');
 RETURN jsonb_build_object('enabled',true,'allowed',true,'account_id',a.id,'identity_id',a.identity_id,'hash',c.password_hash,'session_seconds',config.session_seconds);
END $$;

CREATE FUNCTION public.rpc_portal_login_finish(p_id uuid,p_secret_hash text,p_success boolean,p_fingerprint text,p_session_id uuid,p_iat bigint,p_exp bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t ptv_auth_private.attempts%rowtype; a public.user_account%rowtype; c public.auth_credentials%rowtype; ttl integer; valid boolean;
BEGIN
 PERFORM ptv_auth_private.require_server(); PERFORM pg_advisory_xact_lock(149,1);
 SELECT * INTO t FROM ptv_auth_private.attempts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p_secret_hash IS NULL OR t.secret_hash<>p_secret_hash THEN RAISE EXCEPTION 'attempt not authorized' USING ERRCODE='42501'; END IF;
 IF t.completed THEN RETURN p_success AND t.session_fingerprint=p_fingerprint AND EXISTS(SELECT 1 FROM ptv_auth_private.sessions WHERE fingerprint=p_fingerprint AND revoked_at IS NULL AND expires_at>clock_timestamp()); END IF;
 IF t.expires_at<=clock_timestamp() THEN RETURN false; END IF;
 SELECT * INTO a FROM public.user_account WHERE id=t.account_id FOR UPDATE;
 SELECT * INTO c FROM public.auth_credentials WHERE account_id=t.account_id FOR UPDATE;
 SELECT session_seconds INTO ttl FROM ptv_auth_private.policy WHERE singleton AND enabled;
 valid:=coalesce(p_success,false) AND ttl IS NOT NULL AND a.id IS NOT NULL AND a.status_akun='active' AND (a.lockout_until IS NULL OR a.lockout_until<=clock_timestamp())
   AND a.identity_id=t.identity_id AND a.updated_at=t.account_version AND c.updated_at=t.credential_version
   AND c.hash_algorithm='bcrypt' AND c.password_hash~'^\$2[aby]\$10\$[./A-Za-z0-9]{53}$'
   AND p_session_id IS NOT NULL AND p_fingerprint~'^[0-9a-f]{64}$' AND p_iat>0 AND p_exp>p_iat
   AND p_iat BETWEEN floor(extract(epoch FROM t.created_at))::bigint-5 AND floor(extract(epoch FROM clock_timestamp()))::bigint
   AND p_exp<=p_iat+ttl AND to_timestamp(p_exp)>clock_timestamp() AND (a.tokens_valid_after IS NULL OR to_timestamp(p_iat)>=a.tokens_valid_after)
   AND (SELECT count(*) FROM public.organization_membership WHERE identity_id=a.identity_id AND organization_id='ptv_studio' AND is_current)=1
   AND ptv_access_private.can_account(a.id,'hub.access');
 IF valid THEN
   INSERT INTO ptv_auth_private.sessions(fingerprint,session_id,account_id,identity_id,issued_at,expires_at,credential_version,route)
   VALUES(p_fingerprint,p_session_id,a.id,a.identity_id,p_iat,to_timestamp(p_exp),c.updated_at,'password');
 END IF;
 UPDATE ptv_auth_private.attempts SET completed=true,session_fingerprint=CASE WHEN valid THEN p_fingerprint ELSE NULL END WHERE id=t.id;
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(a.identity_id,CASE WHEN valid THEN 'portal_login_verified' ELSE 'portal_login_failed' END,
   jsonb_build_object('proof_version',1,'account_id',a.id,'credential_version',c.updated_at,'login_route','vercel_password','session_iat',p_iat,'session_fingerprint',CASE WHEN valid THEN p_fingerprint ELSE NULL END,'attempt_id',t.id));
 RETURN coalesce(valid,false);
END $$;

CREATE FUNCTION public.rpc_portal_session_valid(p_actor uuid,p_identity uuid,p_iat bigint,p_exp bigint,p_session_id uuid,p_fingerprint text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s ptv_auth_private.sessions%rowtype;
BEGIN
 PERFORM ptv_auth_private.require_server();
 IF p_fingerprint IS NULL OR p_fingerprint!~'^[0-9a-f]{64}$' OR p_iat IS NULL OR p_exp IS NULL OR p_iat<=0 OR p_iat>extract(epoch FROM clock_timestamp()) OR p_exp<=extract(epoch FROM clock_timestamp()) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_account WHERE id=p_actor AND identity_id=p_identity AND status_akun='active'
   AND (lockout_until IS NULL OR lockout_until<=clock_timestamp()) AND (tokens_valid_after IS NULL OR to_timestamp(p_iat)>=tokens_valid_after)) THEN RETURN false; END IF;
 SELECT * INTO s FROM ptv_auth_private.sessions WHERE fingerprint=p_fingerprint;
 IF NOT FOUND THEN RETURN p_session_id IS NULL; END IF; -- Existing signed cookies survive activation until their expiry/revocation.
 RETURN s.account_id=p_actor AND s.identity_id=p_identity AND s.issued_at=p_iat AND s.session_id IS NOT DISTINCT FROM p_session_id
   AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND s.expires_at=to_timestamp(p_exp)
   AND (s.route='legacy' OR EXISTS(SELECT 1 FROM public.auth_credentials WHERE account_id=s.account_id AND updated_at=s.credential_version));
END $$;
CREATE FUNCTION public.rpc_portal_session_revoke(p_actor uuid,p_identity uuid,p_iat bigint,p_exp bigint,p_session_id uuid,p_fingerprint text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s ptv_auth_private.sessions%rowtype;
BEGIN
 PERFORM ptv_auth_private.require_server(); PERFORM pg_advisory_xact_lock(149,1);
 IF p_fingerprint IS NULL OR p_fingerprint!~'^[0-9a-f]{64}$' OR p_iat IS NULL OR p_iat<=0 OR p_iat>extract(epoch FROM clock_timestamp()) OR p_exp IS NULL OR p_exp<=extract(epoch FROM clock_timestamp())
 OR NOT EXISTS(SELECT 1 FROM public.user_account WHERE id=p_actor AND identity_id=p_identity)
 THEN RAISE EXCEPTION 'invalid session binding' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM ptv_auth_private.sessions WHERE fingerprint=p_fingerprint FOR UPDATE;
 IF FOUND THEN
   IF s.account_id<>p_actor OR s.identity_id<>p_identity OR s.session_id IS DISTINCT FROM p_session_id OR s.issued_at<>p_iat OR s.expires_at<>to_timestamp(p_exp) THEN RAISE EXCEPTION 'session binding mismatch' USING ERRCODE='42501'; END IF;
   IF s.revoked_at IS NOT NULL THEN RETURN true; END IF;
   UPDATE ptv_auth_private.sessions SET revoked_at=clock_timestamp() WHERE fingerprint=p_fingerprint;
 ELSE
   IF p_session_id IS NOT NULL THEN RAISE EXCEPTION 'unregistered session' USING ERRCODE='42501'; END IF;
   INSERT INTO ptv_auth_private.sessions(fingerprint,account_id,identity_id,issued_at,expires_at,revoked_at,route)
   VALUES(p_fingerprint,p_actor,p_identity,p_iat,to_timestamp(p_exp),clock_timestamp(),'legacy');
 END IF;
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(p_identity,'portal_session_revoked',jsonb_build_object('account_id',p_actor,'session_fingerprint',p_fingerprint));
 RETURN true;
END $$;

CREATE FUNCTION ptv_auth_private.enroll_password(p_operation uuid,p_account uuid,p_identity uuid,p_account_version timestamptz,p_credential_version timestamptz,p_hash text,p_manifest text,p_review text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.user_account%rowtype; c public.auth_credentials%rowtype; receipt jsonb; hash_digest text; enrolled_version timestamptz;
BEGIN
 IF session_user<>'postgres' OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres') OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}') THEN RAISE EXCEPTION 'direct operator SQL only' USING ERRCODE='42501'; END IF;
 IF p_operation IS NULL OR p_hash IS NULL OR p_hash!~'^\$2[aby]\$10\$[./A-Za-z0-9]{53}$' OR p_manifest IS NULL OR p_manifest!~'^[0-9a-f]{64}$' OR length(trim(coalesce(p_review,'')))<8 THEN RAISE EXCEPTION 'reviewed supported credential required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(149,1);
 hash_digest:=encode(sha256(convert_to(p_hash,'UTF8')),'hex');
 SELECT metadata INTO receipt FROM public.auth_audit_log WHERE event_type='password_credential_enrolled' AND metadata->>'enrollment_id'=p_operation::text;
 IF FOUND THEN
   IF receipt->>'account_id' IS DISTINCT FROM p_account::text OR receipt->>'identity_id' IS DISTINCT FROM p_identity::text OR receipt->>'manifest_sha256' IS DISTINCT FROM p_manifest OR receipt->>'credential_digest' IS DISTINCT FROM hash_digest THEN RAISE EXCEPTION 'enrollment replay differs' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.auth_credentials saved JOIN public.user_account owner_account ON owner_account.id=saved.account_id WHERE owner_account.id=p_account AND owner_account.identity_id=p_identity AND saved.password_hash=p_hash AND saved.updated_at=(receipt->>'credential_version')::timestamptz) THEN RAISE EXCEPTION 'enrolled credential changed' USING ERRCODE='40001'; END IF;
   RETURN true;
 END IF;
 SELECT * INTO a FROM public.user_account WHERE id=p_account FOR UPDATE;
 SELECT * INTO c FROM public.auth_credentials WHERE account_id=p_account FOR UPDATE;
 IF a.id IS NULL OR a.identity_id IS DISTINCT FROM p_identity OR a.updated_at IS DISTINCT FROM p_account_version OR c.updated_at IS DISTINCT FROM p_credential_version
 OR (SELECT count(*) FROM public.organization_membership WHERE identity_id=a.identity_id AND organization_id='ptv_studio' AND is_current)<>1
 OR EXISTS(SELECT 1 FROM public.account_profiles WHERE account_id=p_account AND profile_id='root_executive')
 OR c.password_hash IS NOT NULL
 THEN RAISE EXCEPTION 'stale, protected, ambiguous or existing credential' USING ERRCODE='42501'; END IF;
 INSERT INTO public.auth_credentials(account_id,password_hash,hash_algorithm,needs_rehash,password_updated_at,updated_at)
 VALUES(a.id,p_hash,'bcrypt',false,clock_timestamp(),clock_timestamp())
 ON CONFLICT(account_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,hash_algorithm='bcrypt',needs_rehash=false,password_updated_at=EXCLUDED.password_updated_at,updated_at=EXCLUDED.updated_at RETURNING updated_at INTO enrolled_version;
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(NULL,'password_credential_enrolled',jsonb_build_object('enrollment_id',p_operation,'account_id',a.id,'identity_id',a.identity_id,'manifest_sha256',p_manifest,'review_reference',p_review,'credential_digest',hash_digest,'credential_version',enrolled_version,'database_principal',session_user));
 RETURN true;
END $$;

CREATE FUNCTION public.rpc_portal_google_session(p_actor uuid,p_identity uuid,p_subject text,p_credential_version timestamptz,p_session_id uuid,p_fingerprint text,p_iat bigint,p_exp bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.auth_credentials%rowtype; ttl integer;
BEGIN
 PERFORM ptv_auth_private.require_server(); PERFORM pg_advisory_xact_lock(149,1);
 SELECT * INTO c FROM public.auth_credentials WHERE account_id=p_actor FOR UPDATE;
 SELECT session_seconds INTO ttl FROM ptv_auth_private.policy WHERE singleton;
 IF c.account_id IS NULL OR c.updated_at IS DISTINCT FROM p_credential_version OR c.oauth_provider IS DISTINCT FROM 'google' OR c.oauth_subject_id IS DISTINCT FROM p_subject OR nullif(p_subject,'') IS NULL
 OR (SELECT count(*) FROM public.auth_credentials WHERE oauth_provider='google' AND oauth_subject_id=p_subject)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_account WHERE id=p_actor AND identity_id=p_identity AND status_akun='active' AND (lockout_until IS NULL OR lockout_until<=clock_timestamp()) AND (tokens_valid_after IS NULL OR to_timestamp(p_iat)>=tokens_valid_after))
 OR NOT ptv_access_private.can_account(p_actor,'hub.access') OR p_session_id IS NULL OR p_fingerprint IS NULL OR p_fingerprint!~'^[0-9a-f]{64}$'
 OR p_iat IS NULL OR p_iat<=0 OR p_iat>extract(epoch FROM clock_timestamp()) OR p_exp IS NULL OR p_exp<=extract(epoch FROM clock_timestamp()) OR p_exp>p_iat+ttl THEN RAISE EXCEPTION 'verified Google session binding required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM ptv_auth_private.sessions WHERE fingerprint=p_fingerprint) THEN RETURN public.rpc_portal_session_valid(p_actor,p_identity,p_iat,p_exp,p_session_id,p_fingerprint); END IF;
 INSERT INTO ptv_auth_private.sessions VALUES(p_fingerprint,p_session_id,p_actor,p_identity,p_iat,to_timestamp(p_exp),c.updated_at,NULL,'google');
 INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(p_identity,'portal_login_verified',jsonb_build_object('proof_version',1,'account_id',p_actor,'credential_version',c.updated_at,'login_route','vercel_google','session_iat',p_iat,'session_fingerprint',p_fingerprint));
 RETURN true;
END $$;

CREATE FUNCTION ptv_auth_private.usable_portal_login(p_id uuid,p_proof bigint DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_account a JOIN public.auth_credentials c ON c.account_id=a.id
 JOIN public.auth_audit_log l ON l.actor_id=a.identity_id AND l.event_type='portal_login_verified'
 WHERE a.id=p_id AND a.status_akun='active' AND (a.lockout_until IS NULL OR a.lockout_until<=now())
 AND ptv_access_private.can_account(a.id,'hub.access')
 AND l.metadata->>'account_id'=a.id::text AND l.metadata->>'proof_version'='1' AND (p_proof IS NULL OR l.id=p_proof)
 AND (l.metadata->>'credential_version')::timestamptz=c.updated_at AND l.created_at>=c.updated_at
 -- A durable credential-ownership proof is not an authorization session. Bootstrap revokes sessions after checking this proof.
 AND ((l.metadata->>'login_route'='vercel_google' AND c.oauth_provider='google' AND nullif(c.oauth_subject_id,'') IS NOT NULL
   AND (SELECT count(*) FROM public.auth_credentials WHERE oauth_provider='google' AND oauth_subject_id=c.oauth_subject_id)=1)
 OR (l.metadata->>'login_route'='vercel_password' AND c.hash_algorithm='bcrypt' AND c.password_hash~'^\$2[aby]\$10\$[./A-Za-z0-9]{53}$' AND l.metadata->>'session_fingerprint'~'^[0-9a-f]{64}$')));
$$;
CREATE FUNCTION ptv_auth_private.independent_credentials(p_root uuid,p_recovery uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_account r JOIN public.user_account b ON b.id=p_recovery
 JOIN public.auth_credentials rc ON rc.account_id=r.id JOIN public.auth_credentials bc ON bc.account_id=b.id
 WHERE r.id=p_root AND r.id<>b.id AND r.identity_id<>b.identity_id AND (r.auth_user_id IS NULL OR b.auth_user_id IS NULL OR r.auth_user_id<>b.auth_user_id)
 AND NOT (rc.oauth_provider IS NOT DISTINCT FROM 'google' AND bc.oauth_provider IS NOT DISTINCT FROM 'google' AND rc.oauth_subject_id IS NOT NULL AND rc.oauth_subject_id IS NOT DISTINCT FROM bc.oauth_subject_id)
 AND ((rc.oauth_subject_id IS NOT NULL AND bc.oauth_subject_id IS NOT NULL AND rc.oauth_subject_id<>bc.oauth_subject_id)
   OR (rc.password_hash IS NOT NULL AND bc.password_hash IS NOT NULL AND rc.password_hash<>bc.password_hash)
   OR (rc.password_hash IS NOT NULL AND bc.oauth_subject_id IS NOT NULL) OR (bc.password_hash IS NOT NULL AND rc.oauth_subject_id IS NOT NULL)));
$$;
CREATE OR REPLACE FUNCTION ptv_access_private.assert_recovery() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE attestation jsonb; root_id uuid; recovery_id uuid;
BEGIN
 SELECT metadata INTO attestation FROM public.auth_audit_log WHERE event_type='root_bootstrap_completed' ORDER BY id LIMIT 1;
 IF attestation IS NULL THEN RAISE EXCEPTION 'bootstrap recovery attestation missing' USING ERRCODE='42501'; END IF;
 root_id:=(attestation->>'root_account_id')::uuid; recovery_id:=(attestation->>'recovery_account_id')::uuid;
 IF NOT ptv_auth_private.independent_credentials(root_id,recovery_id)
 OR NOT EXISTS(SELECT 1 FROM public.auth_credentials rc JOIN public.auth_credentials bc ON bc.account_id=recovery_id
 WHERE rc.account_id=root_id AND rc.updated_at=(attestation->>'root_credential_version')::timestamptz AND bc.updated_at=(attestation->>'recovery_credential_version')::timestamptz)
 OR NOT EXISTS(SELECT 1 FROM public.account_profiles WHERE account_id=root_id AND profile_id='root_executive')
 OR NOT ptv_access_private.can_account(root_id,'crew.permissions.manage') OR NOT ptv_access_private.can_account(recovery_id,'crew.permissions.manage')
 OR NOT ptv_auth_private.usable_portal_login(root_id) OR NOT ptv_auth_private.usable_portal_login(recovery_id)
 THEN RAISE EXCEPTION 'independent verified recovery missing' USING ERRCODE='42501'; END IF;
END $$;

CREATE FUNCTION ptv_auth_private.purge_expired() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF session_user<>'postgres' OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres') OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}') THEN RAISE EXCEPTION 'direct operator SQL only' USING ERRCODE='42501'; END IF;
 DELETE FROM ptv_auth_private.attempts WHERE expires_at<clock_timestamp()-interval '24 hours';
 DELETE FROM ptv_auth_private.buckets WHERE updated_at<clock_timestamp()-interval '24 hours';
 DELETE FROM ptv_auth_private.sessions WHERE expires_at<clock_timestamp()-interval '24 hours';
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ptv_auth_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_portal_login_begin(uuid,text,text,text,text),public.rpc_portal_login_finish(uuid,text,boolean,text,uuid,bigint,bigint),public.rpc_portal_session_valid(uuid,uuid,bigint,bigint,uuid,text),public.rpc_portal_session_revoke(uuid,uuid,bigint,bigint,uuid,text),public.rpc_portal_google_session(uuid,uuid,text,timestamptz,uuid,text,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_portal_login_begin(uuid,text,text,text,text),public.rpc_portal_login_finish(uuid,text,boolean,text,uuid,bigint,bigint),public.rpc_portal_session_valid(uuid,uuid,bigint,bigint,uuid,text),public.rpc_portal_session_revoke(uuid,uuid,bigint,bigint,uuid,text),public.rpc_portal_google_session(uuid,uuid,text,timestamptz,uuid,text,bigint,bigint) TO service_role;
COMMIT;
