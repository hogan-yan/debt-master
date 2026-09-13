import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import {
  getAuthFromCookie,
  requireAdminFromCookie,
  requireAuthFromCookie,
} from '@/server/infrastructure/auth/auth-cookie';
import { createServerLogger } from '@/server/infrastructure/logger';
import { prisma } from '@/server/infrastructure/prisma';
import { deleteFromStorage, uploadFileToStorage } from '@/server/infrastructure/storage';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';

const logger = createServerLogger('expenses', process.env.NODE_ENV === 'development');

/**
 * Best-effort storage cleanup. A failed delete leaves an orphaned object but
 * must never fail the request, so it is logged and swallowed.
 */
async function deleteFromStorageSafe(bucket: string, objectKey: string): Promise<void> {
  try {
    await deleteFromStorage(bucket, objectKey);
  } catch (error) {
    logger.warn('Storage cleanup failed (orphaned object left behind)', {
      bucket,
      objectKey,
      error: String(error),
    });
  }
}

import { serializeExpense } from './serialization';
import { ExpenseWithRelations } from './types';
import { approveClaimWorkflow } from './workflows/approve-claim-workflow';
import { autoApplyPrepaymentsForExpenseWorkflow } from './workflows/auto-apply-prepayments-for-expense-workflow';
import { createClaimWorkflow } from './workflows/create-claim-workflow';
import { createExpenseWorkflow } from './workflows/create-expense-workflow';
import { deleteExpenseWorkflow } from './workflows/delete-expense-workflow';
import { undoClaimWorkflow } from './workflows/undo-claim-workflow';
import { updateExpenseWorkflow } from './workflows/update-expense-workflow';

// Re-export workflows for testing
export {
  approveClaimWorkflow,
  createClaimWorkflow,
  createExpenseWorkflow,
  deleteExpenseWorkflow,
  undoClaimWorkflow,
  updateExpenseWorkflow,
};

// =============================================================================
// SCHEMAS
// =============================================================================

const numberArraySchema = z.array(z.number());

const expenseItemSchema = z
  .object({
    price: z.number(),
    colleagueId: z.number(),
    name: z.string().optional(),
  })
  // Strip undefined keys so optional properties are simply absent
  // rather than set to undefined (required by exactOptionalPropertyTypes)
  .transform(({ name, ...rest }) => (name === undefined ? rest : { ...rest, name }));
const expenseItemsSchema = z.array(expenseItemSchema).optional();

// =============================================================================
// POST-CREATION HELPERS
// =============================================================================

async function autoApplyPrepaymentsForExpense(expense: ExpenseWithRelations) {
  return prisma.$transaction(async (tx) => {
    return autoApplyPrepaymentsForExpenseWorkflow(tx, {
      participants: expense.participants,
    });
  });
}

// =============================================================================
// MUTATION FUNCTIONS (CREATE, UPDATE, DELETE OPERATIONS)
// =============================================================================

/**
 * Create a new expense - Admin only
 * Handles optional receipt upload via FormData
 */
