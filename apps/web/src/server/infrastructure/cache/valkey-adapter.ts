/**
 * Valkey (Redis-compatible) cache adapter (DEBTCOM-5).
 *
 * Moved verbatim from `src/server/cache.ts`; connection params still read from
 * `VALKEY_*` env vars inline. Implements {@link CacheAdapter}.
 */

import type { Redis as RedisClient } from 'ioredis';
import { createServerLogger } from '@/server/infrastructure/logger';
import type { CacheAdapter, CacheStats } from './cache-adapter';

const logger = createServerLogger('cache', process.env.NODE_ENV === 'development');

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Valkey Cache Implementation
 * Provides Redis-compatible caching with automatic connection management
 */
export class ValkeyCache implements CacheAdapter {
  // ioredis is loaded lazily: a top-level import ships the redis client
  // (and its node 'events' dependency) into the browser bundle, which crashes
  // every route that touches the cache module.
  private client: RedisClient | null = null;
  private clientPromise: Promise<RedisClient> | null = null;
  private isConnected = false;

  private async getClient(): Promise<RedisClient> {
    if (this.client) return this.client;
    if (!this.clientPromise) {
      this.clientPromise = import('ioredis').then((mod) => {
        const Redis = mod.default;
        this.client = this.createClient(Redis);
        this.setupEventHandlers();
        return this.client;
      });
    }
    return this.clientPromise;
  }

  /**
   * Create and configure Valkey client
   */
  private createClient(Redis: typeof import('ioredis').default): RedisClient {
    const valkeyUrl = process.env.VALKEY_URL;

    if (valkeyUrl) {
      return new Redis(valkeyUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }

    // Fallback to individual environment variables
    const password = process.env.VALKEY_PASSWORD;
    return new Redis({
      host: process.env.VALKEY_HOST || 'localhost',
      port: Number.parseInt(process.env.VALKEY_PORT || '6379', 10),
      ...(password ? { password } : {}),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  /**
   * Setup event handlers for connection monitoring
   */
  private setupEventHandlers(): void {
    if (!this.client) return;
    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('error', (_error) => {
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {});
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      if (!this.isConnected) {
        await client.connect();
      }

      const value = await client.get(key);

      if (!value) {
        return null;
      }

      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || !('expiresAt' in parsed)) {
        await this.delete(key);
        return null;
      }
      const cacheEntry = parsed as CacheEntry<T>;

      // Check if expired (additional safety check)
      if (Date.now() > cacheEntry.expiresAt) {
        await this.delete(key);
        return null;
      }

      return cacheEntry.value;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const client = await this.getClient();
      if (!this.isConnected) {
        await client.connect();
      }

      const expiresAt = Date.now() + ttlSeconds * 1000;
      const cacheEntry: CacheEntry<T> = { value, expiresAt };

      const serialized = JSON.stringify(cacheEntry);

      // Use SETEX for atomic set with expiration
      await client.setex(key, ttlSeconds, serialized);
    } catch (error) {
      logger.warn('Valkey cache set failed', { key, error: String(error) });
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const client = await this.getClient();
      if (!this.isConnected) {
        await client.connect();
      }

      await client.del(key);
    } catch (error) {
      // A failed delete leaves stale entries until TTL; downstream callers
      // rely on invalidation for correctness, so this must be visible.
      logger.warn('Valkey cache delete failed', { key, error: String(error) });
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const client = await this.getClient();
      if (!this.isConnected) {
        await client.connect();
      }

      await client.flushall();
    } catch (error) {
      logger.warn('Valkey cache clear failed', { error: String(error) });
    }
  }

  /**
   * Get cache size (number of keys)
   */
  async size(): Promise<number> {
    try {
      const client = await this.getClient();
      if (!this.isConnected) {
        await client.connect();
      }

      return await client.dbsize();
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Check if cache is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!this.isConnected) {
        await client.connect();
      }

      const result = await client.ping();
      return result === 'PONG';
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const client = await this.getClient();
      if (!this.isConnected) {
        await client.connect();
      }

      const [keyCount, info] = await Promise.all([client.dbsize(), client.info('memory,server')]);

      // Parse info string for memory and version
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);

      return {
        connected: this.isConnected,
        keyCount,
        memoryUsage: memoryMatch?.[1] || 'unknown',
        version: versionMatch?.[1] || 'unknown',
      };
    } catch (_error) {
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: 'error',
        version: 'error',
      };
    }
  }

  /**
   * Gracefully disconnect from Valkey
   */
  async disconnect(): Promise<void> {
    try {
      if (!this.client) return;
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      logger.warn('Valkey disconnect failed', { error: String(error) });
    }
  }
}
