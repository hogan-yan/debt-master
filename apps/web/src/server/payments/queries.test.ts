import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

function expectElement<T>(arr: T[], index: number): T {
  const element = arr[index];
  if (element === undefined) {
    throw new Error(`Expected array to have element at index ${index}, but it was undefined`);
  }
  return element;
}

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    expenseParticipant: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
}));

vi.mock('@/server/infrastructure/storage', () => ({
  getStorageUrl: vi.fn().mockResolvedValue('https://minio.example.com/proof.jpg'),
}));

import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { getStorageUrl } from '@/server/infrastructure/storage';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode } from '@/utils/errors';
import {
  getPaymentById,
  getPaymentProofUrl,
  getPaymentProofUrlByPaymentId,
  getPaymentStats,
  getPaymentsPaginated,
} from './queries';
import { type PaymentWithApplicationsRaw, serializePayment } from './types';

// biome-ignore lint/suspicious/noExplicitAny: test helper to call mocked server functions with loose typing
type ServerFn = (ctx: { data: any }) => Promise<any>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Payment Query Logic Tests', () => {
  describe('serializePayment', () => {
    it('should serialize basic payment with Decimal amount', () => {
      const payment = {
        id: 1,
        amount: new Prisma.Decimal('100.50'),
        date: new Date('2024-06-15'),
        paymentType: 'CASH',
        isApproved: true,
        colleague: { id: 1, name: 'John' },
        restaurant: { id: 1, name: 'Test Restaurant' },
        applications: [],
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        receiptObjectKey: null,
        receiptBucket: null,
        paymentProofObjectKey: null,
        colleagueId: 1,
        restaurantId: 1,
      };

      const result = serializePayment(payment as unknown as PaymentWithApplicationsRaw);

      expect(result.amount).toBe(100.5);
      expect(typeof result.amount).toBe('number');
      expect(result.paymentType).toBe('CASH');
      expect(result.isApproved).toBe(true);
    });

    it('should serialize payment with applications', () => {
      const payment = {
        id: 1,
        amount: new Prisma.Decimal('50'),
        date: new Date('2024-06-15'),
        paymentType: 'BANK_TRANSFER',
        isApproved: false,
        colleague: { id: 1, name: 'John' },
        restaurant: null,
        applications: [
          {
            id: 1,
            paymentId: 1,
            expenseId: 10,
            participantId: 5,
            amount: new Prisma.Decimal('25'),
            expense: {
              id: 10,
              date: new Date('2024-06-10'),
              amount: new Prisma.Decimal('100'),
              restaurant: { id: 2, name: 'Lunch Spot' },
            },
          },
        ],
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        receiptObjectKey: null,
        receiptBucket: null,
        paymentProofObjectKey: null,
        colleagueId: 1,
        restaurantId: null,
      };

      const result = serializePayment(payment as unknown as PaymentWithApplicationsRaw);

      expect(result.applications).toHaveLength(1);
      expect(expectElement(result.applications, 0).amount).toBe(25);
      expect(expectElement(result.applications, 0).expense?.amount).toBe(100);
    });

    it('should handle null restaurant in payment', () => {
      const payment = {
        id: 1,
        amount: new Prisma.Decimal('50'),
        date: new Date('2024-06-15'),
        paymentType: 'CASH',
        isApproved: true,
        colleague: { id: 1, name: 'John' },
        restaurant: null,
        applications: [],
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        receiptObjectKey: null,
        receiptBucket: null,
        paymentProofObjectKey: null,
        colleagueId: 1,
        restaurantId: null,
      };

      const result = serializePayment(payment as unknown as PaymentWithApplicationsRaw);

      expect(result.restaurant).toBeNull();
    });

    it('should handle application without expense', () => {
      const payment = {
        id: 1,
        amount: new Prisma.Decimal('50'),
        date: new Date('2024-06-15'),
        paymentType: 'CASH',
        isApproved: true,
        colleague: { id: 1, name: 'John' },
        restaurant: null,
        applications: [
          {
            id: 1,
            paymentId: 1,
            expenseId: 10,
            participantId: 5,
            amount: new Prisma.Decimal('25'),
            expense: null,
          },
        ],
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        receiptObjectKey: null,
        receiptBucket: null,
        paymentProofObjectKey: null,
        colleagueId: 1,
        restaurantId: null,
      };

      const result = serializePayment(payment as unknown as PaymentWithApplicationsRaw);

      expect(expectElement(result.applications, 0).expense).toBeNull();
    });

    it('should convert all valid payment types', () => {
      const types = ['PAYME', 'FPS', 'CASH', 'OTHER'] as const;

      types.forEach((type) => {
        const payment = {
          id: 1,
          amount: new Prisma.Decimal('50'),
          date: new Date(),
          paymentType: type,
          isApproved: true,
          colleague: { id: 1, name: 'John' },
          restaurant: null,
          applications: [],
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          receiptObjectKey: null,
          receiptBucket: null,
          paymentProofObjectKey: null,
          colleagueId: 1,
          restaurantId: null,
        };

        const result = serializePayment(payment as unknown as PaymentWithApplicationsRaw);
        expect(result.paymentType).toBe(type);
      });
    });
  });

  describe('Pagination Calculations', () => {
    it('should calculate skip value correctly', () => {
      const calculateSkip = (page: number, pageSize: number) => (page - 1) * pageSize;

      expect(calculateSkip(1, 10)).toBe(0);
      expect(calculateSkip(2, 10)).toBe(10);
      expect(calculateSkip(3, 25)).toBe(50);
      expect(calculateSkip(5, 20)).toBe(80);
    });

    it('should calculate total pages correctly', () => {
      const calculateTotalPages = (totalCount: number, pageSize: number) =>
        Math.ceil(totalCount / pageSize);

      expect(calculateTotalPages(100, 10)).toBe(10);
      expect(calculateTotalPages(95, 10)).toBe(10);
      expect(calculateTotalPages(101, 10)).toBe(11);
      expect(calculateTotalPages(0, 10)).toBe(0);
    });

    it('should determine hasNextPage correctly', () => {
      const hasNextPage = (page: number, totalPages: number) => page < totalPages;

      expect(hasNextPage(1, 10)).toBe(true);
      expect(hasNextPage(9, 10)).toBe(true);
      expect(hasNextPage(10, 10)).toBe(false);
    });

    it('should determine hasPreviousPage correctly', () => {
      const hasPreviousPage = (page: number) => page > 1;

      expect(hasPreviousPage(1)).toBe(false);
      expect(hasPreviousPage(2)).toBe(true);
      expect(hasPreviousPage(10)).toBe(true);
    });
  });

  describe('Search Filter Building', () => {
    it('should build where clause with search term for payments', () => {
      const search = 'john';
      const whereClause: Prisma.PaymentWhereInput = {};

      if (search) {
        whereClause.OR = [
          {
            colleague: {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            paymentType: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          {
            restaurant: {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          },
        ];
      }

      expect(whereClause.OR).toHaveLength(3);
      expect(whereClause.OR?.[0]).toHaveProperty('colleague');
      expect(whereClause.OR?.[1]).toHaveProperty('paymentType');
      expect(whereClause.OR?.[2]).toHaveProperty('restaurant');
    });

    it('should return empty where clause when no search term', () => {
      const search = '';
      const whereClause: Prisma.PaymentWhereInput = {};

      if (search) {
        whereClause.OR = [{ colleague: { name: { contains: search } } }];
      }

      expect(whereClause).toEqual({});
    });
  });

  describe('Order By Building', () => {
    it('should build order by for date sort', () => {
      const sortBy = 'date';
      const sortOrder = 'desc' as const;
      let orderBy: Prisma.PaymentOrderByWithRelationInput[] = [];

      switch (sortBy) {
        case 'date':
          orderBy = [{ date: sortOrder }, { createdAt: 'desc' }];
          break;
        default:
          orderBy = [{ date: 'desc' }, { createdAt: 'desc' }];
      }

      expect(orderBy).toEqual([{ date: 'desc' }, { createdAt: 'desc' }]);
    });

    it('should build order by for colleagueName sort', () => {
      const sortBy = 'colleagueName';
      const sortOrder = 'asc' as const;
      let orderBy: Prisma.PaymentOrderByWithRelationInput[] = [];

      switch (sortBy) {
        case 'colleagueName':
          orderBy = [{ colleague: { name: sortOrder } }, { createdAt: 'desc' }];
          break;
        default:
          orderBy = [{ date: 'desc' }, { createdAt: 'desc' }];
      }

      expect(orderBy).toEqual([{ colleague: { name: 'asc' } }, { createdAt: 'desc' }]);
    });

    it('should build order by for amount sort', () => {
      const sortBy = 'amount';
      const sortOrder = 'asc' as const;
      let orderBy: Prisma.PaymentOrderByWithRelationInput[] = [];

      switch (sortBy) {
        case 'amount':
          orderBy = [{ [sortBy]: sortOrder }, { createdAt: 'desc' }];
          break;
        default:
          orderBy = [{ date: 'desc' }, { createdAt: 'desc' }];
      }

      expect(orderBy).toEqual([{ amount: 'asc' }, { createdAt: 'desc' }]);
    });

    it('should build order by for paymentType sort', () => {
      const sortBy = 'paymentType';
      const sortOrder = 'desc' as const;
      let orderBy: Prisma.PaymentOrderByWithRelationInput[] = [];

      switch (sortBy) {
        case 'paymentType':
          orderBy = [{ [sortBy]: sortOrder }, { createdAt: 'desc' }];
          break;
        default:
          orderBy = [{ date: 'desc' }, { createdAt: 'desc' }];
      }

      expect(orderBy).toEqual([{ paymentType: 'desc' }, { createdAt: 'desc' }]);
    });
  });

  describe('Stats Calculation Logic', () => {
    it('should calculate average amount correctly', () => {
      const calculateAverage = (totalAmount: number, totalCount: number) =>
        totalCount > 0 ? totalAmount / totalCount : 0;

      expect(calculateAverage(1000, 10)).toBe(100);
      expect(calculateAverage(0, 0)).toBe(0);
      expect(calculateAverage(500, 5)).toBe(100);
    });

    it('should convert Decimal sum to number', () => {
      const decimalSum = new Prisma.Decimal('1234.56');
      const totalAmount = serializeDecimal(decimalSum);

      expect(totalAmount).toBe(1234.56);
    });

    it('should handle null Decimal sum', () => {
      const decimalSum = null;
      const totalAmount = serializeDecimal(decimalSum);

      expect(totalAmount).toBe(0);
    });
  });

  describe('Payment Stats Aggregation', () => {
    it('should aggregate stats from database results', async () => {
      vi.mocked(prisma.payment.count).mockResolvedValue(100);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('5000.00') },
      } as never);
      vi.mocked(prisma.payment.groupBy).mockResolvedValue([
        { colleagueId: 1 },
        { colleagueId: 2 },
        { colleagueId: 3 },
      ] as never);

      const totalPayments = (await vi.mocked(prisma.payment.count)()) as number;
      const paymentSum = (await vi.mocked(prisma.payment.aggregate)({
        _sum: { amount: true },
      })) as {
        _sum: { amount: Prisma.Decimal | null };
      };
      const uniquePayers = (await vi.mocked(prisma.payment.groupBy)({
        by: ['colleagueId'],
      } as never)) as Array<{
        colleagueId: number;
      }>;

      const totalAmount = serializeDecimal(paymentSum._sum.amount);
      const averageAmount = totalPayments > 0 ? totalAmount / totalPayments : 0;

      const stats = {
        totalPayments,
        totalAmount,
        averageAmount,
        uniquePayers: uniquePayers.length,
      };

      expect(stats.totalPayments).toBe(100);
      expect(stats.totalAmount).toBe(5000);
      expect(stats.averageAmount).toBe(50);
      expect(stats.uniquePayers).toBe(3);
    });
  });

  describe('Receipt URL Logic', () => {
    it('should return null URL when payment has no receipt', () => {
      const payment = {
        receiptBucket: null,
        receiptObjectKey: null,
      };

      const hasReceipt = payment.receiptBucket && payment.receiptObjectKey;
      expect(hasReceipt).toBeFalsy();
    });

    it('should return null URL when only bucket is present', () => {
      const payment = {
        receiptBucket: 'bucket',
        receiptObjectKey: null,
      };

      const hasReceipt = payment.receiptBucket && payment.receiptObjectKey;
      expect(hasReceipt).toBeFalsy();
    });

    it('should indicate receipt exists when both fields are present', () => {
      const payment = {
        receiptBucket: 'expense-receipts',
        receiptObjectKey: 'receipts/abc123.jpg',
      };

      const hasReceipt = payment.receiptBucket && payment.receiptObjectKey;
      expect(hasReceipt).toBeTruthy();
    });
  });
});

