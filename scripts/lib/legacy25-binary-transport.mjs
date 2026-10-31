import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {from as copyFrom} from 'pg-copy-streams';

export const textSha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const fail=code=>{throw new Error(code);};
export const triggerDigestSql=`SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(c.relname,t.tgname,t.tgenabled,n.nspname,p.proname,md5(pg_get_functiondef(p.oid))) ORDER BY c.relname,t.tgname),'[]')::text,'UTF8')),'hex') AS digest FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE NOT t.tgisinternal AND t.tgrelid=ANY(ARRAY['public.canonical_identity'::regclass,'public.organization_membership'::regclass,'public.user_account'::regclass,'public.account_profiles'::regclass,'public.auth_audit_log'::regclass])`;
export const surfaceDigestSql=`WITH targets AS (SELECT oid FROM pg_class WHERE oid=ANY(ARRAY['public.canonical_identity'::regclass,'public.organization_membership'::regclass,'public.user_account'::regclass,'public.account_profiles'::regclass,'public.auth_audit_log'::regclass])) SELECT encode(sha256(convert_to(jsonb_build_object('constraints',(SELECT jsonb_agg(jsonb_build_array(c.conrelid::regclass::text,c.conname,pg_get_constraintdef(c.oid)) ORDER BY c.conrelid,c.conname) FROM pg_constraint c WHERE c.conrelid IN(SELECT oid FROM targets)),'rules',(SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.oid) FROM pg_rewrite r WHERE r.ev_class IN(SELECT oid FROM targets)),'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,md5(pg_get_functiondef(p.oid))) ORDER BY p.oid) FROM pg_proc p WHERE p.oid IN(SELECT d.refobjid FROM pg_depend d WHERE d.refclassid='pg_proc'::regclass AND ((d.classid='pg_constraint'::regclass AND d.objid IN(SELECT oid FROM pg_constraint WHERE conrelid IN(SELECT oid FROM targets))) OR (d.classid='pg_attrdef'::regclass AND d.objid IN(SELECT oid FROM pg_attrdef WHERE adrelid IN(SELECT oid FROM targets)))))),'defaults',(SELECT jsonb_agg(jsonb_build_array(a.adrelid::regclass::text,a.adnum,pg_get_expr(a.adbin,a.adrelid)) ORDER BY a.adrelid,a.adnum) FROM pg_attrdef a WHERE a.adrelid IN(SELECT oid FROM targets)))::text,'UTF8')),'hex') AS digest`;
export const transportContextSql=`SELECT current_setting('auto_explain.log_min_duration',true) AS plan_duration,current_setting('auto_explain.log_nested_statements',true) AS plan_nested,current_setting('auto_explain.log_parameter_max_length',true) AS plan_parameters,coalesce(current_setting('pgaudit.log',true),'none') AS audit_classes,coalesce(current_setting('pgaudit.log_parameter',true),'off') AS audit_parameters,current_setting('debug_print_parse') AS debug_parse,current_setting('debug_print_plan') AS debug_plan,current_setting('debug_print_rewritten') AS debug_rewritten`;
export const transportContextSafe=s=>(s.plan_duration===null||s.plan_duration==='-1'||(s.plan_nested==='off'&&s.plan_parameters==='0'))&&(s.audit_classes==='none'||s.audit_parameters==='off')&&s.debug_parse==='off'&&s.debug_plan==='off'&&s.debug_rewritten==='off';
export function binaryCopyFrame(text){
 const data=Buffer.from(text,'utf8');if(data.length===0||data.length>1048576)fail('COPY_INPUT_SIZE');
 const header=Buffer.alloc(19);Buffer.from([80,71,67,79,80,89,10,255,13,10,0]).copy(header);
 const row=Buffer.alloc(6);row.writeInt16BE(1,0);row.writeInt32BE(data.length,2);
 const trailer=Buffer.alloc(2);trailer.writeInt16BE(-1);return Buffer.concat([header,row,data,trailer]);
}
export const privateStageSql=`SELECT c.relpersistence='t' AND c.relkind='r' AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND c.relnamespace=pg_my_temp_schema()
 AND (SELECT count(*)=1 AND bool_and(a.atttypid='bytea'::regtype AND a.attname='payload' AND NOT a.attnotnull AND NOT a.atthasdef) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
 AND NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid=c.oid) AND NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid=c.oid)
 AND NOT EXISTS(SELECT FROM pg_rewrite WHERE ev_class=c.oid)
 AND NOT EXISTS(SELECT FROM pg_index WHERE indrelid=c.oid)
 AND NOT EXISTS(SELECT FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner)
 AS safe FROM pg_class c WHERE c.oid='pg_temp.ptv_legacy25_input'::regclass`;
