import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,URL} from 'node:url';
import {join} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {Client} from 'pg';
import {executeBinaryTransport,textSha} from './legacy25-binary-transport.mjs';
import {readPlanRoleState,applyPlanRedaction,restorePlanRedaction} from './legacy25-plan-redaction.mjs';

const guard=(v,code)=>{if(!v)throw new Error(code);};
async function principal(client){
 const p=(await client.query("SELECT md5(system_identifier::text) AS fingerprint,session_user,current_user,coalesce(current_setting('role',true),'none') AS role,coalesce(current_setting('request.jwt.claims',true),'') AS claims FROM pg_control_system()")).rows[0];
 guard(p.fingerprint==='72737c1de8ff53d24950c9d2b30bd42d'&&p.session_user==='postgres'&&p.current_user==='postgres'&&['none','postgres'].includes(p.role)&&['','{}'].includes(p.claims),'PHYSICAL_TARGET');
}

export async function runOperatorBinary({validateLegacy25Packet,core,securitySql}){
 let admin,client,baseline,options,descriptor,code='INPUT',attempted=false,committed=false;
 const result={status:'BLOCKED',code,rows:{canonical_identity:0,organization_membership:0,user_account:0,account_profiles:0,auth_audit_log:0},receiptId:null,transactionId:null,postflight:'NOT_RUN',root:'NOT_CHECKED',gate:'NOT_CHECKED',credentials:'NOT_CHECKED',privacyRestored:'NOT_CHANGED',privacyBackup:null};
 try{
  guard(process.argv.length===3&&process.argv[2]==='--operator-execute-approved-legacy25','MODE');
  descriptor=JSON.parse(readFileSync(new URL('../../docs/PTVPRO-PHASE1-LEGACY25-BINARY-PACKAGE.json',import.meta.url),'utf8'));
  guard(descriptor.version==='COPY_BINARY_V1'&&descriptor.executionApproved===true&&descriptor.approvedSqlSha256===descriptor.sqlSha256,'PENDING_NEW_HASH_ACC');
  let input='';for await(const chunk of process.stdin){input+=chunk;guard(input.length<262144,'INPUT_SIZE');}
  const p=JSON.parse(input);input='';
  const checkpoint=JSON.parse(readFileSync(new URL('../../docs/PTVPRO-PHASE1-LEGACY25-SOURCE-CHECKPOINT.json',import.meta.url),'utf8'));
  const m=validateLegacy25Packet(p,checkpoint,Date.now(),descriptor);
  const ca=readFileSync(new URL('../certificates/supabase-prod-ca-2021.crt',import.meta.url));
  guard(textSha(ca)==='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7','TLS_CA');
  options={host:'db.swadgljnyelsjstqqxbm.supabase.co',port:5432,database:'postgres',user:'postgres',password:p.database_password,options:'',application_name:'ptv-legacy25-copy-v1-'+descriptor.sqlSha256.slice(0,12),ssl:{ca:ca.toString(),rejectUnauthorized:true},connectionTimeoutMillis:10000,query_timeout:60000};p.database_password='';
  code='ADMIN_CONNECTION';admin=new Client(options);await admin.connect();await principal(admin);
  await admin.query("SET statement_timeout='30s'");await admin.query('SELECT pg_advisory_lock(149,2501)');
  code='ROLE_BASELINE';baseline=await readPlanRoleState(admin);result.privacyRestored=false;
  const run=randomUUID();
  const saveBaseline=async state=>{
   const env={...process.env};delete env.PSModulePath;
   const helper=fileURLToPath(new URL('../save-legacy25-role-state.ps1',import.meta.url));
   const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',helper],{env,input:JSON.stringify({prefix:descriptor.artifactPrefix,run,state:{...state,project_ref:'swadgljnyelsjstqqxbm',approved_sql_sha256:descriptor.sqlSha256}}),encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:4096});
   guard(r.status===0&&r.stdout.trim()==='ROLE_STATE_DPAPI_VERIFIED','ROLE_BASELINE_BACKUP');
   result.privacyBackup=join(p.private_root,descriptor.artifactPrefix+'.'+run+'.role-state.dpapi');
  };
  code='ROLE_PARAMETER_REDACTION';await applyPlanRedaction(admin,baseline,saveBaseline);
  code='PRIVATE_MIGRATION_CONNECTION';client=new Client(options);await client.connect();await principal(client);
  await client.query("SET statement_timeout='30s'");
  code='PREFLIGHT_SECURITY';const checks=(await client.query(securitySql,[core])).rows[0].checks;
  guard(Object.values(checks).every(v=>v===true),'PREFLIGHT_SECURITY');
  guard(Date.parse(m.expires_at)>Date.now()&&Date.now()-Date.parse(checkpoint.checkedAt)<900000,'EXPIRED_BEFORE_EXECUTION');
  code='BINARY_TRANSACTION';attempted=true;
  const transport=await executeBinaryTransport(client,p.sql,p.manifest);committed=transport.committed;p.sql='';p.manifest='';
  if(!committed){result.code='DB_'+transport.outcome.code+'_'+transport.outcome.stage;result.postflight='ROLLED_BACK';}
  else{
   const o=transport.outcome;result.rows=o.rows;result.receiptId=o.receiptId;result.transactionId=o.transactionId;result.root=o.root;result.gate=o.gate;result.credentials=o.credentials;
   code='VISIBLE_POSTFLIGHT';const r=await client.query(p.postflight),rr=Array.isArray(r)?r:[r];
   const flags=rr.flatMap(x=>x.rows||[]).map(x=>Object.values(x)[0]).find(x=>x&&typeof x==='object');
   guard(flags&&Object.values(flags).every(v=>v===true),'VISIBLE_POSTFLIGHT');
   result.status=o.noop?'NOOP_VERIFIED':'EXECUTED_VERIFIED';result.code='PASS';result.postflight='PASS';
  }
 }catch(e){
  if(client)await client.query('ROLLBACK').catch(()=>{});
  result.status=committed||e.commitOutcomeUnknown?'CONTAINMENT':'BLOCKED';
  const safe=['PHYSICAL_TARGET','PENDING_NEW_HASH_ACC','NEW_HASH_ACC_REQUIRED','MODE','INPUT_SIZE','PAYLOAD_HASH','PAYLOAD_ID_OR_EXPIRY','MANIFEST_BINDING','EXACT_25','DUPLICATE_TARGET','SOURCE_CHECKPOINT_STALE','SOURCE_DRIFT','INACTIVE_ONLY','POSTFLIGHT_BINDING','ROLE_BASELINE_BACKUP','PLAN_ROLE_STATE_UNSUPPORTED','PLAN_ROLE_DRIFT','PLAN_ROLE_APPLY_UNVERIFIED','TRANSPORT_LOG_CONTEXT','REVIEWED_TRIGGER_DRIFT','REVIEWED_SCHEMA_DRIFT','PRIVATE_STAGE_LAYOUT','TRANSPORT_COMMIT_OUTCOME_UNKNOWN','EXPIRED_BEFORE_EXECUTION','VISIBLE_POSTFLIGHT'];
  result.code=safe.includes(e.message)?e.message:code;
  if(e.commitOutcomeUnknown)result.rows=null;
 }finally{
  if(client)await client.end().catch(()=>{});
  if(baseline){
   try{
    guard(!!admin,'RESTORE_ADMIN_CONNECTION');
    await restorePlanRedaction(admin,baseline);
    const verification=new Client(options);
    try{await verification.connect();await principal(verification);const restored=await readPlanRoleState(verification);guard(restored.role_digest===baseline.role_digest&&restored.effective_value===baseline.effective_value&&restored.audit_digest===baseline.audit_digest,'RESTORE_VERIFY');}finally{await verification.end().catch(()=>{});}
    result.privacyRestored=true;
   }catch{result.privacyRestored=false;result.status='CONTAINMENT';result.code='LOGGING_RESTORE_FAILED';}
  }
  if(admin)await admin.end().catch(()=>{});if(options)options.password='';
  if(result.status==='BLOCKED'&&attempted&&!committed&&result.postflight!=='ROLLED_BACK')result.code+='__NO_COMMIT_SENT';
  process.exitCode=['EXECUTED_VERIFIED','NOOP_VERIFIED'].includes(result.status)?0:result.status==='CONTAINMENT'?2:1;
  console.log(JSON.stringify(result));
 }
}
