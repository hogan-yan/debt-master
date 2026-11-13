// minor-unit helper: cents → MoneyMinor-sized bigint
import { asMoneyMinor, MoneyMinor } from '@debtmaster/core';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const M = (cents: number): MoneyMinor => asMoneyMinor(BigInt(cents));

import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';
import {
  buildAmountMap,
  type ColleagueBalance,
  calculateBalancesFromMaps,
  calculateStatsFromBalances,
} from './balance-calculator';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    colleague: {
      findMany: vi.fn(),
    },
    expenseParticipant: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    payment: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
}));

vi.mock('@/utils/errors', async () => {
  const { AppError, ErrorCode, isAppError } = await import('@/utils/errors');
  return { AppError, ErrorCode, isAppError };
});

import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode } from '@/utils/errors';
import {
  calculateAllColleagueBalances,
  calculateColleagueBalance,
  calculateInactiveColleagueBalances,
  getColleagueStatsFromCalculatedBalances,
} from './balance-calculator';

type ServerFn = (ctx: { data: unknown }) => Promise<unknown>;

/**
 * Helper function to safely access array elements in tests.
 * Throws an error if the element is undefined to satisfy TypeScript's noUncheckedIndexedAccess.
 */
function expectElement<T>(arr: T[], index: number): T {
  const element = arr[index];
  if (element === undefined) {
    throw new Error(`Expected array to have element at index ${index}, but it was undefined`);
  }
  return element;
}

/**
 * Balance Calculator Logic Tests
 *
 * Tests the actual exported pure functions from balance-calculator.ts.
 * These functions were extracted from createServerFn handlers to be testable.
 */

