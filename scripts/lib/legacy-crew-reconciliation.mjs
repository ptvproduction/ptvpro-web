import { createHash } from 'node:crypto';

export function inspectLegacyPasswordHash(value) {
  if(value===null||value===undefined||value==='') return {format:'absent',structuralValid:false,runtimeCompatible:false};
  const match=typeof value==='string' ? value.match(/^\$(2[aby])\$(\d{2})\$[./A-Za-z0-9]{53}$/) : null;
  if(!match || Number(match[2])<4 || Number(match[2])>31) return {format:'unknown_or_malformed',structuralValid:false,runtimeCompatible:false};
  return {format:`bcrypt_${match[1]}`,cost:Number(match[2]),structuralValid:true,runtimeCompatible:false,requiresKnownAnswerVerifierTest:true};
}

export function crewArchiveSourceKey(row) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = [row.id, row.production_id].filter(v => v !== undefined && v !== null && v !== '').map(v => String(v).trim().toLowerCase());
  if (!ids.length || ids.some(id => !uuid.test(id)) || new Set(ids).size !== 1) throw new Error('Legacy crew UUID missing or conflicting; manual reconciliation required.');
  return `ptv_kru:${ids[0]}`;
}

export function reconcileLegacySnapshot(snapshot) {
  const { legacy, staging } = snapshot;
  const statusCounts = { VERIFIED: 0, AMBIGUOUS: 0, UNMATCHED: 0, DUPLICATE: 0 };
  const queue = staging.archives.map(a => {
    const sources = legacy.filter(l => a.legacy_ref && l.legacy_ref === a.legacy_ref);
    const duplicates = staging.archives.filter(other => (a.legacy_ref && other.legacy_ref === a.legacy_ref) || (a.ptv_ref && other.ptv_ref === a.ptv_ref));
    const reasons = [];
    let status = 'VERIFIED';
    if (duplicates.length > 1) { status = 'DUPLICATE'; reasons.push('REPEATED_LEGACY_UUID_OR_PTV_ID'); }
    else if (!sources.length) { status = 'UNMATCHED'; reasons.push('NO_LEGACY_UUID_MATCH'); }
    else if (sources.length !== 1 || !a.ptv_ref || sources[0].ptv_ref !== a.ptv_ref
      || (a.wp_ref && sources[0].wp_ref && a.wp_ref !== sources[0].wp_ref)
      || (a.oauth_ref && sources[0].oauth_ref && (a.oauth_ref !== sources[0].oauth_ref || a.oauth_provider !== sources[0].oauth_provider))) {
      status = 'AMBIGUOUS'; reasons.push('CONFLICTING_IMMUTABLE_EVIDENCE');
    }
    const source = sources.length === 1 ? sources[0] : null;
    if (a.test_created || a.quarantined) { if (status === 'VERIFIED') status = 'AMBIGUOUS'; reasons.push('TEST_OR_QUARANTINED_ARCHIVE'); }
    const candidates = staging.identities.filter(i => a.ptv_ref && i.ptv_ref === a.ptv_ref);
    const linked = a.canonical_ref ? staging.identities.find(i => i.identity_ref === a.canonical_ref) : null;
    const conflicts = a.canonical_ref && (!linked || linked.ptv_ref !== a.ptv_ref);
    if (conflicts && status === 'VERIFIED') { status = 'AMBIGUOUS'; reasons.push('EXISTING_CANONICAL_LINK_CONFLICT'); }
    statusCounts[status]++;
    return { archiveRef: a.archive_ref, archiveVersion:a.archive_version || null, legacyRef: source?.legacy_ref || null, legacyVersion:source?.updated_at || null, status,
      verifiedScope: status === 'VERIFIED' ? 'LEGACY_UUID_TO_ARCHIVE_PROVENANCE_ONLY' : null,
      canonicalStatus: a.canonical_ref ? (conflicts ? 'AMBIGUOUS' : 'REQUIRES_PROVENANCE_REVIEW') : 'UNMATCHED',
      canonicalCandidateRefs: candidates.map(i => i.identity_ref), currentCanonicalRef: a.canonical_ref || null,
      accountIntent: source?.has_password || source?.oauth_ref ? 'PRESERVE_EXISTING_CREDENTIALS_AFTER_REVIEW'
        : source?.role === 'member' ? 'PERSONNEL_ONLY_UNLESS_LOGIN_PROVEN' : 'REVIEW_LOGIN_INTENT',
      automaticLinkAllowed: false, reasons };
  }).sort((a,b) => a.archiveRef.localeCompare(b.archiveRef));
  const accountQueue = staging.accounts.map(a => {
    const identity = staging.identities.find(i => i.identity_ref === a.identity_ref);
    const trusted = legacy.filter(l => a.oauth_ref && a.oauth_provider && l.oauth_ref === a.oauth_ref && l.oauth_provider === a.oauth_provider);
    const hints = legacy.filter(l => (a.username_ref && l.username_ref === a.username_ref) || (a.email_hint_ref && l.email_hint_ref === a.email_hint_ref));
    return { accountRef:a.account_ref, accountVersion:a.version, identityRef:a.identity_ref, status:trusted.length === 1 ? 'VERIFIED' : trusted.length > 1 ? 'AMBIGUOUS' : 'UNMATCHED',
      verifiedScope:trusted.length === 1 ? 'EXISTING_OAUTH_SUBJECT_BINDING_ONLY' : null,
      legacyRefs:trusted.map(l=>l.legacy_ref), hintOnlyLegacyRefs:hints.map(l=>l.legacy_ref),
      nativeAuthBound:!!a.auth_ref, credentialPresent:!!(a.has_password||a.oauth_ref), profiles:a.profiles || [], overrides:a.overrides || [], accountStatus:a.status,
      membershipCount:staging.memberships.filter(m=>m.identity_ref===a.identity_ref&&m.current&&m.organization==='ptv_studio').length,
      identityPresent:!!identity, automaticLinkAllowed:false };
  }).sort((a,b)=>a.accountRef.localeCompare(b.accountRef));
  return { schemaVersion:2, capturedAt:snapshot.capturedAt, sources:snapshot.sources,
    classificationScope:'Archive classification proves provenance only; canonical/account migration remains separate and requires operator approval.',
    counts:{ archiveRows:queue.length, archiveCategories:statusCounts, legacyPersonnel:legacy.length,
      uniqueLegacyUUIDsCovered:new Set(queue.filter(q=>q.legacyRef).map(q=>q.legacyRef)).size,
      legacyCredentialCandidates:legacy.filter(l=>l.has_password||l.oauth_ref).length,
      legacyWithoutCredentialEvidence:legacy.filter(l=>!l.has_password&&!l.oauth_ref).length,
      canonicalIdentities:staging.identities.length, linkedArchives:staging.archives.filter(a=>a.canonical_ref).length,
      accountRows:accountQueue.length, accountCategories:Object.fromEntries(Object.keys(statusCounts).map(status=>[status,accountQueue.filter(a=>a.status===status).length])) },
    recovery:{ rootAssignments:staging.accounts.filter(a=>(a.profiles||[]).includes('root_executive')).length,
      portalRecoveryLoginProven:false, preserveAllExistingAccounts:true }, queue, accountQueue };
}

export function evidenceFingerprint(snapshot) {
  // Preserve ordering independently of connector query order.
  const canonical = value => Array.isArray(value) ? value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex');
}
