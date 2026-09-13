/**
 * Delete Expense Workflow
 *
 * Extracted business logic for deleting expenses and optionally their related payments.
 * This is the testable core of the deleteExpense handler.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (MinIO deletions) are handled by the caller
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface DeleteExpenseInput {
  id: number;
  deleteRelatedPayments: boolean;
}

export interface DeletedPayment {
  id: number;
  paymentProofBucket: string | null;
  paymentProofObjectKey: string | null;
}

export interface DeleteExpenseResult {
  deletedExpenseId: number;
  deletedPayments: DeletedPayment[];
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function deleteExpenseWorkflow(
  tx: Prisma.TransactionClient,
  input: DeleteExpenseInput
): Promise<DeleteExpenseResult> {
  let deletedPayments: DeletedPayment[] = [];

  // If user chose to delete related payments, find and track them first
  if (input.deleteRelatedPayments) {
    const relatedPayments = await tx.payment.findMany({
      where: { expenseId: input.id },
      include: {
        applications: true,
      },
    });

    deletedPayments = relatedPayments.map((payment) => ({
      id: payment.id,
      paymentProofBucket: payment.paymentProofBucket,
      paymentProofObjectKey: payment.paymentProofObjectKey,
    }));

    // Delete the payment records (applications will be deleted via cascade)
    await tx.payment.deleteMany({
      where: { expenseId: input.id },
    });
  }

  // Delete related records first (due to foreign key constraints)
  await tx.expenseItem.deleteMany({
    where: { expenseId: input.id },
  });

  await tx.expenseParticipant.deleteMany({
    where: { expenseId: input.id },
  });

  // Delete the expense record
  await tx.expense.delete({
    where: { id: input.id },
  });

  return {
    deletedExpenseId: input.id,
    deletedPayments,
  };
}
