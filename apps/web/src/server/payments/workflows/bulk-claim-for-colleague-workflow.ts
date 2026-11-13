/**
 * Bulk Claim for Colleague Workflow
 *
 * Creates a single payment covering all unpaid expenses for a colleague,
 * using smart distribution via createPaymentWorkflow, and then cancels
 * any redundant pending colleague claims.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - Composes createPaymentWorkflow and cancelRedundantPendingClaimsWorkflow
 * - MinIO cleanup happens AFTER transaction commits (not inside)
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { toMinor } from '@/server/money/edge';
import { AppError, ErrorCode } from '@/utils/errors';
import { cancelRedundantPendingClaimsWorkflow } from './cancel-redundant-pending-claims-workflow';
import { createPaymentWorkflow } from './create-payment-workflow';
// =============================================================================
// TYPES
// =============================================================================

export type PaymentType = 'PAYME' | 'FPS' | 'CASH' | 'OTHER';

export interface BulkClaimInput {
  colleagueId: number;
  paymentType: PaymentType;
  date: string;
}

export interface BulkClaimResult {
  paymentId: number;
  amount: number;
  expenseCount: number;
  canceledClaimCount: number;
  proofsToCleanUp: Array<{
    paymentId: number;
    expenseId: number;
    paymentProofBucket: string;
    paymentProofObjectKey: string;
  }>;
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Creates a bulk payment for all of a colleague's unpaid expenses.
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Bulk claim parameters
 * @returns Payment details, count of covered expenses, and proof cleanup info
 * @throws Error if colleague has no unpaid expenses
 */
export async function bulkClaimForColleagueWorkflow(
  tx: Prisma.TransactionClient,
  input: BulkClaimInput
): Promise<BulkClaimResult> {
  const { totalUnpaid, unpaidExpenseIds } = await calculateUnpaidAmounts(tx, input.colleagueId);

  if (totalUnpaid <= 0n) {
    throw new AppError(
      ErrorCode.BUSINESS_NO_UNPAID_EXPENSES,
      'This colleague has no unpaid expenses'
    );
  }

  const firstUnpaidExpenseId = requireFirstUnpaidExpenseId(unpaidExpenseIds);

  const workflowResult = await createPaymentWorkflow(tx, {
    colleagueId: input.colleagueId,
    amount: Number(totalUnpaid) / 100,
    date: input.date,
    paymentType: input.paymentType,
    paymentProofBucket: null,
    paymentProofObjectKey: null,
    selectedExpenseIds: [firstUnpaidExpenseId],
  });

  const { canceledCount, proofsToCleanUp } = await cancelRedundantPendingClaimsWorkflow(tx, {
    colleagueId: input.colleagueId,
  });

  return {
    paymentId: workflowResult.payment.id,
    amount: Number(totalUnpaid) / 100,
    expenseCount: unpaidExpenseIds.length,
    canceledClaimCount: canceledCount,
    proofsToCleanUp,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface UnpaidCalculation {
  /** Exact minor units (cents) */
  totalUnpaid: bigint;
  unpaidExpenseIds: number[];
}

/** Indexed access helper for the first unpaid expense after the empty-list guard. */
export function requireFirstUnpaidExpenseId(unpaidExpenseIds: number[]): number {
  const firstUnpaidExpenseId = unpaidExpenseIds[0];
  if (firstUnpaidExpenseId === undefined) {
    throw new AppError(
      ErrorCode.BUSINESS_NO_UNPAID_EXPENSES,
      'This colleague has no unpaid expenses'
    );
  }
  return firstUnpaidExpenseId;
}

async function calculateUnpaidAmounts(
  tx: Prisma.TransactionClient,
  colleagueId: number
): Promise<UnpaidCalculation> {
  const participants = await tx.expenseParticipant.findMany({
    where: { colleagueId },
    include: {
      paymentApplications: { include: { payment: true } },
    },
  });

  let totalUnpaid = 0n;
  const unpaidExpenseIds: number[] = [];

  for (const p of participants) {
    const paid = p.paymentApplications
      .filter((app) => app.payment?.isApproved)
      .reduce((sum, app) => sum + toMinor(app.amount), 0n);
    const owed = toMinor(p.amount);
    const remaining = owed > paid ? owed - paid : 0n;
    if (remaining > 0n) {
      totalUnpaid += remaining;
      unpaidExpenseIds.push(p.expenseId);
    }
  }

  return { totalUnpaid, unpaidExpenseIds };
}
