import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTx } from '@/test/helpers/mock-transaction';
import { colleaguesBalanceWorkflow } from './colleagues-balance-workflow';

describe('colleaguesBalanceWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let colleagueFindMany: ReturnType<typeof vi.fn>;
  let expenseParticipantGroupBy: ReturnType<typeof vi.fn>;
  let paymentGroupBy: ReturnType<typeof vi.fn>;
  let expenseParticipantFindMany: ReturnType<typeof vi.fn>;
  let paymentFindMany: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    colleagueFindMany = vi.fn();
    expenseParticipantGroupBy = vi.fn();
    paymentGroupBy = vi.fn();
    expenseParticipantFindMany = vi.fn();
    paymentFindMany = vi.fn();

    mockTx = createMockTx({
      colleague: { findMany: colleagueFindMany },
      expenseParticipant: {
        findMany: expenseParticipantFindMany,
        groupBy: expenseParticipantGroupBy,
      },
      payment: {
        findMany: paymentFindMany,
        groupBy: paymentGroupBy,
      },
    });
    vi.clearAllMocks();
  });

  it('returns empty when no colleagues', async () => {
    colleagueFindMany.mockResolvedValue([]);
    expenseParticipantGroupBy.mockResolvedValue([]);
    paymentGroupBy.mockResolvedValue([]);

    const result = await colleaguesBalanceWorkflow(mockTx, {}, {});

    expect(result).toEqual([]);
  });

  it('builds colleagues with balances', async () => {
    colleagueFindMany.mockResolvedValue([
      { id: 1, name: 'Alice', createdAt: new Date('2026-01-01') },
      { id: 2, name: 'Bob', createdAt: new Date('2026-01-02') },
    ]);
    expenseParticipantGroupBy.mockResolvedValue([
      { colleagueId: 1, _sum: { amount: new Prisma.Decimal('300.00') } },
      { colleagueId: 2, _sum: { amount: new Prisma.Decimal('150.00') } },
    ]);
    paymentGroupBy
      .mockResolvedValueOnce([
        { colleagueId: 1, _sum: { amount: new Prisma.Decimal('100.00') } },
        { colleagueId: 2, _sum: { amount: new Prisma.Decimal('200.00') } },
      ])
      .mockResolvedValueOnce([
        { colleagueId: 1, _max: { date: new Date('2026-05-12') } },
        { colleagueId: 2, _max: { date: new Date('2026-05-08') } },
      ]);
    expenseParticipantFindMany.mockResolvedValue([
      { colleagueId: 1, expense: { date: new Date('2026-05-15') } },
      { colleagueId: 2, expense: { date: new Date('2026-05-10') } },
    ]);

    const result = await colleaguesBalanceWorkflow(mockTx, {}, {});

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      name: 'Alice',
      totalOwed: 300,
      totalPaid: 100,
      currentBalance: -200,
    });
    expect(result[1]).toMatchObject({
      id: 2,
      name: 'Bob',
      totalOwed: 150,
      totalPaid: 200,
      currentBalance: 50,
    });
  });

  it('handles zero balances', async () => {
    colleagueFindMany.mockResolvedValue([{ id: 1, name: 'Alice', createdAt: new Date() }]);
    expenseParticipantGroupBy.mockResolvedValue([]);
    paymentGroupBy.mockResolvedValue([]);
    expenseParticipantFindMany.mockResolvedValue([]);

    const result = await colleaguesBalanceWorkflow(mockTx, {}, {});

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      name: 'Alice',
      totalOwed: 0,
      totalPaid: 0,
      currentBalance: 0,
    });
  });

  it('treats null aggregate amounts as zero', async () => {
    colleagueFindMany.mockResolvedValue([{ id: 1, name: 'Alice', createdAt: new Date() }]);
    expenseParticipantGroupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: null } }]);
    paymentGroupBy
      .mockResolvedValueOnce([{ colleagueId: 1, _sum: { amount: null } }])
      .mockResolvedValueOnce([{ colleagueId: 1, _max: { date: null } }]);
    expenseParticipantFindMany.mockResolvedValue([]);

    const result = await colleaguesBalanceWorkflow(mockTx, {}, {});

    expect(result[0]).toMatchObject({
      totalOwed: 0,
      totalPaid: 0,
      currentBalance: 0,
      lastActivity: 'No recent activity',
    });
  });
});