describe('getPaymentById', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns serialized payment when found', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      amount: new Prisma.Decimal('100'),
      colleague: { name: 'Alice' },
      restaurant: null,
      applications: [],
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentType: 'CASH',
      isApproved: true,
      colleagueId: 1,
      restaurantId: null,
      paymentProofBucket: null,
      paymentProofObjectKey: null,
      createdBy: null,
      expenseId: null,
    } as never);

    const result = await (getPaymentById as ServerFn)({ data: { id: 1 } });

    expect(result).toEqual(expect.objectContaining({ id: 1 }));
    expect(prisma.payment.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: expect.any(Object),
    });
  });

  it('throws when payment not found', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);

    await expect((getPaymentById as ServerFn)({ data: { id: 999 } })).rejects.toThrow(
      'Payment not found'
    );
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Authentication required'));

    await expect((getPaymentById as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Authentication required'
    );
  });
});

describe('getPaymentStats', () => {
  it('returns zeros when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getPaymentStats as ServerFn)({ data: {} });

    expect(result).toEqual({ totalPayments: 0, totalAmount: 0, averageAmount: 0, uniquePayers: 0 });
  });

  it('computes zero average when authenticated but no payments exist', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(0);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);

    const result = await (getPaymentStats as ServerFn)({ data: {} });

    expect(result).toEqual({ totalPayments: 0, totalAmount: 0, averageAmount: 0, uniquePayers: 0 });
  });

  it('computes stats from the database', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(4);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('400') },
    } as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { colleagueId: 1 },
      { colleagueId: 2 },
    ] as never);

    const result = await (getPaymentStats as ServerFn)({ data: {} });

    expect(result.totalPayments).toBe(4);
    expect(result.totalAmount).toBe(400);
    expect(result.averageAmount).toBe(100);
    expect(result.uniquePayers).toBe(2);
  });
});

