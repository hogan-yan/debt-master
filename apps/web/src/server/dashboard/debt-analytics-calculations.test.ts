/**
 * Unit tests for debt-analytics-calculations.ts pure functions.
 *
 * No DB, no auth, no mocks needed — these functions are pure transforms.
 */

import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColleagueBalance } from '@/server/balance-calculator';
import type {
  ColleagueNameRow,
  CountByColleague,
  DebtOverviewInput,
  ExpenseRestaurantRow,
  MaxDateByColleague,
  ParticipantCountRow,
  PaymentWithExpenseRow,
  RestaurantAggregateRow,
} from './debt-analytics-calculations';
import {
  buildDebtLeaderboard,
  computeDebtOverviewMetrics,
  computePaymentReliabilityStats,
  computeRestaurantChartData,
  computeUrgentDebtCount,
} from './debt-analytics-calculations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal LeaderboardParticipant-shaped object for tests. */
function makeParticipant(opts: {
  colleagueId: number;
  participantId?: number;
  amount: number;
  expenseId?: number;
  expenseDate?: Date;
  restaurantName?: string;
  restaurantId?: number | null;
  splitType?: string;
  approvedPayments?: number[];
  unapprovedPayments?: number[];
  participants?: { id: number }[];
}) {
  return {
    id: opts.participantId ?? 1,
    colleagueId: opts.colleagueId,
    // amount must be a Prisma.Decimal so serializeDecimal works properly
    amount: new Prisma.Decimal(opts.amount.toString()),
    expense: {
      id: opts.expenseId ?? 1,
      date: opts.expenseDate ?? new Date('2026-04-01'),
      amount: new Prisma.Decimal('100.00'),
      restaurantId: opts.restaurantId ?? null,
      restaurant: opts.restaurantName ? { name: opts.restaurantName } : null,
      notes: null,
      splitType: opts.splitType ?? 'EQUAL',
      participants: opts.participants ?? [{ id: 1 }, { id: 2 }],
    },
    paymentApplications: [
      ...(opts.approvedPayments ?? []).map((amt) => ({
        amount: new Prisma.Decimal(amt.toString()),
        payment: { isApproved: true },
      })),
      ...(opts.unapprovedPayments ?? []).map((amt) => ({
        amount: new Prisma.Decimal(amt.toString()),
        payment: { isApproved: false },
      })),
    ],
  };
}

// ---------------------------------------------------------------------------
// buildDebtLeaderboard
// ---------------------------------------------------------------------------

