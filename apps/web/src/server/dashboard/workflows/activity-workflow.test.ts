import { describe, expect, it } from 'vitest';
import type { RecentActivity } from '../types';
import {
  mergeAndSortActivities,
  transformExpensesToActivities,
  transformPaymentsToActivities,
} from './activity-workflow';

describe('Activity Workflow', () => {
  describe('transformExpensesToActivities', () => {
    it('maps expense fields to activity format', () => {
      const expenses = [
        {
          id: 1,
          amount: 50.0,
          date: new Date('2024-06-15'),
          restaurant: { name: 'Pizza Place' },
        },
      ];

      const result = transformExpensesToActivities(expenses);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        type: 'expense',
        description: 'Expense at Pizza Place',
        amount: 50,
        date: '2024-06-15',
        restaurant: 'Pizza Place',
      });
    });

    it('handles missing restaurant name', () => {
      const expenses = [{ id: 2, amount: 30, date: new Date('2024-06-10'), restaurant: null }];

      const result = transformExpensesToActivities(expenses);

      expect(result[0]!.description).toBe('Expense at Unknown Restaurant');
      expect(result[0]!.restaurant).toBeUndefined();
    });

    it('handles null restaurant name property', () => {
      const expenses = [
        { id: 3, amount: 20, date: new Date('2024-06-10'), restaurant: { name: null } },
      ];

      const result = transformExpensesToActivities(expenses);

      expect(result[0]!.description).toBe('Expense at Unknown Restaurant');
    });

    it('converts Decimal amounts to number', () => {
      const expenses = [
        { id: 4, amount: 99.99, date: new Date('2024-06-10'), restaurant: { name: 'Test' } },
      ];

      const result = transformExpensesToActivities(expenses);

      expect(result[0]!.amount).toBe(99.99);
      expect(typeof result[0]!.amount).toBe('number');
    });

    it('returns empty array for no expenses', () => {
      expect(transformExpensesToActivities([])).toEqual([]);
    });
  });

  describe('transformPaymentsToActivities', () => {
    it('maps payment fields to activity format', () => {
      const payments = [
        {
          id: 10,
          amount: 25,
          date: new Date('2024-06-14'),
          colleague: { name: 'Alice' },
          restaurant: { name: 'Burger Joint' },
        },
      ];

      const result = transformPaymentsToActivities(payments);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 10,
        type: 'payment',
        description: 'Alice paid',
        amount: 25,
        date: '2024-06-14',
        colleague: 'Alice',
        restaurant: 'Burger Joint',
      });
    });

    it('omits restaurant when null', () => {
      const payments = [
        {
          id: 11,
          amount: 10,
          date: new Date('2024-06-14'),
          colleague: { name: 'Bob' },
          restaurant: null,
        },
      ];

      const result = transformPaymentsToActivities(payments);

      expect(result[0]!.restaurant).toBeUndefined();
    });

    it('handles missing colleague name', () => {
      const payments = [
        { id: 12, amount: 10, date: new Date('2024-06-14'), colleague: null, restaurant: null },
      ];

      const result = transformPaymentsToActivities(payments);

      expect(result[0]!.description).toBe('Unknown paid');
      expect(result[0]!.colleague).toBeUndefined();
    });

    it('returns empty array for no payments', () => {
      expect(transformPaymentsToActivities([])).toEqual([]);
    });
  });

  describe('mergeAndSortActivities', () => {
    it('combines and sorts by date descending', () => {
      const expenses: RecentActivity[] = [
        { id: 1, type: 'expense', description: 'A', amount: 10, date: '2024-06-10' },
        { id: 2, type: 'expense', description: 'B', amount: 20, date: '2024-06-15' },
      ];
      const payments: RecentActivity[] = [
        { id: 3, type: 'payment', description: 'C', amount: 30, date: '2024-06-12' },
      ];

      const result = mergeAndSortActivities(expenses, payments, 10);

      expect(result.map((r) => r.id)).toEqual([2, 3, 1]);
    });

    it('respects limit parameter', () => {
      const activities: RecentActivity[] = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        type: 'expense' as const,
        description: `Item ${i}`,
        amount: i,
        date: `2024-06-${String(i + 1).padStart(2, '0')}`,
      }));

      const result = mergeAndSortActivities(activities, [], 5);

      expect(result).toHaveLength(5);
    });

    it('returns empty when both inputs empty', () => {
      expect(mergeAndSortActivities([], [], 10)).toEqual([]);
    });

    it('handles same-date entries', () => {
      const expenses: RecentActivity[] = [
        { id: 1, type: 'expense', description: 'A', amount: 10, date: '2024-06-15' },
      ];
      const payments: RecentActivity[] = [
        { id: 2, type: 'payment', description: 'B', amount: 20, date: '2024-06-15' },
      ];

      const result = mergeAndSortActivities(expenses, payments, 10);

      expect(result).toHaveLength(2);
    });
  });
});