describe('getPaymentsPaginated', () => {
  it('returns empty paginated response when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getPaymentsPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } });

    expect(result.data).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
  });

  it('returns paginated data for authenticated user', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(2);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        colleague: { name: 'Alice' },
        restaurant: null,
        applications: [],
        submittedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentType: 'CASH',
        isApproved: true,
        colleagueId: 1,
        restaurantId: null,
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        createdBy: null,
        expenseId: null,
      },
      {
        id: 2,
        amount: new Prisma.Decimal('50'),
        colleague: { name: 'Bob' },
        restaurant: null,
        applications: [],
        submittedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentType: 'PAYME',
        isApproved: true,
        colleagueId: 2,
        restaurantId: null,
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        createdBy: null,
        expenseId: null,
      },
    ] as never);

    const result = await (getPaymentsPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } });

    expect(result.pagination.totalCount).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(prisma.payment.findMany).toHaveBeenCalled();
  });

  it('applies search filter', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(1);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        colleague: { name: 'Alice' },
        restaurant: null,
        applications: [],
        submittedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentType: 'CASH',
        isApproved: true,
        colleagueId: 1,
        restaurantId: null,
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        createdBy: null,
        expenseId: null,
      },
    ] as never);

    const result = await (getPaymentsPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, search: 'alice' },
    });

    expect(result.data).toHaveLength(1);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      })
    );
  });

  it('applies sorting by amount', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(1);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        colleague: { name: 'Alice' },
        restaurant: null,
        applications: [],
        submittedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentType: 'CASH',
        isApproved: true,
        colleagueId: 1,
        restaurantId: null,
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        createdBy: null,
        expenseId: null,
      },
    ] as never);

    await (getPaymentsPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy: 'amount', sortOrder: 'asc' },
    });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.any(Array),
      })
    );
  });
});