describe('balance-calculator - Core Logic', () => {
  describe('buildAmountMap', () => {
    it('should build a map from valid entries (exact minor units)', () => {
      const { Decimal } = Prisma;
      const entries = [
        { id: 1, amount: new Decimal('25.50') },
        { id: 2, amount: new Decimal('0.01') },
      ];

      const map = buildAmountMap(entries);

      expect(map.get(1)).toBe(2550n);
      expect(map.get(2)).toBe(1n);
    });

    it('should handle empty entries', () => {
      const map = buildAmountMap([]);
      expect(map.size).toBe(0);
    });

    it('should handle Decimal-like string amounts', () => {
      const entries = [{ id: 1, amount: '99.99' as unknown as Prisma.Decimal }];

      const map = buildAmountMap(entries);

      expect(map.get(1)).toBe(9999n);
    });

    it('should handle zero amounts', () => {
      const entries = [{ id: 1, amount: 0 }];

      const map = buildAmountMap(entries);
      expect(map.get(1)).toBe(0n);
    });

    it('should handle null amounts', () => {
      const entries = [{ id: 1, amount: null }];

      const map = buildAmountMap(entries);
      expect(map.get(1)).toBe(0n);
    });
  });

  describe('calculateBalancesFromMaps', () => {
    it('should calculate balances for multiple colleagues', () => {
      const colleagueIds = [1, 2, 3];
      const expenseMap = new Map([
        [1, M(10000)],
        [2, M(5000)],
      ]);
      const paymentMap = new Map([
        [1, M(8000)],
        [3, M(20000)],
      ]);

      const balances = calculateBalancesFromMaps(colleagueIds, expenseMap, paymentMap);

      expect(balances).toHaveLength(3);
      expect(balances[0]).toEqual({
        colleagueId: 1,
        totalOwed: 100,
        totalPaid: 80,
        currentBalance: -20,
      });
      expect(balances[1]).toEqual({
        colleagueId: 2,
        totalOwed: 50,
        totalPaid: 0,
        currentBalance: -50,
      });
      expect(balances[2]).toEqual({
        colleagueId: 3,
        totalOwed: 0,
        totalPaid: 200,
        currentBalance: 200,
      });
    });

    it('should handle empty colleague list', () => {
      const balances = calculateBalancesFromMaps([], new Map(), new Map());
      expect(balances).toEqual([]);
    });

    it('should handle colleagues with no activity', () => {
      const balances = calculateBalancesFromMaps([1, 2], new Map(), new Map());

      expect(balances).toEqual([
        { colleagueId: 1, totalOwed: 0, totalPaid: 0, currentBalance: 0 },
        { colleagueId: 2, totalOwed: 0, totalPaid: 0, currentBalance: 0 },
      ]);
    });

    it('should calculate positive balance (credit): owes $100, paid $150 = +$50', () => {
      const balances = calculateBalancesFromMaps(
        [1],
        new Map([[1, M(10000)]]),
        new Map([[1, M(15000)]])
      );

      expect(expectElement(balances, 0).currentBalance).toBe(50);
    });

    it('should calculate negative balance (debt): owes $200, paid $50 = -$150', () => {
      const balances = calculateBalancesFromMaps(
        [1],
        new Map([[1, M(20000)]]),
        new Map([[1, M(5000)]])
      );

      expect(expectElement(balances, 0).currentBalance).toBe(-150);
    });

    it('should calculate zero balance: owes $100, paid $100 = $0', () => {
      const balances = calculateBalancesFromMaps(
        [1],
        new Map([[1, M(10000)]]),
        new Map([[1, M(10000)]])
      );

      expect(expectElement(balances, 0).currentBalance).toBe(0);
    });

    it('should handle no expenses (totalOwed = 0)', () => {
      const balances = calculateBalancesFromMaps([1], new Map(), new Map([[1, M(5000)]]));

      expect(balances[0]).toEqual({
        colleagueId: 1,
        totalOwed: 0,
        totalPaid: 50,
        currentBalance: 50,
      });
    });

    it('should handle colleague ids missing from both maps', () => {
      const balances = calculateBalancesFromMaps([7], new Map([[9, M(1000)]]), new Map());

      expect(balances[0]).toEqual({
        colleagueId: 7,
        totalOwed: 0,
        totalPaid: 0,
        currentBalance: 0,
      });
    });

    it('sums stay exact in minor units for indivisible major amounts', () => {
      // 3-way split of $100: 33.34 + 33.33 + 33.33 = 100.00 exactly in cents
      const expenseMap = new Map([
        [1, M(3334)],
        [2, M(3333)],
        [3, M(3333)],
      ]);
      const balances = calculateBalancesFromMaps([1, 2, 3], expenseMap, new Map());
      const sum = balances.reduce((acc, b) => acc + b.totalOwed, 0);
      expect(sum).toBe(100);
    });
  });

  describe('calculateStatsFromBalances', () => {
    it('should calculate total outstanding and credit across all colleagues', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 100, totalPaid: 50, currentBalance: -50 },
        { colleagueId: 2, totalOwed: 50, totalPaid: 0, currentBalance: -50 },
        { colleagueId: 3, totalOwed: 0, totalPaid: 200, currentBalance: 200 },
      ];

      const stats = calculateStatsFromBalances(balances);

      expect(stats.totalOutstanding).toBe(100); // 50 + 50
      expect(stats.totalCredit).toBe(200);
    });

    it('should handle all balanced colleagues', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 100, totalPaid: 100, currentBalance: 0 },
        { colleagueId: 2, totalOwed: 100, totalPaid: 100, currentBalance: 0 },
      ];

      const stats = calculateStatsFromBalances(balances);

      expect(stats.totalOutstanding).toBe(0);
      expect(stats.totalCredit).toBe(0);
    });

    it('should handle all owing money', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 100, totalPaid: 0, currentBalance: -100 },
        { colleagueId: 2, totalOwed: 200, totalPaid: 0, currentBalance: -200 },
      ];

      const stats = calculateStatsFromBalances(balances);

      expect(stats.totalOutstanding).toBe(300);
      expect(stats.totalCredit).toBe(0);
    });

    it('should handle all with credit', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 0, totalPaid: 100, currentBalance: 100 },
        { colleagueId: 2, totalOwed: 0, totalPaid: 200, currentBalance: 200 },
      ];

      const stats = calculateStatsFromBalances(balances);

      expect(stats.totalOutstanding).toBe(0);
      expect(stats.totalCredit).toBe(300);
    });

    it('should handle empty balances', () => {
      const stats = calculateStatsFromBalances([]);

      expect(stats.totalOutstanding).toBe(0);
      expect(stats.totalCredit).toBe(0);
    });

    it('should handle mixed positive and negative balances', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 0, totalPaid: 0, currentBalance: -100 },
        { colleagueId: 2, totalOwed: 0, totalPaid: 0, currentBalance: 50 },
        { colleagueId: 3, totalOwed: 0, totalPaid: 0, currentBalance: -25 },
        { colleagueId: 4, totalOwed: 0, totalPaid: 0, currentBalance: 75 },
        { colleagueId: 5, totalOwed: 0, totalPaid: 0, currentBalance: 0 },
      ];

      const stats = calculateStatsFromBalances(balances);

      expect(stats.totalOutstanding).toBe(125); // 100 + 25
      expect(stats.totalCredit).toBe(125); // 50 + 75
    });
  });

  describe('Edge Cases', () => {
    it('should handle decimal amounts correctly (minor units)', () => {
      const balances = calculateBalancesFromMaps(
        [1],
        new Map([[1, M(9999)]]),
        new Map([[1, M(10001)]])
      );

      expect(expectElement(balances, 0).currentBalance).toBeCloseTo(0.02, 2);
    });

    it('should handle very large amounts', () => {
      const balances = calculateBalancesFromMaps(
        [1],
        new Map([[1, M(100000000)]]),
        new Map([[1, M(50000000)]])
      );

      expect(expectElement(balances, 0).currentBalance).toBe(-500000);
    });

    it('should handle very small amounts', () => {
      const balances = calculateBalancesFromMaps([1], new Map([[1, M(1)]]), new Map([[1, M(2)]]));

      expect(expectElement(balances, 0).currentBalance).toBe(0.01);
    });

    it('should handle negative zero edge case', () => {
      const balances = calculateBalancesFromMaps([1], new Map([[1, M(0)]]), new Map([[1, M(0)]]));

      expect(expectElement(balances, 0).currentBalance).toBe(0);
      expect(Object.is(expectElement(balances, 0).currentBalance, 0)).toBe(true);
    });

    it('should handle single colleague scenarios', () => {
      const balances = calculateBalancesFromMaps(
        [1],
        new Map([[1, M(5000)]]),
        new Map([[1, M(10000)]])
      );

      expect(balances).toHaveLength(1);
      expect(expectElement(balances, 0).currentBalance).toBe(50);
    });
  });
});

