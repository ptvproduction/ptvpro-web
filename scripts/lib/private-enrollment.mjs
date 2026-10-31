import { createHash } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { from as copyFrom } from 'pg-copy-streams';
import { binaryCopyFrame, privateStageSql, transportContextSql, transportContextSafe } from './legacy25-binary-transport.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STAGING_FINGERPRINT='72737c1de8ff53d24950c9d2b30bd42d';

export function validateEnrollmentReview(m,password,now=Date.now()) {
 if(m.project_ref!=='swadgljnyelsjstqqxbm'||m.scope!=='ENROLL_INACTIVE_ACCOUNT_ONLY'
  ||![m.operation_id,m.account_id,m.identity_id].every(v=>typeof v==='string'&&UUID.test(v))
  ||m.source_uuid!==m.identity_id||!/^PTV-[0-9]{3,}$/.test(m.ptv_id||'')
  ||!/^\S{3,48}$/.test(m.username||'')||!Number.isFinite(Date.parse(m.expected_account_version))
  ||!/^[a-f0-9]{64}$/.test(m.security_surface_sha256||'')
  ||typeof m.approval_reference!=='string'||m.approval_reference.trim().length<8
  ||m.privacy_logging_approved!==true
  ||m.owner_verified!==true||typeof m.owner_evidence_reference!=='string'||m.owner_evidence_reference.length<8
  ||typeof m.recovery_evidence_reference!=='string'||m.recovery_evidence_reference.length<8
  ||m.owner_evidence_reference===m.recovery_evidence_reference
  ||!Number.isFinite(Date.parse(m.owner_verified_at))||Date.parse(m.owner_verified_at)>now||Date.parse(m.owner_verified_at)<now-86400000
  ||!Number.isFinite(Date.parse(m.expires_at))||Date.parse(m.expires_at)<=now||Date.parse(m.expires_at)>now+86400000
  ||typeof password!=='string'||password.length<12||Buffer.byteLength(password,'utf8')>72)
  throw new Error('Private enrollment review is incomplete');
 return createHash('sha256').update(JSON.stringify(m)).digest('hex');
}

// The private review pins the reviewed executable surface, including credential/audit triggers.
export const enrollmentSurfaceSql=`SELECT encode(sha256(convert_to(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.prosecdef,p.proacl,pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname !~ '^pg_temp_' AND p.prokind='f'),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t WHERE t.tgrelid=ANY(ARRAY['public.auth_credentials'::regclass,'public.auth_audit_log'::regclass,'public.user_account'::regclass])),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c WHERE c.conrelid=ANY(ARRAY['public.auth_credentials'::regclass,'public.auth_audit_log'::regclass])),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(r.oid) ORDER BY r.oid) FROM pg_rewrite r WHERE r.ev_class=ANY(ARRAY['public.auth_credentials'::regclass,'public.auth_audit_log'::regclass])),
 'defaults',(SELECT jsonb_agg(pg_get_expr(d.adbin,d.adrelid) ORDER BY d.oid) FROM pg_attrdef d WHERE d.adrelid=ANY(ARRAY['public.auth_credentials'::regclass,'public.auth_audit_log'::regclass]))
 )::text,'UTF8')),'hex') AS digest`;

const baselineSql=`SELECT jsonb_build_object(
 'accounts',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.user_account x),
 'identities',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.canonical_identity x),
 'memberships',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.organization_membership x),
 'archives',(SELECT jsonb_agg(to_jsonb(x) ORDER BY archive_id) FROM public.legacy_archive_kru x),
 'profiles',(SELECT jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text) FROM public.account_profiles x),
 'overrides',(SELECT jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text) FROM public.account_capability_overrides x),
 'sessions',(SELECT jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text) FROM ptv_auth_private.sessions x),
 'other_credentials',(SELECT jsonb_agg(to_jsonb(x) ORDER BY account_id) FROM public.auth_credentials x WHERE account_id<>a.id),
 'other_audit',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.auth_audit_log x WHERE NOT(event_type='password_credential_enrolled' AND (metadata->>'enrollment_id') IS NOT DISTINCT FROM (m->>'operation_id')))
 )`;
