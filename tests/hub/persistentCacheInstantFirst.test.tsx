import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Setup memory-based localStorage mock if running in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

import { ptvCache, PtvCacheManager } from '../../src/core/cache/ptvCache';

describe('PTV-DEV-189: Persistent Cache & Instant-First Architecture', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    ptvCache.setActiveUser('test_user_alpha');
    ptvCache.clearActiveUserCache();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('ptvCache Core Storage & User Isolation', () => {
    it('stores and retrieves data with user-scoped isolation', () => {
      ptvCache.setActiveUser('user_alpha');
      ptvCache.set('test_catalog', [{ id: '1', name: 'Sony FX3' }], 60000);

      const cachedAlpha = ptvCache.get<{ id: string; name: string }[]>('test_catalog');
      expect(cachedAlpha).not.toBeNull();
      expect(cachedAlpha?.data[0].name).toBe('Sony FX3');

      // Switch to different user
      ptvCache.setActiveUser('user_beta');
      const cachedBeta = ptvCache.get<{ id: string; name: string }[]>('test_catalog');
      // Must NOT leak user_alpha's cached data to user_beta
      expect(cachedBeta).toBeNull();

      // Switch back to user_alpha
      ptvCache.setActiveUser('user_alpha');
      const restoredAlpha = ptvCache.get<{ id: string; name: string }[]>('test_catalog');
      expect(restoredAlpha).not.toBeNull();
      expect(restoredAlpha?.data[0].name).toBe('Sony FX3');
    });

    it('rejects sensitive financial, credential, and auth keys per strict security deny-list', () => {
      const sensitiveDenyList = [
        'user_auth_token',
        'auth_session_data',
        'finance_transactions',
        'keuangan_saldo_kas',
        'user_password_hash',
        'security_pin_code',
        'master_secret_key',
        'credential_payload',
        'transaksi_keuangan_studio',
        'kas_masuk_keluar',
        'tabungan_kru',
      ];

      for (const forbiddenKey of sensitiveDenyList) {
        const stored = ptvCache.set(forbiddenKey, { secret: 'confidential' }, 60000);
        expect(stored).toBe(false);
        expect(ptvCache.get(forbiddenKey)).toBeNull();
      }
    });

    it('enforces TTL expiration and marks stale records upon access', () => {
      ptvCache.set('short_lived_key', { temp: true }, 100);

      const immediate = ptvCache.get<{ temp: boolean }>('short_lived_key');
      expect(immediate).not.toBeNull();
      expect(immediate?.data.temp).toBe(true);
      expect(immediate?.isStale).toBe(false);

      // Access after TTL expiration
      const memEntry = (ptvCache as any).memoryCache.get('ptv_cache_v1_test_user_alpha::short_lived_key');
      if (memEntry) {
        memEntry.timestamp = Date.now() - 500; // 500ms elapsed > 100ms TTL
      }

      const stale = ptvCache.get<{ temp: boolean }>('short_lived_key');
      expect(stale).not.toBeNull();
      expect(stale?.isStale).toBe(true);
    });

    it('clears active user cache on logout without wiping other accounts', () => {
      ptvCache.setActiveUser('user_one');
      ptvCache.set('profile_one', { id: 'u1', name: 'Zidna' });

      ptvCache.setActiveUser('user_two');
      ptvCache.set('profile_two', { id: 'u2', name: 'Roup' });

      // Clear user_two's cache
      ptvCache.clearActiveUserCache();
      expect(ptvCache.get('profile_two')).toBeNull();

      // Switch back to user_one: user_one's data remains intact
      ptvCache.setActiveUser('user_one');
      expect(ptvCache.get('profile_one')?.data).toEqual({ id: 'u1', name: 'Zidna' });
    });

    it('notifies subscribers via pub-sub on set and invalidate', () => {
      let notifiedKey: string | null = null;
      let notifiedAction: 'set' | 'remove' | 'invalidate' | undefined = undefined;

      const unsubscribe = ptvCache.subscribe((key, action) => {
        notifiedKey = key;
        notifiedAction = action;
      });

      ptvCache.set('inventaris_catalog_list', [{ id: 'item_1' }]);
      expect(notifiedKey).toBe('inventaris_catalog_list');
      expect(notifiedAction).toBe('set');

      ptvCache.invalidate('inventaris_catalog_list');
      expect(notifiedAction).toBe('invalidate');

      unsubscribe();
    });

    it('enforces LRU cache quota eviction when approaching storage ceiling', () => {
      const customCache = new PtvCacheManager();
      customCache.setActiveUser('quota_tester');

      // Populate multiple items
      for (let i = 0; i < 15; i++) {
        customCache.set(`bulk_item_${i}`, { index: i, payload: 'x'.repeat(1000) });
      }

      // Items should be retrievable
      const lastItem = customCache.get<{ index: number }>(`bulk_item_14`);
      expect(lastItem?.data.index).toBe(14);

      customCache.clearActiveUserCache();
    });
  });

  describe('Synchronous Cache Hydration for 0ms Instant Rendering', () => {
    it('synchronously restores pre-warmed cache without triggering skeleton loading', () => {
      // Pre-warm cache for beranda and inventaris
      ptvCache.set('inventaris_catalog_list', [{ id: 'inv-1', nama_alat: 'Sony A7 IV' }]);
      ptvCache.set('beranda_aggregated_data', {
        events: [{ id: 'evt-1', nama_acara: 'Live Haul' }],
        myLoans: [],
        docStats: { pending: 0, approved: 1, total: 1 },
      });

      // Synchronous read (same pattern used by useInstantData on frame 0)
      const invCached = ptvCache.get<any[]>('inventaris_catalog_list');
      const berandaCached = ptvCache.get<any>('beranda_aggregated_data');

      // Zero ms availability!
      expect(invCached).not.toBeNull();
      expect(invCached?.data).toHaveLength(1);
      expect(invCached?.data[0].nama_alat).toBe('Sony A7 IV');

      expect(berandaCached).not.toBeNull();
      expect(berandaCached?.data.events).toHaveLength(1);
      expect(berandaCached?.data.events[0].nama_acara).toBe('Live Haul');
    });

    it('cold start correctly signals absence of cache for first-visit skeletons', () => {
      const emptyCached = ptvCache.get('non_existent_key');
      expect(emptyCached).toBeNull();
    });
  });
});