describe('getPaymentProofUrl', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns URL when proof exists', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [
        {
          payment: {
            paymentProofBucket: 'proofs',
            paymentProofObjectKey: 'proof-1.jpg',
          },
        },
      ],
    } as never);

    const result = await (getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(getStorageUrl).toHaveBeenCalledWith('proofs', 'proof-1.jpg');
    expect(result).toEqual({ url: 'https://minio.example.com/proof.jpg' });
  });

  it('returns null when no payment applications', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [],
    } as never);

    const result = await (getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(result).toEqual({ url: null });
  });

  it('returns null when no proof on payment', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [
        {
          payment: {
            paymentProofBucket: null,
            paymentProofObjectKey: null,
          },
        },
      ],
    } as never);

    const result = await (getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(result).toEqual({ url: null });
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Authentication required'));

    await expect((getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } })).rejects.toThrow(
      'Authentication required'
    );
  });
});

describe('getPaymentProofUrlByPaymentId', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns URL when proof exists', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      paymentProofBucket: 'proofs',
      paymentProofObjectKey: 'proof-1.jpg',
    } as never);

    const result = await (getPaymentProofUrlByPaymentId as ServerFn)({ data: { paymentId: 1 } });

    expect(getStorageUrl).toHaveBeenCalledWith('proofs', 'proof-1.jpg');
    expect(result).toEqual({ url: 'https://minio.example.com/proof.jpg' });
  });

  it('returns null when no proof', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    } as never);

    const result = await (getPaymentProofUrlByPaymentId as ServerFn)({ data: { paymentId: 1 } });

    expect(result).toEqual({ url: null });
  });

  it('returns null when payment not found', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);

    const result = await (getPaymentProofUrlByPaymentId as ServerFn)({ data: { paymentId: 999 } });

    expect(result).toEqual({ url: null });
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Authentication required'));

    await expect(
      (getPaymentProofUrlByPaymentId as ServerFn)({ data: { paymentId: 1 } })
    ).rejects.toThrow('Authentication required');
  });
});

