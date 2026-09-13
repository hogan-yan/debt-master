import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

const { mockPrisma, mockGetAuth } = vi.hoisted(() => ({
  mockPrisma: {
    expense: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
  },
  mockGetAuth: vi.fn(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({ getAuthFromCookie: mockGetAuth }));

const { getRecentActivity } = await import('./activity');

describe('getRecentActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authenticated so existing behavior tests exercise the data
    // path; the unauth gate has its own test below.
    mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
  });

  it('returns empty for unauthenticated callers without hitting the DB (DEBTM-190)', async () => {
    mockGetAuth.mockResolvedValue(null);
    const result = (await getRecentActivity({ data: { limit: 10 } })) as unknown[];
    expect(result).toHaveLength(0);
    expect(mockPrisma.expense.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('returns activities merged and sorted', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 1, amount: 50, date: new Date('2024-06-15'), restaurant: { name: 'Pizza' } },
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 2,
        amount: 30,
        date: new Date('2024-06-16'),
        colleague: { name: 'Alice' },
        restaurant: null,
      },
    ]);
    const result = (await getRecentActivity({ data: { limit: 10 } })) as unknown[];
    expect(result).toHaveLength(2);
    expect((result as { id: number }[])[0]!.id).toBe(2);
    expect((result as { id: number }[])[1]!.id).toBe(1);
  });

  it('returns empty when no data', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    const result = (await getRecentActivity({ data: { limit: 10 } })) as unknown[];
    expect(result).toHaveLength(0);
  });

  it('uses default limit when limit is omitted', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const result = (await getRecentActivity({ data: {} })) as unknown[];

    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(result).toHaveLength(0);
  });

  it('throws on error', async () => {
    mockPrisma.expense.findMany.mockRejectedValue(new Error('db error'));
    await expect(getRecentActivity({ data: { limit: 10 } })).rejects.toThrow(
      'Failed to fetch recent activity'
    );
  });

  it('rethrows AppError without wrapping', async () => {
    const appError = Object.assign(new Error('custom app error'), { code: 'CUSTOM_CODE' });
    mockPrisma.expense.findMany.mockRejectedValue(appError);
    await expect(getRecentActivity({ data: { limit: 10 } })).rejects.toThrow('custom app error');
  });
});
