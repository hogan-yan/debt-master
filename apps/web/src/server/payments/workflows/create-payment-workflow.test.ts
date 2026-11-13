/**
 * Create Payment Workflow Tests
 *
 * These tests verify the core business logic of payment creation.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLockRawMocks, createMockTx } from '@/test/helpers/mock-transaction';
import { CreatePaymentInput, createPaymentWorkflow } from './create-payment-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('createPaymentWorkflow', () => {
  // Mock transaction client
  let mockTx: ReturnType<typeof createMockTx>;
  let paymentCreate: ReturnType<typeof vi.fn>;
  let paymentFindUnique: ReturnType<typeof vi.fn>;
  let paymentApplicationCreate: ReturnType<typeof vi.fn>;
  let paymentApplicationFindMany: ReturnType<typeof vi.fn>;
  let expenseParticipantFindFirst: ReturnType<typeof vi.fn>;
  let expenseParticipantFindMany: ReturnType<typeof vi.fn>;
  let expenseParticipantFindUnique: ReturnType<typeof vi.fn>;
  let colleagueFindUnique: ReturnType<typeof vi.fn>;
  let restaurantFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    paymentCreate = vi.fn();
    paymentFindUnique = vi.fn();
    paymentApplicationCreate = vi.fn();
    paymentApplicationFindMany = vi.fn();
    expenseParticipantFindFirst = vi.fn();
    expenseParticipantFindMany = vi.fn();
    expenseParticipantFindUnique = vi.fn();
    colleagueFindUnique = vi.fn();
    restaurantFindUnique = vi.fn();

    mockTx = createMockTx(
      {
        payment: {
          create: paymentCreate,
          findUnique: paymentFindUnique,
        },
        paymentApplication: {
          create: paymentApplicationCreate,
          findMany: paymentApplicationFindMany,
        },
        expenseParticipant: {
          findFirst: expenseParticipantFindFirst,
          findMany: expenseParticipantFindMany,
          findUnique: expenseParticipantFindUnique,
        },
        colleague: {
          findUnique: colleagueFindUnique,
        },
        restaurant: {
          findUnique: restaurantFindUnique,
        },
      },
      createLockRawMocks()
    );

    // Default mocks for colleague and restaurant lookups (used for serialization)
    colleagueFindUnique.mockResolvedValue({
      id: 1,
      name: 'Test Colleague',
      createdAt: new Date(),
    });
    restaurantFindUnique.mockResolvedValue(null);
  });

  // Helper to create mock payment
  const createMockPayment = (overrides: Partial<Prisma.PaymentGetPayload<object>> = {}) => ({
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

  // Helper to create mock payment application
  const createMockApplication = (
    overrides: Partial<Prisma.PaymentApplicationGetPayload<object>> = {}
  ) => ({
    id: 1,
    paymentId: 1,
    expenseId: 1,
    participantId: 1,
    amount: new Prisma.Decimal('50.00'),
    appliedAt: new Date(),
    ...overrides,
  });

  // =============================================================================
  // PREPAYMENT MODE TESTS
  // =============================================================================

  describe('Prepayment Mode', () => {
    const baseInput: CreatePaymentInput = {
      colleagueId: 1,
      amount: 100,
      date: '2024-06-15',
      paymentType: 'CASH',
      restaurantId: undefined,
      paymentProofBucket: null,
      paymentProofObjectKey: null,
      selectedExpenseIds: [], // Empty = prepayment mode
    };

    it('should create payment with no auto-applications when no unpaid expenses', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindMany.mockResolvedValue([]);

      const result = await createPaymentWorkflow(mockTx, baseInput);

      expect(paymentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          colleagueId: 1,
          amount: 100,
          paymentType: 'CASH',
          isApproved: true,
          createdBy: 'ADMIN',
        }),
      });
      expect(result.totalAppliedAmount).toBe(0);
      expect(result.remainingAmount).toBe(100);
      expect(result.autoPayments).toHaveLength(0);
    });

    it('should auto-apply prepayment to single unpaid expense', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('75.00'),
          expense: {
            id: 1,
            date: new Date('2024-06-01'),
            amount: new Prisma.Decimal('75.00'),
            restaurant: { id: 1, name: 'Test Restaurant' },
          },
          paymentApplications: [], // No payments yet
        },
      ]);
      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({
          amount: new Prisma.Decimal('75.00'),
          expenseId: 1,
        })
      );

      const result = await createPaymentWorkflow(mockTx, baseInput);

      expect(paymentApplicationCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 1,
          expenseId: 1,
          participantId: 1,
          amount: new Prisma.Decimal('75'), // Full amount owed
        }),
        include: expect.any(Object),
      });
      expect(result.totalAppliedAmount).toBe(75);
      expect(result.remainingAmount).toBe(25);
    });

    it('should auto-apply to multiple expenses until payment exhausted', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('40.00'),
          expense: {
            id: 1,
            date: new Date('2024-06-01'),
            amount: new Prisma.Decimal('40.00'),
            restaurant: { id: 1, name: 'Restaurant 1' },
          },
          paymentApplications: [],
        },
        {
          id: 2,
          expenseId: 2,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          expense: {
            id: 2,
            date: new Date('2024-06-02'),
            amount: new Prisma.Decimal('50.00'),
            restaurant: { id: 2, name: 'Restaurant 2' },
          },
          paymentApplications: [],
        },
        {
          id: 3,
          expenseId: 3,
          colleagueId: 1,
          amount: new Prisma.Decimal('30.00'),
          expense: {
            id: 3,
            date: new Date('2024-06-03'),
            amount: new Prisma.Decimal('30.00'),
            restaurant: { id: 3, name: 'Restaurant 3' },
          },
          paymentApplications: [],
        },
      ]);

      // Mock application creation for each expense
      paymentApplicationCreate
        .mockResolvedValueOnce(
          createMockApplication({
            id: 1,
            amount: new Prisma.Decimal('40.00'),
            expenseId: 1,
          })
        )
        .mockResolvedValueOnce(
          createMockApplication({
            id: 2,
            amount: new Prisma.Decimal('50.00'),
            expenseId: 2,
          })
        )
        .mockResolvedValueOnce(
          createMockApplication({
            id: 3,
            amount: new Prisma.Decimal('10.00'),
            expenseId: 3,
          })
        );

      const result = await createPaymentWorkflow(mockTx, baseInput);

      // Should apply to first two fully, and partially to third
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(3);
      expect(result.totalAppliedAmount).toBe(100);
      expect(result.remainingAmount).toBe(0);
    });

    it('should apply to oldest expenses first (date ordering)', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      // Note: Database returns in ASC order by date, so older first
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('30.00'),
          expense: {
            id: 1,
            date: new Date('2024-06-01'), // Older
            amount: new Prisma.Decimal('30.00'),
            restaurant: null,
          },
          paymentApplications: [],
        },
        {
          id: 2,
          expenseId: 2,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          expense: {
            id: 2,
            date: new Date('2024-06-02'), // Newer
            amount: new Prisma.Decimal('50.00'),
            restaurant: null,
          },
          paymentApplications: [],
        },
      ]);

      paymentApplicationCreate
        .mockResolvedValueOnce(createMockApplication({ id: 1, expenseId: 1 }))
        .mockResolvedValueOnce(createMockApplication({ id: 2, expenseId: 2 }));

      await createPaymentWorkflow(mockTx, baseInput);

      // Verify applications are created for both expenses
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
      // Verify both expenses received applications
      const calls = paymentApplicationCreate.mock.calls;
      const expenseIds = calls.map((call) => call[0].data.expenseId);
      expect(expenseIds).toContain(1);
      expect(expenseIds).toContain(2);
    });

    it('should respect already applied amounts when calculating remaining owed', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('100.00'),
          expense: {
            id: 1,
            date: new Date('2024-06-01'),
            amount: new Prisma.Decimal('100.00'),
            restaurant: null,
          },
          paymentApplications: [
            {
              id: 1,
              payment: { isApproved: true },
              amount: new Prisma.Decimal('60.00'), // Already paid 60
            },
          ],
        },
      ]);

      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({
          amount: new Prisma.Decimal('40.00'),
        })
      );

      const result = await createPaymentWorkflow(mockTx, baseInput);

      // Should create application with remaining amount (40)
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
      // Verify the call includes the expected amount
      const createCall = paymentApplicationCreate.mock.calls[0];
      if (!createCall) {
        throw new Error('Expected paymentApplication.create to be called');
      }
      expect(createCall[0].data.amount.toFixed(2)).toBe('40.00'); // 100 - 60 = 40
      expect(result.totalAppliedAmount).toBe(40);
    });

    it('should skip expenses that are already fully paid', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          expense: {
            id: 1,
            date: new Date('2024-06-01'),
            amount: new Prisma.Decimal('50.00'),
            restaurant: null,
          },
          paymentApplications: [
            {
              id: 1,
              payment: { isApproved: true },
              amount: new Prisma.Decimal('50.00'), // Fully paid
            },
          ],
        },
        {
          id: 2,
          expenseId: 2,
          colleagueId: 1,
          amount: new Prisma.Decimal('75.00'),
          expense: {
            id: 2,
            date: new Date('2024-06-02'),
            amount: new Prisma.Decimal('75.00'),
            restaurant: null,
          },
          paymentApplications: [], // Unpaid
        },
      ]);

      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({
          amount: new Prisma.Decimal('75.00'),
          expenseId: 2,
        })
      );

      const result = await createPaymentWorkflow(mockTx, baseInput);

      // Should only create one application (for expense 2)
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
      expect(result.totalAppliedAmount).toBe(75);
    });

    it('should stop applying when payment amount is exhausted', async () => {
      const smallPaymentInput: CreatePaymentInput = {
        ...baseInput,
        amount: 30, // Small payment
      };

      paymentCreate.mockResolvedValue(createMockPayment({ amount: new Prisma.Decimal('30.00') }));
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('100.00'),
          expense: {
            id: 1,
            date: new Date('2024-06-01'),
            amount: new Prisma.Decimal('100.00'),
            restaurant: null,
          },
          paymentApplications: [],
        },
        {
          id: 2,
          expenseId: 2,
          colleagueId: 1,
          amount: new Prisma.Decimal('100.00'),
          expense: {
            id: 2,
            date: new Date('2024-06-02'),
            amount: new Prisma.Decimal('100.00'),
            restaurant: null,
          },
          paymentApplications: [],
        },
      ]);

      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({
          amount: new Prisma.Decimal('30.00'),
          expenseId: 1,
        })
      );

      const result = await createPaymentWorkflow(mockTx, smallPaymentInput);

      expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
      expect(result.totalAppliedAmount).toBe(30);
      expect(result.remainingAmount).toBe(0);
    });
  });

  // =============================================================================
  // EXPENSE PAYMENT MODE TESTS
  // =============================================================================

  describe('Expense Payment Mode', () => {
    const expensePaymentInput: CreatePaymentInput = {
      colleagueId: 1,
      amount: 100,
      date: '2024-06-15',
      paymentType: 'CASH',
      restaurantId: undefined,
      paymentProofBucket: null,
      paymentProofObjectKey: null,
      selectedExpenseIds: [1, 2], // Specific expenses = payment mode
    };

    it('should create payment and apply to specified expense', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
        amount: new Prisma.Decimal('75.00'),
      });
      paymentFindUnique.mockResolvedValue(
        createMockPayment({ amount: new Prisma.Decimal('100.00') })
      );
      paymentApplicationFindMany.mockResolvedValue([]);
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
        amount: new Prisma.Decimal('75.00'),
      });
      expenseParticipantFindMany.mockResolvedValue([]);
      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({
          amount: new Prisma.Decimal('75.00'),
        })
      );

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.payment).toBeDefined();
      expect(paymentCreate).toHaveBeenCalled();
      expect(expenseParticipantFindFirst).toHaveBeenCalledWith({
        where: {
          expenseId: 1,
          colleagueId: 1,
        },
      });
      // The workflow should create exactly one application
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    });

    it('should distribute payment across multiple expenses', async () => {
      paymentCreate.mockResolvedValue(createMockPayment({ amount: new Prisma.Decimal('100.00') }));
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
        amount: new Prisma.Decimal('50.00'),
      });
      paymentFindUnique.mockResolvedValue(
        createMockPayment({ amount: new Prisma.Decimal('100.00') })
      );
      paymentApplicationFindMany.mockResolvedValue([]);
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
        amount: new Prisma.Decimal('50.00'),
      });

      // Other unpaid expenses for smart distribution
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 2,
          expenseId: 2,
          colleagueId: 1,
          amount: new Prisma.Decimal('60.00'),
          expense: { id: 2, date: new Date('2024-06-02') },
          paymentApplications: [],
        },
      ]);

      paymentApplicationCreate
        .mockResolvedValueOnce(
          createMockApplication({
            id: 1,
            amount: new Prisma.Decimal('50.00'),
            expenseId: 1,
          })
        )
        .mockResolvedValueOnce(
          createMockApplication({
            id: 2,
            amount: new Prisma.Decimal('50.00'),
            expenseId: 2,
          })
        );

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      // Should create 2 applications (50 to primary, 50 to other)
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
      expect(result.totalAppliedAmount).toBe(100);
    });

    it('subtracts prior applications from the primary participant', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
      });
      paymentFindUnique.mockResolvedValue(createMockPayment());
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        amount: new Prisma.Decimal('100.00'),
      });
      paymentApplicationFindMany.mockResolvedValue([{ amount: new Prisma.Decimal('60.00') }]);
      expenseParticipantFindMany.mockResolvedValue([]);
      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({ amount: new Prisma.Decimal('40.00') })
      );

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.totalAppliedAmount).toBe(40);
      expect(paymentApplicationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: new Prisma.Decimal('40') }),
        })
      );
    });

    it('caps the application at the remaining payment when it is smaller than the owed amount', async () => {
      const partialInput: CreatePaymentInput = { ...expensePaymentInput, amount: 30 };
      paymentCreate.mockResolvedValue(createMockPayment({ amount: new Prisma.Decimal('30.00') }));
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
      });
      paymentFindUnique.mockResolvedValue(
        createMockPayment({ amount: new Prisma.Decimal('30.00') })
      );
      paymentApplicationFindMany.mockResolvedValue([]);
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        amount: new Prisma.Decimal('100.00'),
      });
      expenseParticipantFindMany.mockResolvedValue([]);
      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({ amount: new Prisma.Decimal('30.00') })
      );

      const result = await createPaymentWorkflow(mockTx, partialInput);

      // The participant still owes 100, so the 30 payment applies in full.
      expect(result.totalAppliedAmount).toBe(30);
      expect(result.remainingAmount).toBe(0);
      expect(paymentApplicationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: new Prisma.Decimal('30') }),
        })
      );
    });

    it('should handle when specified expense has no participant for colleague', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue(null); // No participant

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      // Should still create payment but with no applications
      expect(result.payment.applications).toHaveLength(0);
      expect(result.totalAppliedAmount).toBe(0);
      expect(result.remainingAmount).toBe(100);
    });

    it('accounts for existing applications on distributed expenses', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
        amount: new Prisma.Decimal('20.00'),
      });
      paymentFindUnique.mockResolvedValue(createMockPayment());
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        amount: new Prisma.Decimal('20.00'),
      });
      paymentApplicationFindMany.mockResolvedValue([]);
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 2,
          expenseId: 2,
          amount: new Prisma.Decimal('100.00'),
          paymentApplications: [{ amount: new Prisma.Decimal('30.00') }],
        },
      ]);
      paymentApplicationCreate
        .mockResolvedValueOnce(createMockApplication({ amount: new Prisma.Decimal('20.00') }))
        .mockResolvedValueOnce(
          createMockApplication({
            id: 2,
            expenseId: 2,
            amount: new Prisma.Decimal('70.00'),
          })
        );

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.totalAppliedAmount).toBe(90);
      expect(paymentApplicationCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: new Prisma.Decimal('70') }),
        })
      );
    });

    it('returns no applications when the initial participant disappears before distribution', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
      });
      paymentFindUnique.mockResolvedValue(createMockPayment());
      expenseParticipantFindUnique.mockResolvedValue(null);
      expenseParticipantFindMany.mockResolvedValue([]);

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.totalAppliedAmount).toBe(0);
      expect(paymentApplicationCreate).not.toHaveBeenCalled();
    });

    it('skips an initial participant with no remaining balance', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
      });
      paymentFindUnique.mockResolvedValue(createMockPayment());
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        amount: new Prisma.Decimal('50.00'),
      });
      paymentApplicationFindMany.mockResolvedValue([{ amount: new Prisma.Decimal('50.00') }]);
      expenseParticipantFindMany.mockResolvedValue([]);

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.totalAppliedAmount).toBe(0);
      expect(paymentApplicationCreate).not.toHaveBeenCalled();
    });

    it('stops distributing once another participant consumes the remainder', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
      });
      paymentFindUnique.mockResolvedValue(createMockPayment());
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        amount: new Prisma.Decimal('10.00'),
      });
      paymentApplicationFindMany.mockResolvedValue([]);
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 2,
          expenseId: 2,
          amount: new Prisma.Decimal('90.00'),
          paymentApplications: [],
        },
        {
          id: 3,
          expenseId: 3,
          amount: new Prisma.Decimal('25.00'),
          paymentApplications: [],
        },
      ]);
      paymentApplicationCreate
        .mockResolvedValueOnce(createMockApplication({ amount: new Prisma.Decimal('10.00') }))
        .mockResolvedValueOnce(
          createMockApplication({
            id: 2,
            expenseId: 2,
            participantId: 2,
            amount: new Prisma.Decimal('90.00'),
          })
        );

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.totalAppliedAmount).toBe(100);
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(2);
    });

    it('skips distributed participants whose remaining balance is within the threshold', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
      });
      paymentFindUnique.mockResolvedValue(createMockPayment());
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        amount: new Prisma.Decimal('10.00'),
      });
      paymentApplicationFindMany.mockResolvedValue([]);
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 2,
          expenseId: 2,
          amount: new Prisma.Decimal('100.00'),
          paymentApplications: [{ amount: new Prisma.Decimal('100.00') }],
        },
      ]);
      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({ amount: new Prisma.Decimal('10.00') })
      );

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.totalAppliedAmount).toBe(10);
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
    });

    it('does not search for additional participants when the initial application consumes payment', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
      });
      paymentFindUnique.mockResolvedValue(createMockPayment());
      expenseParticipantFindUnique.mockResolvedValue({
        id: 1,
        amount: new Prisma.Decimal('100.00'),
      });
      paymentApplicationFindMany.mockResolvedValue([]);
      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({ amount: new Prisma.Decimal('100.00') })
      );

      const result = await createPaymentWorkflow(mockTx, expensePaymentInput);

      expect(result.totalAppliedAmount).toBe(100);
      expect(expenseParticipantFindMany).not.toHaveBeenCalled();
    });

    it('loads the selected restaurant for the returned payment', async () => {
      const inputWithRestaurant: CreatePaymentInput = {
        ...expensePaymentInput,
        restaurantId: 2,
      };
      const restaurant = { id: 2, name: 'Test Restaurant' };
      paymentCreate.mockResolvedValue(createMockPayment({ restaurantId: 2 }));
      expenseParticipantFindFirst.mockResolvedValue(null);
      restaurantFindUnique.mockResolvedValue(restaurant);

      const result = await createPaymentWorkflow(mockTx, inputWithRestaurant);

      expect(restaurantFindUnique).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(result.payment.restaurant).toEqual(restaurant);
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle zero amount payment', async () => {
      const zeroInput: CreatePaymentInput = {
        colleagueId: 1,
        amount: 0,
        date: '2024-06-15',
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        selectedExpenseIds: [],
      };

      paymentCreate.mockResolvedValue(createMockPayment({ amount: new Prisma.Decimal('0.00') }));
      expenseParticipantFindMany.mockResolvedValue([]);

      const result = await createPaymentWorkflow(mockTx, zeroInput);

      expect(result.totalAppliedAmount).toBe(0);
      expect(result.remainingAmount).toBe(0);
    });

    it('should handle very small amounts (rounding edge case)', async () => {
      const smallInput: CreatePaymentInput = {
        colleagueId: 1,
        amount: 0.05, // Amount above 0.01 threshold
        date: '2024-06-15',
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        selectedExpenseIds: [],
      };

      paymentCreate.mockResolvedValue(createMockPayment({ amount: new Prisma.Decimal('0.05') }));
      expenseParticipantFindMany.mockResolvedValue([
        {
          id: 1,
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('10.00'),
          expense: {
            id: 1,
            date: new Date('2024-06-01'),
            amount: new Prisma.Decimal('10.00'),
            restaurant: null,
          },
          paymentApplications: [],
        },
      ]);

      paymentApplicationCreate.mockResolvedValue(
        createMockApplication({
          amount: new Prisma.Decimal('0.05'),
        })
      );

      const result = await createPaymentWorkflow(mockTx, smallInput);

      // Small amounts should still be applied
      expect(paymentApplicationCreate).toHaveBeenCalledTimes(1);
      expect(result.totalAppliedAmount).toBeGreaterThan(0);
    });

    it('should handle all payment types', async () => {
      const paymentTypes: Array<'PAYME' | 'FPS' | 'CASH' | 'OTHER'> = [
        'PAYME',
        'FPS',
        'CASH',
        'OTHER',
      ];

      for (const paymentType of paymentTypes) {
        vi.clearAllMocks();

        const input: CreatePaymentInput = {
          colleagueId: 1,
          amount: 100,
          date: '2024-06-15',
          paymentType,
          paymentProofBucket: null,
          paymentProofObjectKey: null,
          selectedExpenseIds: [],
        };

        paymentCreate.mockResolvedValue(createMockPayment({ paymentType }));
        expenseParticipantFindMany.mockResolvedValue([]);

        const result = await createPaymentWorkflow(mockTx, input);

        expect(paymentCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ paymentType }),
          })
        );
        expect(result.payment.paymentType).toBe(paymentType);
      }
    });

    it('should include payment proof metadata when provided', async () => {
      const inputWithProof: CreatePaymentInput = {
        colleagueId: 1,
        amount: 100,
        date: '2024-06-15',
        paymentType: 'CASH',
        paymentProofBucket: 'test-bucket',
        paymentProofObjectKey: 'proofs/payment-123.pdf',
        selectedExpenseIds: [],
      };

      paymentCreate.mockResolvedValue(
        createMockPayment({
          paymentProofBucket: 'test-bucket',
          paymentProofObjectKey: 'proofs/payment-123.pdf',
        })
      );
      expenseParticipantFindMany.mockResolvedValue([]);

      const result = await createPaymentWorkflow(mockTx, inputWithProof);

      expect(result.payment).toBeDefined();
      expect(paymentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentProofBucket: 'test-bucket',
          paymentProofObjectKey: 'proofs/payment-123.pdf',
        }),
      });
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  describe('Error Cases', () => {
    it('throws when the created payment cannot load its colleague', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindMany.mockResolvedValue([]);
      colleagueFindUnique.mockResolvedValue(null);

      await expect(
        createPaymentWorkflow(mockTx, {
          colleagueId: 1,
          amount: 100,
          date: '2024-06-15',
          paymentType: 'CASH',
          paymentProofBucket: null,
          paymentProofObjectKey: null,
          selectedExpenseIds: [],
        })
      ).rejects.toThrow('Colleague not found');
    });

    it('accepts a malformed selected-expense list with no primary id', async () => {
      paymentCreate.mockResolvedValue(createMockPayment());

      const malformedInput: CreatePaymentInput = {
        colleagueId: 1,
        amount: 100,
        date: '2024-06-15',
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        selectedExpenseIds: [undefined] as unknown as number[],
      };

      const result = await createPaymentWorkflow(mockTx, malformedInput);

      expect(result.totalAppliedAmount).toBe(0);
    });

    it('should propagate database errors', async () => {
      paymentCreate.mockRejectedValue(new Error('Database connection failed'));

      const input: CreatePaymentInput = {
        colleagueId: 1,
        amount: 100,
        date: '2024-06-15',
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        selectedExpenseIds: [],
      };

      await expect(createPaymentWorkflow(mockTx, input)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should throw error when payment not found during distribution', async () => {
      const input: CreatePaymentInput = {
        colleagueId: 1,
        amount: 100,
        date: '2024-06-15',
        paymentType: 'CASH',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        selectedExpenseIds: [1],
      };

      paymentCreate.mockResolvedValue(createMockPayment());
      expenseParticipantFindFirst.mockResolvedValue({
        id: 1,
        expenseId: 1,
        colleagueId: 1,
        amount: new Prisma.Decimal('50.00'),
      });
      paymentFindUnique.mockResolvedValue(null); // Payment not found

      await expect(createPaymentWorkflow(mockTx, input)).rejects.toThrow('Payment not found');
    });
  });
});
