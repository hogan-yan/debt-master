/**
 * Tests for createExpenseFieldValidator
 */

import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { createExpenseFieldValidator } from '../expense-validation';

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  restaurantId: z.string().min(1, 'Restaurant is required'),
  amount: z.string().refine((v) => !Number.isNaN(Number.parseFloat(v)), 'Amount is required'),
});

describe('createExpenseFieldValidator', () => {
  it('returns undefined for valid value', () => {
    const validateDate = createExpenseFieldValidator((v) => schema.shape.date.safeParse(v));
    expect(validateDate({ value: '2024-01-15' })).toBeUndefined();
  });

  it('returns error message for invalid value', () => {
    const validateRestaurantId = createExpenseFieldValidator((v) =>
      schema.shape.restaurantId.safeParse(v)
    );
    expect(validateRestaurantId({ value: '' })).toBe('Restaurant is required');
  });
});
