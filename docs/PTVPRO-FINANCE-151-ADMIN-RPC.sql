-- Review source; included inside the guarded Finance151 transaction.
ALTER TABLE public.ptv_finance_categories ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.ptv_finance_transactions ADD COLUMN IF NOT EXISTS notes text, ADD COLUMN IF NOT EXISTS proof_url text;
CREATE OR REPLACE FUNCTION ptv_finance_private.admin_mutation(p_account_id uuid,p_session_iat bigint,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; entity uuid; before_row jsonb; after_row jsonb; fields jsonb;
 tab text; audit_action text; result_key text; k text; label text;
BEGIN
 actor:=ptv_finance_private.authorize(p_account_id,p_session_iat,'finance.manage');
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 IF p_action IN('create_pocket','update_pocket','archive_pocket') THEN
  tab:='ptv_finance_pockets';result_key:='pocket';
  IF p_action<>'create_pocket' THEN
   entity:=(p_payload->>'pocketId')::uuid;
   SELECT to_jsonb(p) INTO STRICT before_row FROM public.ptv_finance_pockets p WHERE id=entity FOR UPDATE;
   IF (before_row->>'archived')::boolean THEN RAISE EXCEPTION 'Kantong sudah diarsipkan.'; END IF;
   IF jsonb_typeof(p_payload->'expectedVersion') IS DISTINCT FROM 'number' OR (p_payload->>'expectedVersion')::numeric IS DISTINCT FROM (before_row->>'version')::numeric THEN RAISE EXCEPTION 'Versi kantong berubah. Muat ulang.' USING ERRCODE='40001'; END IF;
  END IF;
  IF p_action='archive_pocket' THEN
   IF (before_row->>'balance_minor')::bigint<>0 THEN RAISE EXCEPTION 'Arsip memerlukan saldo nol.'; END IF;
   UPDATE public.ptv_finance_pockets SET archived=true,version=version+1,updated_at=now() WHERE id=entity RETURNING to_jsonb(ptv_finance_pockets) INTO after_row;
   audit_action:='archive';
  ELSE
   fields:=p_payload->'pocket';
   IF jsonb_typeof(fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid pocket'; END IF;
   FOR k IN SELECT jsonb_object_keys(fields) LOOP
    IF k NOT IN('name','kind','provider','accountNumber','accountHolder') OR jsonb_typeof(fields->k)<>'string' THEN RAISE EXCEPTION 'invalid pocket field'; END IF;
   END LOOP;
   label:=trim(fields->>'name');
   IF coalesce(length(label),0) NOT BETWEEN 1 AND 80 OR coalesce(fields->>'kind','') NOT IN('cash','bank','ewallet')
    OR fields->>'provider' IS NULL OR fields->>'accountNumber' IS NULL OR fields->>'accountHolder' IS NULL
    OR length(fields->>'provider')>80 OR length(fields->>'accountNumber')>64 OR length(fields->>'accountHolder')>120 THEN RAISE EXCEPTION 'invalid pocket fields'; END IF;
   IF (fields->>'kind'='cash' AND concat(fields->>'provider',fields->>'accountNumber',fields->>'accountHolder')<>'')
    OR (fields->>'kind'<>'cash' AND (trim(fields->>'provider')='' OR trim(fields->>'accountNumber')='' OR trim(fields->>'accountHolder')='')) THEN RAISE EXCEPTION 'invalid account information'; END IF;
   IF p_action='create_pocket' THEN
    INSERT INTO public.ptv_finance_pockets(name,kind,provider,account_number,account_holder,balance_minor,version,archived)
    VALUES(label,fields->>'kind',nullif(trim(fields->>'provider'),''),nullif(trim(fields->>'accountNumber'),''),nullif(trim(fields->>'accountHolder'),''),0,1,false)
    RETURNING id,to_jsonb(ptv_finance_pockets) INTO entity,after_row;
    audit_action:='create';
   ELSE
    UPDATE public.ptv_finance_pockets SET name=label,kind=fields->>'kind',provider=nullif(trim(fields->>'provider'),''),account_number=nullif(trim(fields->>'accountNumber'),''),account_holder=nullif(trim(fields->>'accountHolder'),''),version=version+1,updated_at=now()
    WHERE id=entity RETURNING to_jsonb(ptv_finance_pockets) INTO after_row;
    audit_action:='update';
   END IF;
  END IF;
 ELSIF p_action IN('create_category','update_category','archive_category','restore_category') THEN
  tab:='ptv_finance_categories';result_key:='category';
  IF p_action<>'create_category' THEN
   entity:=(p_payload->>'id')::uuid;
   SELECT to_jsonb(c) INTO STRICT before_row FROM public.ptv_finance_categories c WHERE id=entity FOR UPDATE;
   IF lower(trim(before_row->>'name')) IN('iuran kas kru','pencairan piutang','pengembalian pokok piutang','pendapatan bunga piutang') THEN RAISE EXCEPTION 'Kategori sistem dilindungi.'; END IF;
  END IF;
  IF p_action IN('create_category','update_category') THEN
   label:=trim(p_payload->>'name');
   IF jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR coalesce(length(label),0) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'invalid category name'; END IF;
   IF p_action='create_category' THEN
    IF coalesce(p_payload->>'kind','') NOT IN('income','expense') THEN RAISE EXCEPTION 'invalid category kind'; END IF;
    INSERT INTO public.ptv_finance_categories(name,kind,is_active) VALUES(label,p_payload->>'kind',true) RETURNING id,to_jsonb(ptv_finance_categories) INTO entity,after_row;
    audit_action:='create';
   ELSE
    UPDATE public.ptv_finance_categories SET name=label WHERE id=entity RETURNING to_jsonb(ptv_finance_categories) INTO after_row;
    audit_action:='update';
   END IF;
  ELSE
   UPDATE public.ptv_finance_categories SET is_active=(p_action='restore_category'),is_archived=(p_action='archive_category') WHERE id=entity RETURNING to_jsonb(ptv_finance_categories) INTO after_row;
   audit_action:=CASE WHEN p_action='archive_category' THEN 'archive' ELSE 'update' END;
  END IF;
 ELSIF p_action='update_transaction' THEN
  tab:='ptv_finance_transactions';result_key:='transaction';audit_action:='update';entity:=(p_payload->>'txId')::uuid;
  fields:=p_payload->'updates';
  IF jsonb_typeof(fields) IS DISTINCT FROM 'object' OR fields='{}'::jsonb THEN RAISE EXCEPTION 'invalid metadata'; END IF;
  FOR k IN SELECT jsonb_object_keys(fields) LOOP
   IF k NOT IN('description','occurredOn','categoryId','notes','proofUrl') OR jsonb_typeof(fields->k)<>'string' THEN RAISE EXCEPTION 'Only transaction metadata may be edited.'; END IF;
  END LOOP;
  SELECT to_jsonb(t) INTO STRICT before_row FROM public.ptv_finance_transactions t WHERE id=entity FOR UPDATE;
  IF before_row->>'status'<>'posted' THEN RAISE EXCEPTION 'Transaksi dibatalkan tidak dapat diedit.'; END IF;
  IF fields ? 'description' AND length(trim(fields->>'description')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid description'; END IF;
  IF fields ? 'occurredOn' AND (fields->>'occurredOn' !~ '^\d{4}-\d{2}-\d{2}$') THEN RAISE EXCEPTION 'invalid date'; END IF;
  IF fields ? 'categoryId' AND NOT EXISTS(SELECT 1 FROM public.ptv_finance_categories WHERE id=(fields->>'categoryId')::uuid AND is_active AND kind=before_row->>'kind') THEN RAISE EXCEPTION 'invalid category'; END IF;
  UPDATE public.ptv_finance_transactions SET
   description=CASE WHEN fields ? 'description' THEN trim(fields->>'description') ELSE description END,
   occurred_on=CASE WHEN fields ? 'occurredOn' THEN (fields->>'occurredOn')::date ELSE occurred_on END,
   category_id=CASE WHEN fields ? 'categoryId' THEN (fields->>'categoryId')::uuid ELSE category_id END,
   notes=CASE WHEN fields ? 'notes' THEN trim(fields->>'notes') ELSE notes END,
   proof_url=CASE WHEN fields ? 'proofUrl' THEN trim(fields->>'proofUrl') ELSE proof_url END
  WHERE id=entity RETURNING to_jsonb(ptv_finance_transactions) INTO after_row;
 ELSE RAISE EXCEPTION 'unsupported finance action' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.ptv_finance_audit_log(entity_type,entity_id,action,actor_id,payload)
 VALUES(result_key,entity,audit_action,actor,jsonb_build_object('before',before_row,'after',after_row));
 RETURN jsonb_build_object('success',true,result_key,after_row);
END $$;
CREATE OR REPLACE FUNCTION public.rpc_finance_admin_mutation_server(p_account_id uuid,p_session_iat bigint,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT ptv_finance_private.admin_mutation(p_account_id,p_session_iat,p_action,p_payload)
$$;
REVOKE ALL ON FUNCTION ptv_finance_private.admin_mutation(uuid,bigint,text,jsonb),public.rpc_finance_admin_mutation_server(uuid,bigint,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION ptv_finance_private.admin_mutation(uuid,bigint,text,jsonb),public.rpc_finance_admin_mutation_server(uuid,bigint,text,jsonb) TO service_role;
