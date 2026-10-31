-- Exact client grants restored from PTVPRO-INVENTORY-171-ACL-SNAPSHOT.json. Reopens native surface.
BEGIN;
DO $undo171$ BEGIN
 IF current_setting('ptv.inventory171.rollback_approved',true) IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN RAISE EXCEPTION 'ROLLBACK171_APPROVAL_REQUIRED'; END IF;
 IF md5((SELECT system_identifier::text FROM pg_control_system())) <> '72737c1de8ff53d24950c9d2b30bd42d' THEN RAISE EXCEPTION 'STAGING_ONLY_171'; END IF;
END $undo171$;
DROP POLICY IF EXISTS inventory_portal_171_select ON storage.objects;
DROP POLICY IF EXISTS inventory_portal_171_insert ON storage.objects;
DROP POLICY IF EXISTS inventory_portal_171_update ON storage.objects;
DROP POLICY IF EXISTS inventory_portal_171_delete ON storage.objects;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_inventaris FROM PUBLIC,anon,authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_inventaris_unit FROM PUBLIC,anon,authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_lapor_masalah FROM PUBLIC,anon,authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_nilai_inventaris FROM PUBLIC,anon,authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_peminjaman FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_checkout_loan(text,text,text,date,date,text,uuid[],uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_create_inventaris(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_get_next_inv_code() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_return_loan(text,date,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_return_single_unit(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_update_inventaris(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_checkout_loan(text,text,text,date,date,text,uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_inventaris(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_return_loan(text,date,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_return_single_unit(uuid,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_inventaris(jsonb,jsonb) TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris_unit TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris_unit TO authenticated;
GRANT MAINTAIN, SELECT ON TABLE public.ptv_lapor_masalah TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_nilai_inventaris TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_nilai_inventaris TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_peminjaman TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_peminjaman TO authenticated;
DROP POLICY IF EXISTS inventory_authenticated_upload ON storage.objects;
CREATE POLICY inventory_authenticated_upload ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (((bucket_id = 'inventory'::text) AND ((has_capability('inventory.create'::text) IS TRUE) OR (has_capability('inventory.edit'::text) IS TRUE))));
DROP POLICY IF EXISTS inventory_manager_delete ON storage.objects;
CREATE POLICY inventory_manager_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'inventory'::text) AND ((has_capability('inventory.delete'::text) IS TRUE) OR (has_capability('inventory.manage'::text) IS TRUE)))) ;
DROP POLICY IF EXISTS inventory_owner_cleanup ON storage.objects;
CREATE POLICY inventory_owner_cleanup ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'inventory'::text) AND (owner = auth.uid()) AND (has_capability('inventory.create'::text) IS TRUE) AND (NOT (EXISTS ( SELECT 1
   FROM ptv_inventaris pi
  WHERE ((pi.foto_url IS NOT NULL) AND (pi.foto_url ~~ ('%'::text || objects.name)))))))) ;
DROP POLICY IF EXISTS inventory_public_view ON storage.objects;
CREATE POLICY inventory_public_view ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'inventory'::text)) ;
-- Do not reopen temporary tester administration or remove Guard168/index167.
COMMIT;
