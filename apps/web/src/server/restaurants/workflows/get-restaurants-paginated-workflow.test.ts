/**
 * Get Restaurants Paginated Workflow Tests
 *
 * These tests verify the paginated restaurant fetching logic.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import {
  type GetRestaurantsPaginatedInput,
  getRestaurantsPaginatedWorkflow,
} from './get-restaurants-paginated-workflow';
import { createMockRestaurants } from './test-helpers';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('getRestaurantsPaginatedWorkflow', () => {
  // Mock transaction client
  let mockTx: ReturnType<typeof createMockTx>;
  let restaurantCount: ReturnType<typeof vi.fn>;
  let restaurantFindMany: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    restaurantCount = vi.fn();
    restaurantFindMany = vi.fn();

    mockTx = createMockTx({
      restaurant: {
        count: restaurantCount,
        findMany: restaurantFindMany,
      },
    });
  });

  // =============================================================================
  // PAGINATION TESTS
  // =============================================================================

  describe('Pagination', () => {
    it('should return first page of restaurants', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(25);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(10));

      const result = await getRestaurantsPaginatedWorkflow(mockTx, input);

      expect(result.data).toHaveLength(10);
      expect(result.totalCount).toBe(25);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
    });

    it('should return second page correctly', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 2,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(25);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(10, 11));

      const result = await getRestaurantsPaginatedWorkflow(mockTx, input);

      expect(result.page).toBe(2);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);

      // Verify skip calculation (page - 1) * pageSize = (2 - 1) * 10 = 10
      expect(restaurantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should handle last page correctly', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 3,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(25);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(5, 21));

      const result = await getRestaurantsPaginatedWorkflow(mockTx, input);

      expect(result.data).toHaveLength(5);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(true);
    });

    it('should handle empty results', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(0);
      restaurantFindMany.mockResolvedValue([]);

      const result = await getRestaurantsPaginatedWorkflow(mockTx, input);

      expect(result.data).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });
  });

  // =============================================================================
  // SORTING TESTS
  // =============================================================================

  describe('Sorting', () => {
    it('should sort by name ascending', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(5);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(5));

      await getRestaurantsPaginatedWorkflow(mockTx, input);

      expect(restaurantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should sort by createdAt descending', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      restaurantCount.mockResolvedValue(5);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(5));

      await getRestaurantsPaginatedWorkflow(mockTx, input);

      expect(restaurantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should default to name sort for invalid sortBy', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        // Using an invalid value to test the fallback
        sortBy: 'invalid' as 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(5);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(5));

      await getRestaurantsPaginatedWorkflow(mockTx, input);

      // Should fall back to name_asc for invalid sortBy
      expect(restaurantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });
  });

  // =============================================================================
  // SEARCH TESTS
  // =============================================================================

  describe('Search', () => {
    it('should search by name', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        search: 'Pizza',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(3);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(3));

      await getRestaurantsPaginatedWorkflow(mockTx, input);

      const expectedWhere = {
        OR: [
          { name: { contains: 'Pizza', mode: 'insensitive' } },
          { address: { contains: 'Pizza', mode: 'insensitive' } },
          { cuisine: { contains: 'Pizza', mode: 'insensitive' } },
        ],
      };

      expect(restaurantCount).toHaveBeenCalledWith({
        where: expectedWhere,
      });

      expect(restaurantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        })
      );
    });

    it('should handle empty search string', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        search: '',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(10);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(10));

      await getRestaurantsPaginatedWorkflow(mockTx, input);

      // Empty search should use empty where clause
      expect(restaurantCount).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should handle undefined search', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(10);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(10));

      await getRestaurantsPaginatedWorkflow(mockTx, input);

      // Undefined search should use empty where clause
      expect(restaurantCount).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should handle search with special characters', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        search: 'Pizza & Pasta',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(2);
      restaurantFindMany.mockResolvedValue(createMockRestaurants(2));

      await getRestaurantsPaginatedWorkflow(mockTx, input);

      expect(restaurantCount).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'Pizza & Pasta', mode: 'insensitive' } },
            { address: { contains: 'Pizza & Pasta', mode: 'insensitive' } },
            { cuisine: { contains: 'Pizza & Pasta', mode: 'insensitive' } },
          ],
        },
      });
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  describe('Error Cases', () => {
    it('should propagate database errors on count', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockRejectedValue(new Error('Database connection failed'));

      await expect(getRestaurantsPaginatedWorkflow(mockTx, input)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate database errors on findMany', async () => {
      const input: GetRestaurantsPaginatedInput = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      restaurantCount.mockResolvedValue(100);
      restaurantFindMany.mockRejectedValue(new Error('Query timeout'));

      await expect(getRestaurantsPaginatedWorkflow(mockTx, input)).rejects.toThrow('Query timeout');
    });
  });
});
