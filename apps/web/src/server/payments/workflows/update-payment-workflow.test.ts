/**
 * Update Payment Workflow Tests
 *
 * These tests verify the core business logic of updating payments.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { UpdatePaymentInput, updatePaymentWorkflow } from './update-payment-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('updatePaymentWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let paymentFindUnique: ReturnType<typeof vi.fn>;
  let paymentUpdate: ReturnType<typeof vi.fn>;
  let paymentApplicationDeleteMany: ReturnType<typeof vi.fn>;
  let paymentApplicationCreate: ReturnType<typeof vi.fn>;
  let expenseParticipantFindFirst: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    paymentFindUnique = vi.fn();
    paymentUpdate = vi.fn();
    paymentApplicationDeleteMany = vi.fn();
    paymentApplicationCreate = vi.fn();
    expenseParticipantFindFirst = vi.fn();

    mockTx = createMockTx({
      payment: {
        findUnique: paymentFindUnique,
        update: paymentUpdate,
      },
      paymentApplication: {
        deleteMany: paymentApplicationDeleteMany,
        create: paymentApplicationCreate,
      },
      expenseParticipant: {
        findFirst: expenseParticipantFindFirst,
      },
    });
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
    colleagueId: 1,
    restaurantId: null,
    paymentProofBucket: null,
    paymentProofObjectKey: null,
    submittedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'ADMIN',
    ...overrides,
  });

  interface MockApplication extends Partial<Prisma.PaymentApplicationGetPayload<object>> {
    createdAt?: Date;
  }

  const createMockApplication = (overrides: MockApplication = {}) => ({
    id: 1,
    paymentId: 1,
    expenseId: 1,
    participantId: 1,
    amount: new Prisma.Decimal('50.00'),
    appliedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  });

  const baseInput: UpdatePaymentInput = {
    id: 1,
    colleagueId: 1,
    amount: 100,
    date: '2024-06-15',
    paymentType: 'CASH',
    paymentProofBucket: null,
    paymentProofObjectKey: null,
    selectedExpenseIds: [],
    expenseAmounts: {},
  };

  // =============================================================================
  // BASIC UPDATE TESTS
  // =============================================================================

  it('should update payment core details without applications', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(
      createMockPayment({
        amount: new Prisma.Decimal('150.00'),
        paymentType: 'FPS',
      })
    );
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        amount: new Prisma.Decimal('150.00'),
        paymentType: 'FPS',
        applications: [],
      })
    );

    const input: UpdatePaymentInput = {
      ...baseInput,
      amount: 150,
      paymentType: 'FPS',
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        amount: 150,
        paymentType: 'FPS',
      }),
    });
    expect(paymentApplicationDeleteMany).toHaveBeenCalledWith({
      where: { paymentId: 1 },
    });
    expect(result.totalAppliedAmount).toBe(0);
  });

  it('should update payment with new applications', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(createMockPayment());
    expenseParticipantFindFirst.mockResolvedValue({
      id: 10,
      expenseId: 2,
      colleagueId: 1,
      amount: new Prisma.Decimal('75.00'),
    });
    paymentApplicationCreate.mockResolvedValue(
      createMockApplication({
        id: 100,
        expenseId: 2,
        participantId: 10,
        amount: new Prisma.Decimal('75.00'),
      })
    );
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        applications: [
          createMockApplication({
            id: 100,
            expenseId: 2,
            participantId: 10,
            amount: new Prisma.Decimal('75.00'),
          }),
        ],
      })
    );

    const input: UpdatePaymentInput = {
      ...baseInput,
      selectedExpenseIds: [2],
      expenseAmounts: { '2': '75' },
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    expect(paymentApplicationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentId: 1,
        expenseId: 2,
        participantId: 10,
        amount: 75,
      }),
    });
    expect(result.totalAppliedAmount).toBe(75);
  });

  it('should throw error when total applied exceeds payment amount', async () => {
    const input: UpdatePaymentInput = {
      ...baseInput,
      amount: 50,
      selectedExpenseIds: [1, 2],
      expenseAmounts: { '1': '30', '2': '25' },
    };

    await expect(updatePaymentWorkflow(mockTx, input)).rejects.toThrow('Payment amount');
  });

  it('should allow total applied within floating point tolerance of payment amount', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(createMockPayment());
    expenseParticipantFindFirst.mockResolvedValue({
      id: 10,
      expenseId: 1,
      colleagueId: 1,
      amount: new Prisma.Decimal('100.00'),
    });
    paymentApplicationCreate.mockResolvedValue(createMockApplication());
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        applications: [createMockApplication()],
      })
    );

    const input: UpdatePaymentInput = {
      ...baseInput,
      amount: 100.001,
      selectedExpenseIds: [1],
      expenseAmounts: { '1': '100' },
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(result.totalAppliedAmount).toBe(100);
  });

  // =============================================================================
  // APPLICATION MANAGEMENT TESTS
  // =============================================================================

  it('should delete existing applications before creating new ones', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(createMockPayment());
    expenseParticipantFindFirst.mockResolvedValue({
      id: 10,
      expenseId: 3,
      colleagueId: 1,
      amount: new Prisma.Decimal('40.00'),
    });
    paymentApplicationCreate.mockResolvedValue(createMockApplication({ expenseId: 3 }));
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        applications: [createMockApplication({ expenseId: 3 })],
      })
    );

    const input: UpdatePaymentInput = {
      ...baseInput,
      selectedExpenseIds: [3],
      expenseAmounts: { '3': '40' },
    };

    await updatePaymentWorkflow(mockTx, input);

    expect(paymentApplicationDeleteMany).toHaveBeenCalled();
  });

  it('should skip creating application when amount is zero or negative', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(createMockPayment({ applications: [] }));

    const input: UpdatePaymentInput = {
      ...baseInput,
      selectedExpenseIds: [1, 2],
      expenseAmounts: { '1': '0', '2': '-10' },
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(paymentApplicationCreate).not.toHaveBeenCalled();
    expect(result.totalAppliedAmount).toBe(0);
  });

  it('treats an omitted expense amount as zero', async () => {
    paymentFindUnique
      .mockResolvedValueOnce(createMockPayment())
      .mockResolvedValueOnce(createMockPayment({ applications: [] }));
    paymentUpdate.mockResolvedValue(createMockPayment());

    const result = await updatePaymentWorkflow(mockTx, {
      ...baseInput,
      selectedExpenseIds: [1],
      expenseAmounts: {},
    });

    expect(expenseParticipantFindFirst).not.toHaveBeenCalled();
    expect(result.totalAppliedAmount).toBe(0);
  });

  it('should skip creating application when participant not found for expense', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(createMockPayment());
    expenseParticipantFindFirst.mockResolvedValue(null);
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(createMockPayment({ applications: [] }));

    const input: UpdatePaymentInput = {
      ...baseInput,
      selectedExpenseIds: [99],
      expenseAmounts: { '99': '50' },
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(paymentApplicationCreate).not.toHaveBeenCalled();
    expect(result.totalAppliedAmount).toBe(0);
  });

  it('should distribute across multiple expenses correctly', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(createMockPayment());
    expenseParticipantFindFirst
      .mockResolvedValueOnce({
        id: 10,
        expenseId: 1,
        colleagueId: 1,
        amount: new Prisma.Decimal('30.00'),
      })
      .mockResolvedValueOnce({
        id: 11,
        expenseId: 2,
        colleagueId: 1,
        amount: new Prisma.Decimal('40.00'),
      });
    paymentApplicationCreate
      .mockResolvedValueOnce(
        createMockApplication({
          id: 100,
          expenseId: 1,
          participantId: 10,
          amount: new Prisma.Decimal('30.00'),
        })
      )
      .mockResolvedValueOnce(
        createMockApplication({
          id: 101,
          expenseId: 2,
          participantId: 11,
          amount: new Prisma.Decimal('40.00'),
        })
      );
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        applications: [
          createMockApplication({
            id: 100,
            expenseId: 1,
            participantId: 10,
            amount: new Prisma.Decimal('30.00'),
          }),
          createMockApplication({
            id: 101,
            expenseId: 2,
            participantId: 11,
            amount: new Prisma.Decimal('40.00'),
          }),
        ],
      })
    );

    const input: UpdatePaymentInput = {
      ...baseInput,
      amount: 100,
      selectedExpenseIds: [1, 2],
      expenseAmounts: { '1': '30', '2': '40' },
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
    expect(result.totalAppliedAmount).toBe(70);
  });

  // =============================================================================
  // PAYMENT PROOF TESTS
  // =============================================================================

  it('should update payment proof metadata when provided', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockResolvedValue(
      createMockPayment({
        paymentProofBucket: 'new-bucket',
        paymentProofObjectKey: 'proofs/new.pdf',
      })
    );
    paymentFindUnique.mockResolvedValueOnce(createMockPayment());
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        paymentProofBucket: 'new-bucket',
        paymentProofObjectKey: 'proofs/new.pdf',
        applications: [],
      })
    );

    const input: UpdatePaymentInput = {
      ...baseInput,
      paymentProofBucket: 'new-bucket',
      paymentProofObjectKey: 'proofs/new.pdf',
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        paymentProofBucket: 'new-bucket',
        paymentProofObjectKey: 'proofs/new.pdf',
      }),
    });
    expect(result.payment.paymentProofBucket).toBe('new-bucket');
  });

  it('should remove payment proof metadata when null values provided', async () => {
    paymentFindUnique.mockResolvedValue(
      createMockPayment({
        paymentProofBucket: 'old-bucket',
        paymentProofObjectKey: 'proofs/old.pdf',
      })
    );
    paymentUpdate.mockResolvedValue(
      createMockPayment({
        paymentProofBucket: null,
        paymentProofObjectKey: null,
      })
    );
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        paymentProofBucket: 'old-bucket',
        paymentProofObjectKey: 'proofs/old.pdf',
      })
    );
    paymentFindUnique.mockResolvedValueOnce(
      createMockPayment({
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        applications: [],
      })
    );

    const input: UpdatePaymentInput = {
      ...baseInput,
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    };

    const result = await updatePaymentWorkflow(mockTx, input);

    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        paymentProofBucket: null,
        paymentProofObjectKey: null,
      }),
    });
    expect(result.payment.paymentProofBucket).toBeNull();
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should throw error when payment not found', async () => {
    paymentFindUnique.mockResolvedValue(null);

    await expect(updatePaymentWorkflow(mockTx, baseInput)).rejects.toThrow('Payment not found');
  });

  it('throws when the updated payment cannot be reloaded', async () => {
    paymentFindUnique.mockResolvedValueOnce(createMockPayment()).mockResolvedValueOnce(null);
    paymentUpdate.mockResolvedValue(createMockPayment());

    await expect(updatePaymentWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Failed to fetch updated payment'
    );
  });

  it('should propagate database errors during update', async () => {
    paymentFindUnique.mockResolvedValue(createMockPayment());
    paymentUpdate.mockRejectedValue(new Error('Database update failed'));

    await expect(updatePaymentWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Database update failed'
    );
  });
});
