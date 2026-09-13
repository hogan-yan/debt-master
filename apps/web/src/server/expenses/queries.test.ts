import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    expense: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    expenseParticipant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
}));

vi.mock('@/server/infrastructure/storage', () => ({
  getStorageUrl: vi.fn().mockResolvedValue('https://minio.example.com/receipt.jpg'),
}));

vi.mock('./serialization', () => ({
  EXPENSE_INCLUDE: {},
  serializeExpense: vi.fn((expense) => ({
    ...expense,
    amount: expense.amount instanceof Prisma.Decimal ? Number(expense.amount) : expense.amount,
    participants: expense.participants || [],
  })),
}));

vi.mock('./schemas', () => ({
  paginationSchema: {
    parse: vi.fn((data) => ({
      page: data.page || 1,
      pageSize: data.pageSize || 10,
      search: data.search || undefined,
      sortBy: data.sortBy || 'date',
      sortOrder: data.sortOrder || 'desc',
      colleagueIds: data.colleagueIds || undefined,
      paymentStatus: data.paymentStatus || 'all',
    })),
  },
}));

import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { getStorageUrl } from '@/server/infrastructure/storage';
import { AppError, ErrorCode } from '@/utils/errors';
import {
  checkParticipantPendingStatus,
  filterExpensesByPaymentStatus,
  getExpenseById,
  getExpensePaymentProofUrl,
  getExpenseReceiptUrl,
  getExpenseStats,
  getExpensesPaginated,
  getPendingClaimsForExpense,
  getPendingPaymentClaims,
  getUnpaidExpensesForColleague,
} from './queries';

// biome-ignore lint/suspicious/noExplicitAny: test helper to call mocked server functions with loose typing
type ServerFn = (ctx: { data: any }) => Promise<any>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getExpensesPaginated', () => {
  it('returns empty paginated response when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getExpensesPaginated as ServerFn)({ data: {} });

    expect(result.data).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
  });

  it('returns paginated data for authenticated user', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(2);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        participants: [],
        items: [],
        restaurant: { name: 'R1' },
      },
      {
        id: 2,
        amount: new Prisma.Decimal('50'),
        participants: [],
        items: [],
        restaurant: { name: 'R2' },
      },
    ] as never);

    const result = await (getExpensesPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } });

    expect(result.pagination.totalCount).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(prisma.expense.findMany).toHaveBeenCalled();
  });

  it('applies search filter', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(1);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        participants: [],
        items: [],
        restaurant: { name: 'Test' },
      },
    ] as never);

    const result = await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, search: 'test' },
    });

    expect(result.data).toHaveLength(1);
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });

  it('filters by payment status via lightweight participant rows', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    // per-participant status rows: id 1 fully paid, id 2 not paid
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('100'),
        paymentApplications: [{ amount: new Prisma.Decimal('100') }],
      },
      {
        expenseId: 2,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [],
      },
    ] as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        participants: [{ isPaid: true }],
        items: [],
        restaurant: { name: 'R1' },
      },
    ] as never);

    const result = await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, paymentStatus: 'paid' },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(1);
    expect(result.pagination.totalCount).toBe(1);
    // the page fetch is scoped to the matching id, still paginated with includes
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [1] } }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      })
    );
  });
});

describe('getExpenseStats', () => {
  it('returns zeros when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getExpenseStats as ServerFn)({ data: {} });

    expect(result).toEqual({
      totalExpenses: 0,
      totalAmount: 0,
      averageAmount: 0,
      uniqueRestaurants: 0,
    });
  });

  it('computes stats from the database (stats are no longer cached)', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(5);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('300') },
    } as never);
    vi.mocked(prisma.expense.groupBy).mockResolvedValue([
      { restaurantId: 1 },
      { restaurantId: 2 },
    ] as never);

    const result = await (getExpenseStats as ServerFn)({ data: {} });

    expect(result.totalExpenses).toBe(5);
    expect(result.totalAmount).toBe(300);
    expect(result.averageAmount).toBe(60);
    expect(result.uniqueRestaurants).toBe(2);
  });
});

