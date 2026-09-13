import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    expense: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/utils/decimal', () => ({
  serializeDecimal: vi.fn((v) => (v ? Number(v) : 0)),
}));

import { prisma } from '@/server/infrastructure/prisma';
import {
  getAllRestaurantsExpenseAggregation,
  getExpenseAggregationMap,
  handleRestaurantError,
  validateRestaurantForDeletion,
} from './restaurant-utils';

const mockExpense = vi.mocked(prisma.expense);

describe('restaurant-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExpenseAggregationMap', () => {
    it('returns empty map for empty input', async () => {
      const result = await getExpenseAggregationMap([]);
      expect(result.size).toBe(0);
      expect(mockExpense.groupBy).not.toHaveBeenCalled();
    });

    it('builds map from groupBy results', async () => {
      mockExpense.groupBy.mockResolvedValue([
        { restaurantId: 1, _sum: { amount: 300 }, _count: { id: 5 } },
        { restaurantId: 2, _sum: { amount: null }, _count: { id: 0 } },
      ] as never);

      const result = await getExpenseAggregationMap([1, 2]);

      expect(result.get(1)).toEqual({ totalExpenses: 5, totalAmount: 300 });
      expect(result.get(2)).toEqual({ totalExpenses: 0, totalAmount: 0 });
    });
  });

  describe('getAllRestaurantsExpenseAggregation', () => {
    it('returns map of all restaurant aggregations', async () => {
      mockExpense.groupBy.mockResolvedValue([
        { restaurantId: 1, _sum: { amount: 500 }, _count: { id: 10 } },
        { restaurantId: 2, _sum: { amount: null }, _count: { id: 0 } },
      ] as never);

      const result = await getAllRestaurantsExpenseAggregation();
      expect(result.size).toBe(2);
      expect(result.get(1)).toEqual({ totalExpenses: 10, totalAmount: 500 });
      expect(result.get(2)).toEqual({ totalExpenses: 0, totalAmount: 0 });
    });
  });

  describe('handleRestaurantError', () => {
    it('throws formatted error', () => {
      expect(() => handleRestaurantError(new Error('db down'), 'fetch stats')).toThrow(
        'Failed to fetch stats'
      );
    });

    it('rethrows application errors without replacing them', async () => {
      const { AppError, ErrorCode } = await import('@/utils/errors');
      const error = new AppError(ErrorCode.BUSINESS_HAS_RELATED_EXPENSES, 'already formatted');

      expect(() => handleRestaurantError(error, 'fetch stats')).toThrow(error);
    });
  });

  describe('validateRestaurantForDeletion', () => {
    it('passes when restaurant has no expenses', async () => {
      mockExpense.findMany.mockResolvedValue([]);
      await expect(validateRestaurantForDeletion(1)).resolves.toBeUndefined();
    });

    it('throws when restaurant has expenses', async () => {
      mockExpense.findMany.mockResolvedValue([{ id: 42 }] as never);
      await expect(validateRestaurantForDeletion(1)).rejects.toThrow(
        'Cannot delete restaurant with existing expenses'
      );
    });
  });
});
