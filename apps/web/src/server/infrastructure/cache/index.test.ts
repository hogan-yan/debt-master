import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ cacheProvider: 'inmemory' as string }));
vi.mock('../config', () => ({ infraConfig: config }));

const valkeyInstance = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  size: vi.fn(),
  isHealthy: vi.fn(),
  getStats: vi.fn(),
  disconnect: vi.fn(),
};
const inmemoryInstance = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  size: vi.fn(),
  isHealthy: vi.fn(),
  getStats: vi.fn(),
  disconnect: vi.fn(),
};
vi.mock('./valkey-adapter', () => ({
  // Constructor returns the stub instance (JS `new` yields a returned object).
  // Implemented as a class so Biome's useArrowFunction rule cannot rewrite it
  // to an arrow (arrows cannot be constructed with `new`).
  ValkeyCache: class {
    constructor() {
      return valkeyInstance;
    }
  },
}));
vi.mock('./inmemory-adapter', () => ({
  InMemoryCache: class {
    constructor() {
      return inmemoryInstance;
    }
  },
}));

const { getCacheAdapter, __resetCacheAdapterCacheForTests } = await import('./index');

describe('getCacheAdapter', () => {
  beforeEach(() => {
    __resetCacheAdapterCacheForTests();
    vi.clearAllMocks();
    config.cacheProvider = 'inmemory';
  });

  it('returns an InMemoryCache instance when provider is inmemory', async () => {
    const adapter = await getCacheAdapter();
    expect(adapter).toBe(inmemoryInstance);
  });

  it('dynamically imports + returns a ValkeyCache instance when provider is valkey', async () => {
    config.cacheProvider = 'valkey';
    const adapter = await getCacheAdapter();
    expect(adapter).toBe(valkeyInstance);
  });

  it('caches the adapter across calls', async () => {
    const first = await getCacheAdapter();
    const second = await getCacheAdapter();
    expect(first).toBe(second);
  });

  it('throws an INFRASTRUCTURE_ERROR for an unsupported provider', async () => {
    config.cacheProvider = 'redis-magic';
    await expect(getCacheAdapter()).rejects.toThrow(/Unsupported cache provider: "redis-magic"/);
    // A failed resolution must not poison the cache.
    config.cacheProvider = 'inmemory';
    expect(await getCacheAdapter()).toBe(inmemoryInstance);
  });
});
