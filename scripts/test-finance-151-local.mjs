import process from 'node:process';
import console from 'node:console';
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { compareRestoreManifests } from './lib/restore-manifest-154.mjs';

const session154=process.argv.length===3&&process.argv[2]==='--session154';
if (process.argv.length !== 2 && !session154) throw new Error('This synthetic runner accepts no connection arguments.');
const bin='C:/Program Files/PostgreSQL/17/bin/';
const cluster='C:/Users/zidna/ptvpro/.gemini/scratch/finance151-admin-pg';
const database=`finance${session154?'154':'151'}_fixture_${Date.now()}`;
const env={...process.env,PGHOST:'127.0.0.1',PGHOSTADDR:'127.0.0.1',PGPORT:'55439',PGUSER:'postgres',PGDATABASE:database,PGPASSWORD:'',PGOPTIONS:'',PGSSLMODE:'disable'};
delete env.PGSERVICE; delete env.PGSERVICEFILE;
const args=['-X','--no-password','-h','127.0.0.1','-p','55439','-U','postgres','-qAt','-v','ON_ERROR_STOP=1'];
const checks=[];
function run(sql,db=database) {return spawnSync(bin+'psql.exe',[...args,'-d',db],{env:{...env,PGDATABASE:db},input:sql,encoding:'utf8',windowsHide:true,timeout:45000});}
function exec(sql,db=database) {const r=run(sql,db);if(r.status!==0)throw new Error(`Synthetic SQL failed: ${r.stderr}`);return r.stdout.trim();}
function assert(ok,label) {if(!ok)throw new Error(`Assertion failed: ${label}`);checks.push(label);}
function rejected(sql,label) {const r=run(sql);assert(r.status!==0&&!!r.stderr,label);}
function concurrent(sql) {return new Promise((resolve,reject)=>{const p=spawn(bin+'psql.exe',[...args,'-d',database],{env,windowsHide:true});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',status=>resolve({status,out,err}));p.stdin.end(sql);});}
const lit=v=>`'${String(v).replaceAll("'","''")}'`;
const json=v=>`${lit(JSON.stringify(v))}::jsonb`;
const aid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const iid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sub=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sid=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const pocket=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const category=n=>`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const semester='60000000-0000-4000-8000-000000000001';
const iat=Math.floor(Date.now()/1000);
const service=`SET ROLE service_role;SET request.jwt.claims='{"role":"service_role"}';`;
const native=(n,extra={})=>`SET ROLE authenticated;SET request.jwt.claims=${json({sub:sub(n),session_id:sid(n),iat,exp:iat+3600,...extra}).replace('::jsonb','')};`;
const call=(name,command,payload,n=1)=>`${service}SELECT public.${name}('${aid(n)}',${iat},${json(command)}${payload===undefined?'':','+json(payload)});`;
const command=(kind,amount,from=1,to=2)=>({version:2,idempotencyKey:randomUUID(),operation:kind,currency:'IDR',occurredOn:'2026-10-25',description:'SYNTHETIC ONLY',amountMinor:String(amount),...(kind==='transfer'?{}:{categoryId:category(kind==='income'?1:2)}),incoming:kind==='expense'?[]:[{pocketId:pocket(kind==='income'?from:to),amountMinor:String(amount)}],outgoing:kind==='income'?[]:[{pocketId:pocket(from),amountMinor:String(amount)}]});
const state=(db=database)=>exec("SELECT json_build_object('pockets',(SELECT json_agg(row_to_json(p) ORDER BY id) FROM public.ptv_finance_pockets p),'tx',(SELECT count(*) FROM public.ptv_finance_transactions),'alloc',(SELECT count(*) FROM public.ptv_finance_allocations),'kas',(SELECT json_agg(row_to_json(r) ORDER BY id) FROM public.ptv_finance_kas_records r),'kp',(SELECT count(*) FROM public.ptv_finance_kas_payments),'loans',(SELECT json_agg(row_to_json(l) ORDER BY id) FROM public.ptv_finance_loans l),'lp',(SELECT count(*) FROM public.ptv_finance_loan_payments),'audit',(SELECT count(*) FROM public.ptv_finance_audit_log));",db);
const kasPayload={semesterId:semester,ptvId:'PTV-903',crewName:'ignored synthetic label',periods:['2026-10'],method:'cash',pocketId:pocket(1)};
const proposalText=readFileSync('docs/PTVPRO-FINANCE-151-STAGING-PROPOSAL.sql','utf8');
if(spawnSync(bin+'pg_ctl.exe',['-D',cluster,'status'],{windowsHide:true,stdio:'ignore'}).status===0)throw new Error('Fixture server already running; do not control another process.');
if(spawnSync(bin+'pg_ctl.exe',['-D',cluster,'-l','C:/Users/zidna/ptvpro/.gemini/scratch/finance154-postgres.log','-o','-h 127.0.0.1 -p 55439 -c max_connections=20','-w','start'],{windowsHide:true,stdio:'ignore'}).status!==0)throw new Error('Local PostgreSQL clone unavailable; BLOCKED.');
try {
 exec(`CREATE DATABASE ${database};`,'postgres');
 exec("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;");
 exec(readFileSync('tests/fixtures/bootstrap149-local.sql','utf8'));
 exec(`CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);INSERT INTO auth.sessions SELECT ('70000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,NULL FROM generate_series(1,9)n;`);
 exec("CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;CREATE POLICY synthetic_broad_storage ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);GRANT USAGE ON SCHEMA storage TO anon,authenticated;GRANT ALL ON storage.objects TO anon,authenticated;INSERT INTO storage.objects(bucket_id,name) VALUES('finance-proofs','SYNTHETIC-PROOF'),('unrelated','SYNTHETIC-UNRELATED');");
 assert(exec('SELECT marker FROM public.bootstrap149_test_fixture')==='SYNTHETIC_ONLY','local synthetic marker verified before any mutation');
 const definitions=[];
 for(const path of ['docs/PTVPRO-FINANCE-CANONICAL-STAGING-MIGRATION.sql','docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql']) {
  for(const m of readFileSync(path,'utf8').matchAll(/CREATE TABLE IF NOT EXISTS public\.ptv_finance_\w+ \([\s\S]*?\n\);/g))definitions.push(m[0]);
 }
 assert(definitions.length===12,'12 actual Finance table definitions reused without business seeds');exec(definitions.join('\n'));
 const tableNames=definitions.map(sql=>sql.match(/public\.(ptv_finance_\w+)/)[1]);
 const dataDigestSql=tableNames.map(name=>`SELECT '${name}' AS table_name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'[]')) AS digest FROM public.${name} x`).join(' UNION ALL ')+' ORDER BY 1';
 exec(`INSERT INTO public.capability_registry VALUES('finance.view',false,false),('finance.manage',true,true),('finance.operator',false,false),('finance.view_own',false,false);
 INSERT INTO public.profile_capabilities VALUES('root_executive','finance.manage'),('eksekutif','finance.manage');
 UPDATE public.account_profiles SET profile_id='root_executive' WHERE account_id='${aid(1)}';
 UPDATE public.canonical_identity SET metadata='{"category":"Kru","finance_join_month":"2026-09"}';
 INSERT INTO public.ptv_finance_pockets(id,name,kind,balance_minor) VALUES('${pocket(1)}','Synthetic A','cash',1000000),('${pocket(2)}','Synthetic B','cash',0);
 INSERT INTO public.ptv_finance_categories(id,name,kind) VALUES('${category(1)}','Synthetic income','income'),('${category(2)}','Synthetic expense','expense');
 INSERT INTO public.ptv_finance_semesters(id,name,start_date,end_date,monthly_fee_minor,monthly_fees) VALUES('${semester}','Synthetic semester','2026-09-01','2027-02-28',1000,'{"2026-11":"1500"}');`);
 for(let n=4;n<=9;n++) exec(`INSERT INTO public.canonical_identity(id,ptv_id,full_name,metadata) VALUES('${iid(n)}','SYN-${n}','Synthetic ${n}','{"category":"${n===6?'Pembina':n===7?'Pengarah':'Kru'}","finance_join_month":"2026-09"}');
 INSERT INTO public.user_account(id,identity_id,auth_user_id,status_akun) VALUES('${aid(n)}','${iid(n)}','${sub(n)}','active');
 INSERT INTO public.organization_membership(id,identity_id,organization_id,position_title,status_organisasi,is_current) VALUES('${randomUUID()}','${iid(n)}','ptv_studio','${n===8?'Ketua':n===9?'Koordinator':'Kru'}','active',true);
 INSERT INTO public.account_profiles(account_id,profile_id) VALUES('${aid(n)}','crew');`);
 exec(`INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type) SELECT '${aid(5)}',cap,'allow' FROM unnest(ARRAY['hub.access','finance.manage'])cap;
 INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type) SELECT a, 'finance.manage','allow' FROM unnest(ARRAY['${aid(6)}'::uuid,'${aid(7)}'::uuid])a;
 CREATE SCHEMA ptv_finance_private;GRANT USAGE ON SCHEMA ptv_finance_private TO service_role;`);
 const old=readFileSync('docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql','utf8');
 const start=old.indexOf('CREATE OR REPLACE FUNCTION public.rpc_get_finance_loans_aggregate(');exec(old.slice(start,old.indexOf('$$;',start)+3));
 exec('GRANT EXECUTE ON FUNCTION public.rpc_get_finance_loans_aggregate() TO anon');
 assert(exec('SET ROLE anon;SELECT public.rpc_get_finance_loans_aggregate() IS NOT NULL')==='t','B01 old aggregate exposure reproduced with real anon role');
 exec('CREATE FUNCTION ptv_finance_private.synthetic_unreviewed_legacy151() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;GRANT EXECUTE ON FUNCTION ptv_finance_private.synthetic_unreviewed_legacy151() TO service_role');
 exec('CREATE FUNCTION ptv_finance_private.post_transaction(uuid,jsonb) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;GRANT EXECUTE ON FUNCTION ptv_finance_private.post_transaction(uuid,jsonb) TO service_role;CREATE FUNCTION public.rpc_post_finance_transaction_server(jsonb) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;GRANT EXECUTE ON FUNCTION public.rpc_post_finance_transaction_server(jsonb) TO service_role');
 const system=exec('SELECT system_identifier::text FROM pg_control_system()');
 const proposal=proposalText.replaceAll('__ACC_STAGING_PHYSICAL_SYSTEM_IDENTIFIER__',system);
 rejected(proposal,'Finance refuses to trust a permission store with direct write grants');
 exec(readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system));
 if(session154)exec(readFileSync('docs/PTVPRO-ACCESS-152-NATIVE-SESSION-PROPOSAL.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system));
 assert(exec("SELECT has_table_privilege('service_role','public.account_profiles','INSERT')")==='f','composed access149 preparation protects profile store');
 assert(exec("SELECT has_function_privilege('service_role','public.rpc_manage_account_access(uuid,bigint,jsonb)','EXECUTE')")==='f','access preparation keeps account mutation closed without Root bootstrap');
 rejected(proposalText,'unrendered proposal refuses execution');
 exec(proposal);exec(proposal);checks.push('hardening installs and repeats idempotently on actual PostgreSQL');
 const admin=(action,payload,n=1)=>`${service}SELECT public.rpc_finance_admin_mutation_server('${aid(n)}',${iat},${lit(action)},${json(payload)});`;
 const adminPocket={name:'Synthetic admin cash',kind:'cash',provider:'',accountNumber:'',accountHolder:''};
 const created=JSON.parse(exec(admin('create_pocket',{pocket:adminPocket}))).pocket;
 assert(created.version===1,'admin pocket created through authorized RPC');
 rejected(admin('update_pocket',{pocketId:created.id,expectedVersion:0,pocket:adminPocket}),'admin rejects stale pocket version');
 exec(admin('update_pocket',{pocketId:created.id,expectedVersion:1,pocket:{...adminPocket,name:'Updated synthetic cash'}}));
 exec(admin('archive_pocket',{pocketId:created.id,expectedVersion:2}));
 const cat=JSON.parse(exec(admin('create_category',{name:'Synthetic admin category',kind:'income'}))).category;
 exec(admin('update_category',{id:cat.id,name:'Updated synthetic category'}));
 exec(admin('archive_category',{id:cat.id}));exec(admin('restore_category',{id:cat.id}));
 assert(exec(`SELECT is_active AND NOT is_archived FROM public.ptv_finance_categories WHERE id='${cat.id}'`)==='t','admin category edit/archive/restore roundtrip');
 rejected(admin('create_pocket',{pocket:adminPocket},8),'admin read-only actor denied');
 rejected(`SET ROLE anon;SELECT public.rpc_finance_admin_mutation_server('${aid(1)}',${iat},'create_pocket','{}')`,'admin anon EXECUTE denied');
 const adminTx=JSON.parse(exec(call('rpc_post_finance_transaction_server',command('income',1))));
 const adminTxId=adminTx.transaction_id;
 exec(admin('update_transaction',{txId:adminTxId,updates:{description:'Edited synthetic metadata',notes:'synthetic'}}));
 rejected(admin('update_transaction',{txId:adminTxId,updates:{amountMinor:'999'}}),'admin metadata rejects balance edits');
 const adminBefore=state();
 exec("CREATE FUNCTION public.synthetic_admin_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit fault'; END $$; CREATE TRIGGER synthetic_admin_fault BEFORE INSERT ON public.ptv_finance_audit_log FOR EACH ROW EXECUTE FUNCTION public.synthetic_admin_audit_fault();");
 rejected(admin('create_pocket',{pocket:{...adminPocket,name:'Must roll back'}}),'admin audit failure aborts mutation');
 exec('DROP TRIGGER synthetic_admin_fault ON public.ptv_finance_audit_log; DROP FUNCTION public.synthetic_admin_audit_fault();');
 assert(state()===adminBefore,'admin audit fault leaves financial state unchanged');
 assert(exec("SELECT has_function_privilege('service_role','ptv_finance_private.synthetic_unreviewed_legacy151()','EXECUTE')")==='f','unreviewed legacy private functions are not reopened by broad service-role grants');
 assert(exec("SELECT has_function_privilege('service_role','ptv_finance_private.post_transaction(uuid,jsonb)','EXECUTE')")==='f','unknown private overload cannot inherit an approved function name grant');
 assert(exec("SELECT has_function_privilege('service_role','public.rpc_post_finance_transaction_server(jsonb)','EXECUTE') OR has_function_privilege('anon','public.rpc_post_finance_transaction_server(jsonb)','EXECUTE')")==='f','unknown public RPC overload is closed for service-role and anon');
 rejected('SET ROLE anon;SELECT public.rpc_get_finance_loans_aggregate()','B01 anon aggregate denied');
 assert(JSON.parse(exec(native(8)+"SELECT public.rpc_get_finance_loans_aggregate()")).total_principal_minor==='0','crew aggregate is scoped to own empty obligations');
 for(const n of [1,2,5])assert(exec(call('rpc_post_finance_transaction_server',command('income',1),undefined,n)).includes('transaction_id'),`Root/Eksekutif/delegated Bendahara account ${n} accepted by effective capability`);
 for(const n of [6,7,8,9])rejected(call('rpc_post_finance_transaction_server',command('income',1),undefined,n),`restricted category/title-only account ${n} denied`);
 for(const patch of ["status_akun='inactive'","tokens_valid_after=now()+interval '1 hour'","lockout_until=now()+interval '1 hour'"]){exec(`UPDATE public.user_account SET ${patch} WHERE id='${aid(2)}'`);rejected(call('rpc_post_finance_transaction_server',command('income',1),undefined,2),`live account guard: ${patch.split('=')[0]}`);exec(`UPDATE public.user_account SET status_akun='active',tokens_valid_after=NULL,lockout_until=NULL WHERE id='${aid(2)}'`);}
 exec(`INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type) VALUES('${aid(2)}','finance.manage','allow'),('${aid(2)}','finance.manage','deny')`);
 rejected(call('rpc_post_finance_transaction_server',command('income',1),undefined,2),'deny wins over profile and allow');exec(`DELETE FROM public.account_capability_overrides WHERE account_id='${aid(2)}'`);
 exec(`UPDATE public.organization_membership SET status_organisasi='inactive' WHERE identity_id='${iid(2)}'`);
 rejected(call('rpc_post_finance_transaction_server',command('income',1),undefined,2),'inactive membership denies an otherwise active executive');
 exec(`UPDATE public.organization_membership SET status_organisasi='active' WHERE identity_id='${iid(2)}';INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type) VALUES('${aid(2)}','hub.access','deny')`);
 rejected(call('rpc_post_finance_transaction_server',command('income',1),undefined,2),'hub.access deny blocks finance.manage grant');exec(`DELETE FROM public.account_capability_overrides WHERE account_id='${aid(2)}'`);
 rejected(`SET ROLE authenticated;SET request.jwt.claims='{"role":"service_role"}';SELECT public.rpc_post_finance_transaction_server('${aid(1)}',${iat},${json(command('income',1))})`,'forged claims cannot bypass EXECUTE ACL');
 const before=state();rejected(call('rpc_record_kas_kru_payment_atomic',command('income',100),{...kasPayload,ptvId:'SYNTHETIC-MISSING'}),'B02 unknown crew rejected');assert(state()===before,'unknown crew failure has no side effects');
 for(const periods of [['2026-10','2026-10'],['2027-03'],['2026-08'],['2026-13']])rejected(call('rpc_record_kas_kru_payment_atomic',command('income',100),{...kasPayload,periods}),'B02 invalid/duplicate/pre-join periods rejected');
 const first=command('income',100);const paid=JSON.parse(exec(call('rpc_record_kas_kru_payment_atomic',first,kasPayload)));const firstTx=paid.transaction.transaction_id;
 assert(exec("SELECT amount_minor||':'||paid_amount_minor||':'||status FROM public.ptv_finance_kas_records WHERE period='2026-10'")==='1000:100:sebagian','B02 partial installment keeps semester tariff and partial status');
 assert(exec('SELECT count(*) FROM public.ptv_finance_kas_payments')==='1','B02 installment detail inserted');
 const replayBefore=state();exec(call('rpc_record_kas_kru_payment_atomic',first,kasPayload));assert(state()===replayBefore,'Kas retry exactly once');
 rejected(call('rpc_record_kas_kru_payment_atomic',first,{...kasPayload,notes:'different metadata'}),'Kas replay with different metadata rejected');
 const multi=command('income',400);const multiResult=JSON.parse(exec(call('rpc_record_kas_kru_payment_atomic',multi,{...kasPayload,periods:['2026-10','2026-11']})));
 assert(exec("SELECT amount_minor FROM public.ptv_finance_kas_records WHERE period='2026-11'")==='1500','per-month tariff honored');
 const reverse=(tx)=>`${service}SELECT public.rpc_void_finance_transaction_atomic('${aid(1)}',${iat},'${tx}','SYNTHETIC reversal');`;
 exec(reverse(multiResult.transaction.transaction_id));
 assert(exec("SELECT string_agg(period||':'||paid_amount_minor,',' ORDER BY period) FROM public.ptv_finance_kas_records")==='2026-10:100,2026-11:0','B03 one multi-period transaction reverses all related records, keeps earlier installment');
 assert(exec("SELECT transaction_id FROM public.ptv_finance_kas_records WHERE period='2026-10'")===firstTx,'Kas record pointer returns to last effective installment');
 assert(exec('SELECT count(*) FROM public.ptv_finance_kas_payments')==='3','B03 Kas history retained');const revBefore=state();exec(reverse(multiResult.transaction.transaction_id));assert(state()===revBefore,'reversal retry is exactly once');
 const loanCmd=command('expense',500);const loanPayload={borrowerType:'kru',borrowerId:'PTV-903',borrowerName:'SYNTHETIC BORROWER',borrowerContact:'SYNTHETIC',principalMinor:'500',interestType:'none',interestRatePercent:0,interestMinor:'0',totalDueMinor:'500',disbursedOn:'2026-10-25',dueDate:'2026-11-25',disbursedFromPocketId:pocket(1),purpose:'SYNTHETIC ONLY'};
 const loanResult=JSON.parse(exec(call('rpc_disburse_loan_atomic',loanCmd,loanPayload)));const loanId=loanResult.loan_id;
 const invalidContractState=state();
 rejected(call('rpc_disburse_loan_atomic',command('expense',500),{...loanPayload,principalMinor:'600'}),'loan ledger amount must match contract principal');
 assert(state()===invalidContractState,'mismatched loan contract has no partial ledger mutation');
 rejected(call('rpc_disburse_loan_atomic',command('expense',500),{...loanPayload,borrowerName:'S'.repeat(121)}),'post-ledger loan insert constraint fault rejects operation');
 assert(state()===invalidContractState,'late loan-detail failure rolls back posting, balance and audit');
 const interestResult=JSON.parse(exec(call('rpc_disburse_loan_atomic',command('expense',500),{...loanPayload,borrowerType:'eksternal',borrowerId:null,interestType:'flat',interestRatePercent:1,interestMinor:'5',totalDueMinor:'505'})));
 assert(exec(`SELECT interest_minor||':'||total_due_minor FROM public.ptv_finance_loans WHERE id='${interestResult.loan_id}'`)==='5:505','optional flat interest computed in database and bound to contract');
 rejected(call('rpc_post_finance_transaction_server',{...command('expense',1),operation:'reimburse_pay'}),'unsupported reimburse cannot post a partial fake expense');
 rejected(call('rpc_disburse_loan_atomic',loanCmd,{...loanPayload,borrowerId:'SYN-4'}),'B04 disbursement replay cannot retarget borrower');
 const repay=command('income',500);const repayPayload={loanId,paidOn:'2026-10-25',amountMinor:'500',toPocketId:pocket(1),method:'cash'};
 const repayment=JSON.parse(exec(call('rpc_record_loan_payment_atomic',repay,repayPayload)));const fullState=state();exec(call('rpc_record_loan_payment_atomic',repay,repayPayload));assert(state()===fullState,'B04 full repayment retry recognized before paid-off checks');
 rejected(call('rpc_record_loan_payment_atomic',repay,{...repayPayload,notes:'changed'}),'B04 payment metadata conflict rejected');
 exec(reverse(repayment.transaction.transaction_id));assert(exec(`SELECT remaining_minor FROM public.ptv_finance_loans WHERE id='${loanId}'`)==='500','B03 reversal restores receivable balance');
 assert(exec(`SELECT count(*)||':'||min(status) FROM public.ptv_finance_loan_payments WHERE loan_id='${loanId}'`)==='1:reversed','B03 loan installment preserved with reversal marker');
 const paymentRace=await Promise.all([concurrent(call('rpc_record_loan_payment_atomic',command('income',400),{...repayPayload,amountMinor:'400'})),concurrent(call('rpc_record_loan_payment_atomic',command('income',400),{...repayPayload,amountMinor:'400'}))]);
 assert(paymentRace.filter(r=>r.status===0).length===1,'two concurrent repayments cannot overpay');assert(exec(`SELECT remaining_minor FROM public.ptv_finance_loans WHERE id='${loanId}'`)==='100','concurrent repayment leaves correct remaining');
 const kasRace=await Promise.all([concurrent(call('rpc_record_kas_kru_payment_atomic',command('income',900),{...kasPayload,periods:['2026-12']})),concurrent(call('rpc_record_kas_kru_payment_atomic',command('income',900),{...kasPayload,periods:['2026-12']}))]);
 assert(kasRace.filter(r=>r.status===0).length===1,'concurrent Kas installments cannot overpay or duplicate a period');
 const repeated=command('income',10);const repeatBefore=Number(exec('SELECT count(*) FROM public.ptv_finance_transactions'));const duplicateRace=await Promise.all([concurrent(call('rpc_post_finance_transaction_server',repeated)),concurrent(call('rpc_post_finance_transaction_server',repeated))]);
 assert(duplicateRace.every(r=>r.status===0)&&Number(exec('SELECT count(*) FROM public.ptv_finance_transactions'))===repeatBefore+1,'two concurrent identical keys commit exactly one transaction');
 rejected(call('rpc_post_finance_transaction_server',repeated,undefined,2),'idempotency key cannot be replayed by a different actor');
 const available=Number(exec(`SELECT balance_minor FROM public.ptv_finance_pockets WHERE id='${pocket(1)}'`));const debit=Math.floor(available*0.75);
 const spending=await Promise.all([concurrent(call('rpc_post_finance_transaction_server',command('expense',debit))),concurrent(call('rpc_post_finance_transaction_server',command('expense',debit)))]);
 assert(spending.filter(r=>r.status===0).length===1,'concurrent spending cannot make balance negative');
 rejected(call('rpc_post_finance_transaction_server',command('expense',100000000)),'insufficient balance rejected');
 exec("CREATE FUNCTION public.synthetic_fail_audit151() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC AUDIT FAILURE'; END $$;CREATE TRIGGER synthetic_fail_audit151 BEFORE INSERT ON public.ptv_finance_audit_log FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_audit151();");
 const failureState=state();rejected(call('rpc_post_finance_transaction_server',command('transfer',1)),'transfer audit fault rejects whole transaction');assert(state()===failureState,'transfer rollback includes pockets/allocations/header/audit');
 rejected(call('rpc_record_kas_kru_payment_atomic',command('income',1),kasPayload),'Kas audit fault rejects whole operation');assert(state()===failureState,'Kas audit fault rolls back obligation and ledger');
 rejected(reverse(firstTx),'reversal audit failure rejects the operation');assert(state()===failureState,'reversal audit failure restores balance, payment markers and obligation');
 exec('DROP TRIGGER synthetic_fail_audit151 ON public.ptv_finance_audit_log;DROP FUNCTION public.synthetic_fail_audit151();');
 exec(`CREATE FUNCTION public.synthetic_mid_transfer151() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${pocket(1)}' AND NEW.balance_minor<OLD.balance_minor THEN RAISE EXCEPTION 'SYNTHETIC MID TRANSFER'; END IF;RETURN NEW;END $$;CREATE TRIGGER synthetic_mid_transfer151 BEFORE UPDATE ON public.ptv_finance_pockets FOR EACH ROW EXECUTE FUNCTION public.synthetic_mid_transfer151();`);
 const midState=state();rejected(call('rpc_post_finance_transaction_server',command('transfer',1)),'injected debit fault after destination credit rejects transfer');assert(state()===midState,'mid-transfer failure rolls back earlier destination credit');
 exec('DROP TRIGGER synthetic_mid_transfer151 ON public.ptv_finance_pockets;DROP FUNCTION public.synthetic_mid_transfer151();');
 const transfer=command('transfer',2);exec(call('rpc_post_finance_transaction_server',transfer));assert(exec(`SELECT sum(CASE WHEN direction='in' THEN amount_minor ELSE -amount_minor END) FROM public.ptv_finance_allocations WHERE transaction_id=(SELECT id FROM public.ptv_finance_transactions WHERE idempotency_key='${transfer.idempotencyKey}')`)==='0','internal transfer is net zero');
 assert(exec(native(3)+`SELECT count(*) FROM public.ptv_finance_loans WHERE id='${loanId}'`)==='1','borrower reads own loan through RLS');
 assert(exec(native(4)+`SELECT count(*) FROM public.ptv_finance_loans WHERE id='${loanId}'`)==='0','other crew cannot read loan through RLS');
 exec(`INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type) VALUES('${aid(4)}','finance.view','allow')`);
 const classified=JSON.parse(exec(call('rpc_post_finance_transaction_server',command('income',1)))).transaction_id;
 assert(exec(native(4)+`SELECT count(*) FROM public.ptv_finance_transactions WHERE id='${classified}'`)==='1','global viewer retains classified general transactions');
 exec(`UPDATE public.ptv_finance_transactions SET operational_envelope=NULL WHERE id='${classified}'`);
 assert(exec(native(4)+`SELECT count(*) FROM public.ptv_finance_transactions WHERE id='${classified}'`)==='0','unclassified historical free text is manager-only, never guessed public');
 assert(exec(native(1)+`SELECT count(*) FROM public.ptv_finance_transactions WHERE id='${classified}'`)==='1','manager retains complete unclassified financial history');
 assert(exec(native(4)+`SELECT count(*) FROM public.ptv_finance_transactions WHERE id='${loanResult.transaction.transaction_id}'`)==='0','global reader cannot read another borrower canonical description');
 assert(exec(native(4)+`SELECT count(*) FROM public.ptv_finance_allocations WHERE transaction_id='${loanResult.transaction.transaction_id}'`)==='0','allocations respect loan privacy');
 exec('GRANT UPDATE ON public.ptv_finance_loans TO authenticated;CREATE POLICY synthetic_broad_loan_update151 ON public.ptv_finance_loans FOR UPDATE TO authenticated USING(true) WITH CHECK(true)');
 const nativeWriteState=state();assert(exec(native(3)+`UPDATE public.ptv_finance_loans SET status='dibatalkan' WHERE id='${loanId}' RETURNING id`)==='','restrictive RLS survives accidental broad UPDATE grant and permissive policy');
 assert(state()===nativeWriteState,'native direct-write bypass leaves financial data unchanged');
 exec('REVOKE UPDATE ON public.ptv_finance_loans FROM authenticated;DROP POLICY synthetic_broad_loan_update151 ON public.ptv_finance_loans');
 exec(`INSERT INTO public.ptv_finance_source_references(transaction_id,source_table,source_id) VALUES('${loanResult.transaction.transaction_id}','ptv_pengeluaran','${randomUUID()}')`);
 assert(exec(native(4)+`SELECT count(*) FROM public.ptv_finance_source_references WHERE transaction_id='${loanResult.transaction.transaction_id}'`)==='0','source references respect loan privacy');
 const allowed=exec(`${service}SELECT public.rpc_finance_visible_transactions_server('${aid(4)}',${iat},ARRAY['${loanResult.transaction.transaction_id}'::uuid])`);
 assert(JSON.parse(allowed).visibleTransactionIds.length===0,'cookie backend scope RPC excludes another borrower');
 assert(exec(native(4)+"SELECT count(*) FROM storage.objects WHERE bucket_id='finance-proofs'")==='0','Storage metadata RLS does not leak finance proofs to global reader');
 assert(exec(native(1)+"SELECT count(*) FROM storage.objects WHERE bucket_id='finance-proofs'")==='1','Storage metadata manager access retained');
 assert(exec('SET ROLE anon;SELECT count(*) FROM storage.objects')==='1','Storage guard preserves unrelated buckets and excludes finance proofs');
 assert(exec(native(4,{account_id:aid(1)})+"SELECT public.finance_can_native('finance.manage')")==='f','native subject cannot be replaced by account_id claim');
 assert(exec(native(1,{exp:iat-1})+"SELECT public.finance_can_native('finance.manage')")==='f','expired native session denied');
 assert(exec(native(1,{iat:iat+100})+"SELECT public.finance_can_native('finance.manage')")==='f','future native session denied');
 assert(exec(native(1,{exp:'Infinity'})+"SELECT public.finance_can_native('finance.manage')")==='f','non-numeric native expiry denied');
 assert(exec(native(1,{session_id:sid(2)})+"SELECT public.finance_can_native('finance.manage')")==='f','native session must belong to authenticated subject');
 assert(exec(native(1,{session_id:null})+"SELECT public.finance_can_native('finance.manage')")==='f','missing native session identifier denied');
 exec(`DELETE FROM auth.sessions WHERE id='${sid(1)}'`);
 assert(exec(native(1)+"SELECT public.finance_can_native('finance.manage')")==='f','native sign-out session revocation denies otherwise valid JWT');
 exec(`INSERT INTO auth.sessions VALUES('${sid(1)}','${sub(1)}',NULL)`);
 if(session154) {
  const parity=(extra={},before='')=>JSON.parse(exec(`BEGIN;${before}${native(1,extra)}
   SELECT json_build_object('finance',public.finance_can_native('finance.manage'),'access',public.has_capability('finance.manage'));ROLLBACK;`));
  const cases=[
   ['valid unbounded native session',{},'',true],
   ['future absolute deadline',{},`UPDATE auth.sessions SET not_after=now()+interval '1 hour' WHERE id='${sid(1)}';`,true],
   ['elapsed absolute deadline',{},`UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id='${sid(1)}';`,false],
   ['exact absolute deadline',{},`UPDATE auth.sessions SET not_after=now() WHERE id='${sid(1)}';`,false],
   ['expired JWT',{exp:iat-1},'',false],
   ['future JWT',{iat:iat+3600},'',false],
   ['string timestamps',{iat:String(iat),exp:String(iat+3600)},'',false],
   ['fractional timestamps',{iat:iat-0.5},'',false],
   ['malformed timestamp',{iat:'invalid'},'',false],
   ['revoked stored session',{},`DELETE FROM auth.sessions WHERE id='${sid(1)}';`,false],
   ['foreign stored session',{session_id:sid(2)},'',false],
   ['missing stored session',{session_id:null},'',false],
   ['locked actor',{},`UPDATE user_account SET lockout_until=now()+interval '1 hour' WHERE id='${aid(1)}';`,false],
   ['account cutoff',{},`UPDATE user_account SET tokens_valid_after=now()+interval '1 hour' WHERE id='${aid(1)}';`,false],
   ['deadline plus forged service claim',{role:'service_role'},`UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id='${sid(1)}';`,false],
  ];
  for(const [name,extra,before,expected] of cases) {
   const result=parity(extra,before);
   assert(result.finance===expected&&result.access===expected,`154 Finance/Access parity: ${name}`);
  }
  const expiredRls=JSON.parse(exec(`BEGIN; UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id='${sid(1)}';${native(1)}
   SELECT json_build_object('pockets',(SELECT count(*) FROM public.ptv_finance_pockets),
    'transactions',(SELECT count(*) FROM public.ptv_finance_transactions),'semesters',(SELECT count(*) FROM public.ptv_finance_semesters),
    'settings',(SELECT count(*) FROM public.ptv_finance_settings),'proofs',(SELECT count(*) FROM storage.objects WHERE bucket_id='finance-proofs'));ROLLBACK;`));
  assert(Object.values(expiredRls).every(n=>n===0),'154 expired absolute deadline denies real RLS reads and proof metadata');
  assert(exec(`BEGIN;UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id='${sid(3)}';${native(3)}
   SELECT count(*) FROM public.ptv_finance_loans WHERE id='${loanId}';ROLLBACK;`)==='0','154 borrower ownership does not bypass elapsed native deadline');
  rejected(`BEGIN; UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id='${sid(1)}';${native(1)}SELECT public.rpc_get_finance_loans_aggregate();ROLLBACK;`,'154 native aggregate rejects elapsed deadline');
  const spoofCalls=[call('rpc_post_finance_transaction_server',command('income',1)),
   call('rpc_record_kas_kru_payment_atomic',command('income',1),kasPayload),
   call('rpc_disburse_loan_atomic',command('expense',500),loanPayload),
   call('rpc_record_loan_payment_atomic',command('income',1),{...repayPayload,amountMinor:'1'}),
   reverse(firstTx),`${service}SELECT public.rpc_reverse_operational_record_atomic('${aid(1)}',${iat},'kas_payment','${randomUUID()}','SYNTHETIC');`,
   `${service}SELECT public.rpc_finance_visible_transactions_server('${aid(1)}',${iat},ARRAY[]::uuid[]);`];
  const spoofState=state();
  for(const [index,sql] of spoofCalls.entries()) {
   // Only inside the rollback fixture: reach each private authorization gate even if ACLs regress.
   const result=run(`BEGIN;GRANT USAGE ON SCHEMA ptv_finance_private TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ptv_finance_private TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
    ${sql.replace(service,`SET ROLE authenticated;SET request.jwt.claims='{"role":"service_role"}';`)}ROLLBACK;`);
   assert(result.status!==0&&/server-only finance authorization required/.test(result.stderr),`154 sensitive RPC ${index+1} rejects forged service claim even after simulated ACL regression`);
  }
  assert(state()===spoofState,'154 rejected spoof attempts preserve balances, transactions and audit');
 }
 rejected(`SET ROLE service_role;INSERT INTO public.ptv_finance_loans DEFAULT VALUES`,'direct service-role DML denied');
 rejected('UPDATE public.ptv_finance_audit_log SET action=action','audit rows cannot be rewritten');
 rejected('TRUNCATE public.ptv_finance_audit_log','audit cannot be truncated even by accidental administrative SQL');
 const beforeRollback=state();exec('BEGIN;'+call('rpc_post_finance_transaction_server',command('income',2))+'ROLLBACK;');assert(state()===beforeRollback,'explicit transaction rollback leaves full state unchanged');
 const dump=`C:/Users/zidna/ptvpro/.gemini/scratch/${database}.dump`;
 const dumped=spawnSync(bin+'pg_dump.exe',['-h','127.0.0.1','-p','55439','-U','postgres','-d',database,'-Fc','--no-owner','-f',dump],{env,encoding:'utf8',windowsHide:true});assert(dumped.status===0,'synthetic consistent pg_dump backup succeeds');
 const restored=database+'_restore';exec(`CREATE DATABASE ${restored}`,'postgres');const rr=spawnSync(bin+'pg_restore.exe',['-h','127.0.0.1','-p','55439','-U','postgres','--no-owner','--exit-on-error','-d',restored,dump],{env,encoding:'utf8',windowsHide:true});assert(rr.status===0,'synthetic backup restores functions/policies/grants/data');
 assert(exec('SELECT count(*) FROM public.ptv_finance_loan_payments',restored)===exec('SELECT count(*) FROM public.ptv_finance_loan_payments'),'recovery retains installment history');
 assert(exec("SELECT has_function_privilege('anon','public.rpc_get_finance_loans_aggregate()','EXECUTE')",restored)==='f','recovery does not reopen public aggregate');
 assert(exec("SELECT has_table_privilege('service_role','public.ptv_finance_loans','INSERT')",restored)==='f','recovery preserves direct-write restrictions');
 assert(state(restored)===state(),'restored financial state matches consistent backup snapshot');
 assert(exec(dataDigestSql,restored)===exec(dataDigestSql),'all columns and rows in all 12 Finance tables match restored backup digests');
 if(session154) {
  const restoreChecks=readFileSync('docs/PTVPRO-DEV-154-RESTORE-CHECKS.sql','utf8');
  const originalManifest=JSON.parse(exec(restoreChecks)),restoredManifest=JSON.parse(exec(restoreChecks,restored));
  const comparison=compareRestoreManifests(originalManifest,restoredManifest);
  const changed=comparison.changedSections;
  if(changed.length) {
   writeFileSync(`.gemini/scratch/${database}-manifest-diff.json`,JSON.stringify({syntheticOnly:true,changed,originalManifest,restoredManifest},null,2),{flag:'wx'});
  }
  assert(changed.length===0,`154 reproducible restore manifest matches all 23 table digests and schema/ACL/RLS/function/trigger/role metadata on synthetic restore; changed=${changed.join(',')}`);
  assert(comparison.reviewedCastReformats>0,'154 PostgreSQL varchar-array cast reformat explicitly reviewed without ignoring constraint values or security metadata');
 }
 const rollback=readFileSync('docs/PTVPRO-FINANCE-151-SAFE-ROLLBACK.sql','utf8').replaceAll('__ACC_STAGING_PHYSICAL_SYSTEM_IDENTIFIER__',system);
 const rollbackState=state(restored);exec(rollback,restored);assert(state(restored)===rollbackState,'safe rollback preserves balances and all financial history');
 assert(exec("SELECT has_function_privilege('service_role','public.rpc_post_finance_transaction_server(uuid,bigint,jsonb)','EXECUTE')",restored)==='f','safe rollback closes financial writers');
 assert(exec(native(4)+`SELECT count(*) FROM public.ptv_finance_loans WHERE id='${loanId}'`,restored)==='0','safe rollback keeps privacy RLS');
 exec(proposal,restored);assert(state(restored)===rollbackState,'reviewed forward recovery restores hardened functions/grants without rewriting financial data');
 console.log(`Local Finance checks passed: ${checks.length}`);
} finally {
 const stopped=spawnSync(bin+'pg_ctl.exe',['-D',cluster,'-m','fast','-w','stop'],{stdio:'ignore',windowsHide:true});if(stopped.status!==0) { console.error('Fixture server could not be stopped.'); process.exitCode=1; }
}
writeFileSync(session154?'docs/PTVPRO-FINANCE-151-ADMIN-154-SQL-RESULTS.json':'docs/PTVPRO-FINANCE-151-ADMIN-LOCAL-SQL-RESULTS.json',JSON.stringify({scope:'LOCAL POSTGRESQL 17 SYNTHETIC FIXTURE ONLY',cloudConnections:false,serverStopped:true,proposalSha256:createHash('sha256').update(proposalText).digest('hex'),accessPreparationSha256:createHash('sha256').update(readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql')).digest('hex'),...(session154?{access152Sha256:createHash('sha256').update(readFileSync('docs/PTVPRO-ACCESS-152-NATIVE-SESSION-PROPOSAL.sql')).digest('hex'),restoreChecksSha256:createHash('sha256').update(readFileSync('docs/PTVPRO-DEV-154-RESTORE-CHECKS.sql')).digest('hex'),restoreComparatorSha256:createHash('sha256').update(readFileSync('scripts/lib/restore-manifest-154.mjs')).digest('hex')}:{}),passed:checks.length,checks},null,2)+'\n');
