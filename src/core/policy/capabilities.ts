/**
 * Authoritative PTV PRO Capability Registry
 * Extracted from docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md (Section 6.1)
 */

export const ALL_CAPABILITIES = [
  'hub.access',
  'events.view',
  'events.create',
  'events.edit',
  'events.delete',
  'events.rundown.manage',
  'calendar.view',
  'inventory.view',
  'inventory.create',
  'inventory.edit',
  'inventory.delete',
  'inventory.units.manage',
  'inventory.valuation.view',
  'inventory.valuation.manage',
  'loans.view',
  'loans.checkout',
  'loans.return',
  'loans.manage',
  'damage.view',
  'damage.report',
  'damage.qc.approve',
  'lostfound.view',
  'lostfound.report',
  'lostfound.manage',
  'crew.view',
  'crew.create',
  'crew.edit',
  'crew.status.manage',
  'crew.permissions.manage',
  'id.view',
  'id.export',
  'documents.view',
  'documents.request',
  'documents.generate',
  'documents.approve',
  'documents.archive.view',
  'documents.archive.manage',
  'finance.view',
  'finance.manage',
  'finance.operator',
  'contacts.internal.view',
  'contacts.external.view',
  'contacts.external.manage',
  'broadcast.view',
  'broadcast.dispatch',
  'projecthaul.view',
  'projecthaul.manage',
  'notes.view',
  'notes.create',
  'notes.manage',
  'settings.personal',
  'settings.system',
  'audit.logs.view',
] as const;

export type AppCapability = (typeof ALL_CAPABILITIES)[number];

/**
 * Mutation capabilities that modify state.
 * Inactive organization members are restricted to read-only access
 * and are strictly prohibited from performing mutation actions.
 */
export const MUTATION_CAPABILITIES: ReadonlySet<AppCapability> = new Set<AppCapability>([
  'events.create',
  'events.edit',
  'events.delete',
  'events.rundown.manage',
  'inventory.create',
  'inventory.edit',
  'inventory.delete',
  'inventory.units.manage',
  'inventory.valuation.manage',
  'loans.checkout',
  'loans.return',
  'loans.manage',
  'damage.report',
  'damage.qc.approve',
  'lostfound.report',
  'lostfound.manage',
  'crew.create',
  'crew.edit',
  'crew.status.manage',
  'crew.permissions.manage',
  'documents.request',
  'documents.generate',
  'documents.approve',
  'documents.archive.manage',
  'finance.manage',
  'finance.operator',
  'contacts.external.manage',
  'broadcast.dispatch',
  'projecthaul.manage',
  'notes.create',
  'notes.manage',
  'settings.system',
]);

export function isMutationCapability(capability: AppCapability): boolean {
  return MUTATION_CAPABILITIES.has(capability);
}
