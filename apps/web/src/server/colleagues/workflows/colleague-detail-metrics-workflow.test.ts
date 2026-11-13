import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTx } from '@/test/helpers/mock-transaction';
import {
  type ColleagueDetailMetricsWorkflowInput,
  colleagueDetailMetricsWorkflow,
  computeDetailMetrics,
} from './colleague-detail-metrics-workflow';

describe('colleagueDetailMetricsWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseParticipantAggregate: ReturnType<typeof vi.fn>;
  let paymentAggregate: ReturnType<typeof vi.fn>;
  let expenseParticipantFindMany: ReturnType<typeof vi.fn>;
  let paymentFindMany: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    expenseParticipantAggregate = vi.fn();
    paymentAggregate = vi.fn();
    expenseParticipantFindMany = vi.fn();
    paymentFindMany = vi.fn();

    mockTx = createMockTx({
      expenseParticipant: {
        aggregate: expenseParticipantAggregate,
        findMany: expenseParticipantFindMany,
      },
      payment: {
        aggregate: paymentAggregate,
        findMany: paymentFindMany,
      },
    });
    vi.clearAllMocks();
  });

  const defaultInput: ColleagueDetailMetricsWorkflowInput = {
    colleagueId: 1,
  };

  it('should calculate metrics for a colleague with expenses and payments', async () => {
    expenseParticipantAggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('300.00') },
      _count: 5,
    });
    paymentAggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('150.00') },
      _count: 2,
    });
    expenseParticipantFindMany.mockResolvedValue([
      { amount: new Prisma.Decimal('100.00'), expense: { date: new Date('2026-05-15') } },
      { amount: new Prisma.Decimal('200.00'), expense: { date: new Date('2026-05-10') } },
    ]);
    paymentFindMany.mockResolvedValue([
      { amount: new Prisma.Decimal('100.00'), date: new Date('2026-05-12') },
      { amount: new Prisma.Decimal('50.00'), date: new Date('2026-05-08') },
    ]);

    const result = await colleagueDetailMetricsWorkflow(mockTx, {}, defaultInput);

    expect(result.totalOwed).toBe(300);
    expect(result.totalPaid).toBe(150);
    expect(result.currentBalance).toBe(-150);
    expect(result.expenseCount).toBe(5);
    expect(result.paymentCount).toBe(2);
    expect(result.lastActivityDate).toEqual(new Date('2026-05-15'));
  });

  it('should handle colleague with no expenses or payments', async () => {
    expenseParticipantAggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: 0,
    });
    paymentAggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: 0,
    });
    expenseParticipantFindMany.mockResolvedValue([]);
    paymentFindMany.mockResolvedValue([]);

    const result = await colleagueDetailMetricsWorkflow(mockTx, {}, defaultInput);

    expect(result.totalOwed).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.currentBalance).toBe(0);
    expect(result.debtAgeDays).toBeNull();
    expect(result.lastActivityDate).toBeNull();
    expect(result.agingBuckets).toEqual({
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90plus: 0,
    });
  });

  it('should compute aging buckets correctly', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);

    const fortyDaysAgo = new Date(today);
    fortyDaysAgo.setDate(today.getDate() - 40);

    const hundredDaysAgo = new Date(today);
    hundredDaysAgo.setDate(today.getDate() - 100);

    expenseParticipantAggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('600.00') },
      _count: 3,
    });
    paymentAggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('0.00') },
      _count: 0,
    });
    expenseParticipantFindMany.mockResolvedValue([
      { amount: new Prisma.Decimal('100.00'), expense: { date: fiveDaysAgo } },
      { amount: new Prisma.Decimal('200.00'), expense: { date: fortyDaysAgo } },
      { amount: new Prisma.Decimal('300.00'), expense: { date: hundredDaysAgo } },
    ]);
    paymentFindMany.mockResolvedValue([]);

    const result = await colleagueDetailMetricsWorkflow(mockTx, {}, defaultInput);

    expect(result.agingBuckets.current).toBe(0);
    expect(result.agingBuckets.days1to30).toBe(100);
    expect(result.agingBuckets.days31to60).toBe(200);
    expect(result.agingBuckets.days61to90).toBe(0);
    expect(result.agingBuckets.days90plus).toBe(300);
  });
});

describe('computeDetailMetrics', () => {
  it('should compute detail metrics from input', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const result = computeDetailMetrics({
      totalOwed: 500,
      totalPaid: 300,
      expenseCount: 5,
      paymentCount: 2,
      transactions: [
        { type: 'expense', amount: 300, date: today },
        { type: 'payment', amount: 200, date: today },
      ],
      lastExpenseDate: today,
      lastPaymentDate: today,
    });

    expect(result.totalOwed).toBe(500);
    expect(result.totalPaid).toBe(300);
    expect(result.currentBalance).toBe(-200);
    expect(result.expenseCount).toBe(5);
    expect(result.paymentCount).toBe(2);
    expect(result.lastActivityDate).toEqual(today);
  });
});
