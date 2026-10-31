import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Local executable module; SQL integration is tested by the PostgreSQL runner.
import { planLegacyAccounts, deriveLegacyBatchTemplate, applyVerifiedPersonnelMapping } from '../../scripts/lib/legacy-account-migration.mjs';

function fixture() {
 return {sources:{legacy:'jthzuhkblxcaohiuypqq',staging:'swadgljnyelsjstqqxbm'},legacy:[{
  legacy_ref:'synthetic-source',ptv_id:'PTV-901',ptv_ref:'synthetic-ptv',username_ref:'synthetic-username',username_valid:true,
  has_password:true,password_format:'bcrypt_2y',password_cost:10,status:'aktif',role:'eksekutif',
  account_status:'active',account_status_evidence:'SYNTHETIC-WP-STATUS',category_reviewed:true,membership_mapping_valid:true,
 }],staging:{archives:[{archive_ref:'synthetic-archive',legacy_ref:'synthetic-source',ptv_ref:'synthetic-ptv'}],identities:[],accounts:[],memberships:[]}};
}
describe('current Legacy migration planning',()=>{
 it('resolves deterministic personnel mapping without granting login status',()=>{
  const s=fixture();Object.assign(s.legacy[0],{updated_at:'2026-10-01T00:00:00Z',category_reviewed:false,account_status:'',account_status_evidence:''});
  const next=applyVerifiedPersonnelMapping(s,[{source_ref:'synthetic-source',updated_at:'2026-10-01T00:00:00Z',category:'Kru',division_id:'technical',cohort:12,mapping_unambiguous:true}]);
  const p=planLegacyAccounts(next);expect(p.queue[0].status).toBe('HOLD');expect(p.queue[0].reasons).not.toContain('PERSONNEL_CATEGORY_REVIEW_REQUIRED');expect(s.legacy[0].category_reviewed).toBe(false);
 });
 it('rejects stale personnel mapping evidence',()=>{
  const s=fixture();Object.assign(s.legacy[0],{updated_at:'2026-10-01T00:00:00Z'});
  expect(()=>applyVerifiedPersonnelMapping(s,[{source_ref:'synthetic-source',updated_at:'2000-01-01T00:00:00Z',category:'Kru'}])).toThrow('version');
 });
 it('does not turn ambiguous cohort into a valid operational mapping',()=>{
  const s=fixture();Object.assign(s.legacy[0],{updated_at:'2026-10-01T00:00:00Z'});
  const next=applyVerifiedPersonnelMapping(s,[{source_ref:'synthetic-source',updated_at:'2026-10-01T00:00:00Z',category:'Kru',division_id:'technical',cohort:null,mapping_unambiguous:false}]);
  expect(planLegacyAccounts(next).queue[0].reasons).toContain('DIVISION_OR_COHORT_RECONCILIATION_REQUIRED');
 });
 it('keeps usernames pseudonymous and does not inherit executive privilege',()=>{
  const p=planLegacyAccounts(fixture());expect(p.counts.candidates).toBe(1);expect(p.queue[0].initialProfile).toBe('crew');expect(p.queue[0].initialAccountStatus).toBe('inactive');expect(p.queue[0].automaticLinkAllowed).toBe(false);
 });
 it('does not equate active personnel to active login',()=>{
  const s=fixture();s.legacy[0].account_status='';const p=planLegacyAccounts(s);expect(p.queue[0].status).toBe('HOLD');expect(p.queue[0].inactiveProvisioningEligible).toBe(true);expect(p.queue[0].activationStatus).toBe('HOLD');
 });
 it('requires authoritative login-status evidence even when status says active',()=>{
  const s=fixture();s.legacy[0].account_status_evidence='';expect(planLegacyAccounts(s).counts.candidates).toBe(0);
 });
 it('preserves historical personnel without automatically provisioning login',()=>{
  const s=fixture();s.legacy[0].status='nonaktif';const q=planLegacyAccounts(s).queue[0];expect(q.disposition).toBe('ARCHIVE_ONLY');expect(q.inactiveProvisioningEligible).toBe(false);
 });
 it('holds duplicate source archives without merge',()=>{
  const s=fixture();s.staging.archives.push({...s.staging.archives[0],archive_ref:'synthetic-duplicate'});expect(planLegacyAccounts(s).queue[0].reasons).toContain('ARCHIVE_UUID_PROVENANCE_AMBIGUOUS');
 });
 it('preserves personnel without credential evidence as personnel only',()=>{
  const s=fixture();s.legacy[0].has_password=false;expect(planLegacyAccounts(s).queue[0].status).toBe('PERSONNEL_ONLY');
 });
 it('requires explicit category review instead of silently inferring privilege',()=>{
  const s=fixture();s.legacy[0].category_reviewed=false;expect(planLegacyAccounts(s).queue[0].reasons).toContain('PERSONNEL_CATEGORY_REVIEW_REQUIRED');
 });
 it('renders a bounded batch while preserving literal SQL regex and source guards',()=>{
  const base=readFileSync('docs/PTVPRO-PHASE1-PROVISIONING-PROPOSAL.sql','utf8');const generated=deriveLegacyBatchTemplate(base);
  expect(generated).toContain("'^[0-9a-f]{64}$'");expect(generated).toContain("'^PTV-[0-9]{3,}$'");expect(generated).toContain('NOT BETWEEN 1 AND 100');expect(generated).toContain('PRIVATE_REENROLLMENT_NO_HASH_COPY');
  expect(generated).toBe(readFileSync('docs/PTVPRO-PHASE1-LEGACY-MIGRATION-PROPOSAL.sql','utf8'));
 });
});
