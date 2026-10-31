/**
 * Core Authentication & Identity Types
 * Aligned with docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md (Section 2 & 4)
 */

import { AccessProfile, AppCapability, AccountStatus, OrganizationStatus, PermissionContext } from '../policy';

export interface UserIdentity {
  id: string; // Internal immutable UUID
  ptv_id: string; // Permanent institutional identifier (PTV-xxx)
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface UserMembership {
  organization: string;
  status_organisasi: OrganizationStatus;
  division: string;
  position: string;
  angkatan?: number;
}

export interface UserAccount {
  username: string;
  status_akun: AccountStatus;
  assigned_profiles: readonly AccessProfile[];
  allowed_overrides: readonly AppCapability[];
  denied_overrides: readonly AppCapability[];
}

/**
 * Composite AuthUser representing an authenticated entity in the client context.
 * Implements PermissionContext so it can be passed directly to hasCapability().
 */
export interface AuthUser extends PermissionContext {
  id: string;
  ptv_id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  division: string;
  position: string;
  angkatan?: number;
  organization: string;
  capabilities?: readonly AppCapability[];
}

export interface AuthSession {
  access_token: string;
  expires_at: number; // Expiry timestamp (ms)
  user: AuthUser;
}

export interface LoginCredentials {
  identifier: string; // Username or PTV-ID
  password?: string;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

export interface OAuthSignInOptions {
  provider: 'google';
  redirectTo?: string;
}
