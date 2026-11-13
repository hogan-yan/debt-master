/**
 * Create Restaurant Workflow Tests
 *
 * These tests verify the core business logic of restaurant creation.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { type CreateRestaurantInput, createRestaurantWorkflow } from './create-restaurant-workflow';
import { createMockRestaurant } from './test-helpers';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('createRestaurantWorkflow', () => {
  // Mock transaction client
  let mockTx: ReturnType<typeof createMockTx>;
  let restaurantCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    restaurantCreate = vi.fn();

    mockTx = createMockTx({
      restaurant: {
        create: restaurantCreate,
      },
    });
  });

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  describe('Success Cases', () => {
    it('should create a restaurant with all fields', async () => {
      const input: CreateRestaurantInput = {
        name: 'Test Restaurant',
        address: '123 Test St',
        cuisine: 'italian',
        notes: 'Test notes',
      };

      restaurantCreate.mockResolvedValue(createMockRestaurant());

      const result = await createRestaurantWorkflow(mockTx, input);

      expect(restaurantCreate).toHaveBeenCalledWith({
        data: {
          name: 'Test Restaurant',
          address: '123 Test St',
          cuisine: 'italian',
          notes: 'Test notes',
        },
      });

      expect(result).toEqual({
        id: 1,
        name: 'Test Restaurant',
        address: '123 Test St',
        cuisine: 'italian',
        notes: 'Test notes',
        createdAt: new Date('2024-01-15'),
      });
    });

    it('should create a restaurant with only required fields', async () => {
      const input: CreateRestaurantInput = {
        name: 'Minimal Restaurant',
      };

      restaurantCreate.mockResolvedValue(
        createMockRestaurant({
          id: 2,
          name: 'Minimal Restaurant',
          address: null,
          cuisine: null,
          notes: null,
        })
      );

      const result = await createRestaurantWorkflow(mockTx, input);

      expect(restaurantCreate).toHaveBeenCalledWith({
        data: {
          name: 'Minimal Restaurant',
          address: null,
          cuisine: null,
          notes: null,
        },
      });

      expect(result.address).toBeNull();
      expect(result.cuisine).toBeNull();
      expect(result.notes).toBeNull();
    });

    it('should handle empty strings as null', async () => {
      const input: CreateRestaurantInput = {
        name: 'Test Restaurant',
        address: '',
        cuisine: '',
        notes: '',
      };

      restaurantCreate.mockResolvedValue(createMockRestaurant());

      await createRestaurantWorkflow(mockTx, input);

      expect(restaurantCreate).toHaveBeenCalledWith({
        data: {
          name: 'Test Restaurant',
          address: null,
          cuisine: null,
          notes: null,
        },
      });
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  describe('Error Cases', () => {
    it('should propagate database errors', async () => {
      const input: CreateRestaurantInput = {
        name: 'Test Restaurant',
      };

      restaurantCreate.mockRejectedValue(new Error('Database connection failed'));

      await expect(createRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle unique constraint violations', async () => {
      const input: CreateRestaurantInput = {
        name: 'Duplicate Restaurant',
      };

      const prismaError = new Error('Unique constraint failed on the fields: (`name`)');
      Object.assign(prismaError, { code: 'P2002' });

      restaurantCreate.mockRejectedValue(prismaError);

      await expect(createRestaurantWorkflow(mockTx, input)).rejects.toThrow(
        'Unique constraint failed'
      );
    });
  });
});
