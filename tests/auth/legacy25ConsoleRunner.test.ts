import {describe,it,expect} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
// @ts-expect-error Administrative console-only module, never bundled in the web application.
import {APPROVED_SQL_SHA,sourceDigestForManifest,validateLegacy25Packet,writeClosedStores,core} from '../../scripts/run-legacy25-staging.mjs';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const ids=['001','002','003','004','005','006','016',...Array.from({length:18},(_,i)=>String(i+19).padStart(3,'0'))];
 const m={project_ref:'swadgljnyelsjstqqxbm',operation_id:'901ea015-5017-405b-9fc9-256eb30bfda1',expires_at:new Date(Date.now()+3600000).toISOString(),targets:ids.map(id=>({ptv_id:'PTV-'+id,source_uuid:randomUUID(),archive_uuid:randomUUID(),account_uuid:randomUUID(),membership_uuid:randomUUID(),username:'synthetic_'+id,canonical_full_name:'Synthetic Person '+id,source_updated_at:'2026-10-26 00:00:00.123456+00',initial_profile:'crew',provisioning_mode:'INACTIVE_ONLY_NO_LOGIN',credential_action:'PRIVATE_REENROLLMENT_NO_HASH_COPY',membership_period_start:'ACTUAL_PROVISIONING_DATE_ASIA_JAKARTA'}))};
 const p={operator_console_verified:true,maintenance_checked_at:new Date().toISOString(),sql:'-- synthetic metadata-free SQL fixture',manifest:JSON.stringify(m),postflight:'SELECT count(*)=25; -- '+m.operation_id};
 const d={version:'COPY_BINARY_V1',executionApproved:true,parentSqlSha256:APPROVED_SQL_SHA,sqlSha256:hash(p.sql),approvedSqlSha256:hash(p.sql),manifestSha256:hash(p.manifest),postflightSha256:hash(p.postflight)};
 const c={project:'jthzuhkblxcaohiuypqq',count:25,checkedAt:new Date().toISOString(),digest:sourceDigestForManifest(m)};
 return {m,p,d,c};
}
describe('Legacy25 console execution guards',()=>{
 it('matches the approved ACC-1 revoke boundary while retaining archive RLS checks',()=>{const bundle=readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8');const revoked=bundle.match(/REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON ([\s\S]*?)\s+FROM anon,authenticated,service_role;/)?.[1].match(/public\.[a-z_]+/g)?.map(x=>x.slice(7))||[];expect([...writeClosedStores].sort()).toEqual([...revoked,'auth_audit_log'].sort());expect(core).toContain('legacy_archive_kru');});
 it('accepts a matching reviewed pair without connecting to a database',()=>{const {m,p,d,c}=fixture();expect(validateLegacy25Packet(p,c,Date.now(),d).targets).toEqual(m.targets);});
 it('requires ACC for the new hash instead of inheriting parent approval',()=>{const {p,d,c}=fixture();expect(()=>validateLegacy25Packet(p,c,Date.now(),{...d,executionApproved:false})).toThrow('NEW_HASH_ACC_REQUIRED');});
 it('rejects an unrelated parent payload',()=>{const {p,d,c}=fixture();expect(()=>validateLegacy25Packet(p,c,Date.now(),{...d,parentSqlSha256:'0'.repeat(64)})).toThrow('NEW_HASH_ACC_REQUIRED');});
 it('rejects a substituted manifest',()=>{const {p,d,c}=fixture();expect(()=>validateLegacy25Packet({...p,manifest:p.manifest+' '},c,Date.now(),d)).toThrow('MANIFEST_BINDING');});
 it('excludes held PTV IDs even with a recomputed input checksum',()=>{const {m,p,d,c}=fixture();m.targets[0].ptv_id='PTV-015';p.manifest=JSON.stringify(m);d.manifestSha256=hash(p.manifest);expect(()=>validateLegacy25Packet(p,c,Date.now(),d)).toThrow('EXACT_25');});
 it('rejects a stale source checkpoint',()=>{const {p,d,c}=fixture();expect(()=>validateLegacy25Packet(p,{...c,checkedAt:new Date(Date.now()-960000).toISOString()},Date.now(),d)).toThrow('SOURCE_CHECKPOINT_STALE');});
 it('rejects an expired manifest even when its checksum matches',()=>{const {m,p,d,c}=fixture();m.expires_at=new Date(Date.now()-1000).toISOString();p.manifest=JSON.stringify(m);d.manifestSha256=hash(p.manifest);expect(()=>validateLegacy25Packet(p,c,Date.now(),d)).toThrow('PAYLOAD_ID_OR_EXPIRY');});
 it('rejects an unverified operator console before touching any payload',()=>expect(()=>validateLegacy25Packet({},{})).toThrow('MAINTENANCE_PROOF'));
 it('rejects substituted SQL before connecting',()=>{const {p,d,c}=fixture();expect(()=>validateLegacy25Packet({...p,sql:'SELECT 1'},c,Date.now(),d)).toThrow('PAYLOAD_HASH');});
 it('preserves microsecond source-version drift',()=>{const target={source_uuid:'synthetic',ptv_id:'PTV-001',username:'synthetic',canonical_full_name:"Synthetic, O'Reilly",source_updated_at:'2026-10-26 00:00:00.123456+00'};expect(sourceDigestForManifest({targets:[target]})).not.toBe(sourceDigestForManifest({targets:[{...target,source_updated_at:'2026-10-26 00:00:00.123457+00'}]}));});
 it('normalizes equivalent UTC formats without dropping fractional precision',()=>{const target={source_uuid:'synthetic',ptv_id:'PTV-001',username:'synthetic',canonical_full_name:'Synthetic',source_updated_at:'2026-10-26 00:00:00.12+00'};expect(sourceDigestForManifest({targets:[target]})).toBe(sourceDigestForManifest({targets:[{...target,source_updated_at:'2026-10-26T00:00:00.120000Z'}]}));});
});
