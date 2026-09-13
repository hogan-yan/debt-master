import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ErrorCode } from '@/utils/errors';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    const builder = {
      validator: () => builder,
      inputValidator: () => builder,
      handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => fn,
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

const mockGetAuth = vi.fn();
const mockRequireAuth = vi.fn();
const mockPrisma = {
  colleague: { findMany: vi.fn() },
  expenseParticipant: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  payment: { groupBy: vi.fn(), findMany: vi.fn() },
};

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: mockGetAuth,
  requireAuthFromCookie: mockRequireAuth,
}));
vi.mock('@/server/infrastructure/prisma', () => ({ prisma: mockPrisma }));
vi.mock('./workflows/colleagues-workflow', () => ({
  buildColleagueWithBalance: vi.fn((_c, _b, _e, _p, _f) => ({
    id: _c.id,
    name: _c.name,
    currentBalance: _b?.currentBalance ?? 0,
    totalOwed: _b?.totalOwed ?? 0,
    totalPaid: _b?.totalPaid ?? 0,
    lastActivity: 'today',
  })),
  filterOwingColleagues: vi.fn((c) =>
    c.filter((x: { currentBalance: number }) => x.currentBalance < -0.01)
  ),
  transformPendingPayments: vi.fn((p) => p),
}));
vi.mock('./analytics-helpers', () => ({ formatDaysAgo: vi.fn(() => 'today') }));

const { getColleaguesWithBalances, getColleaguesWhoOwe, getPendingPayments } = await import(
  './colleagues'
);

describe('getColleaguesWithBalances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(null);
    const result = (await getColleaguesWithBalances({ data: undefined })) as unknown[];
    expect(result).toEqual([]);
  });

  it('returns colleagues with balances', async () => {
    mockGetAuth.mockResolvedValue({ isAdmin: true });
    mockPrisma.colleague.findMany.mockResolvedValue([
      { id: 1, name: 'Alice', createdAt: new Date() },
    ]);
    mockPrisma.expenseParticipant.groupBy.mockResolvedValue([
      { colleagueId: 1, _sum: { amount: 100 } },
    ]);
    mockPrisma.payment.groupBy
      .mockResolvedValueOnce([{ colleagueId: 1, _sum: { amount: 50 } }])
      .mockResolvedValueOnce([{ colleagueId: 1, _max: { date: new Date() } }]);
    mockPrisma.expenseParticipant.findMany.mockResolvedValue([]);

    const result = (await getColleaguesWithBalances({ data: undefined })) as unknown[];
    expect(result).toHaveLength(1);
  });

  it('returns empty when no colleagues', async () => {
    mockGetAuth.mockResolvedValue({ isAdmin: true });
    mockPrisma.colleague.findMany.mockResolvedValue([]);

    const result = (await getColleaguesWithBalances({ data: undefined })) as unknown[];
    expect(result).toEqual([]);
  });

  it('rethrows AppError as-is', async () => {
    mockGetAuth.mockResolvedValue({ isAdmin: true });
    mockPrisma.colleague.findMany.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'Colleague not found')
    );
    await expect(getColleaguesWithBalances({ data: undefined })).rejects.toThrow(
      new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'Colleague not found')
    );
  });

  it('throws infrastructure error for non-AppError', async () => {
    mockGetAuth.mockResolvedValue({ isAdmin: true });
    mockPrisma.colleague.findMany.mockRejectedValue('string error');
    await expect(getColleaguesWithBalances({ data: undefined })).rejects.toThrow(
      'Failed to fetch colleagues with balances'
    );
  });
});

describe('getColleaguesWhoOwe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockResolvedValue({ isAdmin: true });
  });

  it('returns empty when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(null);
    const result = (await getColleaguesWhoOwe({ data: undefined })) as unknown[];
    expect(result).toEqual([]);
  });

  it('returns colleagues with negative balance', async () => {
    const { buildColleagueWithBalance } = await import('./workflows/colleagues-workflow');
    vi.mocked(buildColleagueWithBalance).mockReturnValue({
      id: 1,
      name: 'Alice',
      currentBalance: -100,
      totalOwed: 0,
      totalPaid: 0,
      lastActivity: 'today',
    });

    mockPrisma.colleague.findMany.mockResolvedValue([
      { id: 1, name: 'Alice', createdAt: new Date() },
    ]);
    mockPrisma.expenseParticipant.groupBy.mockResolvedValue([]);
    mockPrisma.payment.groupBy.mockResolvedValue([]).mockResolvedValue([]);
    mockPrisma.expenseParticipant.findMany.mockResolvedValue([]);

    const result = (await getColleaguesWhoOwe({ data: undefined })) as unknown[];
    expect(result).toHaveLength(1);
  });

  it('rethrows AppError as-is', async () => {
    const { filterOwingColleagues } = await import('./workflows/colleagues-workflow');
    vi.mocked(filterOwingColleagues).mockImplementation(() => {
      throw new AppError(ErrorCode.BUSINESS_NO_UNPAID_EXPENSES, 'No unpaid expenses');
    });

    mockPrisma.colleague.findMany.mockResolvedValue([
      { id: 1, name: 'Alice', createdAt: new Date() },
    ]);
    mockPrisma.expenseParticipant.groupBy.mockResolvedValue([]);
    mockPrisma.payment.groupBy.mockResolvedValue([]).mockResolvedValue([]);
    mockPrisma.expenseParticipant.findMany.mockResolvedValue([]);

    await expect(getColleaguesWhoOwe({ data: undefined })).rejects.toThrow(
      new AppError(ErrorCode.BUSINESS_NO_UNPAID_EXPENSES, 'No unpaid expenses')
    );
  });

  it('throws infrastructure error when filter fails', async () => {
    const { filterOwingColleagues } = await import('./workflows/colleagues-workflow');
    vi.mocked(filterOwingColleagues).mockImplementation(() => {
      throw new Error('filter fail');
    });

    await expect(getColleaguesWhoOwe({ data: undefined })).rejects.toThrow(
      'Failed to fetch colleagues who owe money'
    );
  });
});

describe('getPendingPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when not admin', async () => {
    mockRequireAuth.mockResolvedValue({ isAdmin: false });
    await expect(getPendingPayments({ data: undefined })).rejects.toThrow('Admin access required');
  });

  it('returns pending payments for admin', async () => {
    mockRequireAuth.mockResolvedValue({ isAdmin: true });
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 1,
        amount: 50,
        date: new Date(),
        colleague: { name: 'A' },
        restaurant: null,
        submittedAt: new Date(),
        paymentType: 'CASH',
      },
    ]);
    const { transformPendingPayments } = await import('./workflows/colleagues-workflow');
    vi.mocked(transformPendingPayments).mockReturnValue([
      { id: 1, amount: 50, date: '2024-01-01', colleague: 'A', paymentType: 'CASH' },
    ]);
    const result = (await getPendingPayments({ data: undefined })) as unknown[];
    expect(result).toHaveLength(1);
  });

  it('rethrows AppError as-is', async () => {
    mockRequireAuth.mockResolvedValue({ isAdmin: true });
    mockPrisma.payment.findMany.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found')
    );
    await expect(getPendingPayments({ data: undefined })).rejects.toThrow(
      new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found')
    );
  });

  it('throws infrastructure error on unexpected exception', async () => {
    mockRequireAuth.mockResolvedValue({ isAdmin: true });
    mockPrisma.payment.findMany.mockRejectedValue(new Error('fail'));
    await expect(getPendingPayments({ data: undefined })).rejects.toThrow(
      'Failed to fetch pending payments'
    );
  });
});
