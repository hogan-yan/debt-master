/**
 * Get Restaurant By ID Workflow Tests
 *
 * These tests verify the restaurant by ID fetching logic with expenses.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import {
  type GetRestaurantByIdInput,
  getRestaurantByIdWorkflow,
} from './get-restaurant-by-id-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('getRestaurantByIdWorkflow', () => {
  // Mock transaction client
  let mockTx: ReturnType<typeof createMockTx>;
  let restaurantFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    restaurantFindUnique = vi.fn();

    mockTx = createMockTx({
      restaurant: {
        findUnique: restaurantFindUnique,
      },
    });
  });

  // Helper to create mock restaurant with expenses
  const createMockRestaurant = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    name: 'Test Restaurant',
    address: '123 Test St',
    cuisine: 'italian',
    notes: 'Test notes',
    createdAt: new Date('2024-01-15'),
    expenses: [
      {
        id: 1,
        amount: new Prisma.Decimal('50.00'),
        date: new Date('2024-06-01'),
        notes: null,
        splitType: 'EQUAL',
        restaurantId: 1,
        createdBy: 'ADMIN',
        createdAt: new Date('2024-06-01'),
        participants: [
          {
            id: 1,
            amount: new Prisma.Decimal('25.00'),
            colleague: {
              id: 1,
              name: 'John Doe',
            },
          },
          {
            id: 2,
            amount: new Prisma.Decimal('25.00'),
            colleague: {
              id: 2,
              name: 'Jane Smith',
            },
          },
        ],
      },
    ],
    ...overrides,
  });

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  describe('Success Cases', () => {
    it('should return restaurant with expenses and participants', async () => {
      const input: GetRestaurantByIdInput = {
        id: 1,
      };

      restaurantFindUnique.mockResolvedValue(createMockRestaurant());

      const result = await getRestaurantByIdWorkflow(mockTx, input);

      expect(restaurantFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
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

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Restaurant');
      expect(result.expenses).toHaveLength(1);

      // Verify expense serialization
      const expense = result.expenses[0]!;
      expect(expense.amount).toBe(50);
      expect(expense.participants).toHaveLength(2);

      // Verify participant serialization
      const participant = expense.participants[0]!;
      expect(participant.amount).toBe(25);
      expect(participant.colleague.name).toBe('John Doe');
    });

    it('should return restaurant with no expenses', async () => {
      const input: GetRestaurantByIdInput = {
        id: 2,
      };

      restaurantFindUnique.mockResolvedValue(
        createMockRestaurant({
          id: 2,
          name: 'New Restaurant',
          expenses: [],
        })
      );

      const result = await getRestaurantByIdWorkflow(mockTx, input);

      expect(result.id).toBe(2);
      expect(result.expenses).toEqual([]);
    });

    it('should handle multiple expenses with multiple participants', async () => {
      const input: GetRestaurantByIdInput = {
        id: 1,
      };

      restaurantFindUnique.mockResolvedValue(
        createMockRestaurant({
          expenses: [
            {
              id: 1,
              amount: new Prisma.Decimal('100.00'),
              date: new Date('2024-06-01'),
              notes: 'Team lunch',
              splitType: 'EQUAL',
              restaurantId: 1,
              createdBy: 'ADMIN',
              createdAt: new Date('2024-06-01'),
              participants: [
                {
                  id: 1,
                  amount: new Prisma.Decimal('33.33'),
                  colleague: { id: 1, name: 'Alice' },
                },
                {
                  id: 2,
                  amount: new Prisma.Decimal('33.33'),
                  colleague: { id: 2, name: 'Bob' },
                },
                {
                  id: 3,
                  amount: new Prisma.Decimal('33.34'),
                  colleague: { id: 3, name: 'Charlie' },
                },
              ],
            },
            {
              id: 2,
              amount: new Prisma.Decimal('50.00'),
              date: new Date('2024-06-02'),
              notes: null,
              splitType: 'EQUAL',
              restaurantId: 1,
              createdBy: 'ADMIN',
              createdAt: new Date('2024-06-02'),
              participants: [
                {
                  id: 4,
                  amount: new Prisma.Decimal('25.00'),
                  colleague: { id: 1, name: 'Alice' },
                },
                {
                  id: 5,
                  amount: new Prisma.Decimal('25.00'),
                  colleague: { id: 2, name: 'Bob' },
                },
              ],
            },
          ],
        })
      );

      const result = await getRestaurantByIdWorkflow(mockTx, input);

      expect(result.expenses).toHaveLength(2);
      expect(result.expenses[0]!.participants).toHaveLength(3);
      expect(result.expenses[1]!.participants).toHaveLength(2);

      // Verify decimals are properly serialized
      expect(result.expenses[0]!.amount).toBe(100);
      expect(result.expenses[0]!.participants[0]!.amount).toBe(33.33);
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  describe('Error Cases', () => {
    it('should throw error when restaurant not found', async () => {
      const input: GetRestaurantByIdInput = {
        id: 999,
      };

      restaurantFindUnique.mockResolvedValue(null);

      await expect(getRestaurantByIdWorkflow(mockTx, input)).rejects.toThrow(
        'Restaurant not found'
      );
    });

    it('should propagate database errors', async () => {
      const input: GetRestaurantByIdInput = {
        id: 1,
      };

      restaurantFindUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(getRestaurantByIdWorkflow(mockTx, input)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
