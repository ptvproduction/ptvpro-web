/**
 * Authoritative Session Normalizer
 * Enforces contract parity across login form, Google OAuth, and /api/auth/session.
 * Implements strict fail-closed safety.
 */

import { AuthUser } from './types';
import { AccessProfile, AppCapability, AccountStatus, OrganizationStatus } from '../policy';

export function normalizeAuthUser(raw: any): AuthUser | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // 1. Minimum Identity Guard: id and ptv_id must exist
  const id = typeof raw.id === 'string' && raw.id ? raw.id : (raw.account_id ? String(raw.account_id) : '');
  const ptv_id = typeof raw.ptv_id === 'string' && raw.ptv_id ? raw.ptv_id : '';
  if (!id || !ptv_id) {
    return null;
  }

  // 2. Normalize and freeze arrays (guarantees .includes() will never throw)
  const assigned_profiles: readonly AccessProfile[] = Array.isArray(raw.assigned_profiles)
    ? Object.freeze([...raw.assigned_profiles])
    : Array.isArray(raw.profiles)
    ? Object.freeze([...raw.profiles])
    : Object.freeze([]);

  const allowed_overrides: readonly AppCapability[] = Array.isArray(raw.allowed_overrides)
    ? Object.freeze([...raw.allowed_overrides])
    : Object.freeze([]);

  const denied_overrides: readonly AppCapability[] = Array.isArray(raw.denied_overrides)
    ? Object.freeze([...raw.denied_overrides])
    : Object.freeze([]);

  const capabilities: readonly AppCapability[] = Array.isArray(raw.capabilities)
    ? Object.freeze([...raw.capabilities])
    : Object.freeze([]);

  // 3. Status checks
  const status_akun: AccountStatus = raw.status_akun === 'active' ? 'active' : 'inactive';
  const status_organisasi: OrganizationStatus =
    raw.status_organisasi === 'archived'
      ? 'archived'
      : raw.status_organisasi === 'inactive'
      ? 'inactive'
      : 'active';

  return {
    id,
    ptv_id,
    full_name: typeof raw.full_name === 'string' && raw.full_name ? raw.full_name : (raw.username || 'Kru PTV'),
    username: typeof raw.username === 'string' && raw.username ? raw.username : 'kru',
    avatar_url: typeof raw.avatar_url === 'string' ? raw.avatar_url : undefined,
    division: typeof raw.division === 'string' ? raw.division : '',
    position: typeof raw.position === 'string' ? raw.position : '',
    organization: typeof raw.organization === 'string' && raw.organization ? raw.organization : 'PTV Studio',
    angkatan: typeof raw.angkatan === 'number' ? raw.angkatan : undefined,
    status_akun,
    status_organisasi,
    assigned_profiles,
    allowed_overrides,
    denied_overrides,
    capabilities,
    capabilities_verified_live: raw.capabilities_verified_live === true,
  };
}
