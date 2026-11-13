/**
 * Delete Restaurant Workflow Tests
 *
 * These tests verify the core business logic of restaurant deletion.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { type DeleteRestaurantInput, deleteRestaurantWorkflow } from './delete-restaurant-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('deleteRestaurantWorkflow', () => {
  // Mock transaction client
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseFindMany: ReturnType<typeof vi.fn>;
  let restaurantDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseFindMany = vi.fn();
    restaurantDelete = vi.fn();

    mockTx = createMockTx({
      expense: {
        findMany: expenseFindMany,
      },
      restaurant: {
        delete: restaurantDelete,
      },
    });
  });

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  describe('Success Cases', () => {
    it('should delete a restaurant with no expenses', async () => {
      const input: DeleteRestaurantInput = {
        id: 1,
      };

      // No expenses found
      expenseFindMany.mockResolvedValue([]);
      restaurantDelete.mockResolvedValue({
        id: 1,
        name: 'Deleted Restaurant',
      });

      const result = await deleteRestaurantWorkflow(mockTx, input);

      expect(expenseFindMany).toHaveBeenCalledWith({
        where: { restaurantId: 1 },
        select: { id: true },
        take: 1,
      });

      expect(restaurantDelete).toHaveBeenCalledWith({
        where: { id: 1 },
      });

      expect(result).toEqual({ success: true });
    });

    it('should delete a restaurant with only 1 expense check', async () => {
      const input: DeleteRestaurantInput = {
        id: 2,
      };

      // Verify that we only check for existence, not count
      expenseFindMany.mockResolvedValue([]);
      restaurantDelete.mockResolvedValue({
        id: 2,
        name: 'Test Restaurant',
      });

      await deleteRestaurantWorkflow(mockTx, input);

      // Verify we only take 1 record to check existence
      expect(expenseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  describe('Error Cases', () => {
    it('should throw error when restaurant has expenses', async () => {
      const input: DeleteRestaurantInput = {
        id: 1,
      };

      // Restaurant has expenses
      expenseFindMany.mockResolvedValue([{ id: 1 }]);

      await expect(deleteRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'Cannot delete restaurant with existing expenses'
      );

      // Verify delete was not called
      expect(restaurantDelete).not.toHaveBeenCalled();
    });

    it('should throw error when restaurant has multiple expenses', async () => {
      const input: DeleteRestaurantInput = {
        id: 1,
      };

      // Even with multiple expenses, we only need to find one
      expenseFindMany.mockResolvedValue([{ id: 1 }]);

      await expect(deleteRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'Cannot delete restaurant with existing expenses'
      );
    });

    it('should propagate not found errors', async () => {
      const input: DeleteRestaurantInput = {
        id: 999,
      };

      expenseFindMany.mockResolvedValue([]);

      const notFoundError = new Error(
        'An operation failed because it depends on one or more records that were required but not found.'
      );
      Object.assign(notFoundError, { code: 'P2025' });

      restaurantDelete.mockRejectedValue(notFoundError);

      await expect(deleteRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'required but not found'
      );
    });

    it('should propagate database errors', async () => {
      const input: DeleteRestaurantInput = {
        id: 1,
      };

      expenseFindMany.mockResolvedValue([]);
      restaurantDelete.mockRejectedValue(new Error('Database connection failed'));

      await expect(deleteRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
