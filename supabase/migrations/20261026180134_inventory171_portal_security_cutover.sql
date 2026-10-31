-- PTV-DEV-171, Supabase Staging only. Gate verified by actual hosted negative receipt.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
DO $gate171$
BEGIN
 IF current_setting('ptv.inventory171.cutover_approved',true) IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN RAISE EXCEPTION 'CUTOVER171_APPROVAL_REQUIRED'; END IF;
 IF md5((SELECT system_identifier::text FROM pg_control_system())) <> '72737c1de8ff53d24950c9d2b30bd42d' THEN RAISE EXCEPTION 'STAGING_ONLY_171'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='ptv_report_private.write_report(text,text,uuid,jsonb,uuid,bigint)'::regprocedure) IS DISTINCT FROM '7f66a228d7369f1572a442aa5d4ef7a1' THEN RAISE EXCEPTION 'REPORT_GUARD_DRIFT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.auth_audit_log WHERE event_type='inventory_test171_negative_verified' AND metadata->>'run_id'='e3815819-eab2-46ab-9cc7-42bf27296a50' AND metadata->>'receipt_sha256'='1cce7af9595aaaafbdc74cb15d033a69a025b9a1f9532157dedf0110426bd424') THEN RAISE EXCEPTION 'NEGATIVE_PROOF_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_account a JOIN public.canonical_identity i ON i.id=a.identity_id WHERE a.username='stg-inventory-neg-171' AND i.metadata->>'run_id'='e3815819-eab2-46ab-9cc7-42bf27296a50' AND a.status_akun='inactive' AND NOT EXISTS(SELECT 1 FROM ptv_auth_private.sessions WHERE account_id=a.id AND revoked_at IS NULL AND expires_at>clock_timestamp()) AND NOT EXISTS(SELECT 1 FROM public.auth_credentials WHERE account_id=a.id AND password_hash IS NOT NULL)) THEN RAISE EXCEPTION 'TESTER_NOT_RETIRED'; END IF;
 IF (SELECT digest FROM (with t as (select c.oid,c.relname from pg_class c where c.oid in ('public.ptv_inventaris'::regclass,'public.ptv_inventaris_unit'::regclass,'public.ptv_nilai_inventaris'::regclass,'public.ptv_peminjaman'::regclass,'public.ptv_lapor_masalah'::regclass)), f as (select p.oid,p.oid::regprocedure::text as signature from pg_proc p where p.oid in ('public.rpc_checkout_loan(text,text,text,date,date,text,uuid[],uuid)'::regprocedure,'public.rpc_create_inventaris(jsonb,jsonb)'::regprocedure,'public.rpc_get_next_inv_code()'::regprocedure,'public.rpc_return_loan(text,date,text,text,uuid)'::regprocedure,'public.rpc_return_single_unit(uuid,uuid,text,uuid)'::regprocedure,'public.rpc_update_inventaris(jsonb,jsonb)'::regprocedure)), grants as (select 'table' kind,t.relname as object,coalesce(r.rolname,'PUBLIC') grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type privilege,a.is_grantable grantable from t join pg_class c using(oid) cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a left join pg_roles r on r.oid=a.grantee union all select 'function',f.signature,coalesce(r.rolname,'PUBLIC'),pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable from f join pg_proc p using(oid) cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee), state as (select jsonb_build_object('grants',(select jsonb_agg(to_jsonb(g) order by kind,object,grantee,grantor,privilege) from grants g),'policies',(select jsonb_agg(to_jsonb(x) order by policyname) from (select policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='storage' and tablename='objects' and (qual like '%inventory%' or with_check like '%inventory%')) x)) as value) select value,md5(value::text) as digest from state) snapshot) IS DISTINCT FROM 'f31d82f815f34f85778e692fc8b173f7' THEN RAISE EXCEPTION 'ACL_POLICY_DRIFT'; END IF;
END $gate171$;
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
DROP POLICY inventory_authenticated_upload ON storage.objects;
DROP POLICY inventory_manager_delete ON storage.objects;
DROP POLICY inventory_owner_cleanup ON storage.objects;
DROP POLICY inventory_public_view ON storage.objects;
CREATE POLICY inventory_portal_171_select ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (bucket_id <> 'inventory') ;
CREATE POLICY inventory_portal_171_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated  WITH CHECK (bucket_id <> 'inventory');
CREATE POLICY inventory_portal_171_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING (bucket_id <> 'inventory') WITH CHECK (bucket_id <> 'inventory');
CREATE POLICY inventory_portal_171_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING (bucket_id <> 'inventory') ;
-- Close the one-run administration path once the tester is retired.
REVOKE EXECUTE ON FUNCTION public.rpc_inventory_test171(jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION ptv_inventory_test_private.manage(jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(NULL,'inventory_security_cutover171',jsonb_build_object('run_id','e3815819-eab2-46ab-9cc7-42bf27296a50','negative_receipt','1cce7af9595aaaafbdc74cb15d033a69a025b9a1f9532157dedf0110426bd424','scope','five tables/six native RPC/inventory-only restrictive policies'));
COMMIT;
