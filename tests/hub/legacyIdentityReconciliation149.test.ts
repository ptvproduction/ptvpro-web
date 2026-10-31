import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { crewArchiveSourceKey, evidenceFingerprint, reconcileLegacySnapshot } from '../../scripts/lib/legacy-crew-reconciliation.mjs';
import { planIdentityReconciliation } from '../../api/auth/_utils/identityReconciliation';

const uuid='11111111-1111-4111-8111-111111111111';
function fixture() {
  return {capturedAt:'2026-10-24',sources:{legacy:'legacy',staging:'staging'},legacy:[{
    legacy_ref:'legacy-uuid',ptv_ref:'ptv-hash',username_ref:'username-hint',email_hint_ref:'email-hint',
    has_password:false,oauth_ref:null,wp_ref:null,role:'member',updated_at:'2026-10-01'}],staging:{
    archives:[{archive_ref:'archive',legacy_ref:'legacy-uuid',ptv_ref:'ptv-hash',canonical_ref:null,archive_version:'version-one'}],
    identities:[],memberships:[],accounts:[]}} as any;
}

describe('149 legacy import identity keys (offline)',()=>{
  it('uses the same UUID key for legacy and already archived input shapes',()=>{
    expect(crewArchiveSourceKey({id:uuid})).toBe(crewArchiveSourceKey({production_id:uuid}));
    expect(crewArchiveSourceKey({id:uuid.toUpperCase(),production_id:uuid})).toBe(`ptv_kru:${uuid}`);
  });
  it.each([{}, {id:'PTV-001'}, {id:123}, {production_id:'not-a-uuid'}, {id:uuid,production_id:'22222222-2222-4222-8222-222222222222'}])('rejects missing/conflicting stable source: %j',row=>{
    expect(()=>crewArchiveSourceKey(row)).toThrow('manual reconciliation');
  });
  it('bulk importer stops crew re-import before its first write',()=>{
    const code=readFileSync('scripts/import-production-bundle.mjs','utf8');
    const run=code.slice(code.indexOf('async function runImport()'));
    expect(run.indexOf('Crew re-import is blocked')).toBeLessThan(run.indexOf('await postgrestInsert'));
    expect(code).toContain('crewArchiveSourceKey(s)');
  });
});

