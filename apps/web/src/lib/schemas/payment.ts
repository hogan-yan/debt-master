/**
 * Payment validation schemas
 */

import * as z from 'zod';

// Base payment schema for validation
export const paymentSchema = z.object({
  colleagueId: z
    .string({
      message: 'Colleague is required',
    })
    .min(1, 'Colleague is required'),
  amount: z
    .string({
      message: 'Amount is required',
    })
    .min(1, 'Amount is required')
    .refine((val) => {
      const num = Number.parseFloat(val);
      return !Number.isNaN(num) && num > 0;
    }, 'Amount must be greater than 0'),
  date: z
    .string({
      message: 'Date is required',
    })
    .min(1, 'Date is required'),
  paymentType: z.enum(['PAYME', 'FPS', 'CASH', 'OTHER'], {
    message: 'Payment method is required',
  }),
  paymentProofFile: z.instanceof(File).optional(),
  expenseId: z.number().int().positive().optional(),
  restaurantId: z.number().int().positive().optional(),
  // Add payment proof management flags
  keepExistingProof: z.boolean().optional(),
  removeExistingProof: z.boolean().optional(),
  // Add expense payment specific fields
  selectedExpenseIds: z.array(z.number().int().positive()).optional(),
  expenseAmounts: z.record(z.string(), z.string()).optional(),
});

// Form schema - no transformation needed
export const createPaymentSchema = paymentSchema;

export type PaymentSchema = z.infer<typeof paymentSchema>;
export type CreatePaymentSchema = z.infer<typeof createPaymentSchema>;
