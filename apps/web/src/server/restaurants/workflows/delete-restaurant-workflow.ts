/**
 * Delete Restaurant Workflow
 *
 * Extracted business logic for deleting a restaurant.
 * Only allows deletion if restaurant has no associated expenses.
 * Pure business logic - no framework dependencies.
 */

import type { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '@/utils/errors';

// =============================================================================
// TYPES
// =============================================================================

export interface DeleteRestaurantInput {
  id: number;
}

export interface DeleteRestaurantResult {
  success: true;
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Deletes a restaurant from the database.
 * Only allows deletion if the restaurant has no associated expenses.
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Restaurant deletion parameters
 * @returns Success confirmation
 * @throws Error if restaurant has expenses or not found
 */
export async function deleteRestaurantWorkflow(
  tx: Prisma.TransactionClient,
  input: DeleteRestaurantInput
): Promise<DeleteRestaurantResult> {
  // Validate that the restaurant has no associated expenses
  await validateRestaurantForDeletion(tx, input.id);

  // Delete the restaurant
  await tx.restaurant.delete({
    where: { id: input.id },
  });

  return { success: true };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validates that a restaurant exists and has no associated expenses.
 * Used before deletion operations.
 *
 * @param tx - Prisma transaction client
 * @param restaurantId - ID of the restaurant to validate
 * @throws Error if restaurant has expenses
 */
async function validateRestaurantForDeletion(
  tx: Prisma.TransactionClient,
  restaurantId: number
): Promise<void> {
  const expenses = await tx.expense.findMany({
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
