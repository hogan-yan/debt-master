import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MF = Mock;

// Capture the adapter's structured logging so tests can assert warnings.
const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }));

vi.mock('@/server/infrastructure/logger', () => ({
  createServerLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  }),
}));

// Define the mock functions type
interface MockValkeyFns {
  get: Mock;
  set: Mock;
  setex: Mock;
  del: Mock;
  flushall: Mock;
  dbsize: Mock;
  ping: Mock;
  info: Mock;
  quit: Mock;
  connect: Mock;
  on: Mock;
}

// Extend globalThis for test mocks
declare global {
  namespace NodeJS {
    interface Global {
      __valkeyMocks?: MockValkeyFns;
    }
  }
  interface globalThis {
    __valkeyMocks?: MockValkeyFns;
  }
}

vi.mock('ioredis', () => {
  const fns: MockValkeyFns = {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    flushall: vi.fn(),
    dbsize: vi.fn(),
    ping: vi.fn(),
    info: vi.fn(),
    quit: vi.fn(),
    connect: vi.fn(),
    on: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
      if (event === 'connect') {
        setTimeout(() => (cb as () => void)(), 0);
      }
      return { on: fns.on };
    }),
  };
  const MockClass = class {
    constructor() {
      return fns;
    }
  };
  (globalThis as typeof globalThis & { __valkeyMocks: MockValkeyFns }).__valkeyMocks = fns;
  return { default: MockClass };
});

const mock = () => {
  const m = (globalThis as typeof globalThis & { __valkeyMocks: MockValkeyFns }).__valkeyMocks;
  if (!m) throw new Error('Mocks not initialized');
  return {
    get: m.get as MF,
    set: m.set as MF,
    setex: m.setex as MF,
    del: m.del as MF,
    flushall: m.flushall as MF,
    dbsize: m.dbsize as MF,
    ping: m.ping as MF,
    info: m.info as MF,
    quit: m.quit as MF,
    connect: m.connect as MF,
    on: m.on as MF,
  };
};

import { ValkeyCache } from './valkey-adapter';

/** Create a cache and force the lazy client to initialize (mocked ioredis). */
async function makeCache(): Promise<ValkeyCache> {
  const cache = new ValkeyCache();
  await (cache as unknown as { getClient: () => Promise<unknown> }).getClient();
  await new Promise<void>((r) => setTimeout(r, 0));
  return cache;
}

