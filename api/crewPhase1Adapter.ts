import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawLegacyKruDbRow } from '../src/products/hub/kru/kruMapper';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const divisions:Record<string,string>={editor:'Editor',layouter:'Layouter',technical:'Technical',engagements:'Engagement'};

// Read projection only: provenance can display a provisioned identity without silently linking the archive.
export async function readPhase1PersonnelRows(db:SupabaseClient,rows:RawLegacyKruDbRow[]) {
 const sourceCounts=new Map<string,number>(),ptvCounts=new Map<string,number>();
 for(const row of rows){const key=row.production_id?.trim().toLowerCase();sourceCounts.set(key,(sourceCounts.get(key)||0)+1);ptvCounts.set(row.ptv_id,(ptvCounts.get(row.ptv_id)||0)+1);}
 const candidate=(row:RawLegacyKruDbRow)=>{
  const source=row.production_id?.trim().toLowerCase();
  return UUID.test(source||'')&&row.source_key==='ptv_kru:'+source&&sourceCounts.get(source)===1&&ptvCounts.get(row.ptv_id)===1?source:null;
 };
 const ids=[...new Set(rows.flatMap(row=>row.canonical_identity_id?[row.canonical_identity_id]:candidate(row)?[candidate(row)!]:[]))];
 const pendingArchiveIds=new Set<string>();
 if(!ids.length)return {rows,pendingArchiveIds};
 const identities=await db.from('canonical_identity').select('id,ptv_id,full_name,avatar_url,metadata').in('id',ids);
 if(identities.error||!Array.isArray(identities.data))throw new Error('Canonical personnel unavailable');
 const byId=new Map(identities.data.map(i=>[i.id,i]));
 if(byId.size!==identities.data.length)throw new Error('Ambiguous canonical identities');
 const accepted=rows.map(row=>{
  const identity=byId.get(row.canonical_identity_id||candidate(row)||'');
  if(!identity){if(row.canonical_identity_id)throw new Error('Linked identity missing');return {row,identity:null};}
  if(identity.ptv_id!==row.ptv_id)throw new Error('Personnel identity mismatch');
  if(!row.canonical_identity_id){
   const metadata=identity.metadata||{};
   if(metadata.legacy_source_project!=='jthzuhkblxcaohiuypqq'||metadata.legacy_source_table!=='ptv_kru'||metadata.legacy_uuid!==candidate(row))return {row,identity:null};
   pendingArchiveIds.add(row.archive_id);
  }
  return {row,identity};
 });
 const acceptedIds=[...new Set(accepted.filter(x=>x.identity).map(x=>x.identity!.id))];
 if(!acceptedIds.length)return {rows,pendingArchiveIds};
 const memberships=await db.from('organization_membership').select('identity_id,division_id,position_title,cohort,status_organisasi,is_current').in('identity_id',acceptedIds).eq('organization_id','ptv_studio').eq('is_current',true);
 if(memberships.error||!Array.isArray(memberships.data))throw new Error('Personnel membership unavailable');
 const accounts=await db.from('user_account').select('id,identity_id').in('identity_id',acceptedIds);
 if(accounts.error||!Array.isArray(accounts.data))throw new Error('Personnel accounts unavailable');
 const accountIds=accounts.data.map(a=>a.id);
 const profiles=accountIds.length?await db.from('account_profiles').select('account_id,profile_id').in('account_id',accountIds):{data:[],error:null};
 if(profiles.error||!Array.isArray(profiles.data))throw new Error('Personnel access profiles unavailable');
 return {pendingArchiveIds,rows:accepted.map(({row,identity})=>{
  if(!identity)return row;
  const matches=memberships.data.filter(m=>m.identity_id===identity.id);
  if(matches.length!==1)throw new Error('Ambiguous current personnel membership');
  const membership=matches[0],category=identity.metadata?.category||row.metadata_json?.category;
  if(!['Kru','Pembina','Pengarah'].includes(category))throw new Error('Personnel category needs reconciliation');
  if(!['active','inactive','archived'].includes(membership.status_organisasi))throw new Error('Invalid membership status');
  if(category!=='Kru'&&(membership.division_id!==null||membership.cohort!==null))throw new Error('Nonoperational personnel acquired division/cohort');
  const linkedAccounts=accounts.data.filter(a=>a.identity_id===identity.id);
  if(linkedAccounts.length>1)throw new Error('Ambiguous personnel account');
  const assigned=profiles.data.filter(p=>p.account_id===linkedAccounts[0]?.id).map(p=>p.profile_id);
  const portalRole=assigned.some(p=>['root_executive','eksekutif'].includes(p))?'eksekutif':assigned.includes('administrasi')?'administrasi':'kru';
  return {...row,canonical_identity_id:identity.id,full_name:identity.full_name,photo_url:identity.avatar_url??row.photo_url,
   role:portalRole,
   divisi:category==='Kru'?(divisions[membership.division_id]||membership.division_id):null,
   angkatan:category==='Kru'&&membership.cohort!==null?String(membership.cohort):null,
   jabatan:membership.position_title,status:membership.status_organisasi==='active'?'aktif':'nonaktif',metadata_json:{...row.metadata_json,category,phase1_assigned_profiles:assigned,phase1_link_pending:pendingArchiveIds.has(row.archive_id)}};
 })};
}


export default function handler(_req: unknown, res: { status: (c: number) => { json: (d: unknown) => void } }) {
  if (res && typeof res.status === 'function') {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
}
