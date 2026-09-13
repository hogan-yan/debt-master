/**
 * Pure calculation helpers for debt analytics.
 *
 * These functions contain the heavy transform logic extracted from the
 * debt-analytics server-function handlers. They take already-fetched query
 * results (no Prisma access, no auth) and return the dashboard DTOs, which
 * makes them fast to unit-test in isolation.
 */

import type { Prisma } from '@prisma/client';
import type { ColleagueBalance } from '@/server/balance-calculator';
import { serializeDecimal } from '@/server/utils/decimal';
import { daysSince } from './analytics-helpers';

// ---------------------------------------------------------------------------
// Debt leaderboard
// ---------------------------------------------------------------------------

export interface UnpaidExpenseDetail {
  id: number;
  date: string | Date;
  restaurantName: string;
  restaurantId?: number | null;
  totalAmount: number;
  colleagueAmount: number;
  participantId: number;
  notes?: string | null;
  participantCount: number;
  splitType: string;
  remainingOwed: number;
  totalApprovedPaid: number;
}

export interface DebtLeaderboardEntry {
  id: number;
  name: string;
  currentBalance: number;
  totalOwed: number;
  totalPaid: number;
  lastActivity: string;
  daysSinceLastPayment: number;
  paymentCount: number;
  expenseCount: number;
  isSerialDebtor: boolean;
  urgencyLevel: string;
  unpaidExpenses: UnpaidExpenseDetail[];
}

export interface DebtLeaderboard {
  debtors: DebtLeaderboardEntry[];
  maxDebtAmount: number;
}

export const EMPTY_LEADERBOARD: DebtLeaderboard = { debtors: [], maxDebtAmount: 0 };

/** Expense-participant row with the nested relations the leaderboard reads. */
export type LeaderboardParticipant = Prisma.ExpenseParticipantGetPayload<{
  include: {
    expense: { include: { restaurant: true; participants: true } };
    paymentApplications: { include: { payment: true } };
  };
}>;

/** GroupBy-shaped row: max payment date per colleague. */
export interface MaxDateByColleague {
  colleagueId: number;
  _max: { date: Date | null };
}

export interface ColleagueNameRow {
  id: number;
  name: string;
}

function urgencyForDebt(
  debtAmount: number,
  daysSinceLastPayment: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (debtAmount >= 100 || daysSinceLastPayment > 30) return 'critical';
  if (debtAmount >= 50 || daysSinceLastPayment > 14) return 'high';
  if (debtAmount >= 20 || daysSinceLastPayment > 7) return 'medium';
  return 'low';
}

