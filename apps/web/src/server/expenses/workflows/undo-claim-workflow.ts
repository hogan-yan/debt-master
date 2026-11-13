/**
 * Undo Claim Workflow
 *
 * Extracted business logic for undoing payment claims (both pending and approved).
 * This is the testable core of the undoPaymentClaim and undoPaymentApproval handlers.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (MinIO deletions) are handled by the caller
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode } from '@/utils/errors';
// =============================================================================
// TYPES
// =============================================================================

export type UndoType = 'PENDING' | 'APPROVED';

export interface UndoClaimInput {
  participantId: number;
  undoType: UndoType;
}

export interface DeletedPaymentInfo {
  id: number;
  paymentProofBucket: string | null;
  paymentProofObjectKey: string | null;
}

export interface UndoClaimResult {
  participantId: number;
  colleagueId: number;
  expenseId: number;
  deletedPayments: DeletedPaymentInfo[];
  totalReversedAmount: number;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function undoClaimWorkflow(
  tx: Prisma.TransactionClient,
  input: UndoClaimInput
): Promise<UndoClaimResult> {
  // Check if participant exists
  const participant = await tx.expenseParticipant.findUnique({
    where: { id: input.participantId },
    include: {
      colleague: true,
      expense: true,
      paymentApplications: {
        include: {
          payment: true,
        },
      },
    },
  });

  if (!participant) {
    throw new AppError(ErrorCode.NOT_FOUND_PARTICIPANT, 'Participant not found');
  }

  if (input.undoType === 'PENDING') {
    return handlePendingUndo(tx, input.participantId, participant);
  }
  return handleApprovedUndo(tx, input.participantId, participant);
}

async function handlePendingUndo(
  tx: Prisma.TransactionClient,
  participantId: number,
  participant: Prisma.ExpenseParticipantGetPayload<{
    include: {
      colleague: true;
      expense: true;
    };
  }>
): Promise<UndoClaimResult> {
  // Find pending payments by this colleague for this specific expense
  const pendingPayments = await tx.payment.findMany({
    where: {
      colleagueId: participant.colleagueId,
      isApproved: false,
      createdBy: 'COLLEAGUE_CLAIM',
      expenseId: participant.expenseId,
    },
  });

  if (!pendingPayments || pendingPayments.length === 0) {
    throw new AppError(
      ErrorCode.BUSINESS_NO_PENDING_CLAIM,
      'No pending payment claim found to undo'
    );
  }

  const deletedPayments: DeletedPaymentInfo[] = [];

  for (const payment of pendingPayments) {
    // Track payment info for MinIO cleanup
    deletedPayments.push({
      id: payment.id,
      paymentProofBucket: payment.paymentProofBucket,
      paymentProofObjectKey: payment.paymentProofObjectKey,
    });

    // Delete the payment record
    await tx.payment.delete({
      where: { id: payment.id },
    });
  }

  return {
    participantId,
    colleagueId: participant.colleagueId,
    expenseId: participant.expenseId,
    deletedPayments,
    totalReversedAmount: 0,
  };
}

async function handleApprovedUndo(
  tx: Prisma.TransactionClient,
  participantId: number,
  participant: Prisma.ExpenseParticipantGetPayload<{
    include: {
      colleague: true;
      expense: true;
      paymentApplications: {
        include: {
          payment: true;
        };
      };
    };
  }>
): Promise<UndoClaimResult> {
  // Filter to only approved payment applications
  const approvedApplications = participant.paymentApplications.filter(
    (app) => app.payment?.isApproved
  );

  if (approvedApplications.length === 0) {
    throw new AppError(
      ErrorCode.BUSINESS_NO_APPROVED_PAYMENTS,
      'Participant has no approved payments to undo'
    );
  }

  let totalReversedAmount = 0;

  for (const application of approvedApplications) {
    // Update payment to mark as not approved (pending again)
    await tx.payment.update({
      where: { id: application.payment.id },
      data: {
        isApproved: false,
      },
    });

    // Delete the payment application
    await tx.paymentApplication.delete({
      where: { id: application.id },
    });

    totalReversedAmount += serializeDecimal(application.amount);
  }

  return {
    participantId,
    colleagueId: participant.colleagueId,
    expenseId: participant.expenseId,
    deletedPayments: [],
    totalReversedAmount,
  };
}
