/**
 * Delete Payment Workflow Tests
 *
 * Verifies payment deletion logic and proof metadata return for post-tx MinIO cleanup.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DeletePaymentInput, deletePaymentWorkflow } from './delete-payment-workflow';

describe('deletePaymentWorkflow', () => {
  let mockTx: {
    payment: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  };
  let txClient: Prisma.TransactionClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      payment: {
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    };
    // Single cast at assignment — no per-call-site casts needed
    txClient = mockTx as unknown as Prisma.TransactionClient;
  });

  it('should delete a payment and return its proof metadata', async () => {
    mockTx.payment.findUnique.mockResolvedValue({
      paymentProofBucket: 'proof-bucket',
      paymentProofObjectKey: 'proofs/payment-123.pdf',
    });
    mockTx.payment.delete.mockResolvedValue({ id: 1 });

    const input: DeletePaymentInput = { paymentId: 1 };
    const result = await deletePaymentWorkflow(txClient, input);

    expect(mockTx.payment.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: {
        paymentProofBucket: true,
        paymentProofObjectKey: true,
      },
    });
    expect(mockTx.payment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result.deletedPaymentId).toBe(1);
    expect(result.proofsToCleanUp).toEqual([
      {
        paymentProofBucket: 'proof-bucket',
        paymentProofObjectKey: 'proofs/payment-123.pdf',
      },
    ]);
  });

  it('should return empty proofsToCleanUp when payment has no proof', async () => {
    mockTx.payment.findUnique.mockResolvedValue({
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    });
    mockTx.payment.delete.mockResolvedValue({ id: 2 });

    const result = await deletePaymentWorkflow(txClient, { paymentId: 2 });

    expect(result.proofsToCleanUp).toEqual([]);
  });

  it('should throw when payment not found', async () => {
    mockTx.payment.findUnique.mockResolvedValue(null);

    await expect(deletePaymentWorkflow(txClient, { paymentId: 999 })).rejects.toThrow(
      'Payment not found'
    );

    expect(mockTx.payment.delete).not.toHaveBeenCalled();
  });

  it('should propagate database errors from findUnique', async () => {
    mockTx.payment.findUnique.mockRejectedValue(new Error('DB connection lost'));

    await expect(deletePaymentWorkflow(txClient, { paymentId: 1 })).rejects.toThrow(
      'DB connection lost'
    );
  });

  it('should propagate database errors from delete', async () => {
    mockTx.payment.findUnique.mockResolvedValue({
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    });
    mockTx.payment.delete.mockRejectedValue(new Error('FK constraint'));

    await expect(deletePaymentWorkflow(txClient, { paymentId: 1 })).rejects.toThrow(
      'FK constraint'
    );
  });
});
