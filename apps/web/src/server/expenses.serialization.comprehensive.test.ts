import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { serializeExpense } from './expenses';
import type { ExpenseWithRelations } from './expenses/types';

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

interface MockColleague {
  id: number;
  name: string;
  createdAt: Date;
}

interface MockPayment {
  id: number;
  isApproved: boolean | null;
}

interface MockPaymentApp {
  id: number;
  paymentId: number;
  participantId: number;
  amount: Prisma.Decimal | number;
  payment: MockPayment | null;
}

interface MockParticipant {
  id: number;
  expenseId: number;
  colleagueId: number;
  amount: Prisma.Decimal | number;
  isPaid: boolean;
  colleague: MockColleague | null;
  paymentApplications: MockPaymentApp[] | undefined;
}

interface MockExpenseItem {
  id: number;
  expenseId: number;
  colleagueId: number;
  name?: string | null;
  price: Prisma.Decimal | number;
  colleague: MockColleague | undefined;
}

interface MockRestaurant {
  id: number;
  name: string;
  createdAt: Date;
  address: string | null;
}

/**
 * Build a properly typed mock expense for serialization tests.
 */
function mockExpense(overrides: {
  id?: number;
  date?: Date;
  amount?: Prisma.Decimal;
  splitType?: 'EQUAL' | 'ITEMIZED';
  restaurant?: MockRestaurant | null;
  participants?: MockParticipant[];
  items?: MockExpenseItem[];
  notes?: string | null;
  receiptObjectKey?: string | null;
  receiptBucket?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  restaurantId?: number | null;
}): ExpenseWithRelations {
  const now = new Date();
  const baseRestaurant: MockRestaurant = {
    id: 1,
    name: 'Test',
    createdAt: now,
    address: null,
  };
  return {
    id: 1,
    date: new Date(),
    amount: new Prisma.Decimal('100'),
    splitType: 'EQUAL' as const,
    restaurant: baseRestaurant,
    participants: [],
    items: [],
    createdAt: now,
    updatedAt: now,
    receiptObjectKey: null,
    receiptBucket: null,
    createdBy: null,
    notes: null,
    restaurantId: 1,
    ...overrides,
  } as unknown as ExpenseWithRelations;
}

const colleague = (id: number, name: string): MockColleague => ({
  id,
  name,
  createdAt: new Date(),
});

const paymentApp = (
  id: number,
  amount: Prisma.Decimal | number,
  isApproved: boolean | null
): MockPaymentApp => ({
  id,
  paymentId: id,
  participantId: 1,
  amount,
  payment: isApproved !== null ? { id, isApproved } : null,
});

const participant = (overrides: Partial<MockParticipant> = {}): MockParticipant => {
  const colId = overrides.colleagueId ?? 1;
  return {
    id: 1,
    expenseId: 1,
    colleagueId: colId,
    amount: new Prisma.Decimal('50'),
    isPaid: false,
    colleague: overrides.colleague === undefined ? colleague(colId, 'John') : overrides.colleague,
    paymentApplications: [],
    ...overrides,
  };
};

/**
 * Comprehensive Serialization Tests
 * Covers edge cases and complex scenarios for expense serialization
 */

