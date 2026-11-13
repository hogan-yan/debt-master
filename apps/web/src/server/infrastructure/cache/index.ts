/**
 * Cache-adapter factory.
 *
 * Returns the single active {@link CacheAdapter} based on `CACHE_PROVIDER`
 * (resolved in `readConfig`). Callers should never import a concrete adapter
 * directly — go through {@link getCacheAdapter} so the backend is swappable via
 * configuration.
 *
 * The factory is async so the Valkey adapter (and its `ioredis` dep) is
 * dynamically imported only when the deploy selects the `valkey` provider.
 * In-memory deploys never load that code path.
 */
import { AppError, ErrorCode } from '@/utils/errors';

import { infraConfig } from '../config';
import type { CacheAdapter } from './cache-adapter';

let cached: CacheAdapter | null = null;

export async function getCacheAdapter(): Promise<CacheAdapter> {
  if (cached) return cached;
  const provider = infraConfig.cacheProvider;
  let adapter: CacheAdapter;
  if (provider === 'valkey') {
    const mod = await import('./valkey-adapter');
    adapter = new mod.ValkeyCache();
  } else if (provider === 'inmemory') {
    const mod = await import('./inmemory-adapter');
    adapter = new mod.InMemoryCache();
  } else {
    throw new AppError(
      ErrorCode.INFRASTRUCTURE_ERROR,
      `Unsupported cache provider: "${provider}". Set CACHE_PROVIDER to one of: valkey, inmemory.`
    );
  }
  cached = adapter;
  return adapter;
}

/**
 * Test-only: reset the cached adapter. Used by adapter unit tests that vary
 * `CACHE_PROVIDER` per case.
 */
export function __resetCacheAdapterCacheForTests(): void {
  cached = null;
}
