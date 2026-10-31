/**
 * PTVPRO — Instant-First Persistent Cache Architecture (PTV-DEV-189)
 *
 * Provides a high-performance, user-isolated persistent caching layer
 * with TTL, Stale-While-Revalidate semantics, storage size quotas,
 * and strict security guards preventing caching of secrets/finance data.
 */

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
  version: number;
}

export interface UserCacheMap {
  [key: string]: CacheEntry<any>;
}

const CACHE_PREFIX = 'ptv_cache_v1_';
const CACHE_VERSION = 2;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes default
const MAX_CACHE_SIZE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB per user ceiling

// Strict security deny-list: These domains must NEVER be stored in persistent view cache
const SENSITIVE_KEY_PATTERNS = [
  'auth',
  'token',
  'session',
  'password',
  'pin',
  'secret',
  'credential',
  'finance',
  'keuangan',
  'saldo',
  'transaksi',
  'kas',
  'bank',
  'payroll',
  'rekening',
  'tabungan',
];

export class PtvCacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private subscribers: Set<(key: string, action?: 'set' | 'remove' | 'invalidate') => void> = new Set();
  private activeUserId: string | null = null;
  private scopeRevision = 0;

  public getScopeToken(userScoped = true): string {
    return `${this.getStorageKey(userScoped)}:${this.scopeRevision}`;
  }

  constructor() {
    this.detectActiveUser();
  }

  /**
   * Identifies the current logged-in user to guarantee strict tenant/user cache isolation.
   */
  public detectActiveUser(): string {
    if (typeof window === 'undefined') return 'public';
    try {
      // 1. Check window.__sessionStore if initialized
      const storeState = (window as any).__sessionStore?.getState?.();
      const user = storeState?.user;
      if (user?.id || user?.ptv_id) {
        const uid = String(user.id || user.ptv_id);
        this.activeUserId = uid;
        return uid;
      }

      // 2. Check localStorage session keys
      const mockSession = localStorage.getItem('ptv_mock_auth_session');
      if (mockSession) {
        const parsed = JSON.parse(mockSession);
        if (parsed?.user?.id || parsed?.user?.ptv_id) {
          const uid = String(parsed.user.id || parsed.user.ptv_id);
          this.activeUserId = uid;
          return uid;
        }
      }

      const ptvSession = localStorage.getItem('ptv_session');
      if (ptvSession) {
        const parsed = JSON.parse(ptvSession);
        if (parsed?.user?.id || parsed?.user?.ptv_id) {
          const uid = String(parsed.user.id || parsed.user.ptv_id);
          this.activeUserId = uid;
          return uid;
        }
      }
    } catch {
      // ignore
    }
    this.activeUserId = 'public';
    return 'public';
  }

  public setActiveUser(userId: string | null) {
    const prev = this.activeUserId;
    if (!userId && prev && prev !== 'public') {
      try { localStorage.removeItem(this.getStorageKey(true)); } catch { /* Storage may be unavailable. */ }
    }
    this.activeUserId = userId || 'public';
    if (prev && prev !== this.activeUserId) {
      // User changed: clear in-memory cache to prevent cross-account leakage
      this.memoryCache.clear();
      this.scopeRevision++;
      this.notify('*');
    }
  }

  private getStorageKey(userScoped = true, customUserId?: string): string {
    if (!userScoped) return `${CACHE_PREFIX}public`;
    const uid = customUserId || this.activeUserId || this.detectActiveUser();
    return `${CACHE_PREFIX}${uid}`;
  }

  /**
   * Security Guard: Strictly rejects sensitive authorization or financial keys
   */
  private isKeyAllowed(key: string): boolean {
    const lower = key.toLowerCase();
    for (const pattern of SENSITIVE_KEY_PATTERNS) {
      if (lower.includes(pattern)) {
        console.warn(`[PtvCache Security Guard] Rejected caching attempt for sensitive key: "${key}"`);
        return false;
      }
    }
    return true;
  }

  /**
   * Retrieves user-scoped cache map from localStorage
   */
  private loadStorageMap(storageKey: string): UserCacheMap {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Writes user-scoped cache map to localStorage with quota check
   */
  private saveStorageMap(storageKey: string, map: UserCacheMap): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      let serialized = JSON.stringify(map);
      // If exceeds quota, evict oldest 25% of entries
      if (serialized.length > MAX_CACHE_SIZE_BYTES) {
        const entries = Object.entries(map).sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toEvict = Math.ceil(entries.length * 0.25);
        for (let i = 0; i < toEvict; i++) {
          delete map[entries[i][0]];
        }
        serialized = JSON.stringify(map);
      }
      localStorage.setItem(storageKey, serialized);
    } catch (e) {
      console.warn('[PtvCache] LocalStorage write quota exceeded, clearing stale items', e);
    }
  }

  /**
   * Get cached data synchronously.
   * Returns `{ data, isStale, timestamp }` or `null`.
   */
  public get<T>(key: string, userScoped = true): { data: T; isStale: boolean; timestamp: number } | null {
    if (!this.isKeyAllowed(key)) return null;

    const storageKey = this.getStorageKey(userScoped);
    const memKey = `${storageKey}::${key}`;

    // 1. Fast memory cache check
    let entry = this.memoryCache.get(memKey) as CacheEntry<T> | undefined;

    // 2. Persistent storage fallback
    if (!entry) {
      const map = this.loadStorageMap(storageKey);
      entry = map[key] as CacheEntry<T> | undefined;
      if (entry) {
        this.memoryCache.set(memKey, entry);
      }
    }

    if (!entry || entry.data === undefined || entry.data === null) {
      return null;
    }

    // Version validation
    if (entry.version !== CACHE_VERSION) {
      this.remove(key, userScoped);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    const isStale = entry.ttl === 0 || age >= entry.ttl;

    return {
      data: entry.data,
      isStale,
      timestamp: entry.timestamp,
    };
  }

  /**
   * Store data into persistent cache with TTL
   */
  public set<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS, userScoped = true): boolean {
    if (!this.isKeyAllowed(key)) return false;
    if (data === undefined) return false;

    const storageKey = this.getStorageKey(userScoped);
    const memKey = `${storageKey}::${key}`;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      version: CACHE_VERSION,
    };

    // 1. Update Memory
    this.memoryCache.set(memKey, entry);

    // 2. Update Persistent Storage
    const map = this.loadStorageMap(storageKey);
    map[key] = entry;
    this.saveStorageMap(storageKey, map);

    // 3. Notify Subscribers
    this.notify(key, 'set');
    return true;
  }

  /**
   * Removes a specific key from memory and storage
   */
  public remove(key: string, userScoped = true): void {
    const storageKey = this.getStorageKey(userScoped);
    const memKey = `${storageKey}::${key}`;

    this.memoryCache.delete(memKey);

    const map = this.loadStorageMap(storageKey);
    if (map[key]) {
      delete map[key];
      this.saveStorageMap(storageKey, map);
    }

    this.notify(key, 'remove');
  }

  /**
   * Marks key as immediately stale to trigger revalidation while preserving cached content
   */
  public invalidate(key: string, userScoped = true): void {
    const res = this.get(key, userScoped);
    if (res && res.data !== undefined) {
      // Re-save with 0 TTL to force stale revalidation on next query
      const storageKey = this.getStorageKey(userScoped);
      const map = this.loadStorageMap(storageKey);
      const entry = { data: res.data, timestamp: res.timestamp, ttl: 0, version: CACHE_VERSION };
      this.memoryCache.set(`${storageKey}::${key}`, entry);
      map[key] = entry;
      this.saveStorageMap(storageKey, map);
      this.notify(key, 'invalidate');
    }
  }

  /**
   * Clears the active user's persistent cache. Called automatically on logout.
   */
  public clearActiveUserCache(): void {
    this.scopeRevision++;
    const storageKey = this.getStorageKey(true);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(storageKey);
    }
    // Clear all memory keys matching this user storageKey
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(storageKey)) {
        this.memoryCache.delete(k);
      }
    }
    this.notify('*');
  }

  /**
   * Purges all PTV cache entries across all users
   */
  public purgeAll(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
    this.notify('*');
  }

  /**
   * Subscribes to cache changes for reactive re-render
   */
  public subscribe(listener: (key: string, action?: 'set' | 'remove' | 'invalidate') => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(key: string, action?: 'set' | 'remove' | 'invalidate'): void {
    this.subscribers.forEach((fn) => {
      try {
        fn(key, action);
      } catch (err) {
        console.warn('[PtvCache notify error]', err);
      }
    });
  }
}

export const ptvCache = new PtvCacheManager();
