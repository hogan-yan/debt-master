import * as z from 'zod';

/**
 * Define the payment schema for validation
 */
export const paymentSchema = z.object({
  colleagueId: z.number().int().positive(),
  amount: z.number().positive(),
  date: z.string(),
  paymentType: z.enum(['PAYME', 'FPS', 'CASH', 'OTHER']),
  restaurantId: z.number().int().positive().optional(),
});

/**
 * Payment form data with optional payment proof
 */
export const paymentFormSchema = z.object({
  colleagueId: z.number().int().positive(),
  amount: z.number().positive(),
  date: z.string(),
  paymentType: z.enum(['PAYME', 'FPS', 'CASH', 'OTHER']),
  restaurantId: z.number().int().positive().optional(),
  paymentProofFile: z.instanceof(File).optional(),
});
