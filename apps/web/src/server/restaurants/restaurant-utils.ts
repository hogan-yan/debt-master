import { prisma } from '@/server/infrastructure/prisma';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
/**
 * Interface for expense aggregation data
 */
export interface ExpenseAggregation {
  totalExpenses: number;
  totalAmount: number;
}

/**
 * Creates a map of restaurant IDs to their expense aggregation data
 * @param restaurantIds - Array of restaurant IDs to get aggregations for
 * @returns Map of restaurant ID to expense aggregation data
 */
export async function getExpenseAggregationMap(
  restaurantIds: number[]
): Promise<Map<number, ExpenseAggregation>> {
  if (restaurantIds.length === 0) {
    return new Map();
  }

  const expenseTotals = await prisma.expense.groupBy({
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
 * Gets expense aggregation for all restaurants
 * @returns Map of restaurant ID to expense aggregation data
 */
export async function getAllRestaurantsExpenseAggregation(): Promise<
  Map<number, ExpenseAggregation>
> {
  const expenseTotals = await prisma.expense.groupBy({
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
 * Standardized error handler for restaurant operations
 * @param error - The caught error
 * @param operation - Description of the operation that failed
 * @throws Error with formatted message
 */
export function handleRestaurantError(error: unknown, operation: string): never {
  if (isAppError(error)) throw error;
  throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, `Failed to ${operation}`);
}

/**
 * Validates that a restaurant exists and has no associated expenses
 * Used before deletion operations
 * @param restaurantId - ID of the restaurant to validate
 * @throws Error if restaurant has expenses
 */
export async function validateRestaurantForDeletion(restaurantId: number): Promise<void> {
  const expenses = await prisma.expense.findMany({
    where: { restaurantId },
    select: { id: true },
    take: 1, // Only need to check if any exist
  });

  if (expenses.length > 0) {
    throw new AppError(
      ErrorCode.BUSINESS_HAS_RELATED_EXPENSES,
      'Cannot delete restaurant with existing expenses'
    );
  }
}
