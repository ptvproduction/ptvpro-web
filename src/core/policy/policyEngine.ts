/**
 * Authoritative Policy & Capability Engine
 * Implements Section 6.2 of docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md
 */

import { AppCapability, isMutationCapability } from './capabilities';
import { AccessProfile, PROFILE_CAPABILITIES } from './profiles';

export type AccountStatus = 'active' | 'inactive';
export type OrganizationStatus = 'active' | 'inactive' | 'archived';

export interface PermissionContext {
  status_akun: AccountStatus;
  status_organisasi: OrganizationStatus;
  assigned_profiles: readonly AccessProfile[];
  allowed_overrides: readonly AppCapability[];
  denied_overrides: readonly AppCapability[];
}

/**
 * Deterministic capability resolution algorithm.
 *
 * Evaluation Order:
 * 1. Account status must be active. Inactive account => false (cannot authenticate or act).
 * 2. Organization status:
 *    - 'archived' => false (archived identities are read-only relics/disabled).
 *    - 'inactive' => all mutation capabilities are strictly blocked (read-only alumni mode).
 * 3. Explicit user deny override => false (highest override priority).
 * 4. Explicit user allow override => true (permits granular capabilities e.g. finance.operator).
 * 5. Assigned profiles capability check.
 * 6. Default deny => false.
 */
export function hasCapability(
  context: PermissionContext | null | undefined,
  capability: AppCapability
): boolean {
  if (!context) {
    return false;
  }

  // 1. Inactive account rejects all capabilities
  if (context.status_akun !== 'active') {
    return false;
  }

  // 2. Archived accounts are completely disabled
  if (context.status_organisasi === 'archived') {
    return false;
  }

  // 3. Organization inactive users are strictly read-only
  if (context.status_organisasi === 'inactive' && isMutationCapability(capability)) {
    return false;
  }

  // 4. Explicit user-level deny override takes highest precedence
  if (context.denied_overrides.includes(capability)) {
    return false;
  }

  // 5. Explicit user-level allow override takes precedence over default role restrictions
  if (context.allowed_overrides.includes(capability)) {
    return true;
  }

  // 6. Check assigned access profiles
  for (const profile of context.assigned_profiles) {
    const profileSet = PROFILE_CAPABILITIES[profile];
    if (profileSet && profileSet.has(capability)) {
      return true;
    }
  }

  return false;
}

export function canAccessHub(context: PermissionContext | null | undefined): boolean {
  return hasCapability(context, 'hub.access');
}
