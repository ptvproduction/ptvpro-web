import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { URL, fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { enrollInactiveAccount, validateEnrollmentReview, STAGING_FINGERPRINT, enrollmentSurfaceSql } from './lib/private-enrollment.mjs';
import { readPlanRoleState, applyPlanRedaction, restorePlanRedaction } from './lib/legacy25-plan-redaction.mjs';

// The external-console PowerShell launcher supplies its packet through an anonymous stdin pipe.
if(process.argv.length!==3||process.argv[2]!=='--execute-reviewed-enrollment')throw new Error('Explicit reviewed enrollment mode required');
let client,admin,baseline,options;
const result={success:false,gateChanged:false,accountActivated:false,sessionIssued:false,privacyRestored:true,code:'BLOCKED'};
async function principal(db){
 const p=(await db.query("SELECT md5(system_identifier::text) AS fingerprint,session_user,current_user,coalesce(current_setting('role',true),'none') AS role,coalesce(current_setting('request.jwt.claims',true),'') AS claims FROM pg_control_system()")).rows[0];
 if(p.fingerprint!==STAGING_FINGERPRINT||p.session_user!=='postgres'||p.current_user!=='postgres'||!['none','postgres'].includes(p.role)||!['','{}'].includes(p.claims))throw new Error('Untrusted target');
}
async function verifyRestored(options,baseline){
 const db=new Client(options);
 try{
  await db.connect();await principal(db);const state=await readPlanRoleState(db);
  if(state.role_digest!==baseline.role_digest||state.effective_value!==baseline.effective_value||state.audit_digest!==baseline.audit_digest)throw new Error('Restore mismatch');
 }finally{await db.end().catch(()=>{});}
}
try{
 let input='';for await(const part of process.stdin){input+=part;if(input.length>131072)throw new Error('Input limit');}
 input=input.replace(/^\uFEFF/,'').trim();
 const p=JSON.parse(input);input='';
 if(p.manual_console_confirmed!==true||typeof p.database_password!=='string')throw new Error('Manual launcher required');
 validateEnrollmentReview(p.review,p.password);
 const ca=readFileSync(new URL('./certificates/supabase-prod-ca-2021.crt',import.meta.url));
 if(createHash('sha256').update(ca).digest('hex')!=='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7')throw new Error('Approved CA mismatch');
 options={host:'db.swadgljnyelsjstqqxbm.supabase.co',port:5432,database:'postgres',user:'postgres',password:p.database_password,options:'',
  ssl:{ca:ca.toString(),rejectUnauthorized:true},connectionTimeoutMillis:10000,query_timeout:60000};
 p.database_password='';
 admin=new Client(options);await admin.connect();await principal(admin);
 await admin.query("SET statement_timeout='30s'; SELECT pg_advisory_lock(149,2501)");
 if((await admin.query(enrollmentSurfaceSql)).rows[0]?.digest!==p.review.security_surface_sha256)throw new Error('Reviewed surface drift');
 const ready=(await admin.query("SELECT NOT EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive') AND EXISTS(SELECT FROM ptv_auth_private.policy WHERE singleton AND NOT enabled) AND NOT EXISTS(SELECT FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() AND state='active') AS ready")).rows[0]?.ready;
 if(ready!==true)throw new Error('Maintenance or prebootstrap state drift');
 baseline=await readPlanRoleState(admin);result.privacyRestored=false;
 await applyPlanRedaction(admin,baseline,async state=>{
  const env={...process.env};delete env.PSModulePath;
  const helper=fileURLToPath(new URL('./save-legacy25-role-state.ps1',import.meta.url));
  const saved=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',helper],{env,input:JSON.stringify({prefix:'phase1-private-enrollment-'+p.review.operation_id,run:randomUUID(),state:{...state,project_ref:'swadgljnyelsjstqqxbm',operation_id:p.review.operation_id}}),encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:4096});
  if(saved.status!==0||saved.stdout.trim()!=='ROLE_STATE_DPAPI_VERIFIED')throw new Error('Private role backup failed');
 });
 client=new Client(options);await client.connect();await principal(client);
 const enrolled=await enrollInactiveAccount(client,p.review,p.password);p.password='';
 result.success=enrolled.success;result.noOp=enrolled.noOp;result.receiptId=enrolled.receiptId;result.transactionId=enrolled.transactionId;result.code='PASS';
}catch(error){result.code=error.message?.startsWith('Enrollment outcome unknown')?'COMMIT_OUTCOME_UNKNOWN':'BLOCKED';}
finally{
 if(client)await client.end().catch(()=>{});
 if(baseline){
  try{
   await restorePlanRedaction(admin,baseline);
   await verifyRestored(options,baseline);
   result.privacyRestored=true;
  }catch{result.success=false;result.code='LOGGING_RESTORE_FAILED';}
 }
 if(admin)await admin.end().catch(()=>{});if(options)options.password='';
 process.exitCode=result.success&&result.privacyRestored?0:1;
 console.log(JSON.stringify(result));
}
