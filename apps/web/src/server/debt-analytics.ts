/**
 * Debt Analytics Server Functions
 * Focused on debt tracking and management for the debt-master dashboard
 *
 * Handlers are thin: they authenticate, run the Prisma queries, and delegate
 * all transform logic to the pure helpers in
 * `./dashboard/debt-analytics-calculations`.
 */

import { createServerFn } from '@tanstack/react-start';
import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import { calculateAllColleagueBalances } from './balance-calculator';
import {
  buildDebtLeaderboard,
  computeDebtOverviewMetrics,
  computePaymentReliabilityStats,
  computeRestaurantChartData,
  type DebtLeaderboard,
  type DebtOverviewMetrics,
  EMPTY_LEADERBOARD,
  EMPTY_OVERVIEW_METRICS,
  EMPTY_RESTAURANT_CHART_DATA,
  type PaymentReliabilityStat,
  type RestaurantChartData,
} from './dashboard/debt-analytics-calculations';

/** Display name for a restaurant row that may be missing from the DB. */
export function favoriteRestaurantName(restaurant: { name: string } | null): string {
  return restaurant?.name ?? 'Unknown';
}

/**
 * Get debt leaderboard data - who owes the most money
 */
export const getDebtLeaderboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DebtLeaderboard> => {
    if (!(await getAuthFromCookie())) return EMPTY_LEADERBOARD;
    try {
      // Step 1: Get balances via optimized balance calculator (3 queries)
      const balances = await calculateAllColleagueBalances();
      const debtorBalances = balances.filter((b) => b.currentBalance < -0.001);

      if (debtorBalances.length === 0) return EMPTY_LEADERBOARD;

      const debtorIds = debtorBalances.map((b) => b.colleagueId);

      // Step 2: Batch queries for debtor details (scoped to debtors only)
      const [colleagues, lastPayments, unpaidExpenseDetails] = await Promise.all([
        prisma.colleague.findMany({
          where: { id: { in: debtorIds } },
          select: { id: true, name: true },
        }),
        prisma.payment.groupBy({
          by: ['colleagueId'],
          where: { colleagueId: { in: debtorIds }, isApproved: true },
          _max: { date: true },
        }),
        prisma.expenseParticipant.findMany({
          where: { colleagueId: { in: debtorIds } },
          include: {
            expense: { include: { restaurant: true, participants: true } },
            paymentApplications: { include: { payment: true } },
          },
        }),
      ]);

      // Step 3: Pure transform into leaderboard DTO
      return buildDebtLeaderboard(debtorBalances, colleagues, lastPayments, unpaidExpenseDetails);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch debt leaderboard');
    }
  }
);

/**
 * Get debt overview metrics for the overview cards
 */
