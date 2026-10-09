import { describe, it, expect, beforeEach } from 'vitest';
import { loanBasketStore } from '../../src/products/hub/inventaris/loanBasketStore';
import { inventarisService } from '../../src/products/hub/inventaris/inventarisService';
import { peminjamanService } from '../../src/products/hub/peminjaman/peminjamanService';

describe('LoanModal & LoanBasket Store Regression Tests', () => {
  beforeEach(() => {
    loanBasketStore.clear();
    inventarisService.reset();
    peminjamanService.reset();
  });

  it('1. loanBasketStore getItems must return a referentially stable array when not mutated', () => {
    const snap1 = loanBasketStore.getItems();
    const snap2 = loanBasketStore.getItems();
    // In React 18 useSyncExternalStore, Object.is(snap1, snap2) MUST be true to avoid infinite loop
    expect(Object.is(snap1, snap2)).toBe(true);
    expect(snap1).toBe(snap2);
  });

  it('2. loanBasketStore updates snapshot reference only upon mutation', () => {
    const snapBefore = loanBasketStore.getItems();
    expect(snapBefore.length).toBe(0);

    loanBasketStore.toggle({
      key: 'INV-001_1',
      assetId: 'inv-001',
      unitId: 'u-001',
      unitNo: 1,
      unitCode: 'INV-001-U01',
      unitName: 'Unit 01 (INV-001-U01)',
      assetName: 'Sony FX3',
      invCode: 'INV-001'
    });

    const snapAfter = loanBasketStore.getItems();
    expect(snapAfter.length).toBe(1);
    expect(snapAfter).not.toBe(snapBefore);

    // Another call without mutation must remain stable
    expect(loanBasketStore.getItems()).toBe(snapAfter);
  });

  it('3. Multi-unit picking across categories preserves basket items', () => {
    loanBasketStore.toggle({
      key: 'INV-001_1',
      assetId: 'inv-001',
      unitId: 'u-001',
      unitNo: 1,
      unitCode: 'INV-001-U01',
      unitName: 'Unit 01',
      assetName: 'Sony FX3',
      invCode: 'INV-001'
    });

    loanBasketStore.toggle({
      key: 'INV-002_1',
      assetId: 'inv-002',
      unitId: 'u-003',
      unitNo: 1,
      unitCode: 'INV-002-U01',
      unitName: 'Unit 01',
      assetName: 'Sony 24-70mm',
      invCode: 'INV-002'
    });

    loanBasketStore.toggle({
      key: 'INV-003_1',
      assetId: 'inv-003',
      unitId: 'u-005',
      unitNo: 1,
      unitCode: 'INV-003-U01',
      unitName: 'Unit 01',
      assetName: 'Rode Wireless PRO',
      invCode: 'INV-003'
    });

    expect(loanBasketStore.getCount()).toBe(3);
    expect(loanBasketStore.has('INV-001_1')).toBe(true);
    expect(loanBasketStore.has('INV-002_1')).toBe(true);
    expect(loanBasketStore.has('INV-003_1')).toBe(true);
    expect(loanBasketStore.hasAsset('inv-001')).toBe(true);
    expect(loanBasketStore.hasAsset('inv-002')).toBe(true);
    expect(loanBasketStore.hasAsset('inv-003')).toBe(true);

    // Remove one unit
    loanBasketStore.remove('INV-002_1');
    expect(loanBasketStore.getCount()).toBe(2);
    expect(loanBasketStore.has('INV-002_1')).toBe(false);
  });
});
