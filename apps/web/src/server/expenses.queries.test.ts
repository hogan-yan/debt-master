import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

// Mock prisma
vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    expense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { expenseSchema, paginationSchema, serializeExpense } from './expenses';

// Mock types matching what serializeExpense actually reads
interface MockRestaurant {
  id: number;
  name: string;
  createdAt: Date;
  address: string | null;
}

interface MockColleague {
  id: number;
  name: string;
  createdAt: Date;
}

interface MockExpenseItem {
  id: number;
  expenseId: number;
  colleagueId: number;
  name?: string;
  price: Prisma.Decimal | number;
  colleague: MockColleague;
}

interface MockPaymentApp {
  id: number;
  paymentId: number;
  participantId: number;
  amount: Prisma.Decimal | number;
  appliedAt?: Date;
  createdAt?: Date;
  payment: { id: number; isApproved: boolean };
}

interface MockParticipant {
  id: number;
  expenseId: number;
  colleagueId: number;
  amount: Prisma.Decimal | number;
  isPaid: boolean;
  colleague: MockColleague;
  paymentApplications: MockPaymentApp[];
}

/**
 * Build a properly typed mock expense for serialization tests.
 * Missing fields are filled with safe defaults.
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
    date: new Date('2024-06-15'),
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

describe('Expense Query Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('serializeExpense', () => {
    it('should serialize basic expense with Decimal amount', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('100.50'),
        restaurant: { id: 1, name: 'Test Restaurant', createdAt: new Date(), address: null },
      });

      const result = serializeExpense(expense);

      expect(result.amount).toBe(100.5);
      expect(typeof result.amount).toBe('number');
    });

    it('should calculate isPaid based on approved payment applications', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('100'),
        participants: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            amount: new Prisma.Decimal('50'),
            isPaid: false,
            colleague: { id: 1, name: 'John', createdAt: new Date() },
            paymentApplications: [
              {
                id: 1,
                paymentId: 1,
                participantId: 1,
                amount: new Prisma.Decimal('50'),
                payment: { id: 1, isApproved: true },
              },
            ],
          },
        ],
      });

      const result = serializeExpense(expense);

      expect(expectElement(result.participants, 0).isPaid).toBe(true);
      expect(expectElement(result.participants, 0).totalPaid).toBe(50);
    });

    it('should not count unapproved payments toward totalPaid', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('100'),
        participants: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            amount: new Prisma.Decimal('50'),
            isPaid: false,
            colleague: { id: 1, name: 'John', createdAt: new Date() },
            paymentApplications: [
              {
                id: 1,
                paymentId: 1,
                participantId: 1,
                amount: new Prisma.Decimal('30'),
                payment: { id: 1, isApproved: false },
              },
            ],
          },
        ],
      });

      const result = serializeExpense(expense);

      expect(expectElement(result.participants, 0).totalPaid).toBe(0);
      expect(expectElement(result.participants, 0).isPaid).toBe(false);
    });

    it('should handle partial payments correctly', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('100'),
        participants: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            amount: new Prisma.Decimal('50'),
            isPaid: false,
            colleague: { id: 1, name: 'John', createdAt: new Date() },
            paymentApplications: [
              {
                id: 1,
                paymentId: 1,
                participantId: 1,
                amount: new Prisma.Decimal('25'),
                payment: { id: 1, isApproved: true },
              },
            ],
          },
        ],
      });

      const result = serializeExpense(expense);

      expect(expectElement(result.participants, 0).totalPaid).toBe(25);
      expect(expectElement(result.participants, 0).isPaid).toBe(false);
    });

    it('should serialize expense items with Decimal prices', () => {
      const expense = mockExpense({
        splitType: 'ITEMIZED',
        items: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            name: 'Burger',
            price: new Prisma.Decimal('15.99'),
            colleague: { id: 1, name: 'John', createdAt: new Date() },
          },
        ],
      });

      const result = serializeExpense(expense);

      expect(expectElement(result.items, 0).price).toBe(15.99);
    });

    it('should handle empty participants array', () => {
      const expense = mockExpense({ participants: [] });

      const result = serializeExpense(expense);

      expect(result.participants).toEqual([]);
    });

    it('should handle null restaurant gracefully', () => {
      const expense = mockExpense({ restaurant: null });

      const result = serializeExpense(expense);

      expect(result.restaurant).toBeUndefined();
    });

    it('should handle multiple payment applications', () => {
      const expense = mockExpense({
        amount: new Prisma.Decimal('100'),
        participants: [
          {
            id: 1,
            expenseId: 1,
            colleagueId: 1,
            amount: new Prisma.Decimal('50'),
            isPaid: false,
            colleague: { id: 1, name: 'John', createdAt: new Date() },
            paymentApplications: [
              {
                id: 1,
                paymentId: 1,
                participantId: 1,
                amount: new Prisma.Decimal('20'),
                payment: { id: 1, isApproved: true },
              },
              {
                id: 2,
                paymentId: 2,
                participantId: 1,
                amount: new Prisma.Decimal('30'),
                payment: { id: 2, isApproved: true },
              },
            ],
          },
        ],
      });

      const result = serializeExpense(expense);

      expect(expectElement(result.participants, 0).totalPaid).toBe(50);
      expect(expectElement(result.participants, 0).isPaid).toBe(true);
    });
  });

  describe('expenseSchema validation', () => {
    it('should validate valid expense data', () => {
      const validData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: 100.5,
        splitType: 'EQUAL' as const,
        participantIds: [1, 2, 3],
      };

      expect(() => expenseSchema.parse(validData)).not.toThrow();
    });

    it('should reject negative amount', () => {
      const invalidData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: -100,
        splitType: 'EQUAL' as const,
        participantIds: [1],
      };

      expect(() => expenseSchema.parse(invalidData)).toThrow();
    });

    it('should reject zero amount', () => {
      const invalidData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: 0,
        splitType: 'EQUAL' as const,
        participantIds: [1],
      };

      expect(() => expenseSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty participantIds', () => {
      const invalidData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: 100,
        splitType: 'EQUAL' as const,
        participantIds: [],
      };

      expect(() => expenseSchema.parse(invalidData)).toThrow();
    });

    it('should accept ITEMIZED split type', () => {
      const validData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: 100,
        splitType: 'ITEMIZED' as const,
        participantIds: [1],
        items: [{ name: 'Burger', price: 10, colleagueId: 1 }],
      };

      expect(() => expenseSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid split type', () => {
      const invalidData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: 100,
        splitType: 'INVALID',
        participantIds: [1],
      };

      expect(() => expenseSchema.parse(invalidData)).toThrow();
    });

    it('should accept optional notes', () => {
      const validData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: 100,
        splitType: 'EQUAL' as const,
        participantIds: [1],
        notes: 'Team lunch',
      };

      const result = expenseSchema.parse(validData);
      expect(result.notes).toBe('Team lunch');
    });

    it('should accept optional items for ITEMIZED', () => {
      const validData = {
        date: '2024-06-15',
        restaurantId: 1,
        amount: 100,
        splitType: 'ITEMIZED' as const,
        participantIds: [1, 2],
        items: [
          { name: 'Burger', price: 15, colleagueId: 1 },
          { name: 'Fries', price: 5, colleagueId: 2 },
        ],
      };

      const result = expenseSchema.parse(validData);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('paginationSchema validation', () => {
    it('should use default values', () => {
      const result = paginationSchema.parse({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.sortBy).toBe('date');
      expect(result.sortOrder).toBe('desc');
    });

    it('should accept custom values', () => {
      const input = {
        page: 2,
        pageSize: 25,
        sortBy: 'amount' as const,
        sortOrder: 'asc' as const,
      };

      const result = paginationSchema.parse(input);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
      expect(result.sortBy).toBe('amount');
      expect(result.sortOrder).toBe('asc');
    });

    it('should accept search parameter', () => {
      const input = {
        page: 1,
        search: 'restaurant name',
      };

      const result = paginationSchema.parse(input);

      expect(result.search).toBe('restaurant name');
    });

    it('should reject invalid page number', () => {
      const input = { page: 0 };

      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should reject invalid sortBy', () => {
      const input = { sortBy: 'invalid' };

      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should accept all valid sortBy options', () => {
      const validSorts = ['date', 'amount', 'splitType', 'restaurant', 'createdAt'] as const;

      validSorts.forEach((sortBy) => {
        expect(() => paginationSchema.parse({ sortBy })).not.toThrow();
      });
    });
  });

  describe('Pagination Calculations', () => {
    it('should calculate skip value correctly', () => {
      const calculateSkip = (page: number, pageSize: number) => (page - 1) * pageSize;

      expect(calculateSkip(1, 10)).toBe(0);
      expect(calculateSkip(2, 10)).toBe(10);
      expect(calculateSkip(3, 25)).toBe(50);
    });

    it('should calculate total pages correctly', () => {
      const calculateTotalPages = (totalCount: number, pageSize: number) =>
        Math.ceil(totalCount / pageSize);

      expect(calculateTotalPages(100, 10)).toBe(10);
      expect(calculateTotalPages(95, 10)).toBe(10);
      expect(calculateTotalPages(0, 10)).toBe(0);
    });

    it('should determine hasNextPage correctly', () => {
      const hasNextPage = (page: number, totalPages: number) => page < totalPages;

      expect(hasNextPage(1, 10)).toBe(true);
      expect(hasNextPage(10, 10)).toBe(false);
      expect(hasNextPage(5, 5)).toBe(false);
    });

    it('should determine hasPreviousPage correctly', () => {
      const hasPreviousPage = (page: number) => page > 1;

      expect(hasPreviousPage(1)).toBe(false);
      expect(hasPreviousPage(2)).toBe(true);
      expect(hasPreviousPage(5)).toBe(true);
    });
  });

  describe('Search Filter Logic', () => {
    it('should build where clause with search term', () => {
      const search = 'test';
      const where = search
        ? {
            OR: [
              {
                restaurant: {
                  name: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                participants: {
                  some: {
                    colleague: {
                      name: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              },
            ],
          }
        : {};

      expect(where).toHaveProperty('OR');
      expect(where.OR).toHaveLength(2);
    });

    it('should return empty object when no search term', () => {
      const search = '';
      const where = search
        ? {
            OR: [
              {
                restaurant: {
                  name: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {};

      expect(where).toEqual({});
    });
  });

  describe('Order By Logic', () => {
    it('should build order by for date sort', () => {
      const sortBy = 'date';
      const sortOrder = 'desc' as const;
      const orderBy = [{ [sortBy]: sortOrder }, { createdAt: 'desc' }];

      expect(orderBy).toEqual([{ date: 'desc' }, { createdAt: 'desc' }]);
    });

    it('should build order by for restaurant sort', () => {
      const sortBy = 'restaurant';
      const sortOrder = 'asc' as const;
      const orderBy =
        sortBy === 'restaurant'
          ? [{ restaurant: { name: sortOrder } }, { createdAt: 'desc' }]
          : [{ [sortBy]: sortOrder }, { createdAt: 'desc' }];

      expect(orderBy).toEqual([{ restaurant: { name: 'asc' } }, { createdAt: 'desc' }]);
    });

    it('should build order by for amount sort', () => {
      const sortBy = 'amount';
      const sortOrder = 'asc' as const;
      const orderBy = [{ [sortBy]: sortOrder }, { createdAt: 'desc' }];

      expect(orderBy).toEqual([{ amount: 'asc' }, { createdAt: 'desc' }]);
    });
  });
});
