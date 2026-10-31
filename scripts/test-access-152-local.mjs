import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';

const session154=process.argv.length===3&&process.argv[2]==='--session154';
if (process.argv.length !== 2&&!session154) throw new Error('No connection arguments accepted.');
const cluster='C:/Users/zidna/ptvpro/.gemini/scratch/bootstrap149-pg';
const bin='C:/Program Files/PostgreSQL/17/bin/';
const database=`access152_fixture_${Date.now()}`;
const env={...process.env,PGHOST:'127.0.0.1',PGHOSTADDR:'127.0.0.1',PGPORT:'55439',PGUSER:'postgres',PGDATABASE:database,
  PGPASSWORD:'',PGSERVICE:'',PGSERVICEFILE:'',PGOPTIONS:'',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
for(const key of ['PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGPASSFILE']) delete env[key];
const run=(command,args,options={})=>spawnSync(bin+command,args,{env,encoding:'utf8',windowsHide:true,timeout:60000,
  ...(command==='pg_ctl.exe'?{stdio:'ignore'}:{}),...options});
function sql(input,db=database,allowFailure=false) {
  const result=run('psql.exe',['-X','-h','127.0.0.1','-p','55439','-U','postgres','-v','ON_ERROR_STOP=1','-At','-d',db],{input});
  if(!allowFailure && result.status!==0) throw new Error(`Synthetic SQL failed: ${result.stderr}`);
  return result;
}
if(run('pg_ctl.exe',['-D',cluster,'status']).status===0) throw new Error('Existing server is not owned by this run.');
if(run('pg_ctl.exe',['-D',cluster,'-l','C:/Users/zidna/ptvpro/.gemini/scratch/access152-postgres.log','-o','-h 127.0.0.1 -p 55439 -c max_connections=20','-w','start']).status!==0) {
  run('pg_ctl.exe',['-D',cluster,'-m','fast','-w','stop']);
  throw new Error('Cannot start isolated fixture server.');
}
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const proposal=readFileSync('docs/PTVPRO-ACCESS-152-NATIVE-SESSION-PROPOSAL.sql','utf8');
try {
  sql(`CREATE DATABASE ${database};`,'postgres');
  sql(readFileSync('tests/fixtures/bootstrap149-local.sql','utf8'));
  check('synthetic marker checked',sql('SELECT marker FROM public.bootstrap149_test_fixture').stdout.trim()==='SYNTHETIC_ONLY');
  sql(readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',sql('SELECT system_identifier::text FROM pg_control_system()').stdout.trim()));
  sql(`CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);
    INSERT INTO auth.sessions VALUES('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',NULL);`);
  check('unapproved template refuses installation',sql(proposal,database,true).status!==0);
  const system=sql('SELECT system_identifier::text FROM pg_control_system()').stdout.trim();
  const rendered=proposal.replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system);
  sql(rendered); sql(rendered);
  check('proposal installs and repeats after Access149 preparation',true);
  const now=Math.floor(Date.now()/1000);
  const authorize=`SELECT ptv_access_private.authorize('00000000-0000-4000-8000-000000000002',${now-5},'crew.permissions.manage');`;
  check('trusted direct admin can validate an authorized actor',sql(authorize).status===0);
  check('locked actor cannot pass mutation authorization',sql(`BEGIN; UPDATE public.user_account SET lockout_until=now()+interval '1 hour'; ${authorize} ROLLBACK;`,database,true).status!==0);
  check('a service role claim alone cannot spoof a trusted server',sql(`SELECT set_config('request.jwt.claims','{"role":"service_role"}',false); ${authorize}`,database,true).status!==0);
  check('an actor without the required capability cannot pass mutation authorization',sql(`SELECT ptv_access_private.authorize('00000000-0000-4000-8000-000000000001',${now-5},'crew.permissions.manage');`,database,true).status!==0);
  const serverFixture=`BEGIN; GRANT USAGE ON SCHEMA ptv_access_private TO service_role;
    GRANT EXECUTE ON FUNCTION ptv_access_private.authorize(uuid,bigint,text) TO service_role; SET LOCAL ROLE service_role;`;
  check('trusted SQL service role with verified service claim authorizes correctly',sql(`${serverFixture}
    SELECT set_config('request.jwt.claims','{"role":"service_role"}',true); ${authorize} ROLLBACK;`).status===0);
  check('SQL service role without verified service claim is denied',sql(`${serverFixture}
    SELECT set_config('request.jwt.claims','{}',true); ${authorize} ROLLBACK;`,database,true).status!==0);
  const claims={sub:'20000000-0000-4000-8000-000000000001',session_id:'40000000-0000-4000-8000-000000000001',iat:now-5,exp:now+3600};
  function can(overrides={},cap='hub.access',before='') {
    const c={...claims,...overrides};
    return sql(`BEGIN; ${before} SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','${JSON.stringify(c)}',true);
      SELECT public.has_capability('${cap}'); ROLLBACK;`).stdout.split(/\r?\n/).includes('t');
  }
  check('valid native subject and stored session authorized',can());
  check('forged account_id and Root profile claims ignored',!can({account_id:'00000000-0000-4000-8000-000000000002',assigned_profiles:['root_executive']},'crew.permissions.manage'));
  for(const [name,patch] of Object.entries({expired:{exp:now-1},future:{iat:now+60},malformed:{iat:'invalid'},stringTimestamp:{iat:String(now-5)},fractionalTimestamp:{iat:now-5.5},missingSession:{session_id:null},foreignSession:{sub:'20000000-0000-4000-8000-000000000002'},invalidSubject:{sub:'not-uuid'}}))
    check(`denies ${name}`,!can(patch));
  check('locked account denied',!can({},'hub.access',`UPDATE public.user_account SET lockout_until=now()+interval '1 hour';`));
  check('disabled account denied',!can({},'hub.access',`UPDATE public.user_account SET status_akun='inactive';`));
  check('revoked cookie timestamp denied',!can({},'hub.access',`UPDATE public.user_account SET tokens_valid_after=now();`));
  check('native revoked session denied',!can({},'hub.access','DELETE FROM auth.sessions;'));
  check('native absolute session deadline denied even with unexpired JWT',!can({},'hub.access',`UPDATE auth.sessions SET not_after=now()-interval '1 second';`));
  check('deny wins over allow and profile',!can({},'hub.access',`INSERT INTO public.account_capability_overrides(account_id,capability_key,override_type) VALUES
    ('00000000-0000-4000-8000-000000000001','hub.access','allow'),('00000000-0000-4000-8000-000000000001','hub.access','deny');`));
  check('unknown capability denied',!can({},'unregistered.capability'));
  check('rollback restores session and access',can());
  check('anonymous EXECUTE closed',sql("SET ROLE anon; SELECT public.has_capability('hub.access');",database,true).status!==0);
  check('authenticated cannot read native session table',sql('SET ROLE authenticated; SELECT * FROM auth.sessions;',database,true).status!==0);
  check('account mutation remains closed without Root bootstrap',sql("SELECT has_function_privilege('service_role','public.rpc_manage_account_access(uuid,bigint,jsonb)','EXECUTE')").stdout.trim()==='f');
  const containment=readFileSync('docs/PTVPRO-ACCESS-152-SAFE-ROLLBACK.sql','utf8').replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',system);
  const counts=()=>sql('SELECT (SELECT count(*) FROM public.user_account),(SELECT count(*) FROM public.account_profiles),(SELECT count(*) FROM public.auth_audit_log)').stdout.trim();
  const before=counts(); sql(containment);
  check('safe rollback denies even valid native claims',!can());
  check('safe rollback preserves accounts, profiles and audit',counts()===before);
  sql(rendered);
  check('forward recovery restores only reviewed native access',can());
  const results={scope:'LOCAL POSTGRESQL17 SYNTHETIC ONLY',passed:checks.length,checks,cloudConnections:false,
    proposalSha256:createHash('sha256').update(proposal).digest('hex')};
  writeFileSync(session154?'docs/PTVPRO-DEV-154-ACCESS-SQL-RESULTS.json':'docs/PTVPRO-ACCESS-152-LOCAL-SQL-RESULTS.json',JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,syntheticOnly:true,cloudConnections:false}));
} finally {
  if(run('pg_ctl.exe',['-D',cluster,'-m','fast','-w','stop']).status!==0) { console.error('Fixture server shutdown needs attention.'); process.exitCode=1; }
}
