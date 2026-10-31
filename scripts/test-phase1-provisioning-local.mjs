import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { Client } from 'pg';
import { enrollInactiveAccount, enrollmentSurfaceSql } from './lib/private-enrollment.mjs';
import { testPrivateEnrollment } from './lib/test-private-enrollment.mjs';
import { renderReviewedLegacyPayload } from './lib/legacy-account-migration.mjs';
import { testLegacy25Binary } from './lib/test-legacy25-binary.mjs';

const binary=process.argv.length===3&&process.argv[2]==='--binary25';
const enrollment=process.argv.length===3&&process.argv[2]==='--enrollment';
const overnight=process.argv.length===3&&['--overnight25','--binary25'].includes(process.argv[2]);
const batch=process.argv.length===3&&['--legacy-batch','--overnight25','--binary25','--enrollment'].includes(process.argv[2]);
if(process.argv.length!==2&&!batch) throw new Error('No connection arguments accepted');
const bin='C:/Program Files/PostgreSQL/17/bin/';
const cluster='C:/Users/zidna/ptvpro/.gemini/scratch/bootstrap149-pg';
const database=`phase1_provision_fixture_${Date.now()}`;
const env={...process.env,PGHOST:'127.0.0.1',PGHOSTADDR:'127.0.0.1',PGPORT:'55439',PGUSER:'postgres',PGDATABASE:database,PGPASSWORD:'',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
for(const k of ['PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGPASSFILE']) delete env[k];
const args=['-X','-w','-qAt','-h','127.0.0.1','-p','55439','-U','postgres','-v','ON_ERROR_STOP=1'];
const run=(cmd,a,options={})=>spawnSync(bin+cmd,a,{env,encoding:'utf8',windowsHide:true,timeout:60000,...options});
function query(input,db=database){return run('psql.exe',[...args,'-d',db],{input:"SET TIME ZONE 'UTC';\n"+input});}
function sql(input,db=database){const r=query(input,db);if(r.status!==0)throw new Error(`Synthetic SQL failed: ${r.stderr}`);return r.stdout.trim();}
const checks=[];
function check(label,condition){assert.ok(condition,label);checks.push(label);}
const reject=(label,input)=>check(label,query(input).status!==0);
const quote=v=>`'${v.replaceAll("'","''")}'`;
const template=readFileSync(batch?'docs/PTVPRO-PHASE1-LEGACY-MIGRATION-PROPOSAL.sql':'docs/PTVPRO-PHASE1-PROVISIONING-PROPOSAL.sql','utf8');
let created=false,system;
let binaryEvidence;
const manifest={project_ref:'swadgljnyelsjstqqxbm',approval_scope:'PROVISION_TWO_INACTIVE_CREW_ACCOUNTS',approval_reference:'SYNTHETIC-ACC-NO-REAL-OWNER',operation_id:randomUUID(),expires_at:new Date(Date.now()+3600000).toISOString(),targets:[1,2].map(n=>({ptv_id:`PTV-00${n}`,source_uuid:randomUUID(),archive_uuid:randomUUID(),account_uuid:randomUUID(),membership_uuid:randomUUID(),username:`synthetic-new-${n}`,category:'Kru',division_id:'technical',cohort:'1',membership_status:'active',membership_period_start:'2026-10-26',initial_profile:'crew',archive_sha256:null}))};
if(batch){
 manifest.approval_scope='PROVISION_REVIEWED_LEGACY_ACCOUNTS';
 manifest.source_snapshot_sha256='b'.repeat(64);
 for(const n of [3,4])manifest.targets.push({...manifest.targets[0],ptv_id:`PTV-00${n}`,source_uuid:randomUUID(),archive_uuid:randomUUID(),account_uuid:randomUUID(),membership_uuid:randomUUID(),username:`synthetic-new-${n}`});
 for(const t of manifest.targets)Object.assign(t,{provisioning_mode:'INACTIVE_ONLY_NO_LOGIN',legacy_account_status:'unknown',legacy_personnel_status:'aktif',canonical_full_name:'Synthetic Current Source',membership_period_start:'ACTUAL_PROVISIONING_DATE_ASIA_JAKARTA',position_title:'Synthetic Position',mapping_review_reference:'SYNTHETIC-MAPPING-REVIEW',credential_action:'PRIVATE_REENROLLMENT_NO_HASH_COPY'});
}
if(overnight){
 const ids=['001','002','003','004','005','006','016',...Array.from({length:18},(_,i)=>String(i+19).padStart(3,'0'))];
 manifest.targets=ids.map(id=>({...manifest.targets[0],ptv_id:'PTV-'+id,source_uuid:randomUUID(),archive_uuid:randomUUID(),account_uuid:randomUUID(),membership_uuid:randomUUID(),username:'synthetic-new-'+id}));
 manifest.targets[0].canonical_full_name="Synthetic $provision$ O'Reilly";
}
function render(m=manifest){const literal=quote(JSON.stringify(m)),tag='$fixture_'+createHash('sha256').update(literal).digest('hex').slice(0,16)+'$';return template.replaceAll('$provision$',()=>tag).replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',()=>system).replace("'__APPROVED_PRIVATE_MANIFEST_JSON__'",()=>literal);}
const snapshot=()=>sql("SELECT jsonb_build_object('identity',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.canonical_identity t),'account',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.user_account t),'member',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.organization_membership t),'audit',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.auth_audit_log t),'archive',(SELECT jsonb_agg(to_jsonb(t) ORDER BY archive_id) FROM public.legacy_archive_kru t))");
const concurrent=input=>new Promise((resolve,rejectPromise)=>{const p=spawn(bin+'psql.exe',[...args,'-d',database],{env,windowsHide:true});let err='';p.stderr.on('data',v=>err+=v);p.stdout.resume();p.on('error',rejectPromise);p.on('close',status=>resolve({status,err}));p.stdin.end("SET TIME ZONE 'UTC';\n"+input);});
if(run('pg_ctl.exe',['-D',cluster,'status'],{stdio:'ignore'}).status===0)throw new Error('Existing local server not owned by this run');
const logPath=cluster+(binary?'/binary25.log':enrollment?'/enrollment.log':'/provisioning.log');
const serverOptions='-h 127.0.0.1 -p 55439 -c max_connections=20'+(binary||enrollment?' -c shared_preload_libraries=pg_stat_statements,auto_explain -c log_statement=all -c log_min_error_statement=error -c log_parameter_max_length=-1 -c log_parameter_max_length_on_error=-1 -c auto_explain.log_min_duration=0 -c auto_explain.log_nested_statements=off -c auto_explain.log_parameter_max_length=0 -c pg_stat_statements.track=all':'');
if(run('pg_ctl.exe',['-D',cluster,'-l',logPath,'-o',serverOptions,'-w','start'],{stdio:'ignore'}).status!==0)throw new Error('Isolated PostgreSQL unavailable');
try{
 sql(`CREATE DATABASE ${database}`,'postgres');created=true;
 sql(readFileSync('tests/fixtures/bootstrap149-local.sql','utf8'));
 sql("ALTER TABLE public.organization_membership ADD COLUMN period_start date DEFAULT CURRENT_DATE NOT NULL; ALTER TABLE public.organization_membership ALTER COLUMN position_title SET NOT NULL;");
 system=sql('SELECT system_identifier::text FROM pg_control_system()');
 sql(readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system));
 sql("ALTER TABLE public.auth_credentials ADD COLUMN password_hash varchar(255),ADD COLUMN hash_algorithm text DEFAULT 'bcrypt',ADD COLUMN needs_rehash boolean DEFAULT false,ADD COLUMN password_updated_at timestamptz; CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);");
 sql(readFileSync('docs/PTVPRO-ACCESS-152-NATIVE-SESSION-PROPOSAL.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system));
 sql(readFileSync('docs/PTVPRO-ACCESS-PHASE1-AUTH-PROPOSAL.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system));
 sql("INSERT INTO public.organization_division VALUES('technical');");
 manifest.crew_capabilities_sha256=sql("SELECT encode(sha256(convert_to(coalesce(jsonb_agg(capability_key ORDER BY capability_key),'[]')::text,'UTF8')),'hex') FROM public.profile_capabilities WHERE profile_id='crew'");
 for(const t of manifest.targets){sql(`INSERT INTO public.legacy_archive_kru(archive_id,source_key,production_id,ptv_id,full_name,jabatan,status,metadata_json,imported_at) VALUES('${t.archive_uuid}','ptv_kru:${t.source_uuid}','${t.source_uuid}','${t.ptv_id}','Synthetic Only','Synthetic Position','aktif','{}',clock_timestamp());`);t.archive_sha256=sql(`SELECT encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') FROM public.legacy_archive_kru a WHERE archive_id='${t.archive_uuid}'`);}
 if(enrollment){sql(render());await testPrivateEnrollment({manifest,database,sql,checks,logPath,system});}
 else if(binary){binaryEvidence=await testLegacy25Binary({manifest,template,system,sql,snapshot,checks,logPath});}else{
 const before=snapshot();
 reject('unrendered template fails closed',template);
 reject('wrong physical target rejected',render().replace(system,'0'));
 reject('service role cannot administer provisioning',`SET ROLE service_role; SET request.jwt.claims='{"role":"service_role"}'; ${render()}`);
 reject('service role claim on postgres rejected',`SET request.jwt.claims='{"role":"service_role"}'; ${render()}`);
 for(const role of ['anon','authenticated'])reject(`${role} rejected`,`SET ROLE ${role}; ${render()}`);
 const mutate=fn=>{const m=JSON.parse(JSON.stringify(manifest));fn(m);return render(m);};
 reject('wrong project rejected',mutate(m=>m.project_ref='not-staging'));
 reject('expired manifest rejected',mutate(m=>m.expires_at='2000-01-01T00:00:00Z'));
 if(batch){
  reject('batch needs current reviewed source evidence',mutate(m=>delete m.source_snapshot_sha256));
  reject('missing account-status declaration rejected',mutate(m=>delete m.targets[0].legacy_account_status));
  reject('login-enabled provisioning mode rejected',mutate(m=>m.targets[0].provisioning_mode='ACTIVE_LOGIN'));
  reject('known source login status requires evidence',mutate(m=>m.targets[0].legacy_account_status='active'));
  reject('inactive historical personnel cannot acquire batch account',mutate(m=>m.targets[0].legacy_personnel_status='nonaktif'));
  reject('hash copying is not an accepted migration action',mutate(m=>m.targets[0].credential_action='COPY_LEGACY_HASH'));
  reject('source mapping requires explicit review',mutate(m=>delete m.targets[0].mapping_review_reference));
  reject('canonical source name required',mutate(m=>delete m.targets[0].canonical_full_name));
  reject('historical or fixed membership date cannot override provisioning date',mutate(m=>m.targets[0].membership_period_start='2000-01-01'));
 }
 reject('duplicate account targets rejected',mutate(m=>m.targets[1].account_uuid=m.targets[0].account_uuid));
 reject('duplicate source targets rejected',mutate(m=>m.targets[1].source_uuid=m.targets[0].source_uuid));
 reject('unknown division rejected',mutate(m=>m.targets[0].division_id='unknown'));
 reject('reserved PTV username alias rejected',mutate(m=>m.targets[0].username='ptv-002'));
 reject('membership period requires explicit approval',mutate(m=>delete m.targets[0].membership_period_start));
 reject('ambiguous cohort rejected',mutate(m=>m.targets[0].cohort='Angkatan satu'));
 reject('nonoperational division rejected',mutate(m=>m.targets[0].category='Pembina'));
 reject('Root profile rejected',mutate(m=>m.targets[0].initial_profile='root_executive'));
 reject('executive profile rejected',mutate(m=>m.targets[0].initial_profile='eksekutif'));
 reject('stale source fingerprint rejected',mutate(m=>m.targets[0].archive_sha256='0'.repeat(64)));
 reject('second target failure rolls back first target',mutate(m=>m.targets[1].archive_sha256='0'.repeat(64)));
 check('rejected operations leave all baseline rows unchanged',snapshot()===before);
 sql("CREATE FUNCTION public.provision_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$; CREATE TRIGGER provision_fail BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.provision_fail();");
 reject('audit failure rolls back complete pair',render());
 check('audit failure leaves baseline unchanged',snapshot()===before);
 sql('DROP TRIGGER provision_fail ON public.auth_audit_log');
 sql(`INSERT INTO public.canonical_identity(id,ptv_id,metadata) VALUES('${randomUUID()}','PTV-CONFLICT',jsonb_build_object('legacy_uuid','${manifest.targets[0].source_uuid}'));`);
 reject('preexisting provenance conflict rejected',render());
 sql("DELETE FROM public.canonical_identity WHERE ptv_id='PTV-CONFLICT'");
 sql(`INSERT INTO public.legacy_archive_kru(archive_id,production_id,ptv_id) VALUES('${randomUUID()}','${manifest.targets[0].source_uuid}','PTV-CONFLICT');`);
 reject('duplicate historical source rejected',render());
 sql("DELETE FROM public.legacy_archive_kru WHERE ptv_id='PTV-CONFLICT'");
 const archives=sql('SELECT jsonb_agg(to_jsonb(t) ORDER BY archive_id) FROM public.legacy_archive_kru t');
 const finalSql=overnight?renderReviewedLegacyPayload(template,manifest,system):render();
 const races=await Promise.all([concurrent(finalSql),concurrent(finalSql)]);
 if(races.some(r=>r.status!==0))throw new Error(`Synthetic concurrency failed: ${races.map(r=>r.err).join('; ')}`);
 check('two connections provision exactly once and replay safely',races.every(r=>r.status===0));
 check('one pair receipt only',sql("SELECT count(*) FROM public.auth_audit_log WHERE event_type='initial_accounts_provisioned'")==='1');
 if(overnight){
  reject('final payload refuses changed crew capability catalogue',renderReviewedLegacyPayload(template,{...manifest,crew_capabilities_sha256:'0'.repeat(64)},system));
  sql("SET TIME ZONE 'America/Los_Angeles';"+finalSql);
  check('final payload replay preserves rows under different session timezone',sql("SELECT count(*) FROM public.auth_audit_log WHERE event_type='initial_accounts_provisioned'")==='1');
 }
 check('exact batch size inactive new accounts with no native binding',sql("SELECT count(*) FROM public.user_account WHERE username LIKE 'synthetic-new-%' AND status_akun='inactive' AND auth_user_id IS NULL")===String(manifest.targets.length));
 if(batch)check('unknown source login status is preserved without activation',sql("SELECT count(*) FROM public.canonical_identity WHERE metadata->>'legacy_login_status'='unknown' AND metadata->>'provisioning_mode'='INACTIVE_ONLY_NO_LOGIN'")===String(manifest.targets.length));
 check('source UUID retained as canonical UUID',manifest.targets.every(t=>sql(`SELECT ptv_id FROM public.canonical_identity WHERE id='${t.source_uuid}'`)===t.ptv_id));
 if(batch){
  check('canonical name follows approved current source while archive is preserved',manifest.targets.every(t=>sql(`SELECT full_name FROM public.canonical_identity WHERE id='${t.source_uuid}'`)===t.canonical_full_name));
  check('membership date uses actual provisioning in Asia Jakarta',sql("SELECT bool_and(period_start=(transaction_timestamp() AT TIME ZONE 'Asia/Jakarta')::date) FROM public.organization_membership WHERE identity_id IN(SELECT id FROM public.canonical_identity WHERE metadata ? 'provision_operation')")==='t');
 }
 check('archive rows and links unchanged',sql('SELECT jsonb_agg(to_jsonb(t) ORDER BY archive_id) FROM public.legacy_archive_kru t')===archives);
 check('new accounts have no credentials or overrides',sql("SELECT NOT EXISTS(SELECT FROM public.auth_credentials c JOIN public.user_account u ON u.id=c.account_id WHERE u.username LIKE 'synthetic-new-%') AND NOT EXISTS(SELECT FROM public.account_capability_overrides o JOIN public.user_account u ON u.id=o.account_id WHERE u.username LIKE 'synthetic-new-%')")==='t');
 check('Root remains zero and gate OFF',sql("SELECT NOT EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive') AND NOT EXISTS(SELECT FROM ptv_auth_private.policy WHERE enabled)")==='t');
 if(batch){
  const postflight=readFileSync('docs/PTVPRO-PHASE1-LEGACY-MIGRATION-POSTFLIGHT.sql','utf8').replaceAll('__APPROVED_OPERATION_UUID__',manifest.operation_id).replaceAll('__APPROVED_TARGET_COUNT__',String(manifest.targets.length));
  check('batch postflight confirms every expected invariant',Object.values(JSON.parse(sql(postflight))).every(v=>v===true));
 }
 const after=snapshot();sql(render());check('exact replay leaves all rows unchanged',snapshot()===after);
 const target=manifest.targets[0];
 const av=sql(`SELECT updated_at FROM public.user_account WHERE id='${target.account_uuid}'`);
 const fixtureHash='$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
 sql(`SELECT ptv_auth_private.enroll_password('${randomUUID()}','${target.account_uuid}','${target.source_uuid}','${av}',NULL,'${fixtureHash}','${'a'.repeat(64)}','SYNTHETIC-ENROLLMENT-ONLY');`);
 check('existing enrollment supports new inactive account without native user',sql(`SELECT status_akun='inactive' AND auth_user_id IS NULL FROM public.user_account WHERE id='${target.account_uuid}'`)==='t');
 check('enrollment keeps issuance gate OFF',sql('SELECT NOT enabled FROM ptv_auth_private.policy')==='t');
 reject('replay changed username rejected',mutate(m=>m.targets[0].username='other-new'));
 sql(`UPDATE public.organization_membership SET status_organisasi='inactive' WHERE id='${manifest.targets[0].membership_uuid}'`);
 reject('replay after target modification rejected',render());
 if(batch){
  const client=new Client({host:'127.0.0.1',port:55439,user:'postgres',database,password:'',ssl:false,connectionTimeoutMillis:5000});
  await client.connect();
  try{
   const target=manifest.targets[1];
   const review={project_ref:'swadgljnyelsjstqqxbm',scope:'ENROLL_INACTIVE_ACCOUNT_ONLY',operation_id:randomUUID(),account_id:target.account_uuid,identity_id:target.source_uuid,source_uuid:target.source_uuid,ptv_id:target.ptv_id,username:target.username,expected_account_version:sql(`SELECT updated_at FROM public.user_account WHERE id='${target.account_uuid}'`),approval_reference:'SYNTHETIC-ENROLLMENT-ACC',privacy_logging_approved:true,owner_verified:true,owner_evidence_reference:'SYNTHETIC-OWNER-INDEPENDENT',recovery_evidence_reference:'SYNTHETIC-RECOVERY-INDEPENDENT',owner_verified_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString()};
   review.security_surface_sha256=sql(enrollmentSurfaceSql);
   const password='SYNTHETIC-only-new-password-123!';
   await assert.rejects(enrollInactiveAccount(client,{...review,owner_verified:false},password,{synthetic:true}));checks.push('private enrollment rejects absent ownership attestation');
   await assert.rejects(enrollInactiveAccount(client,{...review,username:'wrong-owner'},password,{synthetic:true}));checks.push('private enrollment rejects username mismatch');
   const first=await enrollInactiveAccount(client,review,password,{synthetic:true});check('binary private enrollment succeeds on inactive account',first.success&&!first.noOp);
   const again=await enrollInactiveAccount(client,review,password,{synthetic:true});check('private enrollment replay is no-op without new bcrypt salt or audit',again.success&&again.noOp);
   await assert.rejects(enrollInactiveAccount(client,review,'WRONG-SYNTHETIC-password',{synthetic:true}));checks.push('private enrollment replay rejects wrong password');
   check('private enrollment preserves inactive status and cutoff',sql(`SELECT status_akun='inactive' AND tokens_valid_after IS NOT NULL AND auth_user_id IS NULL FROM public.user_account WHERE id='${target.account_uuid}'`)==='t');
   await client.query("SET request.jwt.claims='{"+'"role":"service_role"'+"}'");
   await assert.rejects(enrollInactiveAccount(client,review,password,{synthetic:true}));checks.push('private enrollment rejects forged service-role claims');
   await client.query("SET request.jwt.claims=''");
   const third=manifest.targets[2],thirdReview={...review,operation_id:randomUUID(),account_id:third.account_uuid,identity_id:third.source_uuid,source_uuid:third.source_uuid,ptv_id:third.ptv_id,username:third.username,expected_account_version:sql(`SELECT updated_at FROM public.user_account WHERE id='${third.account_uuid}'`)};
   sql('CREATE TRIGGER provision_fail BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.provision_fail()');
   thirdReview.security_surface_sha256=sql(enrollmentSurfaceSql);
   await assert.rejects(enrollInactiveAccount(client,thirdReview,password,{synthetic:true}));checks.push('private enrollment audit failure rejects transaction');
   check('private enrollment audit failure leaves no credential',sql(`SELECT NOT EXISTS(SELECT FROM public.auth_credentials WHERE account_id='${third.account_uuid}')`)==='t');
   sql('DROP TRIGGER provision_fail ON public.auth_audit_log');
   thirdReview.security_surface_sha256=sql(enrollmentSurfaceSql);
   sql(`INSERT INTO public.auth_credentials(account_id,oauth_provider,oauth_subject_id) VALUES('${third.account_uuid}','google','SYNTHETIC-SUBJECT')`);
   await assert.rejects(enrollInactiveAccount(client,thirdReview,password,{synthetic:true}));checks.push('private password enrollment cannot silently inherit OAuth binding');
  }finally{await client.end();}
 }
 }
 const result={scope:'POSTGRESQL17 ISOLATED SYNTHETIC CLONE ONLY',passed:checks.length,checks,cloudConnections:false,realIdentityData:false,proposalSha256:createHash('sha256').update(template).digest('hex'),...(binaryEvidence?{binaryEvidence}:{})};
 result.syntheticBatchSize=manifest.targets.length;
 if(enrollment){
  result.serverVersion=sql('SHOW server_version');
  result.enrollmentTransportSha256=createHash('sha256').update(readFileSync('scripts/lib/private-enrollment.mjs')).digest('hex');
  result.pushContainmentSha256=createHash('sha256').update(readFileSync('docs/PTVPRO-PHASE1-PUSH-CONTAINMENT-PROPOSAL.sql')).digest('hex');
  result.operatorLauncher='STATIC ONLY — no C01/DPAPI enrollment execution or real credential used';
 }
 writeFileSync(enrollment?'docs/PTVPRO-PHASE1-ENROLLMENT-LOCAL-RESULTS.json':binary?'docs/PTVPRO-PHASE1-LEGACY25-BINARY-LOCAL-RESULTS.json':batch?'docs/PTVPRO-PHASE1-LEGACY-MIGRATION-LOCAL-RESULTS.json':'docs/PTVPRO-PHASE1-PROVISIONING-LOCAL-RESULTS.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:checks.length,cloudConnections:false,syntheticBatchSize:manifest.targets.length}));
}finally{
 const cleanup=created?query(`DROP DATABASE ${database}`,'postgres'):{status:0};
 if(run('pg_ctl.exe',['-D',cluster,'-m','fast','-w','stop'],{stdio:'ignore'}).status!==0||cleanup.status!==0){console.error('Local cleanup requires attention');process.exitCode=1;}
}
