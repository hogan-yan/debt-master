import { Prisma } from '@prisma/client';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { requireAdminFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { createServerLogger } from '@/server/infrastructure/logger';
import { prisma } from '@/server/infrastructure/prisma';
import { deleteFromStorage, uploadFileToStorage } from '@/server/infrastructure/storage';
import { serializeDecimal } from '@/server/utils/decimal';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import { serializePayment } from './types';
import { applyUnusedFundsWorkflow } from './workflows/apply-unused-funds-workflow';
import { bulkClaimForColleagueWorkflow } from './workflows/bulk-claim-for-colleague-workflow';
import { cancelRedundantPendingClaimsWorkflow } from './workflows/cancel-redundant-pending-claims-workflow';
import { createPaymentWorkflow } from './workflows/create-payment-workflow';
import { deletePaymentWorkflow } from './workflows/delete-payment-workflow';
import { updatePaymentWorkflow } from './workflows/update-payment-workflow';

// Re-export workflows for testing
export {
  applyUnusedFundsWorkflow,
  bulkClaimForColleagueWorkflow,
  cancelRedundantPendingClaimsWorkflow,
  createPaymentWorkflow,
  deletePaymentWorkflow,
  updatePaymentWorkflow,
};

const logger = createServerLogger('payments', process.env.NODE_ENV === 'development');

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

/**
 * Creates a new payment record with optional payment proof upload
 * - Admin-created payments are automatically approved
 * - Supports both prepayments and expense-specific payments
 * - Handles file upload to Minio for payment proof storage
 */
export const createPayment = createServerFn({ method: 'POST' })
  .validator((formData: FormData) => {
    // Debug logging for development
    logger.debug('Server validator received formData:', formData);
    logger.debug('formData type:', typeof formData);
    logger.debug('formData instanceof FormData:', formData instanceof FormData);

    // Extract values from FormData with safe type narrowing
    const rawPaymentProofFile = formData.get('paymentProofFile');
    const paymentProofFile = rawPaymentProofFile instanceof File ? rawPaymentProofFile : null;

    logger.debug('Extracted values:', {
      colleagueId: formData.get('colleagueId'),
      amount: formData.get('amount'),
      date: formData.get('date'),
      paymentType: formData.get('paymentType'),
      restaurantId: formData.get('restaurantId'),
      paymentProofFile: paymentProofFile ? 'File present' : 'No file',
      selectedExpenseIds: formData.get('selectedExpenseIds'),
      expenseAmounts: formData.get('expenseAmounts'),
    });

    // Validate base payment data
    const baseValidation = z.object({
      colleagueId: z.string().transform((val) => Number.parseInt(val, 10)),
      amount: z.string().transform((val) => Number.parseFloat(val)),
      date: z.string(),
      paymentType: z.enum(['PAYME', 'FPS', 'CASH', 'OTHER']),
      restaurantId: z
        .string()
        .nullable()
        .optional()
        .transform((val) => (val ? Number.parseInt(val, 10) : undefined)),
      paymentProofFile: z.instanceof(File).nullable().optional(),
    });

    // Validate expense payment specific data
    const expensePaymentValidation = z.object({
      selectedExpenseIds: z
        .string()
        .nullable()
        .optional()
        .transform((val) => (val ? JSON.parse(val) : []))
        .pipe(z.array(z.number().int().positive())),
      expenseAmounts: z
        .string()
        .nullable()
        .optional()
        .transform((val) => (val ? JSON.parse(val) : {}))
        .pipe(z.record(z.string(), z.string()).optional()),
    });

    const baseData = baseValidation.parse({
      colleagueId: formData.get('colleagueId'),
      amount: formData.get('amount'),
      date: formData.get('date'),
      paymentType: formData.get('paymentType'),
      restaurantId: formData.get('restaurantId'),
      paymentProofFile,
    });

    const expenseData = expensePaymentValidation.parse({
      selectedExpenseIds: formData.get('selectedExpenseIds'),
      expenseAmounts: formData.get('expenseAmounts'),
    });

    const result = {
      ...baseData,
      ...expenseData,
    };

    logger.debug('Validator returning:', result);
    return result;
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      let paymentProofBucket: string | null = null;
      let paymentProofObjectKey: string | null = null;

      // Handle payment proof upload if file provided
      if (data.paymentProofFile && data.paymentProofFile.size > 0) {
        const uploadResult = await uploadFileToStorage(data.paymentProofFile);
        paymentProofBucket = uploadResult.bucket;
        paymentProofObjectKey = uploadResult.objectKey;
      }

      // Use the extracted workflows for testable business logic
      const { result: workflowResult, canceledClaimProofs } = await prisma.$transaction(
        async (tx) => {
          const workflowResult = await createPaymentWorkflow(tx, {
            colleagueId: data.colleagueId,
            amount: data.amount,
            date: data.date,
            paymentType: data.paymentType,
            ...(data.restaurantId !== undefined ? { restaurantId: data.restaurantId } : {}),
            paymentProofBucket,
            paymentProofObjectKey,
            selectedExpenseIds: data.selectedExpenseIds,
          });

          const { proofsToCleanUp } = await cancelRedundantPendingClaimsWorkflow(tx, {
            colleagueId: data.colleagueId,
          });

          return { result: workflowResult, canceledClaimProofs: proofsToCleanUp };
        }
      );

      // Post-transaction: clean up MinIO proofs from canceled claims
      for (const proof of canceledClaimProofs) {
        await deleteFromStorageSafe(proof.paymentProofBucket, proof.paymentProofObjectKey);
        logger.info(`Cleaned up proof for canceled claim: payment ${proof.paymentId}`);
      }

      // Serialize applications (convert Prisma.Decimal to number)
      const serializedApplications = (workflowResult.payment.applications || []).map((app) => ({
        ...app,
        amount:
          app.amount instanceof Prisma.Decimal
            ? serializeDecimal(app.amount)
            : typeof app.amount === 'number'
              ? app.amount
              : Number.parseFloat(String(app.amount)),
      }));

      // Serialize autoPayments (convert Prisma.Decimal to number)
      const serializedAutoPayments = (workflowResult.autoPayments || []).map((app) => ({
        ...app,
        amount:
          app.amount instanceof Prisma.Decimal
            ? serializeDecimal(app.amount)
            : typeof app.amount === 'number'
              ? app.amount
              : Number.parseFloat(String(app.amount)),
        expense: app.expense
          ? {
              ...app.expense,
              amount: serializeDecimal(app.expense.amount),
            }
          : null,
      }));

      return {
        ...serializePayment(workflowResult.payment),
        applications: serializedApplications,
        totalApplied: workflowResult.totalAppliedAmount,
        remainingBalance: workflowResult.remainingAmount,
        autoPayments: serializedAutoPayments,
        autoAppliedAmount: workflowResult.totalAppliedAmount,
        remainingPrepayment: workflowResult.remainingAmount,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to create payment with payment proof'
      );
    }
  });

