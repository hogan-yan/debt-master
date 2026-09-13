/**
 * Restaurant validation schemas for the debt-master application
 */

import * as z from 'zod';
import { m } from '@/paraglide/messages';

// Canonical cuisine enum values (stored in DB as lowercase snake_case)
export const CUISINE_VALUES = [
  'japanese',
  'chinese',
  'italian',
  'mexican',
  'indian',
  'thai',
  'korean',
  'american',
  'fast_food',
  'cafe',
  'bar_pub',
  'bakery',
  'vegetarian_vegan',
  'other',
] as const;

export type Cuisine = (typeof CUISINE_VALUES)[number];

const cuisineLabelMap: Record<Cuisine, () => string> = {
  japanese: m.cuisine_japanese,
  chinese: m.cuisine_chinese,
  italian: m.cuisine_italian,
  mexican: m.cuisine_mexican,
  indian: m.cuisine_indian,
  thai: m.cuisine_thai,
  korean: m.cuisine_korean,
  american: m.cuisine_american,
  fast_food: m.cuisine_fast_food,
  cafe: m.cuisine_cafe,
  bar_pub: m.cuisine_bar_pub,
  bakery: m.cuisine_bakery,
  vegetarian_vegan: m.cuisine_vegetarian_vegan,
  other: m.cuisine_other,
};

export function isCuisine(value: string): value is Cuisine {
  return (CUISINE_VALUES as readonly string[]).includes(value);
}

export function getCuisineLabel(cuisine: string): string {
  if (isCuisine(cuisine)) return cuisineLabelMap[cuisine]();
  return cuisine;
}

export function getCuisineSelectOptions(): { value: string; label: string }[] {
  return CUISINE_VALUES.map((value) => ({
    value,
    label: cuisineLabelMap[value](),
  }));
}

// Base restaurant schema for validation
export const restaurantSchema = z.object({
  name: z
    .string()
    .min(1, 'Restaurant name is required')
    .max(100, 'Restaurant name must be less than 100 characters')
    .trim(),
  address: z
    .string()
    .optional()
    .transform((val) => val || undefined), // Convert empty string to undefined
});

// Schema for creating a restaurant (address required)
export const createRestaurantSchema = z.object({
  name: z
    .string()
    .min(1, 'Restaurant name is required')
    .min(2, 'Restaurant name must be at least 2 characters long')
    .max(100, 'Restaurant name must be less than 100 characters')
    .trim(),
  address: z
    .string()
    .min(1, 'Address is required')
    .min(5, 'Address must be at least 5 characters long')
    .max(200, 'Address must be less than 200 characters')
    .trim(),
  cuisine: z
    .enum(CUISINE_VALUES)
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .trim()
    .optional()
    .transform((val) => val || undefined),
});

// Schema for updating a restaurant
export const updateRestaurantSchema = z.object({
  id: z.number().int().positive(),
  name: z
    .string()
    .min(1, 'Restaurant name is required')
    .min(2, 'Restaurant name must be at least 2 characters long')
    .max(100, 'Restaurant name must be less than 100 characters')
    .trim()
    .optional(),
  address: z.string().max(200, 'Address must be less than 200 characters').trim().optional(),
  cuisine: z
    .enum(CUISINE_VALUES)
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  notes: z.string().max(500, 'Notes must be less than 500 characters').trim().optional(),
});

// Type exports
export type RestaurantSchema = z.infer<typeof restaurantSchema>;
export type CreateRestaurantSchema = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantSchema = z.infer<typeof updateRestaurantSchema>;