// Server function tests
describe('balance-calculator - Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateColleagueBalance', () => {
    beforeEach(() => {
      vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    });

    it('calculates balance with both sums present', async () => {
      vi.mocked(prisma.expenseParticipant.aggregate).mockResolvedValue({
        _sum: { amount: BigInt(20000) },
      } as never);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({
        _sum: { amount: BigInt(15000) },
      } as never);

      const result = await (calculateColleagueBalance as ServerFn)({ data: { colleagueId: 1 } });

      expect(result).toEqual({
        colleagueId: 1,
        totalOwed: 200,
        totalPaid: 150,
        currentBalance: -50,
      });
    });

    it('handles null expense sum', async () => {
      vi.mocked(prisma.expenseParticipant.aggregate).mockResolvedValue({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({
        _sum: { amount: BigInt(10000) },
      } as never);

      const result = await (calculateColleagueBalance as ServerFn)({ data: { colleagueId: 1 } });

      expect(result).toEqual(
        expect.objectContaining({ totalOwed: 0, totalPaid: 100, currentBalance: 100 })
      );
    });

    it('handles null payment sum', async () => {
      vi.mocked(prisma.expenseParticipant.aggregate).mockResolvedValue({
        _sum: { amount: BigInt(8000) },
      } as never);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({
        _sum: { amount: null },
      } as never);

      const result = await (calculateColleagueBalance as ServerFn)({ data: { colleagueId: 1 } });

      expect(result).toEqual(
        expect.objectContaining({ totalOwed: 80, totalPaid: 0, currentBalance: -80 })
      );
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      vi.mocked(prisma.expenseParticipant.aggregate).mockRejectedValue(appErr);

      await expect(
        (calculateColleagueBalance as ServerFn)({ data: { colleagueId: 1 } })
      ).rejects.toBe(appErr);
    });

    it('wraps generic error', async () => {
      vi.mocked(prisma.expenseParticipant.aggregate).mockRejectedValue(new Error('db down'));

      await expect(
        (calculateColleagueBalance as ServerFn)({ data: { colleagueId: 1 } })
      ).rejects.toThrow('Failed to calculate colleague balance');
    });
  });

  describe('calculateAllColleagueBalances', () => {
    it('returns empty array when unauthenticated', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue(null);

      const result = await (calculateAllColleagueBalances as ServerFn)({ data: {} });

      expect(result).toEqual([]);
    });

    it('calculates balances for authenticated user', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
      vi.mocked(prisma.expenseParticipant.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: BigInt(10000) } },
      ] as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: BigInt(8000) } },
      ] as never);

      const result = await (calculateAllColleagueBalances as ServerFn)({ data: {} });

      expect(result).toHaveLength(2);
    });

    it('treats null grouped amounts as zero', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockResolvedValue([{ id: 1 }] as never);
      vi.mocked(prisma.expenseParticipant.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: null } },
      ] as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: null } },
      ] as never);

      await expect((calculateAllColleagueBalances as ServerFn)({ data: {} })).resolves.toEqual([
        { colleagueId: 1, totalOwed: 0, totalPaid: 0, currentBalance: 0 },
      ]);
    });

    it('rethrows AppError as-is', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      vi.mocked(prisma.colleague.findMany).mockRejectedValue(appErr);

      await expect((calculateAllColleagueBalances as ServerFn)({ data: {} })).rejects.toBe(appErr);
    });

    it('wraps generic error', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockRejectedValue(new Error('db down'));

      await expect((calculateAllColleagueBalances as ServerFn)({ data: {} })).rejects.toThrow(
        'Failed to calculate all colleague balances'
      );
    });
  });

  describe('calculateInactiveColleagueBalances', () => {
    it('returns empty array when unauthenticated', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue(null);

      const result = await (calculateInactiveColleagueBalances as ServerFn)({ data: {} });

      expect(result).toEqual([]);
    });

    it('calculates balances for inactive colleagues', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockResolvedValue([{ id: 5 }] as never);
      vi.mocked(prisma.expenseParticipant.groupBy).mockResolvedValue([] as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);

      const result = await (calculateInactiveColleagueBalances as ServerFn)({ data: {} });

      expect(result).toHaveLength(1);
    });

    it('treats null inactive grouped amounts as zero', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockResolvedValue([{ id: 5 }] as never);
      vi.mocked(prisma.expenseParticipant.groupBy).mockResolvedValue([
        { colleagueId: 5, _sum: { amount: null } },
      ] as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([
        { colleagueId: 5, _sum: { amount: null } },
      ] as never);

      await expect((calculateInactiveColleagueBalances as ServerFn)({ data: {} })).resolves.toEqual(
        [{ colleagueId: 5, totalOwed: 0, totalPaid: 0, currentBalance: 0 }]
      );
    });

    it('converts inactive grouped amounts when they are present', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockResolvedValue([{ id: 5 }] as never);
      vi.mocked(prisma.expenseParticipant.groupBy).mockResolvedValue([
        { colleagueId: 5, _sum: { amount: BigInt(5000) } },
      ] as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([
        { colleagueId: 5, _sum: { amount: BigInt(7500) } },
      ] as never);

      await expect((calculateInactiveColleagueBalances as ServerFn)({ data: {} })).resolves.toEqual(
        [{ colleagueId: 5, totalOwed: 50, totalPaid: 75, currentBalance: 25 }]
      );
    });

    it('rethrows AppError as-is', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      vi.mocked(prisma.colleague.findMany).mockRejectedValue(appErr);

      await expect((calculateInactiveColleagueBalances as ServerFn)({ data: {} })).rejects.toBe(
        appErr
      );
    });

    it('wraps generic error', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockRejectedValue(new Error('db down'));

      await expect((calculateInactiveColleagueBalances as ServerFn)({ data: {} })).rejects.toThrow(
        'Failed to calculate inactive colleague balances'
      );
    });
  });

  describe('getColleagueStatsFromCalculatedBalances', () => {
    it('returns zeros when unauthenticated', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue(null);

      const result = await (getColleagueStatsFromCalculatedBalances as ServerFn)({ data: {} });

      expect(result).toEqual({
        totalColleagues: 0,
        totalOutstanding: 0,
        totalCredit: 0,
        totalPayments: 0,
      });
    });

    it('calculates stats for authenticated user', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
      vi.mocked(prisma.expenseParticipant.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: BigInt(10000) } },
      ] as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: BigInt(8000) }, _count: { id: 3 } },
      ] as never);

      const result = (await (getColleagueStatsFromCalculatedBalances as ServerFn)({
        data: {},
      })) as {
        totalColleagues: number;
        totalPayments: number;
        totalOutstanding: number;
        totalCredit: number;
      };

      expect(result.totalColleagues).toBe(2);
      expect(result.totalPayments).toBe(3);
    });

    it('treats null grouped amounts as zero in statistics', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockResolvedValue([{ id: 1 }] as never);
      vi.mocked(prisma.expenseParticipant.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: null } },
      ] as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([
        { colleagueId: 1, _sum: { amount: null }, _count: { id: 0 } },
      ] as never);

      await expect(
        (getColleagueStatsFromCalculatedBalances as ServerFn)({ data: {} })
      ).resolves.toMatchObject({ totalOutstanding: 0, totalCredit: 0, totalPayments: 0 });
    });

    it('rethrows AppError as-is', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      vi.mocked(prisma.colleague.findMany).mockRejectedValue(appErr);

      await expect(
        (getColleagueStatsFromCalculatedBalances as ServerFn)({ data: {} })
      ).rejects.toBe(appErr);
    });

    it('wraps generic error', async () => {
      vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.colleague.findMany).mockRejectedValue(new Error('db down'));

      await expect(
        (getColleagueStatsFromCalculatedBalances as ServerFn)({ data: {} })
      ).rejects.toThrow('Failed to calculate colleague statistics');
    });
  });
});
