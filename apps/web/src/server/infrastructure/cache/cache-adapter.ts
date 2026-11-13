/**
 * Swappable cache adapter interface (DEBTCOM-5).
 *
 * Formalises the structural contract that {@link ValkeyCache} and
 * {@link InMemoryCache} already share. Callers go through
 * {@link getCacheAdapter} so the backend is swappable via `CACHE_PROVIDER`
 * without touching call sites.
 */

export interface CacheStats {
  readonly connected: boolean;
  readonly keyCount: number;
  readonly memoryUsage: string;
  readonly version: string;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
  isHealthy(): Promise<boolean>;
  getStats(): Promise<CacheStats>;
  disconnect(): Promise<void>;
}
