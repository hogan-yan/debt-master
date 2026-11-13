import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { createRestaurantSchema, updateRestaurantSchema } from '@/lib/schemas';
import { requireAdminFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { handleRestaurantError, validateRestaurantForDeletion } from './restaurant-utils';

/**
 * Create a new restaurant
 * @param data - Restaurant creation data (name and address)
 * @returns Created restaurant object
 */
export const createRestaurant = createServerFn({ method: 'POST' })
  .validator((data) => {
    return createRestaurantSchema.extend({}).parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      return await prisma.restaurant.create({
        data: {
          name: data.name,
          address: data.address,
          cuisine: data.cuisine,
          notes: data.notes,
        },
      });
    } catch (error) {
      handleRestaurantError(error, 'create restaurant');
    }
  });

/**
 * Update an existing restaurant
 * @param data - Restaurant update data including ID
 * @returns Updated restaurant object
 */
export const updateRestaurant = createServerFn({ method: 'POST' })
  .validator((data) => {
    return updateRestaurantSchema.extend({}).parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      return await prisma.restaurant.update({
        where: { id: data.id },
        data: buildUpdateData(data),
      });
    } catch (error) {
      handleRestaurantError(error, 'update restaurant');
    }
  });

/**
 * Delete a restaurant
 * Only allows deletion if restaurant has no associated expenses
 * @param data - Object containing restaurant ID
 * @returns Success confirmation object
 */
export const deleteRestaurant = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      await validateRestaurantForDeletion(data.id);

      await prisma.restaurant.delete({
        where: { id: data.id },
      });

      return { success: true };
    } catch (error) {
      handleRestaurantError(error, 'delete restaurant');
    }
  });

/**
 * Builds update data object with only provided fields
 * @param data - Raw update data from request
 * @returns Sanitized update object for Prisma
 */
function buildUpdateData(data: {
  name?: string | undefined;
  address?: string | undefined;
  cuisine?: string | undefined;
  notes?: string | undefined;
}) {
  const updateData: {
    name?: string;
    address?: string | null;
    cuisine?: string | null;
    notes?: string | null;
  } = {};

  if (data.name) {
    updateData.name = data.name;
  }

  if (data.address !== undefined) {
    updateData.address = data.address || null;
  }

  if (data.cuisine !== undefined) {
    updateData.cuisine = data.cuisine;
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes || null;
  }

  return updateData;
}
