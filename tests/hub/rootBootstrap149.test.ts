import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderApprovedBootstrap,renderApprovedBootstrapRevert, validateBootstrapPlan } from '../../scripts/lib/root-bootstrap-149.mjs';
import { inspectLegacyPasswordHash } from '../../scripts/lib/legacy-crew-reconciliation.mjs';
import { recordPortalLoginProof } from '../../api/auth/_utils/loginProof';
import callback from '../../api/auth/google/callback';
import { createHmacState } from '../../api/auth/_utils/crypto';

const db=vi.hoisted(()=>({from:vi.fn()}));
const live=vi.hoisted(()=>vi.fn());
vi.mock('@supabase/supabase-js',()=>({createClient:()=>db}));
vi.mock('../../api/auth/_utils/liveAccess',()=>({resolveLiveAccess:live}));
const template=readFileSync('docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-TEMPLATE.sql','utf8');
const now=Date.now();
function target(n:number) {return {accountId:`00000000-0000-4000-8000-00000000000${n}`,identityId:`10000000-0000-4000-8000-00000000000${n}`,accountVersion:new Date(now-10000).toISOString(),credentialVersion:new Date(now-10000).toISOString(),loginProofId:String(n),expectedProfiles:['crew'],expectedOverrides:[]};}
function plan() {return {version:1,projectRef:'swadgljnyelsjstqqxbm',databaseSystemIdentifier:'1234567890123456789',purpose:'first_root_bootstrap',issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),approvalReference:'ACC-BOOTSTRAP-149',independenceEvidenceSha256:'a'.repeat(64),portalE2EEvidenceSha256:'b'.repeat(64),independentOwnersConfirmed:true,templateSha256:createHash('sha256').update(template).digest('hex'),expectedRootCapabilities:['hub.access','crew.permissions.manage'],root:target(1),recovery:target(2)};}
function approve(p:any) {
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const bytes=Buffer.from(JSON.stringify(p));
  return {bytes,signature:sign(null,bytes,privateKey).toString('base64'),trust:{version:1,authorizedEd25519PublicKeysPem:[publicKey.export({type:'spki',format:'pem'})]}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();db.from.mockReset();live.mockReset();});

