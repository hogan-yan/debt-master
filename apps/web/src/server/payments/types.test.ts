import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { serializePayment } from './types';

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

type SerializablePayment = Parameters<typeof serializePayment>[0];

/**
 * MockApplication - shape for payment applications in tests
 * Matches the application fields accessed by serializePayment (amount, expense)
 */
interface MockApplication {
  id?: number;
  amount: Prisma.Decimal | number;
  expense?: {
    id?: number;
    date?: Date;
    amount: Prisma.Decimal | number;
    restaurant?: { id: number; name: string; address?: string } | null;
  } | null;
}

/**
 * MockPayment - satisfies PaymentWithApplicationsRaw input for serializePayment.
 */
interface MockPayment {
  id: number;
  amount: Prisma.Decimal | number;
  date: Date;
  paymentType: string;
  isApproved: boolean;
  submittedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
  expenseId: number | null;
  colleagueId: number;
  restaurantId: number | null;
  receiptObjectKey: string | null;
  receiptBucket: string | null;
  paymentProofObjectKey: string | null;
  paymentProofBucket: string | null;
  colleague?: { id: number; name: string; createdAt: Date };
  restaurant?: { id: number; name: string; createdAt: Date; address: string | null } | null;
  applications: MockApplication[];
}

// Shared defaults to avoid repetition
const baseMockPayment = (overrides: Partial<MockPayment> = {}): MockPayment => ({
  id: 1,
  amount: new Prisma.Decimal('100'),
  date: new Date(),
  paymentType: 'CASH',
  isApproved: true,
  submittedAt: new Date(),
  createdAt: new Date(),
  createdBy: null,
  expenseId: null,
  colleagueId: 1,
  restaurantId: null,
  receiptObjectKey: null,
  receiptBucket: null,
  paymentProofObjectKey: null,
  paymentProofBucket: null,
  applications: [],
  ...overrides,
});

describe('serializePayment', () => {
  it('should serialize payment with Prisma.Decimal amount', () => {
    const payment = baseMockPayment({
      amount: new Prisma.Decimal(100.5),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date('2024-01-15'),
      colleague: { id: 1, name: 'John', createdAt: new Date() },
      restaurant: { id: 1, name: 'Burger King', createdAt: new Date(), address: null },
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.amount).toBe(100.5);
    expect(typeof result.amount).toBe('number');
  });

  it('should handle plain number amount (already serialized)', () => {
    const payment = baseMockPayment({
      amount: 75.25,
      paymentType: 'FPS',
      isApproved: false,
      submittedAt: new Date('2024-01-15'),
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.amount).toBe(75.25);
  });

  it('should serialize application amounts with Decimal', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(100),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date('2024-01-15'),
      colleague: { id: 1, name: 'John', createdAt: new Date() },
      restaurant: null,
      applications: [
        {
          amount: new Prisma.Decimal(50),
          expense: {
            amount: new Prisma.Decimal(100),
            restaurant: { id: 1, name: 'Test Restaurant' },
          },
        },
        {
          id: 2,
          amount: new Prisma.Decimal(50),
          expense: {
            id: 2,
            amount: new Prisma.Decimal(200),
            restaurant: null,
          },
        },
      ],
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.applications).toHaveLength(2);
    expect(expectElement(result.applications, 0).amount).toBe(50);
    expect(expectElement(result.applications, 0).expense?.amount).toBe(100);
    expect(expectElement(result.applications, 1).amount).toBe(50);
    expect(expectElement(result.applications, 1).expense?.amount).toBe(200);
  });

  it('should handle applications without expense property', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(100),
      paymentType: 'PAYME',
      isApproved: true,
      submittedAt: new Date('2024-01-15'),
      colleague: { id: 1, name: 'John', createdAt: new Date() },
      applications: [
        {
          amount: new Prisma.Decimal(100),
        },
      ],
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(expectElement(result.applications, 0).expense).toBeNull();
  });

  it('should handle null applications', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(100),
      paymentType: 'OTHER',
      isApproved: true,
      submittedAt: new Date('2024-01-15'),
      colleague: { id: 1, name: 'John', createdAt: new Date() },
      restaurant: { id: 1, name: 'Restaurant', createdAt: new Date(), address: null },
    });
    // Simulate null applications by mutating - this tests the runtime behavior
    const result = serializePayment({
      ...payment,
      applications: null,
    } as unknown as SerializablePayment);

    expect(result.applications).toEqual([]);
  });

  it('should handle undefined colleague', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(50),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date('2024-01-15'),
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.colleague).toBeUndefined();
  });

  it('should preserve all payment properties', () => {
    const payment = baseMockPayment({
      id: 42,
      amount: new Prisma.Decimal(99.99),
      paymentType: 'BANK_TRANSFER',
      isApproved: false,
      submittedAt: new Date('2024-06-15'),
      createdAt: new Date('2024-06-15'),
      colleague: { id: 5, name: 'Jane Doe', createdAt: new Date() },
      restaurant: { id: 3, name: 'Pizza Place', createdAt: new Date(), address: null },
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.id).toBe(42);
    expect(result.paymentType).toBe('BANK_TRANSFER');
    expect(result.isApproved).toBe(false);
    expect(result.colleague?.name).toBe('Jane Doe');
    expect(result.restaurant?.name).toBe('Pizza Place');
  });

  it('should cast paymentType to specific union type', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(100),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date(),
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(['PAYME', 'FPS', 'CASH', 'OTHER']).toContain(result.paymentType);
  });

  it('should handle very large decimal amounts', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal('999999.99'),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date(),
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.amount).toBe(999999.99);
  });

  it('should handle zero amount', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(0),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date(),
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.amount).toBe(0);
  });

  it('should handle negative amount (credit/refund)', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(-50),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date(),
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.amount).toBe(-50);
  });

  it('should handle empty applications array', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(100),
      paymentType: 'FPS',
      isApproved: true,
      submittedAt: new Date(),
      colleague: { id: 1, name: 'John', createdAt: new Date() },
      restaurant: null,
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(result.applications).toEqual([]);
    expect(result.applications).toHaveLength(0);
  });

  it('should handle deeply nested expense data', () => {
    const payment = baseMockPayment({
      id: 1,
      amount: new Prisma.Decimal(150),
      paymentType: 'CASH',
      isApproved: true,
      submittedAt: new Date(),
      colleague: { id: 1, name: 'John', createdAt: new Date() },
      restaurant: { id: 1, name: 'Main Restaurant', createdAt: new Date(), address: null },
      applications: [
        {
          amount: new Prisma.Decimal(150),
          expense: {
            id: 1,
            amount: new Prisma.Decimal(300),
            date: new Date('2024-01-15'),
            restaurant: {
              id: 2,
              name: 'Expense Restaurant',
              address: '123 Main St',
            },
          },
        },
      ],
    });

    const result = serializePayment(payment as unknown as SerializablePayment);

    expect(expectElement(result.applications, 0).expense?.restaurant?.name).toBe(
      'Expense Restaurant'
    );
  });
});
