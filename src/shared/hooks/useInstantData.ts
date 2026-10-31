import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { ptvCache } from '@core/cache/ptvCache';

export interface UseInstantDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  userScoped?: boolean;
  initialFallback?: T;
  initialData?: T;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (err: any) => void;
}

export interface UseInstantDataResult<T> {
  data: T;
  isLoading: boolean; // TRUE only on cold start when NO cache exists at all
  isRevalidating: boolean; // TRUE when refreshing fresh data in background
  error: string | null;
  mutate: (updater: T | ((prev: T) => T), persistImmediately?: boolean) => void;
  refetch: () => Promise<any>;
}

export function useInstantData<T>({
  key, fetcher, ttlMs = 10 * 60 * 1000, userScoped = true,
  initialFallback, initialData, enabled = true, onSuccess, onError,
}: UseInstantDataOptions<T>): UseInstantDataResult<T> {
  const scope = useSyncExternalStore(
    ptvCache.subscribe.bind(ptvCache),
    () => ptvCache.getScopeToken(userScoped),
    () => ptvCache.getScopeToken(userScoped),
  );
  const identity = `${scope}::${key}::${enabled}`;
  const fallback = initialData !== undefined ? initialData : initialFallback;
  const read = () => enabled ? ptvCache.get<T>(key, userScoped) : null;
  const [state, setState] = useState(() => ({
    identity, data: (read()?.data ?? fallback) as T,
    isLoading: enabled && !read(), isRevalidating: false, error: null as string | null,
  }));
  const refs = useRef({ fetcher, onSuccess, onError, fallback });
  refs.current = { fetcher, onSuccess, onError, fallback };
  const active = useRef(identity);
  active.current = identity;
  const sequence = useRef(0);
  const mounted = useRef(false);
  const publishing = useRef(false);
  const dataRef = useRef(state.data);
  const visible = state.identity === identity ? state : {
    identity, data: (read()?.data ?? fallback) as T,
    isLoading: enabled && !read(), isRevalidating: false, error: null,
  };
  dataRef.current = visible.data;

  const executeFetch = useCallback(async (cold = false) => {
    if (!enabled || active.current !== identity) return null;
    const request = ++sequence.current;
    const current = () => mounted.current && active.current === identity &&
      ptvCache.getScopeToken(userScoped) === scope && request === sequence.current;
    setState((prev) => ({ ...prev, isLoading: cold, isRevalidating: !cold, error: null }));
    try {
      const fresh = await refs.current.fetcher();
      if (!current()) return null;
      dataRef.current = fresh;
      setState({ identity, data: fresh, isLoading: false, isRevalidating: false, error: null });
      publishing.current = true;
      try { ptvCache.set(key, fresh, ttlMs, userScoped); }
      finally { publishing.current = false; }
      refs.current.onSuccess?.(fresh);
      return fresh;
    } catch (err: any) {
      if (!current()) return null;
      setState((prev) => ({ ...prev, isLoading: false, isRevalidating: false,
        error: err?.message || 'Gagal menyinkronkan data terbaru.' }));
      refs.current.onError?.(err);
      return null;
    }
  }, [enabled, identity, key, scope, ttlMs, userScoped]);

  useEffect(() => {
    mounted.current = true;
    const cached = enabled ? ptvCache.get<T>(key, userScoped) : null;
    setState({ identity, data: (cached?.data ?? refs.current.fallback) as T,
      isLoading: enabled && !cached, isRevalidating: false, error: null });
    const unsubscribe = ptvCache.subscribe((changedKey, action) => {
      if (!enabled || publishing.current || active.current !== identity ||
          ptvCache.getScopeToken(userScoped) !== scope || (changedKey !== key && changedKey !== '*')) return;
      if (action === 'invalidate') { void executeFetch(false); return; }
      ++sequence.current;
      const updated = ptvCache.get<T>(key, userScoped);
      dataRef.current = (updated?.data ?? refs.current.fallback) as T;
      setState({ identity, data: dataRef.current, isLoading: false, isRevalidating: false, error: null });
      if (action === 'remove') void executeFetch(true);
    });
    if (enabled) void executeFetch(!cached);
    return () => { mounted.current = false; ++sequence.current; unsubscribe(); };
  }, [enabled, identity, key, scope, userScoped, executeFetch]);

  const mutate = useCallback((updater: T | ((prev: T) => T), persistImmediately = true) => {
    if (!enabled || active.current !== identity || ptvCache.getScopeToken(userScoped) !== scope) return;
    ++sequence.current;
    const next = typeof updater === 'function' ? (updater as (prev: T) => T)(dataRef.current) : updater;
    dataRef.current = next;
    setState({ identity, data: next, isLoading: false, isRevalidating: false, error: null });
    if (persistImmediately) {
      publishing.current = true;
      try { ptvCache.set(key, next, ttlMs, userScoped); }
      finally { publishing.current = false; }
    }
  }, [enabled, identity, key, scope, ttlMs, userScoped]);
  const refetch = useCallback(() => executeFetch(false), [executeFetch]);
  return { data: visible.data, isLoading: visible.isLoading, isRevalidating: visible.isRevalidating,
    error: visible.error, mutate, refetch };
}
