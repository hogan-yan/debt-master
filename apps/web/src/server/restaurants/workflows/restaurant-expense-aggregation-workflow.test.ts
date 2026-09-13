/**
 * Restaurant Expense Aggregation Workflow Tests
 *
 * These tests verify the expense aggregation logic for restaurants.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import {
  type ExpenseAggregationMap,
  getAllRestaurantsExpenseAggregation,
  getExpenseAggregationForRestaurants,
  mergeRestaurantsWithExpenseData,
} from './restaurant-expense-aggregation-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('Restaurant Expense Aggregation Workflow', () => {
  // Mock transaction client
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseGroupBy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseGroupBy = vi.fn();

    mockTx = createMockTx({
      expense: {
        groupBy: expenseGroupBy,
      },
    });
  });

  // =============================================================================
  // GET EXPENSE AGGREGATION FOR RESTAURANTS
  // =============================================================================

  describe('getExpenseAggregationForRestaurants', () => {
    it('should return empty map for empty restaurant IDs array', async () => {
      const result = await getExpenseAggregationForRestaurants(mockTx, []);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(expenseGroupBy).not.toHaveBeenCalled();
    });

    it('should return aggregation data for multiple restaurants', async () => {
      const restaurantIds = [1, 2, 3];

      expenseGroupBy.mockResolvedValue([
        {
          restaurantId: 1,
          _sum: { amount: new Prisma.Decimal('150.50') },
          _count: { id: 5 },
        },
        {
          restaurantId: 2,
          _sum: { amount: new Prisma.Decimal('75.25') },
          _count: { id: 3 },
        },
        // Restaurant 3 has no expenses
      ]);

      const result = await getExpenseAggregationForRestaurants(mockTx, restaurantIds);

      expect(expenseGroupBy).toHaveBeenCalledWith({
        by: ['restaurantId'],
        where: {
          restaurantId: { in: restaurantIds },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      expect(result.size).toBe(2);
      expect(result.get(1)).toEqual({
        totalExpenses: 5,
        totalAmount: 150.5,
      });
      expect(result.get(2)).toEqual({
        totalExpenses: 3,
        totalAmount: 75.25,
      });
      // Restaurant 3 not in result (no expenses)
    });

    it('should handle null amounts in aggregation', async () => {
      expenseGroupBy.mockResolvedValue([
        {
          restaurantId: 1,
          _sum: { amount: null },
          _count: { id: 0 },
        },
      ]);

      const result = await getExpenseAggregationForRestaurants(mockTx, [1]);

      expect(result.get(1)).toEqual({
        totalExpenses: 0,
        totalAmount: 0,
      });
    });

    it('should handle single restaurant ID', async () => {
      expenseGroupBy.mockResolvedValue([
        {
          restaurantId: 5,
          _sum: { amount: new Prisma.Decimal('250.00') },
          _count: { id: 10 },
        },
      ]);

      const result = await getExpenseAggregationForRestaurants(mockTx, [5]);

      expect(result.size).toBe(1);
      expect(result.get(5)).toEqual({
        totalExpenses: 10,
        totalAmount: 250,
      });
    });
  });

  // =============================================================================
  // GET ALL RESTAURANTS EXPENSE AGGREGATION
  // =============================================================================

  describe('getAllRestaurantsExpenseAggregation', () => {
    it('should return aggregation for all restaurants', async () => {
      expenseGroupBy.mockResolvedValue([
        {
          restaurantId: 1,
          _sum: { amount: new Prisma.Decimal('100.00') },
          _count: { id: 2 },
        },
        {
          restaurantId: 2,
          _sum: { amount: new Prisma.Decimal('200.00') },
          _count: { id: 4 },
        },
        {
          restaurantId: 3,
          _sum: { amount: new Prisma.Decimal('300.00') },
          _count: { id: 6 },
        },
      ]);

      const result = await getAllRestaurantsExpenseAggregation(mockTx);

      expect(expenseGroupBy).toHaveBeenCalledWith({
        by: ['restaurantId'],
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      expect(result.size).toBe(3);
      expect(result.get(1)).toEqual({ totalExpenses: 2, totalAmount: 100 });
      expect(result.get(2)).toEqual({ totalExpenses: 4, totalAmount: 200 });
      expect(result.get(3)).toEqual({ totalExpenses: 6, totalAmount: 300 });
    });

    it('should return empty map when no expenses exist', async () => {
      expenseGroupBy.mockResolvedValue([]);

      const result = await getAllRestaurantsExpenseAggregation(mockTx);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle restaurants with only null amounts', async () => {
      expenseGroupBy.mockResolvedValue([
        {
          restaurantId: 1,
          _sum: { amount: null },
          _count: { id: 0 },
        },
        {
          restaurantId: 2,
          _sum: { amount: new Prisma.Decimal('50.00') },
          _count: { id: 1 },
        },
      ]);

      const result = await getAllRestaurantsExpenseAggregation(mockTx);

      expect(result.get(1)).toEqual({ totalExpenses: 0, totalAmount: 0 });
      expect(result.get(2)).toEqual({ totalExpenses: 1, totalAmount: 50 });
    });
  });

  // =============================================================================
  // MERGE RESTAURANTS WITH EXPENSE DATA
  // =============================================================================

  describe('mergeRestaurantsWithExpenseData', () => {
    it('should merge restaurants with their expense data', () => {
      const restaurants = [
        { id: 1, name: 'Restaurant A' },
        { id: 2, name: 'Restaurant B' },
        { id: 3, name: 'Restaurant C' },
      ];

      const aggregationMap: ExpenseAggregationMap = new Map([
        [1, { totalExpenses: 5, totalAmount: 150.5 }],
        [2, { totalExpenses: 3, totalAmount: 75.25 }],
        // Restaurant 3 has no expenses in the map
      ]);

      const result = mergeRestaurantsWithExpenseData(restaurants, aggregationMap);

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        id: 1,
        name: 'Restaurant A',
        totalExpenses: 5,
        totalAmount: 150.5,
      });

      expect(result[1]).toEqual({
        id: 2,
        name: 'Restaurant B',
        totalExpenses: 3,
        totalAmount: 75.25,
      });

      // Restaurant 3 should have zero values
      expect(result[2]).toEqual({
        id: 3,
        name: 'Restaurant C',
        totalExpenses: 0,
        totalAmount: 0,
      });
    });

    it('should handle empty restaurant list', () => {
      const result = mergeRestaurantsWithExpenseData([], new Map());

      expect(result).toEqual([]);
    });

    it('should handle empty aggregation map', () => {
      const restaurants = [
        { id: 1, name: 'Restaurant A' },
        { id: 2, name: 'Restaurant B' },
      ];

      const result = mergeRestaurantsWithExpenseData(restaurants, new Map());

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: 'Restaurant A',
        totalExpenses: 0,
        totalAmount: 0,
      });
      expect(result[1]).toEqual({
        id: 2,
        name: 'Restaurant B',
        totalExpenses: 0,
        totalAmount: 0,
      });
    });

    it('should preserve all restaurant properties', () => {
      const restaurants = [
        {
          id: 1,
          name: 'Restaurant A',
          address: '123 Main St',
          cuisine: 'italian',
          customField: 'custom value',
        },
      ];

      const aggregationMap: ExpenseAggregationMap = new Map([
        [1, { totalExpenses: 10, totalAmount: 500 }],
      ]);

      const result = mergeRestaurantsWithExpenseData(restaurants, aggregationMap);

      expect(result[0]).toEqual({
        id: 1,
        name: 'Restaurant A',
        address: '123 Main St',
        cuisine: 'italian',
        customField: 'custom value',
        totalExpenses: 10,
        totalAmount: 500,
      });
    });
  });
});
