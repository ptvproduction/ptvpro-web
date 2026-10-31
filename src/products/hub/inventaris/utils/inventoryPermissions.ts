import { AuthUser } from '@core/auth';
import { AppCapability } from '@core/policy';

/**
 * Evaluates whether the user has permission to delete or archive inventory items.
 *
 * Rules (per AGENTS.md & User Request):
 * - Root / Super Admin: Allowed
 * - Eksekutif: Allowed
 * - Administrasi: Allowed
 * - Kru, Pengarah, Pembina, and others: Strictly Denied by default
 * - Inactive or archived accounts: Strictly Denied (Fail-closed)
 * - Explicit user deny overrides: Strictly Denied (Fail-closed)
 */
export function canDeleteInventory(
  user: AuthUser | null | undefined,
  can: (capability: AppCapability) => boolean
): boolean {
  if (!user || typeof user !== 'object') {
    return false;
  }

  // 1. Inactive account rejects all capabilities (Fail-closed)
  if (user.status_akun !== 'active') {
    return false;
  }

  // 2. Archived accounts are completely disabled (Fail-closed)
  if (user.status_organisasi === 'archived') {
    return false;
  }

  // 3. Explicit deny override takes highest precedence (Fail-closed)
  const deniedOverrides = Array.isArray(user.denied_overrides) ? user.denied_overrides : [];
  if (deniedOverrides.includes('inventory.delete')) {
    return false;
  }

  // 4. Primary canonical check via policy engine
  if (can('inventory.delete')) {
    return true;
  }

  // 5. Administrasi role evaluation
  // In PTV canonical profiles, Administrasi corresponds to kepolo_kepali or direct administrasi role/position
  const assignedProfiles = Array.isArray(user.assigned_profiles) ? user.assigned_profiles : [];
  if (
    assignedProfiles.includes('root_executive') ||
    assignedProfiles.includes('eksekutif') ||
    assignedProfiles.includes('kepolo_kepali')
  ) {
    return true;
  }

  const roleStr = String((user as any).role || '').toLowerCase();
  if (roleStr === 'administrasi' || roleStr === 'eksekutif' || roleStr === 'root') {
    return true;
  }

  const posStr = String(user.position || '').toLowerCase();
  if (posStr.includes('administrasi') || posStr.includes('sekretaris') || posStr.includes('bendahara')) {
    return true;
  }

  // 6. Default Deny
  return false;
}
