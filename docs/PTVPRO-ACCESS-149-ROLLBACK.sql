-- PROPOSAL ONLY. ACC operator diperlukan. Rollback objek baru saja; bukan rollback data akses.
-- Jangan menghapus auth_audit_log atau histori personel. Snapshot sebelum penerapan wajib disimpan terpisah.
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_manage_account_access(uuid,bigint,jsonb);
DROP FUNCTION IF EXISTS public.rpc_update_crew_personnel(uuid,bigint,uuid,jsonb);
DROP FUNCTION IF EXISTS ptv_access_private.manage_account_access(uuid,bigint,jsonb);
DROP FUNCTION IF EXISTS ptv_access_private.update_crew_personnel(uuid,bigint,uuid,jsonb);
DROP FUNCTION IF EXISTS ptv_access_private.assert_recovery();
DROP FUNCTION IF EXISTS ptv_access_private.usable_google_login(uuid,bigint);
DROP FUNCTION IF EXISTS ptv_access_private.authorize(uuid,bigint,text);
DROP FUNCTION IF EXISTS ptv_access_private.can_account(uuid,text);
-- Retain guard-only triggers/functions in the private schema. Never remove immutable bootstrap markers or restore unsafe grants.
-- No CASCADE and no historical/account/audit data deletion.
COMMIT;
