import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    colleague: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    payment: {
      groupBy: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    expenseParticipant: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    restaurant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
}));

vi.mock('./balance-calculator', () => ({
  calculateAllColleagueBalances: vi.fn(),
}));

vi.mock('@/server/utils/decimal', () => ({
  serializeDecimal: vi.fn((v) => Number(v)),
}));

import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode } from '@/utils/errors';
import { calculateAllColleagueBalances } from './balance-calculator';
import {
  favoriteRestaurantName,
  getDebtLeaderboard,
  getDebtOverviewMetrics,
  getPaymentReliabilityStats,
  getRestaurantChartData,
} from './debt-analytics';

describe('favoriteRestaurantName', () => {
  it('returns the restaurant name when present', () => {
    expect(favoriteRestaurantName({ name: 'Pizza Palace' })).toBe('Pizza Palace');
  });

  it('returns Unknown when restaurant is missing', () => {
    expect(favoriteRestaurantName(null)).toBe('Unknown');
  });
});

const mockGetAuth = vi.mocked(getAuthFromCookie);
const mockBalances = vi.mocked(calculateAllColleagueBalances);
const mockColleague = vi.mocked(prisma.colleague);
const mockPayment = vi.mocked(prisma.payment);
const mockExpense = vi.mocked(prisma.expense);
const mockParticipant = vi.mocked(prisma.expenseParticipant);
const mockRestaurant = vi.mocked(prisma.restaurant);

