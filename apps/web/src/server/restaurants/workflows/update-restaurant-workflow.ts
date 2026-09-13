/**
 * Update Restaurant Workflow
 *
 * Extracted business logic for updating a restaurant.
 * Pure business logic - no framework dependencies.
 */

import type { Prisma } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface UpdateRestaurantInput {
  id: number;
  name?: string | undefined;
  address?: string | undefined;
  cuisine?: string | undefined;
  notes?: string | undefined;
}

export interface UpdateRestaurantResult {
  id: number;
  name: string;
  address: string | null;
  cuisine: string | null;
  notes: string | null;
  createdAt: Date;
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Updates an existing restaurant in the database.
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Restaurant update parameters including ID
 * @returns Updated restaurant with all fields
 * @throws Error if restaurant not found
 */
export async function updateRestaurantWorkflow(
  tx: Prisma.TransactionClient,
  input: UpdateRestaurantInput
): Promise<UpdateRestaurantResult> {
  const updateData = buildUpdateData(input);

  const restaurant = await tx.restaurant.update({
    where: { id: input.id },
    data: updateData,
  });

  return {
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    cuisine: restaurant.cuisine,
    notes: restaurant.notes,
    createdAt: restaurant.createdAt,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Builds the update data object with only provided fields.
 * Converts empty strings to null and omits undefined values.
 *
 * @param input - Raw update data from request
 * @returns Sanitized update object for Prisma
 */
function buildUpdateData(input: UpdateRestaurantInput): {
  name?: string;
  address?: string | null;
  cuisine?: string | null;
  notes?: string | null;
} {
  const updateData: {
    name?: string;
    address?: string | null;
    cuisine?: string | null;
    notes?: string | null;
  } = {};

  if (input.name !== undefined && input.name !== '') {
    updateData.name = input.name;
  }

  if (input.address !== undefined) {
    updateData.address = input.address || null;
  }

  if (input.cuisine !== undefined) {
    updateData.cuisine = input.cuisine || null;
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes || null;
  }

  return updateData;
}