describe('buildDebtLeaderboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix "today" so daysSince calculations are deterministic.
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseBalance: ColleagueBalance = {
    colleagueId: 1,
    currentBalance: -75,
    totalOwed: 100,
    totalPaid: 25,
  };

  const aliceColleague: ColleagueNameRow = { id: 1, name: 'Alice' };

  it('builds a leaderboard entry with unpaid expenses and urgency', () => {
    const participant = makeParticipant({
      colleagueId: 1,
      amount: 50,
      restaurantName: 'Sushi Place',
      restaurantId: 5,
      // 10 days before "today" 2026-04-21 → ~10 days ago payment
      expenseDate: new Date('2026-04-10'),
      approvedPayments: [10],
      unapprovedPayments: [5], // not counted
    });

    // Last payment was 11 days ago — not yet serial (≤30), debt 75 ≥ 50 → 'high'
    const lastPayment: MaxDateByColleague = {
      colleagueId: 1,
      _max: { date: new Date('2026-04-20') },
    };

    const result = buildDebtLeaderboard([baseBalance], [aliceColleague], [lastPayment], [
      participant,
    ] as never);

    expect(result.debtors).toHaveLength(1);
    const entry = result.debtors[0]!;
    expect(entry.name).toBe('Alice');
    expect(entry.currentBalance).toBe(-75);
    expect(entry.unpaidExpenses).toHaveLength(1);
    expect(entry.unpaidExpenses[0]!.remainingOwed).toBe(40); // 50 - 10
    expect(entry.unpaidExpenses[0]!.totalApprovedPaid).toBe(10);
    expect(entry.urgencyLevel).toBe('high'); // debt 75 ≥ 50
    expect(entry.isSerialDebtor).toBe(false); // 1 expense ≤ 3, 11 days ≤ 30
    expect(result.maxDebtAmount).toBe(75);
  });

  it('filters out fully-paid expenses (remainingOwed <= 0)', () => {
    const fullyPaid = makeParticipant({
      colleagueId: 1,
      amount: 30,
      approvedPayments: [30], // exactly paid off
    });

    const result = buildDebtLeaderboard([baseBalance], [aliceColleague], [], [fullyPaid] as never);

    expect(result.debtors[0]!.unpaidExpenses).toHaveLength(0);
  });

  it('sorts debtors with most debt (most negative balance) first', () => {
    const balances: ColleagueBalance[] = [
      { colleagueId: 1, currentBalance: -30, totalOwed: 30, totalPaid: 0 },
      { colleagueId: 2, currentBalance: -100, totalOwed: 100, totalPaid: 0 },
    ];
    const colleagues: ColleagueNameRow[] = [
      { id: 1, name: 'Small Debtor' },
      { id: 2, name: 'Big Debtor' },
    ];

    const result = buildDebtLeaderboard(balances, colleagues, [], [] as never);

    expect(result.debtors[0]!.name).toBe('Big Debtor');
    expect(result.debtors[1]!.name).toBe('Small Debtor');
    expect(result.maxDebtAmount).toBe(100);
  });

  it('orders unpaid expenses and activity by the most recent expense', () => {
    const olderExpense = makeParticipant({
      colleagueId: 1,
      participantId: 1,
      expenseId: 1,
      amount: 20,
      expenseDate: new Date('2026-04-10'),
    });
    const newerExpense = makeParticipant({
      colleagueId: 1,
      participantId: 2,
      expenseId: 2,
      amount: 30,
      expenseDate: new Date('2026-04-20'),
    });

    const result = buildDebtLeaderboard([baseBalance], [aliceColleague], [], [
      newerExpense,
      olderExpense,
    ] as never);

    expect(result.debtors[0]!.unpaidExpenses.map((expense) => expense.id)).toEqual([1, 2]);
    expect(result.debtors[0]!.lastActivity).toBe('2026-04-20');
  });

  it('uses "Unknown" when colleague name is missing', () => {
    const balance: ColleagueBalance = {
      colleagueId: 99,
      currentBalance: -50,
      totalOwed: 50,
      totalPaid: 0,
    };

    const result = buildDebtLeaderboard([balance], [], [], [] as never);

    expect(result.debtors[0]!.name).toBe('Unknown');
  });

  it('marks isSerialDebtor when daysSinceLastPayment > 30', () => {
    // Last payment 61 days before "today" (2026-03-01)
    const lastPayment: MaxDateByColleague = {
      colleagueId: 1,
      _max: { date: new Date('2026-03-01') },
    };

    const result = buildDebtLeaderboard(
      [{ colleagueId: 1, currentBalance: -10, totalOwed: 10, totalPaid: 0 }],
      [aliceColleague],
      [lastPayment],
      [] as never
    );

    expect(result.debtors[0]!.isSerialDebtor).toBe(true);
    expect(result.debtors[0]!.urgencyLevel).toBe('critical'); // days > 30 → critical
  });

  it('returns urgencyLevel "critical" when debt >= 100', () => {
    const result = buildDebtLeaderboard(
      [{ colleagueId: 1, currentBalance: -150, totalOwed: 150, totalPaid: 0 }],
      [aliceColleague],
      [],
      [] as never
    );

    expect(result.debtors[0]!.urgencyLevel).toBe('critical');
  });

  it('returns urgencyLevel "medium" when debt >= 20 and days <= 14', () => {
    const lastPayment: MaxDateByColleague = {
      colleagueId: 1,
      _max: { date: new Date('2026-04-25') }, // 6 days ago
    };

    const result = buildDebtLeaderboard(
      [{ colleagueId: 1, currentBalance: -25, totalOwed: 25, totalPaid: 0 }],
      [aliceColleague],
      [lastPayment],
      [] as never
    );

    expect(result.debtors[0]!.urgencyLevel).toBe('medium');
  });

  it('returns urgencyLevel "low" for small recent debt', () => {
    const lastPayment: MaxDateByColleague = {
      colleagueId: 1,
      _max: { date: new Date('2026-04-29') }, // 2 days ago
    };

    const result = buildDebtLeaderboard(
      [{ colleagueId: 1, currentBalance: -5, totalOwed: 5, totalPaid: 0 }],
      [aliceColleague],
      [lastPayment],
      [] as never
    );

    expect(result.debtors[0]!.urgencyLevel).toBe('low');
  });

  it('returns maxDebtAmount 0 when debtorBalances is empty', () => {
    const result = buildDebtLeaderboard([], [], [], [] as never);
    expect(result.maxDebtAmount).toBe(0);
    expect(result.debtors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeUrgentDebtCount
// ---------------------------------------------------------------------------

describe('computeUrgentDebtCount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when debtors list is empty', () => {
    const result = computeUrgentDebtCount([], []);
    expect(result).toBe(0);
  });

  it('counts debtor with debt >= 50 as urgent', () => {
    const debtors: ColleagueBalance[] = [
      { colleagueId: 1, currentBalance: -50, totalOwed: 50, totalPaid: 0 },
      { colleagueId: 2, currentBalance: -49, totalOwed: 49, totalPaid: 0 },
    ];
    // Both have no known last payment → daysSince = 999 > 14, both are urgent
    const result = computeUrgentDebtCount(debtors, []);
    expect(result).toBe(2); // Both qualify via days > 14
  });

  it('counts debtor with days since payment > 14 as urgent regardless of amount', () => {
    const debtors: ColleagueBalance[] = [
      { colleagueId: 1, currentBalance: -5, totalOwed: 5, totalPaid: 0 },
    ];
    // Last payment 20 days ago (> 14)
    const lastPayments: MaxDateByColleague[] = [
      { colleagueId: 1, _max: { date: new Date('2026-04-11') } },
    ];

    const result = computeUrgentDebtCount(debtors, lastPayments);
    expect(result).toBe(1);
  });

  it('does not count a debtor who paid recently with small debt', () => {
    const debtors: ColleagueBalance[] = [
      { colleagueId: 1, currentBalance: -10, totalOwed: 10, totalPaid: 0 },
    ];
    // Last payment 3 days ago (< 14) and debt 10 < 50
    const lastPayments: MaxDateByColleague[] = [
      { colleagueId: 1, _max: { date: new Date('2026-04-28') } },
    ];

    const result = computeUrgentDebtCount(debtors, lastPayments);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeDebtOverviewMetrics
// ---------------------------------------------------------------------------

describe('computeDebtOverviewMetrics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function baseInput(overrides: Partial<DebtOverviewInput> = {}): DebtOverviewInput {
    return {
      balances: [],
      debtorLastPayments: [],
      totalLunches: 10,
      totalLunchAmount: new Prisma.Decimal('500.00'),
      totalParticipants: 25,
      lastPaymentDate: null,
      favoriteSpot: { name: 'Pizza Palace', visits: 4 },
      recentExpenseAmount: new Prisma.Decimal('200.00'),
      recentPaymentAmount: new Prisma.Decimal('100.00'),
      teamSize: 5,
      restaurantCount: 5,
      ...overrides,
    };
  }

  it('computes averageLunchCost correctly', () => {
    const result = computeDebtOverviewMetrics(baseInput());
    expect(result.averageLunchCost).toBe(50); // 500 / 10
  });

  it('passes restaurantCount through unchanged', () => {
    const result = computeDebtOverviewMetrics(baseInput({ restaurantCount: 7 }));
    expect(result.restaurantCount).toBe(7);
  });

  it('returns averageLunchCost 0 when totalLunches is 0', () => {
    const result = computeDebtOverviewMetrics(
      baseInput({ totalLunches: 0, totalLunchAmount: null })
    );
    expect(result.averageLunchCost).toBe(0);
  });

  it('computes lunchParticipationRate correctly', () => {
    // 25 participants / (10 lunches * 5 team) * 100 = 50%
    const result = computeDebtOverviewMetrics(baseInput());
    expect(result.lunchParticipationRate).toBe(50);
  });

  it('computes averageCostPerPerson correctly', () => {
    // 500 / 25 = 20
    const result = computeDebtOverviewMetrics(baseInput());
    expect(result.averageCostPerPerson).toBe(20);
  });

  it('computes daysSinceLastPayment from lastPaymentDate', () => {
    // lastPaymentDate 10 days before "today"
    const result = computeDebtOverviewMetrics(
      baseInput({ lastPaymentDate: new Date('2026-04-21') })
    );
    expect(result.daysSinceLastPayment).toBe(10);
  });

  it('returns daysSinceLastPayment 0 when lastPaymentDate is null', () => {
    const result = computeDebtOverviewMetrics(baseInput({ lastPaymentDate: null }));
    expect(result.daysSinceLastPayment).toBe(0);
  });

  it('reports debtTrend "increasing" when recentExpenses > recentPayments * 1.2', () => {
    // 200 > 100 * 1.2 → increasing
    const result = computeDebtOverviewMetrics(
      baseInput({
        recentExpenseAmount: new Prisma.Decimal('200.00'),
        recentPaymentAmount: new Prisma.Decimal('100.00'),
      })
    );
    expect(result.debtTrend).toBe('increasing');
  });

  it('reports debtTrend "decreasing" when recentPayments > recentExpenses * 1.2', () => {
    // 300 > 100 * 1.2 → decreasing
    const result = computeDebtOverviewMetrics(
      baseInput({
        recentExpenseAmount: new Prisma.Decimal('100.00'),
        recentPaymentAmount: new Prisma.Decimal('300.00'),
      })
    );
    expect(result.debtTrend).toBe('decreasing');
  });

  it('reports debtTrend "stable" when neither threshold is crossed', () => {
    const result = computeDebtOverviewMetrics(
      baseInput({
        recentExpenseAmount: new Prisma.Decimal('100.00'),
        recentPaymentAmount: new Prisma.Decimal('100.00'),
      })
    );
    expect(result.debtTrend).toBe('stable');
  });

  it('handles null Decimal amounts gracefully', () => {
    const result = computeDebtOverviewMetrics(
      baseInput({
        totalLunchAmount: null,
        recentExpenseAmount: null,
        recentPaymentAmount: null,
        totalParticipants: 0,
      })
    );
    expect(result.averageLunchCost).toBe(0);
    expect(result.averageCostPerPerson).toBe(0);
    expect(result.debtTrend).toBe('stable');
  });

  it('computes totalDebtOutstanding from balances with negative currentBalance', () => {
    const result = computeDebtOverviewMetrics(
      baseInput({
        balances: [
          { colleagueId: 1, currentBalance: -60, totalOwed: 60, totalPaid: 0 },
          { colleagueId: 2, currentBalance: 30, totalOwed: 0, totalPaid: 30 }, // not a debtor
          { colleagueId: 3, currentBalance: -0.0005, totalOwed: 0.01, totalPaid: 0.01 }, // rounds to zero — ignored
        ],
      })
    );
    expect(result.totalDebtOutstanding).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// computePaymentReliabilityStats
// ---------------------------------------------------------------------------

describe('computePaymentReliabilityStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const alice: ColleagueNameRow = { id: 1, name: 'Alice' };
  const bob: ColleagueNameRow = { id: 2, name: 'Bob' };

  function makeExpenseCount(id: number, count: number): CountByColleague {
    return { colleagueId: id, _count: { id: count } };
  }

  function makePaymentCount(id: number, count: number): CountByColleague {
    return { colleagueId: id, _count: { id: count } };
  }

  function makeLastPayment(id: number, date: Date): MaxDateByColleague {
    return { colleagueId: id, _max: { date } };
  }

  it('computes reliabilityScore 100 for same-day payment', () => {
    const payments: PaymentWithExpenseRow[] = [
      {
        colleagueId: 1,
        date: new Date('2026-05-01'),
        expense: { date: new Date('2026-05-01') }, // 0 days delay
      },
    ];

    const result = computePaymentReliabilityStats(
      [alice],
      payments,
      [makeExpenseCount(1, 5)],
      [makePaymentCount(1, 1)],
      [makeLastPayment(1, new Date('2026-05-01'))]
    );

    expect(result[0]!.reliabilityScore).toBe(100);
    expect(result[0]!.averagePaymentDelay).toBe(0);
  });

  it('deducts 10 points per day of average delay', () => {
    const payments: PaymentWithExpenseRow[] = [
      {
        colleagueId: 1,
        date: new Date('2026-05-10'), // 9 days after expense
        expense: { date: new Date('2026-05-01') },
      },
    ];

    const result = computePaymentReliabilityStats(
      [alice],
      payments,
      [makeExpenseCount(1, 1)],
      [makePaymentCount(1, 1)],
      [makeLastPayment(1, new Date('2026-05-10'))]
    );

    expect(result[0]!.averagePaymentDelay).toBe(9);
    expect(result[0]!.reliabilityScore).toBe(10); // 100 - 9*10
  });

  it('assigns reliabilityScore 0 when colleague has never paid but has expenses', () => {
    const result = computePaymentReliabilityStats(
      [alice],
      [], // no payments
      [makeExpenseCount(1, 5)],
      [makePaymentCount(1, 0)], // 0 payments
      []
    );

    expect(result[0]!.reliabilityScore).toBe(0);
    expect(result[0]!.paymentCount).toBe(0);
  });

  it('defaults missing aggregate and payment-map rows to zero', () => {
    const result = computePaymentReliabilityStats([bob], [], [], [], []);

    expect(result).toEqual([
      expect.objectContaining({
        colleagueId: bob.id,
        expenseCount: 0,
        paymentCount: 0,
        averagePaymentDelay: 0,
        needsReminder: false,
      }),
    ]);
  });

  it('counts payment streak for consecutive on-time payments (≤3 days)', () => {
    const payments: PaymentWithExpenseRow[] = [
      // On-time: 1 day delay
      { colleagueId: 1, date: new Date('2026-05-02'), expense: { date: new Date('2026-05-01') } },
      // On-time: 2 day delay
      { colleagueId: 1, date: new Date('2026-05-12'), expense: { date: new Date('2026-05-10') } },
      // Late: 5 day delay — streak broken
      { colleagueId: 1, date: new Date('2026-04-25'), expense: { date: new Date('2026-04-20') } },
      // On-time: but never reached due to break
      { colleagueId: 1, date: new Date('2026-04-11'), expense: { date: new Date('2026-04-10') } },
    ];

    const result = computePaymentReliabilityStats(
      [alice],
      payments,
      [makeExpenseCount(1, 5)],
      [makePaymentCount(1, 4)],
      [makeLastPayment(1, new Date('2026-05-12'))]
    );

    expect(result[0]!.paymentStreak).toBe(2);
  });

  it('paymentStreak is 0 when first payment is late', () => {
    const payments: PaymentWithExpenseRow[] = [
      // 10 days late — immediately breaks streak
      { colleagueId: 1, date: new Date('2026-05-11'), expense: { date: new Date('2026-05-01') } },
    ];

    const result = computePaymentReliabilityStats(
      [alice],
      payments,
      [makeExpenseCount(1, 1)],
      [makePaymentCount(1, 1)],
      [makeLastPayment(1, new Date('2026-05-11'))]
    );

    expect(result[0]!.paymentStreak).toBe(0);
  });

  it('sets needsReminder when daysSinceLast > 7 and expenseCount > paymentCount', () => {
    // Last payment 10 days before "today" (2026-05-05), expenses > payments
    const result = computePaymentReliabilityStats(
      [alice],
      [],
      [makeExpenseCount(1, 5)],
      [makePaymentCount(1, 2)],
      [makeLastPayment(1, new Date('2026-05-05'))]
    );

    expect(result[0]!.needsReminder).toBe(true);
  });

  it('sorts stats by reliabilityScore descending', () => {
    const payments: PaymentWithExpenseRow[] = [
      // Alice: 0 days → score 100
      { colleagueId: 1, date: new Date('2026-05-01'), expense: { date: new Date('2026-05-01') } },
      // Bob: 9 days → score 10
      { colleagueId: 2, date: new Date('2026-05-10'), expense: { date: new Date('2026-05-01') } },
    ];

    const result = computePaymentReliabilityStats(
      [alice, bob],
      payments,
      [makeExpenseCount(1, 1), makeExpenseCount(2, 1)],
      [makePaymentCount(1, 1), makePaymentCount(2, 1)],
      [makeLastPayment(1, new Date('2026-05-01')), makeLastPayment(2, new Date('2026-05-10'))]
    );

    expect(result[0]!.name).toBe('Alice');
    expect(result[1]!.name).toBe('Bob');
  });

  it('skips payments without an associated expense in delay calculation', () => {
    const payments: PaymentWithExpenseRow[] = [
      { colleagueId: 1, date: new Date('2026-05-10'), expense: null }, // skipped
    ];

    const result = computePaymentReliabilityStats(
      [alice],
      payments,
      [makeExpenseCount(1, 3)],
      [makePaymentCount(1, 1)],
      [makeLastPayment(1, new Date('2026-05-10'))]
    );

    expect(result[0]!.averagePaymentDelay).toBe(0);
    // paymentCount=1, expenseCount=3 but paid recently (5 days) so needsReminder=false
  });
});

// ---------------------------------------------------------------------------
// computeRestaurantChartData
// ---------------------------------------------------------------------------

describe('computeRestaurantChartData', () => {
  const restaurant1: ColleagueNameRow = { id: 1, name: 'Sushi Place' };
  const restaurant2: ColleagueNameRow = { id: 2, name: 'Very Long Restaurant Name Here' };

  function makeAgg(
    restaurantId: number | null,
    visits: number,
    amount: string
  ): RestaurantAggregateRow {
    return {
      restaurantId,
      _count: { id: visits },
      _sum: { amount: new Prisma.Decimal(amount) },
    };
  }

  it('computes popularity data with correct percentage', () => {
    const agg: RestaurantAggregateRow[] = [makeAgg(1, 5, '300.00'), makeAgg(2, 2, '100.00')];
    const participantCounts: ParticipantCountRow[] = [
      { expenseId: 10, _count: { id: 3 } },
      { expenseId: 11, _count: { id: 2 } },
    ];
    const expenseRestaurants: ExpenseRestaurantRow[] = [
      { id: 10, restaurantId: 1 },
      { id: 11, restaurantId: 2 },
    ];

    const result = computeRestaurantChartData(agg, 7, participantCounts, expenseRestaurants, [
      restaurant1,
      restaurant2,
    ]);

    expect(result.totalRestaurants).toBe(2);
    expect(result.totalExpenses).toBe(7);

    const sushi = result.popularityData.find((d) => d.fullName === 'Sushi Place');
    expect(sushi).toBeDefined();
    expect(sushi!.visits).toBe(5);
    expect(sushi!.percentage).toBe('71.4'); // 5/7 * 100
  });

  it('truncates restaurant names longer than 15 characters', () => {
    const agg: RestaurantAggregateRow[] = [makeAgg(2, 3, '150.00')];

    const result = computeRestaurantChartData(agg, 3, [], [], [restaurant2]);

    expect(result.popularityData[0]!.name).toBe('Very Long Resta...');
    expect(result.popularityData[0]!.fullName).toBe('Very Long Restaurant Name Here');
  });

  it('does not truncate names of 15 characters or fewer', () => {
    const agg: RestaurantAggregateRow[] = [makeAgg(1, 2, '80.00')];

    const result = computeRestaurantChartData(agg, 2, [], [], [restaurant1]);

    // 'Sushi Place' is 11 chars — no truncation
    expect(result.popularityData[0]!.name).toBe('Sushi Place');
  });

  it('handles null restaurantId — shows "Unknown Restaurant"', () => {
    const agg: RestaurantAggregateRow[] = [makeAgg(null, 1, '50.00')];

    const result = computeRestaurantChartData(agg, 1, [], [], []);

    expect(result.popularityData[0]!.fullName).toBe('Unknown Restaurant');
    // 'Unknown Restaurant' is 18 chars → truncated
    expect(result.popularityData[0]!.name).toBe('Unknown Restaur...');
  });

  it('handles missing restaurant maps, null amounts, and a zero total expense count', () => {
    const result = computeRestaurantChartData(
      [{ restaurantId: 9, _sum: { amount: null }, _count: { id: 1 } }],
      0,
      [{ expenseId: 1, _count: { id: 2 } }],
      [{ id: 1, restaurantId: null }],
      []
    );

    expect(result.popularityData[0]).toMatchObject({
      fullName: 'Unknown Restaurant',
      percentage: '0',
    });
    expect(result.priceData[0]).toMatchObject({ totalSpent: 0, avgCostPerPerson: 0 });
  });

  it('computes avgCostPerPerson when participant counts are present', () => {
    const agg: RestaurantAggregateRow[] = [makeAgg(1, 4, '200.00')];
    // 2 expenses for restaurant 1, each with 5 participants → 10 total
    const participantCounts: ParticipantCountRow[] = [
      { expenseId: 1, _count: { id: 5 } },
      { expenseId: 2, _count: { id: 5 } },
    ];
    const expenseRestaurants: ExpenseRestaurantRow[] = [
      { id: 1, restaurantId: 1 },
      { id: 2, restaurantId: 1 },
    ];

    const result = computeRestaurantChartData(agg, 4, participantCounts, expenseRestaurants, [
      restaurant1,
    ]);

    const priceEntry = result.priceData.find((d) => d.fullName === 'Sushi Place');
    expect(priceEntry).toBeDefined();
    expect(priceEntry!.avgCostPerPerson).toBe(20); // 200 / 10
    expect(priceEntry!.avgCost).toBe(50); // 200 / 4
  });

  it('sets avgCostPerPerson to 0 when no participant data for a restaurant', () => {
    const agg: RestaurantAggregateRow[] = [makeAgg(1, 2, '100.00')];

    const result = computeRestaurantChartData(agg, 2, [], [], [restaurant1]);

    expect(result.priceData[0]!.avgCostPerPerson).toBe(0);
  });

  it('returns empty arrays when no restaurant aggregates', () => {
    const result = computeRestaurantChartData([], 0, [], [], []);

    expect(result.popularityData).toEqual([]);
    expect(result.priceData).toEqual([]);
    expect(result.totalRestaurants).toBe(0);
    expect(result.totalExpenses).toBe(0);
  });
});
