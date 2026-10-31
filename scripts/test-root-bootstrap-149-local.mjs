import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { renderApprovedBootstrap,renderApprovedBootstrapRevert } from './lib/root-bootstrap-149.mjs';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';

// This runner cannot accept a host, port, credentials, database name or Supabase URL from input.
const binary='C:/Program Files/PostgreSQL/17/bin/psql.exe';
const control='C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe';
const cluster='C:/Users/zidna/ptvpro/.gemini/scratch/bootstrap149-pg';
if(process.argv.includes('--stop-fixture')) {
  const stop=spawnSync(control,['-D',cluster,'-m','fast','-w','stop'],{stdio:'ignore',windowsHide:true});
  process.exit(stop.status===0?0:1);
}
const database=`bootstrap149_fixture_${Date.now()}`;
const environment={...process.env,PGHOST:'127.0.0.1',PGHOSTADDR:'127.0.0.1',PGPORT:'55439',PGUSER:'postgres',PGDATABASE:database,PGPASSWORD:'',PGSERVICE:'',PGSERVICEFILE:'',PGOPTIONS:'',PGSSLMODE:'disable'};
delete environment.PGSERVICE;delete environment.PGSERVICEFILE;
const args=['-X','--no-password','-h','127.0.0.1','-p','55439','-U','postgres','-qAt','-v','ON_ERROR_STOP=1'];
function run(sql,db=database) {
  return spawnSync(binary,[...args,'-d',db],{env:{...environment,PGDATABASE:db},input:sql,encoding:'utf8',windowsHide:true});
}
function exec(sql,db=database) {const r=run(sql,db);if(r.status!==0)throw new Error(`Local fixture SQL failed: ${r.stderr.trim()}`);return r.stdout.trim();}
function assert(value,label) {if(!value)throw new Error(`Local assertion failed: ${label}`);passed.push(label);}
function rejected(sql,fragment,label) {const r=run(sql);if(r.status===0||!r.stderr.includes(fragment))throw new Error(`Local rejection mismatch (${label}): status=${r.status}; ${r.stderr.trim()}`);passed.push(label);}
const passed=[];
if(spawnSync(control,['-D',cluster,'status'],{encoding:'utf8',windowsHide:true}).status===0) throw new Error('Local fixture server already running; refuse to control a process not started by this run.');
const start=spawnSync(control,['-D',cluster,'-l',`${cluster}/server.log`,'-o','-h 127.0.0.1 -p 55439 -c max_connections=20','-w','start'],{stdio:'ignore',windowsHide:true});
if(start.status!==0) throw new Error('Unable to start isolated local fixture server.');
try {
// Cluster identifier is recorded internally to render a manifest bound to this LOCAL cluster only.
exec(`CREATE DATABASE ${database};`,'postgres');
exec("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;");
exec(readFileSync('tests/fixtures/bootstrap149-local.sql','utf8'));
assert(exec('SELECT marker FROM public.bootstrap149_test_fixture')==='SYNTHETIC_ONLY','synthetic database marker');
exec(readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',exec('SELECT system_identifier::text FROM pg_control_system()')));
assert(exec("SELECT has_function_privilege('service_role','public.rpc_manage_account_access(uuid,bigint,jsonb)','EXECUTE')") === 'f','prebootstrap service mutation EXECUTE closed');
assert(exec("SELECT has_function_privilege('authenticated','public.rpc_manage_account_access(uuid,bigint,jsonb)','EXECUTE')") === 'f','authenticated cannot mutate access');
const template=readFileSync('docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-TEMPLATE.sql','utf8');
const snapshot=JSON.parse(exec(`SELECT json_build_object('databaseSystemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),'targets',(SELECT json_agg(json_build_object('accountId',a.id,'identityId',a.identity_id,'accountVersion',a.updated_at,'credentialVersion',c.updated_at,'loginProofId',l.id::text,'expectedProfiles',(SELECT json_agg(profile_id ORDER BY profile_id) FROM public.account_profiles WHERE account_id=a.id),'expectedOverrides','[]'::json) ORDER BY a.id) FROM public.user_account a JOIN public.auth_credentials c ON c.account_id=a.id JOIN public.auth_audit_log l ON l.actor_id=a.identity_id AND l.event_type='portal_login_verified'))`));
const plan={version:1,projectRef:'swadgljnyelsjstqqxbm',databaseSystemIdentifier:snapshot.databaseSystemIdentifier,purpose:'first_root_bootstrap',issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),approvalReference:'SYNTHETIC-ACC-149',independenceEvidenceSha256:'a'.repeat(64),portalE2EEvidenceSha256:'b'.repeat(64),independentOwnersConfirmed:true,templateSha256:createHash('sha256').update(template).digest('hex'),expectedRootCapabilities:['hub.access','crew.permissions.manage','crew.view'],root:snapshot.targets[0],recovery:snapshot.targets[1]};
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const trust={version:1,authorizedEd25519PublicKeysPem:[publicKey.export({type:'spki',format:'pem'})]};
function render(p) {const bytes=Buffer.from(JSON.stringify(p));return renderApprovedBootstrap(bytes,sign(null,bytes,privateKey).toString('base64'),trust,template);}
const sql=render(plan);
const countRoot=()=>exec("SELECT count(*) FROM public.account_profiles WHERE profile_id='root_executive'");
const originalState=exec('SELECT json_agg(json_build_array(id,updated_at,tokens_valid_after) ORDER BY id) FROM public.user_account');
rejected('SET ROLE service_role;'+sql,'trusted direct administrative SQL only','service role cannot execute administrative bootstrap');
rejected(render({...plan,databaseSystemIdentifier:'1234567890123456789'}),'wrong database cluster','wrong physical database rejected');
const stale=globalThis.structuredClone(plan);stale.root.accountVersion='2000-01-01T00:00:00Z';
rejected(render(stale),'stale account approval','stale account snapshot rejected');
exec("UPDATE public.auth_credentials SET oauth_subject_id='SYNTHETIC-NOT-A-REAL-SUBJECT-1' WHERE account_id='00000000-0000-4000-8000-000000000002'");
rejected(sql,'independent credentials missing','same credential is not independent');
exec("UPDATE public.auth_credentials SET oauth_subject_id='SYNTHETIC-NOT-A-REAL-SUBJECT-2' WHERE account_id='00000000-0000-4000-8000-000000000002'");
exec("UPDATE public.auth_audit_log SET created_at=now()-interval '2 days' WHERE id=2");
rejected(sql,'portal login required','old login evidence rejected');
exec('UPDATE public.auth_audit_log SET created_at=now() WHERE id=2');
exec("CREATE FUNCTION public.synthetic_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='root_bootstrap_completed' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.synthetic_audit_failure();");
rejected(sql,'synthetic audit failure','audit error aborts bootstrap');
assert(countRoot()==='0'&&exec('SELECT json_agg(json_build_array(id,updated_at,tokens_valid_after) ORDER BY id) FROM public.user_account')===originalState,'audit failure rolls back assignment and token cutoffs');
exec('DROP TRIGGER synthetic_audit_failure ON public.auth_audit_log; DROP FUNCTION public.synthetic_audit_failure();');
function concurrent(input) {return new Promise(resolve=>{const child=spawn(binary,[...args,'-d',database],{env:environment,windowsHide:true});let stderr='';child.stderr.on('data',d=>stderr+=d);child.stdout.resume();child.on('close',status=>resolve({status,stderr}));child.stdin.end(input);});}
const races=await Promise.all([concurrent(sql),concurrent(sql)]);
assert(races.filter(r=>r.status===0).length===1&&races.some(r=>r.stderr.includes('already consumed')),'two concurrent bootstraps: exactly one succeeds');
assert(countRoot()==='1'&&exec("SELECT count(*) FROM public.auth_audit_log WHERE event_type='root_bootstrap_completed'")==='1','one Root assignment and one consumed marker');
exec('SELECT ptv_access_private.assert_recovery();');
assert(exec("SELECT has_function_privilege('service_role','public.rpc_manage_account_access(uuid,bigint,jsonb)','EXECUTE')")==='t','only normal mutation RPC opened');
assert(exec("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','ptv_access_private') AND p.prorettype<>'trigger'::regtype AND p.proname ILIKE '%bootstrap%'")==='0','no callable bootstrap function; guard-only triggers retained');
assert(exec("SELECT has_table_privilege('service_role','public.account_profiles','INSERT')")==='f','service role cannot directly write access profiles');
rejected("SET ROLE service_role;INSERT INTO public.account_profiles(account_id,profile_id) VALUES('00000000-0000-4000-8000-000000000003','root_executive');",'permission denied','direct service-role Root assignment rejected');
exec('GRANT INSERT ON public.account_profiles TO service_role');
rejected("SET ROLE service_role;INSERT INTO public.account_profiles(account_id,profile_id) VALUES('00000000-0000-4000-8000-000000000003','root_executive');",'approved direct administration','Root guard survives accidental write-grant regression');
exec('REVOKE INSERT ON public.account_profiles FROM service_role');
rejected("SET ROLE service_role;INSERT INTO public.auth_audit_log(event_type,metadata) VALUES('root_bootstrap_completed','{}');",'approved direct administration','forged bootstrap audit marker rejected');
rejected("DELETE FROM public.auth_audit_log WHERE event_type='root_bootstrap_completed'",'immutable','consumed marker cannot be deleted even by accidental admin SQL');
rejected('TRUNCATE public.auth_audit_log','truncate forbidden','audit truncate cannot reopen bootstrap');
rejected("SET ROLE authenticated;INSERT INTO public.auth_audit_log(event_type,metadata) VALUES('portal_login_verified','{}');",'permission denied','authenticated cannot fabricate login evidence through direct SQL');
rejected("SET ROLE anon;INSERT INTO public.account_profiles(account_id,profile_id) VALUES('00000000-0000-4000-8000-000000000003','eksekutif');",'permission denied','anon cannot assign a non-Root administrative profile');
exec('GRANT INSERT ON public.auth_audit_log TO authenticated');
rejected("SET ROLE authenticated;INSERT INTO public.auth_audit_log(event_type,metadata) VALUES('portal_login_verified','{}');",'row-level security','RLS rejects forged login evidence if a write grant regresses');
exec('REVOKE INSERT ON public.auth_audit_log FROM authenticated');
await delay(1100);
const version=exec("SELECT updated_at FROM public.user_account WHERE id='00000000-0000-4000-8000-000000000002'");
const change=JSON.stringify({accountId:plan.recovery.accountId,expectedVersion:version,profiles:['eksekutif'],allowed:[],denied:[],status:'inactive',confirmed:true,reason:'SYNTHETIC recovery lockout attempt'}).replaceAll("'","''");
rejected(`SET ROLE service_role;SELECT public.rpc_manage_account_access('${plan.root.accountId}',floor(extract(epoch FROM clock_timestamp()))::bigint,'${change}'::jsonb);`,'independent recovery administrator missing','normal access RPC cannot deactivate pinned recovery');
assert(exec("SELECT status_akun FROM public.user_account WHERE id='00000000-0000-4000-8000-000000000002'")==='active','failed recovery deactivation rolls back');
exec("CREATE POLICY synthetic_account_read ON public.user_account FOR SELECT TO authenticated USING(public.has_capability('hub.access'));");
const native=`SET ROLE authenticated;SET request.jwt.claims='{"sub":"20000000-0000-4000-8000-000000000001","iat":${Math.floor(Date.now()/1000)}}';`;
assert(exec(native+"SELECT public.has_capability('crew.permissions.manage')")==='t','native helper binds valid subject to Root account');
assert(exec(`SET ROLE authenticated;SET request.jwt.claims='{"sub":"99999999-9999-4999-8999-999999999999","account_id":"${plan.root.accountId}","iat":${Math.floor(Date.now()/1000)}}';SELECT public.has_capability('crew.permissions.manage');`)==='f','spoofed account claim cannot replace native subject');
// Backup/restore is tested only with these synthetic rows, including ACLs and immutable markers.
const dumpPath='C:/Users/zidna/ptvpro/.gemini/scratch/bootstrap149-fixture.dump';
const dump=spawnSync('C:/Program Files/PostgreSQL/17/bin/pg_dump.exe',['-h','127.0.0.1','-p','55439','-U','postgres','-d',database,'-Fc','--no-owner','-f',dumpPath],{env:environment,encoding:'utf8',windowsHide:true});
assert(dump.status===0,'synthetic consistent backup created');
const restored=`${database}_restore`;
exec(`CREATE DATABASE ${restored};`,'postgres');
const restore=spawnSync('C:/Program Files/PostgreSQL/17/bin/pg_restore.exe',['-h','127.0.0.1','-p','55439','-U','postgres','--no-owner','--exit-on-error','-d',restored,dumpPath],{env:environment,encoding:'utf8',windowsHide:true});
assert(restore.status===0,'synthetic backup restores including schema/grants');
assert(exec("SELECT count(*) FROM public.account_profiles WHERE profile_id='root_executive'",restored)==='1'
  &&exec("SELECT count(*) FROM public.auth_audit_log WHERE event_type='root_bootstrap_completed'",restored)==='1','restore preserves Root and consumed audit marker');
exec('SELECT ptv_access_private.assert_recovery();',restored);
assert(exec("SELECT has_function_privilege('authenticated','public.rpc_manage_account_access(uuid,bigint,jsonb)','EXECUTE')",restored)==='f','restore does not grant public mutation access');
const revertTemplate=readFileSync('docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-REVERT-TEMPLATE.sql','utf8');
const revertPlan={version:1,projectRef:plan.projectRef,databaseSystemIdentifier:plan.databaseSystemIdentifier,purpose:'first_root_bootstrap_revert',issuedAt:plan.issuedAt,expiresAt:plan.expiresAt,approvalReference:'SYNTHETIC-SEPARATE-REVERT-149',templateSha256:createHash('sha256').update(revertTemplate).digest('hex'),bootstrapEventId:exec("SELECT id FROM public.auth_audit_log WHERE event_type='root_bootstrap_completed'")};
const revertBytes=Buffer.from(JSON.stringify(revertPlan));
const revert=renderApprovedBootstrapRevert(revertBytes,sign(null,revertBytes,privateKey).toString('base64'),trust,revertTemplate);
exec(revert);
assert(exec("SELECT has_function_privilege('service_role','public.rpc_manage_account_access(uuid,bigint,jsonb)','EXECUTE')")==='f','approved revert closes mutation EXECUTE');
assert(countRoot()==='0'&&exec("SELECT status_akun FROM public.user_account WHERE id='00000000-0000-4000-8000-000000000002'")==='active','revert removes only introduced Root assignment; recovery account retained');
rejected(revert,'already reverted','revert requires a new recovery procedure after consumption');
rejected(sql,'already consumed','removing Root does not reopen first bootstrap');
assert(countRoot()==='0','replayed bootstrap cannot restore/escalate Root');
const report={scope:'LOCAL POSTGRESQL 17 SYNTHETIC FIXTURE ONLY',cloudConnectionsUsedByRunner:false,cloudMutationsExecuted:false,passed:passed.length,checks:passed};
writeFileSync('.gemini/scratch/bootstrap149-local-sql-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
} finally {
  const stop=spawnSync(control,['-D',cluster,'-m','fast','-w','stop'],{encoding:'utf8',windowsHide:true});
  if(stop.status!==0) { console.error('Local fixture shutdown needs attention.'); process.exitCode=1; }
}
