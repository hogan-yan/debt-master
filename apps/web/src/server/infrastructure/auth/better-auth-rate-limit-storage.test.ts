import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIncr = vi.fn();
const mockSet = vi.fn();
const mockGet = vi.fn();

vi.mock('ioredis', () => ({
  default: class MockRedis {
    constructor() {
      return {
        incr: mockIncr,
        set: mockSet,
        get: mockGet,
        pttl: vi.fn(),
        del: vi.fn(),
        on: vi.fn(),
      };
    }
  },
}));

const { buildBetterAuthRateLimitStorage } = await import('./better-auth-rate-limit-storage');

function getStorage() {
  const storage = buildBetterAuthRateLimitStorage();
  if (!storage) throw new Error('expected storage to be built under Valkey config');
  return storage;
}

describe('buildBetterAuthRateLimitStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VALKEY_URL = 'valkey://localhost:6379';
  });

  it('returns null when no Valkey is configured', () => {
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_HOST;
    delete process.env.CACHE_PROVIDER;
    expect(buildBetterAuthRateLimitStorage()).toBeNull();
  });

  it('consume allows under the max and blocks past it with a fixed window', async () => {
    mockSet.mockResolvedValue('OK');
    mockIncr.mockResolvedValue(3);
    const storage = getStorage();

    await expect(
      storage.consume('k|/api/auth/sign-in-email', { window: 60, max: 10 })
    ).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });

    mockIncr.mockResolvedValue(11);
    await expect(
      storage.consume('k|/api/auth/sign-in-email', { window: 60, max: 10 })
    ).resolves.toEqual({
      allowed: false,
      retryAfter: 60,
    });
    expect(mockSet).toHaveBeenCalledWith(
      'rl:ba:k|/api/auth/sign-in-email',
      '0',
      'PX',
      60_000,
      'NX'
    );
  });

  it('consume fails open when Valkey errors', async () => {
    mockSet.mockResolvedValue('OK');
    mockIncr.mockRejectedValue(new Error('connection refused'));
    const storage = getStorage();

    await expect(storage.consume('k', { window: 60, max: 10 })).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
  });

  it('get parses a stored record, nulls a missing one, rejects malformed JSON', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ key: 'k', count: 2, lastRequest: 123 }));
    mockGet.mockResolvedValueOnce(null);
    mockGet.mockResolvedValueOnce('not-json');
    const storage = getStorage();

    await expect(storage.get('k')).resolves.toEqual({ key: 'k', count: 2, lastRequest: 123 });
    await expect(storage.get('k')).resolves.toBeNull();
    await expect(storage.get('k')).resolves.toBeNull();
  });

  it('set stores the record as JSON and swallows Valkey errors', async () => {
    mockSet.mockResolvedValue('OK').mockRejectedValueOnce(new Error('down'));
    const storage = getStorage();

    const record = { key: 'k', count: 1, lastRequest: 5 };
    await expect(storage.set('k', record)).resolves.toBeUndefined();
    expect(mockSet).toHaveBeenCalledWith(
      'rl:ba-row:k',
      JSON.stringify(record),
      'PX',
      86_400_000,
      'NX'
    );
  });

  it('builds when only CACHE_PROVIDER selects valkey and the gate reaches the client', async () => {
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_HOST;
    process.env.CACHE_PROVIDER = 'valkey';
    const storage = buildBetterAuthRateLimitStorage();
    if (!storage) throw new Error('expected storage to be built under CACHE_PROVIDER=valkey');

    mockSet.mockResolvedValue('OK');
    mockIncr.mockResolvedValueOnce(1);
    await expect(storage.consume('gate-key', { window: 60, max: 10 })).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
    expect(mockIncr).toHaveBeenCalledWith('rl:ba:gate-key');
  });

  it('builds when only VALKEY_HOST is set', () => {
    delete process.env.VALKEY_URL;
    delete process.env.CACHE_PROVIDER;
    process.env.VALKEY_HOST = 'valkey.internal';
    expect(buildBetterAuthRateLimitStorage()).not.toBeNull();
  });

  it('consume allows the request that lands exactly on max', async () => {
    mockSet.mockResolvedValue('OK');
    mockIncr.mockResolvedValue(10);
    const storage = getStorage();

    await expect(storage.consume('k', { window: 60, max: 10 })).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
  });

  it('scales the window TTL to ms and reports retryAfter in seconds for non-60 windows', async () => {
    mockSet.mockResolvedValue('OK');
    mockIncr.mockResolvedValue(4);
    const storage = getStorage();

    await expect(storage.consume('k', { window: 90, max: 3 })).resolves.toEqual({
      allowed: false,
      retryAfter: 90,
    });
    expect(mockSet).toHaveBeenCalledWith('rl:ba:k', '0', 'PX', 90_000, 'NX');
  });

  it('consume fails open when the window pin (SET NX) errors, not just INCR', async () => {
    mockSet.mockRejectedValue(new Error('readonly replica'));
    const storage = getStorage();

    await expect(storage.consume('k', { window: 60, max: 10 })).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it('get returns null for arrays, wrong-typed fields, and partial records instead of throwing', async () => {
    mockGet
      .mockResolvedValueOnce(JSON.stringify([1, 2]))
      .mockResolvedValueOnce(JSON.stringify({ count: '2', lastRequest: 123 }))
      .mockResolvedValueOnce(JSON.stringify({ count: 2 }))
      .mockResolvedValueOnce(JSON.stringify({ count: 2, lastRequest: 123 }))
      .mockResolvedValueOnce(JSON.stringify({ key: 7, count: 2, lastRequest: 123 }))
      .mockResolvedValueOnce(JSON.stringify('just a string'))
      .mockResolvedValueOnce('null')
      .mockResolvedValueOnce('');
    const storage = getStorage();

    for (let i = 0; i < 8; i += 1) {
      await expect(storage.get('k')).resolves.toBeNull();
    }
  });

  it('get swallows Valkey errors and returns null', async () => {
    mockGet.mockRejectedValue(new Error('read timeout'));
    const storage = getStorage();

    await expect(storage.get('k')).resolves.toBeNull();
  });

  it('set ignores the optional update flag and still writes the row with the full TTL', async () => {
    mockSet.mockResolvedValue('OK');
    const storage = getStorage();

    const record = { key: 'k', count: 7, lastRequest: 42 };
    await storage.set('k', record, true);
    expect(mockSet).toHaveBeenCalledWith(
      'rl:ba-row:k',
      JSON.stringify(record),
      'PX',
      86_400_000,
      'NX'
    );
  });
});
