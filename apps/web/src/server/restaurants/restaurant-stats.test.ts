import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    restaurant: {
      count: vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
}));

vi.mock('@/server/utils/decimal', () => ({
  serializeDecimal: vi.fn((v) => (v ? Number(v) : 0)),
}));

import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { getRestaurantStats } from './restaurant-stats';

const mockGetAuth = vi.mocked(getAuthFromCookie);
const mockRestaurantCount = vi.mocked(prisma.restaurant.count);
const mockExpenseAggregate = vi.mocked(prisma.expense.aggregate);

describe('restaurant-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRestaurantStats', () => {
    it('returns zeros when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getRestaurantStats({ data: undefined });
      expect(result).toEqual({ totalRestaurants: 0, totalExpenses: 0, totalAmount: 0 });
    });

    it('returns aggregated stats', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockRestaurantCount.mockResolvedValue(5);
      mockExpenseAggregate.mockResolvedValue({
        _count: { id: 20 },
        _sum: { amount: 1500 },
      } as never);

      const result = await getRestaurantStats({ data: undefined });
      expect(result).toEqual({ totalRestaurants: 5, totalExpenses: 20, totalAmount: 1500 });
    });

    it('handles null amount sum', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockRestaurantCount.mockResolvedValue(3);
      mockExpenseAggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { amount: null },
      } as never);

      const result = await getRestaurantStats({ data: undefined });
      expect(result.totalAmount).toBe(0);
      expect(result.totalExpenses).toBe(0);
    });

    it('propagates infrastructure errors via handleRestaurantError', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockRestaurantCount.mockRejectedValue(new Error('db down'));

      await expect(getRestaurantStats({ data: undefined })).rejects.toThrow(
        'Failed to fetch restaurant statistics'
      );
    });
  });
});
