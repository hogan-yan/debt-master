import { createServerFn } from '@tanstack/react-start';
import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { serializeDecimal } from '@/server/utils/decimal';
import { handleRestaurantError } from './restaurant-utils';
/**
 * Interface for restaurant statistics
 */
export interface RestaurantStats {
  totalRestaurants: number;
  totalExpenses: number;
  totalAmount: number;
}

/**
 * Get restaurant statistics for summary cards
 * Provides aggregated data across all restaurants and expenses
 * @returns Restaurant statistics object
 */
export const getRestaurantStats = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) {
    return { totalRestaurants: 0, totalExpenses: 0, totalAmount: 0 };
  }
  try {
    const [restaurantCount, expenseStats] = await Promise.all([
      getRestaurantCount(),
      getExpenseStatistics(),
    ]);

    return {
      totalRestaurants: restaurantCount,
      totalExpenses: expenseStats.totalExpenses,
      totalAmount: expenseStats.totalAmount,
    } satisfies RestaurantStats;
  } catch (error) {
    handleRestaurantError(error, 'fetch restaurant statistics');
  }
});

/**
 * Get total count of all restaurants
 * @returns Number of restaurants in the system
 */
async function getRestaurantCount(): Promise<number> {
  return await prisma.restaurant.count();
}

/**
 * Get aggregated expense statistics across all restaurants
 * @returns Object containing total expense count and amount
 */
async function getExpenseStatistics(): Promise<{
  totalExpenses: number;
  totalAmount: number;
}> {
  const expenseStats = await prisma.expense.aggregate({
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    totalExpenses: expenseStats._count.id || 0,
    totalAmount: serializeDecimal(expenseStats._sum.amount),
  };
}