describe('getExpenseById', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns serialized expense when found', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      amount: new Prisma.Decimal('100'),
      participants: [],
      items: [],
      restaurant: { name: 'Test' },
    } as never);

    const result = await (getExpenseById as ServerFn)({ data: { id: 1 } });

    expect(result).toEqual(expect.objectContaining({ id: 1 }));
    expect(prisma.expense.findUnique).toHaveBeenCalledWith({ where: { id: 1 }, include: {} });
  });

  it('throws when expense not found', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);

    await expect((getExpenseById as ServerFn)({ data: { id: 999 } })).rejects.toThrow(
      'Expense not found'
    );
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Authentication required'));

    await expect((getExpenseById as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Authentication required'
    );
  });
});

describe('getExpenseReceiptUrl', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns URL when receipt exists', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: 'receipts',
      receiptObjectKey: 'receipt-1.jpg',
    } as never);

    const result = await (getExpenseReceiptUrl as ServerFn)({ data: { expenseId: 1 } });

    expect(getStorageUrl).toHaveBeenCalledWith('receipts', 'receipt-1.jpg');
    expect(result).toEqual({ url: 'https://minio.example.com/receipt.jpg' });
  });

  it('returns null URL when no receipt', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: null,
      receiptObjectKey: null,
    } as never);

    const result = await (getExpenseReceiptUrl as ServerFn)({ data: { expenseId: 1 } });

    expect(result).toEqual({ url: null });
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Authentication required'));

    await expect((getExpenseReceiptUrl as ServerFn)({ data: { expenseId: 1 } })).rejects.toThrow(
      'Authentication required'
    );
  });
});

describe('getExpensePaymentProofUrl', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns URL when approved proof exists', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [
        {
          payment: {
            isApproved: true,
            paymentProofBucket: 'proofs',
            paymentProofObjectKey: 'proof-1.jpg',
          },
        },
      ],
    } as never);

    const result = await (getExpensePaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(result).toEqual({ url: 'https://minio.example.com/receipt.jpg' });
  });

  it('returns null when payment not approved', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [
        {
          payment: {
            isApproved: false,
            paymentProofBucket: 'proofs',
            paymentProofObjectKey: 'proof-1.jpg',
          },
        },
      ],
    } as never);

    const result = await (getExpensePaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(result).toEqual({ url: null });
  });

  it('returns null when no payment applications', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [],
    } as never);

    const result = await (getExpensePaymentProofUrl as ServerFn)({ data: { participantId: 1 } });

    expect(result).toEqual({ url: null });
  });
});

describe('getUnpaidExpensesForColleague', () => {
  it('returns empty array when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getUnpaidExpensesForColleague as ServerFn)({ data: { colleagueId: 1 } });

    expect(result).toEqual([]);
  });

  it('returns unpaid expenses for authenticated user', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        expense: {
          id: 1,
          date: new Date('2024-06-01'),
          amount: new Prisma.Decimal('100'),
          restaurant: { name: 'R1' },
          restaurantId: 1,
          notes: null,
          participants: [{}, {}],
          splitType: 'EQUAL',
        },
        amount: new Prisma.Decimal('50'),
        paymentApplications: [],
      },
    ] as never);

    const result = await (getUnpaidExpensesForColleague as ServerFn)({ data: { colleagueId: 1 } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ remainingOwed: 50 }));
  });
});

