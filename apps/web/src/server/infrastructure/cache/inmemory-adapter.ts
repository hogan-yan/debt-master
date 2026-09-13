/**
 * In-memory cache adapter (DEBTCOM-6).
 *
 * Moved verbatim from `src/server/cache.ts`; the `Map`-backed fallback used in
 * development and browser contexts. Implements {@link CacheAdapter}.
 */

import type { CacheAdapter, CacheStats } from './cache-adapter';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Fallback in-memory cache for development/testing
 */
export class InMemoryCache implements CacheAdapter {
  private cache = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Generic cache: value was stored via set<T> and caller knows the expected type
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async getStats(): Promise<CacheStats> {
    return {
      connected: true,
      keyCount: this.cache.size,
      memoryUsage: 'in-memory',
      version: 'fallback',
    };
  }

  async disconnect(): Promise<void> {
    this.cache.clear();
  }
}
