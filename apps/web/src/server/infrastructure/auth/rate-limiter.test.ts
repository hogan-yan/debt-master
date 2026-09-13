import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.resetModules();

const authUtils = await import('./auth-server-utils');
// checkAccessCodeRateLimit lives in the server-only module but shares the same
// rateLimitMap/checkRateLimit instance via its import of auth-server-utils.
const rateLimitServer = await import('./auth-rate-limit');

const config = {
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows first attempt with remaining=max-1', () => {
    const result = authUtils.checkRateLimit('key-1', config);
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(4);
    expect(result.blockedForMs).toBeUndefined();
  });

  it('allows second attempt and decrements remaining', () => {
    authUtils.checkRateLimit('key-2', config);
    const result = authUtils.checkRateLimit('key-2', config);
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(3);
  });

  it('blocks after max attempts reached', () => {
    const key = 'key-3';
    for (let i = 0; i < 5; i++) {
      authUtils.checkRateLimit(key, config);
    }
    const result = authUtils.checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.remainingAttempts).toBe(0);
    expect(result.blockedForMs).toBe(config.blockDurationMs);
  });

  it('denies while blocked and returns remaining block time', () => {
    const key = 'key-4';
    for (let i = 0; i < 6; i++) {
      authUtils.checkRateLimit(key, config);
    }

    vi.advanceTimersByTime(5 * 60 * 1000);

    const result = authUtils.checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.remainingAttempts).toBe(0);
    expect(result.blockedForMs).toBe(10 * 60 * 1000);
  });

  it('allows again after block expires', () => {
    const key = 'key-5';
    for (let i = 0; i < 6; i++) {
      authUtils.checkRateLimit(key, config);
    }

    vi.advanceTimersByTime(config.blockDurationMs + 1);

    const result = authUtils.checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(5);
    expect(result.blockedForMs).toBeUndefined();
  });

  it('resets counter after window expires without block', () => {
    const key = 'key-6';
    authUtils.checkRateLimit(key, config);
    authUtils.checkRateLimit(key, config);

    vi.advanceTimersByTime(config.windowMs + 1);

    const result = authUtils.checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(4);
  });

  it('tracks different keys independently', () => {
    const resultA = authUtils.checkRateLimit('key-a', config);
    const resultB = authUtils.checkRateLimit('key-b', config);

    expect(resultA.remainingAttempts).toBe(4);
    expect(resultB.remainingAttempts).toBe(4);

    for (let i = 0; i < 5; i++) {
      authUtils.checkRateLimit('key-a', config);
    }

    expect(authUtils.checkRateLimit('key-a', config).allowed).toBe(false);
    expect(authUtils.checkRateLimit('key-b', config).allowed).toBe(true);
  });

  it('handles config with maxAttempts=1', () => {
    const strictConfig = { maxAttempts: 1, windowMs: 60000, blockDurationMs: 300000 };
    const first = authUtils.checkRateLimit('key-strict', strictConfig);
    expect(first.allowed).toBe(true);
    expect(first.remainingAttempts).toBe(0);

    const second = authUtils.checkRateLimit('key-strict', strictConfig);
    expect(second.allowed).toBe(false);
    expect(second.remainingAttempts).toBe(0);
  });
});

describe('checkAccessCodeRateLimit', () => {
  it('hashes code and delegates to checkRateLimit', async () => {
    const result = await rateLimitServer.checkAccessCodeRateLimit('my-code-123');
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(4);
  });

  it('blocks after 5 attempts with same code', async () => {
    const code = 'repeated-code';
    for (let i = 0; i < 5; i++) {
      await rateLimitServer.checkAccessCodeRateLimit(code);
    }
    const result = await rateLimitServer.checkAccessCodeRateLimit(code);
    expect(result.allowed).toBe(false);
    expect(result.remainingAttempts).toBe(0);
  });

  it('treats different codes as different keys', async () => {
    const code1 = 'code-one';
    const code2 = 'code-two';

    for (let i = 0; i < 6; i++) {
      await rateLimitServer.checkAccessCodeRateLimit(code1);
    }

    expect((await rateLimitServer.checkAccessCodeRateLimit(code1)).allowed).toBe(false);
    expect((await rateLimitServer.checkAccessCodeRateLimit(code2)).allowed).toBe(true);
  });
});

describe('hashIdentifier', () => {
  it('returns same hash for same input', () => {
    const h1 = authUtils.hashIdentifier('test');
    const h2 = authUtils.hashIdentifier('test');
    expect(h1).toBe(h2);
    expect(h1).toBeTypeOf('string');
  });

  it('returns different hashes for different inputs', () => {
    const h1 = authUtils.hashIdentifier('foo');
    const h2 = authUtils.hashIdentifier('bar');
    expect(h1).not.toBe(h2);
  });

  it('handles empty string', () => {
    expect(authUtils.hashIdentifier('')).toBe('0');
  });

  it('handles long strings', () => {
    const long = 'a'.repeat(1000);
    const h = authUtils.hashIdentifier(long);
    expect(h).toBeTypeOf('string');
    expect(Number.isNaN(Number(h))).toBe(false);
  });
});

describe('cleanupRateLimits', () => {
  it('removes stale entries older than maxAge', () => {
    const localConfig = { maxAttempts: 5, windowMs: 300000, blockDurationMs: 900000 };

    authUtils.checkRateLimit('stale-key', localConfig);
    vi.advanceTimersByTime(localConfig.windowMs + localConfig.blockDurationMs + 1);
    authUtils.cleanupRateLimits();

    const result = authUtils.checkRateLimit('stale-key', localConfig);
    expect(result.remainingAttempts).toBe(4);
  });

  it('preserves fresh entries', () => {
    const localConfig = { maxAttempts: 5, windowMs: 300000, blockDurationMs: 900000 };

    authUtils.checkRateLimit('fresh-key', localConfig);
    vi.advanceTimersByTime(1000);
    authUtils.cleanupRateLimits();

    const result = authUtils.checkRateLimit('fresh-key', localConfig);
    expect(result.remainingAttempts).toBe(3);
  });
});
