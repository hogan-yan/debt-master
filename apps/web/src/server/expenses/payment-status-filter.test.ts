import { describe, expect, it } from 'vitest';
import { filterExpensesByPaymentStatus } from './queries';

function createExpense(overrides: {
  id: number;
  participants: Array<{
    id: number;
    amount: number;
    isPaid: boolean;
    isPending?: boolean;
  }>;
}) {
  return {
    id: overrides.id,
    date: '2024-01-15',
    amount: 100,
    splitType: 'EQUAL',
    restaurantId: 1,
    notes: null,
    receiptBucket: null,
    receiptObjectKey: null,
    createdAt: new Date().toISOString(),
    createdBy: 'test',
    restaurant: { id: 1, name: 'Test Restaurant', address: null },
    participants: overrides.participants.map((p) => ({
      id: p.id,
      amount: p.amount,
      colleagueId: 1,
      expenseId: overrides.id,
      colleague: { id: 1, name: 'Test', createdAt: new Date(), deletedAt: null, deletedBy: null },
      isPaid: p.isPaid,
      isPending: p.isPending ?? false,
      hasPartialPayment: p.isPending ?? false,
      totalPaid: p.isPaid ? p.amount : p.isPending ? p.amount / 2 : 0,
      remainingOwed: p.isPaid ? 0 : p.isPending ? p.amount / 2 : p.amount,
      submittedAt: null,
      paymentApplications: [],
    })),
    items: [],
  };
}

describe('filterExpensesByPaymentStatus', () => {
  it('should return only fully paid expenses when status is "paid"', () => {
    const expenses = [
      createExpense({ id: 1, participants: [{ id: 1, amount: 50, isPaid: true }] }),
      createExpense({ id: 2, participants: [{ id: 2, amount: 50, isPaid: false }] }),
    ];

    const result = filterExpensesByPaymentStatus(expenses, 'paid');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });

  it('should return only unpaid expenses when status is "unpaid"', () => {
    const expenses = [
      createExpense({ id: 1, participants: [{ id: 1, amount: 50, isPaid: true }] }),
      createExpense({ id: 2, participants: [{ id: 2, amount: 50, isPaid: false }] }),
    ];

    const result = filterExpensesByPaymentStatus(expenses, 'unpaid');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(2);
  });

  it('should return only partially paid expenses when status is "partial"', () => {
    const expenses = [
      createExpense({ id: 1, participants: [{ id: 1, amount: 50, isPaid: true }] }),
      createExpense({
        id: 2,
        participants: [
          { id: 2, amount: 50, isPaid: true },
          { id: 3, amount: 50, isPaid: false },
        ],
      }),
      createExpense({ id: 3, participants: [{ id: 4, amount: 50, isPaid: false }] }),
    ];

    const result = filterExpensesByPaymentStatus(expenses, 'partial');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(2);
  });

  it('should return all expenses when status is "all"', () => {
    const expenses = [
      createExpense({ id: 1, participants: [{ id: 1, amount: 50, isPaid: true }] }),
      createExpense({ id: 2, participants: [{ id: 2, amount: 50, isPaid: false }] }),
    ];

    const result = filterExpensesByPaymentStatus(expenses, 'all');

    expect(result).toHaveLength(2);
  });

  it('should treat expenses with no participants as unpaid', () => {
    const expenses = [
      createExpense({ id: 1, participants: [] }),
      createExpense({ id: 2, participants: [{ id: 1, amount: 50, isPaid: true }] }),
    ];

    const unpaidResult = filterExpensesByPaymentStatus(expenses, 'unpaid');
    const paidResult = filterExpensesByPaymentStatus(expenses, 'paid');

    expect(unpaidResult).toHaveLength(1);
    expect(unpaidResult[0]?.id).toBe(1);
    expect(paidResult).toHaveLength(1);
    expect(paidResult[0]?.id).toBe(2);
  });
});
