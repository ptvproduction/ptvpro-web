import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readPhase1PersonnelRows} from '../../api/crewPhase1Adapter';
import {mapLegacyKruRowToCrewMember,type RawLegacyKruDbRow} from '../../src/products/hub/kru/kruMapper';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {KruDetailDrawer} from '../../src/products/hub/kru/components/KruDetailDrawer';

const source='10000000-0000-4000-8000-000000000099';
const raw=():RawLegacyKruDbRow=>({archive_id:'archive-synthetic',source_key:'ptv_kru:'+source,production_id:source,ptv_id:'PTV-099',full_name:'Synthetic Archive',username:'synthetic',divisi:'Editor',jabatan:'Ketua',angkatan:'1',status:'aktif',role:'eksekutif',photo_url:null,email_masked:null,telepon_masked:null,canonical_identity_id:null,reconciliation_status:'unlinked',metadata_json:{},imported_at:'2026-10-01T00:00:00Z'});
function fixture(category='Kru'){
 const identity={id:source,ptv_id:'PTV-099',full_name:'Synthetic Current Canonical',avatar_url:null,metadata:{category,legacy_source_project:'jthzuhkblxcaohiuypqq',legacy_source_table:'ptv_kru',legacy_uuid:source}};
 const membership={identity_id:source,division_id:category==='Kru'?'layouter':null,cohort:category==='Kru'?12:null,position_title:'Ketua',status_organisasi:'active',is_current:true};
 const data:Record<string,unknown[]>={canonical_identity:[identity],organization_membership:[membership],user_account:[{id:'synthetic-account',identity_id:source}],account_profiles:[{account_id:'synthetic-account',profile_id:'crew'}]};
 const db={from:vi.fn((name:string)=>{const chain={select:()=>chain,in:()=>chain,eq:()=>chain,then:(resolve:(value:unknown)=>unknown)=>resolve({data:data[name],error:null})};return chain;})} as unknown as SupabaseClient;
 return {db,data,identity,membership};
}
describe('Phase1 canonical personnel read adapter',()=>{
 it('uses exact provenance and canonical name while preserving the archive object',async()=>{
  const f=fixture(),r=raw(),before=JSON.stringify(r);const model=await readPhase1PersonnelRows(f.db,[r]);
  expect(model.rows[0].full_name).toBe('Synthetic Current Canonical');expect(model.pendingArchiveIds.has(r.archive_id)).toBe(true);expect(JSON.stringify(r)).toBe(before);
  const crew=mapLegacyKruRowToCrewMember(model.rows[0],'inactive');expect(crew.status_akun).toBe('Nonaktif');expect(crew.status_kru).toBe('Aktif');expect(crew.division).toBe('Layouter');
  expect(crew.role).toBe('kru');expect(crew.assigned_profiles).toEqual(['crew']);expect(crew.position).toBe('Ketua');expect(crew.personnel_link_pending).toBe(true);
 });
 it.each(['Pembina','Pengarah'])('keeps %s separate from portal role and operational division',async category=>{
  const f=fixture(category),model=await readPhase1PersonnelRows(f.db,[raw()]);const crew=mapLegacyKruRowToCrewMember(model.rows[0],'inactive');
  expect(crew.category).toBe(category);expect(model.rows[0].divisi).toBeNull();expect(model.rows[0].angkatan).toBeNull();expect(crew.status_akun).toBe('Nonaktif');
  expect(crew.division).toBe('');expect(crew.angkatan).toBe('');
 });
 it('does not associate an identity by equal PTV label without source provenance',async()=>{
  const f=fixture();f.identity.metadata.legacy_uuid='wrong';const r=raw(),model=await readPhase1PersonnelRows(f.db,[r]);expect(model.rows[0]).toBe(r);expect(model.pendingArchiveIds.size).toBe(0);
 });
 it('does not choose among duplicate historical archives',async()=>{
  const f=fixture(),r=raw(),model=await readPhase1PersonnelRows(f.db,[r,{...r,archive_id:'duplicate'}]);expect(model.rows[0].canonical_identity_id).toBeNull();expect(model.pendingArchiveIds.size).toBe(0);
 });
 it('rejects ambiguous current memberships',async()=>{
  const f=fixture();f.data.organization_membership.push({...f.membership});await expect(readPhase1PersonnelRows(f.db,[raw()])).rejects.toThrow('Ambiguous');
 });
 it('rejects nonoperational personnel with an operational membership',async()=>{
  const f=fixture('Pembina');Object.assign(f.membership,{division_id:'technical',cohort:2});await expect(readPhase1PersonnelRows(f.db,[raw()])).rejects.toThrow('Nonoperational');
 });
 it('renders personnel detail drawer with independent account status',async()=>{
  const f=fixture(),model=await readPhase1PersonnelRows(f.db,[raw()]);const crew=mapLegacyKruRowToCrewMember(model.rows[0],'inactive');
  const html=renderToStaticMarkup(createElement(KruDetailDrawer,{crew,onClose:()=>{},canManage:true,canManageStatus:true,onEdit:()=>{},onToggleStatus:()=>{}}));
  expect(html).toContain('Detail Profil Personel');expect(crew.status_akun).toBe('Nonaktif');
 });
});
