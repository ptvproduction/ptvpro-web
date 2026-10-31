import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID, generateKeyPairSync, sign } from 'node:crypto';
import assert from 'node:assert/strict';
import { renderApprovedBootstrap } from './lib/root-bootstrap-149.mjs';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';

if (process.argv.length !== 2) throw new Error('No connection arguments accepted');
const bin='C:/Program Files/PostgreSQL/17/bin/';
const cluster='C:/Users/zidna/ptvpro/.gemini/scratch/bootstrap149-pg';
const database=`phase1_auth_fixture_${Date.now()}`;
const env={...process.env,PGHOST:'127.0.0.1',PGHOSTADDR:'127.0.0.1',PGPORT:'55439',PGUSER:'postgres',PGDATABASE:database,PGPASSWORD:'',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
for(const k of ['PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGPASSFILE']) delete env[k];
const args=['-X','-w','-qAt','-h','127.0.0.1','-p','55439','-U','postgres','-v','ON_ERROR_STOP=1'];
const run=(cmd,a,options={})=>spawnSync(bin+cmd,a,{env,encoding:'utf8',windowsHide:true,timeout:60000,...options});
function query(input,db=database,fail=false) {
 const r=run('psql.exe',[...args,'-d',db],{input});
 if(!fail&&r.status!==0) throw new Error(`Synthetic SQL failure: ${r.stderr}`);
 return r;
}
const sql=input=>query(input).stdout.trim();
const checks=[];
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);};
const reject=(label,input)=>check(label,query(input,database,true).status!==0);
const service=input=>`BEGIN; SET LOCAL ROLE service_role; SET LOCAL request.jwt.claims='{"role":"service_role"}'; ${input} COMMIT;`;
const account=n=>`00000000-0000-4000-8000-00000000000${n}`;
const identity=n=>`10000000-0000-4000-8000-00000000000${n}`;
const hash='$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const key='a'.repeat(64),ip='b'.repeat(64),fp='c'.repeat(64),proof='d'.repeat(64);
const now=()=>Math.floor(Date.now()/1000);
const proposal=readFileSync('docs/PTVPRO-ACCESS-PHASE1-AUTH-PROPOSAL.sql','utf8');
let system,created=false;
function begin(n=1,ingress=ip,id=randomUUID(),identifier=`synthetic-${n}`) {
 const statement=`SELECT public.rpc_portal_login_begin('${id}','${proof}','${identifier}','${key}','${ingress}');`;
 return {id,result:JSON.parse(sql(service(statement))),statement};
}
function finish(id,fingerprint=fp,sid=randomUUID(),success=true,iat=now(),exp=iat+600) {
 return `SELECT public.rpc_portal_login_finish('${id}','${proof}',${success},'${fingerprint}','${sid}',${iat},${exp});`;
}
function reset(){sql('TRUNCATE ptv_auth_private.buckets,ptv_auth_private.attempts,ptv_auth_private.sessions;');}
const binding=(n=1,fingerprint=fp,sid=null,iat=now(),exp=iat+600)=>`'${account(n)}','${identity(n)}',${iat},${exp},${sid?`'${sid}'`:'NULL'},'${fingerprint}'`;
function concurrent(input){return new Promise((resolve,rejectPromise)=>{const p=spawn(bin+'psql.exe',[...args,'-d',database],{env,windowsHide:true});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',rejectPromise);p.on('close',status=>resolve({status,out:out.trim(),err}));p.stdin.end(input);});}
if(run('pg_ctl.exe',['-D',cluster,'status'],{stdio:'ignore'}).status===0) throw new Error('Existing server not owned by this run');
if(run('pg_ctl.exe',['-D',cluster,'-l',cluster+'/phase1-auth.log','-o','-h 127.0.0.1 -p 55439 -c max_connections=20','-w','start'],{stdio:'ignore'}).status!==0) throw new Error('Isolated local PostgreSQL unavailable');
try {
 query(`CREATE DATABASE ${database};`,'postgres');
 created=true;
 sql(readFileSync('tests/fixtures/bootstrap149-local.sql','utf8'));
 check('synthetic fixture only',sql('SELECT marker FROM public.bootstrap149_test_fixture')==='SYNTHETIC_ONLY');
 sql(readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',sql('SELECT system_identifier::text FROM pg_control_system()')));
 sql(`ALTER TABLE public.auth_credentials ADD COLUMN password_hash varchar(255),ADD COLUMN hash_algorithm text DEFAULT 'bcrypt',ADD COLUMN needs_rehash boolean DEFAULT false,ADD COLUMN password_updated_at timestamptz; CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);`);
 system=sql('SELECT system_identifier::text FROM pg_control_system()');
 sql(readFileSync('docs/PTVPRO-ACCESS-152-NATIVE-SESSION-PROPOSAL.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system));
 reject('unrendered proposal refuses install',proposal);
 sql(proposal.replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system));
 check('password login database policy default off',begin().result.enabled===false);
 reject('service role claim alone is not a trusted connection',`SET request.jwt.claims='{"role":"service_role"}'; SELECT public.rpc_portal_session_valid(${binding()});`);
 reject('service role without trusted JWT rejected',`SET ROLE service_role; SELECT public.rpc_portal_session_valid(${binding()});`);
 for(const role of ['anon','authenticated']){
  reject(`${role} cannot execute session RPC`,`SET ROLE ${role}; SELECT public.rpc_portal_session_valid(${binding()});`);
  reject(`${role} cannot read credentials`,`SET ROLE ${role}; SELECT * FROM ptv_auth_private.sessions;`);
 }
 check('all private tables have RLS',sql("SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ptv_auth_private' AND c.relkind='r'")==='t');
 check('service cannot execute private enrollment',sql("SELECT has_function_privilege('service_role','ptv_auth_private.enroll_password(uuid,uuid,uuid,timestamptz,timestamptz,text,text,text)','EXECUTE')")==='f');
 const operation=randomUUID();
 const version=sql(`SELECT updated_at FROM public.user_account WHERE id='${account(1)}'`);
 const cv=sql(`SELECT updated_at FROM public.auth_credentials WHERE account_id='${account(1)}'`);
 const enroll=`SELECT ptv_auth_private.enroll_password('${operation}','${account(1)}','${identity(1)}','${version}','${cv}','${hash}','${key}','SYNTHETIC-ACC-ONLY');`;
 const before=sql('SELECT json_agg(a ORDER BY id) FROM public.user_account a');
 reject('enrollment identity mismatch rejected',enroll.replace(identity(1),identity(2)));
 reject('enrollment stale account version rejected',enroll.replace(version,'2000-01-01T00:00:00Z'));
 sql("CREATE FUNCTION public.phase1_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$; CREATE TRIGGER phase1_fail BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.phase1_audit_failure();");
 reject('audit failure aborts enrollment',enroll);
 check('enrollment audit failure leaves credential absent',sql(`SELECT password_hash IS NULL FROM public.auth_credentials WHERE account_id='${account(1)}'`)==='t');
 sql('DROP TRIGGER phase1_fail ON public.auth_audit_log;');
 check('enrollment and exact replay succeed',sql(enroll)==='t'&&sql(enroll)==='t');
 check('enrollment does not mutate accounts or account status',sql('SELECT json_agg(a ORDER BY id) FROM public.user_account a')===before);
 check('enrollment preserves Google binding',sql(`SELECT oauth_subject_id FROM public.auth_credentials WHERE account_id='${account(1)}'`)==='SYNTHETIC-NOT-A-REAL-SUBJECT-1');
 check('one enrollment audit',sql("SELECT count(*) FROM public.auth_audit_log WHERE event_type='password_credential_enrolled'")==='1');
 reject('new operation cannot overwrite existing password',enroll.replace(operation,randomUUID()));
 reject('replay detects later credential change',`BEGIN; UPDATE public.auth_credentials SET updated_at=clock_timestamp() WHERE account_id='${account(1)}'; ${enroll} ROLLBACK;`);
 sql('UPDATE ptv_auth_private.policy SET enabled=true;');
 const first=begin();
 check('login starts with database session policy',first.result.allowed&&first.result.session_seconds===604800);
 const sid=randomUUID(),iat=now(),exp=iat+600;
 const complete=finish(first.id,fp,sid,true,iat,exp);
 sql('CREATE TRIGGER phase1_fail BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.phase1_audit_failure();');
 reject('audit failure aborts session creation',service(complete));
 check('audit failure rolls back ticket and session together',sql(`SELECT (NOT completed) AND NOT EXISTS(SELECT FROM ptv_auth_private.sessions) FROM ptv_auth_private.attempts WHERE id='${first.id}'`)==='t');
 sql('DROP TRIGGER phase1_fail ON public.auth_audit_log;');
 const race=await Promise.all([concurrent(service(complete)),concurrent(service(complete))]);
 check('two connections finish same ticket idempotently',race.every(r=>r.status===0&&r.out==='t'));
 check('exactly one session and login audit after concurrent finish',sql(`SELECT (SELECT count(*) FROM ptv_auth_private.sessions)=1 AND (SELECT count(*) FROM public.auth_audit_log WHERE metadata->>'attempt_id'='${first.id}')=1`)==='t');
 const valid=`SELECT public.rpc_portal_session_valid(${binding(1,fp,sid,iat,exp)});`;
 check('registered session valid',sql(service(valid))==='t');
 check('session identity mismatch denied',sql(service(valid.replace(identity(1),identity(2))))==='f');
 check('unknown session UUID denied',sql(service(valid.replace(sid,randomUUID())))==='f');
 for(const [label,mutation] of [
  ['inactive account',`UPDATE public.user_account SET status_akun='inactive' WHERE id='${account(1)}';`],
  ['lockout',`UPDATE public.user_account SET lockout_until=clock_timestamp()+interval '1 hour' WHERE id='${account(1)}';`],
  ['account revocation cutoff',`UPDATE public.user_account SET tokens_valid_after=clock_timestamp() WHERE id='${account(1)}';`],
  ['changed credential',`UPDATE public.auth_credentials SET updated_at=clock_timestamp() WHERE account_id='${account(1)}';`]]){
   check(`${label} invalidates session`,sql(`BEGIN; ${mutation} SET LOCAL ROLE service_role; SET LOCAL request.jwt.claims='{"role":"service_role"}'; ${valid} ROLLBACK;`)==='f');
 }
 check('expired session denied',sql(service(valid.replace(String(exp),String(iat-1))))==='f');
 const legacyBinding=binding(1,'e'.repeat(64),null,iat,exp);
 check('existing signed legacy cookie remains valid',sql(service(`SELECT public.rpc_portal_session_valid(${legacyBinding});`))==='t');
 const revoke=`SELECT public.rpc_portal_session_revoke(${binding(1,fp,sid,iat,exp)});`;
 sql('CREATE TRIGGER phase1_fail BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.phase1_audit_failure();');
 reject('audit failure rolls back revocation',service(revoke));
 check('failed revocation preserves original session',sql(service(valid))==='t');
 sql('DROP TRIGGER phase1_fail ON public.auth_audit_log;');
 const revokes=await Promise.all([concurrent(service(revoke)),concurrent(service(revoke))]);
 check('two connections revoke idempotently',revokes.every(r=>r.status===0&&r.out==='t'));
 check('revoked session cannot authorize',sql(service(valid))==='f');
 check('other cookie not revoked',sql(service(`SELECT public.rpc_portal_session_valid(${legacyBinding});`))==='t');
 sql(service(`SELECT public.rpc_portal_session_revoke(${legacyBinding});`));
 check('legacy cookie revocation durable',sql(service(`SELECT public.rpc_portal_session_valid(${legacyBinding});`))==='f');
 reset();
 for(let i=0;i<5;i++) check(`account budget attempt ${i+1}`,begin().result.allowed===true);
 check('PTV ID alias shares username budget',begin(1,ip,randomUUID(),'PTV-901').result.allowed===false);
 reset();
 const budgets=await Promise.all(Array.from({length:10},(_,n)=>concurrent(service(`SELECT public.rpc_portal_login_begin('${randomUUID()}','${proof}','synthetic-1','${key}','${String(n).repeat(64)}')->>'allowed';`))));
 check('ten concurrent connections cannot exceed account limit five',budgets.every(r=>r.status===0)&&budgets.filter(r=>r.out==='true').length===5);
 reset();sql('UPDATE ptv_auth_private.policy SET ingress_limit=1;');
 check('unknown account consumes ingress budget',begin(9).result.allowed===true);
 check('different account cannot bypass ingress budget',begin(2).result.allowed===false);
 reset();sql('UPDATE ptv_auth_private.policy SET ingress_limit=30;');
 for(const [label,mutation] of [
  ['credential changed',`UPDATE public.auth_credentials SET updated_at=clock_timestamp() WHERE account_id='${account(1)}';`],
  ['account version changed',`UPDATE public.user_account SET updated_at=clock_timestamp() WHERE id='${account(1)}';`],
  ['permission withdrawn',`INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type) VALUES('${account(1)}','hub.access','deny');`],
  ['ticket expired',`UPDATE ptv_auth_private.attempts SET expires_at=clock_timestamp()-interval '1 second';`]]){
   reset();const t=begin();check(`finish rejects ${label}`,sql(`BEGIN; ${mutation} SET LOCAL ROLE service_role; SET LOCAL request.jwt.claims='{"role":"service_role"}'; ${finish(t.id)} ROLLBACK;`)==='f');
 }
 reset();const unknown=begin(9);check('unknown account finish fails generically',sql(service(finish(unknown.id)))==='f');
 const googleVersion=sql(`SELECT updated_at FROM public.auth_credentials WHERE account_id='${account(2)}'`);
 const google=`SELECT public.rpc_portal_google_session('${account(2)}','${identity(2)}','SYNTHETIC-NOT-A-REAL-SUBJECT-2','${googleVersion}','${randomUUID()}','${fp}',${now()},${now()+600});`;
 reset();check('Google session and proof atomic function succeeds',sql(service(google))==='t');
 reject('Google subject mismatch rejected',service(google.replace('SUBJECT-2','SUBJECT-1')));
 check('credential proofs remain usable after session cutoff',sql(`BEGIN; UPDATE public.user_account SET tokens_valid_after=clock_timestamp(); SELECT ptv_auth_private.usable_portal_login('${account(2)}'); ROLLBACK;`)==='t');
 check('distinct synthetic accounts support independence check',sql(`SELECT ptv_auth_private.independent_credentials('${account(1)}','${account(2)}');`)==='t');
 check('same account cannot be recovery',sql(`SELECT ptv_auth_private.independent_credentials('${account(1)}','${account(1)}');`)==='f');
 const template=readFileSync('docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-TEMPLATE.sql','utf8');
 const targets=JSON.parse(sql(`SELECT json_agg(json_build_object('accountId',a.id,'identityId',a.identity_id,'accountVersion',a.updated_at,'credentialVersion',c.updated_at,'loginProofId',(SELECT max(l.id)::text FROM public.auth_audit_log l WHERE l.event_type='portal_login_verified' AND l.metadata->>'account_id'=a.id::text),'expectedProfiles',(SELECT json_agg(profile_id ORDER BY profile_id) FROM public.account_profiles WHERE account_id=a.id),'expectedOverrides','[]'::json) ORDER BY a.id) FROM public.user_account a JOIN public.auth_credentials c ON c.account_id=a.id WHERE a.id IN ('${account(1)}','${account(2)}');`));
 const plan={version:1,projectRef:'swadgljnyelsjstqqxbm',databaseSystemIdentifier:system,purpose:'first_root_bootstrap',issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),approvalReference:'SYNTHETIC-PHASE1-ACC',independenceEvidenceSha256:key,portalE2EEvidenceSha256:ip,independentOwnersConfirmed:true,templateSha256:createHash('sha256').update(template).digest('hex'),expectedRootCapabilities:['hub.access','crew.permissions.manage','crew.view'],root:targets[0],recovery:targets[1]};
 const pair=generateKeyPairSync('ed25519'),bytes=Buffer.from(JSON.stringify(plan));
 const bootstrap=renderApprovedBootstrap(bytes,sign(null,bytes,pair.privateKey).toString('base64'),{version:1,authorizedEd25519PublicKeysPem:[pair.publicKey.export({type:'spki',format:'pem'})]},template);
 reject('public service cannot invoke operator bootstrap',`SET ROLE service_role; ${bootstrap}`);
 // Force the selected first account to prove its password route, not its old Google route.
 sql(`UPDATE public.auth_credentials SET oauth_provider=NULL,oauth_subject_id=NULL WHERE account_id='${account(1)}';`);
 check('password proof remains valid without Google binding',sql(`SELECT ptv_auth_private.usable_portal_login('${account(1)}');`)==='t');
 sql(bootstrap);
 check('signed operator bootstrap supports password primary and Google recovery',sql(`SELECT ptv_auth_private.independent_credentials('${account(1)}','${account(2)}');`)==='t');
 check('post-bootstrap session cutoff does not destroy credential ownership proof',query('SELECT ptv_access_private.assert_recovery();').status===0);
 check('shared Google credential cannot count as independent despite password route',sql(`BEGIN; UPDATE public.auth_credentials SET oauth_provider='google',oauth_subject_id='SYNTHETIC-NOT-A-REAL-SUBJECT-2' WHERE account_id='${account(1)}'; SELECT ptv_auth_private.independent_credentials('${account(1)}','${account(2)}'); ROLLBACK;`)==='f');
 reject('bootstrap cannot be reused',bootstrap);
 reject('enrollment cannot replace Root credential',enroll.replace(operation,randomUUID()));
 sql(readFileSync('docs/PTVPRO-ACCESS-149-LINKING-PROPOSAL.sql','utf8'));
 const person='10000000-0000-4000-8000-000000000004',archive='50000000-0000-4000-8000-000000000004',legacyUuid='60000000-0000-4000-8000-000000000004';
 sql(`INSERT INTO public.canonical_identity(id,ptv_id,full_name,metadata) VALUES('${person}','PTV-904','Synthetic No Login',jsonb_build_object('legacy_source_project','jthzuhkblxcaohiuypqq','legacy_source_table','ptv_kru','legacy_uuid','${legacyUuid}'));
 INSERT INTO public.organization_membership(id,identity_id,organization_id,status_organisasi,is_current) VALUES('30000000-0000-4000-8000-000000000004','${person}','ptv_studio','inactive',true);
 INSERT INTO public.legacy_archive_kru(archive_id,production_id,ptv_id,status,metadata_json,imported_at) VALUES('${archive}','${legacyUuid}','PTV-904','active','{}',clock_timestamp());`);
 const av=sql(`SELECT imported_at FROM public.legacy_archive_kru WHERE archive_id='${archive}'`),iv=sql(`SELECT updated_at FROM public.canonical_identity WHERE id='${person}'`);
 await delay(1100);
 const link=`SELECT public.rpc_link_legacy_personnel('${account(2)}',${now()},'${archive}','${person}','${legacyUuid}','${av}','${iv}','${key}','SYNTHETIC-REVIEW');`;
 const accountState=sql('SELECT json_agg(a ORDER BY id) FROM public.user_account a');
 reject('linking rejects absent provenance',service(link.replace(legacyUuid,randomUUID())));
 reject('linking rejects duplicate archive PTV ID',`BEGIN; INSERT INTO public.legacy_archive_kru(archive_id,production_id,ptv_id) VALUES('${randomUUID()}','${randomUUID()}','PTV-904'); SET LOCAL ROLE service_role; SET LOCAL request.jwt.claims='{"role":"service_role"}'; ${link} ROLLBACK;`);
 reject('linking stale archive version rejected',service(link.replace(av,'2000-01-01T00:00:00Z')));
 sql('CREATE TRIGGER phase1_fail BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.phase1_audit_failure();');
 reject('linking audit failure rolls back',service(link));
 check('failed linking leaves archive unlinked',sql(`SELECT canonical_identity_id IS NULL FROM public.legacy_archive_kru WHERE archive_id='${archive}'`)==='t');
 sql('DROP TRIGGER phase1_fail ON public.auth_audit_log;');
 const links=await Promise.all([concurrent(service(link)),concurrent(service(link))]);
 check('two connections link idempotently without duplicate identities',links.every(r=>r.status===0)&&sql("SELECT count(*) FROM public.auth_audit_log WHERE event_type='legacy_personnel_linked'")==='1');
 check('linking allows personnel without creating account',sql(`SELECT count(*) FROM public.user_account WHERE identity_id='${person}'`)==='0');
 check('linking preserves all account profiles and statuses',sql('SELECT json_agg(a ORDER BY id) FROM public.user_account a')===accountState);
 reject('same canonical cannot acquire a second login account',`INSERT INTO public.user_account(id,identity_id,username,status_akun) VALUES('${randomUUID()}','${identity(1)}','duplicate-synthetic','active');`);
 check('account and personnel statuses stay independent',sql(`SELECT status_akun='active' FROM public.user_account WHERE id='${account(1)}'`)==='t'&&sql(`SELECT status_organisasi='inactive' FROM public.organization_membership WHERE identity_id='${person}'`)==='t');
 const contain=readFileSync('docs/PTVPRO-ACCESS-PHASE1-AUTH-CONTAINMENT.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system);
 const durable=sql('SELECT count(*) FROM public.auth_audit_log');sql(contain);
 check('containment disables password issuance',begin().result.enabled===false);
 check('containment preserves audit and credentials',sql('SELECT count(*) FROM public.auth_audit_log')===durable&&sql(`SELECT password_hash IS NOT NULL FROM public.auth_credentials WHERE account_id='${account(1)}'`)==='t');
 check('containment retains revocation RPC',sql("SELECT has_function_privilege('service_role','public.rpc_portal_session_revoke(uuid,uuid,bigint,bigint,uuid,text)','EXECUTE')")==='t');
 writeFileSync('docs/PTVPRO-PHASE1-AUTH-LOCAL-SQL-RESULTS.json',JSON.stringify({scope:'LOCAL POSTGRESQL17 SYNTHETIC ONLY',passed:checks.length,checks,cloudConnections:false,proposalSha256:createHash('sha256').update(proposal).digest('hex'),bootstrapTemplateSha256:createHash('sha256').update(template).digest('hex')},null,2)+'\n');
 console.log(JSON.stringify({passed:checks.length,cloudConnections:false,syntheticOnly:true}));
} finally {
 const cleanup=created?query(`DROP DATABASE ${database};`,'postgres',true):{status:0};
 if(run('pg_ctl.exe',['-D',cluster,'-m','fast','-w','stop'],{stdio:'ignore'}).status!==0 || cleanup.status!==0) {
  console.error('Synthetic fixture cleanup/shutdown needs attention');process.exitCode=1;
 }
}
