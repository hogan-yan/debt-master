/**
 * Spending Analytics Server Functions
 * Comprehensive spending insights and participation analytics
 */

import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import { daysSince } from './dashboard/analytics-helpers';

interface ColleagueSpendingStats {
  id: number;
  name: string;
  totalSpent: number;
  expenseCount: number;
  averageSpent: number;
  participationRate: number;
  lastExpenseDate: string | null;
  daysSinceLastExpense: number;
}

/**
 * Get comprehensive spending analytics for the spending dashboard tab
 */
export const getSpendingAnalytics = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) {
    return {
      topSpenders: [],
      lowSpenders: [],
      inactiveMembers: [],
      frequentParticipants: [],
      overview: {
        totalColleagues: 0,
        activeColleagues: 0,
        totalExpenses: 0,
        totalSpending: 0,
        averageSpendingPerPerson: 0,
      },
    };
  }
  try {
    // Batch aggregation queries instead of loading all expenses
    const [participantAggregates, lastExpenseDates, expenseCount, colleagues] = await Promise.all([
      // Per-colleague spending via groupBy
      prisma.expenseParticipant.groupBy({
        by: ['colleagueId'],
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Last expense date per colleague via DISTINCT ON
      prisma.expenseParticipant.findMany({
        where: { colleague: { deletedAt: null } },
        select: { colleagueId: true, expense: { select: { date: true } } },
        orderBy: { expense: { date: 'desc' } },
        distinct: ['colleagueId'],
      }),
      // Total expense count
      prisma.expense.aggregate({ _count: { id: true } }),
      // All colleague names
      prisma.colleague.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);

    const totalExpenses = expenseCount._count.id;

    // Build lookup maps
    const lastDateMap = new Map(lastExpenseDates.map((e) => [e.colleagueId, e.expense.date]));
    const colleagueMap = new Map(colleagues.map((c) => [c.id, c.name]));

    // Initialize spending stats from aggregates
    const spendingMap = new Map<number, ColleagueSpendingStats>();

    // Initialize all colleagues with zero spending
    for (const colleague of colleagues) {
      spendingMap.set(colleague.id, {
        id: colleague.id,
        name: colleague.name,
        totalSpent: 0,
        expenseCount: 0,
        averageSpent: 0,
        participationRate: 0,
        lastExpenseDate: null,
        daysSinceLastExpense: 999,
      });
    }

    // Fill in data from aggregates
    for (const agg of participantAggregates) {
      const name = colleagueMap.get(agg.colleagueId);
      if (!name) continue; // Skip deleted colleagues not in our list

      const lastDate = lastDateMap.get(agg.colleagueId);
      const totalSpent = agg._sum.amount ? Number(agg._sum.amount) : 0;
      const count = agg._count.id;

      spendingMap.set(agg.colleagueId, {
        id: agg.colleagueId,
        name,
        totalSpent,
        expenseCount: count,
        averageSpent: count > 0 ? totalSpent / count : 0,
        participationRate: totalExpenses > 0 ? (count / totalExpenses) * 100 : 0,
        lastExpenseDate: lastDate?.toISOString() ?? null,
        daysSinceLastExpense: lastDate ? daysSince(lastDate) : 999,
      });
    }

    const spendingArray = Array.from(spendingMap.values());

    // 1. Who spends most (top spenders)
    const topSpenders = spendingArray
      .filter((stats) => stats.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // 2. Who spends least (excluding zero spenders for meaningful comparison)
    const lowSpenders = spendingArray
      .filter((stats) => stats.totalSpent > 0)
      .sort((a, b) => a.totalSpent - b.totalSpent)
      .slice(0, 10);

    // 3. Who's not eating out (inactive members)
    const inactiveMembers = spendingArray
      .filter((stats) => stats.daysSinceLastExpense > 14 || stats.expenseCount === 0)
      .sort((a, b) => b.daysSinceLastExpense - a.daysSinceLastExpense);

    // 4. Who joins the most (most frequent participants)
    const frequentParticipants = spendingArray
      .filter((stats) => stats.expenseCount > 0)
      .sort((a, b) => b.participationRate - a.participationRate)
      .slice(0, 10);

    const activeSpenders = spendingArray.filter((s) => s.totalSpent > 0);

    return {
      topSpenders,
      lowSpenders,
      inactiveMembers,
      frequentParticipants,
      overview: {
        totalColleagues: colleagues.length,
        activeColleagues: spendingArray.filter((s) => s.expenseCount > 0).length,
        totalExpenses,
        totalSpending: spendingArray.reduce((sum, s) => sum + s.totalSpent, 0),
        averageSpendingPerPerson:
          activeSpenders.length > 0
            ? activeSpenders.reduce((sum, s) => sum + s.totalSpent, 0) / activeSpenders.length
            : 0,
      },
    };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch spending analytics');
  }
});

/**
 * Get spending trends over time (weekly/monthly aggregation)
 */
export const getSpendingTrends = createServerFn({ method: 'GET' })
  .validator((data = {}) => {
    return z
      .object({
        period: z.enum(['week', 'month']).default('week'),
        months: z.number().int().positive().max(24).default(6),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    if (!(await getAuthFromCookie())) return [];
    try {
      const { period, months } = data;

      // Calculate date range
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const expenses = await prisma.expense.findMany({
        where: {
          date: { gte: startDate },
        },
        include: {
          participants: {
            include: {
              colleague: true,
            },
          },
        },
        orderBy: { date: 'asc' },
      });

      // Group by time period
      const timeGroups = new Map<
        string,
        {
          period: string;
          totalSpending: number;
          expenseCount: number;
          participantCount: number;
          uniqueParticipants: Set<number>;
          averageExpenseAmount: number;
        }
      >();

      expenses.forEach((expense) => {
        let periodKey: string;

        if (period === 'week') {
          // Get start of week (Monday)
          const date = new Date(expense.date);
          const day = date.getDay() || 7; // Sunday = 7
          date.setDate(date.getDate() - day + 1);
          periodKey = date.toISOString().replace(/T.*/, '');
        } else {
          // Get start of month
          periodKey = expense.date.toISOString().slice(0, 7); // YYYY-MM
        }

        let group = timeGroups.get(periodKey);
        if (!group) {
          group = {
            period: periodKey,
            totalSpending: 0,
            expenseCount: 0,
            participantCount: 0,
            uniqueParticipants: new Set(),
            averageExpenseAmount: 0,
          };
          timeGroups.set(periodKey, group);
        }

        group.totalSpending += Number(expense.amount);
        group.expenseCount += 1;
        group.participantCount += expense.participants.length;

        expense.participants.forEach((p) => {
          group.uniqueParticipants.add(p.colleagueId);
        });
      });

      // Convert to array and calculate averages
      const trendsArray = Array.from(timeGroups.entries())
        .sort(([a], [b]) => a.localeCompare(b)) // Sort by the original date keys first
        .map(([key, group]) => ({
          period:
            period === 'week'
              ? new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : new Date(`${key}-01`).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                }),
          totalSpending: group.totalSpending,
          expenseCount: group.expenseCount,
          averageExpenseAmount: group.totalSpending / group.expenseCount,
          uniqueParticipants: group.uniqueParticipants.size,
          averageParticipantsPerExpense: group.participantCount / group.expenseCount,
        }));

      return trendsArray;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch spending trends');
    }
  });

/**
 * Get detailed spending patterns and insights
 */
export const getSpendingInsights = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) {
    return {
      summary: {
        totalSpending: 0,
        averageExpenseAmount: 0,
        averageParticipantsPerExpense: 0,
        mostExpensiveAmount: 0,
        mostExpensiveRestaurant: 'N/A',
      },
      restaurantStats: [],
      dayOfWeekStats: [],
    };
  }
  try {
    // Batch aggregation queries instead of loading all expenses
    const [expenseAggregates, participantCount, mostExpensive, restaurantAggregates, expenseDates] =
      await Promise.all([
        // Summary stats: total spending, count, max amount
        prisma.expense.aggregate({
          _sum: { amount: true },
          _count: { id: true },
          _max: { amount: true },
        }),
        // Total participant count
        prisma.expenseParticipant.aggregate({ _count: { _all: true } }),
        // Most expensive expense with restaurant name
        prisma.expense.findFirst({
          orderBy: { amount: 'desc' },
          include: { restaurant: { select: { name: true } } },
        }),
        // Restaurant spending distribution
        prisma.expense.groupBy({
          by: ['restaurantId'],
          _sum: { amount: true },
          _count: { id: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 10,
        }),
        // Lightweight: just dates and amounts for day-of-week analysis
        prisma.expense.findMany({
          select: { date: true, amount: true },
        }),
      ]);

    // Summary
    const totalSpending = expenseAggregates._sum.amount ? Number(expenseAggregates._sum.amount) : 0;
    const totalExpenses = expenseAggregates._count.id;
    const totalParticipants = participantCount._count._all;
    const mostExpensiveAmount = expenseAggregates._max.amount
      ? Number(expenseAggregates._max.amount)
      : 0;

    // Restaurant stats — look up names
    const restaurantIds = restaurantAggregates
      .map((r) => r.restaurantId)
      .filter((id): id is number => id !== null);
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(restaurants.map((r) => [r.id, r.name]));

    const restaurantStats = restaurantAggregates.map((agg) => ({
      name: nameMap.get(agg.restaurantId) ?? 'Unknown',
      total: agg._sum.amount ? Number(agg._sum.amount) : 0,
      count: agg._count.id,
    }));

    // Day of week analysis
    const dayOfWeekSpending = new Map<string, { day: string; total: number; count: number }>();
    for (const expense of expenseDates) {
      const dayName = expense.date.toLocaleDateString('en-US', { weekday: 'long' });
      const current = dayOfWeekSpending.get(dayName) ?? { day: dayName, total: 0, count: 0 };
      current.total += Number(expense.amount);
      current.count += 1;
      dayOfWeekSpending.set(dayName, current);
    }

    const dayStats = Array.from(dayOfWeekSpending.values());

    return {
      summary: {
        totalSpending,
        averageExpenseAmount: totalExpenses > 0 ? totalSpending / totalExpenses : 0,
        averageParticipantsPerExpense: totalExpenses > 0 ? totalParticipants / totalExpenses : 0,
        mostExpensiveAmount,
        mostExpensiveRestaurant: mostExpensive?.restaurant?.name ?? 'N/A',
      },
      restaurantStats,
      dayOfWeekStats: dayStats,
    };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch spending insights');
  }
});

// Note: Removed default export to avoid circular dependency issues with TanStack Start
