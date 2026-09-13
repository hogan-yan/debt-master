/**
 * Apply Unused Funds Workflow Tests
 *
 * These tests verify the core business logic of applying unused funds
 * from a colleague's payments to a specific expense participant debt.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLockRawMocks, createMockTx } from '@/test/helpers/mock-transaction';
import {
  applyUnusedFundsWorkflow,
  calculateRemainingOwed,
  ParticipantWithDetails,
} from './apply-unused-funds-workflow';

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

describe('applyUnusedFundsWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseParticipantFindUnique: ReturnType<typeof vi.fn>;
  let paymentFindMany: ReturnType<typeof vi.fn>;
  let paymentApplicationCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseParticipantFindUnique = vi.fn();
    paymentFindMany = vi.fn();
    paymentApplicationCreate = vi.fn();

    mockTx = createMockTx(
      {
        expenseParticipant: {
          findUnique: expenseParticipantFindUnique,
        },
        payment: {
          findMany: paymentFindMany,
        },
        paymentApplication: {
          create: paymentApplicationCreate,
        },
      },
      createLockRawMocks()
    );
  });

  const createMockParticipant = (
    overrides: Partial<ParticipantWithDetails> = {}
  ): ParticipantWithDetails => ({
    id: 1,
    amount: new Prisma.Decimal('100.00'),
    expenseId: 10,
    colleagueId: 5,
    colleague: {
      id: 5,
      name: 'Test Colleague',
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
    },
    paymentApplications: [],
    ...overrides,
  });

  interface MockPayment extends Partial<Prisma.PaymentGetPayload<object>> {
    applications?: Prisma.PaymentApplicationGetPayload<object>[];
  }

  const createMockPayment = (overrides: MockPayment = {}) => ({
    id: 1,
    amount: new Prisma.Decimal('100.00'),
    date: new Date('2024-06-15'),
    paymentType: 'CASH',
    isApproved: true,
    colleagueId: 5,
    restaurantId: null,
    paymentProofBucket: null,
    paymentProofObjectKey: null,
    submittedAt: new Date(),
    createdAt: new Date('2024-01-01'),
    createdBy: 'ADMIN',
    applications: [],
    ...overrides,
  });

  interface MockApplication extends Partial<Prisma.PaymentApplicationGetPayload<object>> {
    createdAt?: Date;
  }

  const createMockApplication = (overrides: MockApplication = {}) => ({
    id: 1,
    paymentId: 1,
    expenseId: 10,
    participantId: 1,
    amount: new Prisma.Decimal('50.00'),
    appliedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  });

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  it('should apply full unapplied funds to settle debt when payment fully covers remaining owed', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('50.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('75.00'),
        applications: [],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 500,
        paymentId: 100,
        amount: new Prisma.Decimal('50.00'),
        expenseId: 10,
        participantId: 1,
      })
    );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBe(5000n);
    expect(result.remainingOwed).toBe(5000n);
    expect(result.totalUnapplied).toBe(7500n);
    expect(result.colleagueName).toBe('Test Colleague');
    expect(result.applications).toHaveLength(1);
    expect(expectElement(result.applications, 0).amount).toEqual(new Prisma.Decimal('50.00'));
  });

  it('should apply partial funds when total unapplied is less than remaining owed', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('200.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('60.00'),
        applications: [],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 500,
        paymentId: 100,
        amount: new Prisma.Decimal('60.00'),
        expenseId: 10,
        participantId: 1,
      })
    );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBe(6000n);
    expect(result.remainingOwed).toBe(20000n);
    expect(result.totalUnapplied).toBe(6000n);
  });

  it('should apply funds from multiple payments using FIFO ordering', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('100.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('30.00'),
        createdAt: new Date('2024-01-01'),
        applications: [],
      }),
      createMockPayment({
        id: 101,
        amount: new Prisma.Decimal('50.00'),
        createdAt: new Date('2024-01-02'),
        applications: [],
      }),
    ]);
    paymentApplicationCreate
      .mockResolvedValueOnce(
        createMockApplication({
          id: 500,
          paymentId: 100,
          amount: new Prisma.Decimal('30.00'),
        })
      )
      .mockResolvedValueOnce(
        createMockApplication({
          id: 501,
          paymentId: 101,
          amount: new Prisma.Decimal('50.00'),
        })
      );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBe(8000n);
    expect(result.totalUnapplied).toBe(8000n);
    expect(result.applications).toHaveLength(2);
    expect(expectElement(result.applications, 0).paymentId).toBe(100);
    expect(expectElement(result.applications, 1).paymentId).toBe(101);
  });

  it('should skip payments that are already fully applied', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('100.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('50.00'),
        applications: [createMockApplication({ amount: new Prisma.Decimal('50.00') })],
      }),
      createMockPayment({
        id: 101,
        amount: new Prisma.Decimal('40.00'),
        applications: [],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 500,
        paymentId: 101,
        amount: new Prisma.Decimal('40.00'),
      })
    );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBe(4000n);
    expect(result.totalUnapplied).toBe(4000n);
    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    const createCall = expectElement(paymentApplicationCreate.mock.calls, 0);
    expect(createCall[0].data.paymentId).toBe(101);
  });

  it('should calculate partial unapplied amount from a partially used payment', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('100.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('100.00'),
        applications: [createMockApplication({ amount: new Prisma.Decimal('70.00') })],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 500,
        paymentId: 100,
        amount: new Prisma.Decimal('30.00'),
      })
    );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBe(3000n);
    expect(result.totalUnapplied).toBe(3000n);
  });

  it('should stop applying before the next payment when debt is fully settled', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('30.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('50.00'),
        applications: [],
      }),
      createMockPayment({
        id: 101,
        amount: new Prisma.Decimal('20.00'),
        applications: [],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 500,
        paymentId: 100,
        amount: new Prisma.Decimal('30.00'),
      })
    );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBe(3000n);
    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    const createCall = expectElement(paymentApplicationCreate.mock.calls, 0);
    expect(createCall[0].data.paymentId).toBe(100);
    expect(createCall[0].data.amount.toFixed(2)).toBe('30.00');
  });

  it('should stop applying when remaining owed reaches zero', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('25.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('50.00'),
        applications: [],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 500,
        paymentId: 100,
        amount: new Prisma.Decimal('25.00'),
      })
    );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBe(2500n);
    expect(result.totalUnapplied).toBe(5000n);
    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
  });

  it('should respect existing payment applications when calculating remaining owed', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        amount: new Prisma.Decimal('150.00'),
        paymentApplications: [
          createMockApplication({ amount: new Prisma.Decimal('60.00') }),
          createMockApplication({ amount: new Prisma.Decimal('30.00') }),
        ],
      })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        amount: new Prisma.Decimal('100.00'),
        applications: [],
      }),
    ]);
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 500,
        paymentId: 100,
        amount: new Prisma.Decimal('60.00'),
      })
    );

    const result = await applyUnusedFundsWorkflow(mockTx, {
      participantId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.remainingOwed).toBe(6000n); // 150 - 60 - 30 = 60
    expect(result.appliedAmount).toBe(6000n);
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should throw error when participant not found', async () => {
    expenseParticipantFindUnique.mockResolvedValue(null);

    await expect(
      applyUnusedFundsWorkflow(mockTx, {
        participantId: 999,
      })
    ).rejects.toThrow('Participant or associated colleague not found.');
  });

  it('should throw error when participant has no colleague', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      // Intentionally omits colleague to test error path for missing relation
      createMockParticipant({
        colleague: undefined,
      }) as ParticipantWithDetails
    );

    await expect(
      applyUnusedFundsWorkflow(mockTx, {
        participantId: 1,
      })
    ).rejects.toThrow('Participant or associated colleague not found.');
  });

  it('throws when the participant disappears after acquiring the colleague lock', async () => {
    expenseParticipantFindUnique
      .mockResolvedValueOnce({ colleagueId: 5 })
      .mockResolvedValueOnce(null);

    await expect(
      applyUnusedFundsWorkflow(mockTx, {
        participantId: 1,
      })
    ).rejects.toThrow('Participant or associated colleague not found.');
  });

  it('should throw error when expense is already fully paid', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        amount: new Prisma.Decimal('50.00'),
        paymentApplications: [createMockApplication({ amount: new Prisma.Decimal('50.00') })],
      })
    );

    await expect(
      applyUnusedFundsWorkflow(mockTx, {
        participantId: 1,
      })
    ).rejects.toThrow('This expense is already considered fully paid for this participant.');
  });

  it('should throw error when remaining owed is just above threshold and covered', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        amount: new Prisma.Decimal('50.00'),
        paymentApplications: [createMockApplication({ amount: new Prisma.Decimal('49.995') })],
      })
    );

    await expect(
      applyUnusedFundsWorkflow(mockTx, {
        participantId: 1,
      })
    ).rejects.toThrow('This expense is already considered fully paid for this participant.');
  });

  it('should throw error when colleague has no unapplied funds', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('100.00') })
    );
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        amount: new Prisma.Decimal('50.00'),
        applications: [createMockApplication({ amount: new Prisma.Decimal('50.00') })],
      }),
    ]);

    await expect(
      applyUnusedFundsWorkflow(mockTx, {
        participantId: 1,
      })
    ).rejects.toThrow('Test Colleague has no unapplied funds available.');
  });

  it('should throw error when colleague has no approved payments', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({ amount: new Prisma.Decimal('100.00') })
    );
    paymentFindMany.mockResolvedValue([]);

    await expect(
      applyUnusedFundsWorkflow(mockTx, {
        participantId: 1,
      })
    ).rejects.toThrow('Test Colleague has no unapplied funds available.');
  });

  // =============================================================================
  // PURE FUNCTION TESTS
  // =============================================================================

  describe('calculateRemainingOwed', () => {
    it('should return full amount when no applications exist', () => {
      const participant = createMockParticipant({
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [],
      });

      expect(calculateRemainingOwed(participant)).toBe(10000n);
    });

    it('should subtract all application amounts from total', () => {
      const participant = createMockParticipant({
        amount: new Prisma.Decimal('200.00'),
        paymentApplications: [
          createMockApplication({ amount: new Prisma.Decimal('50.00') }),
          createMockApplication({ amount: new Prisma.Decimal('25.50') }),
          createMockApplication({ amount: new Prisma.Decimal('24.50') }),
        ],
      });

      expect(calculateRemainingOwed(participant)).toBe(10000n);
    });

    it('should return zero when fully paid', () => {
      const participant = createMockParticipant({
        amount: new Prisma.Decimal('75.00'),
        paymentApplications: [createMockApplication({ amount: new Prisma.Decimal('75.00') })],
      });

      expect(calculateRemainingOwed(participant)).toBe(0n);
    });

    it('should handle decimal precision exactly in minor units', () => {
      const participant = createMockParticipant({
        amount: new Prisma.Decimal('33.33'),
        paymentApplications: [
          createMockApplication({ amount: new Prisma.Decimal('11.11') }),
          createMockApplication({ amount: new Prisma.Decimal('11.11') }),
        ],
      });

      // 33.33 - 22.22 = 11.11 exactly — no float epsilon needed
      expect(calculateRemainingOwed(participant)).toBe(1111n);
    });
  });
});
