/**
 * Update Expense Workflow
 *
 * Extracted business logic for updating expenses and their participants/items.
 * This is the testable core of the updateExpense and updateExpenseWithReceipt handlers.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (cache, external services) are injected as dependencies
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode } from '@/utils/errors';
import { calculateEqualSplit, calculateItemizedSplit, validateSplitData } from '../calculations';
import { EXPENSE_INCLUDE } from '../serialization';
import { requireItemizedItems } from './create-expense-workflow';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result type for fetching an expense with the full EXPENSE_INCLUDE relations.
 * Derived from Prisma's generated types to match the exact include pattern.
 */
type ExpenseQueryResult = Prisma.ExpenseGetPayload<{
  include: {
    restaurant: true;
    participants: {
      include: {
        colleague: true;
        paymentApplications: {
          include: {
            payment: true;
          };
        };
      };
    };
    items: {
      include: {
        colleague: true;
      };
    };
  };
}>;

export interface ExpenseItemInput {
  name?: string | undefined;
  price: number;
  colleagueId: number;
}

export interface UpdateExpenseInput {
  id: number;
  date?: string | undefined;
  restaurantId?: number | undefined;
  amount?: number | undefined;
  splitType?: 'EQUAL' | 'ITEMIZED' | undefined;
  notes?: string | null | undefined;
  participantIds?: number[] | undefined;
  items?: ExpenseItemInput[] | undefined;
  receiptBucket?: string | null | undefined;
  receiptObjectKey?: string | null | undefined;
}

export interface UpdateExpenseResult {
  expense: ExpenseQueryResult;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function updateExpenseWorkflow(
  tx: Prisma.TransactionClient,
  input: UpdateExpenseInput
): Promise<UpdateExpenseResult> {
  // 1. Get the existing expense
  const existingExpense = await tx.expense.findUnique({
    where: { id: input.id },
    include: {
      participants: true,
      items: true,
    },
  });

  if (!existingExpense) {
    throw new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found');
  }

  // 2. Calculate final values for participant/item creation
  const finalSplitType = input.splitType || existingExpense.splitType;
  const finalAmount =
    input.amount !== undefined ? input.amount : serializeDecimal(existingExpense.amount);
  const finalParticipantIds =
    input.participantIds !== undefined
      ? input.participantIds
      : existingExpense.participants.map((p) => p.colleagueId);

  // 3. Validate split data consistency using final values
  if (finalSplitType === 'ITEMIZED') {
    validateSplitData(finalSplitType, finalAmount, input.items);
  }

  // 4. Remove existing related records first
  await tx.expenseItem.deleteMany({
    where: { expenseId: input.id },
  });

  await tx.expenseParticipant.deleteMany({
    where: { expenseId: input.id },
  });

  // 5. Build update data
  const updateData: Prisma.ExpenseUpdateInput = {
    ...(input.date !== undefined && { date: new Date(input.date) }),
    ...(input.restaurantId !== undefined && { restaurantId: input.restaurantId }),
    ...(input.amount !== undefined && { amount: input.amount }),
    ...(input.splitType !== undefined && { splitType: input.splitType }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.receiptBucket !== undefined && {
      receiptBucket: input.receiptBucket,
    }),
    ...(input.receiptObjectKey !== undefined && {
      receiptObjectKey: input.receiptObjectKey,
    }),
  };

  await tx.expense.update({
    where: { id: input.id },
    data: updateData,
  });

  // 6. Create new participants and items based on updated expense
  if (finalSplitType === 'EQUAL') {
    const splits = calculateEqualSplit(finalAmount, finalParticipantIds);
    for (const { colleagueId, amount } of splits) {
      await tx.expenseParticipant.create({
        data: {
          expenseId: input.id,
          colleagueId,
          amount,
        },
      });
    }
  } else {
    const itemsArray = requireItemizedItems(input.items);
    const splits = calculateItemizedSplit(itemsArray);

    for (const item of itemsArray) {
      await tx.expenseItem.create({
        data: {
          expenseId: input.id,
          name: item.name || 'Unnamed Item',
          price: item.price,
          colleagueId: item.colleagueId,
        },
      });
    }

    for (const { colleagueId, amount } of splits) {
      await tx.expenseParticipant.create({
        data: {
          expenseId: input.id,
          colleagueId,
          amount,
        },
      });
    }
  }

  // 7. Fetch the complete updated expense with relations
  const completeExpense = await tx.expense.findUnique({
    where: { id: input.id },
    include: EXPENSE_INCLUDE,
  });

  if (!completeExpense) {
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch updated expense');
  }

  return {
    expense: completeExpense,
  };
}