export const createExpense = createServerFn({ method: 'POST' })
  .validator((formData: FormData) => {
    const rawReceiptFile = formData.get('receiptFile');
    const receiptFile = rawReceiptFile instanceof File ? rawReceiptFile : null;

    return z
      .object({
        date: z.string(),
        restaurantId: z.string().transform((val) => Number.parseInt(val, 10)),
        amount: z.string().transform((val) => Number.parseFloat(val)),
        splitType: z.enum(['EQUAL', 'ITEMIZED']),
        participantIds: z.string().transform((val) => numberArraySchema.parse(JSON.parse(val))),
        items: z
          .string()
          .nullable()
          .optional()
          .transform((val) => (val ? expenseItemsSchema.parse(JSON.parse(val)) : undefined)),
        notes: z.string().nullable().optional(),
        receiptFile: z.instanceof(File).nullable().optional(),
      })
      .parse({
        date: formData.get('date'),
        restaurantId: formData.get('restaurantId'),
        amount: formData.get('amount'),
        splitType: formData.get('splitType'),
        participantIds: formData.get('participantIds'),
        items: formData.get('items'),
        notes: formData.get('notes'),
        receiptFile,
      });
  })
  .handler(async ({ data }) => {
    try {
      // Verify admin authentication
      await requireAdminFromCookie();

      let receiptBucket: string | null = null;
      let receiptObjectKey: string | null = null;

      // Handle receipt upload if file provided
      if (data.receiptFile && data.receiptFile.size > 0) {
        const uploadResult = await uploadFileToStorage(data.receiptFile);
        receiptBucket = uploadResult.bucket;
        receiptObjectKey = uploadResult.objectKey;
      }

      const result = await prisma.$transaction(async (tx) => {
        return createExpenseWorkflow(tx, {
          date: data.date,
          restaurantId: data.restaurantId,
          amount: data.amount,
          splitType: data.splitType,
          notes: data.notes,
          participantIds: data.participantIds,
          items: data.items,
          receiptBucket,
          receiptObjectKey,
        });
      });
      const serializedExpense = serializeExpense(result.expense);
      const autoResult = await autoApplyPrepaymentsForExpense(result.expense);

      if (autoResult) {
        return {
          ...serializedExpense,
          autoApplications: autoResult.autoApplications,
          totalAutoApplied: autoResult.totalAutoApplied,
        };
      }

      return serializedExpense;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Failed to create expense', error);
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to create expense');
    }
  });

/**
 * Check if an expense has related payments
 */
export const getExpenseRelatedPayments = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    const user = await getAuthFromCookie();
    if (!user) {
      throw new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }

    const paymentCount = await prisma.payment.count({
      where: { expenseId: data.id },
    });

    return {
      hasRelatedPayments: paymentCount > 0,
      paymentCount,
    };
  });

/**
 * Delete an expense - Admin only
 */
export const deleteExpense = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
        deleteRelatedPayments: z.boolean().optional().default(false),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      // Get the expense with receipt info for cleanup
      const expense = await prisma.expense.findUnique({
        where: { id: data.id },
        select: { receiptBucket: true, receiptObjectKey: true },
      });

      if (!expense) {
        throw new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found');
      }

      // Run deletion workflow in transaction
      const result = await prisma.$transaction(async (tx) => {
        return deleteExpenseWorkflow(tx, {
          id: data.id,
          deleteRelatedPayments: data.deleteRelatedPayments,
        });
      });

      // Delete payment proof files from Minio if they exist (outside transaction)
      for (const payment of result.deletedPayments) {
        if (payment.paymentProofBucket && payment.paymentProofObjectKey) {
          await deleteFromStorageSafe(payment.paymentProofBucket, payment.paymentProofObjectKey);
        }
      }

      // Delete receipt from Minio if it exists (outside transaction)
      if (expense.receiptBucket && expense.receiptObjectKey) {
        await deleteFromStorageSafe(expense.receiptBucket, expense.receiptObjectKey);
      }

      return { success: true };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to delete expense');
    }
  });

// =============================================================================
// EXPENSE PAYMENT FUNCTIONS
// =============================================================================

/**
 * Claim payment for an expense participant
 * Handles optional payment proof upload via FormData
 */
