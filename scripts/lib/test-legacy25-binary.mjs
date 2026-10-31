import {Client} from 'pg';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {from as copyFrom} from 'pg-copy-streams';
import {renderReviewedLegacyPayload} from './legacy-account-migration.mjs';
import {buildBinaryTransportSql,textSha,triggerDigestSql,surfaceDigestSql,executeBinaryTransport,splitBinarySql,binaryCopyFrame,privateStageSql} from './legacy25-binary-transport.mjs';
import {readPlanRoleState,applyPlanRedaction,restorePlanRedaction} from './legacy25-plan-redaction.mjs';

export async function testLegacy25Binary({manifest,template,system,sql,snapshot,checks,logPath}){
 const check=(label,value)=>{if(!value)throw new Error('BINARY_TEST_FAILED: '+label);checks.push(label);};
 const baselineTables=['public.access_profile','public.account_capability_overrides','public.account_profiles','public.auth_audit_log','public.auth_credentials','public.canonical_identity','public.capability_registry','public.legacy_archive_kru','public.organization_membership','public.profile_capabilities','public.user_account'];
 const clients=[];
 const connect=async()=>{const c=new Client({host:'127.0.0.1',port:55439,user:'postgres',database:sql('SELECT current_database()'),password:'',ssl:false});await c.connect();clients.push(c);return c;};
 sql('CREATE EXTENSION pg_stat_statements');
 const c=await connect();
 try{
  const control='SYNTHETIC_PREPARED_LEAK_'+randomUUID();let rejected=false;
  try{await c.query('SELECT $1::integer',[control]);}catch{rejected=true;}
  check('ordinary prepared parameter can leak through primary error/logging',rejected&&readFileSync(logPath,'utf8').includes(control));
  const binaryControl='SYNTHETIC_BINARY_BIND_LEAK_'+randomUUID();rejected=false;
  try{await c.query("SELECT convert_from($1::bytea,'UTF8')::integer",[Buffer.from(binaryControl)]);}catch{rejected=true;}
  check('binary prepared parameter alone can also leak via primary error',rejected&&readFileSync(logPath,'utf8').includes(binaryControl));
  for(const t of manifest.targets){t.canonical_full_name="BINARY_PRIVATE_NAME_"+randomUUID()+" O'Reilly";t.username='binary_private_'+randomUUID().slice(0,8)+'_'+t.ptv_id.slice(4);}
  const markers=manifest.targets.flatMap(t=>[t.canonical_full_name.split(' ')[0],t.username]);
  const build=(m=manifest,raw=JSON.stringify(m,null,2))=>({raw,sql:buildBinaryTransportSql(renderReviewedLegacyPayload(template,m,system),{manifestSha:textSha(raw),triggerDigest:sql(triggerDigestSql),surfaceDigest:sql(surfaceDigestSql),baselineTables})});
  const before=snapshot(),offset=readFileSync(logPath,'utf8').length;
  let p=build();
  check('new SQL contains no personnel names or usernames',markers.every(v=>!p.sql.includes(v)));
  const r1=await executeBinaryTransport(c,p.sql,p.raw+' ');
  check('changed input checksum rejected without raw error',!r1.committed&&!r1.outcome.ok&&r1.outcome.stage==='INPUT');
  check('checksum rejection preserves baseline',snapshot()===before);
  const malformed='{ "private": "'+markers[0]+'", broken }';p=build(manifest,malformed);
  const r2=await executeBinaryTransport(c,p.sql,p.raw);
  check('invalid JSON primary error captured and redacted',!r2.committed&&r2.outcome.code==='22P02');
  check('JSON rejection preserves baseline',snapshot()===before);
  const invalid=Buffer.concat([Buffer.from([255]),Buffer.from(markers[0])]);p=build(manifest,invalid);
  const r3=await executeBinaryTransport(c,p.sql,p.raw);
  check('invalid UTF8 error captured and redacted',!r3.committed&&!r3.outcome.ok);
  sql('ALTER TABLE public.canonical_identity ADD CONSTRAINT binary_name_short CHECK(length(full_name)<4) NOT VALID');
  p=build();const r4=await executeBinaryTransport(c,p.sql,p.raw);
  check('CHECK violation with failing-row DETAIL rolls back atomically',!r4.committed&&r4.outcome.code==='23514'&&snapshot()===before);
  sql('ALTER TABLE public.canonical_identity DROP CONSTRAINT binary_name_short');
  sql("CREATE FUNCTION public.binary_partial_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT count(*) FROM public.canonical_identity WHERE full_name LIKE 'BINARY_PRIVATE_NAME_%')>10 THEN RAISE EXCEPTION '%',NEW.username USING DETAIL=NEW.username; END IF; RETURN NEW; END $$; CREATE TRIGGER binary_partial_fail BEFORE INSERT ON public.user_account FOR EACH ROW EXECUTE FUNCTION public.binary_partial_fail()");
  p=build();const r5=await executeBinaryTransport(c,p.sql,p.raw);
  check('trigger primary MESSAGE and DETAIL redacted after partial writes',!r5.committed&&r5.outcome.code==='P0001');
  check('partial writes fully rolled back',snapshot()===before);
  sql('DROP TRIGGER binary_partial_fail ON public.user_account; DROP FUNCTION public.binary_partial_fail()');
  sql("CREATE FUNCTION public.binary_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE private_name text; BEGIN SELECT full_name INTO private_name FROM public.canonical_identity WHERE full_name LIKE 'BINARY_PRIVATE_NAME_%' LIMIT 1; RAISE EXCEPTION '%',private_name USING DETAIL=private_name; END $$; CREATE TRIGGER binary_audit_fail BEFORE INSERT ON public.auth_audit_log FOR EACH ROW EXECUTE FUNCTION public.binary_audit_fail()");
  p=build();const r6=await executeBinaryTransport(c,p.sql,p.raw);
  check('audit failure preserves atomicity and redacts error',!r6.committed&&snapshot()===before);
  sql('DROP TRIGGER binary_audit_fail ON public.auth_audit_log; DROP FUNCTION public.binary_audit_fail()');
  p=build();
  sql("CREATE FUNCTION public.binary_logging_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE WARNING '%',NEW.full_name; RETURN NEW; END $$; CREATE TRIGGER binary_logging_trigger BEFORE INSERT ON public.canonical_identity FOR EACH ROW EXECUTE FUNCTION public.binary_logging_trigger()");
  let code;try{await executeBinaryTransport(c,p.sql,p.raw);}catch(e){code=e.message;}
  check('unreviewed trigger logging rejected before COPY',code==='REVIEWED_TRIGGER_DRIFT'&&snapshot()===before);
  sql('DROP TRIGGER binary_logging_trigger ON public.canonical_identity; DROP FUNCTION public.binary_logging_trigger()');
  p=build();sql("CREATE FUNCTION public.binary_constraint_warning(text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RAISE WARNING '%',$1; RETURN true; END $$; ALTER TABLE public.canonical_identity ADD CONSTRAINT binary_warning CHECK(public.binary_constraint_warning(full_name)) NOT VALID");
  code=null;try{await executeBinaryTransport(c,p.sql,p.raw);}catch(e){code=e.message;}
  check('new constraint logging surface rejected before COPY',code==='REVIEWED_SCHEMA_DRIFT'&&snapshot()===before);
  sql('ALTER TABLE public.canonical_identity DROP CONSTRAINT binary_warning; DROP FUNCTION public.binary_constraint_warning(text)');
  await c.query("SET auto_explain.log_nested_statements='on'");p=build();code=null;
  try{await executeBinaryTransport(c,p.sql,p.raw);}catch(e){code=e.message;}
  check('unsafe nested auto_explain rejected before private data',code==='TRANSPORT_LOG_CONTEXT');
  await c.query("SET auto_explain.log_nested_statements='off'");
  await c.query("SET auto_explain.log_parameter_max_length='-1'");code=null;
  try{await executeBinaryTransport(c,p.sql,p.raw);}catch(e){code=e.message;}
  check('auto_explain parameter capture rejected before private data',code==='TRANSPORT_LOG_CONTEXT');
  await c.query("SET auto_explain.log_parameter_max_length='0'");
  await c.query("SET pgaudit.log='all'; SET pgaudit.log_parameter='on'");code=null;
  try{await executeBinaryTransport(c,p.sql,p.raw);}catch(e){code=e.message;}
  check('audit parameter logging guard rejected before private data',code==='TRANSPORT_LOG_CONTEXT');
  await c.query("SET pgaudit.log='none'; SET pgaudit.log_parameter='off'");
  const parts=splitBinarySql(p.sql);
  await c.query(parts.prepare);await c.query('ALTER TABLE pg_temp.ptv_legacy25_input ADD CONSTRAINT unsafe_input CHECK(octet_length(payload)<1)');
  check('private staging with constraint is rejected before copying',(await c.query(privateStageSql)).rows[0].safe===false);await c.query('ROLLBACK');
  await c.query(parts.prepare);await c.query('CREATE INDEX binary_input_index ON pg_temp.ptv_legacy25_input(payload)');
  check('private staging with an index is rejected before copying',(await c.query(privateStageSql)).rows[0].safe===false);await c.query('ROLLBACK');
  await c.query(parts.prepare);await pipeline(Readable.from([binaryCopyFrame(p.raw)]),c.query(copyFrom(parts.copy)));
  await c.query('SET LOCAL ROLE authenticated');rejected=false;try{await c.query('SELECT payload FROM pg_temp.ptv_legacy25_input');}catch{rejected=true;}
  check('unprivileged role cannot read staged private bytes',rejected);await c.query('ROLLBACK');
  await c.query(parts.prepare);let copyFailed=false;const frame=binaryCopyFrame(p.raw);
  try{await pipeline(Readable.from([frame.subarray(0,frame.length-10)]),c.query(copyFrom(parts.copy)));}catch{copyFailed=true;}
  await c.query('ROLLBACK');check('malformed binary framing fails without business writes',copyFailed&&snapshot()===before);
  await c.query("SET request.jwt.claims='{\"role\":\"service_role\"}'");
  const actor=await executeBinaryTransport(c,p.sql,p.raw);
  check('forged service-role claims still fail DB authorization',!actor.committed&&actor.outcome.code==='42501'&&snapshot()===before);
  await c.query("RESET request.jwt.claims");
  const c2=await connect();
  const concurrent=await Promise.all([executeBinaryTransport(c,p.sql,p.raw),executeBinaryTransport(c2,p.sql,p.raw)]);
  check('two connections serialize to one provision and one no-op',concurrent.every(v=>v.committed&&v.outcome.ok)&&concurrent.filter(v=>v.outcome.noop).length===1);
  const positive=concurrent.find(v=>!v.outcome.noop).outcome;
  check('positive delta is exactly 101 rows',positive.rows.canonical_identity===25&&positive.rows.organization_membership===25&&positive.rows.user_account===25&&positive.rows.account_profiles===25&&positive.rows.auth_audit_log===1);
  const after=snapshot(),again=await executeBinaryTransport(c,p.sql,p.raw);
  check('serial replay is exact no-op',again.committed&&again.outcome.noop&&Object.values(again.outcome.rows).every(v=>v===0)&&snapshot()===after);
  check('Root gate and credential invariants preserved',positive.root===0&&positive.gate==='OFF'&&positive.credentials===0);
  check('staging dropped after commit',(await c.query("SELECT to_regclass('pg_temp.ptv_legacy25_input') IS NULL AS dropped")).rows[0].dropped);
  const statistics=(await c.query('SELECT query FROM pg_stat_statements')).rows.map(v=>v.query||'').join('\n');
  const logs=readFileSync(logPath,'utf8').slice(offset);
  check('server logs contain no transport name/username canary',markers.every(v=>!logs.includes(v)));
  check('server logs contain no hex-encoded transport canary',markers.every(v=>!logs.toLowerCase().includes(Buffer.from(v).toString('hex'))));
  check('pg_stat_statements contains no transport name/username canary',markers.every(v=>!statistics.includes(v)));
  check('auto_explain was active during the test',logs.includes('plan:'));
  check('redacted failure audit remains in server log',logs.includes('PTV_LEGACY25_FAILURE'));
  const original=await readPlanRoleState(c);let savedBeforeChange=false;
  await applyPlanRedaction(c,original,async baseline=>{savedBeforeChange=(await readPlanRoleState(c)).role_digest===baseline.role_digest;});
  check('role snapshot is saved before any configuration change',savedBeforeChange);
  const fresh=await connect();check('fresh role connection has parameter redaction',(await fresh.query("SELECT current_setting('auto_explain.log_parameter_max_length') AS v")).rows[0].v==='0');
  check('role restoration exactly preserves initial configuration digest',await restorePlanRedaction(c,original)&&(await readPlanRoleState(c)).role_digest===original.role_digest);
  let failureHandled=false;
  try{await applyPlanRedaction(c,original,async()=>{});throw new Error('SYNTHETIC_MIGRATION_FAILURE');}catch{failureHandled=true;}finally{await restorePlanRedaction(c,original);}
  check('role restoration runs after a migration failure',failureHandled&&(await readPlanRoleState(c)).role_digest===original.role_digest);
  let saveFailed=false;try{await applyPlanRedaction(c,original,async()=>{throw new Error('SYNTHETIC_BACKUP_FAILURE');});}catch{saveFailed=true;}
  check('failed baseline backup prevents role change',saveFailed&&(await readPlanRoleState(c)).role_digest===original.role_digest);
  await c.query('ALTER ROLE postgres SET "auto_explain.log_parameter_max_length" TO \'137\'');
  try{
   const nondefault=await readPlanRoleState(c);await applyPlanRedaction(c,nondefault,async()=>{});await restorePlanRedaction(c,nondefault);
   const verification=await connect();const effective=(await verification.query("SELECT pg_size_bytes(current_setting('auto_explain.log_parameter_max_length'))::text AS v")).rows[0].v;check('nondefault original role value restored exactly',effective==='137'&&(await readPlanRoleState(c)).role_value==='137');
  }finally{if(original.role_value===null)await c.query('ALTER ROLE postgres RESET "auto_explain.log_parameter_max_length"');else await c.query('ALTER ROLE postgres SET "auto_explain.log_parameter_max_length" TO \''+original.role_value+'\'');}
  check('audit configuration stays unchanged',(await readPlanRoleState(c)).audit_digest===original.audit_digest);
  return {selectedTransport:'COPY_BINARY_BYTEA_PRIVATE_TEMP',pgauditRuntime:'NOT_INSTALLED; configuration guard tested, business audit tested',stress:{log_statement:'all',log_parameter_max_length:-1,log_parameter_max_length_on_error:-1,auto_explain_min_duration:0,auto_explain_nested:false,auto_explain_parameter_max_length:0,pg_stat_statements_track:'all'},namesAndUsernamesNotFoundInLogs:true,namesAndUsernamesNotFoundInStatistics:true};
 }finally{for(const client of clients)await client.end().catch(()=>{});}
}
