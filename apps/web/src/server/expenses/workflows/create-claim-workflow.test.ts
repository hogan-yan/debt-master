/**
 * Create Claim Workflow Tests
 *
 * These tests verify the core business logic of creating payment claims.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { CreateClaimInput, createClaimWorkflow } from './create-claim-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('createClaimWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseParticipantFindUnique: ReturnType<typeof vi.fn>;
  let paymentFindFirst: ReturnType<typeof vi.fn>;
  let paymentCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseParticipantFindUnique = vi.fn();
    paymentFindFirst = vi.fn();
    paymentCreate = vi.fn();

    mockTx = createMockTx({
      expenseParticipant: {
        findUnique: expenseParticipantFindUnique,
      },
      payment: {
        findFirst: paymentFindFirst,
        create: paymentCreate,
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

  const baseInput: CreateClaimInput = {
    participantId: 1,
  };

  // =============================================================================
  // SUCCESS CASES
  // =============================================================================

  it('should create a claim for unpaid participant', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockResolvedValue(createMockPayment());

    const result = await createClaimWorkflow(mockTx, baseInput);

    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        colleagueId: 5,
        amount: 100,
        paymentType: 'PAYME',
        expenseId: 10,
        restaurantId: 1,
        isApproved: false,
        createdBy: 'COLLEAGUE_CLAIM',
      }),
      include: {
        colleague: true,
        restaurant: true,
      },
    });
    expect(result.payment.amount).toEqual(new Prisma.Decimal('100.00'));
    expect(result.remainingOwed).toBe(100);
    expect(result.participantId).toBe(1);
  });

  it('should create a claim with custom amount', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockResolvedValue(createMockPayment({ amount: new Prisma.Decimal('50.00') }));

    const input: CreateClaimInput = {
      ...baseInput,
      amount: 50,
    };

    const result = await createClaimWorkflow(mockTx, input);

    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 50,
      }),
      include: expect.any(Object),
    });
    expect(result.remainingOwed).toBe(100);
  });

  it('should create a claim with custom payment type', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockResolvedValue(createMockPayment({ paymentType: 'FPS' }));

    const input: CreateClaimInput = {
      ...baseInput,
      paymentType: 'FPS',
    };

    const result = await createClaimWorkflow(mockTx, input);

    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentType: 'FPS',
      }),
      include: expect.any(Object),
    });
    expect(result.payment.paymentType).toBe('FPS');
  });

  it('should create a claim with payment proof metadata', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockResolvedValue(
      createMockPayment({
        paymentProofBucket: 'proofs-bucket',
        paymentProofObjectKey: 'uploads/proof.jpg',
      })
    );

    const input: CreateClaimInput = {
      ...baseInput,
      paymentProofBucket: 'proofs-bucket',
      paymentProofObjectKey: 'uploads/proof.jpg',
    };

    const result = await createClaimWorkflow(mockTx, input);

    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentProofBucket: 'proofs-bucket',
        paymentProofObjectKey: 'uploads/proof.jpg',
      }),
      include: expect.any(Object),
    });
    expect(result.payment.paymentProofBucket).toBe('proofs-bucket');
  });

  it('should calculate remaining owed with existing approved applications', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        paymentApplications: [
          {
            id: 1,
            paymentId: 50,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('30.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: {
              id: 50,
              isApproved: true,
              colleagueId: 5,
              amount: new Prisma.Decimal('30.00'),
              date: new Date(),
              paymentType: 'CASH',
              createdBy: 'ADMIN',
            },
          },
        ],
      })
    );
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockResolvedValue(createMockPayment({ amount: new Prisma.Decimal('70.00') }));

    const result = await createClaimWorkflow(mockTx, baseInput);

    expect(result.remainingOwed).toBe(70);
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 70 }),
      include: expect.any(Object),
    });
  });

  it('should ignore unapproved applications when calculating remaining owed', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        paymentApplications: [
          {
            id: 1,
            paymentId: 50,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('30.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: {
              id: 50,
              isApproved: false,
              colleagueId: 5,
              amount: new Prisma.Decimal('30.00'),
              date: new Date(),
              paymentType: 'CASH',
              createdBy: 'COLLEAGUE_CLAIM',
            },
          },
        ],
      })
    );
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockResolvedValue(createMockPayment());

    const result = await createClaimWorkflow(mockTx, baseInput);

    expect(result.remainingOwed).toBe(100);
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 100 }),
      include: expect.any(Object),
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should throw error when participant not found', async () => {
    expenseParticipantFindUnique.mockResolvedValue(null);

    await expect(createClaimWorkflow(mockTx, baseInput)).rejects.toThrow('Participant not found');
  });

  it('should throw error when participant is already fully paid', async () => {
    expenseParticipantFindUnique.mockResolvedValue(
      createMockParticipant({
        paymentApplications: [
          {
            id: 1,
            paymentId: 50,
            expenseId: 10,
            participantId: 1,
            amount: new Prisma.Decimal('100.00'),
            appliedAt: new Date(),
            createdAt: new Date(),
            payment: {
              id: 50,
              isApproved: true,
              colleagueId: 5,
              amount: new Prisma.Decimal('100.00'),
              date: new Date(),
              paymentType: 'CASH',
              createdBy: 'ADMIN',
            },
          },
        ],
      })
    );

    await expect(createClaimWorkflow(mockTx, baseInput)).rejects.toThrow(
      'This expense participant is already fully paid'
    );
  });

  it('should throw error when a pending claim already exists', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindFirst.mockResolvedValue({
      id: 99,
      colleagueId: 5,
      isApproved: false,
      createdBy: 'COLLEAGUE_CLAIM',
      expenseId: 10,
    });

    await expect(createClaimWorkflow(mockTx, baseInput)).rejects.toThrow(
      'A payment claim is already pending approval for this expense participant'
    );
  });

  it('should propagate database errors during payment creation', async () => {
    expenseParticipantFindUnique.mockResolvedValue(createMockParticipant());
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockRejectedValue(new Error('Database write failed'));

    await expect(createClaimWorkflow(mockTx, baseInput)).rejects.toThrow('Database write failed');
  });
});
