/**
 * Create Restaurant Workflow
 *
 * Extracted business logic for creating a new restaurant.
 * Pure business logic - no framework dependencies.
 */

import type { Prisma } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateRestaurantInput {
  name: string;
  address?: string | undefined;
  cuisine?: string | undefined;
  notes?: string | undefined;
}

export interface CreateRestaurantResult {
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
 * Creates a new restaurant in the database.
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Restaurant creation parameters
 * @returns Created restaurant with all fields
 */
export async function createRestaurantWorkflow(
  tx: Prisma.TransactionClient,
  input: CreateRestaurantInput
): Promise<CreateRestaurantResult> {
  // Helper to convert undefined or empty string to null
  const toNullable = (value: string | undefined): string | null => {
    if (value === undefined || value === '') return null;
    return value;
  };

  const restaurant = await tx.restaurant.create({
    data: {
      name: input.name,
      address: toNullable(input.address),
      cuisine: toNullable(input.cuisine),
      notes: toNullable(input.notes),
    },
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
