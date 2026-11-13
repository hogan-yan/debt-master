/**
 * Balance calculation service for colleagues
 * Calculates balances dynamically from expense participants and payment applications
 */

import { Prisma } from '@prisma/client';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';

export interface ColleagueBalance {
  colleagueId: number;
  totalOwed: number;
  totalPaid: number;
  currentBalance: number;
}

import { asMoneyMinor, type MoneyMinor } from '@debtmaster/core';
/**
 * Exact arithmetic happens in minor units (bigint cents, via @debtmaster/core);
 * the numeric interface below is the serialization edge. Decimal(10,2) columns
 * convert losslessly, sums are bigint adds, and the only float step is the
 * final minor→major division.
 */
import { minorToNumber, toMinor } from './money/edge';

/**
 * Build a Map from grouped aggregation results for O(1) lookup.
 * Values are exact minor units (bigint cents).
 */
export function buildAmountMap(
  entries: Array<{ id: number; amount: Prisma.Decimal | number | null }>
): Map<number, MoneyMinor> {
  const map = new Map<number, MoneyMinor>();
  for (const entry of entries) {
    map.set(entry.id, toMinor(entry.amount));
  }
  return map;
}

/**
 * Convert a minor-unit map to a numeric (major-unit) map — the serialization
 * edge for consumers that do their own arithmetic on top.
 */
export function mapsToNumberMaps(map: Map<number, MoneyMinor>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [id, minor] of map) out.set(id, Number(minor) / 100);
  return out;
}

/**
 * Calculate balances for all colleagues from pre-built lookup maps.
 * All arithmetic is exact bigint; conversion to number happens at return.
 */
export function calculateBalancesFromMaps(
  colleagueIds: number[],
  expenseMap: Map<number, MoneyMinor>,
  paymentMap: Map<number, MoneyMinor>
): ColleagueBalance[] {
  return colleagueIds.map((id) => {
    const totalOwed: MoneyMinor = expenseMap.get(id) ?? asMoneyMinor(0n);
    const totalPaid: MoneyMinor = paymentMap.get(id) ?? asMoneyMinor(0n);
    const net = (totalPaid - totalOwed) as MoneyMinor;
    return {
      colleagueId: id,
      totalOwed: minorToNumber(totalOwed),
      totalPaid: minorToNumber(totalPaid),
      currentBalance: minorToNumber(net),
    };
  });
}

/**
 * Calculate aggregate statistics from colleague balances
 */
export function calculateStatsFromBalances(balances: ColleagueBalance[]): {
  totalOutstanding: number;
  totalCredit: number;
} {
  let totalOutstanding = 0;
  let totalCredit = 0;

  for (const { currentBalance } of balances) {
    if (currentBalance < 0) {
      totalOutstanding += Math.abs(currentBalance);
    } else if (currentBalance > 0) {
      totalCredit += currentBalance;
    }
  }

  return { totalOutstanding, totalCredit };
}

/**
 * Calculate balance for a single colleague using database aggregation
 * Balance = Total Paid (all approved payments) - Total Owed (from expense participants)
 */
export const calculateColleagueBalance = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        colleagueId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }): Promise<ColleagueBalance> => {
    await requireAuthFromCookie();
    try {
      // Use Promise.all for parallel execution of aggregations
      const [expenseResult, paymentResult] = await Promise.all([
        // Get total owed using database aggregation
        prisma.expenseParticipant.aggregate({
          where: { colleagueId: data.colleagueId },
          _sum: { amount: true },
        }),
        // Get total paid using database aggregation
        prisma.payment.aggregate({
          where: {
            colleagueId: data.colleagueId,
            isApproved: true,
          },
          _sum: { amount: true },
        }),
      ]);

      const expenseMap = buildAmountMap([
        { id: data.colleagueId, amount: expenseResult._sum.amount },
      ]);
      const paymentMap = buildAmountMap([
        { id: data.colleagueId, amount: paymentResult._sum.amount },
      ]);
      const balances = calculateBalancesFromMaps([data.colleagueId], expenseMap, paymentMap);
      return balances[0] as ColleagueBalance;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to calculate colleague balance');
    }
  });

