import { describe, it, expect } from 'vitest';
import { ALL_CAPABILITIES, MUTATION_CAPABILITIES, isMutationCapability } from '../../src/core/policy/capabilities';
import { ACCESS_PROFILE_LABELS, PROFILE_CAPABILITIES, AccessProfile } from '../../src/core/policy/profiles';
import { hasCapability, PermissionContext } from '../../src/core/policy/policyEngine';

describe('Phase 5B — Contract Consistency Audit', () => {
  it('1. Authoritative Capability Count must be EXACTLY 53 (ADR-016)', () => {
    expect(ALL_CAPABILITIES.length).toBe(53);
    const uniqueCaps = new Set(ALL_CAPABILITIES);
    expect(uniqueCaps.size).toBe(53); // Zero duplicates
  });

  it('2. Authoritative Access Profile Count must be EXACTLY 5 canonical profiles', () => {
    const canonicalProfiles: AccessProfile[] = [
      'root_executive',
      'eksekutif',
      'kepolo_kepali',
      'crew',
      'pembina',
    ];
    const definedProfiles = Object.keys(PROFILE_CAPABILITIES);
    expect(definedProfiles.length).toBe(5);
    expect(definedProfiles.sort()).toEqual(canonicalProfiles.sort());

    const labelKeys = Object.keys(ACCESS_PROFILE_LABELS);
    expect(labelKeys.length).toBe(5);
  });

  it('3. Reconciled Profile Capability Counts must match canonical contract exactly', () => {
    // Root Executive: All 53 capabilities
    expect(PROFILE_CAPABILITIES.root_executive.size).toBe(53);

    // Eksekutif: 53 capabilities (matches authoritative contract table & profiles.ts)
    expect(PROFILE_CAPABILITIES.eksekutif.size).toBe(53);

    // Kepolo Kepali: 37 capabilities
    expect(PROFILE_CAPABILITIES.kepolo_kepali.size).toBe(37);

    // Crew: 24 capabilities
    expect(PROFILE_CAPABILITIES.crew.size).toBe(24);

    // Pembina: 10 capabilities
    expect(PROFILE_CAPABILITIES.pembina.size).toBe(10);
  });

  it('4. Pembina is strictly quarantined from finance and equipment valuations', () => {
    const pembinaCaps = PROFILE_CAPABILITIES.pembina;

    expect(pembinaCaps.has('finance.view')).toBe(false);
    expect(pembinaCaps.has('finance.manage')).toBe(false);
    expect(pembinaCaps.has('finance.operator')).toBe(false);
    expect(pembinaCaps.has('inventory.valuation.view')).toBe(false);
    expect(pembinaCaps.has('inventory.valuation.manage')).toBe(false);
  });

  it('5. Status Matrix Permutations: Active, Inactive, and Archived lifecycle gates', () => {
    // 5a. ACTIVE org + ACTIVE account -> normal access
    const activeCrew: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
    };
    expect(hasCapability(activeCrew, 'hub.access')).toBe(true);
    expect(hasCapability(activeCrew, 'loans.checkout')).toBe(true); // mutation allowed

    // 5b. INACTIVE org + ACTIVE account -> login allowed, all mutation denied
    const alumniCrew: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'inactive',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
    };
    expect(hasCapability(alumniCrew, 'hub.access')).toBe(true);
    expect(hasCapability(alumniCrew, 'events.view')).toBe(true);
    expect(hasCapability(alumniCrew, 'loans.checkout')).toBe(false); // mutation blocked!
    expect(hasCapability(alumniCrew, 'damage.report')).toBe(false); // mutation blocked!

    // Even with explicit allowed_override, mutation is denied for inactive org
    const alumniWithOverride: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'inactive',
      assigned_profiles: ['crew'],
      allowed_overrides: ['loans.checkout'],
      denied_overrides: [],
    };
    expect(hasCapability(alumniWithOverride, 'loans.checkout')).toBe(false);

    // 5c. INACTIVE account -> completely blocked (fail-closed)
    const disabledAccount: PermissionContext = {
      status_akun: 'inactive',
      status_organisasi: 'active',
      assigned_profiles: ['root_executive'],
      allowed_overrides: [],
      denied_overrides: [],
    };
    expect(hasCapability(disabledAccount, 'hub.access')).toBe(false);
    expect(hasCapability(disabledAccount, 'events.view')).toBe(false);
  });

  it('6. Mutation Capabilities count is consistent and matches definitions', () => {
    expect(MUTATION_CAPABILITIES.size).toBe(32);
    // Every mutation capability must exist in ALL_CAPABILITIES
    for (const mutCap of MUTATION_CAPABILITIES) {
      expect(ALL_CAPABILITIES).toContain(mutCap);
      expect(isMutationCapability(mutCap)).toBe(true);
    }
    expect(isMutationCapability('hub.access')).toBe(false);
    expect(isMutationCapability('events.view')).toBe(false);
  });

  it('7. Root Executive capability resolution with explicit deny overrides', () => {
    // PTV-ROOT is subject to explicit denied override per policy engine contract
    const rootWithRevocation: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['root_executive'],
      allowed_overrides: [],
      denied_overrides: ['finance.manage'],
    };
    expect(hasCapability(rootWithRevocation, 'finance.manage')).toBe(false);
    expect(hasCapability(rootWithRevocation, 'finance.view')).toBe(true);
  });
});
