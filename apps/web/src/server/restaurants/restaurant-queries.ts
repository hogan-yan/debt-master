import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { serializeDecimal } from '@/server/utils/decimal';
import { sanitizeSearchInput } from '@/server/utils/search-sanitization';
import { AppError, ErrorCode } from '@/utils/errors';
import { createEmptyPaginatedResponse, createPaginatedResponse } from '../utils/pagination';
import {
  getAllRestaurantsExpenseAggregation,
  getExpenseAggregationMap,
  handleRestaurantError,
} from './restaurant-utils';
/**
 * Get all restaurants with expense aggregation data
 * @deprecated Use getRestaurantsPaginated for better performance
 * @returns Array of restaurants with expense statistics
 */
export const getRestaurants = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) return [];
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        cuisine: true,
        notes: true,
        createdAt: true,
      },
    });

    const expenseTotalMap = await getAllRestaurantsExpenseAggregation();

    return restaurants.map((restaurant) => {
      const expenseData = expenseTotalMap.get(restaurant.id) || {
        totalExpenses: 0,
        totalAmount: 0,
      };

      return {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        cuisine: restaurant.cuisine,
        notes: restaurant.notes,
        createdAt: restaurant.createdAt,
        totalExpenses: expenseData.totalExpenses,
        totalAmount: expenseData.totalAmount,
      };
    });
  } catch (error) {
    handleRestaurantError(error, 'fetch restaurants');
  }
});

/**
 * Get paginated restaurants with search and sorting capabilities
 * @param data - Pagination, search, and sorting parameters
 * @returns Paginated restaurant data with expense statistics
 */
export const getRestaurantsPaginated = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
        search: z.string().optional().transform(sanitizeSearchInput),
        sortBy: z.enum(['name', 'address', 'createdAt']).default('name'),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    if (!(await getAuthFromCookie())) {
      return createEmptyPaginatedResponse(data.page, data.pageSize);
    }
    try {
      const { page, pageSize, search, sortBy, sortOrder } = data;
      const skip = (page - 1) * pageSize;

      const whereClause = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { address: { contains: search, mode: 'insensitive' as const } },
              { cuisine: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [totalCount, restaurants] = await Promise.all([
        prisma.restaurant.count({ where: whereClause }),
        prisma.restaurant.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            address: true,
            cuisine: true,
            notes: true,
            createdAt: true,
          },
          orderBy: buildOrderByClause(sortBy, sortOrder),
          skip,
          take: pageSize,
        }),
      ]);

      const restaurantIds = restaurants.map((r) => r.id);
      const expenseTotalMap = await getExpenseAggregationMap(restaurantIds);

      const restaurantsWithStats = restaurants.map((restaurant) => {
        const expenseData = expenseTotalMap.get(restaurant.id) || {
          totalExpenses: 0,
          totalAmount: 0,
        };

        return {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          cuisine: restaurant.cuisine,
          notes: restaurant.notes,
          createdAt: restaurant.createdAt,
          totalExpenses: expenseData.totalExpenses,
          totalAmount: expenseData.totalAmount,
        };
      });

      // Note: Computed fields (totalExpenses, totalAmount) are not sortable
      // as they would require loading all data to sort properly across pages

      return createPaginatedResponse(restaurantsWithStats, totalCount, page, pageSize);
    } catch (error) {
      handleRestaurantError(error, 'fetch paginated restaurants');
    }
  });

/**
 * Get restaurant by ID with full expense details
 * @param data - Object containing restaurant ID
 * @returns Restaurant with expenses and participants
 */
export const getRestaurantById = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAuthFromCookie();
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: data.id },
        include: {
          expenses: {
            include: {
              participants: {
                include: {
                  colleague: true,
                },
              },
            },
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!restaurant) {
        throw new AppError(ErrorCode.NOT_FOUND_RESTAURANT, 'Restaurant not found');
      }

      return {
        ...restaurant,
        expenses: restaurant.expenses.map((expense) => ({
          ...expense,
          amount: serializeDecimal(expense.amount),
          participants: expense.participants.map((participant) => ({
            ...participant,
            amount: serializeDecimal(participant.amount),
            colleague: {
              ...participant.colleague,
            },
          })),
        })),
      };
    } catch (error) {
      handleRestaurantError(error, 'fetch restaurant');
    }
  });

/**
 * Builds the orderBy clause for database queries
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort direction
 * @returns Prisma orderBy object
 */
function buildOrderByClause(
  sortBy: 'name' | 'address' | 'createdAt',
  sortOrder: 'asc' | 'desc'
): Record<string, 'asc' | 'desc'> {
  return { [sortBy]: sortOrder };
}

// Note: sortByComputedField function was removed as we no longer support
// sorting by computed fields (totalExpenses, totalAmount) to avoid
// the "only sort in same page" issue
