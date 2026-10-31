-- ACC REQUIRED; maintenance containment, not restoration of the vulnerable Access149 helper.
BEGIN;
DO $$ BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres'
   OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
   OR '__APPROVED_DATABASE_SYSTEM_IDENTIFIER__' IS DISTINCT FROM (SELECT system_identifier::text FROM pg_control_system())
 THEN RAISE EXCEPTION 'reviewed direct administrative connection and cluster approval required' USING ERRCODE='42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.has_capability(p_capability text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT false $$;
REVOKE ALL ON FUNCTION public.has_capability(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.has_capability(text) TO authenticated,service_role;
-- Data, credentials, sessions, profile assignments, audit markers and Access149 guards stay intact.
-- Keep maintenance active; forward-reapply the reviewed hardened helper after repair and validation.
COMMIT;