describe('debt-analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDebtLeaderboard', () => {
    it('returns empty leaderboard when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getDebtLeaderboard({ data: undefined });
      expect(result).toEqual({ debtors: [], maxDebtAmount: 0 });
    });

    it('returns empty leaderboard when no debtors', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 1, currentBalance: 50, totalOwed: 100, totalPaid: 50 },
      ]);
      const result = await getDebtLeaderboard({ data: undefined });
      expect(result).toEqual({ debtors: [], maxDebtAmount: 0 });
    });

    it('throws infrastructure error on unexpected failure', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockRejectedValue(new Error('db failure'));

      await expect(getDebtLeaderboard({ data: undefined })).rejects.toThrow(
        'Failed to fetch debt leaderboard'
      );
    });

    it('rethrows AppError without wrapping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'db not found');
      mockBalances.mockRejectedValue(appError);

      await expect(getDebtLeaderboard({ data: undefined })).rejects.toThrow('db not found');
    });

    it('builds debtors with unpaid expenses and urgency', async () => {
      // Freeze time so daysSince calculations are deterministic
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01'));

      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 10, currentBalance: -75, totalOwed: 100, totalPaid: 25 },
      ]);
      mockColleague.findMany.mockResolvedValue([
        { id: 10, name: 'Alice', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.groupBy.mockResolvedValue([
        { colleagueId: 10, _max: { date: new Date('2026-04-20') } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        {
          colleagueId: 10,
          amount: 50,
          expense: {
            id: 1,
            date: new Date('2026-04-01'),
            amount: 100,
            splitType: 'EQUAL',
            notes: null,
            restaurantId: 5,
            restaurant: { name: 'Sushi Place' },
            participants: [{ id: 1 }, { id: 2 }],
          },
          paymentApplications: [
            { amount: 10, payment: { isApproved: true } },
            { amount: 5, payment: { isApproved: false } },
          ],
        },
      ] as never);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.debtors).toHaveLength(1);
      const debtor = result.debtors[0]!;
      expect(debtor.name).toBe('Alice');
      expect(debtor.currentBalance).toBe(-75);
      expect(debtor.unpaidExpenses).toHaveLength(1);
      expect(debtor.unpaidExpenses[0]!.remainingOwed).toBe(40); // 50 - 10 (only approved)
      expect(debtor.isSerialDebtor).toBe(false); // 1 expense <= 3, 11 days <= 30
      expect(debtor.urgencyLevel).toBe('high'); // debt=75 >= 50 but < 100, days=11 <= 14
      expect(result.maxDebtAmount).toBe(75);

      vi.useRealTimers();
    });

    it('filters out fully paid expenses', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 10, currentBalance: -20, totalOwed: 50, totalPaid: 30 },
      ]);
      mockColleague.findMany.mockResolvedValue([
        { id: 10, name: 'Bob', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.groupBy.mockResolvedValue([]);
      mockParticipant.findMany.mockResolvedValue([
        {
          colleagueId: 10,
          amount: 50,
          expense: {
            id: 1,
            date: new Date('2026-04-01'),
            amount: 100,
            splitType: 'EQUAL',
            notes: null,
            restaurantId: null,
            restaurant: null,
            participants: [{ id: 1 }],
          },
          paymentApplications: [{ amount: 50, payment: { isApproved: true } }],
        },
      ] as never);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.debtors[0]!.unpaidExpenses).toHaveLength(0);
    });

    it('sorts debtors by most debt first', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 1, currentBalance: -30, totalOwed: 30, totalPaid: 0 },
        { colleagueId: 2, currentBalance: -100, totalOwed: 100, totalPaid: 0 },
      ]);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Small Debtor' },
        { id: 2, name: 'Big Debtor' },
      ] as never);
      mockPayment.groupBy.mockResolvedValue([]);
      mockParticipant.findMany.mockResolvedValue([]);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.debtors[0]!.name).toBe('Big Debtor');
      expect(result.debtors[1]!.name).toBe('Small Debtor');
      expect(result.maxDebtAmount).toBe(100);
    });
  });

  describe('getDebtOverviewMetrics', () => {
    it('returns zeros when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getDebtOverviewMetrics({ data: undefined });
      expect(result.totalDebtOutstanding).toBe(0);
      expect(result.totalLunches).toBe(0);
      expect(result.debtTrend).toBe('stable');
    });

    it('computes overview metrics from aggregated data', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 1, currentBalance: -60, totalOwed: 60, totalPaid: 0 },
        { colleagueId: 2, currentBalance: 30, totalOwed: 0, totalPaid: 30 },
      ]);
      mockExpense.aggregate
        .mockResolvedValueOnce({
          _count: { id: 10 },
          _sum: { amount: 500 },
        } as never)
        .mockResolvedValueOnce({
          _sum: { amount: 300 },
        } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 25 } } as never);
      mockPayment.findFirst.mockResolvedValue({ date: new Date('2026-05-01') } as never);
      mockExpense.groupBy
        .mockResolvedValueOnce([{ restaurantId: 5, _count: { id: 4 } }] as never)
        .mockResolvedValueOnce([] as never);
      mockPayment.aggregate.mockResolvedValueOnce({ _sum: { amount: 150 } } as never);
      mockColleague.count.mockResolvedValue(5);
      mockRestaurant.count.mockResolvedValue(3);
      mockRestaurant.findUnique.mockResolvedValue({ id: 5, name: 'Pizza Palace' } as never);
      mockPayment.groupBy.mockResolvedValue([
        { colleagueId: 1, _max: { date: new Date('2026-04-20') } },
      ] as never);

      const result = await getDebtOverviewMetrics({ data: undefined });

      expect(result.totalDebtOutstanding).toBe(60);
      expect(result.totalLunches).toBe(10);
      expect(result.averageLunchCost).toBe(50); // 500/10
      expect(result.favoriteSpot).toEqual({ name: 'Pizza Palace', visits: 4 });
      expect(result.teamSize).toBe(5);
      expect(result.restaurantCount).toBe(3);
      expect(result.urgentDebtCount).toBe(1); // debtor 1: debt >= 50
      expect(result.debtTrend).toBe('increasing'); // 200 > 150 * 1.2? 200 > 180 → yes
    });

    it('computes decreasing debt trend', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([]);
      mockExpense.aggregate
        .mockResolvedValueOnce({ _count: { id: 5 }, _sum: { amount: 100 } } as never)
        .mockResolvedValueOnce({ _sum: { amount: 100 } } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 10 } } as never);
      mockPayment.findFirst.mockResolvedValue(null);
      mockExpense.groupBy.mockResolvedValue([]);
      mockPayment.aggregate.mockResolvedValueOnce({ _sum: { amount: 200 } } as never);
      mockColleague.count.mockResolvedValue(3);
      mockPayment.groupBy.mockResolvedValue([]);

      const result = await getDebtOverviewMetrics({ data: undefined });
      expect(result.debtTrend).toBe('decreasing'); // 200 > 100 * 1.2
    });

    it('computes stable debt trend', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([]);
      mockExpense.aggregate
        .mockResolvedValueOnce({ _count: { id: 5 }, _sum: { amount: 100 } } as never)
        .mockResolvedValueOnce({ _sum: { amount: 100 } } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 10 } } as never);
      mockPayment.findFirst.mockResolvedValue(null);
      mockExpense.groupBy.mockResolvedValue([]);
      mockPayment.aggregate.mockResolvedValueOnce({ _sum: { amount: 100 } } as never);
      mockColleague.count.mockResolvedValue(3);
      mockPayment.groupBy.mockResolvedValue([]);

      const result = await getDebtOverviewMetrics({ data: undefined });
      expect(result.debtTrend).toBe('stable');
    });

    it('throws infrastructure error on unexpected failure', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockRejectedValue(new Error('db failure'));

      await expect(getDebtOverviewMetrics({ data: undefined })).rejects.toThrow(
        'Failed to fetch debt overview metrics'
      );
    });

    it('rethrows AppError without wrapping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'db not found');
      mockBalances.mockRejectedValue(appError);

      await expect(getDebtOverviewMetrics({ data: undefined })).rejects.toThrow('db not found');
    });
  });

  describe('getPaymentReliabilityStats', () => {
    it('returns empty array when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getPaymentReliabilityStats({ data: undefined });
      expect(result).toEqual([]);
    });

    it('calculates reliability score based on payment delay', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Fast Payer' },
        { id: 2, name: 'Slow Payer' },
      ] as never);
      mockPayment.findMany.mockResolvedValue([
        {
          colleagueId: 1,
          date: new Date('2026-05-01'),
          expense: { date: new Date('2026-05-01') },
        },
        {
          colleagueId: 2,
          date: new Date('2026-05-10'),
          expense: { date: new Date('2026-05-01') },
        },
      ] as never);
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _count: { id: 5 } },
        { colleagueId: 2, _count: { id: 5 } },
      ] as never);
      mockPayment.groupBy
        .mockResolvedValueOnce([
          { colleagueId: 1, _count: { id: 5 } },
          { colleagueId: 2, _count: { id: 3 } },
        ] as never)
        .mockResolvedValueOnce([
          { colleagueId: 1, _max: { date: new Date('2026-05-01') } },
          { colleagueId: 2, _max: { date: new Date('2026-04-20') } },
        ] as never);

      const result = await getPaymentReliabilityStats({ data: undefined });
      expect(result).toHaveLength(2);
      const fast = result.find((r) => r.name === 'Fast Payer');
      const slow = result.find((r) => r.name === 'Slow Payer');
      expect(fast!.reliabilityScore).toBe(100); // 0 days delay
      expect(slow!.reliabilityScore).toBeLessThan(100); // 9 days delay
    });

    it('gives zero score to colleagues who never paid', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Never Paid', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.findMany.mockResolvedValue([]);
      mockParticipant.groupBy.mockResolvedValue([{ colleagueId: 1, _count: { id: 5 } }] as never);
      mockPayment.groupBy
        .mockResolvedValueOnce([{ colleagueId: 1, _count: { id: 0 } }] as never)
        .mockResolvedValueOnce([] as never);

      const result = await getPaymentReliabilityStats({ data: undefined });
      expect(result[0]!.reliabilityScore).toBe(0);
      expect(result[0]!.paymentCount).toBe(0);
    });

    it('calculates payment streak for on-time payments', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const today = new Date('2026-05-04');
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Streaker', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.findMany.mockResolvedValue([
        {
          colleagueId: 1,
          date: new Date('2026-05-03'),
          expense: { date: new Date('2026-05-02') },
        },
        {
          colleagueId: 1,
          date: new Date('2026-05-01'),
          expense: { date: new Date('2026-04-30') },
        },
        {
          colleagueId: 1,
          date: new Date('2026-04-25'),
          expense: { date: new Date('2026-04-20') }, // 5 days, breaks streak
        },
      ] as never);
      mockParticipant.groupBy.mockResolvedValue([{ colleagueId: 1, _count: { id: 10 } }] as never);
      mockPayment.groupBy
        .mockResolvedValueOnce([{ colleagueId: 1, _count: { id: 3 } }] as never)
        .mockResolvedValueOnce([{ colleagueId: 1, _max: { date: today } }] as never);

      const result = await getPaymentReliabilityStats({ data: undefined });
      expect(result[0]!.paymentStreak).toBe(2); // First two within 3 days
    });

    it('sorts by reliability score descending', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Low' },
        { id: 2, name: 'High' },
      ] as never);
      mockPayment.findMany.mockResolvedValue([
        {
          colleagueId: 2,
          date: new Date('2026-05-01'),
          expense: { date: new Date('2026-05-01') },
        },
        {
          colleagueId: 1,
          date: new Date('2026-05-10'),
          expense: { date: new Date('2026-05-01') },
        },
      ] as never);
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _count: { id: 3 } },
        { colleagueId: 2, _count: { id: 3 } },
      ] as never);
      mockPayment.groupBy
        .mockResolvedValueOnce([
          { colleagueId: 1, _count: { id: 1 } },
          { colleagueId: 2, _count: { id: 3 } },
        ] as never)
        .mockResolvedValueOnce([
          { colleagueId: 1, _max: { date: new Date('2026-05-10') } },
          { colleagueId: 2, _max: { date: new Date('2026-05-01') } },
        ] as never);

      const result = await getPaymentReliabilityStats({ data: undefined });
      expect(result[0]!.name).toBe('High');
    });

    it('throws infrastructure error on unexpected failure', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockColleague.findMany.mockRejectedValue(new Error('db failure'));

      await expect(getPaymentReliabilityStats({ data: undefined })).rejects.toThrow(
        'Failed to fetch payment reliability stats'
      );
    });

    it('rethrows AppError without wrapping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'db not found');
      mockColleague.findMany.mockRejectedValue(appError);

      await expect(getPaymentReliabilityStats({ data: undefined })).rejects.toThrow('db not found');
    });
  });

  describe('getRestaurantChartData', () => {
    it('returns empty data when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getRestaurantChartData({ data: undefined });
      expect(result.popularityData).toEqual([]);
      expect(result.priceData).toEqual([]);
      expect(result.totalRestaurants).toBe(0);
    });

    it('computes popularity and price data from aggregates', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.groupBy.mockResolvedValue([
        { restaurantId: 1, _sum: { amount: 300 }, _count: { id: 5 } },
        { restaurantId: 2, _sum: { amount: 100 }, _count: { id: 2 } },
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 7 } } as never);
      mockParticipant.groupBy.mockResolvedValue([
        { expenseId: 1, _count: { id: 3 } },
        { expenseId: 2, _count: { id: 2 } },
      ] as never);
      mockExpense.findMany.mockResolvedValue([
        { id: 1, restaurantId: 1 },
        { id: 2, restaurantId: 2 },
      ] as never);
      mockRestaurant.findMany.mockResolvedValue([
        { id: 1, name: 'Sushi Place' },
        { id: 2, name: 'Very Long Restaurant Name That Exceeds' },
      ] as never);

      const result = await getRestaurantChartData({ data: undefined });

      expect(result.totalRestaurants).toBe(2);
      expect(result.totalExpenses).toBe(7);
      expect(result.popularityData[0]!.name).toBe('Sushi Place');
      expect(result.popularityData[0]!.visits).toBe(5);
      expect(result.popularityData[1]!.name).toBe('Very Long Resta...');
      expect(result.priceData).toBeDefined();
      expect(result.priceData.length).toBeGreaterThan(0);
    });

    it('handles null restaurantId in aggregates', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.groupBy.mockResolvedValue([
        { restaurantId: null, _sum: { amount: 50 }, _count: { id: 1 } },
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 1 } } as never);
      mockParticipant.groupBy.mockResolvedValue([]);
      mockExpense.findMany.mockResolvedValue([]);
      mockRestaurant.findMany.mockResolvedValue([]);

      const result = await getRestaurantChartData({ data: undefined });
      expect(result.totalRestaurants).toBe(1);
      expect(result.popularityData[0]!.name).toBe('Unknown Restaur...');
    });

    it('returns empty data when no restaurant aggregates', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.groupBy.mockResolvedValue([] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 0 } } as never);
      mockParticipant.groupBy.mockResolvedValue([]);
      mockExpense.findMany.mockResolvedValue([]);
      mockRestaurant.findMany.mockResolvedValue([]);

      const result = await getRestaurantChartData({ data: undefined });
      expect(result.totalRestaurants).toBe(0);
      expect(result.popularityData).toEqual([]);
      expect(result.priceData).toEqual([]);
    });

    it('throws infrastructure error on unexpected failure', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.groupBy.mockRejectedValue(new Error('db failure'));

      await expect(getRestaurantChartData({ data: undefined })).rejects.toThrow(
        'Failed to fetch restaurant chart data'
      );
    });

    it('rethrows AppError without wrapping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'db not found');
      mockExpense.groupBy.mockRejectedValue(appError);

      await expect(getRestaurantChartData({ data: undefined })).rejects.toThrow('db not found');
    });
  });

  describe('getDebtLeaderboard edge cases', () => {
    it('assigns medium urgency for medium debt', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01'));

      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 10, currentBalance: -30, totalOwed: 30, totalPaid: 0 },
      ]);
      mockColleague.findMany.mockResolvedValue([
        { id: 10, name: 'Medium Debtor', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.groupBy.mockResolvedValue([
        { colleagueId: 10, _max: { date: new Date('2026-04-20') } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        {
          colleagueId: 10,
          amount: 30,
          expense: {
            id: 1,
            date: new Date('2026-04-01'),
            amount: 100,
            splitType: 'EQUAL',
            notes: null,
            restaurantId: 5,
            restaurant: { name: 'Test Place' },
            participants: [{ id: 1 }],
          },
          paymentApplications: [],
        },
      ] as never);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.debtors[0]!.urgencyLevel).toBe('medium');

      vi.useRealTimers();
    });

    it('assigns low urgency for small debt', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01'));

      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 10, currentBalance: -10, totalOwed: 10, totalPaid: 0 },
      ]);
      mockColleague.findMany.mockResolvedValue([
        { id: 10, name: 'Low Debtor', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.groupBy.mockResolvedValue([
        { colleagueId: 10, _max: { date: new Date('2026-04-27') } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        {
          colleagueId: 10,
          amount: 10,
          expense: {
            id: 1,
            date: new Date('2026-04-01'),
            amount: 100,
            splitType: 'EQUAL',
            notes: null,
            restaurantId: 5,
            restaurant: { name: 'Test Place' },
            participants: [{ id: 1 }],
          },
          paymentApplications: [],
        },
      ] as never);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.debtors[0]!.urgencyLevel).toBe('low');

      vi.useRealTimers();
    });

    it('marks serial debtor when days since payment > 30', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-01'));

      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 10, currentBalance: -10, totalOwed: 10, totalPaid: 0 },
      ]);
      mockColleague.findMany.mockResolvedValue([
        { id: 10, name: 'Serial', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.groupBy.mockResolvedValue([
        { colleagueId: 10, _max: { date: new Date('2026-03-01') } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        {
          colleagueId: 10,
          amount: 10,
          expense: {
            id: 1,
            date: new Date('2026-04-01'),
            amount: 100,
            splitType: 'EQUAL',
            notes: null,
            restaurantId: null,
            restaurant: null,
            participants: [{ id: 1 }],
          },
          paymentApplications: [],
        },
      ] as never);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.debtors[0]!.isSerialDebtor).toBe(true);
      expect(result.debtors[0]!.name).toBe('Serial');

      vi.useRealTimers();
    });

    it('uses Unknown for missing colleague name', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 99, currentBalance: -50, totalOwed: 50, totalPaid: 0 },
      ]);
      mockColleague.findMany.mockResolvedValue([]);
      mockPayment.groupBy.mockResolvedValue([]);
      mockParticipant.findMany.mockResolvedValue([]);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.debtors[0]!.name).toBe('Unknown');
    });

    it('returns maxDebtAmount 0 when no debtors', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockBalances.mockResolvedValue([
        { colleagueId: 1, currentBalance: 50, totalOwed: 50, totalPaid: 0 },
      ]);

      const result = await getDebtLeaderboard({ data: undefined });
      expect(result.maxDebtAmount).toBe(0);
    });
  });

  describe('getPaymentReliabilityStats edge cases', () => {
    it('sets needsReminder when no payment for >7 days and owes money', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Remind Me', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.findMany.mockResolvedValue([]);
      mockParticipant.groupBy.mockResolvedValue([{ colleagueId: 1, _count: { id: 5 } }] as never);
      mockPayment.groupBy
        .mockResolvedValueOnce([{ colleagueId: 1, _count: { id: 0 } }] as never)
        .mockResolvedValueOnce([] as never);

      const result = await getPaymentReliabilityStats({ data: undefined });
      expect(result[0]!.needsReminder).toBe(true);
    });

    it('skips payment without expense in delay calc', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'No Expense', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);
      mockPayment.findMany.mockResolvedValue([
        { colleagueId: 1, date: new Date('2026-05-01'), expense: null },
      ] as never);
      mockParticipant.groupBy.mockResolvedValue([{ colleagueId: 1, _count: { id: 3 } }] as never);
      mockPayment.groupBy
        .mockResolvedValueOnce([{ colleagueId: 1, _count: { id: 1 } }] as never)
        .mockResolvedValueOnce([
          { colleagueId: 1, _max: { date: new Date('2026-05-01') } },
        ] as never);

      const result = await getPaymentReliabilityStats({ data: undefined });
      expect(result[0]!.averagePaymentDelay).toBe(0);
    });
  });
});
