import { describe, expect, it } from 'vitest';
import { buildDashboardStats, emptyDashboardStats } from './stats-workflow';

describe('Stats Workflow', () => {
  describe('emptyDashboardStats', () => {
    it('returns all zeros', () => {
      const result = emptyDashboardStats();

      expect(result).toEqual({
        totalColleagues: 0,
        totalOutstanding: 0,
        totalCredit: 0,
        totalPayments: 0,
        netBalance: 0,
        activeColleagues: 0,
      });
    });
  });

  describe('buildDashboardStats', () => {
    it('computes netBalance as totalCredit minus totalOutstanding', () => {
      const result = buildDashboardStats({
        totalColleagues: 5,
        totalOutstanding: 300,
        totalCredit: 100,
        totalPayments: 12,
      });

      expect(result.netBalance).toBe(-200); // 100 - 300
      expect(result.totalColleagues).toBe(5);
      expect(result.totalOutstanding).toBe(300);
      expect(result.totalCredit).toBe(100);
      expect(result.totalPayments).toBe(12);
    });

    it('sets activeColleagues equal to totalColleagues', () => {
      const result = buildDashboardStats({
        totalColleagues: 10,
        totalOutstanding: 0,
        totalCredit: 0,
        totalPayments: 0,
      });

      expect(result.activeColleagues).toBe(10);
    });

    it('positive net balance when credit exceeds outstanding', () => {
      const result = buildDashboardStats({
        totalColleagues: 3,
        totalOutstanding: 50,
        totalCredit: 200,
        totalPayments: 5,
      });

      expect(result.netBalance).toBe(150);
    });

    it('zero net balance when balanced', () => {
      const result = buildDashboardStats({
        totalColleagues: 2,
        totalOutstanding: 100,
        totalCredit: 100,
        totalPayments: 4,
      });

      expect(result.netBalance).toBe(0);
    });

    it('handles all zeros', () => {
      const result = buildDashboardStats({
        totalColleagues: 0,
        totalOutstanding: 0,
        totalCredit: 0,
        totalPayments: 0,
      });

      expect(result).toEqual(emptyDashboardStats());
    });
  });
});