describe('serializeExpense - Comprehensive', () => {
  describe('Amount Conversion Edge Cases', () => {
    it('should handle very large Decimal amounts', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('999999.99'),
      });

      const result = serializeExpense(expense);
      expect(result.amount).toBe(999999.99);
    });

    it('should handle very small Decimal amounts', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('0.01'),
      });

      const result = serializeExpense(expense);
      expect(result.amount).toBe(0.01);
    });

    it('should handle zero amount', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('0'),
      });

      const result = serializeExpense(expense);
      expect(result.amount).toBe(0);
    });

    it('should handle negative Decimal (if passed)', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('-50.00'),
      });

      const result = serializeExpense(expense);
      expect(result.amount).toBe(-50.0);
    });

    it('should pass through regular numbers unchanged', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('100.50'),
      });

      const result = serializeExpense(expense);
      expect(result.amount).toBe(100.5);
    });
  });

  describe('Complex Payment Scenarios', () => {
    it('should handle participant with no payment applications', () => {
      const expense = mockExpense({
        participants: [
          participant({
            colleague: colleague(1, 'John'),
            paymentApplications: [],
          }),
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.participants, 0).totalPaid).toBe(0);
      expect(expectElement(result.participants, 0).isPaid).toBe(false);
    });

    it('should handle participant with undefined paymentApplications', async () => {
      const expense = mockExpense({
        participants: [
          participant({
            colleague: colleague(1, 'John'),
            paymentApplications: undefined,
          }),
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.participants, 0).totalPaid).toBe(0);
      expect(expectElement(result.participants, 0).isPaid).toBe(false);
    });

    it('should handle mixed approved and unapproved payments', () => {
      const expense = mockExpense({
        participants: [
          participant({
            colleague: colleague(1, 'John'),
            paymentApplications: [
              paymentApp(1, new Prisma.Decimal('20'), true),
              paymentApp(2, new Prisma.Decimal('15'), false),
              paymentApp(3, new Prisma.Decimal('10'), true),
            ],
          }),
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.participants, 0).totalPaid).toBe(30); // Only approved: 20 + 10
      expect(expectElement(result.participants, 0).isPaid).toBe(false); // 30 < 50
    });

    it('should handle overpayment scenario', () => {
      const expense = mockExpense({
        participants: [
          participant({
            amount: new Prisma.Decimal('50'),
            colleague: colleague(1, 'John'),
            paymentApplications: [paymentApp(1, new Prisma.Decimal('75'), true)],
          }),
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.participants, 0).totalPaid).toBe(75);
      expect(expectElement(result.participants, 0).isPaid).toBe(true); // 75 >= 50
    });

    it('should handle exact payment match', () => {
      const expense = mockExpense({
        participants: [
          participant({
            amount: new Prisma.Decimal('50'),
            colleague: colleague(1, 'John'),
            paymentApplications: [paymentApp(1, new Prisma.Decimal('50'), true)],
          }),
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.participants, 0).totalPaid).toBe(50);
      expect(expectElement(result.participants, 0).isPaid).toBe(true); // Exact match
    });
  });

  describe('Multiple Participants', () => {
    it('should handle multiple participants with different payment statuses', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('150'),
        participants: [
          participant({
            id: 1,
            colleagueId: 1,
            amount: new Prisma.Decimal('50'),
            colleague: colleague(1, 'Alice'),
            paymentApplications: [paymentApp(1, new Prisma.Decimal('50'), true)],
          }),
          participant({
            id: 2,
            colleagueId: 2,
            amount: new Prisma.Decimal('50'),
            colleague: colleague(2, 'Bob'),
            paymentApplications: [],
          }),
          participant({
            id: 3,
            colleagueId: 3,
            amount: new Prisma.Decimal('50'),
            colleague: colleague(3, 'Charlie'),
            paymentApplications: [paymentApp(2, new Prisma.Decimal('25'), true)],
          }),
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.participants, 0).isPaid).toBe(true); // Alice: fully paid
      expect(expectElement(result.participants, 1).isPaid).toBe(false); // Bob: not paid
      expect(expectElement(result.participants, 2).isPaid).toBe(false); // Charlie: partial
    });
  });

  describe('Item Serialization', () => {
    it('should handle item without name', () => {
      const expense = mockExpense({
        splitType: 'ITEMIZED',
        restaurant: { id: 1, name: 'Test', createdAt: new Date(), address: null },
        items: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            name: null,
            price: new Prisma.Decimal('25'),
            colleague: colleague(1, 'John'),
          },
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.items, 0).price).toBe(25);
      expect(expectElement(result.items, 0).name).toBeNull();
    });

    it('should handle item with undefined colleague', () => {
      const expense = mockExpense({
        splitType: 'ITEMIZED',
        restaurant: { id: 1, name: 'Test', createdAt: new Date(), address: null },
        items: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            name: 'Burger',
            price: new Prisma.Decimal('25'),
            colleague: undefined,
          },
        ],
      });

      const result = serializeExpense(expense);
      expect(expectElement(result.items, 0).colleague).toBeUndefined();
    });

    it('should serialize multiple items correctly', () => {
      const expense = mockExpense({
        splitType: 'ITEMIZED',
        restaurant: { id: 1, name: 'Test', createdAt: new Date(), address: null },
        items: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            name: 'Burger',
            price: new Prisma.Decimal('15.99'),
            colleague: colleague(1, 'Alice'),
          },
          {
            id: 2,
            expenseId: 1,
            colleagueId: 2,
            name: 'Fries',
            price: new Prisma.Decimal('5.49'),
            colleague: colleague(2, 'Bob'),
          },
          {
            id: 3,
            expenseId: 1,
            colleagueId: 1,
            name: 'Drink',
            price: new Prisma.Decimal('3.50'),
            colleague: colleague(1, 'Alice'),
          },
        ],
      });

      const result = serializeExpense(expense);
      expect(result.items).toHaveLength(3);
      expect(expectElement(result.items, 0).price).toBe(15.99);
      expect(expectElement(result.items, 1).price).toBe(5.49);
      expect(expectElement(result.items, 2).price).toBe(3.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle expense with all optional fields null', () => {
      const expense = mockExpense({
        restaurant: null,
        restaurantId: null,
      });

      const result = serializeExpense(expense);
      expect(result.restaurant).toBeUndefined();
      expect(result.notes).toBeNull();
    });

    it('should preserve all primitive fields', () => {
      const createdAt = new Date('2024-01-15T10:30:00Z');
      const updatedAt = new Date('2024-06-15T14:45:00Z');
      const expenseDate = new Date('2024-03-20');

      const expense = mockExpense({
        id: 42,
        date: expenseDate,
        amount: new Prisma.Decimal('250.75'),
        splitType: 'ITEMIZED',
        restaurant: { id: 5, name: 'Pizza Place', createdAt: new Date(), address: null },
        createdAt,
        updatedAt,
        receiptObjectKey: 'receipts/abc123.jpg',
        receiptBucket: 'expense-receipts',
        notes: 'Team celebration lunch',
        restaurantId: 5,
      });

      const result = serializeExpense(expense);
      expect(result.id).toBe(42);
      expect(result.date).toEqual(expenseDate);
      expect(result.createdAt).toEqual(createdAt);
      expect((result as Record<string, unknown>).updatedAt).toEqual(updatedAt);
      expect(result.receiptObjectKey).toBe('receipts/abc123.jpg');
      expect(result.receiptBucket).toBe('expense-receipts');
      expect(result.notes).toBe('Team celebration lunch');
    });

    it('should handle payment application with null payment', () => {
      const expense = mockExpense({
        participants: [
          participant({
            colleague: colleague(1, 'John'),
            paymentApplications: [
              {
                id: 1,
                paymentId: 1,
                participantId: 1,
                amount: new Prisma.Decimal('25'),
                payment: null,
              },
            ],
          }),
        ],
      });

      const result = serializeExpense(expense);
      // Null payment should be treated as not approved
      expect(expectElement(result.participants, 0).totalPaid).toBe(0);
    });

    it('should handle participant with null colleague', () => {
      const expense = mockExpense({
        participants: [participant({ colleague: null })],
      });

      const result = serializeExpense(expense);
      // Colleague is spread directly, so null becomes undefined in the output
      expect(expectElement(result.participants, 0).colleague).toBeUndefined();
    });
  });
});