export const getDebtOverviewMetrics = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DebtOverviewMetrics> => {
    if (!(await getAuthFromCookie())) return EMPTY_OVERVIEW_METRICS;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Run all aggregation queries in parallel
      const [
        balances,
        expenseAggregates,
        participantCount,
        lastPayment,
        topRestaurant,
        recentExpenseTotal,
        recentPaymentTotal,
        teamSize,
        restaurantCount,
      ] = await Promise.all([
        calculateAllColleagueBalances(),
        prisma.expense.aggregate({ _count: { id: true }, _sum: { amount: true } }),
        prisma.expenseParticipant.aggregate({ _count: { _all: true } }),
        prisma.payment.findFirst({
          where: { isApproved: true },
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
        prisma.expense.groupBy({
          by: ['restaurantId'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 1,
        }),
        prisma.expense.aggregate({
          where: { date: { gte: thirtyDaysAgo } },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { isApproved: true, date: { gte: thirtyDaysAgo } },
          _sum: { amount: true },
        }),
        prisma.colleague.count({ where: { deletedAt: null } }),
        prisma.restaurant.count(),
      ]);

      // Secondary queries that depend on the first batch's results.
      const debtors = balances.filter((b) => b.currentBalance < -0.001);
      const debtorLastPayments =
        debtors.length > 0
          ? await prisma.payment.groupBy({
              by: ['colleagueId'],
              where: {
                colleagueId: { in: debtors.map((d) => d.colleagueId) },
                isApproved: true,
              },
              _max: { date: true },
            })
          : [];

      let favoriteSpot = { name: 'No data', visits: 0 };
      const topRestaurantRow = topRestaurant[0];
      if (topRestaurantRow?.restaurantId != null) {
        const restaurant = await prisma.restaurant.findUnique({
          where: { id: topRestaurantRow.restaurantId },
          select: { name: true },
        });
        favoriteSpot = {
          name: favoriteRestaurantName(restaurant),
          visits: topRestaurantRow._count.id,
        };
      }

      return computeDebtOverviewMetrics({
        balances,
        debtorLastPayments,
        totalLunches: expenseAggregates._count.id,
        totalLunchAmount: expenseAggregates._sum.amount,
        totalParticipants: participantCount._count._all,
        lastPaymentDate: lastPayment?.date ?? null,
        favoriteSpot,
        recentExpenseAmount: recentExpenseTotal._sum.amount,
        recentPaymentAmount: recentPaymentTotal._sum.amount,
        teamSize,
        restaurantCount,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch debt overview metrics');
    }
  }
);

/**
 * Get payment reliability stats for colleagues
 */
export const getPaymentReliabilityStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PaymentReliabilityStat[]> => {
    if (!(await getAuthFromCookie())) return [];
    try {
      const [colleagues, paymentsWithExpenses, expenseCounts, paymentCounts, lastPayments] =
        await Promise.all([
          prisma.colleague.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
          }),
          prisma.payment.findMany({
            where: { isApproved: true, expenseId: { not: null } },
            select: {
              colleagueId: true,
              date: true,
              expense: { select: { date: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.expenseParticipant.groupBy({
            by: ['colleagueId'],
            _count: { id: true },
          }),
          prisma.payment.groupBy({
            by: ['colleagueId'],
            where: { isApproved: true },
            _count: { id: true },
          }),
          prisma.payment.groupBy({
            by: ['colleagueId'],
            where: { isApproved: true },
            _max: { date: true },
          }),
        ]);

      return computePaymentReliabilityStats(
        colleagues,
        paymentsWithExpenses,
        expenseCounts,
        paymentCounts,
        lastPayments
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to fetch payment reliability stats'
      );
    }
  }
);

/**
 * Get comprehensive restaurant statistics for dashboard charts
 */
export const getRestaurantChartData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RestaurantChartData> => {
    if (!(await getAuthFromCookie())) return EMPTY_RESTAURANT_CHART_DATA;
    try {
      // Batch aggregation queries instead of loading all expenses
      const [restaurantAggregates, totalExpenses, participantCounts, expenseRestaurants] =
        await Promise.all([
          prisma.expense.groupBy({
            by: ['restaurantId'],
            _sum: { amount: true },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
          }),
          prisma.expense.aggregate({ _count: { id: true } }),
          prisma.expenseParticipant.groupBy({
            by: ['expenseId'],
            _count: { id: true },
          }),
          prisma.expense.findMany({
            select: { id: true, restaurantId: true },
          }),
        ]);

      // Restaurant names for all aggregated restaurants
      const restaurantIds = restaurantAggregates
        .map((r) => r.restaurantId)
        .filter((id): id is number => id !== null);
      const restaurantNames = await prisma.restaurant.findMany({
        where: { id: { in: restaurantIds } },
        select: { id: true, name: true },
      });

      return computeRestaurantChartData(
        restaurantAggregates,
        totalExpenses._count.id,
        participantCounts,
        expenseRestaurants,
        restaurantNames
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch restaurant chart data');
    }
  }
);

// Note: Removed default export to avoid circular dependency issues with TanStack Start