describe('149 evidence classification is separate from account provisioning',()=>{
  it('verifies archive provenance without inventing canonical identity or login',()=>{
    const result=reconcileLegacySnapshot(fixture());
    expect(result.queue[0]).toMatchObject({status:'VERIFIED',canonicalStatus:'UNMATCHED',automaticLinkAllowed:false,accountIntent:'PERSONNEL_ONLY_UNLESS_LOGIN_PROVEN'});
    expect(result.counts.accountRows).toBe(0);
    expect(result.queue[0].verifiedScope).toBe('LEGACY_UUID_TO_ARCHIVE_PROVENANCE_ONLY');
  });
  it('names, emails, PTV IDs and username alone cannot prove source ownership',()=>{
    const input=fixture(); input.staging.archives[0].legacy_ref='different-uuid';
    input.staging.archives[0].username_ref='username-hint';
    input.staging.archives[0].email_hint_ref='email-hint';
    expect(reconcileLegacySnapshot(input).queue[0].status).toBe('UNMATCHED');
  });
  it('same UUID imported twice is DUPLICATE, not two identities',()=>{
    const input=fixture();input.staging.archives.push({...input.staging.archives[0],archive_ref:'second'});
    expect(reconcileLegacySnapshot(input).counts.archiveCategories).toEqual({VERIFIED:0,AMBIGUOUS:0,UNMATCHED:0,DUPLICATE:2});
  });
  it('conflicting ID PTV under a known UUID requires manual review',()=>{
    const input=fixture();input.staging.archives[0].ptv_ref='changed';
    expect(reconcileLegacySnapshot(input).queue[0].status).toBe('AMBIGUOUS');
  });
  it('conflicting immutable WordPress/OAuth evidence is ambiguous',()=>{
    const input=fixture();input.legacy[0].wp_ref='wp-a';input.staging.archives[0].wp_ref='wp-b';
    expect(reconcileLegacySnapshot(input).queue[0].status).toBe('AMBIGUOUS');
  });
  it('quarantined tests never become verified personnel',()=>{
    const input=fixture();input.staging.archives[0].test_created=true;
    expect(reconcileLegacySnapshot(input).queue[0].status).toBe('AMBIGUOUS');
  });
  it('existing canonical links conflicting with source cannot be overwritten',()=>{
    const input=fixture();input.staging.archives[0].canonical_ref='missing-identity';
    expect(reconcileLegacySnapshot(input).queue[0].status).toBe('AMBIGUOUS');
  });
  it('credential evidence is preserved separately from creating an account',()=>{
    const input=fixture();input.legacy[0].has_password=true;
    const result=reconcileLegacySnapshot(input);
    expect(result.counts.legacyCredentialCandidates).toBe(1);
    expect(result.queue[0].accountIntent).toBe('PRESERVE_EXISTING_CREDENTIALS_AFTER_REVIEW');
    expect(result.counts.accountRows).toBe(0);
  });
  it('username/email hints never transfer profiles or become a verified account',()=>{
    const input=fixture();input.staging.accounts=[{account_ref:'account',identity_ref:'identity',username_ref:'username-hint',email_hint_ref:'email-hint',profiles:['crew'],overrides:[{capability:'crew.edit',type:'deny'}],status:'inactive'}];
    const before=structuredClone(input);
    const result=reconcileLegacySnapshot(input);
    expect(result.accountQueue[0].status).toBe('UNMATCHED');
    expect(result.accountQueue[0].hintOnlyLegacyRefs).toEqual(['legacy-uuid']);
    expect(result.accountQueue[0].profiles).toEqual(['crew']);
    expect(input).toEqual(before);
  });
  it('exact provider/subject verifies that binding, not a new permission grant',()=>{
    const input=fixture();input.legacy[0].oauth_ref='subject';input.legacy[0].oauth_provider='google';
    input.staging.accounts=[{account_ref:'account',identity_ref:'identity',oauth_ref:'subject',oauth_provider:'google',profiles:['crew'],status:'active'}];
    expect(reconcileLegacySnapshot(input).accountQueue[0]).toMatchObject({status:'VERIFIED',verifiedScope:'EXISTING_OAUTH_SUBJECT_BINDING_ONLY',automaticLinkAllowed:false});
    input.staging.accounts[0].oauth_provider='other';
    expect(reconcileLegacySnapshot(input).accountQueue[0].status).toBe('UNMATCHED');
  });
  it('repeated planning is idempotent and does not mutate its input',()=>{
    const input=fixture(),before=structuredClone(input);
    expect(reconcileLegacySnapshot(input)).toEqual(reconcileLegacySnapshot(input));
    expect(input).toEqual(before);
  });
  it('fingerprints ignore row/property ordering but detect changed permissions',()=>{
    expect(evidenceFingerprint({rows:[{a:1,b:2},{a:3,b:4}]})).toBe(evidenceFingerprint({rows:[{b:4,a:3},{b:2,a:1}]}));
    expect(evidenceFingerprint({profiles:['crew']})).not.toBe(evidenceFingerprint({profiles:['root_executive']}));
  });
  it('a person without any account still qualifies for operator linking review',()=>{
    expect(planIdentityReconciliation([{archiveId:'archive',ptvId:'PTV-901',canonicalId:null}],[{id:'identity',ptvId:'PTV-901'}],[{identityId:'identity',current:true,organizationId:'ptv_studio'}],[])[0].status).toBe('REQUIRES_OPERATOR_REVIEW');
  });
});

describe('149 linking SQL static safeguards, not a PostgreSQL integration test',()=>{
  const sql=readFileSync('docs/PTVPRO-ACCESS-149-LINKING-PROPOSAL.sql','utf8');
  it('does not create accounts, identities, credentials, memberships or grants',()=>{
    expect(sql).not.toMatch(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(?:user_account|canonical_identity|auth_credentials|organization_membership|account_profiles|account_capability_overrides)\b/i);
  });
  it('requires immutable provenance, review hash, Root/self guard and recovery',()=>{
    for(const part of ['legacy_source_project','legacy_source_table','legacy_uuid','reviewed manifest required','self or Root identity protected','assert_recovery','duplicate or quarantine']) expect(sql).toContain(part);
  });
  it('a successful exact replay is no-op before checking the old version',()=>{
    expect(sql.indexOf("'no_op',true")).toBeLessThan(sql.indexOf('IF p_expected_version IS NULL'));
    expect(sql).toContain("'40001'");
  });
  it('cooperates with the shared lock and aborts on audit failure',()=>{
    expect(sql).toContain('pg_advisory_xact_lock(149,1)');
    expect(sql).toContain("'legacy_personnel_linked'");expect(sql).not.toMatch(/EXCEPTION\s+WHEN/);
    expect(sql).toContain('FROM PUBLIC,anon,authenticated');
  });
  it('manifest source counts balance without pretending accounts were linked',()=>{
    const manifest=JSON.parse(readFileSync('docs/PTVPRO-ACCESS-149-RECONCILIATION.json','utf8'));
    expect(Object.values(manifest.counts.archiveCategories).reduce((sum:any,n:any)=>sum+n,0)).toBe(manifest.counts.archiveRows);
    expect(manifest.queue.every((row:any)=>row.automaticLinkAllowed===false)).toBe(true);
    expect(manifest.recovery.portalRecoveryLoginProven).toBe(false);
  });
});
