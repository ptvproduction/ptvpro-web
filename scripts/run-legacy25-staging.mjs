import {createHash} from 'node:crypto';
import process from 'node:process';
import {URL} from 'node:url';
import {runOperatorBinary} from './lib/execute-legacy25-binary-console.mjs';

// Parent provenance only; COPY execution requires its separately approved descriptor hash.
export const APPROVED_SQL_SHA='296f91c0f9de9bc409b8e3aa894f4fec45f03eeeaf8adfb39a36b771676c29b8';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const requireGuard=(condition,code)=>{if(!condition)throw new Error(code);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const allowlist=['001','002','003','004','005','006','016',...Array.from({length:18},(_,i)=>String(i+19).padStart(3,'0'))].map(x=>'PTV-'+x).sort();
function utcStamp(value){const m=String(value).match(/^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(?:Z|\+00(?::00)?)$/);requireGuard(!!m,'SOURCE_TIME');return m[1]+'T'+m[2]+'.'+(m[3]||'').padEnd(6,'0')+'Z';}
export function sourceDigestForManifest(m){return sha([...m.targets].sort((a,b)=>a.ptv_id.localeCompare(b.ptv_id)).map(t=>sha('['+[t.source_uuid,t.ptv_id,t.username,t.canonical_full_name,utcStamp(t.source_updated_at),'aktif',1].map(v=>JSON.stringify(v)).join(', ')+']')).join(''));}
export function validateLegacy25Packet(p,checkpoint,now=Date.now(),descriptor=null) {
 requireGuard(p.operator_console_verified===true&&now-Date.parse(p.maintenance_checked_at)>=0&&now-Date.parse(p.maintenance_checked_at)<120000,'MAINTENANCE_PROOF');
 requireGuard(descriptor?.executionApproved===true&&descriptor.approvedSqlSha256===descriptor.sqlSha256&&descriptor.version==='COPY_BINARY_V1'&&descriptor.parentSqlSha256===APPROVED_SQL_SHA,'NEW_HASH_ACC_REQUIRED');
 requireGuard(typeof p.sql==='string'&&sha(p.sql)===descriptor.sqlSha256&&!p.sql.includes('__APPROVED_'),'PAYLOAD_HASH');
 requireGuard(sha(p.manifest)===descriptor.manifestSha256&&sha(p.postflight)===descriptor.postflightSha256,'MANIFEST_BINDING');
 const m=JSON.parse(p.manifest);
 requireGuard(m.operation_id==='901ea015-5017-405b-9fc9-256eb30bfda1'&&m.project_ref==='swadgljnyelsjstqqxbm'&&Date.parse(m.expires_at)>now,'PAYLOAD_ID_OR_EXPIRY');
 requireGuard(m.targets.length===25&&equal(m.targets.map(t=>t.ptv_id).sort(),allowlist),'EXACT_25');
 for(const field of ['source_uuid','archive_uuid','account_uuid','membership_uuid','username'])requireGuard(new Set(m.targets.map(t=>t[field])).size===25,'DUPLICATE_TARGET');
 requireGuard(checkpoint.project==='jthzuhkblxcaohiuypqq'&&checkpoint.count===25&&now-Date.parse(checkpoint.checkedAt)>=0&&now-Date.parse(checkpoint.checkedAt)<900000,'SOURCE_CHECKPOINT_STALE');
 for(const t of m.targets){
  requireGuard(t.initial_profile==='crew'&&t.provisioning_mode==='INACTIVE_ONLY_NO_LOGIN'&&t.credential_action==='PRIVATE_REENROLLMENT_NO_HASH_COPY'&&t.membership_period_start==='ACTUAL_PROVISIONING_DATE_ASIA_JAKARTA','INACTIVE_ONLY');
 }
 requireGuard(checkpoint.digest===sourceDigestForManifest(m),'SOURCE_DRIFT');
 requireGuard(typeof p.postflight==='string'&&!p.postflight.includes('__APPROVED_')&&p.postflight.includes(m.operation_id)&&p.postflight.includes('count(*)=25'),'POSTFLIGHT_BINDING');
 return m;
}

export const core=['access_profile','account_capability_overrides','account_profiles','auth_audit_log','auth_credentials','canonical_identity','capability_registry','legacy_archive_kru','organization_membership','profile_capabilities','user_account'];
// ACC-1 closes nine access stores plus audit mutations; the archive writer is preserved under maintenance.
export const writeClosedStores=core.filter(t=>t!=='legacy_archive_kru');
export const securitySql=`SELECT jsonb_build_object(
 'root_zero',NOT EXISTS(SELECT FROM public.account_profiles WHERE profile_id='root_executive'),
 'gate_off',(SELECT count(*)=1 AND bool_and(NOT enabled) FROM ptv_auth_private.policy),
 'rls',(SELECT count(*)=11 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])),
 'write_closed',NOT EXISTS(SELECT FROM unnest(ARRAY[${writeClosedStores.map(t=>"'"+t+"'").join(',')}]::text[]) t CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p WHERE NOT(t='auth_audit_log' AND r='service_role' AND p='INSERT') AND has_table_privilege(r,'public.'||t,p)),
 'archive_default_deny',EXISTS(SELECT FROM pg_class c WHERE c.oid='public.legacy_archive_kru'::regclass AND c.relrowsecurity AND NOT c.relforcerowsecurity AND NOT EXISTS(SELECT FROM pg_policy p WHERE p.polrelid=c.oid)),
 'mutators_closed',NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r WHERE n.nspname='public' AND p.proname IN('rpc_manage_account_access','rpc_update_crew_personnel') AND has_function_privilege(r,p.oid,'EXECUTE')),
 'no_other_active_clients',NOT EXISTS(SELECT FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend' AND state='active'),
 'roles_safe',NOT EXISTS(SELECT FROM pg_roles WHERE rolname IN('anon','authenticated') AND (rolsuper OR rolbypassrls))) AS checks`;

if(process.argv[1]&&new URL(import.meta.url).pathname.toLowerCase().endsWith(process.argv[1].replaceAll('\\','/').toLowerCase()))await runOperatorBinary({validateLegacy25Packet,core,securitySql});
