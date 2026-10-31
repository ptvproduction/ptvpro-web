import { createHash, randomUUID } from 'node:crypto';
import { reconcileLegacySnapshot } from './legacy-crew-reconciliation.mjs';

// Input is a current, pseudonymized read-only snapshot; this module never opens a database.
export function planLegacyAccounts(snapshot) {
 const archivePlan=reconcileLegacySnapshot(snapshot);
 const queue=snapshot.legacy.map(source=>{
  const matches=archivePlan.queue.filter(a=>a.legacyRef===source.legacy_ref);
  const reasons=[];
  const credential=source.has_password||!!source.oauth_ref;
  if(matches.length!==1||matches[0].status!=='VERIFIED')reasons.push('ARCHIVE_UUID_PROVENANCE_AMBIGUOUS');
  if(!source.username_valid)reasons.push('LEGACY_USERNAME_UNSUPPORTED_OR_MISSING');
  if(source.username_ref&&snapshot.legacy.filter(s=>s.username_ref===source.username_ref).length!==1)reasons.push('DUPLICATE_LEGACY_USERNAME');
  if(source.username_ref&&snapshot.staging.accounts.some(a=>a.username_ref===source.username_ref))reasons.push('STAGING_USERNAME_COLLISION');
  if(snapshot.staging.identities.some(i=>i.legacy_ref===source.legacy_ref||i.ptv_ref===source.ptv_ref))reasons.push('TARGET_ALREADY_EXISTS_REQUIRES_RECEIPT_REVIEW');
  if(source.account_status!=='active'||!source.account_status_evidence)reasons.push('AUTHORITATIVE_LOGIN_STATUS_UNVERIFIED_OR_INACTIVE');
  if(source.status!=='aktif')reasons.push('HISTORICAL_PERSONNEL_ARCHIVE_ONLY');
  if(!source.category_reviewed)reasons.push('PERSONNEL_CATEGORY_REVIEW_REQUIRED');
  if(!source.membership_mapping_valid)reasons.push('DIVISION_OR_COHORT_RECONCILIATION_REQUIRED');
  if(source.oauth_ref&&snapshot.legacy.filter(s=>s.oauth_ref===source.oauth_ref&&s.oauth_provider===source.oauth_provider).length!==1)reasons.push('DUPLICATE_OAUTH_SUBJECT');
  if(!credential)reasons.push('NO_LOGIN_CREDENTIAL_EVIDENCE');
  const inactiveProvisioningReasons=reasons.filter(r=>r!=='AUTHORITATIVE_LOGIN_STATUS_UNVERIFIED_OR_INACTIVE');
  return {sourceRef:source.legacy_ref,ptvId:source.ptv_id,sourceVersion:source.updated_at,
   archiveRef:matches.length===1?matches[0].archiveRef:null,archiveVersion:matches.length===1?matches[0].archiveVersion:null,
   usernameRef:source.username_ref,personnelStatus:source.status,legacyRole:source.role,
   categoryProposal:source.category_proposal,divisionProposal:source.division_proposal,cohortProposal:source.cohort_proposal,
   passwordPresent:!!source.has_password,passwordFormat:source.password_format,passwordCost:source.password_cost,
   oauthProvider:source.oauth_provider||null,oauthSubjectPresent:!!source.oauth_ref,
   credentialAction:credential?'PRIVATE_REENROLLMENT_OR_VERIFIED_PROVIDER_BINDING_NO_HASH_COPY':'NONE',
   status:!credential?'PERSONNEL_ONLY':reasons.length?'HOLD':'CANDIDATE',
   inactiveProvisioningEligible:!!credential&&inactiveProvisioningReasons.length===0,
   inactiveProvisioningReasons,activationStatus:reasons.length?'HOLD':'REQUIRES_SEPARATE_ACTIVATION_ACC',
   disposition:source.status!=='aktif'?'ARCHIVE_ONLY':'REVIEW_ACTIVE_ACCOUNT',
   initialAccountStatus:'inactive',initialProfile:'crew',automaticLinkAllowed:false,reasons};
 });
 return {scope:'CURRENT READ-ONLY SOURCE; PROVENANCE IS NOT ACCOUNT OWNERSHIP',counts:{personnel:queue.length,
  observedCredentialAccounts:queue.filter(q=>q.passwordPresent||q.oauthSubjectPresent).length,
  candidates:queue.filter(q=>q.status==='CANDIDATE').length,hold:queue.filter(q=>q.status==='HOLD').length,
  inactiveProvisioningEligible:queue.filter(q=>q.inactiveProvisioningEligible).length,
  inactiveProvisioningHold:queue.filter(q=>(q.passwordPresent||q.oauthSubjectPresent)&&!q.inactiveProvisioningEligible).length,
  personnelOnly:queue.filter(q=>q.status==='PERSONNEL_ONLY').length,
  archiveProvenance:archivePlan.counts.archiveCategories},queue};
}

