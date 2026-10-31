import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { signSessionToken, verifySessionToken } from '../../api/_routes/auth/_utils/crypto';
import { resolveIdentityByCredentials, refreshLiveSession, unlinkGoogleIdentityFromAccount } from '../../api/_routes/auth/_utils/identity';
import { planIdentityReconciliation } from '../../api/_routes/auth/_utils/identityReconciliation';

const secret='149-remediation-unit-secret';
const now=Math.floor(Date.now()/1000);
const session={ account_id:'actor', identity_id:'identity', iat:now, exp:now+3600 };
afterEach(()=>vi.unstubAllEnvs());

describe('149 remediation: token integrity and fail-closed authentication',()=>{
  it.each([undefined,null,'invalid',0,-1,Infinity,now-1])('rejects exp=%s',exp=>{
    expect(verifySessionToken(signSessionToken({...session,exp} as never,secret),secret)).toBeNull();
  });
  it.each([undefined,null,'invalid',0,-1,now+60])('rejects iat=%s',iat=>{
    expect(verifySessionToken(signSessionToken({...session,iat} as never,secret),secret)).toBeNull();
  });
  it.each(['account_id','identity_id'])('requires %s',key=>{
    expect(verifySessionToken(signSessionToken({...session,[key]:''} as never,secret),secret)).toBeNull();
  });
  it('accepts signed seconds and historical milliseconds expiration',()=>{
    expect(verifySessionToken(signSessionToken(session as never,secret),secret)).toEqual(session);
    expect(verifySessionToken(signSessionToken({...session,exp:(now+3600)*1000} as never,secret),secret)).not.toBeNull();
  });
  it('rejects identifier-only login outside isolated test mode',async()=>{
    vi.stubEnv('NODE_ENV','production');
    expect((await resolveIdentityByCredentials('root','anything')).success).toBe(false);
  });
  it('does not use test fixtures when a live service key is configured',async()=>{
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','unit-placeholder');
    expect((await resolveIdentityByCredentials('eksekutif')).success).toBe(false);
    expect((await unlinkGoogleIdentityFromAccount('actor')).success).toBe(false);
  });
  it('cannot authorize stale cookie grants without a verified staging backend',async()=>{
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
    expect(await refreshLiveSession({...session,capabilities:['crew.permissions.manage']} as never)).toEqual([]);
  });
});

describe('149 identity linking planner never mutates or invents relationships',()=>{
  const archives=[{archiveId:'archive',ptvId:'PTV-901',canonicalId:null}];
  const identities=[{id:'identity',ptvId:'PTV-901'}];
  const members=[{identityId:'identity',current:true,organizationId:'ptv_studio'}];
  const accounts=[{id:'account',identityId:'identity'}];
  it('a complete exact match still requires operator review',()=>{
    expect(planIdentityReconciliation(archives,identities,members,accounts)[0].status).toBe('REQUIRES_OPERATOR_REVIEW');
    expect(archives[0].canonicalId).toBeNull();
  });
  it('duplicate IDs cannot be linked automatically',()=>{
    expect(planIdentityReconciliation([...archives,{...archives[0],archiveId:'second'}],identities,members,accounts)[0].reasons).toContain('DUPLICATE_OR_MISSING_PTV_ID');
  });
  it('missing identities are never inferred from names',()=>{
    const result=planIdentityReconciliation(archives,[],[],[])[0];
    expect(result.candidateIdentityId).toBeNull();expect(result.status).toBe('MANUAL_RECONCILIATION');
  });
  it('ambiguous membership and accounts require reconciliation',()=>{
    const result=planIdentityReconciliation(archives,identities,[...members,...members],[...accounts,...accounts])[0];
    expect(result.reasons).toEqual(expect.arrayContaining(['MEMBERSHIP_NOT_UNIQUE','ACCOUNT_NOT_UNIQUE_OR_MISSING']));
  });
  it('preserves existing links instead of overwriting a conflict',()=>{
    expect(planIdentityReconciliation([{...archives[0],canonicalId:'other'}],identities,members,accounts)[0].reasons).toContain('EXISTING_LINK_CONFLICT');
  });
});

describe('149 proposal safeguards (static inspection, NOT database execution)',()=>{
  const sql=readFileSync('docs/PTVPRO-ACCESS-149-PROPOSAL.sql','utf8');
  it('protects Root personnel and self edits before data changes',()=>{
    const rpc=sql.slice(sql.indexOf('CREATE FUNCTION ptv_access_private.update_crew_personnel'));
    expect(rpc.indexOf('Root personnel protected')).toBeLessThan(rpc.indexOf('UPDATE public.legacy_archive_kru'));
    expect(rpc).toContain('self personnel mutation forbidden');
  });
  it('requires recovery credentials and rejects ambiguous mappings',()=>{
    expect(sql).toContain('independent recovery administrator missing');
    for(const reason of ['explicit category reconciliation required','division reconciliation required','cohort reconciliation required','identity reconciliation required']) expect(sql).toContain(reason);
  });
  it('uses the same transaction lock and does not swallow failures',()=>{
    expect(sql.match(/pg_advisory_xact_lock\(149,1\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/EXCEPTION\s+WHEN/);
  });
  it('recovery retains trusted identity binding',()=>{
    const recovery=readFileSync('docs/PTVPRO-ACCESS-149-RLS-ROLLBACK.sql','utf8');
    expect(recovery).toContain('WHERE auth_user_id=auth.uid()');
    expect(recovery).not.toContain("v_claims ->> 'account_id'");
  });
  it('combined proposal has one transaction and current source hashes',()=>{
    const bundle=readFileSync('docs/PTVPRO-ACCESS-149-STAGING-BUNDLE.sql','utf8');
    expect(bundle.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(bundle.match(/^COMMIT;$/gm)).toHaveLength(1);
    for(const path of ['docs/PTVPRO-ACCESS-149-PROPOSAL.sql','docs/PTVPRO-ACCESS-149-RLS-PROPOSAL.sql']) {
      const hash=createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex');
      expect(bundle).toContain(`${path} sha256=${hash}`);
    }
  });
  it.each(['acara','broadcast','catatan','dokumen','kontak','lapor-kerusakan','lost-found','peminjaman','planner'])('%s uses live gates, not job/profile grants',name=>{
    const source=readFileSync(`api/${name}.ts`,'utf8');
    expect(source).toContain('await refreshLiveSession(session)');
    expect(source).not.toContain('userProfiles.includes');
    expect(source).not.toMatch(/\|\|\s*userCaps.includes\('hub.access'\)/);
  });
});
