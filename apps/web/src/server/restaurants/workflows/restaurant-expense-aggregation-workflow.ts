/**
 * Restaurant Expense Aggregation Workflow
 *
 * Extracted business logic for aggregating restaurant expense data.
 * Pure business logic - no framework dependencies.
 */

import type { Prisma } from '@prisma/client';
import { serializeDecimal } from '@/server/utils/decimal';

// =============================================================================
// TYPES
// =============================================================================

export interface ExpenseAggregation {
  totalExpenses: number;
  totalAmount: number;
}

export interface RestaurantWithExpenses {
  restaurantId: number;
  totalExpenses: number;
  totalAmount: number;
}

export type ExpenseAggregationMap = Map<number, ExpenseAggregation>;

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Gets expense aggregation for specific restaurants by their IDs.
 *
 * @param tx - Prisma transaction client for database operations
 * @param restaurantIds - Array of restaurant IDs to get aggregations for
 * @returns Map of restaurant ID to expense aggregation data
 */
export async function getExpenseAggregationForRestaurants(
  tx: Prisma.TransactionClient,
  restaurantIds: number[]
): Promise<ExpenseAggregationMap> {
  if (restaurantIds.length === 0) {
    return new Map();
  }

  const expenseTotals = await tx.expense.groupBy({
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

  return new Map(
    expenseTotals.map((total) => [
      total.restaurantId,
      {
        totalExpenses: total._count.id || 0,
        totalAmount: serializeDecimal(total._sum.amount),
      },
    ])
  );
}

/**
 * Gets expense aggregation for all restaurants in the system.
 *
 * @param tx - Prisma transaction client for database operations
 * @returns Map of restaurant ID to expense aggregation data
 */
export async function getAllRestaurantsExpenseAggregation(
  tx: Prisma.TransactionClient
): Promise<ExpenseAggregationMap> {
  const expenseTotals = await tx.expense.groupBy({
    by: ['restaurantId'],
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  return new Map(
    expenseTotals.map((total) => [
      total.restaurantId,
      {
        totalExpenses: total._count.id || 0,
        totalAmount: serializeDecimal(total._sum.amount),
      },
    ])
  );
}

/**
 * Merges restaurant data with their expense aggregations.
 *
 * @param restaurants - Array of restaurant base data
 * @param aggregationMap - Map of restaurant ID to expense aggregation
 * @returns Restaurants with expense data merged in
 */
export function mergeRestaurantsWithExpenseData<T extends { id: number }>(
  restaurants: T[],
  aggregationMap: ExpenseAggregationMap
): Array<T & ExpenseAggregation> {
  return restaurants.map((restaurant) => {
    const expenseData = aggregationMap.get(restaurant.id) || {
      totalExpenses: 0,
      totalAmount: 0,
    };

    return {
      ...restaurant,
      ...expenseData,
    };
  });
}