describe('checkParticipantPendingStatus', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns hasPendingClaim=true when pending exists', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      colleagueId: 1,
      expense: { restaurantId: 1 },
    } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { submittedAt: new Date('2024-06-01') },
    ] as never);

    const result = await (checkParticipantPendingStatus as ServerFn)({
      data: { participantId: 1 },
    });

    expect(result).toEqual({ hasPendingClaim: true, submittedAt: expect.any(Date) });
  });

  it('returns hasPendingClaim=false when no pending', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      colleagueId: 1,
      expense: { restaurantId: 1 },
    } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const result = await (checkParticipantPendingStatus as ServerFn)({
      data: { participantId: 1 },
    });

    expect(result).toEqual({ hasPendingClaim: false, submittedAt: null });
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Authentication required'));

    await expect(
      (checkParticipantPendingStatus as ServerFn)({ data: { participantId: 1 } })
    ).rejects.toThrow('Authentication required');
  });
});

describe('getPendingClaimsForExpense', () => {
  it('returns empty array when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getPendingClaimsForExpense as ServerFn)({ data: { expenseId: 1 } });

    expect(result).toEqual([]);
  });

  it('returns pending claims for authenticated user', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        submittedAt: new Date('2024-06-01'),
        paymentProofBucket: 'proofs',
        paymentProofObjectKey: 'proof-1.jpg',
        colleague: { name: 'Alice' },
        colleagueId: 1,
      },
    ] as never);

    const result = await (getPendingClaimsForExpense as ServerFn)({ data: { expenseId: 1 } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ colleagueName: 'Alice', hasPaymentProof: true })
    );
  });
});

describe('getPendingPaymentClaims', () => {
  it('returns empty array when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getPendingPaymentClaims as ServerFn)({ data: {} });

    expect(result).toEqual([]);
  });

  it('returns all pending claims for authenticated user', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        submittedAt: new Date('2024-06-01'),
        paymentType: 'PAYME',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        restaurantId: 1,
        colleague: { name: 'Alice' },
        restaurant: { name: 'R1' },
        expenseId: 1,
      },
    ] as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        colleagueId: 1,
        expenseId: 1,
        id: 10,
        expense: { id: 1, date: new Date('2024-06-01'), amount: new Prisma.Decimal('100') },
        colleague: { name: 'Alice' },
      },
    ] as never);

    const result = await (getPendingPaymentClaims as ServerFn)({ data: {} });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: 1, colleague: expect.objectContaining({ name: 'Alice' }) })
    );
  });
});

describe('filterExpensesByPaymentStatus', () => {
  const expenses = [
    { id: 1, participants: [{ isPaid: true }, { isPaid: true }] },
    { id: 2, participants: [{ isPaid: false }, { isPaid: false }] },
    { id: 3, participants: [{ isPaid: true }, { isPaid: false }] },
    { id: 4, participants: [] },
  ];

  it('returns all for status all', () => {
    expect(filterExpensesByPaymentStatus(expenses, 'all')).toHaveLength(4);
  });

  it('filters paid expenses', () => {
    expect(filterExpensesByPaymentStatus(expenses, 'paid')).toEqual([expenses[0]]);
  });

  it('filters unpaid expenses', () => {
    expect(filterExpensesByPaymentStatus(expenses, 'unpaid')).toEqual([expenses[1], expenses[3]]);
  });

  it('filters partial expenses', () => {
    expect(filterExpensesByPaymentStatus(expenses, 'partial')).toEqual([expenses[2]]);
  });
});

describe('getExpensesPaginated additional branches', () => {
  it('filters by colleagueIds', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(1);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        participants: [],
        items: [],
        restaurant: { name: 'R1' },
      },
    ] as never);

    await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, colleagueIds: [1, 2] },
    });

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          participants: expect.objectContaining({
            some: expect.objectContaining({ colleagueId: { in: [1, 2] } }),
          }),
        }),
      })
    );
  });

  it('sorts by restaurant', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(0);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy: 'restaurant', sortOrder: 'asc' },
    });

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ restaurant: { name: 'asc' } }, { createdAt: 'desc' }],
      })
    );
  });

  it('sorts by amount', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(0);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy: 'amount', sortOrder: 'desc' },
    });

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }],
      })
    );
  });

  it('throws infrastructure error on unexpected exception', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockRejectedValue(new Error('db fail'));

    await expect(
      (getExpensesPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } })
    ).rejects.toThrow('Failed to fetch paginated expenses');
  });
});

