import { describe, expect, it } from 'vitest';
import type { ColleagueWithBalance } from '../types';
import {
  buildColleagueWithBalance,
  filterOwingColleagues,
  transformPendingPayments,
} from './colleagues-workflow';

const mockFormatDaysAgo = (date: Date | string): string => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  return diff === 0 ? 'Today' : `${diff} days ago`;
};

describe('Colleagues Workflow', () => {
  describe('buildColleagueWithBalance', () => {
    const colleague = { id: 1, name: 'Alice', createdAt: new Date('2024-01-01') };

    it('builds colleague with balance and both dates', () => {
      const result = buildColleagueWithBalance(
        colleague,
        { currentBalance: -50, totalOwed: 50, totalPaid: 0 },
        new Date('2024-06-15'),
        new Date('2024-06-10'),
        mockFormatDaysAgo
      );

      expect(result.id).toBe(1);
      expect(result.name).toBe('Alice');
      expect(result.currentBalance).toBe(-50);
      expect(result.totalOwed).toBe(50);
      expect(result.totalPaid).toBe(0);
      expect(result.lastActivity).toBeTruthy();
    });

    it('defaults to zero balance when no balance provided', () => {
      const result = buildColleagueWithBalance(
        colleague,
        undefined,
        undefined,
        undefined,
        mockFormatDaysAgo
      );

      expect(result.currentBalance).toBe(0);
      expect(result.totalOwed).toBe(0);
      expect(result.totalPaid).toBe(0);
      expect(result.lastActivity).toBe('No recent activity');
    });

    it('uses expense date when only expense exists', () => {
      const result = buildColleagueWithBalance(
        colleague,
        { currentBalance: 0, totalOwed: 0, totalPaid: 0 },
        new Date('2024-06-10'),
        undefined,
        mockFormatDaysAgo
      );

      expect(result.lastActivity).not.toBe('No recent activity');
    });

    it('uses payment date when only payment exists', () => {
      const result = buildColleagueWithBalance(
        colleague,
        { currentBalance: 0, totalOwed: 0, totalPaid: 0 },
        undefined,
        new Date('2024-06-10'),
        mockFormatDaysAgo
      );

      expect(result.lastActivity).not.toBe('No recent activity');
    });

    it('picks the more recent of expense and payment dates', () => {
      const result = buildColleagueWithBalance(
        colleague,
        { currentBalance: 0, totalOwed: 0, totalPaid: 0 },
        new Date('2024-06-10'),
        new Date('2024-06-15'),
        mockFormatDaysAgo
      );

      expect(result.lastActivity).not.toBe('No recent activity');
    });
  });

  describe('filterOwingColleagues', () => {
    it('filters to negative-balance colleagues sorted by most debt first', () => {
      const colleagues: ColleagueWithBalance[] = [
        {
          id: 1,
          name: 'Alice',
          currentBalance: -50,
          totalOwed: 50,
          totalPaid: 0,
          lastActivity: '',
        },
        {
          id: 2,
          name: 'Bob',
          currentBalance: -200,
          totalOwed: 200,
          totalPaid: 0,
          lastActivity: '',
        },
        {
          id: 3,
          name: 'Carol',
          currentBalance: 100,
          totalOwed: 0,
          totalPaid: 100,
          lastActivity: '',
        },
        { id: 4, name: 'Dave', currentBalance: 0, totalOwed: 0, totalPaid: 0, lastActivity: '' },
      ];

      const result = filterOwingColleagues(colleagues);

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe(2); // -200 first
      expect(result[1]!.id).toBe(1); // -50 second
    });

    it('includes genuinely owing colleagues regardless of magnitude', () => {
      const colleagues: ColleagueWithBalance[] = [
        {
          id: 1,
          name: 'Alice',
          currentBalance: -0.01,
          totalOwed: 0.01,
          totalPaid: 0,
          lastActivity: '',
        },
      ];

      const result = filterOwingColleagues(colleagues);

      expect(result).toHaveLength(1);
      expect(result[0]!.currentBalance).toBe(-0.01);
    });

    it('returns empty for no colleagues', () => {
      expect(filterOwingColleagues([])).toEqual([]);
    });

    it('returns empty when all have positive or zero balance', () => {
      const colleagues: ColleagueWithBalance[] = [
        {
          id: 1,
          name: 'Alice',
          currentBalance: 100,
          totalOwed: 0,
          totalPaid: 100,
          lastActivity: '',
        },
        { id: 2, name: 'Bob', currentBalance: 0, totalOwed: 0, totalPaid: 0, lastActivity: '' },
      ];

      expect(filterOwingColleagues(colleagues)).toEqual([]);
    });
  });

  describe('transformPendingPayments', () => {
    it('transforms raw payments to pending payment format', () => {
      const payments = [
        {
          id: 1,
          amount: 50,
          date: new Date('2024-06-15'),
          colleague: { name: 'Alice' },
          restaurant: { name: 'Pizza Place' },
          submittedAt: new Date('2024-06-14T10:00:00Z'),
          paymentType: 'CASH',
        },
      ];

      const result = transformPendingPayments(payments);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        amount: 50,
        date: '2024-06-15',
        colleague: 'Alice',
        restaurant: 'Pizza Place',
        submittedAt: '2024-06-14T10:00:00.000Z',
        paymentType: 'CASH',
      });
    });

    it('handles missing optional fields', () => {
      const payments = [
        {
          id: 2,
          amount: 30,
          date: new Date('2024-06-15'),
          colleague: null,
          restaurant: null,
          submittedAt: null,
          paymentType: 'TRANSFER',
        },
      ];

      const result = transformPendingPayments(payments);

      expect(result[0]!.colleague).toBe('Unknown');
      expect(result[0]!.restaurant).toBeUndefined();
      expect(result[0]!.submittedAt).toBeUndefined();
    });

    it('returns empty for no payments', () => {
      expect(transformPendingPayments([])).toEqual([]);
    });
  });
});
