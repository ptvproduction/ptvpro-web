export interface ArchiveLinkInput { archiveId: string; ptvId: string; canonicalId: string | null }
export interface IdentityLinkInput { id: string; ptvId: string }
export interface MembershipLinkInput { identityId: string; current: boolean; organizationId: string }
export interface AccountLinkInput { id: string; identityId: string }

/** Review queue only. Matching IDs do not authorize a link or create an account. */
export function planIdentityReconciliation(archives: ArchiveLinkInput[], identities: IdentityLinkInput[],
  memberships: MembershipLinkInput[], accounts: AccountLinkInput[]) {
  return archives.map(row => {
    const reasons: string[] = [];
    const matches = identities.filter(i => i.ptvId === row.ptvId);
    if (!row.ptvId || archives.filter(a => a.ptvId === row.ptvId).length !== 1) reasons.push('DUPLICATE_OR_MISSING_PTV_ID');
    if (matches.length !== 1) reasons.push('CANONICAL_MATCH_NOT_UNIQUE');
    const candidate = matches.length === 1 ? matches[0].id : null;
    if (row.canonicalId && row.canonicalId !== candidate) reasons.push('EXISTING_LINK_CONFLICT');
    if (candidate && archives.some(a => a.archiveId !== row.archiveId && a.canonicalId === candidate)) reasons.push('CANONICAL_ALREADY_LINKED');
    if (candidate && memberships.filter(m => m.identityId === candidate && m.current && m.organizationId === 'ptv_studio').length !== 1) reasons.push('MEMBERSHIP_NOT_UNIQUE');
    const linkedAccounts = candidate ? accounts.filter(a => a.identityId === candidate) : [];
    // A personnel identity does not require a login account.
    if (linkedAccounts.length > 1) reasons.push('ACCOUNT_NOT_UNIQUE_OR_MISSING');
    return { archiveId: row.archiveId, candidateIdentityId: candidate, accountIds: linkedAccounts.map(a => a.id),
      status: reasons.length ? 'MANUAL_RECONCILIATION' as const : 'REQUIRES_OPERATOR_REVIEW' as const, reasons };
  });
}