const privateResultSql=privateStageSql.replaceAll("'bytea'::regtype","'jsonb'::regtype").replaceAll("'payload'","'result'").replaceAll('ptv_legacy25_input','ptv_legacy25_result');
export function splitBinarySql(sql){
 const chunks=sql.split(/-- @PTV_BINARY_(?:COPY|ENGINE|COMMIT)@\r?\n/);
 if(chunks.length!==4||chunks[1].trim()!=='COPY pg_temp.ptv_legacy25_input(payload) FROM STDIN WITH (FORMAT binary);'||chunks[3].trim()!=='COMMIT;')fail('TRANSPORT_PACKAGE_FORMAT');
 return {prepare:chunks[0],copy:chunks[1].trim(),engine:chunks[2],commit:chunks[3]};
}
export async function executeBinaryTransport(client,sql,manifestText){
 const parts=splitBinarySql(sql);let commitSent=false;
 try{
  const context=(await client.query(transportContextSql)).rows[0];if(!transportContextSafe(context))fail('TRANSPORT_LOG_CONTEXT');
  await client.query(parts.prepare);
  if((await client.query(privateStageSql)).rows[0]?.safe!==true||(await client.query(privateResultSql)).rows[0]?.safe!==true)fail('PRIVATE_STAGE_LAYOUT');
  const expected=parts.engine.match(/IF _digest<>'([a-f0-9]{64})'/)?.[1];
  if(!expected||(await client.query(triggerDigestSql)).rows[0]?.digest!==expected)fail('REVIEWED_TRIGGER_DRIFT');
  const surface=sql.match(/-- REVIEWED_SURFACE_SHA256: ([a-f0-9]{64})/)?.[1];
  if(!surface||(await client.query(surfaceDigestSql)).rows[0]?.digest!==surface)fail('REVIEWED_SCHEMA_DRIFT');
  await pipeline(Readable.from([binaryCopyFrame(manifestText)]),client.query(copyFrom(parts.copy)));
  const response=await client.query(parts.engine),results=Array.isArray(response)?response:[response];
  const outcome=results.flatMap(r=>r.rows||[]).map(r=>r.result).find(v=>v&&typeof v==='object');
  if(!outcome||typeof outcome.ok!=='boolean')fail('TRANSPORT_RESULT');
  if(!outcome.ok){await client.query('ROLLBACK');return {outcome,committed:false};}
  commitSent=true;await client.query(parts.commit);return {outcome,committed:true};
 }catch(cause){
  await client.query('ROLLBACK').catch(()=>{});
  const safeCodes=['TRANSPORT_LOG_CONTEXT','PRIVATE_STAGE_LAYOUT','TRANSPORT_RESULT','REVIEWED_TRIGGER_DRIFT','REVIEWED_SCHEMA_DRIFT','COPY_INPUT_SIZE'];
  const error=new Error(commitSent?'TRANSPORT_COMMIT_OUTCOME_UNKNOWN':safeCodes.includes(cause.message)?cause.message:'TRANSPORT_ABORTED');error.commitOutcomeUnknown=commitSent;throw error;
 }
}

const catalogSql=`SELECT md5(jsonb_build_object('relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','ptv_auth_private','ptv_access_private')),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN('public','ptv_auth_private','ptv_access_private')),'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d),'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.prosecdef,p.proacl,md5(pg_get_functiondef(p.oid))) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','ptv_auth_private','ptv_access_private') AND p.prokind='f'))::text)`;

