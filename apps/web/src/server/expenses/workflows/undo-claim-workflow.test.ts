/**
 * Undo Claim Workflow Tests
 *
 * These tests verify the core business logic of undoing payment claims.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { UndoClaimInput, undoClaimWorkflow } from './undo-claim-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('undoClaimWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseParticipantFindUnique: ReturnType<typeof vi.fn>;
  let paymentFindMany: ReturnType<typeof vi.fn>;
  let paymentUpdate: ReturnType<typeof vi.fn>;
  let paymentDelete: ReturnType<typeof vi.fn>;
  let paymentApplicationDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseParticipantFindUnique = vi.fn();
    paymentFindMany = vi.fn();
    paymentUpdate = vi.fn();
    paymentDelete = vi.fn();
    paymentApplicationDelete = vi.fn();

    mockTx = createMockTx({
      expenseParticipant: {
        findUnique: expenseParticipantFindUnique,
      },
      payment: {
        findMany: paymentFindMany,
        update: paymentUpdate,
        delete: paymentDelete,
      },
      paymentApplication: {
        delete: paymentApplicationDelete,
      },
    });
  });

  const createMockParticipant = (overrides: Record<string, unknown> = {}) => ({
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
    paymentApplications: [],
    ...overrides,
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
    ...overrides,
  });

  // =============================================================================
  // PENDING CLAIM TESTS
  // =============================================================================

  it('should delete pending claims and return proof metadata for cleanup', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindMany.mockResolvedValue([
      createMockPayment({
        id: 100,
        paymentProofBucket: 'bucket1',
        paymentProofObjectKey: 'proofs/1.pdf',
      }),
      createMockPayment({ id: 101, paymentProofBucket: null, paymentProofObjectKey: null }),
    ]);
    paymentDelete.mockResolvedValue({});

    const input: UndoClaimInput = {
      participantId: 1,
      undoType: 'PENDING',
    };

    const result = await undoClaimWorkflow(mockTx, input);

    expect(paymentFindMany).toHaveBeenCalledWith({
      where: {
        colleagueId: 5,
        isApproved: false,
        createdBy: 'COLLEAGUE_CLAIM',
        expenseId: 10,
      },
    });
    expect(paymentDelete).toHaveBeenCalledTimes(2);
    expect(paymentDelete).toHaveBeenNthCalledWith(1, { where: { id: 100 } });
    expect(paymentDelete).toHaveBeenNthCalledWith(2, { where: { id: 101 } });
    expect(result.deletedPayments).toEqual([
      { id: 100, paymentProofBucket: 'bucket1', paymentProofObjectKey: 'proofs/1.pdf' },
      { id: 101, paymentProofBucket: null, paymentProofObjectKey: null },
    ]);
    expect(result.totalReversedAmount).toBe(0);
  });

  it('should throw error when no pending claims found', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindMany.mockResolvedValue([]);

    const input: UndoClaimInput = {
      participantId: 1,
      undoType: 'PENDING',
    };

    await expect(undoClaimWorkflow(mockTx, input)).rejects.toThrow(
      'No pending payment claim found to undo'
    );
  });

  // =============================================================================
  // APPROVED CLAIM TESTS
  // =============================================================================

  it('should unapprove approved payments and delete applications', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        paymentApplications: [
          {
            id: 500,
            paymentId: 100,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('60.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: {
              id: 100,
              isApproved: true,
              colleagueId: 5,
              amount: new Prisma.Decimal('60.00'),
              date: new Date(),
              paymentType: 'CASH',
              createdBy: 'ADMIN',
            },
          },
          {
            id: 501,
            paymentId: 101,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('40.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: {
              id: 101,
              isApproved: true,
              colleagueId: 5,
              amount: new Prisma.Decimal('40.00'),
              date: new Date(),
              paymentType: 'PAYME',
              createdBy: 'ADMIN',
            },
          },
        ],
      })
    );
    paymentUpdate.mockResolvedValue({});
    paymentApplicationDelete.mockResolvedValue({});

    const input: UndoClaimInput = {
      participantId: 1,
      undoType: 'APPROVED',
    };

    const result = await undoClaimWorkflow(mockTx, input);

    expect(paymentUpdate).toHaveBeenCalledTimes(2);
    expect(paymentUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 100 },
      data: { isApproved: false },
    });
    expect(paymentUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 101 },
      data: { isApproved: false },
    });
    expect(paymentApplicationDelete).toHaveBeenCalledTimes(2);
    expect(paymentApplicationDelete).toHaveBeenNthCalledWith(1, { where: { id: 500 } });
    expect(paymentApplicationDelete).toHaveBeenNthCalledWith(2, { where: { id: 501 } });
    expect(result.totalReversedAmount).toBe(100);
    expect(result.deletedPayments).toEqual([]);
  });

  it('should throw error when no approved applications found', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        paymentApplications: [
          {
            id: 500,
            paymentId: 100,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('60.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: {
              id: 100,
              isApproved: false, // Not approved
              colleagueId: 5,
              amount: new Prisma.Decimal('60.00'),
              date: new Date(),
              paymentType: 'CASH',
              createdBy: 'COLLEAGUE_CLAIM',
            },
          },
        ],
      })
    );

    const input: UndoClaimInput = {
      participantId: 1,
      undoType: 'APPROVED',
    };

    await expect(undoClaimWorkflow(mockTx, input)).rejects.toThrow(
      'Participant has no approved payments to undo'
    );
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should throw error when participant not found', async () => {
    expenseParticipantFindUnique.mockResolvedValue(null);

    const input: UndoClaimInput = {
      participantId: 1,
      undoType: 'PENDING',
    };

    await expect(undoClaimWorkflow(mockTx, input)).rejects.toThrow('Participant not found');
  });

  it('should propagate database errors during undo', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindMany.mockResolvedValue([createMockPayment()]);
    paymentDelete.mockRejectedValue(new Error('Database delete failed'));

    const input: UndoClaimInput = {
      participantId: 1,
      undoType: 'PENDING',
    };

    await expect(undoClaimWorkflow(mockTx, input)).rejects.toThrow('Database delete failed');
  });
});