describe('Root is a new-system profile; bootstrap approval is offline and explicit',()=>{
  it('ships with no selected account or trusted approval key',()=>{
    expect(JSON.parse(readFileSync('config/access-bootstrap-trust.json','utf8')).authorizedEd25519PublicKeysPem).toEqual([]);
    expect(template).toContain('__APPROVED_BOOTSTRAP_JSON__');
  });
  it('only a trusted detached signature renders the reviewed SQL template',()=>{
    const a=approve(plan());const output=renderApprovedBootstrap(a.bytes,a.signature,a.trust,template,now);
    expect(output).not.toContain('__APPROVED_BOOTSTRAP_JSON__');expect(output).toContain('approverKeySha256');
  });
  it('rejects unsigned approval and an untrusted signing key',()=>{
    const a=approve(plan()),other=approve(plan());
    expect(()=>renderApprovedBootstrap(a.bytes,a.signature,{version:1,authorizedEd25519PublicKeysPem:[]},template,now)).toThrow('No trusted');
    expect(()=>renderApprovedBootstrap(a.bytes,a.signature,other.trust,template,now)).toThrow('not trusted');
  });
  it('rejects changed account selection or SQL after signing',()=>{
    const a=approve(plan()),p=plan();p.root=target(3);
    expect(()=>renderApprovedBootstrap(Buffer.from(JSON.stringify(p)),a.signature,a.trust,template,now)).toThrow('not trusted');
    expect(()=>renderApprovedBootstrap(a.bytes,a.signature,a.trust,template+'\n-- changed',now)).toThrow('template has changed');
  });
  it.each(['operatorId','email','password','legacyRole','position'])('rejects untrusted %s rather than deriving a Root owner',key=>{
    expect(()=>validateBootstrapPlan({...plan(),[key]:'ignored-input'},now)).toThrow('fields');
  });
  it.each(['accountId','identityId','loginProofId'])('two records sharing %s are not independent',key=>{
    const p:any=plan();p.recovery[key]=p.root[key];expect(()=>validateBootstrapPlan(p,now)).toThrow('independent');
  });
  it.each(['projectRef','databaseSystemIdentifier','independenceEvidenceSha256','portalE2EEvidenceSha256'])('rejects invalid %s evidence',key=>{
    expect(()=>validateBootstrapPlan({...plan(),[key]:'invalid'},now)).toThrow();
  });
  it('rejects expired approvals, excess lifetime, unknown targets and implicit Root',()=>{
    expect(()=>validateBootstrapPlan({...plan(),expiresAt:new Date(now-1).toISOString()},now)).toThrow('expired');
    expect(()=>validateBootstrapPlan({...plan(),expiresAt:new Date(now+86400001).toISOString()},now)).toThrow('expired');
    const p=plan();p.root.expectedProfiles=['root_executive'];expect(()=>validateBootstrapPlan(p,now)).toThrow('snapshot');
  });
  it('reverting requires its own signed purpose and cannot select another Root account',()=>{
    const revertTemplate=readFileSync('docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-REVERT-TEMPLATE.sql','utf8');
    const original=approve(plan());
    expect(()=>renderApprovedBootstrapRevert(original.bytes,original.signature,original.trust,revertTemplate,now)).toThrow();
    const revertPlan={version:1,projectRef:plan().projectRef,databaseSystemIdentifier:plan().databaseSystemIdentifier,purpose:'first_root_bootstrap_revert',issuedAt:plan().issuedAt,expiresAt:plan().expiresAt,approvalReference:'ACC-REVERT-149',templateSha256:createHash('sha256').update(revertTemplate).digest('hex'),bootstrapEventId:'123'};
    const a=approve(revertPlan);expect(renderApprovedBootstrapRevert(a.bytes,a.signature,a.trust,revertTemplate,now)).not.toContain('__APPROVED_BOOTSTRAP_JSON__');
    expect(revertTemplate).toContain("root_id:=(original->>'root_account_id')::uuid");
  });
});

describe('bootstrap SQL gates (static, actual SQL fixture results are separate)',()=>{
  it('leaves no function/RPC/role for future bootstrap calls',()=>{
    expect(template).not.toMatch(/CREATE\s+(?:OR REPLACE\s+)?(?:FUNCTION|ROLE|POLICY)/i);
    expect(template).toContain("session_user<>'postgres'");expect(template).toContain("current_user<>'postgres'");
    expect(template).toContain('request.jwt.claims');expect(template).toContain('pg_control_system()');
  });
  it('locks, consumes the marker permanently and audits the database principal',()=>{
    for(const value of ['pg_advisory_xact_lock(149,1)','SHARE ROW EXCLUSIVE','root_bootstrap_completed','root_bootstrap_rolled_back',"'db_session_user',session_user"]) expect(template).toContain(value);
    expect(template).not.toContain("plan->>'operatorId'");expect(template).toContain("VALUES(NULL,'root_bootstrap_completed'");
  });
  it('requires proof and independent credentials; never creates/activates accounts or rewrites overrides',()=>{
    for(const value of ['rc.oauth_subject_id IS NOT DISTINCT FROM bc.oauth_subject_id','r.identity_id=b.identity_id','fresh verified portal login required','Root deny override prevents recovery']) expect(template).toContain(value);
    expect(template).not.toMatch(/INSERT INTO public\.(?:user_account|auth_credentials|canonical_identity)|SET status_akun|DELETE FROM public\.account_capability_overrides/);
  });
  it('prebootstrap bundle keeps mutation functions closed, normal bundle requires recovery',()=>{
    const pre=readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8');
    expect(pre).not.toMatch(/^GRANT EXECUTE/m);expect(pre).toContain('REVOKE ALL ON FUNCTION public.rpc_manage_account_access');
    expect(pre).not.toContain('DO $$ BEGIN PERFORM ptv_access_private.assert_recovery(); END $$;');
    expect(readFileSync('docs/PTVPRO-ACCESS-149-STAGING-BUNDLE.sql','utf8')).toContain('DO $$ BEGIN PERFORM ptv_access_private.assert_recovery(); END $$;');
  });
  it('runtime recovery is pinned to an approved pair and credential versions',()=>{
    const sql=readFileSync('docs/PTVPRO-ACCESS-149-PROPOSAL.sql','utf8');
    for(const value of ['bootstrap recovery attestation missing','rc.oauth_subject_id<>bc.oauth_subject_id','root_credential_version','recovery_credential_version','usable_google_login(r.id)']) expect(sql).toContain(value);
  });
});

