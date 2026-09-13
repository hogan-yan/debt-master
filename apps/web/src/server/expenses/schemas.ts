import * as z from 'zod';
import { sanitizeSearchInput } from '@/server/utils/search-sanitization';

/**
 * Define the expense schema for validation
 */
export const expenseSchema = z.object({
  date: z.string(),
  restaurantId: z.number().int().positive(),
  amount: z.number().positive(),
  splitType: z.enum(['EQUAL', 'ITEMIZED']),
  participantIds: z.array(z.number().int().positive()).min(1),
  items: z
    .array(
      z.object({
        name: z.string().optional(),
        price: z.number().positive(),
        colleagueId: z.number().int().positive(),
      })
    )
    .optional(),
  notes: z.string().optional(),
});

/**
 * Pagination schema for expenses
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  search: z.string().optional().transform(sanitizeSearchInput),
  sortBy: z.enum(['date', 'amount', 'splitType', 'restaurant', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  colleagueIds: z.array(z.number().int().positive()).optional(),
  paymentStatus: z.enum(['all', 'paid', 'unpaid', 'partial']).optional().default('all'),
});
