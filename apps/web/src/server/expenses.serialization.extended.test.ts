import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { ExpenseWithRelations } from './expenses';
import { serializeExpense } from './expenses';

/**
 * Helper function to safely access array elements in tests.
 */
function expectElement<T>(arr: T[], index: number): T {
  const element = arr[index];
  if (element === undefined) {
    throw new Error(`Expected array to have element at index ${index}, but it was undefined`);
  }
  return element;
}

describe('serializeExpense - Extended Coverage', () => {
  const baseMockExpense = (): ExpenseWithRelations =>
    ({
      id: 1,
      date: new Date('2024-01-15'),
      amount: new Prisma.Decimal('100.00'),
      splitType: 'EQUAL',
      receiptObjectKey: null,
      receiptBucket: null,
      restaurantId: 1,
      createdAt: new Date(),
      createdBy: null,
      notes: null,
      restaurant: {
        id: 1,
        name: 'Test Restaurant',
        address: null,
        cuisine: null,
        notes: null,
        createdAt: new Date(),
      },
      participants: [],
      items: [],
    }) as ExpenseWithRelations;

  describe('Edge Cases', () => {
    it('handles very large amounts', () => {
      const expense = baseMockExpense();
      expense.amount = new Prisma.Decimal('999999.99');

      const result = serializeExpense(expense);

      expect(result.amount).toBe(999999.99);
    });

    it('handles very small amounts', () => {
      const expense = baseMockExpense();
      expense.amount = new Prisma.Decimal('0.01');

      const result = serializeExpense(expense);

      expect(result.amount).toBe(0.01);
    });

    it('handles undefined paymentApplications gracefully', () => {
      const expense = baseMockExpense();
      expense.participants = [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          paymentApplications: undefined,
          colleague: {
            id: 1,
            name: 'Alice',
            deletedAt: null,
            deletedBy: null,
          },
        } as unknown as ExpenseWithRelations['participants'][number],
      ];

      const result = serializeExpense(expense);

      expect(expectElement(result.participants, 0).totalPaid).toBe(0);
    });

    it('handles empty paymentApplications array', () => {
      const expense = baseMockExpense();
      expense.participants = [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          paymentApplications: [],
          colleague: {
            id: 1,
            name: 'Bob',
            deletedAt: null,
            deletedBy: null,
          },
        } as unknown as ExpenseWithRelations['participants'][number],
      ];

      const result = serializeExpense(expense);

      expect(expectElement(result.participants, 0).totalPaid).toBe(0);
    });

    it('handles participant with null colleague', () => {
      const expense = baseMockExpense();
      expense.participants = [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          paymentApplications: [],
          colleague: null as null,
        } as unknown as ExpenseWithRelations['participants'][number],
      ];

      const result = serializeExpense(expense);

      expect(expectElement(result.participants, 0).colleague).toBeUndefined();
    });

    it('handles item with null colleague', () => {
      const expense = baseMockExpense();
      expense.items = [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          name: 'Burger',
          price: new Prisma.Decimal('15.99'),
          colleague: null as null,
        } as unknown as ExpenseWithRelations['items'][number],
      ];

      const result = serializeExpense(expense);

      expect(expectElement(result.items, 0).colleague).toBeUndefined();
    });

    it('handles multiple payments with different approval statuses', () => {
      const expense = baseMockExpense();
      expense.participants = [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('100.00'),
          paymentApplications: [
            {
              id: 1,
              paymentId: 1,
              participantId: 1,
              expenseId: 1,
              amount: new Prisma.Decimal('30.00'),
              appliedAt: new Date(),
              createdAt: new Date(),
              payment: {
                id: 1,
                colleagueId: 1,
                amount: new Prisma.Decimal('30.00'),
                date: new Date(),
                paymentType: 'PARTIAL',
                receiptObjectKey: null,
                receiptBucket: null,
                paymentProofObjectKey: null,
                paymentProofBucket: null,
                isApproved: true,
                submittedAt: null,
                createdAt: new Date(),
                createdBy: null,
                expenseId: null,
                restaurantId: null,
              },
            },
            {
              id: 2,
              paymentId: 2,
              participantId: 1,
              expenseId: 1,
              amount: new Prisma.Decimal('20.00'),
              appliedAt: new Date(),
              createdAt: new Date(),
              payment: {
                id: 2,
                colleagueId: 1,
                amount: new Prisma.Decimal('20.00'),
                date: new Date(),
                paymentType: 'PARTIAL',
                receiptObjectKey: null,
                receiptBucket: null,
                paymentProofObjectKey: null,
                paymentProofBucket: null,
                isApproved: false,
                submittedAt: null,
                createdAt: new Date(),
                createdBy: null,
                expenseId: null,
                restaurantId: null,
              },
            },
          ],
          colleague: {
            id: 1,
            name: 'Charlie',
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
          },
        },
      ];

      const result = serializeExpense(expense);

      // Only the approved $30 should count
      expect(expectElement(result.participants, 0).totalPaid).toBe(30);
      expect(expectElement(result.participants, 0).remainingOwed).toBe(70);
      expect(expectElement(result.participants, 0).isPaid).toBe(false);
    });

    it('sorts payment applications by date correctly', () => {
      const expense = baseMockExpense();
      const olderDate = new Date('2024-01-01');
      const newerDate = new Date('2024-01-15');

      expense.participants = [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('100.00'),
          paymentApplications: [
            {
              id: 1,
              paymentId: 1,
              participantId: 1,
              expenseId: 1,
              amount: new Prisma.Decimal('50.00'),
              appliedAt: olderDate,
              createdAt: new Date(),
              payment: {
                id: 1,
                colleagueId: 1,
                amount: new Prisma.Decimal('50.00'),
                date: new Date(),
                paymentType: 'FULL',
                receiptObjectKey: null,
                receiptBucket: null,
                paymentProofObjectKey: null,
                paymentProofBucket: null,
                isApproved: true,
                submittedAt: null,
                createdAt: new Date(),
                createdBy: null,
                expenseId: null,
                restaurantId: null,
              },
            },
            {
              id: 2,
              paymentId: 2,
              participantId: 1,
              expenseId: 1,
              amount: new Prisma.Decimal('50.00'),
              appliedAt: newerDate,
              createdAt: new Date(),
              payment: {
                id: 2,
                colleagueId: 1,
                amount: new Prisma.Decimal('50.00'),
                date: new Date(),
                paymentType: 'FULL',
                receiptObjectKey: null,
                receiptBucket: null,
                paymentProofObjectKey: null,
                paymentProofBucket: null,
                isApproved: true,
                submittedAt: null,
                createdAt: new Date(),
                createdBy: null,
                expenseId: null,
                restaurantId: null,
              },
            },
          ],
          colleague: {
            id: 1,
            name: 'Dave',
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
          },
        },
      ];

      const result = serializeExpense(expense);

      // submittedAt should be the newer date
      expect(expectElement(result.participants, 0).submittedAt).toEqual(newerDate);
    });
  });

  describe('Decimal Handling', () => {
    it('handles Decimal in payment application amounts', () => {
      const expense = baseMockExpense();
      expense.participants = [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('33.33'),
          paymentApplications: [
            {
              id: 1,
              paymentId: 1,
              participantId: 1,
              expenseId: 1,
              amount: new Prisma.Decimal('33.33'),
              appliedAt: new Date(),
              createdAt: new Date(),
              payment: {
                id: 1,
                colleagueId: 1,
                amount: new Prisma.Decimal('33.33'),
                date: new Date(),
                paymentType: 'FULL',
                receiptObjectKey: null,
                receiptBucket: null,
                paymentProofObjectKey: null,
                paymentProofBucket: null,
                isApproved: true,
                submittedAt: null,
                createdAt: new Date(),
                createdBy: null,
                expenseId: null,
                restaurantId: null,
              },
            },
          ],
          colleague: {
            id: 1,
            name: 'Eve',
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
          },
        },
      ];

      const result = serializeExpense(expense);

      expect(
        typeof expectElement(expectElement(result.participants, 0).paymentApplications, 0).amount
      ).toBe('number');
      expect(
        expectElement(expectElement(result.participants, 0).paymentApplications, 0).amount
      ).toBe(33.33);
    });
  });
});
