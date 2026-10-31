-- STAGING swadgljnyelsjstqqxbm ONLY. DRAFT, NOT EXECUTED.
-- INCOMPLETE: shared native report dependency and positive capability-denial gate remain unresolved.
-- Never remove this barrier without fresh dependency/rollback evidence and explicit cutover review.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'NO_GO_166: valuation42P10, restricted-account proof, shared-report dependency and activation unresolved'; END $$;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_inventaris FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_inventaris_unit FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ptv_nilai_inventaris FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_checkout_loan(text, text, text, date, date, text, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_create_inventaris(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_get_next_inv_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_return_loan(text, date, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_return_single_unit(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_update_inventaris(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
CREATE POLICY inventory_portal_166_select ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (bucket_id <> 'inventory');
CREATE POLICY inventory_portal_166_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'inventory');
CREATE POLICY inventory_portal_166_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id <> 'inventory') WITH CHECK (bucket_id <> 'inventory');
CREATE POLICY inventory_portal_166_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id <> 'inventory');
-- service_role and published public media URLs are intentionally retained.
COMMIT;

