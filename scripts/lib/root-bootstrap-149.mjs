import { createHash, createPublicKey, verify } from 'node:crypto';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=/^[0-9a-f]{64}$/;
function exact(value,keys) {
  if(!value || Array.isArray(value) || typeof value!=='object' || Object.keys(value).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(value,k))) throw new Error('Invalid bootstrap manifest fields.');
}
export function validateBootstrapPlan(plan,now=Date.now()) {
  exact(plan,['version','projectRef','databaseSystemIdentifier','purpose','issuedAt','expiresAt','approvalReference','independenceEvidenceSha256','portalE2EEvidenceSha256','independentOwnersConfirmed','templateSha256','expectedRootCapabilities','root','recovery']);
  if(plan.version!==1 || plan.projectRef!=='swadgljnyelsjstqqxbm' || typeof plan.databaseSystemIdentifier!=='string' || !/^[0-9]{10,25}$/.test(plan.databaseSystemIdentifier) || plan.purpose!=='first_root_bootstrap' || plan.independentOwnersConfirmed!==true
    || !hash.test(plan.independenceEvidenceSha256) || !hash.test(plan.portalE2EEvidenceSha256) || !hash.test(plan.templateSha256)
    || !Array.isArray(plan.expectedRootCapabilities) || !plan.expectedRootCapabilities.includes('hub.access') || !plan.expectedRootCapabilities.includes('crew.permissions.manage')
    || plan.expectedRootCapabilities.some(c=>typeof c!=='string'||!/^[a-z0-9_.]+$/.test(c)) || new Set(plan.expectedRootCapabilities).size!==plan.expectedRootCapabilities.length
    || typeof plan.approvalReference!=='string' || !/^[a-zA-Z0-9_/-]{8,100}$/.test(plan.approvalReference)) throw new Error('Operator review and independent login evidence required.');
  const issued=Date.parse(plan.issuedAt),expires=Date.parse(plan.expiresAt);
  if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now||expires<=now||expires<=issued||expires-issued>86400000) throw new Error('Bootstrap approval expired or invalid.');
  for(const target of [plan.root,plan.recovery]) {
    exact(target,['accountId','identityId','accountVersion','credentialVersion','loginProofId','expectedProfiles','expectedOverrides']);
    if(!uuid.test(target.accountId)||!uuid.test(target.identityId)||!/^\d+$/.test(target.loginProofId)
      || !Number.isFinite(Date.parse(target.accountVersion))||!Number.isFinite(Date.parse(target.credentialVersion))
      || !Array.isArray(target.expectedProfiles)||target.expectedProfiles.some(p=>typeof p!=='string'||!/^[a-z_]+$/.test(p))
      || new Set(target.expectedProfiles).size!==target.expectedProfiles.length||target.expectedProfiles.includes('root_executive')
      || !Array.isArray(target.expectedOverrides)) throw new Error('Invalid selected account snapshot.');
    for(const override of target.expectedOverrides) {
      exact(override,['capability','type']);
      if(typeof override.capability!=='string'||!/^[a-z0-9_.]+$/.test(override.capability)||!['allow','deny'].includes(override.type)) throw new Error('Invalid override snapshot.');
    }
  }
  if(plan.root.accountId.toLowerCase()===plan.recovery.accountId.toLowerCase()||plan.root.identityId.toLowerCase()===plan.recovery.identityId.toLowerCase()
    || plan.root.loginProofId===plan.recovery.loginProofId) throw new Error('Root and recovery must be independent.');
  return plan;
}
function verifyApproval(manifestBytes,signatureBase64,trust) {
  if(trust.version!==1 || !Array.isArray(trust.authorizedEd25519PublicKeysPem) || !trust.authorizedEd25519PublicKeysPem.length) throw new Error('No trusted operator approval key configured.');
  const signature=Buffer.from(signatureBase64.trim(),'base64');
  if(signature.length!==64) throw new Error('Invalid operator approval signature.');
  let approverFingerprint;
  for(const pem of trust.authorizedEd25519PublicKeysPem) {
    const key=createPublicKey(pem);
    if(key.asymmetricKeyType!=='ed25519') throw new Error('Only trusted Ed25519 approval keys are supported.');
    if(verify(null,manifestBytes,key,signature)) approverFingerprint=createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
  }
  if(!approverFingerprint) throw new Error('Operator approval signature is not trusted.');
  return {plan:JSON.parse(manifestBytes.toString('utf8')),approverFingerprint};
}
function renderEnvelope(plan,manifestBytes,approverFingerprint,template) {
  if(createHash('sha256').update(template).digest('hex')!==plan.templateSha256) throw new Error('Approved SQL template has changed.');
  const envelope={...plan,approvalSha256:createHash('sha256').update(manifestBytes).digest('hex'),approverKeySha256:approverFingerprint};
  if(template.split('__APPROVED_BOOTSTRAP_JSON__').length!==2) throw new Error('Bootstrap template marker mismatch.');
  // SQL single-quoted JSON; UUID/evidence only, never credentials or a supplied operator identity.
  return template.replace('__APPROVED_BOOTSTRAP_JSON__',JSON.stringify(envelope).replaceAll("'","''"));
}
export function renderApprovedBootstrap(manifestBytes,signatureBase64,trust,template,now=Date.now()) {
  const verified=verifyApproval(manifestBytes,signatureBase64,trust);
  return renderEnvelope(validateBootstrapPlan(verified.plan,now),manifestBytes,verified.approverFingerprint,template);
}
export function renderApprovedBootstrapRevert(manifestBytes,signatureBase64,trust,template,now=Date.now()) {
  const {plan,approverFingerprint}=verifyApproval(manifestBytes,signatureBase64,trust);
  exact(plan,['version','projectRef','databaseSystemIdentifier','purpose','issuedAt','expiresAt','approvalReference','templateSha256','bootstrapEventId']);
  if(plan.version!==1||plan.projectRef!=='swadgljnyelsjstqqxbm'||plan.purpose!=='first_root_bootstrap_revert'
    || !/^[0-9]{10,25}$/.test(plan.databaseSystemIdentifier)||!/^\d+$/.test(plan.bootstrapEventId)||!hash.test(plan.templateSha256)
    || typeof plan.approvalReference!=='string'||!/^[a-zA-Z0-9_/-]{8,100}$/.test(plan.approvalReference)
    || !Number.isFinite(Date.parse(plan.issuedAt))||!Number.isFinite(Date.parse(plan.expiresAt))||Date.parse(plan.issuedAt)>now
    || Date.parse(plan.expiresAt)<=now||Date.parse(plan.expiresAt)<=Date.parse(plan.issuedAt)||Date.parse(plan.expiresAt)-Date.parse(plan.issuedAt)>86400000) throw new Error('Invalid separate revert approval.');
  return renderEnvelope(plan,manifestBytes,approverFingerprint,template);
}
