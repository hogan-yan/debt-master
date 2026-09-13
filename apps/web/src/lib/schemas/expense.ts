/**
 * Expense validation schemas
 */

import * as z from 'zod';

// Base expense schema for validation
export const expenseSchema = z.object({
  date: z
    .string({
      message: 'Date is required',
    })
    .min(1, 'Date is required'),
  restaurantId: z
    .string({
      message: 'Restaurant is required',
    })
    .min(1, 'Restaurant is required'),
  amount: z
    .string({
      message: 'Amount is required',
    })
    .min(1, 'Amount is required')
    .refine((val) => {
      const num = Number.parseFloat(val);
      return !Number.isNaN(num) && num > 0;
    }, 'Amount must be greater than 0'),
  splitType: z.enum(['EQUAL', 'ITEMIZED'], {
    message: 'Split type is required',
  }),
  participantIds: z.array(z.string()).min(1, 'At least one participant is required'),
  notes: z.string().optional(),
});

// Form schema with automatic string trimming
export const createExpenseSchema = expenseSchema.transform((data) => ({
  ...data,
  notes: data.notes?.trim() || undefined,
}));

export type ExpenseSchema = z.infer<typeof expenseSchema>;
export type CreateExpenseSchema = z.infer<typeof createExpenseSchema>;
