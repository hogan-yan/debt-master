import { asMoneyMinor, MoneyMinor } from '@debtmaster/core';
import { describe, expect, it } from 'vitest';
import type { ColleagueBalance } from '../../balance-calculator';

const minorMap = (pairs: Array<[number, number]>): Map<number, MoneyMinor> =>
  new Map(pairs.map(([k, v]) => [k, asMoneyMinor(BigInt(v))]));

import {
  buildAmountMap,
  calculateBalancesFromMaps,
  calculateStatsFromBalances,
} from '../../balance-calculator';

describe('Balance Calculator', () => {
  describe('buildAmountMap', () => {
    it('builds map from entries with amounts (minor units)', () => {
      const entries = [
        { id: 1, amount: 100 },
        { id: 2, amount: 200 },
      ];

      const map = buildAmountMap(entries);

      expect(map.get(1)).toBe(10000n);
      expect(map.get(2)).toBe(20000n);
    });

    it('treats null amounts as zero', () => {
      const entries = [{ id: 1, amount: null }];

      const map = buildAmountMap(entries);

      expect(map.get(1)).toBe(0n);
    });

    it('handles empty array', () => {
      const map = buildAmountMap([]);

      expect(map.size).toBe(0);
    });

    it('converts Decimal-like values to number', () => {
      const entries = [{ id: 1, amount: 99.99 }];

      const map = buildAmountMap(entries);

      expect(map.get(1)).toBe(9999n);
    });
  });

  describe('calculateBalancesFromMaps', () => {
    it('calculates balance as paid minus owed', () => {
      const expenseMap = minorMap([[1, 10000]]);
      const paymentMap = minorMap([[1, 7000]]);

      const result = calculateBalancesFromMaps([1], expenseMap, paymentMap);

      expect(result).toEqual([
        { colleagueId: 1, totalOwed: 100, totalPaid: 70, currentBalance: -30 },
      ]);
    });

    it('defaults to zero for missing entries', () => {
      const expenseMap = minorMap([]);
      const paymentMap = minorMap([]);

      const result = calculateBalancesFromMaps([1], expenseMap, paymentMap);

      expect(result).toEqual([{ colleagueId: 1, totalOwed: 0, totalPaid: 0, currentBalance: 0 }]);
    });

    it('handles multiple colleagues', () => {
      const expenseMap = minorMap([
        [1, 10000],
        [2, 5000],
      ]);
      const paymentMap = minorMap([
        [1, 10000],
        [2, 2500],
      ]);

      const result = calculateBalancesFromMaps([1, 2], expenseMap, paymentMap);

      expect(result).toHaveLength(2);
      expect(result[0]!.currentBalance).toBe(0);
      expect(result[1]!.currentBalance).toBe(-25);
    });
  });

  describe('calculateStatsFromBalances', () => {
    it('sums outstanding and credit from balances', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 100, totalPaid: 50, currentBalance: -50 },
        { colleagueId: 2, totalOwed: 50, totalPaid: 100, currentBalance: 50 },
        { colleagueId: 3, totalOwed: 30, totalPaid: 30, currentBalance: 0 },
      ];

      const result = calculateStatsFromBalances(balances);

      expect(result.totalOutstanding).toBe(50);
      expect(result.totalCredit).toBe(50);
    });

    it('returns zeros for empty balances', () => {
      const result = calculateStatsFromBalances([]);

      expect(result).toEqual({ totalOutstanding: 0, totalCredit: 0 });
    });

    it('all negative: outstanding sum, no credit', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 100, totalPaid: 0, currentBalance: -100 },
        { colleagueId: 2, totalOwed: 200, totalPaid: 0, currentBalance: -200 },
      ];

      const result = calculateStatsFromBalances(balances);

      expect(result.totalOutstanding).toBe(300);
      expect(result.totalCredit).toBe(0);
    });

    it('all positive: credit sum, no outstanding', () => {
      const balances: ColleagueBalance[] = [
        { colleagueId: 1, totalOwed: 0, totalPaid: 100, currentBalance: 100 },
      ];

      const result = calculateStatsFromBalances(balances);

      expect(result.totalOutstanding).toBe(0);
      expect(result.totalCredit).toBe(100);
    });
  });
});
