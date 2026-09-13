/**
 * Cancel Redundant Pending Claims Workflow Tests
 *
 * Verifies that redundant colleague claims are correctly identified and deleted
 * when expenses become fully paid.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelRedundantPendingClaimsWorkflow } from './cancel-redundant-pending-claims-workflow';

describe('cancelRedundantPendingClaimsWorkflow', () => {
  let mockTx: {
    expenseParticipant: { findMany: ReturnType<typeof vi.fn> };
    payment: { findMany: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  };
  let txClient: Prisma.TransactionClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      expenseParticipant: {
        findMany: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
        delete: vi.fn(),
      },
    };
    // Single cast at assignment — no per-call-site casts needed
    txClient = mockTx as unknown as Prisma.TransactionClient;
  });

  it('should return empty result when no participants exist', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([]);

    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(result.canceledCount).toBe(0);
    expect(result.proofsToCleanUp).toEqual([]);
    expect(mockTx.payment.findMany).not.toHaveBeenCalled();
  });

  it('should return empty result when no expenses are fully paid', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          {
            payment: { isApproved: true },
            amount: new Prisma.Decimal('50.00'),
          },
        ],
      },
    ]);

    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(result.canceledCount).toBe(0);
    expect(mockTx.payment.findMany).not.toHaveBeenCalled();
  });

  it('should cancel pending claims for fully paid expenses', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          {
            payment: { isApproved: true },
            amount: new Prisma.Decimal('100.00'),
          },
        ],
      },
    ]);

    mockTx.payment.findMany.mockResolvedValue([
      {
        id: 10,
        expenseId: 1,
        paymentProofBucket: null,
        paymentProofObjectKey: null,
      },
    ]);
    mockTx.payment.delete.mockResolvedValue({ id: 10 });

    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(result.canceledCount).toBe(1);
    expect(mockTx.payment.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('should collect proof metadata for claims with payment proof', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 5,
        amount: new Prisma.Decimal('200.00'),
        paymentApplications: [
          {
            payment: { isApproved: true },
            amount: new Prisma.Decimal('200.00'),
          },
        ],
      },
    ]);

    mockTx.payment.findMany.mockResolvedValue([
      {
        id: 20,
        expenseId: 5,
        paymentProofBucket: 'claims-bucket',
        paymentProofObjectKey: 'claims/proof.pdf',
      },
    ]);
    mockTx.payment.delete.mockResolvedValue({ id: 20 });

    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(result.proofsToCleanUp).toEqual([
      {
        paymentId: 20,
        expenseId: 5,
        paymentProofBucket: 'claims-bucket',
        paymentProofObjectKey: 'claims/proof.pdf',
      },
    ]);
  });

  it('should handle multiple fully paid expenses with multiple claims', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('50.00'),
        paymentApplications: [
          { payment: { isApproved: true }, amount: new Prisma.Decimal('50.00') },
        ],
      },
      {
        expenseId: 2,
        amount: new Prisma.Decimal('75.00'),
        paymentApplications: [
          { payment: { isApproved: true }, amount: new Prisma.Decimal('75.00') },
        ],
      },
      {
        expenseId: 3,
        amount: new Prisma.Decimal('30.00'),
        paymentApplications: [
          { payment: { isApproved: true }, amount: new Prisma.Decimal('10.00') },
        ],
      },
    ]);

    mockTx.payment.findMany.mockResolvedValue([
      { id: 11, expenseId: 1, paymentProofBucket: null, paymentProofObjectKey: null },
      { id: 12, expenseId: 2, paymentProofBucket: 'b2', paymentProofObjectKey: 'k2' },
    ]);
    mockTx.payment.delete.mockResolvedValue({ id: 0 });

    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(result.canceledCount).toBe(2);
    expect(mockTx.payment.delete).toHaveBeenCalledTimes(2);
    expect(result.proofsToCleanUp).toHaveLength(1);
    expect(result.proofsToCleanUp[0]?.paymentId).toBe(12);
  });

  it('should only count approved applications toward total applied', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          { payment: { isApproved: true }, amount: new Prisma.Decimal('50.00') },
          { payment: { isApproved: false }, amount: new Prisma.Decimal('50.00') },
        ],
      },
    ]);

    // Expense is NOT fully paid (only 50 of 100 from approved payments)
    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(result.canceledCount).toBe(0);
    expect(mockTx.payment.findMany).not.toHaveBeenCalled();
  });

  it('should only look for COLLEAGUE_CLAIM pending payments', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          { payment: { isApproved: true }, amount: new Prisma.Decimal('100.00') },
        ],
      },
    ]);

    mockTx.payment.findMany.mockResolvedValue([]);

    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(mockTx.payment.findMany).toHaveBeenCalledWith({
      where: {
        colleagueId: 1,
        isApproved: false,
        createdBy: 'COLLEAGUE_CLAIM',
        expenseId: { in: [1] },
      },
    });
    expect(result.canceledCount).toBe(0);
  });

  it('uses expenseId 0 when a canceled claim has a null expenseId', async () => {
    mockTx.expenseParticipant.findMany.mockResolvedValue([
      {
        expenseId: 1,
        amount: new Prisma.Decimal('100.00'),
        paymentApplications: [
          { payment: { isApproved: true }, amount: new Prisma.Decimal('100.00') },
        ],
      },
    ]);
    mockTx.payment.findMany.mockResolvedValue([
      {
        id: 42,
        expenseId: null,
        paymentProofBucket: 'bucket',
        paymentProofObjectKey: 'key',
      },
    ]);
    mockTx.payment.delete.mockResolvedValue({ id: 42 });

    const result = await cancelRedundantPendingClaimsWorkflow(txClient, { colleagueId: 1 });

    expect(result.proofsToCleanUp).toEqual([
      {
        paymentId: 42,
        expenseId: 0,
        paymentProofBucket: 'bucket',
        paymentProofObjectKey: 'key',
      },
    ]);
  });
});
