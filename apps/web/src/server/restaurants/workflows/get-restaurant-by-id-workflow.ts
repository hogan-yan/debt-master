/**
 * Get Restaurant By ID Workflow
 *
 * Extracted business logic for fetching a single restaurant with its expenses.
 * Pure business logic - no framework dependencies.
 */

import type { Prisma } from '@prisma/client';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode } from '@/utils/errors';

// =============================================================================
// TYPES
// =============================================================================

export interface GetRestaurantByIdInput {
  id: number;
}

export interface ParticipantWithColleague {
  id: number;
  amount: number;
  colleague: {
    id: number;
    name: string;
  };
}

export interface ExpenseWithParticipants {
  id: number;
  amount: number;
  date: Date;
  notes: string | null;
  splitType: string;
  restaurantId: number;
  createdBy: string | null;
  createdAt: Date;
  participants: ParticipantWithColleague[];
}

export interface RestaurantWithExpenses {
  id: number;
  name: string;
  address: string | null;
  cuisine: string | null;
  notes: string | null;
  createdAt: Date;
  expenses: ExpenseWithParticipants[];
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Gets a single restaurant by ID with all its expenses and participant details.
 *
 * @param tx - Prisma transaction client for database operations
 * @param input - Object containing the restaurant ID
 * @returns Restaurant with expenses and participants
 * @throws Error if restaurant not found
 */
export async function getRestaurantByIdWorkflow(
  tx: Prisma.TransactionClient,
  input: GetRestaurantByIdInput
): Promise<RestaurantWithExpenses> {
  const restaurant = await tx.restaurant.findUnique({
    where: { id: input.id },
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
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    cuisine: restaurant.cuisine,
    notes: restaurant.notes,
    createdAt: restaurant.createdAt,
    expenses: restaurant.expenses.map((expense) => ({
      id: expense.id,
      amount: serializeDecimal(expense.amount),
      date: expense.date,
      notes: expense.notes,
      splitType: expense.splitType,
      restaurantId: expense.restaurantId,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
      participants: expense.participants.map((participant) => ({
        id: participant.id,
        amount: serializeDecimal(participant.amount),
        colleague: {
          id: participant.colleague.id,
          name: participant.colleague.name,
        },
      })),
    })),
  };
}
