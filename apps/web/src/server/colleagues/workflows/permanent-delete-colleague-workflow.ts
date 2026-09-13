import type { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '@/utils/errors';

export interface PermanentDeleteColleagueInput {
  id: number;
}

export interface PermanentDeleteColleagueResult {
  id: number;
  name: string;
}

export async function permanentDeleteColleagueWorkflow(
  tx: Prisma.TransactionClient,
  input: PermanentDeleteColleagueInput
): Promise<PermanentDeleteColleagueResult> {
  const colleague = await tx.colleague.findFirst({
    where: { id: input.id, deletedAt: { not: null } },
  });

  if (!colleague) {
    throw new AppError(
      ErrorCode.BUSINESS_PARTICIPANT_NOT_FOUND_OR_INACTIVE,
      'Colleague not found or is not inactive'
    );
  }

  const [expenseParticipantCount, paymentCount, expenseItemCount] = await Promise.all([
    tx.expenseParticipant.count({ where: { colleagueId: input.id } }),
    tx.payment.count({ where: { colleagueId: input.id } }),
    tx.expenseItem.count({ where: { colleagueId: input.id } }),
  ]);

  const blockers: string[] = [];
  if (expenseParticipantCount > 0) {
    blockers.push(`${expenseParticipantCount} expense participant(s)`);
  }
  if (paymentCount > 0) {
    blockers.push(`${paymentCount} payment(s)`);
  }
  if (expenseItemCount > 0) {
    blockers.push(`${expenseItemCount} expense item(s)`);
  }

  if (blockers.length > 0) {
    throw new AppError(
      ErrorCode.BUSINESS_HAS_RELATED_EXPENSES,
      `Cannot permanently delete: colleague has ${blockers.join(', ')}. Remove related records first.`
    );
  }

  const deleted = await tx.colleague.delete({
    where: { id: input.id },
  });

  return {
    id: deleted.id,
    name: deleted.name,
  };
}
