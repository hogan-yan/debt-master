/**
 * Delete Payment Workflow
 *
 * Extracted business logic for deleting a payment and its cascaded applications.
 * Returns proof metadata so the handler can clean up MinIO post-transaction.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - MinIO cleanup happens AFTER transaction commits (not inside)
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '@/utils/errors';

// =============================================================================
// TYPES
// =============================================================================

export interface DeletePaymentInput {
  paymentId: number;
}

export interface ProofMetadata {
  paymentProofBucket: string;
  paymentProofObjectKey: string;
}

export interface DeletePaymentResult {
  deletedPaymentId: number;
  proofsToCleanUp: ProofMetadata[];
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Deletes a payment within a transaction and returns proof metadata for
 * post-transaction MinIO cleanup.
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Payment deletion parameters
 * @returns Deleted payment ID and any proof files that need MinIO cleanup
 * @throws Error if payment not found
 */
export async function deletePaymentWorkflow(
  tx: Prisma.TransactionClient,
  input: DeletePaymentInput
): Promise<DeletePaymentResult> {
  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      paymentProofBucket: true,
      paymentProofObjectKey: true,
    },
  });

  if (!payment) {
    throw new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found');
  }

  await tx.payment.delete({
    where: { id: input.paymentId },
  });

  const proofsToCleanUp: ProofMetadata[] = [];
  if (payment.paymentProofBucket && payment.paymentProofObjectKey) {
    proofsToCleanUp.push({
      paymentProofBucket: payment.paymentProofBucket,
      paymentProofObjectKey: payment.paymentProofObjectKey,
    });
  }

  return {
    deletedPaymentId: input.paymentId,
    proofsToCleanUp,
  };
}
