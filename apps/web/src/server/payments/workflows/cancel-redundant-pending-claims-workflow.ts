/**
 * Cancel Redundant Pending Claims Workflow
 *
 * After a payment is applied (e.g. via smart distribution), some expense
 * participants may become fully paid while still having pending colleague
 * claims. This workflow finds and deletes those redundant claims within a
 * transaction, returning proof metadata for post-transaction MinIO cleanup.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - MinIO cleanup happens AFTER transaction commits (not inside)
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';

import { serializeDecimal } from '@/server/utils/decimal';
// =============================================================================
// TYPES
// =============================================================================

export interface CancelRedundantPendingClaimsInput {
  colleagueId: number;
}

export interface CanceledClaimProof {
  paymentId: number;
  expenseId: number;
  paymentProofBucket: string;
  paymentProofObjectKey: string;
}

export interface CancelRedundantPendingClaimsResult {
  canceledCount: number;
  proofsToCleanUp: CanceledClaimProof[];
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Finds and deletes pending colleague claims for expenses that are now fully
 * paid after a payment has been applied.
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Colleague to check for redundant claims
 * @returns Count of canceled claims and proof metadata for MinIO cleanup
 */
export async function cancelRedundantPendingClaimsWorkflow(
  tx: Prisma.TransactionClient,
  input: CancelRedundantPendingClaimsInput
): Promise<CancelRedundantPendingClaimsResult> {
  const participants = await tx.expenseParticipant.findMany({
    where: { colleagueId: input.colleagueId },
    include: {
      paymentApplications: {
        include: { payment: true },
      },
    },
  });

  const fullyPaidExpenseIds: number[] = [];

  for (const participant of participants) {
    const totalApplied = participant.paymentApplications
      .filter(
        (app: { payment?: { isApproved: boolean }; amount: Prisma.Decimal | number }) =>
          app.payment?.isApproved
      )
      .reduce(
        (sum: number, app: { amount: Prisma.Decimal | number }) =>
          sum + serializeDecimal(app.amount),
        0
      );

    const owed = serializeDecimal(participant.amount);

    if (totalApplied >= owed) {
      fullyPaidExpenseIds.push(participant.expenseId);
    }
  }

  if (fullyPaidExpenseIds.length === 0) {
    return { canceledCount: 0, proofsToCleanUp: [] };
  }

  const pendingClaims = await tx.payment.findMany({
    where: {
      colleagueId: input.colleagueId,
      isApproved: false,
      createdBy: 'COLLEAGUE_CLAIM',
      expenseId: { in: fullyPaidExpenseIds },
    },
  });

  const proofsToCleanUp: CanceledClaimProof[] = [];

  for (const claim of pendingClaims) {
    await tx.payment.delete({
      where: { id: claim.id },
    });

    if (claim.paymentProofBucket && claim.paymentProofObjectKey) {
      proofsToCleanUp.push({
        paymentId: claim.id,
        expenseId: claim.expenseId ?? 0,
        paymentProofBucket: claim.paymentProofBucket,
        paymentProofObjectKey: claim.paymentProofObjectKey,
      });
    }
  }

  return {
    canceledCount: pendingClaims.length,
    proofsToCleanUp,
  };
}
