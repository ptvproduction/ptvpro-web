-- Separate phase for existing owner or managed postgres policy delegation; no ownership/grant changes.
BEGIN;
DO $$ BEGIN IF current_user<>'postgres' AND current_user IS DISTINCT FROM (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='storage.objects'::regclass) THEN RAISE EXCEPTION 'existing Storage owner or managed postgres required' USING ERRCODE='42501'; END IF; END $$;
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'DROP POLICY IF EXISTS finance151_proof_guard ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS finance151_anon_proof_guard ON storage.objects';
  EXECUTE 'CREATE POLICY finance151_proof_guard ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(bucket_id<>''finance-proofs'' OR public.finance_can_native(''finance.manage'')) WITH CHECK(bucket_id<>''finance-proofs'' OR public.finance_can_native(''finance.manage''))';
  EXECUTE 'CREATE POLICY finance151_anon_proof_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>''finance-proofs'') WITH CHECK(bucket_id<>''finance-proofs'')';
 END IF;
END $$;
COMMIT;