describe('getPaymentProofUrlByPaymentId error handling', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('throws infrastructure error on database failure', async () => {
    vi.mocked(prisma.payment.findUnique).mockRejectedValue(new Error('boom'));

    await expect(
      (getPaymentProofUrlByPaymentId as ServerFn)({ data: { paymentId: 1 } })
    ).rejects.toThrow('Failed to get payment proof URL');
  });
});

describe('getPaymentProofUrl edge cases', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns null when proof bucket is missing', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [
        {
          payment: {
            paymentProofBucket: null,
            paymentProofObjectKey: 'key.jpg',
          },
        },
      ],
    } as never);

    const result = await (getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(result).toEqual({ url: null });
  });

  it('returns null when proof object key is missing', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [
        {
          payment: {
            paymentProofBucket: 'bucket',
            paymentProofObjectKey: null,
          },
        },
      ],
    } as never);

    const result = await (getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(result).toEqual({ url: null });
  });

  it('throws infrastructure error on database failure', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockRejectedValue(new Error('boom'));

    await expect((getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } })).rejects.toThrow(
      'Failed to get payment proof URL'
    );
  });
});

describe('getPaymentStats edge cases', () => {
  beforeEach(() => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('throws infrastructure error on database failure', async () => {
    vi.mocked(prisma.payment.count).mockRejectedValue(new Error('boom'));

    await expect((getPaymentStats as ServerFn)({ data: {} })).rejects.toThrow(
      'Failed to fetch payment stats'
    );
  });

  it('rethrows application errors from the database', async () => {
    const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'payment missing');
    vi.mocked(prisma.payment.count).mockRejectedValue(appError);

    await expect((getPaymentStats as ServerFn)({ data: {} })).rejects.toBe(appError);
  });
});