describe('getExpensePaymentProofUrl additional branches', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns null when payment proof fields are missing', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [
        { payment: { isApproved: true, paymentProofBucket: null, paymentProofObjectKey: null } },
      ],
    } as never);

    const result = await (getExpensePaymentProofUrl as ServerFn)({ data: { participantId: 1 } });
    expect(result).toEqual({ url: null });
  });

  it('throws infrastructure error on unexpected exception', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockRejectedValue(new Error('db fail'));

    await expect(
      (getExpensePaymentProofUrl as ServerFn)({ data: { participantId: 1 } })
    ).rejects.toThrow('Failed to get payment proof URL');
  });
});

describe('getUnpaidExpensesForColleague error branch', () => {
  it('returns default object on error', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockRejectedValue(new Error('db fail'));

    await expect(
      (getUnpaidExpensesForColleague as ServerFn)({ data: { colleagueId: 1 } })
    ).rejects.toThrow('Failed to fetch unpaid expenses for colleague');
  });
});

describe('checkParticipantPendingStatus error branch', () => {
  it('throws infrastructure error on unexpected exception (fail loud, guards duplicate claims)', async () => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findUnique).mockRejectedValue(new Error('db fail'));

    await expect(
      (checkParticipantPendingStatus as ServerFn)({ data: { participantId: 1 } })
    ).rejects.toThrow('Failed to check pending claim status');
  });
});

describe('getPendingClaimsForExpense error branch', () => {
  it('throws infrastructure error on unexpected exception', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockRejectedValue(new Error('db fail'));

    await expect(
      (getPendingClaimsForExpense as ServerFn)({ data: { expenseId: 1 } })
    ).rejects.toThrow('Failed to fetch pending payment claims for expense');
  });
});

describe('filterExpensesByPaymentStatus additional branches', () => {
  it('partial status excludes all-paid and all-unpaid', () => {
    const expenses = [
      { id: 1, participants: [{ isPaid: true }, { isPaid: true }] },
      { id: 2, participants: [{ isPaid: false }, { isPaid: false }] },
      { id: 3, participants: [{ isPaid: true }, { isPaid: false }] },
      { id: 4, participants: [] },
    ];
    expect(filterExpensesByPaymentStatus(expenses, 'partial')).toEqual([expenses[2]]);
  });

  it('partial status excludes empty participants', () => {
    const expenses = [{ id: 1, participants: [] }];
    expect(filterExpensesByPaymentStatus(expenses, 'partial')).toEqual([]);
  });

  it('partial status with single paid participant', () => {
    const expenses = [
      { id: 1, participants: [{ isPaid: true }, { isPaid: false }, { isPaid: false }] },
    ];
    expect(filterExpensesByPaymentStatus(expenses, 'partial')).toEqual([expenses[0]]);
  });

  it('partial status with single unpaid participant', () => {
    const expenses = [
      { id: 1, participants: [{ isPaid: true }, { isPaid: true }, { isPaid: false }] },
    ];
    expect(filterExpensesByPaymentStatus(expenses, 'partial')).toEqual([expenses[0]]);
  });
});

describe('getExpensesPaginated sortBy branches', () => {
  it('sorts by date', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(0);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy: 'date', sortOrder: 'asc' },
    });

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
      })
    );
  });

  it('sorts by splitType', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(0);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy: 'splitType', sortOrder: 'desc' },
    });

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ splitType: 'desc' }, { createdAt: 'desc' }],
      })
    );
  });

  it('sorts by createdAt', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(0);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);

    await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'asc' },
    });

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }, { createdAt: 'desc' }],
      })
    );
  });
});

