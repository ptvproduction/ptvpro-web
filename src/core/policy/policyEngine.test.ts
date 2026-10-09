import { describe, it, expect } from 'vitest';
import { hasCapability, PermissionContext } from './policyEngine';

describe('Authoritative Policy Engine (hasCapability)', () => {
  it('1. Root Executive has unrestricted capabilities', () => {
    const rootUser: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['root_executive'],
      allowed_overrides: [],
      denied_overrides: [],
    };

    expect(hasCapability(rootUser, 'hub.access')).toBe(true);
    expect(hasCapability(rootUser, 'finance.manage')).toBe(true);
    expect(hasCapability(rootUser, 'settings.system')).toBe(true);
    expect(hasCapability(rootUser, 'inventory.valuation.manage')).toBe(true);
  });

  it('2. Role/Profile permission resolution verifies standard Crew boundaries', () => {
    const crewMember: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
    };

    // Allowed for Crew
    expect(hasCapability(crewMember, 'hub.access')).toBe(true);
    expect(hasCapability(crewMember, 'events.view')).toBe(true);
    expect(hasCapability(crewMember, 'loans.checkout')).toBe(true);
    expect(hasCapability(crewMember, 'notes.create')).toBe(true);

    // Denied for Crew by default
    expect(hasCapability(crewMember, 'finance.view')).toBe(false);
    expect(hasCapability(crewMember, 'finance.manage')).toBe(false);
    expect(hasCapability(crewMember, 'crew.create')).toBe(false);
    expect(hasCapability(crewMember, 'documents.approve')).toBe(false);
  });

  it('2b. Pembina is strictly isolated from finance and equipment valuations', () => {
    const pembinaUser: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['pembina'],
      allowed_overrides: [],
      denied_overrides: [],
    };

    expect(hasCapability(pembinaUser, 'hub.access')).toBe(true);
    expect(hasCapability(pembinaUser, 'events.view')).toBe(true);

    // Strictly quarantined
    expect(hasCapability(pembinaUser, 'finance.view')).toBe(false);
    expect(hasCapability(pembinaUser, 'finance.manage')).toBe(false);
    expect(hasCapability(pembinaUser, 'finance.operator')).toBe(false);
    expect(hasCapability(pembinaUser, 'inventory.valuation.view')).toBe(false);
    expect(hasCapability(pembinaUser, 'inventory.valuation.manage')).toBe(false);
  });

  it('3. Override behavior: explicit allow grants non-profile capability (replaces legacy PTV-023 exception)', () => {
    const crewWithFinanceOverride: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: ['finance.operator'],
      denied_overrides: [],
    };

    // Normally denied for crew, but granted via allowed_overrides
    expect(hasCapability(crewWithFinanceOverride, 'finance.operator')).toBe(true);
    // Still doesn't have finance.manage
    expect(hasCapability(crewWithFinanceOverride, 'finance.manage')).toBe(false);
  });

  it('3b. Override behavior: explicit deny takes highest precedence over profile capabilities', () => {
    const eksekutifWithRevocation: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['eksekutif'],
      allowed_overrides: [],
      denied_overrides: ['events.delete'],
    };

    // Eksekutif normally has events.delete, but denied by override
    expect(hasCapability(eksekutifWithRevocation, 'events.delete')).toBe(false);
    // Other capabilities remain intact
    expect(hasCapability(eksekutifWithRevocation, 'events.edit')).toBe(true);
  });

  it('4. Inactive organization member + active account: read-only alumni access', () => {
    const inactiveAlumni: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'inactive',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
    };

    // Can access hub and read records
    expect(hasCapability(inactiveAlumni, 'hub.access')).toBe(true);
    expect(hasCapability(inactiveAlumni, 'events.view')).toBe(true);
    expect(hasCapability(inactiveAlumni, 'calendar.view')).toBe(true);
    expect(hasCapability(inactiveAlumni, 'crew.view')).toBe(true);

    // All mutation capabilities are blocked
    expect(hasCapability(inactiveAlumni, 'loans.checkout')).toBe(false);
    expect(hasCapability(inactiveAlumni, 'notes.create')).toBe(false);
    expect(hasCapability(inactiveAlumni, 'damage.report')).toBe(false);
    expect(hasCapability(inactiveAlumni, 'documents.request')).toBe(false);
  });

  it('5. Inactive account cannot access anything (even with root profile)', () => {
    const suspendedRoot: PermissionContext = {
      status_akun: 'inactive',
      status_organisasi: 'active',
      assigned_profiles: ['root_executive'],
      allowed_overrides: ['finance.operator'],
      denied_overrides: [],
    };

    expect(hasCapability(suspendedRoot, 'hub.access')).toBe(false);
    expect(hasCapability(suspendedRoot, 'events.view')).toBe(false);
    expect(hasCapability(suspendedRoot, 'finance.manage')).toBe(false);
    expect(hasCapability(suspendedRoot, 'finance.operator')).toBe(false);
  });

  it('6. Null or undefined context fails closed', () => {
    expect(hasCapability(null, 'hub.access')).toBe(false);
    expect(hasCapability(undefined, 'events.view')).toBe(false);
  });

  it('7. Root Executive has NO absolute bypass: explicit deny overrides profile access', () => {
    const rootWithDeny: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['root_executive'],
      allowed_overrides: [],
      denied_overrides: ['settings.system'],
    };

    // settings.system is explicitly denied even though user is root_executive
    expect(hasCapability(rootWithDeny, 'settings.system')).toBe(false);
    // Other root capabilities remain intact
    expect(hasCapability(rootWithDeny, 'finance.manage')).toBe(true);
  });

  it('8. Inactive organization member cannot execute mutations even if capability is in allowed_overrides', () => {
    const alumniWithOverride: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'inactive',
      assigned_profiles: ['crew'],
      allowed_overrides: ['loans.checkout', 'finance.operator'],
      denied_overrides: [],
    };

    // Read capability is permitted
    expect(hasCapability(alumniWithOverride, 'events.view')).toBe(true);
    // Mutation capabilities in allowed_overrides are blocked by status_organisasi === 'inactive'
    expect(hasCapability(alumniWithOverride, 'loans.checkout')).toBe(false);
    expect(hasCapability(alumniWithOverride, 'finance.operator')).toBe(false);
  });
});
