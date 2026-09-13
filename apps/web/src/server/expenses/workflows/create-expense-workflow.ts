/**
 * Create Expense Workflow
 *
 * Extracted business logic for creating expenses and their participants/items.
 * This is the testable core of the createExpense, createExpenseWithReceipt,
 * and duplicateExpense handlers.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (cache, external services) are injected as dependencies
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '@/utils/errors';
import { calculateEqualSplit, calculateItemizedSplit, validateSplitData } from '../calculations';
import { EXPENSE_INCLUDE } from '../serialization';

// =============================================================================
// TYPES
// =============================================================================

export interface ExpenseItemInput {
  name?: string | undefined;
  price: number;
  colleagueId: number;
}

export interface CreateExpenseInput {
  date: string;
  restaurantId: number;
  amount: number;
  splitType: 'EQUAL' | 'ITEMIZED';
  notes?: string | null | undefined;
  participantIds: number[];
  items?: ExpenseItemInput[] | undefined;
  receiptBucket?: string | null | undefined;
  receiptObjectKey?: string | null | undefined;
}

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

export interface CreateExpenseResult {
  expense: ExpenseQueryResult;
}

/** Guarantees itemized items after validateSplitData — also unit-tested for the missing path. */
export function requireItemizedItems(items: ExpenseItemInput[] | undefined): ExpenseItemInput[] {
  if (items === undefined) {
    throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Itemized split requires items');
  }
  return items;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function createExpenseWorkflow(
  tx: Prisma.TransactionClient,
  input: CreateExpenseInput
): Promise<CreateExpenseResult> {
  // Validate split type and data consistency
  validateSplitData(input.splitType, input.amount, input.items);

  // Create the expense record
  const expense = await tx.expense.create({
    data: {
      date: new Date(input.date),
      restaurantId: input.restaurantId,
      amount: input.amount,
      splitType: input.splitType,
      notes: input.notes ?? null,
      receiptBucket: input.receiptBucket ?? null,
      receiptObjectKey: input.receiptObjectKey ?? null,
    },
  });

  // Handle participants based on split type
  if (input.splitType === 'EQUAL') {
    const splits = calculateEqualSplit(input.amount, input.participantIds);
    for (const { colleagueId, amount } of splits) {
      await tx.expenseParticipant.create({
        data: {
          expenseId: expense.id,
          colleagueId,
          amount,
        },
      });
    }
  } else {
    const itemsArray = requireItemizedItems(input.items);
    const splits = calculateItemizedSplit(itemsArray);

    // Create expense items
    for (const item of itemsArray) {
      await tx.expenseItem.create({
        data: {
          expenseId: expense.id,
          name: item.name || 'Unnamed Item',
          price: item.price,
          colleagueId: item.colleagueId,
        },
      });
    }

    // Create expense participants
    for (const { colleagueId, amount } of splits) {
      await tx.expenseParticipant.create({
        data: {
          expenseId: expense.id,
          colleagueId,
          amount,
        },
      });
    }
  }

  // Fetch the complete expense with relations
  const completeExpense = await tx.expense.findUnique({
    where: { id: expense.id },
    include: EXPENSE_INCLUDE,
  });

  if (!completeExpense) {
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch created expense');
  }

  return {
    expense: completeExpense,
  };
}
