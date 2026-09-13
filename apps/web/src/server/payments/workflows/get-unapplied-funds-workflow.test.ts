import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUnappliedFundsWorkflow } from './get-unapplied-funds-workflow';

type MockFn = ReturnType<typeof vi.fn>;

interface MockTx {
  payment: { groupBy: MockFn };
  paymentApplication: { groupBy: MockFn };
  expenseParticipant: { findMany: MockFn };
}

function buildMockTx(): MockTx {
  return {
    payment: { groupBy: vi.fn() },
    paymentApplication: { groupBy: vi.fn() },
    expenseParticipant: { findMany: vi.fn() },
  };
}

describe('getUnappliedFundsWorkflow', () => {
  let mockTx: MockTx;
  let txClient: Prisma.TransactionClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = buildMockTx();
    // Single cast at assignment — no per-call-site casts needed
    txClient = mockTx as unknown as Prisma.TransactionClient;
  });

  it('returns empty when no payments exist', async () => {
    mockTx.payment.groupBy.mockResolvedValue([]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds).toEqual({});
  });

  it('calculates unapplied funds for colleagues with excess payments', async () => {
    mockTx.payment.groupBy.mockResolvedValue([
      { colleagueId: 1, _sum: { amount: 200 } },
      { colleagueId: 2, _sum: { amount: 150 } },
    ]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([
      { participantId: 10, _sum: { amount: 50 } },
      { participantId: 20, _sum: { amount: 150 } },
    ]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      { id: 10, colleagueId: 1 },
      { id: 20, colleagueId: 2 },
    ]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBe(150);
    expect(result.unappliedFunds[2]).toBeUndefined();
  });

  it('excludes amounts below 0.01 threshold', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: 100 } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([
      { participantId: 10, _sum: { amount: 100 } },
    ]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([{ id: 10, colleagueId: 1 }]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBeUndefined();
  });

  it('handles multiple participants mapping to same colleague', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: 300 } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([
      { participantId: 10, _sum: { amount: 50 } },
      { participantId: 11, _sum: { amount: 30 } },
    ]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      { id: 10, colleagueId: 1 },
      { id: 11, colleagueId: 1 },
    ]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBe(220);
  });

  it('includes colleague who paid but has no applications', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: 100 } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBe(100);
  });

  it('treats a colleague with applications but no payments as zero unapplied', async () => {
    // The colleague enters the union through applied funds only, so the paid
    // side of the subtraction falls back to zero and the negative result is
    // correctly excluded.
    mockTx.payment.groupBy.mockResolvedValue([]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([
      { participantId: 10, _sum: { amount: 80 } },
    ]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([{ id: 10, colleagueId: 1 }]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(Object.keys(result.unappliedFunds)).toEqual([]);
  });

  it('filters by colleagueIds when provided', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: 200 } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([{ id: 10, colleagueId: 1 }]);

    const result = await getUnappliedFundsWorkflow(txClient, { colleagueIds: [1] });

    expect(result.unappliedFunds[1]).toBe(200);
    expect(mockTx.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          colleagueId: { in: [1] },
        }),
      })
    );
    expect(mockTx.expenseParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { colleagueId: { in: [1] } },
      })
    );
  });

  it('passes no colleagueId filter when input is empty', async () => {
    mockTx.payment.groupBy.mockResolvedValue([]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([]);

    await getUnappliedFundsWorkflow(txClient, {});

    expect(mockTx.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isApproved: true },
      })
    );
  });

  it('excludes colleague when payment sum is null (treated as 0)', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: null } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBeUndefined();
  });

  it('handles application with no matching participant', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: 100 } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([
      { participantId: 99, _sum: { amount: 50 } },
    ]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([{ id: 10, colleagueId: 1 }]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBe(100);
  });

  it('handles colleague with only applied funds (no excess)', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: 50 } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([
      { participantId: 10, _sum: { amount: 80 } },
    ]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([{ id: 10, colleagueId: 1 }]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBeUndefined();
  });

  it('treats null application sums as zero when mapping applied amounts', async () => {
    mockTx.payment.groupBy.mockResolvedValue([{ colleagueId: 1, _sum: { amount: 100 } }]);
    mockTx.paymentApplication.groupBy.mockResolvedValue([
      { participantId: 10, _sum: { amount: null } },
    ]);
    mockTx.expenseParticipant.findMany.mockResolvedValue([{ id: 10, colleagueId: 1 }]);

    const result = await getUnappliedFundsWorkflow(txClient);

    expect(result.unappliedFunds[1]).toBe(100);
  });
});
