/**
 * Update Payment Workflow
 *
 * Extracted business logic for updating payments and their applications.
 * This is the testable core of the updatePayment handler.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (cache, external services) are injected as dependencies
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { toMinor } from '@/server/money/edge';
import { AppError, ErrorCode } from '@/utils/errors';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result type for fetching a payment with colleague, restaurant, and applications.
 * Derived from Prisma's generated types to match the exact include pattern.
 */
type PaymentWithBasicApplicationsResult = Prisma.PaymentGetPayload<{
  include: {
    colleague: true;
    restaurant: true;
    applications: true;
  };
}>;

export interface UpdatePaymentInput {
  id: number;
  colleagueId: number;
  amount: number;
  date: string;
  paymentType: 'PAYME' | 'FPS' | 'CASH' | 'OTHER';
  restaurantId?: number | undefined;
  paymentProofBucket: string | null;
  paymentProofObjectKey: string | null;
  selectedExpenseIds: number[];
  expenseAmounts: Record<string, string>;
}

export interface UpdatePaymentResult {
  payment: PaymentWithBasicApplicationsResult;
  totalAppliedAmount: number;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function updatePaymentWorkflow(
  tx: Prisma.TransactionClient,
  input: UpdatePaymentInput
): Promise<UpdatePaymentResult> {
  // Server-side validation: total of applications cannot exceed the payment amount
  // (exact minor-unit compare; no epsilon)
  const totalAppliedMinor = input.selectedExpenseIds.reduce(
    (sum, expenseId) => sum + toMinor(input.expenseAmounts[expenseId.toString()] || '0'),
    0n
  );

  if (toMinor(input.amount) < totalAppliedMinor) {
    throw new AppError(
      ErrorCode.BUSINESS_AMOUNT_EXCEEDS_APPLIED,
      'Payment amount cannot be less than the total applied amount.'
    );
  }

  const originalPayment = await tx.payment.findUnique({ where: { id: input.id } });
  if (!originalPayment) throw new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found');

  // Update the core payment details
  await tx.payment.update({
    where: { id: input.id },
    data: {
      colleagueId: input.colleagueId,
      amount: input.amount,
      date: new Date(input.date),
      paymentType: input.paymentType,
      restaurantId: input.restaurantId ?? null,
      paymentProofBucket: input.paymentProofBucket,
      paymentProofObjectKey: input.paymentProofObjectKey,
    },
  });

  // Overwrite existing applications with the new set
  await tx.paymentApplication.deleteMany({ where: { paymentId: input.id } });

  let appliedAmount = 0;

  if (input.selectedExpenseIds.length > 0) {
    for (const expenseId of input.selectedExpenseIds) {
      const applicationAmountStr = input.expenseAmounts[expenseId.toString()];
      const applicationAmount = Number.parseFloat(applicationAmountStr || '0');

      if (applicationAmount > 0) {
        const participant = await tx.expenseParticipant.findFirst({
          where: { expenseId, colleagueId: input.colleagueId },
        });
        if (participant) {
          await tx.paymentApplication.create({
            data: {
              paymentId: input.id,
              expenseId,
              participantId: participant.id,
              amount: applicationAmount,
              appliedAt: new Date(),
            },
          });
          appliedAmount += applicationAmount;
        }
      }
    }
  }

  const finalPayment = await tx.payment.findUnique({
    where: { id: input.id },
    include: { colleague: true, restaurant: true, applications: true },
  });

  if (!finalPayment) {
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch updated payment');
  }

  return {
    payment: finalPayment,
    totalAppliedAmount: appliedAmount,
  };
}
