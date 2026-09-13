import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Session revocation: every cookie-authenticated request re-checks the access
 * code row through a short-TTL cache. The cache and prisma are mocked; the
 * unit under test is the status logic + caching behavior.
 */

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: { accessCode: { findUnique: mockFindUnique } },
}));

vi.mock('@/server/infrastructure/cache', () => ({
  getCacheAdapter: async () => ({ get: mockGet, set: mockSet, delete: mockDelete }),
}));

const { isAccessCodeActive, invalidateAccessCodeStatus } = await import('./access-code-status');

const CACHE_KEY = 'access-code-status:7';

describe('isAccessCodeActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(undefined);
  });

  it('returns true for an active, not-deleted code and caches the result', async () => {
    mockFindUnique.mockResolvedValue({ isActive: true, deletedAt: null });
    await expect(isAccessCodeActive(7)).resolves.toBe(true);
    expect(mockSet).toHaveBeenCalledWith(CACHE_KEY, true, 30);
  });

  it('returns false for a deactivated code', async () => {
    mockFindUnique.mockResolvedValue({ isActive: false, deletedAt: null });
    await expect(isAccessCodeActive(7)).resolves.toBe(false);
    expect(mockSet).toHaveBeenCalledWith(CACHE_KEY, false, 30);
  });

  it('returns false for a soft-deleted code', async () => {
    mockFindUnique.mockResolvedValue({ isActive: true, deletedAt: new Date() });
    await expect(isAccessCodeActive(7)).resolves.toBe(false);
  });

  it('returns false for a missing code row', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(isAccessCodeActive(7)).resolves.toBe(false);
  });

  it('serves the cached verdict without hitting the database again', async () => {
    mockGet.mockResolvedValue(true);
    await expect(isAccessCodeActive(7)).resolves.toBe(true);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('treats a null cache read as a miss and queries the database', async () => {
    mockFindUnique.mockResolvedValue({ isActive: true, deletedAt: null });
    await expect(isAccessCodeActive(7)).resolves.toBe(true);
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateAccessCodeStatus', () => {
  it('evicts the cached status so the next check re-queries', async () => {
    mockDelete.mockResolvedValue(undefined);
    await invalidateAccessCodeStatus(7);
    expect(mockDelete).toHaveBeenCalledWith(CACHE_KEY);
  });
});