export const claimPayment = createServerFn({ method: 'POST' })
  .validator((formData: FormData) => {
    const rawPaymentProofFile = formData.get('paymentProofFile');
    const paymentProofFile = rawPaymentProofFile instanceof File ? rawPaymentProofFile : null;

    return z
      .object({
        participantId: z.string().transform((val) => Number.parseInt(val, 10)),
        paymentProofFile: z.instanceof(File).nullable().optional(),
        paymentMethod: z.enum(['PAYME', 'FPS', 'CASH', 'OTHER']).optional().default('PAYME'),
      })
      .parse({
        participantId: formData.get('participantId'),
        paymentProofFile,
        paymentMethod: formData.get('paymentMethod'),
      });
  })
  .handler(async ({ data }) => {
    // Require an authenticated identity: prevents anonymous RPC from filing
    // pending claims. Ownership is not enforced here because access codes are
    // global (no colleagueId binding); the admin approval gate contains abuse.
    await requireAuthFromCookie();
    try {
      let paymentProofBucket: string | null = null;
      let paymentProofObjectKey: string | null = null;

      // Handle payment proof upload if file provided
      if (data.paymentProofFile && data.paymentProofFile.size > 0) {
        const uploadResult = await uploadFileToStorage(data.paymentProofFile);
        paymentProofBucket = uploadResult.bucket;
        paymentProofObjectKey = uploadResult.objectKey;
      }

      const result = await prisma.$transaction(async (tx) => {
        return createClaimWorkflow(tx, {
          participantId: data.participantId,
          paymentType: data.paymentMethod,
          paymentProofBucket,
          paymentProofObjectKey,
        });
      });

      return {
        success: true,
        participant: {
          id: result.participantId,
          expenseId: result.expenseId,
          colleagueId: result.colleagueId,
          amount: result.participantAmount,
        },
        payment: {
          ...result.payment,
          amount: serializeDecimal(result.payment.amount),
          colleague: result.payment.colleague ? { ...result.payment.colleague } : undefined,
        },
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Failed to claim payment', error);
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to claim payment');
    }
  });

/**
 * Duplicate an expense
 */
export const duplicateExpense = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
        newDate: z.string().optional(), // Allow specifying a new date for the duplicate
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      // Get the existing expense with all its data
      const originalExpense = await prisma.expense.findUnique({
        where: { id: data.id },
        include: {
          restaurant: true,
          participants: {
            include: {
              colleague: true,
            },
          },
          items: {
            include: {
              colleague: true,
            },
          },
        },
      });

      if (!originalExpense) {
        throw new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found');
      }

      const result = await prisma.$transaction(async (tx) => {
        return createExpenseWorkflow(tx, {
          date: data.newDate || new Date().toISOString(),
          restaurantId: originalExpense.restaurantId,
          amount: Number(originalExpense.amount),
          splitType: z.enum(['EQUAL', 'ITEMIZED']).parse(originalExpense.splitType),
          notes: originalExpense.notes || null,
          participantIds: originalExpense.participants.map((p) => p.colleagueId),
          items:
            originalExpense.splitType === 'ITEMIZED'
              ? originalExpense.items.map((item) => ({
                  name: item.name,
                  price: Number(item.price),
                  colleagueId: item.colleagueId,
                }))
              : undefined,
        });
      });
      const serializedExpense = serializeExpense(result.expense);
      const autoResult = await autoApplyPrepaymentsForExpense(result.expense);

      if (autoResult) {
        return {
          ...serializedExpense,
          autoApplications: autoResult.autoApplications,
          totalAutoApplied: autoResult.totalAutoApplied,
        };
      }

      return serializedExpense;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to duplicate expense');
    }
  });

/**
 * Update an expense with optional receipt upload support
 */
