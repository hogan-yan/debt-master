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

describe('serializeExpense', () => {
  // Helper to create mock expense data
  const createMockExpense = (overrides: Partial<ExpenseWithRelations> = {}): ExpenseWithRelations =>
    ({
      id: 1,
      date: new Date('2024-01-15'),
      amount: new Prisma.Decimal('100.50'),
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
        createdAt: new Date(),
      },
      participants: [],
      items: [],
      ...overrides,
    }) as ExpenseWithRelations;

  it('converts Decimal amount to number', () => {
    const expense = createMockExpense({
      amount: new Prisma.Decimal('99.99'),
    });

    const result = serializeExpense(expense);

    expect(result.amount).toBe(99.99);
    expect(typeof result.amount).toBe('number');
  });

  it('handles zero amount correctly', () => {
    const expense = createMockExpense({
      amount: new Prisma.Decimal('0.00'),
    });

    const result = serializeExpense(expense);

    expect(result.amount).toBe(0);
  });

  it('calculates isPaid correctly when fully paid', () => {
    const expense = createMockExpense({
      participants: [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          paymentApplications: [
            {
              id: 1,
              paymentId: 1,
              participantId: 1,
              expenseId: 1,
              amount: new Prisma.Decimal('50.00'),
              appliedAt: new Date(),
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
          ],
          colleague: {
            id: 1,
            name: 'Alice',
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
          },
        },
      ],
    });

    const result = serializeExpense(expense);

    expect(expectElement(result.participants, 0).isPaid).toBe(true);
    expect(expectElement(result.participants, 0).totalPaid).toBe(50);
    expect(expectElement(result.participants, 0).remainingOwed).toBe(0);
  });

  it('calculates partial payment correctly', () => {
    const expense = createMockExpense({
      participants: [
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
          ],
          colleague: {
            id: 1,
            name: 'Bob',
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
          },
        },
      ],
    });

    const result = serializeExpense(expense);

    expect(expectElement(result.participants, 0).isPaid).toBe(false);
    expect(expectElement(result.participants, 0).hasPartialPayment).toBe(true);
    expect(expectElement(result.participants, 0).isPending).toBe(true);
    expect(expectElement(result.participants, 0).totalPaid).toBe(30);
    expect(expectElement(result.participants, 0).remainingOwed).toBe(70);
  });

  it('only counts approved payments', () => {
    const expense = createMockExpense({
      participants: [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          paymentApplications: [
            {
              id: 1,
              paymentId: 1,
              participantId: 1,
              expenseId: 1,
              amount: new Prisma.Decimal('50.00'),
              appliedAt: new Date(),
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
                isApproved: false, // NOT approved - should not count
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
      ],
    });

    const result = serializeExpense(expense);

    expect(expectElement(result.participants, 0).isPaid).toBe(false);
    expect(expectElement(result.participants, 0).totalPaid).toBe(0); // Not counted because not approved
    expect(expectElement(result.participants, 0).remainingOwed).toBe(50);
  });

  it('handles empty participants array', () => {
    const expense = createMockExpense({ participants: [] });

    const result = serializeExpense(expense);

    expect(result.participants).toEqual([]);
  });

  it('handles expense without items', () => {
    const expense = createMockExpense({ items: [] });

    const result = serializeExpense(expense);

    expect(result.items).toEqual([]);
  });

  it('serializes item prices correctly', () => {
    const expense = createMockExpense({
      items: [
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          name: 'Burger',
          price: new Prisma.Decimal('15.99'),
          colleague: {
            id: 1,
            name: 'Alice',
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
          },
        },
      ],
    });

    const result = serializeExpense(expense);

    expect(expectElement(result.items, 0).price).toBe(15.99);
    expect(typeof expectElement(result.items, 0).price).toBe('number');
  });
});
