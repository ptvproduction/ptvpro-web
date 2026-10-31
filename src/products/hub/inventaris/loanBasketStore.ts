export interface LoanBasketItem {
  key: string;
  assetId: string;
  unitId: string;
  unitNo: number;
  unitCode: string;
  unitName: string;
  assetName: string;
  invCode: string;
}

const STORAGE_KEY = 'ptv_loan_basket_v2';
const TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

class LoanBasketStore {
  private static instance: LoanBasketStore;
  private items: Map<string, LoanBasketItem> = new Map();
  private listeners: Set<() => void> = new Set();

  private cachedItems: LoanBasketItem[] = [];

  constructor() {
    this.loadFromStorage();
    this.cachedItems = Array.from(this.items.values());
  }

  public static getInstance(): LoanBasketStore {
    if (!LoanBasketStore.instance) {
      LoanBasketStore.instance = new LoanBasketStore();
    }
    return LoanBasketStore.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.cachedItems = Array.from(this.items.values());
    this.listeners.forEach((l) => l());
  }

  public getItems(): LoanBasketItem[] {
    return this.cachedItems;
  }

  public getCount(): number {
    return this.items.size;
  }

  public has(keyOrUnitId: string): boolean {
    if (this.items.has(keyOrUnitId)) return true;
    const lowerKey = keyOrUnitId.toLowerCase();
    return this.cachedItems.some(
      (i) =>
        i.key === keyOrUnitId ||
        i.key.toLowerCase() === lowerKey ||
        i.unitId === keyOrUnitId ||
        `${i.assetId}_${i.unitId}` === keyOrUnitId ||
        `${i.assetId}_${i.unitNo}` === keyOrUnitId ||
        `${i.assetId}_${i.unitNo}`.toLowerCase() === lowerKey ||
        `${i.invCode}_${i.unitNo}` === keyOrUnitId ||
        `${i.invCode}_${i.unitNo}`.toLowerCase() === lowerKey
    );
  }

  public hasUnit(unitId: string): boolean {
    return this.cachedItems.some((i) => i.unitId === unitId);
  }

  public hasAsset(assetId: string): boolean {
    return this.cachedItems.some(
      (i) => i.assetId === assetId || i.assetId.toLowerCase() === assetId.toLowerCase()
    );
  }

  public hasAssetUnit(assetId: string, unitIdentifier: string | number): boolean {
    return this.cachedItems.some(
      (i) =>
        (i.assetId === assetId || i.assetId.toLowerCase() === String(assetId).toLowerCase()) &&
        (i.unitId === String(unitIdentifier) || i.unitNo === Number(unitIdentifier))
    );
  }

  public toggle(item: LoanBasketItem): boolean {
    // Check if item or unit is already in basket
    const existingEntry = Array.from(this.items.entries()).find(
      ([k, it]) =>
        k === item.key ||
        (it.unitId && item.unitId && it.unitId === item.unitId) ||
        (it.assetId === item.assetId && it.unitNo === item.unitNo)
    );

    let added = false;
    if (existingEntry) {
      this.items.delete(existingEntry[0]);
      added = false;
    } else {
      const storeKey = item.key || `${item.assetId}_${item.unitId}`;
      this.items.set(storeKey, { ...item, key: storeKey });
      added = true;
    }
    this.saveToStorage();
    this.notify();
    return added;
  }

  public remove(keyOrUnitId: string): void {
    if (this.items.has(keyOrUnitId)) {
      this.items.delete(keyOrUnitId);
      this.saveToStorage();
      this.notify();
      return;
    }
    const lower = keyOrUnitId.toLowerCase();
    for (const [k, item] of this.items.entries()) {
      if (
        k === keyOrUnitId ||
        k.toLowerCase() === lower ||
        item.unitId === keyOrUnitId ||
        `${item.assetId}_${item.unitNo}` === keyOrUnitId ||
        `${item.assetId}_${item.unitNo}`.toLowerCase() === lower ||
        `${item.assetId}_${item.unitId}` === keyOrUnitId ||
        `${item.invCode}_${item.unitNo}` === keyOrUnitId ||
        `${item.invCode}_${item.unitNo}`.toLowerCase() === lower
      ) {
        this.items.delete(k);
        this.saveToStorage();
        this.notify();
        break;
      }
    }
  }

  public clear(): void {
    if (this.items.size > 0) {
      this.items.clear();
      this.saveToStorage();
      this.notify();
    }
  }

  private saveToStorage(): void {
    try {
      const list = Array.from(this.items.values());
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          items: list,
        })
      );
    } catch {
      // ignore
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.timestamp || !Array.isArray(data.items)) return;

      if (Date.now() - data.timestamp > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        this.items.clear();
        return;
      }

      this.items.clear();
      data.items.forEach((it: LoanBasketItem) => {
        if (it && it.key) {
          this.items.set(it.key, it);
        }
      });
    } catch {
      // ignore
    }
  }
}

export const loanBasketStore = LoanBasketStore.getInstance();