export const updateExpense = createServerFn({ method: 'POST' })
  .validator((formData: FormData) => {
    const rawReceiptFile = formData.get('receiptFile');
    const receiptFile = rawReceiptFile instanceof File ? rawReceiptFile : null;

    return z
      .object({
        id: z.string().transform((val) => Number.parseInt(val, 10)),
        date: z.string().optional(),
        restaurantId: z
          .string()
          .transform((val) => Number.parseInt(val, 10))
          .optional(),
        amount: z
          .string()
          .transform((val) => Number.parseFloat(val))
          .optional(),
        splitType: z.enum(['EQUAL', 'ITEMIZED']).optional(),
        participantIds: z
          .string()
          .transform((val) => numberArraySchema.parse(JSON.parse(val)))
          .optional(),
        items: z
          .string()
          .nullable()
          .optional()
          .transform((val) => (val ? expenseItemsSchema.parse(JSON.parse(val)) : undefined)),
        notes: z.string().nullable().optional(),
        receiptFile: z.instanceof(File).nullable().optional(),
        removeExistingReceipt: z
          .string()
          .nullable()
          .optional()
          .transform((val) => val === 'true'),
      })
      .parse({
        id: formData.get('id'),
        date: formData.get('date'),
        restaurantId: formData.get('restaurantId'),
        amount: formData.get('amount'),
        splitType: formData.get('splitType'),
        participantIds: formData.get('participantIds'),
        items: formData.get('items'),
        notes: formData.get('notes'),
        receiptFile,
        removeExistingReceipt: formData.get('removeExistingReceipt'),
      });
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      const existingExpense = await prisma.expense.findUnique({
        where: { id: data.id },
        include: { participants: true, items: true },
      });

      if (!existingExpense) {
        throw new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found');
      }

      let receiptBucket: string | null = existingExpense.receiptBucket;
      let receiptObjectKey: string | null = existingExpense.receiptObjectKey;
      let shouldDeleteOldReceipt = false;

      // Handle receipt removal if requested
      if (data.removeExistingReceipt) {
        receiptBucket = null;
        receiptObjectKey = null;
        shouldDeleteOldReceipt = true;
      }
      // Handle receipt upload if file provided
      else if (data.receiptFile && data.receiptFile.size > 0) {
        const uploadResult = await uploadFileToStorage(data.receiptFile);
        receiptBucket = uploadResult.bucket;
        receiptObjectKey = uploadResult.objectKey;
        shouldDeleteOldReceipt = true;
      }

      const result = await prisma.$transaction(async (tx) => {
        return updateExpenseWorkflow(tx, {
          id: data.id,
          date: data.date,
          restaurantId: data.restaurantId,
          amount: data.amount,
          splitType: data.splitType,
          notes: data.notes,
          participantIds: data.participantIds,
          items: data.items,
          receiptBucket,
          receiptObjectKey,
        });
      });

      // The row points at the new (or absent) receipt only after commit;
      // deleting before would strand the reference on rollback.
      if (
        shouldDeleteOldReceipt &&
        existingExpense.receiptBucket &&
        existingExpense.receiptObjectKey
      ) {
        await deleteFromStorageSafe(
          existingExpense.receiptBucket,
          existingExpense.receiptObjectKey
        );
      }
      return serializeExpense(result.expense);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Failed to update expense', error);
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to update expense');
    }
  });

/**
 * Approve payment claim - Admin only - simplified version
 */
export const approvePaymentClaim = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        participantId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      const result = await prisma.$transaction(async (tx) => {
        return approveClaimWorkflow(tx, {
          participantId: data.participantId,
        });
      });

      return {
        success: true,
        participant: {
          id: result.participantId,
          expenseId: result.expenseId,
          colleagueId: result.colleagueId,
        },
        approvedPayments: result.approvedPayments.map((payment) => ({
          ...payment,
          amount: serializeDecimal(payment.amount),
        })),
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to approve payment claim');
    }
  });

/**
 * Undo a payment claim or approval
 */
export const undoClaim = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        participantId: z.number().int().positive(),
        type: z.enum(['PENDING', 'APPROVED']),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      const result = await prisma.$transaction(async (tx) => {
        return undoClaimWorkflow(tx, {
          participantId: data.participantId,
          undoType: data.type,
        });
      });

      // Delete payment proof files from Minio after transaction for pending claims
      if (data.type === 'PENDING') {
        for (const payment of result.deletedPayments) {
          if (payment.paymentProofBucket && payment.paymentProofObjectKey) {
            await deleteFromStorageSafe(payment.paymentProofBucket, payment.paymentProofObjectKey);
          }
        }
      }

      return {
        success: true,
        participant: {
          id: result.participantId,
          expenseId: result.expenseId,
          colleagueId: result.colleagueId,
        },
        totalReversedAmount: result.totalReversedAmount,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to undo claim');
    }
  });
