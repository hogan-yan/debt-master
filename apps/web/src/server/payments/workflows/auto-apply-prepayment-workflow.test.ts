/**
 * Auto Apply Prepayment Workflow Tests
 *
 * These tests verify the core business logic of auto-applying prepayments to unpaid expenses.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLockRawMocks, createMockTx } from '@/test/helpers/mock-transaction';
import {
  AutoApplyPrepaymentInput,
  autoApplyPrepaymentWorkflow,
  requirePaymentBalance,
} from './auto-apply-prepayment-workflow';

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

// =============================================================================
// TEST SETUP
// =============================================================================

describe('autoApplyPrepaymentWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let paymentFindMany: ReturnType<typeof vi.fn>;
  let expenseParticipantFindMany: ReturnType<typeof vi.fn>;
  let paymentApplicationCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    paymentFindMany = vi.fn();
    expenseParticipantFindMany = vi.fn();
    paymentApplicationCreate = vi.fn();

    mockTx = createMockTx(
      {
        payment: {
          findMany: paymentFindMany,
        },
        expenseParticipant: {
          findMany: expenseParticipantFindMany,
        },
        paymentApplication: {
          create: paymentApplicationCreate,
        },
      },
      createLockRawMocks()
    );
  });

  const createMockPayment = (overrides: Record<string, unknown> = {}) => ({
    id: 100,
    colleagueId: 5,
    amount: new Prisma.Decimal('100.00'),
    date: new Date(),
    paymentType: 'CASH',
    restaurantId: 1,
    expenseId: null,
    isApproved: true,
    submittedAt: new Date(),
    createdAt: new Date('2024-01-01'),
    createdBy: 'ADMIN',
    paymentProofBucket: null,
    paymentProofObjectKey: null,
    applications: [],
    ...overrides,
  });

  const createMockParticipant = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    expenseId: 10,
    colleagueId: 5,
    amount: new Prisma.Decimal('50.00'),
    expense: {
      id: 10,
      date: new Date('2024-06-15'),
      amount: new Prisma.Decimal('100.00'),
      restaurantId: 1,
      restaurant: {
        id: 1,
        name: 'Test Restaurant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      splitType: 'EQUAL',
      notes: null,
      receiptBucket: null,
      receiptObjectKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    paymentApplications: [],
    ...overrides,
  });

  const baseInput: AutoApplyPrepaymentInput = {
    colleagueId: 5,
  };

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  it('should apply single payment to single expense fully', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('100.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('50.00') }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('50.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(paymentApplicationCreate).toHaveBeenCalledWith({
      data: {
        paymentId: 100,
        expenseId: 10,
        participantId: 1,
        amount: new Prisma.Decimal('50'),
      },
    });
    expect(result.totalApplied).toBe(5000n);
    expect(result.remainingBalance).toBe(5000n);
    expect(result.applications).toHaveLength(1);
  });

  it('should apply single payment across multiple expenses', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('100.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, expenseId: 10, amount: new Prisma.Decimal('40.00') }),
      createMockParticipant({ id: 2, expenseId: 11, amount: new Prisma.Decimal('40.00') }),
    ]);
    paymentApplicationCreate
      .mockResolvedValueOnce({
        id: 500,
        paymentId: 100,
        expenseId: 10,
        participantId: 1,
        amount: new Prisma.Decimal('40.00'),
        appliedAt: new Date(),
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 501,
        paymentId: 100,
        expenseId: 11,
        participantId: 2,
        amount: new Prisma.Decimal('40.00'),
        appliedAt: new Date(),
        createdAt: new Date(),
      });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
    expect(result.totalApplied).toBe(8000n);
    expect(result.remainingBalance).toBe(2000n);
  });

  it('should apply multiple payments to single expense', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('30.00'),
        applications: [],
        createdAt: new Date('2024-01-01'),
      }),
      createMockPayment({
        id: 101,
        amount: new Prisma.Decimal('40.00'),
        applications: [],
        createdAt: new Date('2024-01-02'),
      }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('100.00') }),
    ]);
    paymentApplicationCreate
      .mockResolvedValueOnce({
        id: 500,
        paymentId: 100,
        amount: new Prisma.Decimal('30.00'),
        appliedAt: new Date(),
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 501,
        paymentId: 101,
        amount: new Prisma.Decimal('40.00'),
        appliedAt: new Date(),
        createdAt: new Date(),
      });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
    expect(result.totalApplied).toBe(7000n);
    expect(expectElement(result.applications, 0).paymentId).toBe(100);
    expect(expectElement(result.applications, 1).paymentId).toBe(101);
  });

  it('should respect maxAmount limit', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('100.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('50.00') }),
      createMockParticipant({ id: 2, expenseId: 11, amount: new Prisma.Decimal('50.00') }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('30.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, { ...baseInput, maxAmount: 30 });

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(result.totalApplied).toBe(3000n);
  });

  it('should skip fully paid expenses', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('100.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({
        id: 1,
        amount: new Prisma.Decimal('50.00'),
        paymentApplications: [
          {
            id: 400,
            paymentId: 99,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('50.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: { isApproved: true },
          },
        ],
      }),
      createMockParticipant({ id: 2, expenseId: 11, amount: new Prisma.Decimal('40.00') }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 11,
      participantId: 2,
      amount: new Prisma.Decimal('40.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(expectElement(result.applications, 0).expenseId).toBe(11);
  });

  it('should skip payments that are already fully applied', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('100.00'),
        applications: [
          {
            id: 400,
            paymentId: 100,
            expenseId: 9,
            participantId: 99,
            amount: new Prisma.Decimal('100.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
          },
        ],
      }),
      createMockPayment({ id: 101, amount: new Prisma.Decimal('50.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('40.00') }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 101,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('40.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(expectElement(result.applications, 0).paymentId).toBe(101);
  });

  it('should return empty result when no available prepayments', async () => {
    paymentFindMany.mockResolvedValue([]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('50.00') }),
    ]);

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).not.toHaveBeenCalled();
    expect(result.totalApplied).toBe(0n);
    expect(result.applications).toHaveLength(0);
  });

  it('should return empty result when no unpaid expenses', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('100.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([]);

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).not.toHaveBeenCalled();
    expect(result.totalApplied).toBe(0n);
  });

  it('should not count unapproved payment applications when calculating remaining owed', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('100.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({
        id: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          {
            id: 400,
            paymentId: 99,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('50.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: { isApproved: false },
          },
        ],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('100.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(paymentApplicationCreate).toHaveBeenCalledWith({
      data: {
        paymentId: 100,
        expenseId: 10,
        participantId: 1,
        amount: new Prisma.Decimal('100'),
      },
    });
    expect(result.totalApplied).toBe(10000n);
  });

  it('should stop when all payments are exhausted before all participants', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('50.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, expenseId: 10, amount: new Prisma.Decimal('30.00') }),
      createMockParticipant({ id: 2, expenseId: 11, amount: new Prisma.Decimal('30.00') }),
      createMockParticipant({ id: 3, expenseId: 12, amount: new Prisma.Decimal('10.00') }),
    ]);
    paymentApplicationCreate
      .mockResolvedValueOnce({
        id: 500,
        paymentId: 100,
        expenseId: 10,
        participantId: 1,
        amount: new Prisma.Decimal('30.00'),
        appliedAt: new Date(),
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 501,
        paymentId: 100,
        expenseId: 11,
        participantId: 2,
        amount: new Prisma.Decimal('20.00'),
        appliedAt: new Date(),
        createdAt: new Date(),
      });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
    expect(result.totalApplied).toBe(5000n);
    expect(result.remainingBalance).toBe(0n);
    expect(result.applications).toHaveLength(2);
  });

  it('should use maxAmount when it exceeds total available balance', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('50.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('100.00') }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('50.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, { ...baseInput, maxAmount: 100 });

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(result.totalApplied).toBe(5000n);
    expect(result.remainingBalance).toBe(0n);
  });

  it('should handle partially applied payments correctly', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('100.00'),
        applications: [
          {
            id: 400,
            paymentId: 100,
            expenseId: 9,
            participantId: 99,
            amount: new Prisma.Decimal('30.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
          },
        ],
      }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('100.00') }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('70.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(paymentApplicationCreate).toHaveBeenCalledWith({
      data: {
        paymentId: 100,
        expenseId: 10,
        participantId: 1,
        amount: new Prisma.Decimal('70'),
      },
    });
    expect(result.totalApplied).toBe(7000n);
    expect(result.remainingBalance).toBe(0n);
  });

  it('should return empty when all payments are fully applied', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('100.00'),
        applications: [
          {
            id: 400,
            paymentId: 100,
            expenseId: 9,
            participantId: 99,
            amount: new Prisma.Decimal('100.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
          },
        ],
      }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({ id: 1, amount: new Prisma.Decimal('50.00') }),
    ]);

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).not.toHaveBeenCalled();
    expect(result.totalApplied).toBe(0n);
    expect(result.applications).toHaveLength(0);
    expect(result.remainingBalance).toBe(0n);
  });

  it('should respect existing approved applications when calculating how much to apply', async () => {
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('100.00'), applications: [] }),
    ]);
    expenseParticipantFindMany.mockResolvedValue([
      createMockParticipant({
        id: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          {
            id: 400,
            paymentId: 99,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('30.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: { isApproved: true },
          },
        ],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('70.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await autoApplyPrepaymentWorkflow(mockTx, baseInput);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(paymentApplicationCreate).toHaveBeenCalledWith({
      data: {
        paymentId: 100,
        expenseId: 10,
        participantId: 1,
        amount: new Prisma.Decimal('70'),
      },
    });
    expect(result.totalApplied).toBe(7000n);
    expect(result.remainingBalance).toBe(3000n);
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should propagate database errors', async () => {
    paymentFindMany.mockRejectedValue(new Error('Database query failed'));

    await expect(autoApplyPrepaymentWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Database query failed'
    );
  });
});

describe('requirePaymentBalance', () => {
  it('returns the balance at a valid index', () => {
    const balances = [
      {
        payment: { id: 1 } as never,
        availableBalance: 10n,
      },
    ];
    expect(requirePaymentBalance(balances, 0).availableBalance).toBe(10n);
  });

  it('throws when the index is out of range', () => {
    expect(() => requirePaymentBalance([], 0)).toThrow('Missing payment balance at index 0');
  });
});