describe('getPaymentsPaginated sort options', () => {
  const basePayment = {
    id: 1,
    amount: new Prisma.Decimal('100'),
    colleague: { name: 'Alice' },
    restaurant: null,
    applications: [],
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    paymentType: 'CASH',
    isApproved: true,
    colleagueId: 1,
    restaurantId: null,
    paymentProofBucket: null,
    paymentProofObjectKey: null,
    createdBy: null,
    expenseId: null,
  };

  beforeEach(() => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(1);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([basePayment] as never);
  });

  it.each([
    ['date', [{ date: 'asc' }, { createdAt: 'desc' }]],
    ['amount', [{ amount: 'asc' }, { createdAt: 'desc' }]],
    ['paymentType', [{ paymentType: 'asc' }, { createdAt: 'desc' }]],
    ['colleagueName', [{ colleague: { name: 'asc' } }, { createdAt: 'desc' }]],
  ] as const)('sorts by %s', async (sortBy, expectedOrderBy) => {
    await (getPaymentsPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy, sortOrder: 'asc' },
    });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expectedOrderBy })
    );
  });
});

describe('getPaymentsPaginated error handling', () => {
  it('throws infrastructure error on database failure', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockRejectedValue(new Error('boom'));

    await expect(
      (getPaymentsPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } })
    ).rejects.toThrow('Failed to fetch paginated payments');
  });

  it('rethrows application errors', async () => {
    const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'payment missing');
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockRejectedValue(appError);

    await expect(
      (getPaymentsPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } })
    ).rejects.toBe(appError);
  });
});

describe('getPaymentById error handling', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('throws infrastructure error on database failure', async () => {
    vi.mocked(prisma.payment.findUnique).mockRejectedValue(new Error('boom'));

    await expect((getPaymentById as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Failed to fetch payment'
    );
  });
});

describe('getPaymentProofUrl malformed application', () => {
  it('returns null when a non-empty application list has no first item', async () => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [undefined],
    } as never);

    await expect((getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } })).resolves.toEqual(
      {
        url: null,
      }
    );
  });
});

describe('getPaymentProofUrl error identity', () => {
  it('rethrows application errors', async () => {
    const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'payment missing');
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findUnique).mockRejectedValue(appError);

    await expect((getPaymentProofUrl as ServerFn)({ data: { participantId: 1 } })).rejects.toBe(
      appError
    );
  });
});

describe('getPaymentProofUrlByPaymentId error identity', () => {
  it('rethrows application errors', async () => {
    const appError = new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'payment missing');
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findUnique).mockRejectedValue(appError);

    await expect(
      (getPaymentProofUrlByPaymentId as ServerFn)({ data: { paymentId: 1 } })
    ).rejects.toBe(appError);
  });
});
