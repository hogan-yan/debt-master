/**
 * Approve Claim Workflow
 *
 * Extracted business logic for approving payment claims for expense participants.
 * This is the testable core of the approvePaymentClaim handler.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (cache, external services) are injected as dependencies
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { serializeDecimal } from '@/server/utils/decimal';
import { withColleagueLock } from '@/server/utils/tx-locks';
import { AppError, ErrorCode } from '@/utils/errors';
// =============================================================================
// TYPES
// =============================================================================

export interface ApproveClaimInput {
  participantId: number;
}

export interface ApproveClaimResult {
  approvedPayments: Prisma.PaymentGetPayload<{
    include: {
      colleague: true;
      restaurant: true;
    };
  }>[];
  participantId: number;
  colleagueId: number;
  expenseId: number;
  totalApproved: number;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function approveClaimWorkflow(
  tx: Prisma.TransactionClient,
  input: ApproveClaimInput
): Promise<ApproveClaimResult> {
  // Resolve the colleague from a MINIMAL read first, so we can serialize all of
  // their money flows before any balance-relevant read. If we fetched the full
  // participant (with includes) here and then locked, a concurrent mutation
  // could change the participant between that read and the lock, leaving us
  // approving against a stale row. Mirrors apply-unused-funds.
  const participantRef = await tx.expenseParticipant.findUnique({
    where: { id: input.participantId },
    select: { colleagueId: true },
  });

  if (!participantRef) {
    throw new AppError(ErrorCode.NOT_FOUND_PARTICIPANT, 'Participant not found');
  }

  // Run all balance reads/writes under the colleague row-lock so concurrent
  // approvals cannot double-apply the same payment.
  return withColleagueLock(tx, participantRef.colleagueId, async (lockedTx) => {
    // Re-read the participant (with includes) FRESH, now that the colleague is
    // locked — the read sees only data no other flow can still change.
    const participant = await lockedTx.expenseParticipant.findUnique({
      where: { id: input.participantId },
      include: {
        colleague: true,
        expense: {
          include: {
            restaurant: true,
          },
        },
      },
    });

    if (!participant) {
      throw new AppError(ErrorCode.NOT_FOUND_PARTICIPANT, 'Participant not found');
    }

    // Find pending payment claims for this specific participant and expense
    const pendingPayments = await lockedTx.payment.findMany({
      where: {
        colleagueId: participant.colleagueId,
        isApproved: false,
        createdBy: 'COLLEAGUE_CLAIM',
        expenseId: participant.expenseId,
      },
      include: {
        colleague: true,
        restaurant: true,
      },
      orderBy: {
        submittedAt: 'asc',
      },
    });

    if (!pendingPayments || pendingPayments.length === 0) {
      throw new AppError(
        ErrorCode.BUSINESS_NO_PENDING_CLAIM,
        'No pending payment claim found for this participant'
      );
    }

    const approvedPayments: Prisma.PaymentGetPayload<{
      include: {
        colleague: true;
        restaurant: true;
      };
    }>[] = [];

    for (const payment of pendingPayments) {
      // Approve the payment
      const approvedPayment = await lockedTx.payment.update({
        where: { id: payment.id },
        data: {
          isApproved: true,
        },
        include: {
          colleague: true,
          restaurant: true,
        },
      });

      // Create payment application for this specific participant
      await lockedTx.paymentApplication.create({
        data: {
          paymentId: payment.id,
          expenseId: participant.expenseId,
          participantId: participant.id,
          amount: payment.amount,
          appliedAt: new Date(),
        },
      });

      approvedPayments.push(approvedPayment);
    }

    const totalApproved = approvedPayments.reduce(
      (sum, payment) => sum + serializeDecimal(payment.amount),
      0
    );

    return {
      approvedPayments,
      participantId: input.participantId,
      colleagueId: participant.colleagueId,
      expenseId: participant.expenseId,
      totalApproved,
    };
  });
}
