/**
 * Create Claim Workflow
 *
 * Extracted business logic for creating payment claims for expense participants.
 * This is the testable core of the claimPayment and claimPaymentWithProof handlers.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (cache, external services) are injected as dependencies
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode } from '@/utils/errors';
// =============================================================================
// TYPES
// =============================================================================

export interface CreateClaimInput {
  participantId: number;
  amount?: number;
  paymentType?: 'PAYME' | 'FPS' | 'CASH' | 'OTHER';
  paymentProofBucket?: string | null;
  paymentProofObjectKey?: string | null;
}

export interface CreateClaimResult {
  payment: Prisma.PaymentGetPayload<{
    include: {
      colleague: true;
      restaurant: true;
    };
  }>;
  participantId: number;
  colleagueId: number;
  expenseId: number;
  participantAmount: number;
  remainingOwed: number;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function createClaimWorkflow(
  tx: Prisma.TransactionClient,
  input: CreateClaimInput
): Promise<CreateClaimResult> {
  // Check if participant exists
  const participant = await tx.expenseParticipant.findUnique({
    where: { id: input.participantId },
    include: {
      colleague: true,
      expense: {
        include: {
          restaurant: true,
        },
      },
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

  // Check if this participant already has enough APPROVED payment applications to cover their amount
  const totalApprovedPaid =
    participant.paymentApplications
      ?.filter((app) => app.payment?.isApproved)
      ?.reduce((sum, app) => sum + serializeDecimal(app.amount), 0) || 0;

  const participantAmount = serializeDecimal(participant.amount);

  if (totalApprovedPaid >= participantAmount) {
    throw new AppError(
      ErrorCode.BUSINESS_ALREADY_PAID,
      'This expense participant is already fully paid'
    );
  }

  // Check if there's already a pending claim for this specific participant and expense
  const existingPendingClaim = await tx.payment.findFirst({
    where: {
      colleagueId: participant.colleagueId,
      isApproved: false,
      createdBy: 'COLLEAGUE_CLAIM',
      expenseId: participant.expenseId,
    },
  });

  if (existingPendingClaim) {
    throw new AppError(
      ErrorCode.BUSINESS_CLAIM_PENDING,
      'A payment claim is already pending approval for this expense participant'
    );
  }

  const remainingOwed = participantAmount - totalApprovedPaid;

  const claimAmount = input.amount !== undefined ? input.amount : remainingOwed;

  // Create payment record with pending approval
  const payment = await tx.payment.create({
    data: {
      colleagueId: participant.colleagueId,
      amount: claimAmount,
      date: new Date(),
      paymentType: input.paymentType || 'PAYME',
      restaurantId: participant.expense?.restaurantId,
      paymentProofBucket: input.paymentProofBucket ?? null,
      paymentProofObjectKey: input.paymentProofObjectKey ?? null,
      expenseId: participant.expenseId,
      isApproved: false,
      submittedAt: new Date(),
      createdBy: 'COLLEAGUE_CLAIM',
    },
    include: {
      colleague: true,
      restaurant: true,
    },
  });

  return {
    payment,
    participantId: input.participantId,
    colleagueId: participant.colleagueId,
    expenseId: participant.expenseId,
    participantAmount,
    remainingOwed,
  };
}
