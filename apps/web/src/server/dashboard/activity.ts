import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import type { RecentActivity } from './types';
import {
  mergeAndSortActivities,
  type RawExpense,
  type RawPayment,
  transformExpensesToActivities,
  transformPaymentsToActivities,
} from './workflows/activity-workflow';

export const getRecentActivity = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        limit: z.number().int().positive().default(10),
      })
      .parse(data);
  })
  .handler(async ({ data }): Promise<RecentActivity[]> => {
    // Auth gate (resolves DEBTM-190): return empty for unauthenticated callers
    // so anonymous RPC cannot read expense/payment activity. Matches the
    // optional-auth pattern used by sibling dashboard reads (stats, charts).
    if (!(await getAuthFromCookie())) return [];
    try {
      const limit = data.limit;

      const [recentExpenses, recentPayments] = await Promise.all([
        prisma.expense.findMany({
          take: limit,
          orderBy: { date: 'desc' },
          include: { restaurant: true },
        }),
        prisma.payment.findMany({
          take: limit,
          orderBy: { date: 'desc' },
          include: { colleague: true, restaurant: true },
        }),
      ]);

      const rawExpenses: RawExpense[] = recentExpenses.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        date: e.date,
        restaurant: e.restaurant,
      }));

      const rawPayments: RawPayment[] = recentPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        date: p.date,
        colleague: p.colleague,
        restaurant: p.restaurant,
      }));

      const expenseActivities = transformExpensesToActivities(rawExpenses);
      const paymentActivities = transformPaymentsToActivities(rawPayments);

      return mergeAndSortActivities(expenseActivities, paymentActivities, limit);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch recent activity');
    }
  });
