-- STAGING swadgljnyelsjstqqxbm ONLY. Exact pre-cutover ACL restoration from ACL-SNAPSHOT.json.
-- NOT EXECUTED. This reopens the captured legacy access; use only for a matching future166 cutover.
BEGIN;
DO $$ BEGIN IF current_setting('ptv.inventory166.rollback_approved', true) IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN RAISE EXCEPTION 'Explicit matching Staging rollback approval required'; END IF; END $$;
DROP POLICY IF EXISTS inventory_portal_166_select ON storage.objects;
DROP POLICY IF EXISTS inventory_portal_166_insert ON storage.objects;
DROP POLICY IF EXISTS inventory_portal_166_update ON storage.objects;
DROP POLICY IF EXISTS inventory_portal_166_delete ON storage.objects;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris_unit TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_inventaris_unit TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_nilai_inventaris TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ptv_nilai_inventaris TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_checkout_loan(text, text, text, date, date, text, uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_inventaris(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_return_loan(text, date, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_return_single_unit(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_inventaris(jsonb, jsonb) TO authenticated;
COMMIT;