describe('ValkeyCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_HOST;
    delete process.env.VALKEY_PORT;
    delete process.env.VALKEY_PASSWORD;

    // Allow 'connect' handler to fire before continuing
    return new Promise<void>((r) => setTimeout(r, 0));
  });

  describe('lazy client creation', () => {
    it('creates Redis client when VALKEY_URL is set', async () => {
      process.env.VALKEY_URL = 'redis://localhost:6379';
      await makeCache();
      expect(mock().on).toHaveBeenCalled();
    });

    it('creates Redis client with individual env vars', async () => {
      process.env.VALKEY_HOST = 'my-host';
      process.env.VALKEY_PORT = '6380';
      process.env.VALKEY_PASSWORD = 'secret';
      await makeCache();
      expect(mock().on).toHaveBeenCalled();
    });

    it('creates Redis client with only VALKEY_HOST set', async () => {
      process.env.VALKEY_HOST = 'my-host';
      await makeCache();
      expect(mock().on).toHaveBeenCalled();
    });

    it('creates Redis client with only VALKEY_PASSWORD set', async () => {
      process.env.VALKEY_PASSWORD = 'secret';
      await makeCache();
      expect(mock().on).toHaveBeenCalled();
    });

    it('defaults to localhost:6379', async () => {
      await makeCache();
      expect(mock().on).toHaveBeenCalled();
    });

    it('registers all 4 event listeners', async () => {
      await makeCache();
      expect(mock().on.mock.calls.map((c: unknown[]) => c[0])).toEqual([
        'connect',
        'error',
        'close',
        'reconnecting',
      ]);
    });

    it('sets isConnected false on error event', async () => {
      const cache = await makeCache();
      const errorHandler = mock().on.mock.calls.find(
        (c: unknown[]) => c[0] === 'error'
      )?.[1] as () => void;
      errorHandler();
      expect(cache).toHaveProperty('isConnected', false);
    });

    it('sets isConnected false on close event', async () => {
      const cache = await makeCache();
      const closeHandler = mock().on.mock.calls.find(
        (c: unknown[]) => c[0] === 'close'
      )?.[1] as () => void;
      closeHandler();
      expect(cache).toHaveProperty('isConnected', false);
    });

    it('handles reconnecting event without error', async () => {
      await makeCache();
      const reconnectingHandler = mock().on.mock.calls.find(
        (c: unknown[]) => c[0] === 'reconnecting'
      )?.[1] as () => void;
      expect(() => reconnectingHandler()).not.toThrow();
    });
  });

  describe('get', () => {
    it('returns value when not expired', async () => {
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'hello', expiresAt: Date.now() + 60_000 })
      );
      expect(await new ValkeyCache().get<string>('k')).toBe('hello');
    });

    it('returns null on miss', async () => {
      mock().get.mockResolvedValue(null);
      expect(await new ValkeyCache().get<string>('miss')).toBeNull();
    });

    it('deletes expired entry', async () => {
      mock().get.mockResolvedValue(JSON.stringify({ value: 'old', expiresAt: Date.now() - 1_000 }));
      expect(await new ValkeyCache().get<string>('exp')).toBeNull();
      expect(mock().del).toHaveBeenCalledWith('exp');
    });

    it('returns null on error', async () => {
      mock().get.mockRejectedValue(new Error('boom'));
      expect(await new ValkeyCache().get<string>('err')).toBeNull();
    });

    it('skips connect when already connected', async () => {
      const cache = new ValkeyCache();
      await new Promise<void>((r) => setTimeout(r, 0));
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'hello', expiresAt: Date.now() + 60_000 })
      );
      await cache.get<string>('k');
      await new Promise<void>((r) => setTimeout(r, 0));
      const connectCalls = mock().connect.mock.calls.length;
      await cache.get<string>('k2');
      expect(mock().connect.mock.calls.length).toBe(connectCalls);
    });
  });

  describe('set', () => {
    it('uses setex with TTL', async () => {
      await new ValkeyCache().set('k', 42, 120);
      const [key, ttl, raw] = mock().setex.mock.calls[0] as [string, number, string];
      expect(key).toBe('k');
      expect(ttl).toBe(120);
      expect(JSON.parse(raw).value).toBe(42);
    });

    it('swallows errors', async () => {
      mock().setex.mockRejectedValue(new Error('nope'));
      await expect(new ValkeyCache().set('k', 'x', 60)).resolves.toBeUndefined();
    });

    it('skips connect when already connected', async () => {
      const cache = new ValkeyCache();
      await new Promise<void>((r) => setTimeout(r, 0));
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'warm', expiresAt: Date.now() + 60_000 })
      );
      await cache.get<string>('warm');
      await new Promise<void>((r) => setTimeout(r, 0));
      const connectCalls = mock().connect.mock.calls.length;
      mock().setex.mockResolvedValue('OK');
      await cache.set('k', 42, 120);
      expect(mock().connect.mock.calls.length).toBe(connectCalls);
    });
  });

  describe('delete', () => {
    it('calls del', async () => {
      await new ValkeyCache().delete('k');
      expect(mock().del).toHaveBeenCalledWith('k');
    });

    it('swallows errors', async () => {
      mock().del.mockRejectedValue(new Error('nope'));
      await expect(new ValkeyCache().delete('k')).resolves.toBeUndefined();
    });

    it('skips connect when already connected', async () => {
      const cache = new ValkeyCache();
      await new Promise<void>((r) => setTimeout(r, 0));
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'warm', expiresAt: Date.now() + 60_000 })
      );
      await cache.get<string>('warm');
      await new Promise<void>((r) => setTimeout(r, 0));
      const connectCalls = mock().connect.mock.calls.length;
      mock().del.mockResolvedValue(1);
      await cache.delete('k');
      expect(mock().connect.mock.calls.length).toBe(connectCalls);
    });
  });

  describe('clear', () => {
    it('calls flushall', async () => {
      await new ValkeyCache().clear();
      expect(mock().flushall).toHaveBeenCalled();
    });

    it('swallows errors', async () => {
      mock().flushall.mockRejectedValue(new Error('nope'));
      await expect(new ValkeyCache().clear()).resolves.toBeUndefined();
    });

    it('skips connect when already connected', async () => {
      const cache = new ValkeyCache();
      await new Promise<void>((r) => setTimeout(r, 0));
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'warm', expiresAt: Date.now() + 60_000 })
      );
      await cache.get<string>('warm');
      await new Promise<void>((r) => setTimeout(r, 0));
      const connectCalls = mock().connect.mock.calls.length;
      mock().flushall.mockResolvedValue('OK');
      await cache.clear();
      expect(mock().connect.mock.calls.length).toBe(connectCalls);
    });
  });

  describe('size', () => {
    it('returns dbsize', async () => {
      mock().dbsize.mockResolvedValue(42);
      expect(await new ValkeyCache().size()).toBe(42);
    });

    it('returns 0 on error', async () => {
      mock().dbsize.mockRejectedValue(new Error('nope'));
      expect(await new ValkeyCache().size()).toBe(0);
    });

    it('skips connect when already connected', async () => {
      const cache = new ValkeyCache();
      await new Promise<void>((r) => setTimeout(r, 0));
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'warm', expiresAt: Date.now() + 60_000 })
      );
      await cache.get<string>('warm');
      await new Promise<void>((r) => setTimeout(r, 0));
      const connectCalls = mock().connect.mock.calls.length;
      mock().dbsize.mockResolvedValue(5);
      await cache.size();
      expect(mock().connect.mock.calls.length).toBe(connectCalls);
    });
  });

  describe('isHealthy', () => {
    it('true on PONG', async () => {
      mock().ping.mockResolvedValue('PONG');
      expect(await new ValkeyCache().isHealthy()).toBe(true);
    });

    it('false on error', async () => {
      mock().ping.mockRejectedValue(new Error('nope'));
      expect(await new ValkeyCache().isHealthy()).toBe(false);
    });

    it('skips connect when already connected', async () => {
      const cache = new ValkeyCache();
      await new Promise<void>((r) => setTimeout(r, 0));
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'warm', expiresAt: Date.now() + 60_000 })
      );
      await cache.get<string>('warm');
      await new Promise<void>((r) => setTimeout(r, 0));
      const connectCalls = mock().connect.mock.calls.length;
      mock().ping.mockResolvedValue('PONG');
      await cache.isHealthy();
      expect(mock().connect.mock.calls.length).toBe(connectCalls);
    });
  });

  describe('getStats', () => {
    it('parses info', async () => {
      mock().dbsize.mockResolvedValue(100);
      mock().info.mockResolvedValue('redis_version:7.0.0\r\nused_memory_human:25.5M\r\n');
      const stats = await new ValkeyCache().getStats();
      expect(stats.keyCount).toBe(100);
      expect(stats.memoryUsage).toBe('25.5M');
      expect(stats.version).toBe('7.0.0');
    });

    it('error fallback', async () => {
      mock().dbsize.mockRejectedValue(new Error('nope'));
      const stats = await new ValkeyCache().getStats();
      expect(stats.connected).toBe(false);
      expect(stats.memoryUsage).toBe('error');
    });

    it('unknown defaults when not found', async () => {
      mock().dbsize.mockResolvedValue(0);
      mock().info.mockResolvedValue('random\n');
      const stats = await new ValkeyCache().getStats();
      expect(stats.memoryUsage).toBe('unknown');
      expect(stats.version).toBe('unknown');
    });

    it('skips connect when already connected', async () => {
      const cache = new ValkeyCache();
      await new Promise<void>((r) => setTimeout(r, 0));
      mock().get.mockResolvedValue(
        JSON.stringify({ value: 'warm', expiresAt: Date.now() + 60_000 })
      );
      await cache.get<string>('warm');
      await new Promise<void>((r) => setTimeout(r, 0));
      const connectCalls = mock().connect.mock.calls.length;
      mock().dbsize.mockResolvedValue(0);
      mock().info.mockResolvedValue('redis_version:7.0.0\r\n');
      await cache.getStats();
      expect(mock().connect.mock.calls.length).toBe(connectCalls);
    });
  });

  describe('disconnect', () => {
    it('calls quit', async () => {
      const cache = new ValkeyCache();
      await (cache as unknown as { getClient: () => Promise<unknown> }).getClient();
      await cache.disconnect();
      expect(mock().quit).toHaveBeenCalled();
    });

    it('is a no-op before any client was created', async () => {
      mock().quit.mockClear();

      await expect(new ValkeyCache().disconnect()).resolves.toBeUndefined();
      expect(mock().quit).not.toHaveBeenCalled();
    });

    it('swallows errors and logs a warning when quit fails on a live client', async () => {
      const cache = await makeCache();
      mock().quit.mockRejectedValue(new Error('closed'));

      await expect(cache.disconnect()).resolves.toBeUndefined();
      expect(mockLoggerWarn).toHaveBeenCalledWith('Valkey disconnect failed', {
        error: 'Error: closed',
      });
    });

    it('reuses the in-flight client promise for concurrent callers', async () => {
      const onCallsBefore = mock().on.mock.calls.length;
      const cache = new ValkeyCache();

      // Both calls start before the lazy ioredis import resolves, so the
      // second caller must attach to the pending promise instead of
      // constructing a second client.
      await Promise.all([cache.get<string>('a'), cache.get<string>('b')]);
      await new Promise<void>((r) => setTimeout(r, 0));

      expect(mock().on.mock.calls.length).toBe(onCallsBefore + 4);
    });
  });

  describe('malformed cache entries', () => {
    it('deletes and returns null for non-object value', async () => {
      mock().get.mockResolvedValue(JSON.stringify('plain string'));
      expect(await new ValkeyCache().get<string>('k')).toBeNull();
      expect(mock().del).toHaveBeenCalledWith('k');
    });

    it('deletes and returns null when parsed is null', async () => {
      mock().get.mockResolvedValue('null');
      expect(await new ValkeyCache().get<string>('k')).toBeNull();
      expect(mock().del).toHaveBeenCalledWith('k');
    });

    it('deletes and returns null when expiresAt is missing', async () => {
      mock().get.mockResolvedValue(JSON.stringify({ value: 'hello' }));
      expect(await new ValkeyCache().get<string>('k')).toBeNull();
      expect(mock().del).toHaveBeenCalledWith('k');
    });
  });
});
