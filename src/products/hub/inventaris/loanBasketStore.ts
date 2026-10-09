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

  constructor() {
    this.loadFromStorage();
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
    this.listeners.forEach((l) => l());
  }

  public getItems(): LoanBasketItem[] {
    return Array.from(this.items.values());
  }

  public getCount(): number {
    return this.items.size;
  }

  public has(key: string): boolean {
    return this.items.has(key);
  }

  public hasAsset(assetId: string): boolean {
    return Array.from(this.items.values()).some((i) => i.assetId === assetId);
  }

  public toggle(item: LoanBasketItem): boolean {
    if (this.items.has(item.key)) {
      this.items.delete(item.key);
      this.saveToStorage();
      this.notify();
      return false; // removed
    } else {
      this.items.set(item.key, item);
      this.saveToStorage();
      this.notify();
      return true; // added
    }
  }

  public remove(key: string): void {
    this.items.delete(key);
    this.saveToStorage();
    this.notify();
  }

  public clear(): void {
    this.items.clear();
    this.saveToStorage();
    this.notify();
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
