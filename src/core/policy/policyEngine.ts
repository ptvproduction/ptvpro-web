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
  capabilities?: readonly AppCapability[];
  capabilities_verified_live?: boolean;
  category?: string;
  kategori?: string;
  kategori_personel?: string;
}

/**
 * Deterministic capability resolution algorithm.
 *
 * Evaluation Order:
 * 1. Account status must be active. Inactive account => false (cannot authenticate or act).
 * 2. Organization status:
 *    - 'archived' => false (archived identities are disabled).
 *    - 'inactive' => all mutation capabilities are strictly blocked (read-only alumni mode).
 * 3. Explicit user deny override => false (highest override priority, applies to all profiles).
 * 4. Finance restriction: Pembina/Pengarah blocked from studio finance.
 * 5. Root Executive profile retain full remaining authority.
 * 6. Explicit user allow override => true (permits granular capabilities).
 * 7. Assigned profiles and position capability check.
 * 8. Direct capabilities check (fail-closed fallback).
 * 9. Default deny => false.
 */
export function hasCapability(
  context: PermissionContext | null | undefined,
  capability: AppCapability
): boolean {
  if (!context || typeof context !== 'object') {
    return false;
  }

  // 1. Inactive account rejects all capabilities (Fail-closed)
  if (context.status_akun !== 'active') {
    return false;
  }

  // 2. Archived accounts are completely disabled
  if (context.status_organisasi === 'archived') {
    return false;
  }

  // 3. Organization inactive users are strictly read-only (mutations blocked)
  if (context.status_organisasi === 'inactive' && isMutationCapability(capability)) {
    return false;
  }

  // 4. Explicit user-level deny override takes highest precedence (Fail-closed, overrides root)
  const deniedOverrides = Array.isArray(context.denied_overrides) ? context.denied_overrides : [];
  if (deniedOverrides.includes(capability)) {
    return false;
  }

  // 5. ATURAN AKSES KEUANGAN: Personel berkategori Pembina atau Pengarah dilarang keras
  // mengakses capability keuangan studio (finance.*), independen dari jabatan atau role portal.
  if (capability.startsWith('finance.') && capability !== 'finance.view_own') {
    const rawCategory = (context.category || context.kategori || context.kategori_personel || '').toLowerCase().trim();
    if (rawCategory === 'pembina' || rawCategory === 'pengarah') {
      return false; // Fail-closed: Kategori Pembina/Pengarah ditolak mutlak dari keuangan studio
    }
  }

  const assignedProfiles: readonly AccessProfile[] = Array.isArray(context.assigned_profiles)
    ? context.assigned_profiles
    : [];

  // 6. Root Executive retain full remaining authority
  if (assignedProfiles.includes('root_executive')) {
    return true;
  }

  // 7. Explicit user-level allow override takes precedence over default role restrictions
  const allowedOverrides = Array.isArray(context.allowed_overrides) ? context.allowed_overrides : [];
  if (allowedOverrides.includes(capability)) {
    return true;
  }

  // 8. Kas Saya is derived from operational membership
  if (capability === 'finance.view_own') {
    const rawCat = (context.category || context.kategori || context.kategori_personel || '').toLowerCase().trim();
    if (context.status_organisasi !== 'active' || rawCat === 'pembina' || rawCat === 'pengarah') {
      return false;
    }
    if (assignedProfiles.includes('pembina')) {
      return false;
    }
    return (
      assignedProfiles.includes('crew') ||
      assignedProfiles.includes('eksekutif') ||
      assignedProfiles.includes('root_executive')
    );
  }

  if (context.capabilities_verified_live) {
    return Array.isArray(context.capabilities) && context.capabilities.includes(capability);
  }

  // 9. Check assigned profiles against static profile capabilities catalog
  for (const profile of assignedProfiles) {
    const profileCaps = PROFILE_CAPABILITIES[profile];
    if (profileCaps && profileCaps.has(capability)) {
      return true;
    }
  }

  // 10. Direct capability fallback list check
  const directCapabilities = Array.isArray(context.capabilities) ? context.capabilities : [];
  if (directCapabilities.includes(capability)) {
    return true;
  }

  // 11. Fail-closed: Default deny
  return false;
}

/**
 * Compute the complete set of effective capabilities for an entity context.
 */
export function getEffectiveCapabilities(
  context: PermissionContext | null | undefined
): Set<AppCapability> {
  const result = new Set<AppCapability>();
  if (!context || context.status_akun !== 'active') {
    return result;
  }

  const assignedProfiles: readonly AccessProfile[] = Array.isArray(context.assigned_profiles)
    ? context.assigned_profiles
    : [];

  // Root has everything
  if (assignedProfiles.includes('root_executive')) {
    const all = new Set<AppCapability>();
    for (const caps of Object.values(PROFILE_CAPABILITIES)) {
      for (const c of caps) {
        if (hasCapability(context, c)) all.add(c);
      }
    }
    return all;
  }

  if (context.capabilities_verified_live && Array.isArray(context.capabilities)) {
    for (const cap of context.capabilities) {
      if (hasCapability(context, cap)) {
        result.add(cap);
      }
    }
    return result;
  }

  for (const profile of assignedProfiles) {
    const profileCaps = PROFILE_CAPABILITIES[profile];
    if (profileCaps) {
      for (const cap of profileCaps) {
        if (hasCapability(context, cap)) {
          result.add(cap);
        }
      }
    }
  }

  for (const cap of context.allowed_overrides || []) {
    if (hasCapability(context, cap)) {
      result.add(cap);
    }
  }

  return result;
}

export function canAccessHub(context: PermissionContext | null | undefined): boolean {
  return hasCapability(context, 'hub.access');
}
