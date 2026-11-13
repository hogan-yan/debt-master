/**
 * Get Restaurants Paginated Workflow
 *
 * Extracted business logic for fetching paginated restaurants with search and sorting.
 * Pure business logic - no framework dependencies.
 */

import type { Prisma } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export type SortByField = 'name' | 'address' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface GetRestaurantsPaginatedInput {
  page: number;
  pageSize: number;
  search?: string | undefined;
  sortBy: SortByField;
  sortOrder: SortOrder;
}

export interface RestaurantBase {
  id: number;
  name: string;
  address: string | null;
  cuisine: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface PaginatedRestaurantsResult {
  data: RestaurantBase[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Gets paginated restaurants with optional search, sorting, and pagination.
 *
 * @param tx - Prisma transaction client for database operations
 * @param input - Pagination, search, and sorting parameters
 * @returns Paginated restaurant data
 */
export async function getRestaurantsPaginatedWorkflow(
  tx: Prisma.TransactionClient,
  input: GetRestaurantsPaginatedInput
): Promise<PaginatedRestaurantsResult> {
  const { page, pageSize, search, sortBy, sortOrder } = input;
  const skip = (page - 1) * pageSize;

  const whereClause = buildWhereClause(search);
  const orderBy = buildOrderByClause(sortBy, sortOrder);

  // Execute count and fetch in parallel
  const [totalCount, restaurants] = await Promise.all([
    tx.restaurant.count({ where: whereClause }),
    tx.restaurant.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        address: true,
        cuisine: true,
        notes: true,
        createdAt: true,
      },
      orderBy,
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data: restaurants,
    totalCount,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Builds the where clause for database queries based on search term.
 *
 * @param search - Optional search term
 * @returns Prisma where clause object
 */
function buildWhereClause(search: string | undefined): Prisma.RestaurantWhereInput {
  if (!search || search.trim() === '') {
    return {};
  }

  const searchTerm = search.trim();

  return {
    OR: [
      { name: { contains: searchTerm, mode: 'insensitive' as const } },
      { address: { contains: searchTerm, mode: 'insensitive' as const } },
      { cuisine: { contains: searchTerm, mode: 'insensitive' as const } },
    ],
  };
}

/**
 * Builds the orderBy clause for database queries.
 *
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort direction
 * @returns Prisma orderBy object
 */
function buildOrderByClause(
  sortBy: SortByField,
  sortOrder: SortOrder
): Prisma.RestaurantOrderByWithRelationInput {
  // Only allow sorting by actual database fields
  if (sortBy === 'name' || sortBy === 'address' || sortBy === 'createdAt') {
    return { [sortBy]: sortOrder };
  }

  // Default sort by name
  return { name: 'asc' };
}