/**
 * Applies a colleague's unapplied funds to a specific expense participant debt.
 * This admin action finds existing payments with unused funds and creates
 * payment applications to settle the debt.
 */
export const applyUnusedFundsToExpense = createServerFn({ method: 'POST' })
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

    const { participantId } = data;

    const { success, appliedAmount, colleagueName } = await prisma.$transaction(async (tx) => {
      return applyUnusedFundsWorkflow(tx, {
        participantId,
      });
    });

    return { success, appliedAmount, colleagueName };
  });

/**
 * Consolidate a new, single, robust `updatePayment` function that can handle all edits (amount, date, type, applications, and optional file proof).
 * This will replace `updatePaymentApplications` and the `updatePayment` part of `updatePaymentWithPaymentProof`.
 * This consolidation will fix the root cause by providing one clear path for all updates.
 */
export const updatePayment = createServerFn({ method: 'POST' })
  .validator((formData: FormData) => {
    // Safe type narrowing for File fields
    const rawPaymentProofFile = formData.get('paymentProofFile');
    const paymentProofFile = rawPaymentProofFile instanceof File ? rawPaymentProofFile : null;

    // Zod schemas for JSON-validated fields
    const selectedExpenseIdsSchema = z.array(z.number().int().positive());
    const expenseAmountsSchema = z.record(z.string(), z.string());

    const validated = z
      .object({
        id: z.string().transform((val) => {
          const parsed = Number.parseInt(val, 10);
          if (Number.isNaN(parsed))
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid id');
          return parsed;
        }),
        colleagueId: z.string().transform((val) => {
          const parsed = Number.parseInt(val, 10);
          if (Number.isNaN(parsed))
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid colleagueId');
          return parsed;
        }),
        amount: z.string().transform((val) => {
          const parsed = Number.parseFloat(val);
          if (Number.isNaN(parsed))
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Invalid amount');
          return parsed;
        }),
        date: z.string().min(1, 'Date is required'),
        paymentType: z.enum(['PAYME', 'FPS', 'CASH', 'OTHER']),
        paymentProofFile: z.instanceof(File).nullable().optional(),
        removeExistingProof: z
          .string()
          .nullable()
          .optional()
          .transform((val) => val === 'true'),
        selectedExpenseIds: z
          .string()
          .nullable()
          .optional()
          .transform((val) => (val ? selectedExpenseIdsSchema.parse(JSON.parse(val)) : [])),
        expenseAmounts: z
          .string()
          .nullable()
          .optional()
          .transform((val) => (val ? expenseAmountsSchema.parse(JSON.parse(val)) : {})),
      })
      .parse({
        id: formData.get('id'),
        colleagueId: formData.get('colleagueId'),
        amount: formData.get('amount'),
        date: formData.get('date'),
        paymentType: formData.get('paymentType'),
        paymentProofFile,
        removeExistingProof: formData.get('removeExistingProof'),
        selectedExpenseIds: formData.get('selectedExpenseIds'),
        expenseAmounts: formData.get('expenseAmounts'),
      });

    return {
      ...validated,
      paymentProofFile:
        validated.paymentProofFile && validated.paymentProofFile.size > 0
          ? validated.paymentProofFile
          : undefined,
    };
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    const {
      id,
      colleagueId,
      amount,
      date,
      paymentType,
      paymentProofFile,
      removeExistingProof,
      selectedExpenseIds,
      expenseAmounts,
    } = data;

    const originalPayment = await prisma.payment.findUnique({ where: { id } });
    if (!originalPayment) throw new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found');

    let paymentProofBucket: string | null = originalPayment.paymentProofBucket;
    let paymentProofObjectKey: string | null = originalPayment.paymentProofObjectKey;
    let shouldDeleteOldProof = false;

    if (paymentProofFile) {
      const uploadResult = await uploadFileToStorage(paymentProofFile);
      paymentProofBucket = uploadResult.bucket;
      paymentProofObjectKey = uploadResult.objectKey;
      shouldDeleteOldProof = true;
    } else if (removeExistingProof) {
      paymentProofBucket = null;
      paymentProofObjectKey = null;
      shouldDeleteOldProof = true;
    }

    const result = await prisma.$transaction(async (tx) => {
      return updatePaymentWorkflow(tx, {
        id,
        colleagueId,
        amount,
        date,
        paymentType,
        paymentProofBucket,
        paymentProofObjectKey,
        selectedExpenseIds,
        expenseAmounts,
      });
    });

    // Final cleanup and side effects
    if (
      shouldDeleteOldProof &&
      originalPayment.paymentProofBucket &&
      originalPayment.paymentProofObjectKey
    ) {
      await deleteFromStorageSafe(
        originalPayment.paymentProofBucket,
        originalPayment.paymentProofObjectKey
      );
    }

    return serializePayment(result.payment);
  });

