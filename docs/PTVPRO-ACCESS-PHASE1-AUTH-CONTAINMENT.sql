-- Reviewed containment only; do not drop sessions, audit, credentials or restore an older permission helper.
-- Keep PTV_AUTH_LIFECYCLE_ENABLED enabled after activation so revocation remains enforced.
-- Turn PTV_PASSWORD_LOGIN_ENABLED off separately; Google and existing valid sessions remain available.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
 OR (SELECT system_identifier::text FROM pg_control_system())<>'__APPROVED_DATABASE_SYSTEM_IDENTIFIER__'
 THEN RAISE EXCEPTION 'approved direct administrative connection required' USING ERRCODE='42501'; END IF;
END $$;
UPDATE ptv_auth_private.policy SET enabled=false WHERE singleton;
COMMIT;