export function buildBinaryTransportSql(legacySql,{manifestSha,triggerDigest,surfaceDigest,baselineTables}){
 if(!/^[a-f0-9]{64}$/.test(manifestSha)||!/^[a-f0-9]{64}$/.test(triggerDigest)||!/^[a-f0-9]{64}$/.test(surfaceDigest)||!Array.isArray(baselineTables)||baselineTables.length<5||baselineTables.some(t=>!/^(public|auth|ptv_auth_private)\.[a-z_][a-z0-9_]*$/.test(t)))fail('TRANSPORT_BUILD_CONFIG');
 const match=legacySql.match(/DO\s+(\$[a-zA-Z0-9_]+\$)\s+DECLARE([\s\S]*?)\r?\nBEGIN\s*\r?\n([\s\S]*)\r?\nEND\s+\1;\s*COMMIT;\s*$/);
 if(!match)fail('LEGACY_ENGINE_FORMAT');
 const declaration=match[2].replace(/m jsonb := '((?:''|[^'])*)'::jsonb;/,'m jsonb;');
 if(declaration===match[2]||declaration.includes('__APPROVED_')||match[3].includes('__APPROVED_'))fail('LEGACY_ENGINE_UNBOUND');
 const tableArray='ARRAY['+[...new Set(baselineTables)].sort().map(t=>"'"+t+"'").join(',')+']::text[]';
 const snapshot=`_snapshot:='{}'::jsonb;
 FOR _table IN SELECT unnest(${tableArray}) LOOP
  _where:=CASE _table WHEN 'public.canonical_identity' THEN 'NOT (x.id=ANY($1::uuid[]))' WHEN 'public.user_account' THEN 'NOT (x.id=ANY($2::uuid[]))' WHEN 'public.organization_membership' THEN 'NOT (x.id=ANY($4::uuid[]))' WHEN 'public.account_profiles' THEN 'NOT (x.account_id=ANY($2::uuid[]))' WHEN 'public.auth_audit_log' THEN 'NOT (x.event_type=''initial_accounts_provisioned'' AND (x.metadata->>''operation_id'') IS NOT DISTINCT FROM $3::text)' ELSE 'true' END;
  EXECUTE 'SELECT jsonb_build_object(''count'',count(*),''hash'',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,''[]''),''UTF8'')),''hex'')) FROM '||_table||' x WHERE '||_where||' AND $1::uuid[] IS NOT NULL AND $2::uuid[] IS NOT NULL AND $3::text IS NOT NULL AND $4::uuid[] IS NOT NULL' INTO _row USING _ids,_accounts,operation::text,_members;
  EXECUTE 'SELECT count(*) FROM '||_table INTO _total;
  _snapshot:=_snapshot||jsonb_build_object(_table,_row||jsonb_build_object('total',_total));
 END LOOP;`;
 return `-- COPY_BINARY_V1: no personnel literals, no sensitive bind parameters, no persistent helper.
-- REVIEWED_SURFACE_SHA256: ${surfaceDigest}
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL plan_cache_mode='force_generic_plan';
SELECT pg_advisory_xact_lock(149,1);
LOCK TABLE public.legacy_archive_kru,public.canonical_identity,public.organization_membership,public.user_account,public.account_profiles,public.account_capability_overrides,public.profile_capabilities,public.access_profile,public.capability_registry IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE ptv_legacy25_input(payload bytea) ON COMMIT DROP;
CREATE TEMP TABLE ptv_legacy25_result(result jsonb) ON COMMIT DROP;
REVOKE ALL ON TABLE pg_temp.ptv_legacy25_input,pg_temp.ptv_legacy25_result FROM PUBLIC,anon,authenticated,service_role;
-- @PTV_BINARY_COPY@
COPY pg_temp.ptv_legacy25_input(payload) FROM STDIN WITH (FORMAT binary);
-- @PTV_BINARY_ENGINE@
DO $binary_engine$
DECLARE${declaration}
 _stage text:='INPUT'; _raw bytea; _ids uuid[]; _accounts uuid[]; _members uuid[];
 _snapshot jsonb; _before jsonb; _row jsonb; _table text; _where text; _total bigint;
 _catalog text; _catalog_after text; _digest text; _expected integer; _delta integer;
 _replay boolean; _rows jsonb:='{}'; _receipt text; _transaction text;
BEGIN
 BEGIN
  IF NOT ((current_setting('auto_explain.log_min_duration',true) IS NULL OR current_setting('auto_explain.log_min_duration',true)='-1' OR (current_setting('auto_explain.log_nested_statements',true)='off' AND current_setting('auto_explain.log_parameter_max_length',true)='0')) AND (coalesce(current_setting('pgaudit.log',true),'none')='none' OR coalesce(current_setting('pgaudit.log_parameter',true),'off')='off')) THEN RAISE EXCEPTION 'unsafe transport logging context'; END IF;
  IF (SELECT count(*) FROM pg_temp.ptv_legacy25_input)<>1 THEN RAISE EXCEPTION 'exactly one opaque input required'; END IF;
  SELECT payload INTO _raw FROM pg_temp.ptv_legacy25_input;
  IF octet_length(_raw)>1048576 OR encode(sha256(_raw),'hex')<>'${manifestSha}' THEN RAISE EXCEPTION 'approved manifest checksum required'; END IF;
  ${triggerDigestSql} INTO _digest;
  IF _digest<>'${triggerDigest}' THEN RAISE EXCEPTION 'reviewed triggers required'; END IF;
  m:=convert_from(_raw,'UTF8')::jsonb; _raw:=NULL;
  operation:=(m->>'operation_id')::uuid;
  SELECT array_agg((x->>'source_uuid')::uuid),array_agg((x->>'account_uuid')::uuid),array_agg((x->>'membership_uuid')::uuid) INTO _ids,_accounts,_members FROM jsonb_array_elements(m->'targets') x;
  SELECT EXISTS(SELECT FROM public.auth_audit_log WHERE event_type='initial_accounts_provisioned' AND metadata->>'operation_id'=operation::text) INTO _replay;
  _stage:='BASELINE'; ${snapshot} _before:=_snapshot;
  ${catalogSql} INTO _catalog;
  _stage:='PROVISION';
${match[3]}
  _stage:='POSTFLIGHT';
  IF (SELECT count(*) FROM public.user_account u WHERE u.id=ANY(_accounts))<>25
  OR EXISTS(SELECT FROM public.user_account u WHERE u.id=ANY(_accounts) AND (u.status_akun<>'inactive' OR u.auth_user_id IS NOT NULL))
  OR EXISTS(SELECT FROM public.auth_credentials c WHERE c.account_id=ANY(_accounts))
  OR EXISTS(SELECT FROM public.account_capability_overrides o WHERE o.account_id=ANY(_accounts))
  OR EXISTS(SELECT FROM public.account_profiles p WHERE p.account_id=ANY(_accounts) AND p.profile_id<>'crew')
  OR (SELECT count(*) FROM public.account_profiles p WHERE p.account_id=ANY(_accounts) AND p.profile_id='crew')<>25
  OR (SELECT count(*) FROM public.organization_membership om WHERE om.id=ANY(_members) AND om.identity_id=ANY(_ids) AND om.is_current)<>25
  OR EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive')
  OR NOT EXISTS(SELECT FROM ptv_auth_private.policy WHERE singleton AND NOT enabled)
  THEN RAISE EXCEPTION 'inactive-only postflight failed'; END IF;
  ${snapshot}
  FOR _table IN SELECT unnest(${tableArray}) LOOP
   IF _before->_table->>'hash' IS DISTINCT FROM _snapshot->_table->>'hash' OR _before->_table->>'count' IS DISTINCT FROM _snapshot->_table->>'count' THEN RAISE EXCEPTION 'existing rows changed'; END IF;
   _delta:=(_snapshot->_table->>'total')::integer-(_before->_table->>'total')::integer;
   _expected:=CASE WHEN _replay THEN 0 WHEN _table='public.auth_audit_log' THEN 1 WHEN _table IN('public.canonical_identity','public.organization_membership','public.user_account','public.account_profiles') THEN 25 ELSE 0 END;
   IF _delta<>_expected THEN RAISE EXCEPTION 'unexpected row delta'; END IF;
   IF _table IN('public.canonical_identity','public.organization_membership','public.user_account','public.account_profiles','public.auth_audit_log') THEN _rows:=_rows||jsonb_build_object(substr(_table,8),_delta); END IF;
  END LOOP;
  ${catalogSql} INTO _catalog_after;
  IF _catalog IS DISTINCT FROM _catalog_after THEN RAISE EXCEPTION 'security catalog changed'; END IF;
  IF (SELECT count(*) FROM public.auth_audit_log WHERE event_type='initial_accounts_provisioned' AND metadata->>'operation_id'=operation::text)<>1 THEN RAISE EXCEPTION 'single receipt required'; END IF;
  SELECT id::text,xmin::text INTO _receipt,_transaction FROM public.auth_audit_log WHERE event_type='initial_accounts_provisioned' AND metadata->>'operation_id'=operation::text;
  INSERT INTO pg_temp.ptv_legacy25_result VALUES(jsonb_build_object('ok',true,'code','PASS','noop',_replay,'rows',_rows,'receiptId',_receipt,'transactionId',_transaction,'root',0,'gate','OFF','credentials',0,'postflight','PASS'));
 EXCEPTION
 WHEN query_canceled THEN INSERT INTO pg_temp.ptv_legacy25_result VALUES(jsonb_build_object('ok',false,'code','57014','stage',_stage)); RAISE LOG 'PTV_LEGACY25_FAILURE sqlstate=57014 stage=%',_stage;
 WHEN assert_failure THEN INSERT INTO pg_temp.ptv_legacy25_result VALUES(jsonb_build_object('ok',false,'code','P0004','stage',_stage)); RAISE LOG 'PTV_LEGACY25_FAILURE sqlstate=P0004 stage=%',_stage;
 WHEN OTHERS THEN INSERT INTO pg_temp.ptv_legacy25_result VALUES(jsonb_build_object('ok',false,'code',SQLSTATE,'stage',_stage)); RAISE LOG 'PTV_LEGACY25_FAILURE sqlstate=% stage=%',SQLSTATE,_stage;
 END;
END $binary_engine$;
SELECT result FROM pg_temp.ptv_legacy25_result;
-- @PTV_BINARY_COMMIT@
COMMIT;
`;
}
