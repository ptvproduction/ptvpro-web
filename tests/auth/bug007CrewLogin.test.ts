import { describe, it, expect } from 'vitest';
import { hasCapability, type PermissionContext } from '../../src/core/policy/policyEngine';
import { PROFILE_CAPABILITIES } from '../../src/core/policy/profiles';

describe('BUG-007: Crew Authentication & Authorization Boundaries', () => {
  it('allows active crew member to access Hub but isolates administrative capabilities', () => {
    const crewCaps = Array.from(PROFILE_CAPABILITIES.crew);
    const context: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
      capabilities: crewCaps,
      capabilities_verified_live: true,
    };

    // 1. Kru WAJIB memiliki akses PTV Hub
    expect(hasCapability(context, 'hub.access')).toBe(true);

    // 2. Kru memiliki akses modul operasional standar
    expect(hasCapability(context, 'inventory.view')).toBe(true);
    expect(hasCapability(context, 'events.view')).toBe(true);
    expect(hasCapability(context, 'calendar.view')).toBe(true);
    expect(hasCapability(context, 'loans.view')).toBe(true);
    expect(hasCapability(context, 'loans.checkout')).toBe(true);

    // 3. Kru DILARANG mengakses modul manajemen dan administrasi sensitif
    expect(hasCapability(context, 'crew.create')).toBe(false);
    expect(hasCapability(context, 'crew.edit')).toBe(false);
    expect(hasCapability(context, 'crew.status.manage')).toBe(false);
    expect(hasCapability(context, 'crew.permissions.manage')).toBe(false);
    expect(hasCapability(context, 'finance.manage')).toBe(false);
    expect(hasCapability(context, 'finance.operator')).toBe(false);
    expect(hasCapability(context, 'settings.system')).toBe(false);
    expect(hasCapability(context, 'audit.logs.view')).toBe(false);
  });

  it('allows purna / nonaktif kru to login and access Hub if their account status is active', () => {
    const crewCaps = Array.from(PROFILE_CAPABILITIES.crew);
    
    // Status organisasi purna/alumni ('inactive' atau 'archived'), tetapi status akun 'active'
    const purnaContext: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'inactive',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
      capabilities: crewCaps,
      capabilities_verified_live: true,
    };

    expect(hasCapability(purnaContext, 'hub.access')).toBe(true);
    expect(hasCapability(purnaContext, 'inventory.view')).toBe(true);
    expect(hasCapability(purnaContext, 'finance.manage')).toBe(false);
  });

  it('rejects access fail-closed if account status is inactive', () => {
    const crewCaps = Array.from(PROFILE_CAPABILITIES.crew);
    
    const inactiveContext: PermissionContext = {
      status_akun: 'inactive',
      status_organisasi: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
      denied_overrides: [],
      capabilities: crewCaps,
      capabilities_verified_live: true,
    };

    // Seluruh hak akses ditolak jika status akun tidak aktif
    expect(hasCapability(inactiveContext, 'hub.access')).toBe(false);
    expect(hasCapability(inactiveContext, 'inventory.view')).toBe(false);
    expect(hasCapability(inactiveContext, 'events.view')).toBe(false);
  });

  it('ensures root retains unrevoked access regardless of status_organisasi', () => {
    const rootContext: PermissionContext = {
      status_akun: 'active',
      status_organisasi: 'inactive',
      assigned_profiles: ['root_executive'],
      allowed_overrides: [],
      denied_overrides: [],
      capabilities: ['hub.access', 'settings.system', 'finance.manage'],
      capabilities_verified_live: true,
    };

    expect(hasCapability(rootContext, 'hub.access')).toBe(true);
    expect(hasCapability(rootContext, 'settings.system')).toBe(true);
    expect(hasCapability(rootContext, 'finance.manage')).toBe(true);
  });
});
