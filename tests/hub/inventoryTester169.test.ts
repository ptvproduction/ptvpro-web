import { describe, expect, it } from 'vitest';
import { hasCapability, type PermissionContext, type AppCapability } from '../../src/core/policy';

const readCaps: AppCapability[] = ['inventory.view', 'inventory.valuation.view', 'loans.view', 'damage.view'];
const writeCaps: AppCapability[] = ['inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.units.manage', 'inventory.valuation.manage', 'loans.checkout', 'loans.return', 'damage.report', 'damage.qc.approve'];
function tester(reads: boolean): PermissionContext {
  return { status_akun: 'active', status_organisasi: 'active', assigned_profiles: [],
    allowed_overrides: ['hub.access', ...(reads ? readCaps : [])], denied_overrides: writeCaps };
}
describe('Rencana tester169 — simulasi policy, bukan akun atau sesi cloud', () => {
  it('fase A masuk Hub tetapi seluruh baca Inventaris/loan/damage ditolak', () => {
    const context = tester(false);
    expect(hasCapability(context, 'hub.access')).toBe(true);
    for (const cap of readCaps) expect(hasCapability(context, cap)).toBe(false);
  });
  it.each(writeCaps)('fase B dapat membaca tetapi operasi %s ditolak', cap => {
    const context = tester(true);
    for (const read of readCaps) expect(hasCapability(context, read)).toBe(true);
    expect(hasCapability(context, cap)).toBe(false);
  });
  it('tidak mewarisi hak administratif dan tidak memutasi konteks Recovery Admin', () => {
    const recovery: PermissionContext = { status_akun: 'active', status_organisasi: 'active', assigned_profiles: ['crew', 'eksekutif'], allowed_overrides: [], denied_overrides: [] };
    const before = JSON.stringify(recovery);
    expect(hasCapability(recovery, 'crew.permissions.manage')).toBe(true);
    expect(hasCapability(tester(true), 'crew.permissions.manage')).toBe(false);
    expect(JSON.stringify(recovery)).toBe(before);
    expect(hasCapability(recovery, 'crew.permissions.manage')).toBe(true);
  });
});