/**
 * Delete a payment and its associated applications.
 * Also cleans up MinIO payment proof if present.
 */
export const deletePayment = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    const { deletedPaymentId, proofsToCleanUp } = await prisma.$transaction(async (tx) => {
      return deletePaymentWorkflow(tx, { paymentId: data.id });
    });

    // Post-transaction: clean up MinIO payment proof
    for (const proof of proofsToCleanUp) {
      await deleteFromStorageSafe(proof.paymentProofBucket, proof.paymentProofObjectKey);
    }

    return { success: true, deletedPaymentId };
  });

/**
 * Admin bulk claim: Create a payment covering all unpaid expenses for a colleague
 * - Auto-approved (admin-created)
 * - Automatically applies to all unpaid expenses using smart distribution
 */
export const bulkClaimForColleague = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        colleagueId: z.number().int().positive(),
        paymentType: z.enum(['PAYME', 'FPS', 'CASH', 'OTHER']).default('CASH'),
        date: z
          .string()
          .optional()
          .default(() => new Date().toISOString()),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    const result = await prisma.$transaction(async (tx) => {
      return bulkClaimForColleagueWorkflow(tx, {
        colleagueId: data.colleagueId,
        paymentType: data.paymentType,
        date: data.date,
      });
    });

    // Post-transaction: clean up MinIO proofs from canceled claims
    for (const proof of result.proofsToCleanUp) {
      await deleteFromStorageSafe(proof.paymentProofBucket, proof.paymentProofObjectKey);
    }

    return {
      success: true,
      paymentId: result.paymentId,
      amount: result.amount,
      expenseCount: result.expenseCount,
    };
  });