const enrollmentEngine=`DO $enroll$
DECLARE packet jsonb; m jsonb; a public.user_account%rowtype; c public.auth_credentials%rowtype; i public.canonical_identity%rowtype;
 receipt jsonb; encoded text; digest text; replay boolean:=false; ok boolean; snapshot jsonb; after_snapshot jsonb;
BEGIN
 BEGIN
  SELECT convert_from(payload,'UTF8')::jsonb INTO STRICT packet FROM pg_temp.ptv_enrollment_input;
  m:=packet->'review'; encoded:=packet->>'hash'; digest:=packet->>'digest';
  IF (m->>'expires_at')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'approval expired while waiting'; END IF;
  IF NOT EXISTS(SELECT FROM ptv_auth_private.policy WHERE singleton AND NOT enabled) OR EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive') THEN RAISE EXCEPTION 'closed prebootstrap enrollment required'; END IF;
  SELECT * INTO STRICT a FROM public.user_account WHERE id=(m->>'account_id')::uuid FOR UPDATE;
  SELECT * INTO STRICT i FROM public.canonical_identity WHERE id=a.identity_id;
  SELECT * INTO c FROM public.auth_credentials WHERE account_id=a.id FOR UPDATE;
  IF a.identity_id IS DISTINCT FROM (m->>'identity_id')::uuid OR a.updated_at IS DISTINCT FROM (m->>'expected_account_version')::timestamptz
   OR a.status_akun<>'inactive' OR a.auth_user_id IS NOT NULL OR a.tokens_valid_after IS NULL
   OR a.username IS DISTINCT FROM m->>'username' OR i.ptv_id IS DISTINCT FROM m->>'ptv_id'
   OR i.metadata->>'legacy_uuid' IS DISTINCT FROM m->>'source_uuid'
   OR i.metadata->>'legacy_source_project' IS DISTINCT FROM 'jthzuhkblxcaohiuypqq'
   OR i.metadata->>'legacy_source_table' IS DISTINCT FROM 'ptv_kru'
   OR (SELECT count(*) FROM public.organization_membership WHERE identity_id=i.id AND organization_id='ptv_studio' AND is_current)<>1
   OR (SELECT count(*) FROM public.user_account WHERE lower(username)=lower(a.username))<>1
   OR (SELECT count(*) FROM public.account_profiles WHERE account_id=a.id AND profile_id='crew')<>1
   OR EXISTS(SELECT FROM public.account_profiles WHERE account_id=a.id AND profile_id<>'crew')
   OR EXISTS(SELECT FROM public.account_capability_overrides WHERE account_id=a.id)
   OR EXISTS(SELECT FROM ptv_auth_private.sessions WHERE account_id=a.id)
   OR c.oauth_provider IS NOT NULL OR c.oauth_subject_id IS NOT NULL THEN RAISE EXCEPTION 'review mismatch'; END IF;
  ${baselineSql} INTO snapshot;
  SELECT metadata INTO receipt FROM public.auth_audit_log WHERE event_type='password_credential_enrolled' AND metadata->>'enrollment_id'=m->>'operation_id';
  IF FOUND THEN
   IF receipt->>'account_id' IS DISTINCT FROM a.id::text OR receipt->>'identity_id' IS DISTINCT FROM a.identity_id::text
    OR receipt->>'manifest_sha256' IS DISTINCT FROM digest OR c.password_hash IS NULL
    OR receipt->>'credential_digest' IS DISTINCT FROM encode(sha256(convert_to(c.password_hash,'UTF8')),'hex')
    OR c.updated_at IS DISTINCT FROM (receipt->>'credential_version')::timestamptz THEN RAISE EXCEPTION 'replay differs'; END IF;
   replay:=true;
  ELSE
   IF c.password_hash IS NOT NULL THEN RAISE EXCEPTION 'credential exists'; END IF;
   SELECT ptv_auth_private.enroll_password((m->>'operation_id')::uuid,a.id,i.id,a.updated_at,c.updated_at,encoded,digest,m->>'approval_reference') INTO ok;
   IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'enrollment failed'; END IF;
  END IF;
  ${baselineSql} INTO after_snapshot;
  IF snapshot IS DISTINCT FROM after_snapshot OR NOT EXISTS(SELECT FROM ptv_auth_private.policy WHERE singleton AND NOT enabled)
   OR (SELECT count(*) FROM public.auth_audit_log WHERE event_type='password_credential_enrolled' AND metadata->>'enrollment_id'=m->>'operation_id')<>1 THEN RAISE EXCEPTION 'postflight failed'; END IF;
  INSERT INTO pg_temp.ptv_enrollment_result VALUES(jsonb_build_object('ok',true,'replay',replay,'saved_hash',CASE WHEN replay THEN c.password_hash ELSE NULL END,
   'receiptId',(SELECT id::text FROM public.auth_audit_log WHERE event_type='password_credential_enrolled' AND metadata->>'enrollment_id'=m->>'operation_id'),
   'transactionId',(SELECT xmin::text FROM public.auth_audit_log WHERE event_type='password_credential_enrolled' AND metadata->>'enrollment_id'=m->>'operation_id')));
 EXCEPTION WHEN query_canceled OR assert_failure OR OTHERS THEN
  INSERT INTO pg_temp.ptv_enrollment_result VALUES(jsonb_build_object('ok',false));
  RAISE LOG 'PTV_PRIVATE_ENROLLMENT_FAILURE redacted';
 END;
END $enroll$; SELECT result FROM pg_temp.ptv_enrollment_result;`;

