import { describe, it, expect } from 'vitest';
import { AppCapability } from '../../src/core/policy/capabilities';

interface SimulatedUserAccount {
  id: string;
  status_akun: 'active' | 'inactive';
  tokens_valid_after: number; // timestamp in seconds
  allowed_overrides: AppCapability[];
  denied_overrides: AppCapability[];
  profiles: string[];
}

interface SimulatedJwtClaims {
  sub: string;
  account_id: string;
  status_akun: 'active' | 'inactive';
  status_organisasi: 'active' | 'inactive' | 'archived';
  iat: number; // issued at in seconds
  allowed_overrides: AppCapability[];
  denied_overrides: AppCapability[];
  profiles: string[];
}

// Simulates the vulnerable pure-claims resolver
function naiveClaimsResolver(claims: SimulatedJwtClaims, capability: AppCapability): boolean {
  if (claims.status_akun !== 'active') return false;
  if (claims.denied_overrides.includes(capability)) return false;
  if (claims.allowed_overrides.includes(capability)) return true;
  return false;
}

// Simulates the Revocation-Safe resolver from our hardened PostgreSQL function
function revocationSafeResolver(
  claims: SimulatedJwtClaims,
  dbState: SimulatedUserAccount,
  capability: AppCapability,
  isSensitive: boolean
): boolean {
  // If sensitive or mutating, consult live database state & revocation epoch
  if (isSensitive) {
    // Epoch check: If token was issued before the revocation timestamp, FAIL CLOSED
    if (claims.iat < dbState.tokens_valid_after) {
      return false;
    }
    // Live account status check
    if (dbState.status_akun !== 'active') {
      return false;
    }
    // Live deny override check
    if (dbState.denied_overrides.includes(capability)) {
      return false;
    }
    // Live allow override check
    if (dbState.allowed_overrides.includes(capability)) {
      return true;
    }
    return false;
  }

  // Non-sensitive read fallback
  return naiveClaimsResolver(claims, capability);
}

describe('Phase 5B — Security Audit: Stale JWT & Revocation Evaluation', () => {
  it('1. Naive claims-only evaluation is vulnerable to stale tokens after capability revocation', () => {
    const t0 = 1000;
    const tokenClaims: SimulatedJwtClaims = {
      sub: 'user-123',
      account_id: 'acc-123',
      status_akun: 'active',
      status_organisasi: 'active',
      iat: t0,
      allowed_overrides: ['finance.operator'],
      denied_overrides: [],
      profiles: ['crew'],
    };

    // User has access initially
    expect(naiveClaimsResolver(tokenClaims, 'finance.operator')).toBe(true);

    // Later at t1, admin revokes capability in DB
    const t1 = 2000;
    const dbAccount: SimulatedUserAccount = {
      id: 'acc-123',
      status_akun: 'active',
      tokens_valid_after: t1, // All tokens before t1 are invalidated!
      allowed_overrides: [], // Revoked!
      denied_overrides: [],
      profiles: ['crew'],
    };

    // Naive resolver STILL grants access because it trusts the stale JWT claims!
    expect(naiveClaimsResolver(tokenClaims, 'finance.operator')).toBe(true); // VULNERABILITY PROVEN!

    // But our Revocation-Safe resolver correctly denies it!
    expect(revocationSafeResolver(tokenClaims, dbAccount, 'finance.operator', true)).toBe(false);
  });

  it('2. Revocation-Safe resolver instantly blocks access when account is suspended mid-session', () => {
    const t0 = 1000;
    const tokenClaims: SimulatedJwtClaims = {
      sub: 'user-999',
      account_id: 'acc-999',
      status_akun: 'active',
      status_organisasi: 'active',
      iat: t0,
      allowed_overrides: ['documents.approve'],
      denied_overrides: [],
      profiles: ['eksekutif'],
    };

    // Admin suspends account at t1
    const t1 = 1500;
    const dbAccount: SimulatedUserAccount = {
      id: 'acc-999',
      status_akun: 'inactive', // Suspended!
      tokens_valid_after: t1,
      allowed_overrides: ['documents.approve'],
      denied_overrides: [],
      profiles: ['eksekutif'],
    };

    expect(revocationSafeResolver(tokenClaims, dbAccount, 'documents.approve', true)).toBe(false);
  });

  it('3. Fresh token issued after revocation timestamp operates normally', () => {
    const t1 = 2000; // Revocation happened at t1
    const t2 = 2500; // New login issued at t2 > t1

    const dbAccount: SimulatedUserAccount = {
      id: 'acc-456',
      status_akun: 'active',
      tokens_valid_after: t1,
      allowed_overrides: ['finance.operator'],
      denied_overrides: [],
      profiles: ['crew'],
    };

    const freshClaims: SimulatedJwtClaims = {
      sub: 'user-456',
      account_id: 'acc-456',
      status_akun: 'active',
      status_organisasi: 'active',
      iat: t2, // Fresh token!
      allowed_overrides: ['finance.operator'],
      denied_overrides: [],
      profiles: ['crew'],
    };

    expect(revocationSafeResolver(freshClaims, dbAccount, 'finance.operator', true)).toBe(true);
  });
});
