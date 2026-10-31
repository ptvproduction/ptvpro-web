export const PLAN_PARAMETER='auto_explain.log_parameter_max_length';
export async function readPlanRoleState(client){
 const r=await client.query(`SELECT (SELECT substr(v,strpos(v,'=')+1) FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) v WHERE s.setrole='postgres'::regrole AND s.setdatabase=0 AND split_part(v,'=',1)='auto_explain.log_parameter_max_length') AS role_value,
 (SELECT md5(coalesce(jsonb_object_agg(k,v)::text,'{}')) FROM (SELECT split_part(x,'=',1) k,substr(x,strpos(x,'=')+1) v FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) x WHERE s.setrole='postgres'::regrole AND s.setdatabase=0) c) AS role_digest,
 current_setting('auto_explain.log_parameter_max_length',true) AS effective_value,
 (SELECT count(*)::integer FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) v WHERE s.setrole='postgres'::regrole AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database()) AND split_part(v,'=',1)='auto_explain.log_parameter_max_length') AS database_overrides,
 (SELECT md5(coalesce(jsonb_object_agg(name,setting)::text,'{}')) FROM pg_settings WHERE name LIKE 'pgaudit.%' OR name IN('log_statement','log_min_error_statement','log_error_verbosity','log_min_messages')) AS audit_digest`);
 const state=r.rows[0];
 if(state.database_overrides!==0||!(state.role_value===null||/^-?\d+$/.test(state.role_value)))throw new Error('PLAN_ROLE_STATE_UNSUPPORTED');
 return state;
}
export async function applyPlanRedaction(client,baseline,saveBaseline){
 await saveBaseline(baseline);
 const current=await readPlanRoleState(client);
 if(current.role_digest!==baseline.role_digest)throw new Error('PLAN_ROLE_DRIFT');
 if(current.role_value==='0')return false;
 // Official Supabase role-scoped auto_explain.* configuration; no audit class is disabled.
 await client.query(`ALTER ROLE postgres SET "${PLAN_PARAMETER}" TO '0'`);
 const applied=await readPlanRoleState(client);
 if(applied.role_value!=='0'||applied.audit_digest!==baseline.audit_digest)throw new Error('PLAN_ROLE_APPLY_UNVERIFIED');
 return true;
}
export async function restorePlanRedaction(client,baseline){
 let current=await readPlanRoleState(client);
 if(current.role_digest!==baseline.role_digest){
  if(current.role_value!=='0')throw new Error('PLAN_ROLE_RESTORE_DRIFT');
  if(baseline.role_value===null)await client.query(`ALTER ROLE postgres RESET "${PLAN_PARAMETER}"`);
  else await client.query(`ALTER ROLE postgres SET "${PLAN_PARAMETER}" TO '${baseline.role_value}'`);
  current=await readPlanRoleState(client);
 }
 if(current.role_digest!==baseline.role_digest||current.role_value!==baseline.role_value||current.audit_digest!==baseline.audit_digest)throw new Error('PLAN_ROLE_RESTORE_UNVERIFIED');
 return true;
}
