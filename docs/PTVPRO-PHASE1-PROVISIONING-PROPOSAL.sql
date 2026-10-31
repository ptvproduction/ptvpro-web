-- LOCAL PROPOSAL ONLY. Direct administrative execution after a separate, scoped ACC.
-- No RPC/DDL, native Auth user, credential, archive update, Root or gate activation.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $provision$
DECLARE
 m jsonb := '__APPROVED_PRIVATE_MANIFEST_JSON__'::jsonb;
 item jsonb; archive public.legacy_archive_kru%rowtype;
 source_id uuid; account_id uuid; member_id uuid; operation uuid;
 receipt jsonb; manifest_hash text; current_state text; before_state text;
 target_ids uuid[] := ARRAY[]::uuid[];
 count_targets integer := 0;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
 OR (SELECT system_identifier::text FROM pg_control_system())<>'__APPROVED_DATABASE_SYSTEM_IDENTIFIER__'
 THEN RAISE EXCEPTION 'approved direct administrative connection required' USING ERRCODE='42501'; END IF;
 IF m->>'project_ref' IS DISTINCT FROM 'swadgljnyelsjstqqxbm'
 OR m->>'approval_scope' IS DISTINCT FROM 'PROVISION_TWO_INACTIVE_CREW_ACCOUNTS'
 OR length(trim(coalesce(m->>'approval_reference','')))<8
 OR (m->>'expires_at')::timestamptz<=clock_timestamp()
 OR (m->>'expires_at')::timestamptz>clock_timestamp()+interval '24 hours'
 OR m->>'expires_at' IS NULL OR jsonb_typeof(m->'targets') IS DISTINCT FROM 'array'
 OR jsonb_array_length(m->'targets')<>2
 THEN RAISE EXCEPTION 'reviewed unexpired two-target approval required'; END IF;
 operation:=(m->>'operation_id')::uuid;
 IF operation IS NULL THEN RAISE EXCEPTION 'operation UUID required'; END IF;
 manifest_hash:=encode(sha256(convert_to(m::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(149,1);
 -- Table locks also exclude privileged writers that do not use the advisory lock.
 LOCK TABLE public.legacy_archive_kru,public.canonical_identity,public.organization_membership,
 public.user_account,public.account_profiles,public.account_capability_overrides IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.account_profiles WHERE profile_id='root_executive')
 OR NOT EXISTS(SELECT 1 FROM ptv_auth_private.policy WHERE singleton AND NOT enabled)
 THEN RAISE EXCEPTION 'prebootstrap default-off checkpoint required'; END IF;
 IF (SELECT count(DISTINCT t->>'ptv_id') FROM jsonb_array_elements(m->'targets')t WHERE t->>'ptv_id' IN ('PTV-001','PTV-002'))<>2
 OR (SELECT count(DISTINCT lower(t->>'username')) FROM jsonb_array_elements(m->'targets')t)<>2
 OR (SELECT count(DISTINCT t->>'source_uuid') FROM jsonb_array_elements(m->'targets')t)<>2
 OR (SELECT count(DISTINCT t->>'account_uuid') FROM jsonb_array_elements(m->'targets')t)<>2
 OR (SELECT count(DISTINCT t->>'membership_uuid') FROM jsonb_array_elements(m->'targets')t)<>2
 THEN RAISE EXCEPTION 'distinct approved targets required'; END IF;
 IF (SELECT count(*) FROM public.auth_audit_log WHERE event_type='initial_accounts_provisioned' AND metadata->>'operation_id'=operation::text)>1
 THEN RAISE EXCEPTION 'ambiguous receipt'; END IF;
 SELECT metadata INTO receipt FROM public.auth_audit_log
 WHERE event_type='initial_accounts_provisioned' AND metadata->>'operation_id'=operation::text;
 IF receipt IS NOT NULL AND receipt->>'manifest_sha256' IS DISTINCT FROM manifest_hash
 THEN RAISE EXCEPTION 'operation replay differs'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(m->'targets') LOOP
  source_id:=(item->>'source_uuid')::uuid;
  account_id:=(item->>'account_uuid')::uuid;
  member_id:=(item->>'membership_uuid')::uuid;
  IF source_id IS NULL OR account_id IS NULL OR member_id IS NULL
  OR source_id=account_id OR member_id=source_id OR member_id=account_id
  OR item->>'username' IS NULL OR item->>'username' !~ '^[a-z][a-z0-9._-]{2,47}$'
  OR item->>'username' ~ '^ptv[-_]'
  OR item->>'category' IS NULL OR item->>'category' NOT IN ('Kru','Pembina','Pengarah')
  OR item->>'membership_status' IS NULL OR item->>'membership_status' NOT IN ('active','inactive','archived')
  OR item->>'initial_profile' IS DISTINCT FROM 'crew'
  OR item->>'archive_sha256' IS NULL OR item->>'archive_sha256' !~ '^[0-9a-f]{64}$'
  OR item->>'membership_period_start' IS NULL
  OR item->>'membership_period_start' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  THEN RAISE EXCEPTION 'invalid explicit target fields'; END IF;
  SELECT * INTO archive FROM public.legacy_archive_kru WHERE archive_id=(item->>'archive_uuid')::uuid FOR UPDATE;
  IF NOT FOUND OR lower(trim(archive.production_id)) IS DISTINCT FROM source_id::text
  OR archive.source_key IS DISTINCT FROM 'ptv_kru:'||source_id::text
  OR archive.ptv_id IS DISTINCT FROM item->>'ptv_id'
  OR archive.status IN ('quarantine','test_quarantine') OR archive.metadata_json->>'created_by_test'='true'
  OR archive.canonical_identity_id IS NOT NULL
  OR coalesce(length(trim(archive.full_name)),0)<2
  OR coalesce(length(trim(archive.jabatan)),0)<1
  OR encode(sha256(convert_to(to_jsonb(archive)::text,'UTF8')),'hex') IS DISTINCT FROM item->>'archive_sha256'
  OR (SELECT count(*) FROM public.legacy_archive_kru WHERE lower(trim(production_id))=source_id::text)<>1
  OR (SELECT count(*) FROM public.legacy_archive_kru WHERE upper(trim(ptv_id))=item->>'ptv_id')<>1
  THEN RAISE EXCEPTION 'archive missing, stale, linked, duplicate or conflicting'; END IF;
  IF item->>'category'='Kru' THEN
   IF item->>'division_id' IS NULL OR item->>'division_id' NOT IN ('editor','layouter','technical','engagements')
   OR NOT EXISTS(SELECT 1 FROM public.organization_division WHERE id=item->>'division_id')
   OR coalesce(item->>'cohort','') !~ '^[1-9][0-9]{0,8}$'
   THEN RAISE EXCEPTION 'explicit valid division and cohort required'; END IF;
  ELSIF item->>'division_id' IS NOT NULL OR item->>'cohort' IS NOT NULL THEN
   RAISE EXCEPTION 'nonoperational personnel must not acquire division/cohort';
  END IF;
  target_ids:=array_append(target_ids,source_id);
  IF receipt IS NULL THEN
   IF EXISTS(SELECT 1 FROM public.canonical_identity WHERE id=source_id OR ptv_id=item->>'ptv_id'
      OR metadata->>'legacy_uuid'=source_id::text)
   OR EXISTS(SELECT 1 FROM public.user_account WHERE id=account_id OR identity_id=source_id OR lower(username)=lower(item->>'username'))
   OR EXISTS(SELECT 1 FROM public.organization_membership WHERE id=member_id OR identity_id=source_id)
   THEN RAISE EXCEPTION 'target already exists without exact receipt; manual reconciliation required'; END IF;
   INSERT INTO public.canonical_identity(id,ptv_id,full_name,metadata)
   VALUES(source_id,item->>'ptv_id',archive.full_name,jsonb_build_object('category',item->>'category',
    'legacy_source_project','jthzuhkblxcaohiuypqq','legacy_source_table','ptv_kru','legacy_uuid',source_id,
    'provision_operation',operation,'provision_manifest_sha256',manifest_hash));
   INSERT INTO public.organization_membership(id,identity_id,organization_id,division_id,position_title,cohort,status_organisasi,period_start,is_current)
   VALUES(member_id,source_id,'ptv_studio',item->>'division_id',archive.jabatan,(item->>'cohort')::integer,item->>'membership_status',(item->>'membership_period_start')::date,true);
   INSERT INTO public.user_account(id,identity_id,auth_user_id,username,status_akun,tokens_valid_after)
   VALUES(account_id,source_id,NULL,item->>'username','inactive',clock_timestamp());
   INSERT INTO public.account_profiles(account_id,profile_id) VALUES(account_id,'crew');
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.canonical_identity WHERE id=source_id AND ptv_id=item->>'ptv_id'
      AND metadata->>'provision_manifest_sha256'=manifest_hash)
   OR NOT EXISTS(SELECT 1 FROM public.user_account WHERE id=account_id AND identity_id=source_id
      AND username=item->>'username' AND status_akun='inactive' AND auth_user_id IS NULL)
   OR NOT EXISTS(SELECT 1 FROM public.organization_membership WHERE id=member_id AND identity_id=source_id)
   THEN RAISE EXCEPTION 'replay target drift'; END IF;
  END IF;
  count_targets:=count_targets+1;
 END LOOP;
 SELECT encode(sha256(convert_to(jsonb_build_object(
  'identities',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.canonical_identity i WHERE id=ANY(target_ids)),
  'memberships',(SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM public.organization_membership v WHERE identity_id=ANY(target_ids)),
  'accounts',(SELECT jsonb_agg(to_jsonb(u) ORDER BY u.id) FROM public.user_account u WHERE identity_id=ANY(target_ids)),
  'profiles',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.account_id,p.profile_id) FROM public.account_profiles p JOIN public.user_account u ON u.id=p.account_id WHERE u.identity_id=ANY(target_ids)),
  'overrides',(SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM public.account_capability_overrides o JOIN public.user_account u ON u.id=o.account_id WHERE u.identity_id=ANY(target_ids))
 )::text,'UTF8')),'hex') INTO current_state;
 IF receipt IS NOT NULL THEN
  before_state:=receipt->>'target_state_sha256';
  IF before_state IS DISTINCT FROM current_state THEN RAISE EXCEPTION 'replay state changed'; END IF;
 ELSE
  INSERT INTO public.auth_audit_log(actor_id,event_type,metadata) VALUES(NULL,'initial_accounts_provisioned',
   jsonb_build_object('operation_id',operation,'manifest_sha256',manifest_hash,'target_state_sha256',current_state,
    'target_count',count_targets,'approval_reference',m->>'approval_reference','database_principal',session_user,
    'initial_status','inactive','initial_profile','crew','archive_unchanged',true));
 END IF;
END $provision$;
COMMIT;
