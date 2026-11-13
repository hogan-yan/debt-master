/**
 * Update Restaurant Workflow Tests
 *
 * These tests verify the core business logic of restaurant updates.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { createMockRestaurant } from './test-helpers';
import { type UpdateRestaurantInput, updateRestaurantWorkflow } from './update-restaurant-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('updateRestaurantWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let restaurantUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    restaurantUpdate = vi.fn();
    mockTx = createMockTx({
      restaurant: {
        update: restaurantUpdate,
      },
    });
  });

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  describe('Success Cases', () => {
    it('should update all fields of a restaurant', async () => {
      const input: UpdateRestaurantInput = {
        id: 1,
        name: 'Updated Restaurant',
        address: '456 New St',
        cuisine: 'mexican',
        notes: 'Updated notes',
      };

      restaurantUpdate.mockResolvedValue(
        createMockRestaurant({
          name: 'Updated Restaurant',
          address: '456 New St',
          cuisine: 'mexican',
          notes: 'Updated notes',
        })
      );

      const result = await updateRestaurantWorkflow(mockTx, input);

      expect(restaurantUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'Updated Restaurant',
          address: '456 New St',
          cuisine: 'mexican',
          notes: 'Updated notes',
        },
      });

      expect(result.name).toBe('Updated Restaurant');
      expect(result.address).toBe('456 New St');
      expect(result.cuisine).toBe('mexican');
      expect(result.notes).toBe('Updated notes');
    });

    it('should update only name field', async () => {
      const input: UpdateRestaurantInput = {
        id: 1,
        name: 'New Name Only',
      };

      restaurantUpdate.mockResolvedValue(
        createMockRestaurant({
          name: 'New Name Only',
        })
      );

      const result = await updateRestaurantWorkflow(mockTx, input);

      expect(restaurantUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: 'New Name Only',
        },
      });

      expect(result.name).toBe('New Name Only');
    });

    it('should handle partial updates correctly', async () => {
      const input: UpdateRestaurantInput = {
        id: 1,
        address: 'New Address',
        cuisine: 'japanese',
      };

      restaurantUpdate.mockResolvedValue(
        createMockRestaurant({
          address: 'New Address',
          cuisine: 'japanese',
        })
      );

      const result = await updateRestaurantWorkflow(mockTx, input);

      expect(restaurantUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          address: 'New Address',
          cuisine: 'japanese',
        },
      });

      expect(result.address).toBe('New Address');
      expect(result.cuisine).toBe('japanese');
    });

    it('should convert empty strings to null', async () => {
      const input: UpdateRestaurantInput = {
        id: 1,
        address: '',
        cuisine: '',
        notes: '',
      };

      restaurantUpdate.mockResolvedValue(createMockRestaurant());

      await updateRestaurantWorkflow(mockTx, input);

      expect(restaurantUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          address: null,
          cuisine: null,
          notes: null,
        },
      });
    });

    it('should not include empty string for name field', async () => {
      const input: UpdateRestaurantInput = {
        id: 1,
        name: '',
        address: 'Some Address',
      };

      restaurantUpdate.mockResolvedValue(createMockRestaurant());

      await updateRestaurantWorkflow(mockTx, input);

      // Name should not be included in update data if empty string
      expect(restaurantUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          address: 'Some Address',
        },
      });
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  describe('Error Cases', () => {
    it('should propagate not found errors', async () => {
      const input: UpdateRestaurantInput = {
        id: 999,
        name: 'Non-existent Restaurant',
      };

      const notFoundError = new Error(
        'An operation failed because it depends on one or more records that were required but not found. '
      );
      Object.assign(notFoundError, { code: 'P2025' });

      restaurantUpdate.mockRejectedValue(notFoundError);

      await expect(updateRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'required but not found'
      );
    });

    it('should propagate database errors', async () => {
      const input: UpdateRestaurantInput = {
        id: 1,
        name: 'Test Restaurant',
      };

      restaurantUpdate.mockRejectedValue(new Error('Database connection failed'));

      await expect(updateRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