describe('server login evidence does not contain credentials or supplied operator identity',()=>{
  async function proof(error=false,subject='verified-subject') {
    vi.stubEnv('VITE_SUPABASE_URL','https://swadgljnyelsjstqqxbm.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-unit-key');
    live.mockResolvedValue({account:{id:'account'},identity:{id:'identity'}});
    const insert=vi.fn().mockResolvedValue({error:error?{message:'unavailable'}:null});
    const q:any={select:()=>q,eq:()=>q,single:async()=>({data:{oauth_provider:'google',oauth_subject_id:subject,updated_at:new Date(now).toISOString()},error:null})};
    db.from.mockImplementation(table=>table==='auth_credentials'?q:{insert});
    return {insert,call:()=>recordPortalLoginProof({account_id:'account',identity_id:'identity',iat:Math.floor(now/1000)} as never,'verified-subject')};
  }
  it('records only the account, canonical actor, route and credential version',async()=>{
    const p=await proof();await p.call();const row=p.insert.mock.calls[0][0];
    expect(row.actor_id).toBe('identity');expect(row.event_type).toBe('portal_login_verified');
    expect(JSON.stringify(row)).not.toContain('verified-subject');expect(row.metadata).not.toHaveProperty('password');
  });
  it('rejects subject mismatch before recording evidence',async()=>{
    const p=await proof(false,'other-subject');await expect(p.call()).rejects.toThrow();expect(p.insert).not.toHaveBeenCalled();
  });
  it('fails closed when audit insertion fails',async()=>{
    const p=await proof(true);await expect(p.call()).rejects.toThrow('login proof unavailable');
  });
  it('a dev mock flag never authorizes a live Google identity',async()=>{
    vi.stubEnv('AUTH_SECRET','unit-oauth-state-secret');vi.stubEnv('NODE_ENV','development');vi.stubEnv('ENABLE_DEV_MOCK_AUTH','true');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-unit-key');
    vi.stubEnv('GOOGLE_CLIENT_ID','');vi.stubEnv('GOOGLE_CLIENT_SECRET','');
    const state=createHmacState({returnTo:'/hub',timestamp:now,nonce:'nonce'},'unit-oauth-state-secret');
    const req:any={method:'GET',url:`/api/auth/google/callback?code=mock-auth-code&mock_sub=arbitrary&state=${state}`,headers:{host:'localhost:5174',cookie:`ptv_oauth_state=${state}:verifier`}};
    const headers:any={};const res:any={statusCode:0,setHeader:(k:string,v:any)=>{headers[k]=v;},getHeader:(k:string)=>headers[k],end:vi.fn()};
    await callback(req,res);expect(headers.Location).not.toContain('auth_status=success');
    expect(String(headers['Set-Cookie']||'')).not.toContain('ptv_hub_session=');
  });
});

describe('legacy bcrypt format is not a compatibility claim',()=>{
  it.each(['2y','2a','2b'])('recognizes %s structure without enabling the password path',prefix=>{
    expect(inspectLegacyPasswordHash(`$${prefix}$10$${'A'.repeat(53)}`)).toMatchObject({format:`bcrypt_${prefix}`,cost:10,structuralValid:true,runtimeCompatible:false});
  });
  it.each([null,'','plaintext-value','$2y$00$bad','$2y$10$short'])('does not accept absent or malformed credential input',value=>{
    expect(inspectLegacyPasswordHash(value).structuralValid).toBe(false);
  });
});