export function deriveLegacyBatchTemplate(base) {
 const replacements=[
  ['-- LOCAL PROPOSAL ONLY. Direct administrative execution after a separate, scoped ACC.','-- LOCAL LEGACY BATCH PROPOSAL ONLY. Separate operator ACC and current private source manifest required.'],
  ["SET LOCAL lock_timeout='5s';","SET LOCAL TIME ZONE 'UTC';\nSET LOCAL lock_timeout='5s';"],
  ["PROVISION_TWO_INACTIVE_CREW_ACCOUNTS","PROVISION_REVIEWED_LEGACY_ACCOUNTS"],
  ["OR jsonb_array_length(m->'targets')<>2","OR jsonb_array_length(m->'targets') NOT BETWEEN 1 AND 100\n OR coalesce(m->>'source_snapshot_sha256','') !~ '^[0-9a-f]{64}$'"],
  ["WHERE t->>'ptv_id' IN ('PTV-001','PTV-002'))<>2","WHERE t->>'ptv_id' ~ '^PTV-[0-9]{3,}$')<>jsonb_array_length(m->'targets')"],
  [")<>2",")<>jsonb_array_length(m->'targets')"],
  ["OR item->>'initial_profile' IS DISTINCT FROM 'crew'","OR item->>'initial_profile' IS DISTINCT FROM 'crew'\n  OR item->>'provisioning_mode' IS DISTINCT FROM 'INACTIVE_ONLY_NO_LOGIN'\n  OR coalesce(item->>'legacy_account_status','') NOT IN ('active','inactive','unknown')\n  OR item->>'legacy_personnel_status' IS DISTINCT FROM 'aktif'\n  OR length(trim(coalesce(item->>'position_title','')))<1\n  OR (item->>'legacy_account_status' IN ('active','inactive') AND length(trim(coalesce(item->>'login_status_evidence_reference','')))<8)\n  OR length(trim(coalesce(item->>'mapping_review_reference','')))<8\n  OR item->>'credential_action' IS DISTINCT FROM 'PRIVATE_REENROLLMENT_NO_HASH_COPY'"],
  ["'provision_operation',operation,'provision_manifest_sha256',manifest_hash","'legacy_login_status',item->>'legacy_account_status','provisioning_mode','INACTIVE_ONLY_NO_LOGIN','provision_operation',operation,'provision_manifest_sha256',manifest_hash"],
  ["VALUES(member_id,source_id,'ptv_studio',item->>'division_id',archive.jabatan,","VALUES(member_id,source_id,'ptv_studio',item->>'division_id',item->>'position_title',"],
  ["OR item->>'membership_period_start' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'","OR item->>'membership_period_start' IS DISTINCT FROM 'ACTUAL_PROVISIONING_DATE_ASIA_JAKARTA'\n  OR length(trim(coalesce(item->>'canonical_full_name','')))<2"],
  ["VALUES(source_id,item->>'ptv_id',archive.full_name,","VALUES(source_id,item->>'ptv_id',item->>'canonical_full_name',"],
  ["(item->>'membership_period_start')::date,true)","(transaction_timestamp() AT TIME ZONE 'Asia/Jakarta')::date,true)"],
  ["two-target approval required","batch approval required"]
 ];
 for(const [from,to] of replacements){if(!base.includes(from))throw new Error('Provisioning source contract drift');base=base.replaceAll(from,()=>to);}
 return base;
}

export const migrationEvidenceHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function renderReviewedLegacyPayload(template,manifest,systemIdentifier) {
 if(!/^\d{10,24}$/.test(systemIdentifier)||manifest.targets?.length!==25||manifest.targets.some(t=>!t.canonical_full_name||t.membership_period_start!=='ACTUAL_PROVISIONING_DATE_ASIA_JAKARTA'))throw new Error('Complete reviewed25 manifest required');
 const ids=['001','002','003','004','005','006','016',...Array.from({length:18},(_,i)=>String(i+19).padStart(3,'0'))].map(n=>'PTV-'+n).sort();
 if(JSON.stringify(manifest.targets.map(t=>t.ptv_id).sort())!==JSON.stringify(ids))throw new Error('Exact25 allowlist required');
 const literal="'"+JSON.stringify(manifest).replaceAll("'","''")+"'";
 const tag='$ptv_'+createHash('sha256').update(literal).digest('hex').slice(0,24)+'$';
 if(literal.includes(tag))throw new Error('Unsafe SQL delimiter');
 const hardened=template.replace("IF m->>'project_ref'", "IF jsonb_array_length(m->'targets')<>25 OR m->>'project_ref'")
  .replace('public.account_capability_overrides IN SHARE ROW EXCLUSIVE MODE','public.account_capability_overrides,public.profile_capabilities,public.access_profile,public.capability_registry IN SHARE ROW EXCLUSIVE MODE')
  .replace("IF EXISTS(SELECT 1 FROM public.account_profiles WHERE profile_id='root_executive')", "IF (SELECT encode(sha256(convert_to(coalesce(jsonb_agg(capability_key ORDER BY capability_key),'[]')::text,'UTF8')),'hex') FROM public.profile_capabilities WHERE profile_id='crew') IS DISTINCT FROM m->>'crew_capabilities_sha256' THEN RAISE EXCEPTION 'crew profile drift'; END IF;\n IF EXISTS(SELECT 1 FROM public.account_profiles WHERE profile_id='root_executive')");
 const sql=hardened.replaceAll('$provision$',()=>tag).replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',()=>systemIdentifier).replace("'__APPROVED_PRIVATE_MANIFEST_JSON__'",()=>literal);
 if(sql.includes('__APPROVED_'))throw new Error('Unbound payload');
 return sql;
}

