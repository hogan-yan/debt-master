import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Valkey client is mocked at the ioredis boundary; the memory fallback
 * path needs no mocks (it exercises the in-process limiter).
 */

const mockIncr = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockPttl = vi.hoisted(() => vi.fn());
const mockDel = vi.hoisted(() => vi.fn());
const mockOn = vi.hoisted(() => vi.fn());
const mockCtorArgs = vi.hoisted(() => vi.fn());

vi.mock('ioredis', () => ({
  default: class MockRedis {
    constructor(...args: unknown[]) {
      mockCtorArgs(...args);
      return { incr: mockIncr, set: mockSet, pttl: mockPttl, del: mockDel, on: mockOn };
    }
  },
}));

const { checkSharedRateLimit } = await import('./rate-limit-store');

const CONFIG = { maxAttempts: 2, windowMs: 60_000, blockDurationMs: 15_000 };

describe('checkSharedRateLimit (Valkey-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOn.mockReturnValue(undefined);
    mockSet.mockResolvedValue(null);
    mockPttl.mockResolvedValue(-2);
    mockDel.mockResolvedValue(1);
  });

  it('allows attempts within the window and reports the remaining budget', async () => {
    process.env.VALKEY_HOST = 'localhost';
    mockIncr.mockResolvedValueOnce(1);
    const first = await checkSharedRateLimit('k1', CONFIG);
    expect(first).toEqual({ allowed: true, remainingAttempts: 1 });

    mockIncr.mockResolvedValueOnce(2);
    const second = await checkSharedRateLimit('k1', CONFIG);
    expect(second).toEqual({ allowed: true, remainingAttempts: 0 });
  });

  it('pins the fixed window with SET NX PX on the first attempt', async () => {
    process.env.VALKEY_HOST = 'localhost';
    mockSet.mockResolvedValue('OK');
    mockIncr.mockResolvedValue(1);
    await checkSharedRateLimit('k2', CONFIG);
    expect(mockSet).toHaveBeenCalledWith('rl:win:k2', '0', 'PX', CONFIG.windowMs, 'NX');
  });

  it('blocks and opens a block key once the window budget is exceeded', async () => {
    process.env.VALKEY_HOST = 'localhost';
    mockSet.mockResolvedValue('OK');
    mockIncr.mockResolvedValue(CONFIG.maxAttempts + 1);
    const result = await checkSharedRateLimit('k3', CONFIG);
    expect(result).toEqual({
      allowed: false,
      remainingAttempts: 0,
      blockedForMs: CONFIG.blockDurationMs,
    });
    expect(mockSet).toHaveBeenCalledWith('rl:block:k3', '1', 'PX', CONFIG.blockDurationMs, 'NX');
  });

  it('refuses while an existing block key is alive', async () => {
    process.env.VALKEY_HOST = 'localhost';
    mockPttl.mockResolvedValue(12_345);
    const result = await checkSharedRateLimit('k4', CONFIG);
    expect(result).toEqual({ allowed: false, remainingAttempts: 0, blockedForMs: 12_345 });
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it('falls back to the in-memory limiter when Valkey errors at runtime', async () => {
    process.env.VALKEY_HOST = 'localhost';
    mockIncr.mockRejectedValue(new Error('connection refused'));
    const result = await checkSharedRateLimit('fallback-key', CONFIG);
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(CONFIG.maxAttempts - 1);
  });

  it('uses the in-memory limiter when no Valkey env is configured', async () => {
    delete process.env.VALKEY_HOST;
    delete process.env.VALKEY_URL;
    delete process.env.CACHE_PROVIDER;
    mockIncr.mockRejectedValue(new Error('should not be reached'));
    const result = await checkSharedRateLimit('memory-key', CONFIG);
    expect(result.allowed).toBe(true);
    expect(mockIncr).not.toHaveBeenCalled();
  });

  describe('client construction', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env.VALKEY_URL = originalEnv.VALKEY_URL;
      process.env.VALKEY_HOST = originalEnv.VALKEY_HOST;
      process.env.VALKEY_PORT = originalEnv.VALKEY_PORT;
      process.env.VALKEY_PASSWORD = originalEnv.VALKEY_PASSWORD;
      process.env.CACHE_PROVIDER = originalEnv.CACHE_PROVIDER;
      vi.resetModules();
    });

    it('constructs the client from VALKEY_URL and swallows client errors', async () => {
      delete process.env.VALKEY_HOST;
      delete process.env.VALKEY_PASSWORD;
      delete process.env.CACHE_PROVIDER;
      process.env.VALKEY_URL = 'redis://valkey.internal:6379';
      vi.resetModules();
      const { checkSharedRateLimit: fresh } = await import('./rate-limit-store');

      mockIncr.mockResolvedValueOnce(1);
      const result = await fresh('url-key', CONFIG);

      expect(result).toEqual({ allowed: true, remainingAttempts: 1 });
      expect(mockCtorArgs).toHaveBeenCalledWith('redis://valkey.internal:6379', {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
      });
      // The limiter registers a no-op 'error' handler so a cache outage emits
      // instead of crashing the process.
      const errorHandler = mockOn.mock.calls.find((call) => call[0] === 'error')?.[1];
      expect(typeof errorHandler).toBe('function');
      expect(() => errorHandler()).not.toThrow();
    });

    it('falls back to localhost and forwards VALKEY_PASSWORD when only CACHE_PROVIDER selects valkey', async () => {
      delete process.env.VALKEY_URL;
      delete process.env.VALKEY_HOST;
      delete process.env.VALKEY_PORT;
      process.env.VALKEY_PASSWORD = 's3cret';
      process.env.CACHE_PROVIDER = 'valkey';
      vi.resetModules();
      const { checkSharedRateLimit: fresh } = await import('./rate-limit-store');

      mockPttl.mockResolvedValue(-2);
      mockSet.mockResolvedValue('OK');
      mockIncr.mockResolvedValueOnce(1);
      const result = await fresh('env-key', CONFIG);

      expect(result).toEqual({ allowed: true, remainingAttempts: 1 });
      expect(mockCtorArgs).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 's3cret',
        lazyConnect: false,
        maxRetriesPerRequest: 1,
      });
    });
  });
});