describe('getExpensesPaginated paymentStatus partial', () => {
  it('filters by partial payment status with mixed participants', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    // per-participant rows: expense 1 mixed, expense 2 fully paid, expense 3 unpaid
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [{ amount: new Prisma.Decimal('50') }],
      },
      {
        expenseId: 1,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [],
      },
      {
        expenseId: 2,
        amount: new Prisma.Decimal('25'),
        paymentApplications: [{ amount: new Prisma.Decimal('25') }],
      },
      {
        expenseId: 2,
        amount: new Prisma.Decimal('25'),
        paymentApplications: [{ amount: new Prisma.Decimal('25') }],
      },
      {
        expenseId: 3,
        amount: new Prisma.Decimal('75'),
        paymentApplications: [],
      },
      {
        expenseId: 3,
        amount: new Prisma.Decimal('75'),
        paymentApplications: [],
      },
    ] as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('100'),
        participants: [{ isPaid: true }, { isPaid: false }],
        items: [],
        restaurant: { name: 'R1' },
      },
    ] as never);

    const result = await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, paymentStatus: 'partial' },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(1);
    expect(result.pagination.totalCount).toBe(1);
  });
});

describe('getExpensePaymentProofUrl firstApplication falsy', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns null when firstApplication is undefined despite length > 0', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      paymentApplications: [undefined],
    } as never);

    const result = await (getExpensePaymentProofUrl as ServerFn)({ data: { participantId: 1 } });
    expect(result).toEqual({ url: null });
  });
});

describe('getExpenseStats error branches', () => {
  it('throws infrastructure error on generic exception', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockRejectedValue(new Error('db fail'));

    await expect((getExpenseStats as ServerFn)({ data: {} })).rejects.toThrow(
      'Failed to fetch expense stats'
    );
  });

  it('rethrows AppError without wrapping', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found')
    );

    await expect((getExpenseStats as ServerFn)({ data: {} })).rejects.toThrow('Expense not found');
  });
});

describe('getExpenseById error branch', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('throws infrastructure error on generic exception', async () => {
    vi.mocked(prisma.expense.findUnique).mockRejectedValue(new Error('db fail'));

    await expect((getExpenseById as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Failed to fetch expense'
    );
  });
});

describe('getExpenseReceiptUrl error branches', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('throws infrastructure error on generic exception', async () => {
    vi.mocked(prisma.expense.findUnique).mockRejectedValue(new Error('db fail'));

    await expect((getExpenseReceiptUrl as ServerFn)({ data: { expenseId: 1 } })).rejects.toThrow(
      'Failed to get expense receipt URL'
    );
  });

  it('rethrows AppError without wrapping', async () => {
    vi.mocked(prisma.expense.findUnique).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found')
    );

    await expect((getExpenseReceiptUrl as ServerFn)({ data: { expenseId: 1 } })).rejects.toThrow(
      'Expense not found'
    );
  });
});

describe('getUnpaidExpensesForColleague AppError rethrow', () => {
  it('rethrows AppError without wrapping', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found')
    );

    await expect(
      (getUnpaidExpensesForColleague as ServerFn)({ data: { colleagueId: 1 } })
    ).rejects.toThrow('Expense not found');
  });
});

describe('getUnpaidExpensesForColleague null paymentApplications', () => {
  it('handles null paymentApplications with optional chaining', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        expense: {
          id: 1,
          date: new Date('2024-06-01'),
          amount: new Prisma.Decimal('100'),
          restaurant: { name: 'R1' },
          restaurantId: 1,
          notes: null,
          participants: [{}, {}],
          splitType: 'EQUAL',
        },
        amount: new Prisma.Decimal('50'),
        paymentApplications: null,
      },
    ] as never);

    const result = await (getUnpaidExpensesForColleague as ServerFn)({ data: { colleagueId: 1 } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ remainingOwed: 50, totalApprovedPaid: 0 }));
  });
});