export function buildReviewed25Manifest(eligible,source,stage,now=Date.now()) {
 if(eligible.length!==25||source.length!==25||stage.archives.length!==25||!stage.fingerprint_match||stage.root!==0||!stage.gate_off)throw new Error('Exact25 Staging review required');
 const targets=eligible.map(e=>{
  const s=source.find(x=>x.ptv_id===e.ptvId),a=stage.archives.find(x=>x.ptv_id===e.ptvId);
  if(!s||!a||s.source_ref!==e.sourceRef||s.username_ref!==e.usernameRef||Date.parse(s.updated_at)!==Date.parse(e.sourceVersion)
   ||a.archive_ref!==e.archiveRef||a.source_uuid!==s.source_uuid||a.source_key!=='ptv_kru:'+s.source_uuid||a.source_count!==1||a.ptv_count!==1||a.canonical_uuid!==null
   ||s.status!=='aktif'||!s.nama||!s.jabatan||!/^[a-z][a-z0-9._-]{2,47}$/.test(s.username))throw new Error('Source/provenance drift');
  if(stage.identities.some(i=>i.id===s.source_uuid||i.ptv_id===s.ptv_id||i.legacy_uuid===s.source_uuid)||stage.accounts.some(a=>a.username?.toLowerCase()===s.username.toLowerCase()))throw new Error('Target conflict');
  return {ptv_id:s.ptv_id,source_uuid:s.source_uuid,source_updated_at:s.updated_at,archive_uuid:a.archive_uuid,archive_sha256:a.row_sha256,
   account_uuid:randomUUID(),membership_uuid:randomUUID(),username:s.username,canonical_full_name:s.nama,
   category:e.categoryProposal,division_id:e.divisionProposal,cohort:e.cohortProposal===null?null:String(e.cohortProposal),
   membership_status:'active',membership_period_start:'ACTUAL_PROVISIONING_DATE_ASIA_JAKARTA',position_title:s.jabatan,
   initial_profile:'crew',provisioning_mode:'INACTIVE_ONLY_NO_LOGIN',legacy_account_status:'unknown',legacy_personnel_status:'aktif',
   mapping_review_reference:'OPERATOR_OVERNIGHT_SOURCE_UUID_RULES_REVIEW',credential_action:'PRIVATE_REENROLLMENT_NO_HASH_COPY'};
 });
 return {project_ref:'swadgljnyelsjstqqxbm',approval_scope:'PROVISION_REVIEWED_LEGACY_ACCOUNTS',approval_reference:'OPERATOR_OVERNIGHT_REVIEW_EXECUTION_REQUIRES_SEPARATE_ACC',
  operation_id:randomUUID(),expires_at:new Date(now+23*3600000).toISOString(),source_snapshot_sha256:migrationEvidenceHash(source),crew_capabilities_sha256:stage.crew_caps_hash,targets};
}

export function applyVerifiedPersonnelMapping(snapshot,evidence) {
 const next=JSON.parse(JSON.stringify(snapshot));
 const seen=new Set();
 for(const row of evidence){
  if(seen.has(row.source_ref))throw new Error('Duplicate mapping evidence');
  seen.add(row.source_ref);
  const source=next.legacy.find(s=>s.legacy_ref===row.source_ref);
  if(!source||!Number.isFinite(Date.parse(row.updated_at))||Date.parse(source.updated_at)!==Date.parse(row.updated_at))throw new Error('Mapping source version changed');
  if(!['Kru','Pembina','Pengarah'].includes(row.category))throw new Error('Unsupported category evidence');
  if(row.category!=='Kru'&&(row.division_id!==null||row.cohort!==null))throw new Error('Nonoperational category conflict');
  if(row.category==='Kru'&&row.mapping_unambiguous&&(!['editor','layouter','technical','engagements'].includes(row.division_id)||!Number.isInteger(row.cohort)||row.cohort<1))throw new Error('Invalid operational mapping');
  Object.assign(source,{category_reviewed:true,category_proposal:row.category,division_proposal:row.division_id,cohort_proposal:row.cohort,membership_mapping_valid:row.mapping_unambiguous===true});
 }
 return next;
}
