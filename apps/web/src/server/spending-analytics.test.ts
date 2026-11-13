import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    expenseParticipant: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    colleague: {
      findMany: vi.fn(),
    },
    restaurant: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
}));

import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode } from '@/utils/errors';
import { getSpendingAnalytics, getSpendingInsights, getSpendingTrends } from './spending-analytics';

const mockGetAuth = vi.mocked(getAuthFromCookie);
const mockParticipant = vi.mocked(prisma.expenseParticipant);
const mockExpense = vi.mocked(prisma.expense);
const mockColleague = vi.mocked(prisma.colleague);
const mockRestaurant = vi.mocked(prisma.restaurant);

describe('spending-analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSpendingAnalytics', () => {
    it('returns empty data when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getSpendingAnalytics({ data: undefined });
      expect(result.topSpenders).toEqual([]);
      expect(result.overview.totalColleagues).toBe(0);
    });

    it('computes spending stats for each colleague', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _sum: { amount: 300 }, _count: { id: 5 } },
        { colleagueId: 2, _sum: { amount: 100 }, _count: { id: 2 } },
      ] as never);
      const today = new Date();
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(today.getDate() - 2);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);
      mockParticipant.findMany.mockResolvedValue([
        { colleagueId: 1, expense: { date: twoDaysAgo } },
        { colleagueId: 2, expense: { date: threeDaysAgo } },
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 10 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Alice', createdAt: new Date(), deletedAt: null, deletedBy: null },
        { id: 2, name: 'Bob', createdAt: new Date(), deletedAt: null, deletedBy: null },
        { id: 3, name: 'Carol', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });

      expect(result.topSpenders[0]!.name).toBe('Alice');
      expect(result.topSpenders[0]!.totalSpent).toBe(300);
      expect(result.lowSpenders[0]!.name).toBe('Bob');
      expect(result.inactiveMembers).toHaveLength(1);
      expect(result.inactiveMembers[0]!.name).toBe('Carol');
      expect(result.overview.totalColleagues).toBe(3);
      expect(result.overview.activeColleagues).toBe(2);
      expect(result.overview.totalSpending).toBe(400);
    });

    it('computes participation rate per colleague', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _sum: { amount: 50 }, _count: { id: 3 } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        { colleagueId: 1, expense: { date: new Date('2026-05-01') } },
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 10 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Regular', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });
      expect(result.frequentParticipants[0]!.participationRate).toBe(30); // (3/10)*100
    });

    it('handles zero total expenses for participation rate', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([]);
      mockParticipant.findMany.mockResolvedValue([]);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 0 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Lonely', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });
      expect(result.frequentParticipants).toEqual([]);
    });

    it('assigns a zero participation rate when aggregates exist without expenses', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _sum: { amount: 0 }, _count: { id: 1 } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        { colleagueId: 1, expense: { date: new Date('2026-05-01') } },
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 0 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Regular', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });

      expect(result.inactiveMembers[0]!.participationRate).toBe(0);
    });

    it('skips deleted colleagues not in colleague list', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      // Aggregate includes a deleted colleague (id: 99) not in colleague list
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _sum: { amount: 300 }, _count: { id: 5 } },
        { colleagueId: 99, _sum: { amount: 100 }, _count: { id: 2 } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        { colleagueId: 1, expense: { date: new Date() } },
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 10 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Alice', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });
      expect(result.topSpenders).toHaveLength(1);
      expect(result.topSpenders[0]!.name).toBe('Alice');
      expect(result.overview.totalSpending).toBe(300);
    });

    it('handles null aggregate amounts and missing last dates', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _sum: { amount: null }, _count: { id: 0 } },
      ] as never);
      // No last expense date returned for this colleague
      mockParticipant.findMany.mockResolvedValue([] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 5 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'NoData', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });
      expect(result.topSpenders).toEqual([]);
      expect(result.lowSpenders).toEqual([]);
      expect(result.inactiveMembers).toHaveLength(1);
      expect(result.inactiveMembers[0]!.name).toBe('NoData');
      expect(result.inactiveMembers[0]!.daysSinceLastExpense).toBe(999);
      expect(result.frequentParticipants).toEqual([]);
    });

    it('returns zero average when all colleagues have zero spending', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([] as never);
      mockParticipant.findMany.mockResolvedValue([] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 0 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'A', createdAt: new Date(), deletedAt: null, deletedBy: null },
        { id: 2, name: 'B', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });
      expect(result.overview.averageSpendingPerPerson).toBe(0);
      expect(result.overview.totalSpending).toBe(0);
      expect(result.topSpenders).toEqual([]);
      expect(result.lowSpenders).toEqual([]);
      expect(result.frequentParticipants).toEqual([]);
    });

    it('only flags truly active members as non-inactive', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20'));

      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _sum: { amount: 50 }, _count: { id: 1 } },
        { colleagueId: 2, _sum: { amount: 100 }, _count: { id: 2 } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        { colleagueId: 1, expense: { date: new Date('2026-05-18') } }, // 2 days ago, active
        { colleagueId: 2, expense: { date: new Date('2026-05-01') } }, // 19 days ago, inactive
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 5 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Active', createdAt: new Date(), deletedAt: null, deletedBy: null },
        { id: 2, name: 'Inactive', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });
      // Active member (2 days) should NOT be in inactiveMembers
      const inactiveNames = result.inactiveMembers.map((m) => m.name);
      expect(inactiveNames).not.toContain('Active');
      expect(inactiveNames).toContain('Inactive');

      vi.useRealTimers();
    });

    it('flags inactive members after 14 days since last expense', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20'));

      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockResolvedValue([
        { colleagueId: 1, _sum: { amount: 50 }, _count: { id: 1 } },
      ] as never);
      mockParticipant.findMany.mockResolvedValue([
        { colleagueId: 1, expense: { date: new Date('2026-05-01') } },
      ] as never);
      mockExpense.aggregate.mockResolvedValue({ _count: { id: 5 } } as never);
      mockColleague.findMany.mockResolvedValue([
        { id: 1, name: 'Inactive', createdAt: new Date(), deletedAt: null, deletedBy: null },
      ] as never);

      const result = await getSpendingAnalytics({ data: undefined });
      expect(result.inactiveMembers).toHaveLength(1);
      expect(result.inactiveMembers[0]!.name).toBe('Inactive');

      vi.useRealTimers();
    });

    it('throws infrastructure error on unexpected failure', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockParticipant.groupBy.mockRejectedValue(new Error('db failure'));

      await expect(getSpendingAnalytics({ data: undefined })).rejects.toThrow(
        'Failed to fetch spending analytics'
      );
    });

    it('rethrows AppError without wrapping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'db not found');
      mockParticipant.groupBy.mockRejectedValue(appError);

      await expect(getSpendingAnalytics({ data: undefined })).rejects.toThrow('db not found');
    });
  });

  describe('getSpendingTrends', () => {
    it('returns empty array when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getSpendingTrends({ data: { period: 'week', months: 6 } });
      expect(result).toEqual([]);
    });

    it('groups expenses by week', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockResolvedValue([
        {
          date: new Date('2026-05-04'),
          amount: 100,
          participants: [{ colleagueId: 1 }, { colleagueId: 2 }],
        },
        {
          date: new Date('2026-05-05'),
          amount: 50,
          participants: [{ colleagueId: 1 }],
        },
      ] as never);

      const result = await getSpendingTrends({ data: { period: 'week', months: 3 } });

      expect(result).toHaveLength(1);
      expect(result[0]!.totalSpending).toBe(150);
      expect(result[0]!.expenseCount).toBe(2);
      expect(result[0]!.uniqueParticipants).toBe(2);
      expect(result[0]!.averageExpenseAmount).toBe(75);
    });

    it('handles Sunday dates in week grouping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      // 2026-05-03 is a Sunday — getDay() returns 0, so || 7 gives 7
      mockExpense.findMany.mockResolvedValue([
        {
          date: new Date('2026-05-03'),
          amount: 120,
          participants: [{ colleagueId: 1 }],
        },
      ] as never);

      const result = await getSpendingTrends({ data: { period: 'week', months: 3 } });

      expect(result).toHaveLength(1);
      expect(result[0]!.totalSpending).toBe(120);
    });

    it('returns empty array when no expenses in range', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockResolvedValue([] as never);

      const result = await getSpendingTrends({ data: { period: 'month', months: 6 } });

      expect(result).toEqual([]);
    });

    it('groups single expense into correct month', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockResolvedValue([
        {
          date: new Date('2026-01-15'),
          amount: 200,
          participants: [{ colleagueId: 1 }],
        },
      ] as never);

      const result = await getSpendingTrends({ data: { period: 'month', months: 12 } });

      expect(result).toHaveLength(1);
      expect(result[0]!.expenseCount).toBe(1);
      expect(result[0]!.averageExpenseAmount).toBe(200);
      expect(result[0]!.averageParticipantsPerExpense).toBe(1);
    });

    it('handles multiple expenses in same month with different participants', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockResolvedValue([
        {
          date: new Date('2026-03-10'),
          amount: 100,
          participants: [{ colleagueId: 1 }],
        },
        {
          date: new Date('2026-03-20'),
          amount: 150,
          participants: [{ colleagueId: 1 }, { colleagueId: 2 }, { colleagueId: 3 }],
        },
      ] as never);

      const result = await getSpendingTrends({ data: { period: 'month', months: 6 } });

      expect(result).toHaveLength(1);
      expect(result[0]!.totalSpending).toBe(250);
      expect(result[0]!.expenseCount).toBe(2);
      expect(result[0]!.uniqueParticipants).toBe(3);
      expect(result[0]!.averageParticipantsPerExpense).toBe(2); // (1+3)/2
    });

    it('groups expenses by month', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockResolvedValue([
        {
          date: new Date('2026-03-10'),
          amount: 200,
          participants: [{ colleagueId: 1 }],
        },
        {
          date: new Date('2026-04-15'),
          amount: 150,
          participants: [{ colleagueId: 1 }, { colleagueId: 2 }],
        },
      ] as never);

      const result = await getSpendingTrends({ data: { period: 'month', months: 6 } });

      expect(result).toHaveLength(2);
    });

    it('uses default period and months when input is empty', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockResolvedValue([
        {
          date: new Date('2026-05-04'),
          amount: 100,
          participants: [{ colleagueId: 1 }],
        },
      ] as never);

      const result = await getSpendingTrends({ data: {} });

      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
    });

    it('defaults period/months when data is undefined', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockResolvedValue([]);

      const result = await getSpendingTrends({ data: undefined });
      expect(result).toEqual([]);
    });

    it('throws infrastructure error on unexpected failure', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.findMany.mockRejectedValue(new Error('db failure'));

      await expect(getSpendingTrends({ data: { period: 'week', months: 3 } })).rejects.toThrow(
        'Failed to fetch spending trends'
      );
    });

    it('rethrows AppError without wrapping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'db not found');
      mockExpense.findMany.mockRejectedValue(appError);

      await expect(getSpendingTrends({ data: { period: 'week', months: 3 } })).rejects.toThrow(
        'db not found'
      );
    });
  });

  describe('getSpendingInsights', () => {
    it('returns empty data when not authenticated', async () => {
      mockGetAuth.mockResolvedValue(null);
      const result = await getSpendingInsights({ data: undefined });
      expect(result.summary.totalSpending).toBe(0);
      expect(result.restaurantStats).toEqual([]);
      expect(result.dayOfWeekStats).toEqual([]);
    });

    it('computes spending insights with day-of-week stats', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.aggregate.mockResolvedValue({
        _sum: { amount: 500 },
        _count: { id: 10 },
        _max: { amount: 120 },
      } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 30 } } as never);
      mockExpense.findFirst.mockResolvedValue({
        restaurant: { name: 'Expensive Place' },
      } as never);
      mockExpense.groupBy.mockResolvedValue([
        { restaurantId: 1, _sum: { amount: 300 }, _count: { id: 6 } },
      ] as never);
      mockExpense.findMany.mockResolvedValue([
        { date: new Date('2026-05-04'), amount: 50 }, // Monday
        { date: new Date('2026-05-04'), amount: 30 },
        { date: new Date('2026-05-02'), amount: 40 }, // Saturday
      ] as never);
      mockRestaurant.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Sushi Bar',
          createdAt: new Date(),
          address: null,
          cuisine: null,
          notes: null,
        },
      ] as never);

      const result = await getSpendingInsights({ data: undefined });

      expect(result.summary.totalSpending).toBe(500);
      expect(result.summary.averageExpenseAmount).toBe(50); // 500/10
      expect(result.summary.mostExpensiveAmount).toBe(120);
      expect(result.summary.mostExpensiveRestaurant).toBe('Expensive Place');
      expect(result.restaurantStats).toHaveLength(1);
      expect(result.restaurantStats[0]!.name).toBe('Sushi Bar');
      expect(result.dayOfWeekStats.length).toBeGreaterThan(0);
    });

    it('handles null amounts in aggregates', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: { id: 0 },
        _max: { amount: null },
      } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 0 } } as never);
      mockExpense.findFirst.mockResolvedValue(null);
      mockExpense.groupBy.mockResolvedValue([]);
      mockExpense.findMany.mockResolvedValue([]);

      const result = await getSpendingInsights({ data: undefined });
      expect(result.summary.totalSpending).toBe(0);
      expect(result.summary.mostExpensiveAmount).toBe(0);
      expect(result.summary.mostExpensiveRestaurant).toBe('N/A');
    });

    it('handles empty restaurant stats and zero totals', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
        _count: { id: 0 },
        _max: { amount: 0 },
      } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 0 } } as never);
      mockExpense.findFirst.mockResolvedValue(null);
      mockExpense.groupBy.mockResolvedValue([]);
      mockExpense.findMany.mockResolvedValue([]);

      const result = await getSpendingInsights({ data: undefined });
      expect(result.summary.averageExpenseAmount).toBe(0);
      expect(result.summary.averageParticipantsPerExpense).toBe(0);
      expect(result.restaurantStats).toEqual([]);
      expect(result.dayOfWeekStats).toEqual([]);
    });

    it('handles restaurant with null aggregate amount', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.aggregate.mockResolvedValue({
        _sum: { amount: 100 },
        _count: { id: 2 },
        _max: { amount: 60 },
      } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 4 } } as never);
      mockExpense.findFirst.mockResolvedValue({
        restaurant: { name: 'Some Place' },
      } as never);
      mockExpense.groupBy.mockResolvedValue([
        { restaurantId: 1, _sum: { amount: null }, _count: { id: 1 } },
      ] as never);
      mockExpense.findMany.mockResolvedValue([
        { date: new Date('2026-05-04'), amount: 60 },
      ] as never);
      mockRestaurant.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Known Place',
          createdAt: new Date(),
          address: null,
          cuisine: null,
          notes: null,
        },
      ] as never);

      const result = await getSpendingInsights({ data: undefined });
      expect(result.restaurantStats).toHaveLength(1);
      expect(result.restaurantStats[0]!.name).toBe('Known Place');
      expect(result.restaurantStats[0]!.total).toBe(0);
    });

    it('filters out null restaurant ids from restaurant stats', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.aggregate.mockResolvedValue({
        _sum: { amount: 100 },
        _count: { id: 2 },
        _max: { amount: 60 },
      } as never);
      mockParticipant.aggregate.mockResolvedValue({ _count: { _all: 4 } } as never);
      mockExpense.findFirst.mockResolvedValue({
        restaurant: { name: 'Some Place' },
      } as never);
      mockExpense.groupBy.mockResolvedValue([
        { restaurantId: 1, _sum: { amount: 60 }, _count: { id: 1 } },
        { restaurantId: null, _sum: { amount: 40 }, _count: { id: 1 } },
      ] as never);
      mockExpense.findMany.mockResolvedValue([
        { date: new Date('2026-05-04'), amount: 60 },
      ] as never);
      mockRestaurant.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Known Place',
          createdAt: new Date(),
          address: null,
          cuisine: null,
          notes: null,
        },
      ] as never);

      const result = await getSpendingInsights({ data: undefined });
      expect(result.restaurantStats).toHaveLength(2);
      expect(result.restaurantStats[0]!.name).toBe('Known Place');
      expect(result.restaurantStats[1]!.name).toBe('Unknown');
      expect(mockRestaurant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [1] } } })
      );
    });

    it('throws infrastructure error on unexpected failure', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      mockExpense.aggregate.mockRejectedValue(new Error('db failure'));

      await expect(getSpendingInsights({ data: undefined })).rejects.toThrow(
        'Failed to fetch spending insights'
      );
    });

    it('rethrows AppError without wrapping', async () => {
      mockGetAuth.mockResolvedValue({ isAdmin: true, permissions: [] });
      const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'db not found');
      mockExpense.aggregate.mockRejectedValue(appError);

      await expect(getSpendingInsights({ data: undefined })).rejects.toThrow('db not found');
    });
  });
});
