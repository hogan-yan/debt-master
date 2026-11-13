/**
 * Approve Claim Workflow Tests
 *
 * These tests verify the core business logic of approving payment claims.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLockRawMocks, createMockTx } from '@/test/helpers/mock-transaction';
import { ApproveClaimInput, approveClaimWorkflow } from './approve-claim-workflow';

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

describe('approveClaimWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseParticipantFindUnique: ReturnType<typeof vi.fn>;
  let paymentFindMany: ReturnType<typeof vi.fn>;
  let paymentUpdate: ReturnType<typeof vi.fn>;
  let paymentApplicationCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseParticipantFindUnique = vi.fn();
    paymentFindMany = vi.fn();
    paymentUpdate = vi.fn();
    paymentApplicationCreate = vi.fn();

    mockTx = createMockTx(
      {
        expenseParticipant: {
          findUnique: expenseParticipantFindUnique,
        },
        payment: {
          findMany: paymentFindMany,
          update: paymentUpdate,
        },
        paymentApplication: {
          create: paymentApplicationCreate,
        },
      },
      createLockRawMocks()
    );
  });

  const createMockParticipant = () => ({
    id: 1,
    expenseId: 10,
    colleagueId: 5,
    amount: new Prisma.Decimal('100.00'),
    colleague: {
      id: 5,
      name: 'Test Colleague',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
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
  });

  const createMockPayment = (overrides: Record<string, unknown> = {}) => ({
    id: 100,
    colleagueId: 5,
    amount: new Prisma.Decimal('100.00'),
    date: new Date(),
    paymentType: 'PAYME',
    restaurantId: 1,
    expenseId: 10,
    isApproved: false,
    submittedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'COLLEAGUE_CLAIM',
    paymentProofBucket: null,
    paymentProofObjectKey: null,
    colleague: {
      id: 5,
      name: 'Test Colleague',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    restaurant: {
      id: 1,
      name: 'Test Restaurant',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  });

  const baseInput: ApproveClaimInput = {
    participantId: 1,
  };

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  it('should approve a single pending claim and create payment application', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindMany.mockResolvedValue([createMockPayment()]);
    paymentUpdate.mockResolvedValue(createMockPayment({ isApproved: true }));
    paymentApplicationCreate.mockResolvedValue({
      id: 500,
      paymentId: 100,
      expenseId: 10,
      participantId: 1,
      amount: new Prisma.Decimal('100.00'),
      appliedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await approveClaimWorkflow(mockTx, baseInput);

    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { isApproved: true },
      include: {
        colleague: true,
        restaurant: true,
      },
    });
    expect(paymentApplicationCreate).toHaveBeenCalledWith({
      data: {
        paymentId: 100,
        expenseId: 10,
        participantId: 1,
        amount: new Prisma.Decimal('100.00'),
        appliedAt: expect.any(Date),
      },
    });
    expect(result.approvedPayments).toHaveLength(1);
    expect(expectElement(result.approvedPayments, 0).isApproved).toBe(true);
  });

  it('should approve multiple pending claims for same participant', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindMany.mockResolvedValue([
      createMockPayment({ id: 100, amount: new Prisma.Decimal('30.00') }),
      createMockPayment({ id: 101, amount: new Prisma.Decimal('70.00') }),
    ]);
    paymentUpdate
      .mockResolvedValueOnce(
        createMockPayment({ id: 100, amount: new Prisma.Decimal('30.00'), isApproved: true })
      )
      .mockResolvedValueOnce(
        createMockPayment({ id: 101, amount: new Prisma.Decimal('70.00'), isApproved: true })
      );
    paymentApplicationCreate.mockResolvedValue({});

    const result = await approveClaimWorkflow(mockTx, baseInput);

    expect(paymentUpdate).toHaveBeenCalledTimes(2);
    expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
    expect(result.approvedPayments).toHaveLength(2);
    expect(result.totalApproved).toBe(100);
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should throw error when participant not found', async () => {
    expenseParticipantFindUnique.mockResolvedValue(null);

    await expect(approveClaimWorkflow(mockTx, baseInput)).rejects.toThrow('Participant not found');
  });

  it('throws when the participant is deleted after the colleague lock is acquired', async () => {
    expenseParticipantFindUnique
      .mockResolvedValueOnce({ colleagueId: 5 })
      .mockResolvedValueOnce(null);

    await expect(approveClaimWorkflow(mockTx, baseInput)).rejects.toThrow('Participant not found');
  });

  it('should throw error when no pending claims exist', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindMany.mockResolvedValue([]);

    await expect(approveClaimWorkflow(mockTx, baseInput)).rejects.toThrow(
      'No pending payment claim found for this participant'
    );
  });

  it('should propagate database errors during approval', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindMany.mockResolvedValue([createMockPayment()]);
    paymentUpdate.mockRejectedValue(new Error('Database update failed'));

    await expect(approveClaimWorkflow(mockTx, baseInput)).rejects.toThrow('Database update failed');
  });
});