function buildUnpaidExpenses(participants: LeaderboardParticipant[]): UnpaidExpenseDetail[] {
  return participants
    .map((participant) => {
      const totalApprovedPaid = participant.paymentApplications
        .filter((app) => app.payment?.isApproved)
        .reduce((sum, app) => sum + serializeDecimal(app.amount), 0);

      const participantAmount = serializeDecimal(participant.amount);
      const remainingOwed = participantAmount - totalApprovedPaid;

      if (remainingOwed <= 0) return null;

      return {
        id: participant.expense.id,
        date: participant.expense.date,
        restaurantName: participant.expense.restaurant?.name || 'Unknown Restaurant',
        restaurantId: participant.expense.restaurantId,
        totalAmount: serializeDecimal(participant.expense.amount),
        colleagueAmount: participantAmount,
        participantId: participant.id,
        notes: participant.expense.notes,
        participantCount: participant.expense.participants.length,
        splitType: participant.expense.splitType,
        remainingOwed,
        totalApprovedPaid,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function buildDebtLeaderboard(
  debtorBalances: ColleagueBalance[],
  colleagues: ColleagueNameRow[],
  lastPayments: MaxDateByColleague[],
  unpaidExpenseDetails: LeaderboardParticipant[]
): DebtLeaderboard {
  const nameMap = new Map(colleagues.map((c) => [c.id, c.name]));
  const lastPaymentMap = new Map(
    lastPayments.filter((p) => p._max.date !== null).map((p) => [p.colleagueId, p._max.date])
  );

  const participantsByColleague = new Map<number, LeaderboardParticipant[]>();
  for (const p of unpaidExpenseDetails) {
    const existing = participantsByColleague.get(p.colleagueId);
    if (existing) {
      existing.push(p);
    } else {
      participantsByColleague.set(p.colleagueId, [p]);
    }
  }

  const debtors = debtorBalances
    .map((balance) => {
      const name = nameMap.get(balance.colleagueId) ?? 'Unknown';
      const lastPaymentDate = lastPaymentMap.get(balance.colleagueId);
      const daysSinceLastPayment = lastPaymentDate ? daysSince(lastPaymentDate) : 999;

      const participants = participantsByColleague.get(balance.colleagueId) ?? [];
      const unpaidExpenses = buildUnpaidExpenses(participants);

      const unpaidExpenseCount = unpaidExpenses.length;
      const isSerialDebtor = unpaidExpenseCount > 3 || daysSinceLastPayment > 30;

      const debtAmount = Math.abs(balance.currentBalance);
      const urgencyLevel = urgencyForDebt(debtAmount, daysSinceLastPayment);

      const lastExpenseDate = participants
        .map((p) => p.expense.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      const lastActivity =
        [lastExpenseDate, lastPaymentDate]
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          ?.toISOString()
          .split('T')[0] ?? '';

      return {
        id: balance.colleagueId,
        name,
        currentBalance: balance.currentBalance,
        totalOwed: balance.totalOwed,
        totalPaid: balance.totalPaid,
        lastActivity,
        daysSinceLastPayment,
        paymentCount: participants.length > 0 ? participants.length : 0,
        expenseCount: participants.length,
        isSerialDebtor,
        urgencyLevel,
        unpaidExpenses: unpaidExpenses satisfies UnpaidExpenseDetail[],
      };
    })
    .sort((a, b) => a.currentBalance - b.currentBalance); // Most negative (highest debt) first

  const maxDebtAmount =
    debtors.length > 0 ? Math.max(...debtors.map((d) => Math.abs(d.currentBalance))) : 0;

  return { debtors, maxDebtAmount };
}

// ---------------------------------------------------------------------------
// Debt overview metrics
// ---------------------------------------------------------------------------

export interface DebtOverviewMetrics {
  totalDebtOutstanding: number;
  totalLunches: number;
  averageLunchCost: number;
  favoriteSpot: { name: string; visits: number };
  totalLunchMoneySpent: number;
  lunchParticipationRate: number;
  daysSinceLastPayment: number;
  debtTrend: 'increasing' | 'decreasing' | 'stable';
  urgentDebtCount: number;
  teamSize: number;
  restaurantCount: number;
  averageCostPerPerson: number;
}

export const EMPTY_OVERVIEW_METRICS: DebtOverviewMetrics = {
  totalDebtOutstanding: 0,
  totalLunches: 0,
  averageLunchCost: 0,
  favoriteSpot: { name: 'No data', visits: 0 },
  totalLunchMoneySpent: 0,
  lunchParticipationRate: 0,
  daysSinceLastPayment: 0,
  debtTrend: 'stable',
  urgentDebtCount: 0,
  teamSize: 0,
  restaurantCount: 0,
  averageCostPerPerson: 0,
};

export interface DebtOverviewInput {
  balances: ColleagueBalance[];
  /** Last approved-payment date per debtor (groupBy rows, scoped to debtors). */
  debtorLastPayments: MaxDateByColleague[];
  totalLunches: number;
  /** _sum.amount from the all-expense aggregate. */
  totalLunchAmount: Prisma.Decimal | number | null;
  /** _all participant record count. */
  totalParticipants: number;
  /** Most recent approved payment date, or null. */
  lastPaymentDate: Date | null;
  /** Already-resolved favorite restaurant (name looked up by caller). */
  favoriteSpot: { name: string; visits: number };
  /** _sum.amount of expenses in the last 30 days. */
  recentExpenseAmount: Prisma.Decimal | number | null;
  /** _sum.amount of approved payments in the last 30 days. */
  recentPaymentAmount: Prisma.Decimal | number | null;
  teamSize: number;
  /** Total non-soft-deleted restaurants (drives the onboarding checklist). */
  restaurantCount: number;
}

function toNumber(value: Prisma.Decimal | number | null): number {
  return value ? Number(value) : 0;
}

export function computeUrgentDebtCount(
  debtors: ColleagueBalance[],
  debtorLastPayments: MaxDateByColleague[]
): number {
  if (debtors.length === 0) return 0;

  const lastPaymentByDebtor = new Map(
    debtorLastPayments.filter((p) => p._max.date !== null).map((p) => [p.colleagueId, p._max.date])
  );

  let urgentDebtCount = 0;
  for (const debtor of debtors) {
    const lastDate = lastPaymentByDebtor.get(debtor.colleagueId);
    const daysSincePayment = lastDate ? daysSince(lastDate) : 999;
    const debtAmount = Math.abs(debtor.currentBalance);
    if (debtAmount >= 50 || daysSincePayment > 14) {
      urgentDebtCount++;
    }
  }
  return urgentDebtCount;
}

export function computeDebtOverviewMetrics(input: DebtOverviewInput): DebtOverviewMetrics {
  const debtors = input.balances.filter((b) => b.currentBalance < -0.001);
  const totalDebtOutstanding = debtors.reduce((sum, b) => sum + Math.abs(b.currentBalance), 0);
  const urgentDebtCount = computeUrgentDebtCount(debtors, input.debtorLastPayments);

  const totalLunchMoneySpent = toNumber(input.totalLunchAmount);
  const averageLunchCost = input.totalLunches > 0 ? totalLunchMoneySpent / input.totalLunches : 0;

  const lunchParticipationRate =
    input.totalLunches > 0 && input.teamSize > 0
      ? (input.totalParticipants / (input.totalLunches * input.teamSize)) * 100
      : 0;

  const averageCostPerPerson =
    input.totalParticipants > 0 ? totalLunchMoneySpent / input.totalParticipants : 0;

  const daysSinceLastPayment = input.lastPaymentDate ? daysSince(input.lastPaymentDate) : 0;

  const recentDebtAccumulated = toNumber(input.recentExpenseAmount);
  const recentDebtPaid = toNumber(input.recentPaymentAmount);

  let debtTrend: 'increasing' | 'decreasing' | 'stable';
  if (recentDebtAccumulated > recentDebtPaid * 1.2) debtTrend = 'increasing';
  else if (recentDebtPaid > recentDebtAccumulated * 1.2) debtTrend = 'decreasing';
  else debtTrend = 'stable';

  return {
    totalDebtOutstanding,
    totalLunches: input.totalLunches,
    averageLunchCost,
    favoriteSpot: input.favoriteSpot,
    totalLunchMoneySpent,
    lunchParticipationRate,
    daysSinceLastPayment,
    debtTrend,
    urgentDebtCount,
    teamSize: input.teamSize,
    restaurantCount: input.restaurantCount,
    averageCostPerPerson,
  };
}

// ---------------------------------------------------------------------------
// Payment reliability
// ---------------------------------------------------------------------------

export interface PaymentReliabilityStat {
  colleagueId: number;
  name: string;
  averagePaymentDelay: number;
  reliabilityScore: number;
  paymentStreak: number;
  needsReminder: boolean;
  paymentCount: number;
  expenseCount: number;
}

/** Payment row with the expense date needed for delay calculation. */
export interface PaymentWithExpenseRow {
  colleagueId: number;
  date: Date;
  expense: { date: Date } | null;
}

/** GroupBy-shaped row: record count per colleague. */
export interface CountByColleague {
  colleagueId: number;
  _count: { id: number };
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function computePaymentReliabilityStats(
  colleagues: ColleagueNameRow[],
  paymentsWithExpenses: PaymentWithExpenseRow[],
  expenseCounts: CountByColleague[],
  paymentCounts: CountByColleague[],
  lastPayments: MaxDateByColleague[]
): PaymentReliabilityStat[] {
  const expenseCountMap = new Map(expenseCounts.map((e) => [e.colleagueId, e._count.id]));
  const paymentCountMap = new Map(paymentCounts.map((p) => [p.colleagueId, p._count.id]));
  const lastPaymentMap = new Map(
    lastPayments.filter((p) => p._max.date !== null).map((p) => [p.colleagueId, p._max.date])
  );

  const paymentsByColleague = new Map<number, Array<{ paymentDate: Date; expenseDate: Date }>>();
  for (const payment of paymentsWithExpenses) {
    if (payment.expense) {
      const existing = paymentsByColleague.get(payment.colleagueId);
      const entry = { paymentDate: payment.date, expenseDate: payment.expense.date };
      if (existing) {
        existing.push(entry);
      } else {
        paymentsByColleague.set(payment.colleagueId, [entry]);
      }
    }
  }

  const reliabilityStats = colleagues.map((colleague) => {
    const payments = paymentsByColleague.get(colleague.id) ?? [];
    const expenseCount = expenseCountMap.get(colleague.id) ?? 0;
    const paymentCount = paymentCountMap.get(colleague.id) ?? 0;

    let totalDelayDays = 0;
    let delayCalculations = 0;
    for (const { paymentDate, expenseDate } of payments) {
      const delayDays = Math.max(
        0,
        Math.ceil((paymentDate.getTime() - expenseDate.getTime()) / MS_PER_DAY)
      );
      totalDelayDays += delayDays;
      delayCalculations++;
    }

    const averagePaymentDelay = delayCalculations > 0 ? totalDelayDays / delayCalculations : 0;

    let reliabilityScore = 100;
    if (averagePaymentDelay > 0) {
      reliabilityScore = Math.max(0, 100 - averagePaymentDelay * 10);
    }
    if (paymentCount === 0 && expenseCount > 0) {
      reliabilityScore = 0; // Never paid anything but owes money
    }

    // Payment streak (consecutive on-time payments within 3 days), most recent first
    let paymentStreak = 0;
    const recentPayments = payments.slice(0, 10);
    for (const { paymentDate, expenseDate } of recentPayments) {
      const delayDays = Math.ceil((paymentDate.getTime() - expenseDate.getTime()) / MS_PER_DAY);
      if (delayDays <= 3) {
        paymentStreak++;
      } else {
        break; // Streak broken
      }
    }

    const lastPaymentDate = lastPaymentMap.get(colleague.id);
    const daysSinceLastPayment = lastPaymentDate ? daysSince(lastPaymentDate) : 999;
    const needsReminder = daysSinceLastPayment > 7 && expenseCount > paymentCount;

    return {
      colleagueId: colleague.id,
      name: colleague.name,
      averagePaymentDelay,
      reliabilityScore: Math.round(reliabilityScore),
      paymentStreak,
      needsReminder,
      paymentCount,
      expenseCount,
    };
  });

  reliabilityStats.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  return reliabilityStats;
}

// ---------------------------------------------------------------------------
// Restaurant chart data
// ---------------------------------------------------------------------------

export interface RestaurantChartData {
  popularityData: {
    name: string;
    fullName: string;
    visits: number;
    percentage: string;
  }[];
  priceData: {
    name: string;
    fullName: string;
    avgCost: number;
    avgCostPerPerson: number;
    visits: number;
    totalSpent: number;
  }[];
  totalRestaurants: number;
  totalExpenses: number;
}

export const EMPTY_RESTAURANT_CHART_DATA: RestaurantChartData = {
  popularityData: [],
  priceData: [],
  totalRestaurants: 0,
  totalExpenses: 0,
};

/** GroupBy-shaped restaurant aggregate row. */
export interface RestaurantAggregateRow {
  restaurantId: number | null;
  _sum: { amount: Prisma.Decimal | null };
  _count: { id: number };
}

/** GroupBy-shaped participant-per-expense count row. */
export interface ParticipantCountRow {
  expenseId: number;
  _count: { id: number };
}

export interface ExpenseRestaurantRow {
  id: number;
  restaurantId: number | null;
}

function truncateName(name: string): string {
  return name.length > 15 ? `${name.substring(0, 15)}...` : name;
}

export function computeRestaurantChartData(
  restaurantAggregates: RestaurantAggregateRow[],
  totalExpCount: number,
  participantCounts: ParticipantCountRow[],
  expenseRestaurants: ExpenseRestaurantRow[],
  restaurantNames: ColleagueNameRow[]
): RestaurantChartData {
  const expParticipantMap = new Map(participantCounts.map((r) => [r.expenseId, r._count.id]));
  const nameMap = new Map(restaurantNames.map((r) => [r.id, r.name]));

  const expRestMap = new Map(expenseRestaurants.map((e) => [e.id, e.restaurantId]));
  const restTotalParticipants = new Map<number, number>();
  for (const [expenseId, count] of expParticipantMap.entries()) {
    const restId = expRestMap.get(expenseId);
    if (restId != null) {
      restTotalParticipants.set(restId, (restTotalParticipants.get(restId) ?? 0) + count);
    }
  }

  const finalRestaurantData = restaurantAggregates.map((agg) => ({
    name: nameMap.get(agg.restaurantId ?? -1) ?? 'Unknown Restaurant',
    visits: agg._count.id,
    totalAmount: agg._sum.amount ? Number(agg._sum.amount) : 0,
    totalParticipants:
      agg.restaurantId != null ? (restTotalParticipants.get(agg.restaurantId) ?? 0) : 0,
  }));

  const popularityData = finalRestaurantData
    .map((stats) => ({
      name: truncateName(stats.name),
      fullName: stats.name,
      visits: stats.visits,
      percentage: totalExpCount > 0 ? ((stats.visits / totalExpCount) * 100).toFixed(1) : '0',
    }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  const priceData = finalRestaurantData
    .map((stats) => ({
      name: truncateName(stats.name),
      fullName: stats.name,
      avgCost: Number((stats.totalAmount / stats.visits).toFixed(2)),
      avgCostPerPerson:
        stats.totalParticipants > 0
          ? Number((stats.totalAmount / stats.totalParticipants).toFixed(2))
          : 0,
      visits: stats.visits,
      totalSpent: stats.totalAmount,
    }))
    .sort((a, b) => b.avgCostPerPerson - a.avgCostPerPerson)
    .slice(0, 10);

  return {
    popularityData,
    priceData,
    totalRestaurants: restaurantAggregates.length,
    totalExpenses: totalExpCount,
  };
}
