/**
 * Authoritative Policy & Capability Engine
 * Implements Section 6.2 of docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md
 */

import { AppCapability } from './capabilities';
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
 * 1. Root protection: Root profile always retains full authority.
 * 2. Account status must be active. Inactive account => false (cannot authenticate or act).
 * 3. Status kru dan akun independen: Kru yang sudah purna/lulus/nonaktif tetap boleh login
 *    selama status akunnya aktif dan memiliki izin akses.
 * 4. Explicit user deny override => false (highest override priority).
 * 5. Explicit user allow override => true (permits granular capabilities).
 * 6. Assigned profiles and position capability check.
 * 7. Direct capabilities check (fail-closed fallback).
 * 8. Default deny => false.
 */
export function hasCapability(
  context: PermissionContext | null | undefined,
  capability: AppCapability
): boolean {
  if (!context || typeof context !== 'object') {
    return false;
  }

  const assignedProfiles: readonly AccessProfile[] = Array.isArray(context.assigned_profiles)
    ? context.assigned_profiles
    : [];

  // 1. Root protection: ROOT account never loses access
  if (assignedProfiles.includes('root_executive')) {
    return true;
  }

  // 2. Inactive account rejects all capabilities (Fail-closed)
  if (context.status_akun !== 'active') {
    return false;
  }

  // 3. ATURAN AKSES KEUANGAN: Personel berkategori Pembina atau Pengarah dilarang keras
  // mengakses capability keuangan studio (finance.*), independen dari jabatan atau role portal.
  if (capability.startsWith('finance.') && capability !== 'finance.view_own') {
    const rawCategory = (context.category || context.kategori || context.kategori_personel || '').toLowerCase().trim();
    if (rawCategory === 'pembina' || rawCategory === 'pengarah') {
      return false; // Fail-closed: Kategori Pembina/Pengarah ditolak mutlak dari keuangan studio
    }
  }

  // 4. Explicit user-level deny override takes highest precedence (Fail-closed)
  const deniedOverrides = Array.isArray(context.denied_overrides) ? context.denied_overrides : [];
  if (deniedOverrides.includes(capability)) {
    return false;
  }

  // 5. Explicit user-level allow override takes precedence over default role restrictions
  const allowedOverrides = Array.isArray(context.allowed_overrides) ? context.allowed_overrides : [];
  if (allowedOverrides.includes(capability)) {
    return true;
  }

  // 6. Kas Saya is derived from operational membership
  if (context.capabilities_verified_live && capability === 'finance.view_own') {
    return !assignedProfiles.includes('pembina')
      && (assignedProfiles.includes('crew') || assignedProfiles.includes('eksekutif') || assignedProfiles.includes('root_executive'));
  }

  if (context.capabilities_verified_live) {
    return Array.isArray(context.capabilities) && context.capabilities.includes(capability);
  }

  // 6b. Synthesized capability resolution for finance.view_own
  if (capability === 'finance.view_own') {
    if (assignedProfiles.includes('pembina') && !assignedProfiles.includes('crew') && !assignedProfiles.includes('eksekutif')) {
      return false;
    }
    return (
      assignedProfiles.includes('crew') ||
      assignedProfiles.includes('eksekutif') ||
      assignedProfiles.includes('root_executive')
    );
  }

  // 7. Check assigned profiles against static profile capabilities catalog
  for (const profile of assignedProfiles) {
    const profileCaps = PROFILE_CAPABILITIES[profile];
    if (profileCaps && profileCaps.has(capability)) {
      return true;
    }
  }

  // 8. Direct capability fallback list check
  const directCapabilities = Array.isArray(context.capabilities) ? context.capabilities : [];
  if (directCapabilities.includes(capability)) {
    return true;
  }

  // 9. Fail-closed: Default deny
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
      for (const c of caps) all.add(c);
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
