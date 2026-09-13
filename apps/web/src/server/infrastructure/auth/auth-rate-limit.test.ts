import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRequestIP = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockHashIdentifier = vi.fn();

vi.mock('@tanstack/start-server-core', () => ({
  getRequestIP: () => mockGetRequestIP(),
}));

vi.mock('./auth-server-utils', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  hashIdentifier: (...args: unknown[]) => mockHashIdentifier(...args),
  RATE_LIMIT: {
    ACCESS_CODE: { maxAttempts: 5, windowMs: 300_000, blockDurationMs: 900_000 },
    ACCESS_CODE_IP: { maxAttempts: 20, windowMs: 300_000, blockDurationMs: 900_000 },
  },
}));

import { checkAccessCodeRateLimit, getClientIdentifier } from './auth-rate-limit';

const RATE_LIMIT_CODE_SHAPE = { maxAttempts: 5, windowMs: 300_000, blockDurationMs: 900_000 };
const RATE_LIMIT_IP_SHAPE = { maxAttempts: 20, windowMs: 300_000, blockDurationMs: 900_000 };

describe('getClientIdentifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns IP from getRequestIP', async () => {
    mockGetRequestIP.mockReturnValue('192.168.1.1');

    const result = await getClientIdentifier();

    expect(result).toBe('192.168.1.1');
  });

  it('returns "unknown" when getRequestIP returns null', async () => {
    mockGetRequestIP.mockReturnValue(null);

    const result = await getClientIdentifier();

    expect(result).toBe('unknown');
  });

  it('returns "unknown" when getRequestIP throws', async () => {
    mockGetRequestIP.mockImplementation(() => {
      throw new Error('No request context');
    });

    const result = await getClientIdentifier();

    expect(result).toBe('unknown');
  });
});

describe('checkAccessCodeRateLimit', () => {
  const originalEnv = process.env.TEST_SKIP_RATE_LIMIT;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST_SKIP_RATE_LIMIT = undefined;
  });

  afterAll(() => {
    process.env.TEST_SKIP_RATE_LIMIT = originalEnv;
  });

  it('bypasses rate limit when TEST_SKIP_RATE_LIMIT is set', async () => {
    process.env.TEST_SKIP_RATE_LIMIT = '1';

    const result = await checkAccessCodeRateLimit('code123');

    expect(result).toEqual({ allowed: true, remainingAttempts: 999 });
    expect(mockHashIdentifier).not.toHaveBeenCalled();
  });

  it('checks the per-IP bucket first, then the per-code bucket', async () => {
    mockHashIdentifier.mockReturnValue('hashed_code');
    mockGetRequestIP.mockReturnValue('10.0.0.1');
    mockCheckRateLimit
      .mockReturnValueOnce({ allowed: true, remainingAttempts: 19 })
      .mockReturnValueOnce({ allowed: true, remainingAttempts: 4 });

    const result = await checkAccessCodeRateLimit('mycode');

    expect(mockHashIdentifier).toHaveBeenCalledWith('mycode');
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
      1,
      'access_code_ip:10.0.0.1',
      RATE_LIMIT_IP_SHAPE
    );
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
      2,
      'access_code:hashed_code:10.0.0.1',
      RATE_LIMIT_CODE_SHAPE
    );
    expect(result).toEqual({ allowed: true, remainingAttempts: 4 });
  });

  it('blocks code enumeration: a burnt IP never reaches the per-code bucket', async () => {
    mockHashIdentifier.mockReturnValue('hashed');
    mockGetRequestIP.mockReturnValue('10.0.0.1');
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remainingAttempts: 0,
      blockedForMs: 900_000,
    });

    const result = await checkAccessCodeRateLimit('fresh-code');

    expect(result.allowed).toBe(false);
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1); // IP bucket only
  });

  it('returns the blocked result from the per-code bucket when the IP is fine', async () => {
    mockHashIdentifier.mockReturnValue('hashed');
    mockGetRequestIP.mockReturnValue('10.0.0.1');
    mockCheckRateLimit
      .mockReturnValueOnce({ allowed: true, remainingAttempts: 19 })
      .mockReturnValueOnce({
        allowed: false,
        remainingAttempts: 0,
        blockedForMs: 120_000,
      });

    const result = await checkAccessCodeRateLimit('code');

    expect(result).toEqual({
      allowed: false,
      remainingAttempts: 0,
      blockedForMs: 120_000,
    });
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(2);
  });
});