describe('getUnpaidExpensesForColleague optional relations', () => {
  it('excludes unapproved applications and uses relation fallbacks', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [
          { amount: new Prisma.Decimal('20'), payment: { isApproved: true } },
          { amount: new Prisma.Decimal('10'), payment: { isApproved: false } },
        ],
        expense: {
          id: 1,
          date: new Date('2024-06-01'),
          amount: new Prisma.Decimal('100'),
          restaurant: null,
          restaurantId: null,
          notes: null,
          participants: null,
          splitType: 'EQUAL',
        },
      },
    ] as never);

    const result = await (getUnpaidExpensesForColleague as ServerFn)({ data: { colleagueId: 1 } });

    expect(result).toEqual([
      expect.objectContaining({
        totalApprovedPaid: 20,
        remainingOwed: 30,
        restaurantName: 'Unknown Restaurant',
        participantCount: 0,
      }),
    ]);
  });
});

describe('checkParticipantPendingStatus missing participant', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns default object when participant not found', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue(null);

    const result = await (checkParticipantPendingStatus as ServerFn)({
      data: { participantId: 999 },
    });

    expect(result).toEqual({ hasPendingClaim: false, submittedAt: null });
  });
});

describe('getPendingPaymentClaims generic error throw', () => {
  it('throws infrastructure error on generic exception', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockRejectedValue(new Error('db connection lost'));

    await expect((getPendingPaymentClaims as ServerFn)({ data: {} })).rejects.toThrow(
      'Failed to fetch pending payment claims'
    );
  });
});

describe('getPendingPaymentClaims AppError rethrow', () => {
  it('rethrows AppError without wrapping', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found')
    );

    await expect((getPendingPaymentClaims as ServerFn)({ data: {} })).rejects.toThrow(
      'Payment not found'
    );
  });
});

describe('getPendingClaimsForExpense optional fields', () => {
  it('uses fallbacks for missing timestamps, proofs, and colleagues', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        submittedAt: null,
        paymentProofBucket: 'proofs',
        paymentProofObjectKey: null,
        colleague: null,
        colleagueId: 1,
      },
    ] as never);

    const result = await (getPendingClaimsForExpense as ServerFn)({ data: { expenseId: 1 } });

    expect(result[0]).toEqual(
      expect.objectContaining({
        colleagueName: 'Unknown',
        hasPaymentProof: false,
        submittedAt: expect.any(Date),
      })
    );
  });
});

describe('getPendingPaymentClaims empty relationships', () => {
  it('skips the participant query and omits absent related entities', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        submittedAt: null,
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        restaurantId: null,
        colleague: null,
        restaurant: null,
        expenseId: null,
        colleagueId: 1,
      },
    ] as never);

    const result = await (getPendingPaymentClaims as ServerFn)({ data: {} });

    expect(prisma.expenseParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ colleagueId: 1 }] } })
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        participantId: null,
        colleague: undefined,
        restaurant: undefined,
        expense: undefined,
      })
    );
  });

  it('does not query participants when no payments are pending', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    await expect((getPendingPaymentClaims as ServerFn)({ data: {} })).resolves.toEqual([]);
    expect(prisma.expenseParticipant.findMany).not.toHaveBeenCalled();
  });
});

