/**
 * Bulk Claim for Colleague Workflow Tests
 *
 * Verifies that bulk payments are created correctly for all unpaid expenses,
 * and that redundant pending claims are cleaned up.
 *
 * Since this workflow composes createPaymentWorkflow and
 * cancelRedundantPendingClaimsWorkflow (which have their own tests), these
 * tests focus on the unpaid calculation and the composition wiring.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLockRawMocks, createMockTx } from '@/test/helpers/mock-transaction';
import {
  type BulkClaimInput,
  bulkClaimForColleagueWorkflow,
  requireFirstUnpaidExpenseId,
} from './bulk-claim-for-colleague-workflow';

describe('bulkClaimForColleagueWorkflow', () => {
  let mockTx: {
    expenseParticipant: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    payment: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    paymentApplication: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    colleague: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    restaurant: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let txClient: Prisma.TransactionClient;

  const baseInput: BulkClaimInput = {
    colleagueId: 1,
    paymentType: 'CASH',
    date: '2024-06-15',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = createMockTx(
      {
        expenseParticipant: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
          findUnique: vi.fn(),
        },
        payment: {
          create: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn(),
          delete: vi.fn(),
        },
        paymentApplication: {
          create: vi.fn(),
          findMany: vi.fn(),
        },
        colleague: {
          findUnique: vi.fn(),
        },
        restaurant: {
          findUnique: vi.fn(),
        },
      },
      createLockRawMocks()
    ) as unknown as typeof mockTx;
    txClient = mockTx as unknown as Prisma.TransactionClient;
  });

  it('should throw when colleague has no unpaid expenses', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([]);

    await expect(bulkClaimForColleagueWorkflow(txClient, baseInput)).rejects.toThrow(
      'This colleague has no unpaid expenses'
    );
  });

  it('should throw when all expenses are fully paid', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          { payment: { isApproved: true }, amount: new Prisma.Decimal('100.00') },
        ],
      },
    ]);

    await expect(bulkClaimForColleagueWorkflow(txClient, baseInput)).rejects.toThrow(
      'This colleague has no unpaid expenses'
    );
  });

  it('should create bulk payment for unpaid expenses and cancel redundant claims', async () => {
    // Unpaid calculation
    mockTx.expenseParticipant.findMany
      .mockResolvedValueOnce([
        {
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('50.00'),
          paymentApplications: [],
        },
        {
          expenseId: 2,
          colleagueId: 1,
          amount: new Prisma.Decimal('75.00'),
          paymentApplications: [],
        },
      ])
      // Second call: createPaymentWorkflow's distributePaymentSmartly queries unpaid participants
      .mockResolvedValueOnce([
        {
          id: 2,
          expenseId: 2,
          colleagueId: 1,
          amount: new Prisma.Decimal('75.00'),
          expense: { id: 2, date: new Date('2024-06-02') },
          paymentApplications: [],
        },
      ])
      // Third call: cancelRedundantPendingClaimsWorkflow queries participants
      .mockResolvedValueOnce([]);

    // createPaymentWorkflow mocks
    mockTx.payment.create.mockResolvedValue({
      id: 42,
      amount: new Prisma.Decimal('125.00'),
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
    });
    mockTx.expenseParticipant.findFirst.mockResolvedValue({
      id: 1,
      expenseId: 1,
      colleagueId: 1,
      amount: new Prisma.Decimal('50.00'),
    });
    mockTx.payment.findUnique.mockResolvedValue({
      id: 42,
      amount: new Prisma.Decimal('125.00'),
    });
    mockTx.paymentApplication.findMany.mockResolvedValue([]);
    mockTx.expenseParticipant.findUnique.mockResolvedValue({
      id: 1,
      expenseId: 1,
      colleagueId: 1,
      amount: new Prisma.Decimal('50.00'),
    });
    mockTx.paymentApplication.create
      .mockResolvedValueOnce({
        id: 1,
        paymentId: 42,
        expenseId: 1,
        participantId: 1,
        amount: new Prisma.Decimal('50.00'),
        appliedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 2,
        paymentId: 42,
        expenseId: 2,
        participantId: 2,
        amount: new Prisma.Decimal('75.00'),
        appliedAt: new Date(),
      });
    mockTx.colleague.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test Colleague',
      createdAt: new Date(),
    });
    mockTx.restaurant.findUnique.mockResolvedValue(null);

    // cancelRedundantPendingClaimsWorkflow mocks (no redundant claims)
    mockTx.payment.findMany.mockResolvedValue([]);

    const result = await bulkClaimForColleagueWorkflow(txClient, baseInput);

    expect(result.paymentId).toBe(42);
    expect(result.amount).toBe(125);
    expect(result.expenseCount).toBe(2);
    expect(result.canceledClaimCount).toBe(0);
  });

  it('should include proof cleanup from canceled claims', async () => {
    // Unpaid calculation
    mockTx.expenseParticipant.findMany
      .mockResolvedValueOnce([
        {
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('100.00'),
          paymentApplications: [],
        },
      ])
      // cancelRedundantPendingClaimsWorkflow queries participants
      .mockResolvedValueOnce([
        {
          expenseId: 1,
          amount: new Prisma.Decimal('100.00'),
          paymentApplications: [
            { payment: { isApproved: true }, amount: new Prisma.Decimal('100.00') },
          ],
        },
      ]);

    // createPaymentWorkflow mocks
    mockTx.payment.create.mockResolvedValue({
      id: 50,
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
    });
    mockTx.expenseParticipant.findFirst.mockResolvedValue({
      id: 1,
      expenseId: 1,
      colleagueId: 1,
      amount: new Prisma.Decimal('100.00'),
    });
    mockTx.payment.findUnique.mockResolvedValue({
      id: 50,
      amount: new Prisma.Decimal('100.00'),
    });
    mockTx.paymentApplication.findMany.mockResolvedValue([]);
    mockTx.expenseParticipant.findUnique.mockResolvedValue({
      id: 1,
      expenseId: 1,
      colleagueId: 1,
      amount: new Prisma.Decimal('100.00'),
    });
    mockTx.paymentApplication.create.mockResolvedValue({
      id: 1,
      paymentId: 50,
      expenseId: 1,
      participantId: 1,
      amount: new Prisma.Decimal('100.00'),
      appliedAt: new Date(),
    });
    mockTx.colleague.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test Colleague',
      createdAt: new Date(),
    });
    mockTx.restaurant.findUnique.mockResolvedValue(null);

    // cancelRedundantPendingClaimsWorkflow finds and deletes a claim
    mockTx.payment.findMany.mockResolvedValue([
      {
        id: 99,
        expenseId: 1,
        paymentProofBucket: 'claim-bucket',
        paymentProofObjectKey: 'claims/proof.pdf',
      },
    ]);
    mockTx.payment.delete.mockResolvedValue({ id: 99 });

    const result = await bulkClaimForColleagueWorkflow(txClient, baseInput);

    expect(result.canceledClaimCount).toBe(1);
    expect(result.proofsToCleanUp).toEqual([
      {
        paymentId: 99,
        expenseId: 1,
        paymentProofBucket: 'claim-bucket',
        paymentProofObjectKey: 'claims/proof.pdf',
      },
    ]);
  });

  it('should calculate unpaid correctly with partial payments', async () => {
    mockTx.expenseParticipant.findMany
      .mockResolvedValueOnce([
        {
          expenseId: 1,
          colleagueId: 1,
          amount: new Prisma.Decimal('100.00'),
          paymentApplications: [
            { payment: { isApproved: true }, amount: new Prisma.Decimal('60.00') },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    // createPaymentWorkflow mocks
    mockTx.payment.create.mockResolvedValue({
      id: 60,
      amount: new Prisma.Decimal('40.00'),
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
    });
    mockTx.expenseParticipant.findFirst.mockResolvedValue({
      id: 1,
      expenseId: 1,
      colleagueId: 1,
      amount: new Prisma.Decimal('100.00'),
    });
    mockTx.payment.findUnique.mockResolvedValue({
      id: 60,
      amount: new Prisma.Decimal('40.00'),
    });
    mockTx.paymentApplication.findMany.mockResolvedValue([{ amount: new Prisma.Decimal('60.00') }]);
    mockTx.expenseParticipant.findUnique.mockResolvedValue({
      id: 1,
      expenseId: 1,
      colleagueId: 1,
      amount: new Prisma.Decimal('100.00'),
    });
    mockTx.paymentApplication.create.mockResolvedValue({
      id: 1,
      paymentId: 60,
      expenseId: 1,
      participantId: 1,
      amount: new Prisma.Decimal('40.00'),
      appliedAt: new Date(),
    });
    mockTx.colleague.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test Colleague',
      createdAt: new Date(),
    });
    mockTx.restaurant.findUnique.mockResolvedValue(null);
    mockTx.payment.findMany.mockResolvedValue([]);

    const result = await bulkClaimForColleagueWorkflow(txClient, baseInput);

    // 100 - 60 = 40 unpaid
    expect(result.amount).toBe(40);
    expect(result.expenseCount).toBe(1);
  });
});

describe('requireFirstUnpaidExpenseId', () => {
  it('returns the first unpaid expense id', () => {
    expect(requireFirstUnpaidExpenseId([10, 20])).toBe(10);
  });

  it('throws when the unpaid list is empty', () => {
    expect(() => requireFirstUnpaidExpenseId([])).toThrow('This colleague has no unpaid expenses');
  });
});
