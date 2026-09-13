/**
 * Colleague validation schemas
 */

import * as z from 'zod';

// Base colleague schema for validation
export const colleagueSchema = z.object({
  name: z
    .string({
      message: 'Name is required',
    })
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters long'),
});

// Form schema with automatic string trimming
export const createColleagueSchema = colleagueSchema.transform((data) => ({
  name: data.name.trim(),
}));

export type ColleagueSchema = z.infer<typeof colleagueSchema>;
export type CreateColleagueSchema = z.infer<typeof createColleagueSchema>;
