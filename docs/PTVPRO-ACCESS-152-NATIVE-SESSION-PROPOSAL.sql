-- PROPOSAL ONLY. Separate operator ACC, backup and preflight required. No cloud execution in sprint152.
-- Apply after reviewed Access149 preparation. Never substitute identity or operator from request payload.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres'
   OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
   OR '__APPROVED_DATABASE_SYSTEM_IDENTIFIER__' IS DISTINCT FROM (SELECT system_identifier::text FROM pg_control_system())
 THEN RAISE EXCEPTION 'reviewed direct administrative connection and cluster approval required' USING ERRCODE='42501'; END IF;
 IF to_regclass('auth.sessions') IS NULL THEN RAISE EXCEPTION 'native session store unavailable'; END IF;
END $$;

-- Keep Access149 mutation RPC signatures/ACLs. Neither a role claim alone nor a locked actor is sufficient.
CREATE OR REPLACE FUNCTION ptv_access_private.authorize(p_actor uuid,p_iat bigint,p_cap text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE trusted_admin boolean; trusted_server boolean;
BEGIN
 trusted_admin:=session_user='postgres' AND coalesce(current_setting('role',true),'none') IN ('none','postgres')
   AND coalesce(current_setting('request.jwt.claims',true),'') IN ('','{}');
 trusted_server:=coalesce(current_setting('role',true),'')='service_role'
   AND coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')='service_role';
 IF NOT (trusted_admin OR trusted_server) THEN RAISE EXCEPTION 'server only' USING ERRCODE='42501'; END IF;
 IF p_actor IS NULL OR p_iat IS NULL OR p_iat<=0 OR p_iat>extract(epoch FROM clock_timestamp())
   OR NOT EXISTS(SELECT 1 FROM public.user_account WHERE id=p_actor AND status_akun='active'
     AND (lockout_until IS NULL OR lockout_until<=now()) AND (tokens_valid_after IS NULL OR to_timestamp(p_iat)>=tokens_valid_after))
   OR NOT ptv_access_private.can_account(p_actor,'hub.access') OR NOT ptv_access_private.can_account(p_actor,p_cap)
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_capability(p_capability text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $$
DECLARE a public.user_account%rowtype; claims jsonb; native_id uuid; native_session uuid;
 issued bigint; expires bigint; org_status text; mutation boolean;
BEGIN
 native_id:=auth.uid(); claims:=auth.jwt();
 IF native_id IS NULL OR jsonb_typeof(claims->'iat') IS DISTINCT FROM 'number'
   OR jsonb_typeof(claims->'exp') IS DISTINCT FROM 'number' OR coalesce(claims->>'iat','') !~ '^[0-9]{1,10}$'
   OR coalesce(claims->>'exp','') !~ '^[0-9]{1,10}$'
   OR coalesce(claims->>'session_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN RETURN false; END IF;
 issued:=(claims->>'iat')::bigint; expires:=(claims->>'exp')::bigint;
 native_session:=(claims->>'session_id')::uuid;
 IF issued<=0 OR issued>extract(epoch FROM now()) OR expires<=issued OR expires<=extract(epoch FROM now())
   OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=native_session AND user_id=native_id AND (not_after IS NULL OR not_after>now()))
 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM public.user_account WHERE auth_user_id=native_id)<>1 THEN RETURN false; END IF;
 SELECT * INTO a FROM public.user_account WHERE auth_user_id=native_id;
 IF a.status_akun IS DISTINCT FROM 'active' OR a.lockout_until>now()
   OR (a.tokens_valid_after IS NOT NULL AND to_timestamp(issued)<a.tokens_valid_after)
 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM public.organization_membership WHERE identity_id=a.identity_id AND organization_id='ptv_studio' AND is_current)<>1
 THEN RETURN false; END IF;
 SELECT status_organisasi INTO org_status FROM public.organization_membership
 WHERE identity_id=a.identity_id AND organization_id='ptv_studio' AND is_current;
 SELECT is_mutation INTO mutation FROM public.capability_registry WHERE key=p_capability;
 IF NOT FOUND OR org_status IS NULL OR org_status NOT IN ('active','inactive') OR (org_status='inactive' AND mutation)
 THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.account_capability_overrides WHERE account_id=a.id AND capability_key=p_capability AND override_type='deny')
 THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.account_capability_overrides WHERE account_id=a.id AND capability_key=p_capability AND override_type='allow')
   OR EXISTS(SELECT 1 FROM public.account_profiles ap JOIN public.profile_capabilities pc ON pc.profile_id=ap.profile_id
     WHERE ap.account_id=a.id AND pc.capability_key=p_capability);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.has_capability(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.has_capability(text) TO authenticated,service_role;
-- Do not grant auth.sessions SELECT to API roles. The reviewed function owner must already be able to read it.
COMMIT;