// No HTTP endpoint, real credential, role alteration or account activation is performed by preparation/tests.
export async function enrollInactiveAccount(client,m,password,{synthetic=false}={}) {
 const digest=validateEnrollmentReview(m,password);
 let commitSent=false;
 await client.query('BEGIN');
 try {
  const {rows:[principal]}=await client.query("SELECT session_user,current_user,coalesce(current_setting('role',true),'none') AS role,coalesce(current_setting('request.jwt.claims',true),'') AS claims,md5(system_identifier::text) AS fingerprint,current_database() AS database FROM pg_control_system()");
  if(principal.session_user!=='postgres'||principal.current_user!=='postgres'||!['none','postgres'].includes(principal.role)||!['','{}'].includes(principal.claims))throw new Error('Administrative connection required');
  if(synthetic){
   if(client.connectionParameters.host!=='127.0.0.1'||!/^phase1_provision_fixture_\d+$/.test(principal.database))throw new Error('Synthetic database required');
   if((await client.query('SELECT marker FROM public.bootstrap149_test_fixture')).rows[0]?.marker!=='SYNTHETIC_ONLY')throw new Error('Synthetic fixture required');
  }else if(principal.fingerprint!==STAGING_FINGERPRINT)throw new Error('Staging physical fingerprint mismatch');
  if(!transportContextSafe((await client.query(transportContextSql)).rows[0]))throw new Error('Unsafe logging context');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SET LOCAL plan_cache_mode='force_generic_plan'; SELECT pg_advisory_xact_lock(149,1)");
  await client.query('LOCK TABLE public.user_account,public.auth_credentials,public.auth_audit_log,public.canonical_identity,public.organization_membership,public.legacy_archive_kru,public.account_profiles,public.account_capability_overrides,ptv_auth_private.sessions,ptv_auth_private.policy IN SHARE ROW EXCLUSIVE MODE');
  if((await client.query(enrollmentSurfaceSql)).rows[0]?.digest!==m.security_surface_sha256)throw new Error('Reviewed security surface changed');
  await client.query('CREATE TEMP TABLE ptv_enrollment_input(payload bytea) ON COMMIT DROP; CREATE TEMP TABLE ptv_enrollment_result(result jsonb) ON COMMIT DROP; REVOKE ALL ON pg_temp.ptv_enrollment_input,pg_temp.ptv_enrollment_result FROM PUBLIC,anon,authenticated,service_role');
  for(const [name,type,column] of [['input','bytea','payload'],['result','jsonb','result']]){
   const sql=privateStageSql.replaceAll('ptv_legacy25_input','ptv_enrollment_'+name).replaceAll("'bytea'::regtype","'"+type+"'::regtype").replaceAll("'payload'","'"+column+"'");
   if((await client.query(sql)).rows[0]?.safe!==true)throw new Error('Unsafe private stage');
  }
  const encoded=await hash(password,10);
  await pipeline(Readable.from([binaryCopyFrame(JSON.stringify({review:m,digest,hash:encoded}))]),client.query(copyFrom('COPY pg_temp.ptv_enrollment_input(payload) FROM STDIN WITH (FORMAT binary)')));
  const responses=await client.query(enrollmentEngine);
  const result=responses.flatMap(r=>r.rows||[]).map(r=>r.result).find(Boolean);
  if(!result?.ok||(result.replay&&!await compare(password,result.saved_hash)))throw new Error('Enrollment rejected');
  commitSent=true;await client.query('COMMIT');
  return {success:true,noOp:result.replay,receiptId:result.receiptId,transactionId:result.transactionId};
 }catch{
  await client.query('ROLLBACK').catch(()=>{});
  throw new Error(commitSent?'Enrollment outcome unknown; keep maintenance and reconcile receipt before retry':'Private enrollment rejected; no raw database diagnostics exposed');
 }
}