describe('remaining expense query branches', () => {
  it('treats a missing participants relation as empty when filtering expenses', () => {
    expect(
      filterExpensesByPaymentStatus([{ id: 1, participants: undefined as never }], 'paid')
    ).toEqual([]);
  });

  it('returns a zero average when the database has no expenses', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockResolvedValue(0);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: null } } as never);
    vi.mocked(prisma.expense.groupBy).mockResolvedValue([] as never);

    await expect((getExpenseStats as ServerFn)({ data: {} })).resolves.toEqual({
      totalExpenses: 0,
      totalAmount: 0,
      averageAmount: 0,
      uniqueRestaurants: 0,
    });
  });

  it('rethrows AppError from paginated expense queries', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expense.count).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found')
    );

    await expect(
      (getExpensesPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } })
    ).rejects.toThrow('Expense not found');
  });

  it('rethrows AppError from payment proof lookups', async () => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findUnique).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found')
    );

    await expect(
      (getExpensePaymentProofUrl as ServerFn)({ data: { participantId: 1 } })
    ).rejects.toThrow('Expense not found');
  });

  it('rethrows AppError from pending claims by expense queries', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found')
    );

    await expect(
      (getPendingClaimsForExpense as ServerFn)({ data: { expenseId: 1 } })
    ).rejects.toThrow('Payment not found');
  });

  it('omits an expense when its matched participant has none', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        submittedAt: null,
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        restaurantId: null,
        colleague: null,
        restaurant: null,
        expenseId: null,
        colleagueId: 1,
      },
    ] as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        id: 10,
        colleagueId: 1,
        expenseId: null,
      },
    ] as never);

    const result = await (getPendingPaymentClaims as ServerFn)({ data: {} });

    expect(result[0]).toEqual(expect.objectContaining({ participantId: 10, expense: undefined }));
  });

  it('omits participant fields when a pending payment has no matching participant', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        submittedAt: null,
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        restaurantId: null,
        colleague: null,
        restaurant: null,
        expenseId: 1,
        colleagueId: 1,
      },
    ] as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([]);

    const result = await (getPendingPaymentClaims as ServerFn)({ data: {} });

    expect(result[0]).toEqual(expect.objectContaining({ participantId: null, expense: undefined }));
  });

  it('includes an expense from the matched participant', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 1,
        amount: new Prisma.Decimal('50'),
        submittedAt: null,
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        restaurantId: null,
        colleague: null,
        restaurant: null,
        expenseId: 1,
        colleagueId: 1,
      },
    ] as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        id: 10,
        colleagueId: 1,
        expenseId: 1,
        expense: {
          id: 1,
          date: new Date('2024-06-01'),
          amount: new Prisma.Decimal('100'),
        },
      },
    ] as never);

    const result = await (getPendingPaymentClaims as ServerFn)({ data: {} });

    expect(result[0]).toEqual(
      expect.objectContaining({
        expense: { id: 1, date: new Date('2024-06-01'), amount: 100 },
      })
    );
  });
});

describe('getExpensesPaginated paymentStatus edge branches', () => {
  it('keeps only expenses with zero paid participants for paymentStatus=unpaid', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    // expense 1 fully paid, expense 2 untouched, expense 3 mixed (one paid
    // participant, one unpaid) so it counts as neither unpaid nor paid
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [{ amount: new Prisma.Decimal('50') }],
      },
      {
        expenseId: 2,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [],
      },
      {
        expenseId: 3,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [{ amount: new Prisma.Decimal('50') }],
      },
      {
        expenseId: 3,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [],
      },
    ] as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: 2,
        amount: new Prisma.Decimal('50'),
        participants: [{ isPaid: false }],
        items: [],
        restaurant: { name: 'R2' },
      },
    ] as never);

    const result = await (getExpensesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, paymentStatus: 'unpaid' },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(2);
    expect(result.pagination.totalCount).toBe(1);
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [2] } }) })
    );
  });

  it('returns an empty page without querying expenses when the page is past the matches', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('50'),
        paymentApplications: [{ amount: new Prisma.Decimal('50') }],
      },
    ] as never);

    const result = await (getExpensesPaginated as ServerFn)({
      data: { page: 2, pageSize: 10, paymentStatus: 'paid' },
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.totalCount).toBe(1);
    expect(result.pagination.page).toBe(2);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });
});

describe('checkParticipantPendingStatus error branches', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('rethrows AppError without wrapping so callers can classify it', async () => {
    vi.mocked(prisma.expenseParticipant.findUnique).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found')
    );

    await expect(
      (checkParticipantPendingStatus as ServerFn)({ data: { participantId: 1 } })
    ).rejects.toThrow('Expense not found');
  });
});
