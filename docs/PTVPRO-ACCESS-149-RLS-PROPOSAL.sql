-- PROPOSAL ONLY. ACC operator wajib. Staging swadgljnyelsjstqqxbm saja.
-- Bind identity/status to database on EVERY call, including tokens containing account_id.
BEGIN;
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