async function calculateColleagueBalancesByFilter(
  where: Prisma.ColleagueWhereInput
): Promise<ColleagueBalance[]> {
  const colleagues = await prisma.colleague.findMany({ where, select: { id: true } });
  const ids = colleagues.map((c) => c.id);

  const [expenseParticipants, payments] = await Promise.all([
    prisma.expenseParticipant.groupBy({
      by: ['colleagueId'],
      where: { colleagueId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['colleagueId'],
      where: { colleagueId: { in: ids }, isApproved: true },
      _sum: { amount: true },
    }),
  ]);

  const expenseMap = buildAmountMap(
    expenseParticipants.map((ep) => ({
      id: ep.colleagueId,
      amount: ep._sum.amount ?? null,
    }))
  );
  const paymentMap = buildAmountMap(
    payments.map((p) => ({
      id: p.colleagueId,
      amount: p._sum.amount ?? null,
    }))
  );

  return calculateBalancesFromMaps(ids, expenseMap, paymentMap);
}

export const calculateAllColleagueBalances = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ColleagueBalance[]> => {
    if (!(await getAuthFromCookie())) return [];
    try {
      // Hot path: run all three queries in parallel for active colleagues
      const [colleagues, expenseParticipants, payments] = await Promise.all([
        prisma.colleague.findMany({
          where: { deletedAt: null },
          select: { id: true },
        }),
        prisma.expenseParticipant.groupBy({
          by: ['colleagueId'],
          _sum: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['colleagueId'],
          where: { isApproved: true },
          _sum: { amount: true },
        }),
      ]);

      const expenseMap = buildAmountMap(
        expenseParticipants.map((ep) => ({
          id: ep.colleagueId,
          amount: ep._sum.amount ?? null,
        }))
      );
      const paymentMap = buildAmountMap(
        payments.map((p) => ({
          id: p.colleagueId,
          amount: p._sum.amount ?? null,
        }))
      );

      return calculateBalancesFromMaps(
        colleagues.map((c) => c.id),
        expenseMap,
        paymentMap
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to calculate all colleague balances'
      );
    }
  }
);

export const calculateInactiveColleagueBalances = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ColleagueBalance[]> => {
    if (!(await getAuthFromCookie())) return [];
    try {
      return await calculateColleagueBalancesByFilter({ deletedAt: { not: null } });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to calculate inactive colleague balances'
      );
    }
  }
);

/**
 * Calculate statistics efficiently without redundant queries
 */
export const getColleagueStatsFromCalculatedBalances = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{
    totalColleagues: number;
    totalOutstanding: number;
    totalCredit: number;
    totalPayments: number;
  }> => {
    if (!(await getAuthFromCookie())) {
      return { totalColleagues: 0, totalOutstanding: 0, totalCredit: 0, totalPayments: 0 };
    }
    try {
      // Execute all needed queries in parallel
      const [colleagues, expenseParticipants, payments] = await Promise.all([
        prisma.colleague.findMany({
          where: { deletedAt: null },
          select: { id: true },
        }),
        prisma.expenseParticipant.groupBy({
          by: ['colleagueId'],
          _sum: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['colleagueId'],
          where: { isApproved: true },
          _sum: { amount: true },
          _count: { id: true }, // Get count at the same time
        }),
      ]);

      // Convert Prisma results to simple maps
      const expenseMap = buildAmountMap(
        expenseParticipants.map((ep) => ({
          id: ep.colleagueId,
          amount: ep._sum.amount ?? null,
        }))
      );
      const paymentMap = buildAmountMap(
        payments.map((p) => ({
          id: p.colleagueId,
          amount: p._sum.amount ?? null,
        }))
      );

      const balances = calculateBalancesFromMaps(
        colleagues.map((c) => c.id),
        expenseMap,
        paymentMap
      );

      const { totalOutstanding, totalCredit } = calculateStatsFromBalances(balances);

      const totalPayments = payments.reduce((sum, p) => sum + p._count.id, 0);

      return {
        totalColleagues: colleagues.length,
        totalOutstanding,
        totalCredit,
        totalPayments,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to calculate colleague statistics'
      );
    }
  }
);
