-- PROPOSAL ONLY. Never executed. Remove new objects only; existing data/audit is retained.
-- If any links have been written, restore reviewed per-row data first using the recovery runbook.
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_link_legacy_personnel(uuid,bigint,uuid,uuid,uuid,timestamptz,timestamptz,text,text);
DROP FUNCTION IF EXISTS ptv_access_private.link_legacy_personnel(uuid,bigint,uuid,uuid,uuid,timestamptz,timestamptz,text,text);
-- Drop only when the execution manifest proves this index was newly created by this proposal.
DROP INDEX IF EXISTS public.canonical_identity_legacy_provenance_149_uidx;
-- Do NOT restore vulnerable has_capability or change account/profile/credential data.
COMMIT;
