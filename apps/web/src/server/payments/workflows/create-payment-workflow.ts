/**
 * Create Payment Workflow
 *
 * Extracted business logic for creating payments with automatic application.
 * This is the testable core of the createPaymentWithPaymentProof handler.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (cache, external services) are injected as dependencies
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { minorToDecimal, minorToNumber, toMinor } from '@/server/money/edge';
import { withColleagueLock } from '@/server/utils/tx-locks';
import { AppError, ErrorCode } from '@/utils/errors';
// =============================================================================
// TYPES
// =============================================================================

export interface CreatePaymentInput {
  colleagueId: number;
  amount: number;
  date: string;
  paymentType: 'PAYME' | 'FPS' | 'CASH' | 'OTHER';
  restaurantId?: number | undefined;
  paymentProofBucket: string | null;
  paymentProofObjectKey: string | null;
  selectedExpenseIds: number[];
}

export interface PaymentApplicationResult {
  id: number;
  createdAt: Date;
  paymentId: number;
  expenseId: number;
  participantId: number;
  amount: Prisma.Decimal;
  appliedAt: Date;
}

export interface CreatePaymentResult {
  payment: PaymentWithApplicationsResult;
  totalAppliedAmount: number;
  remainingAmount: number;
  autoPayments: PaymentApplicationWithExpense[];
}

/**
 * Result type for a payment with colleague, restaurant, and applications.
 * Derived from Prisma's generated types to match the exact include pattern
 * used when assembling the payment result.
 */
export type PaymentWithApplicationsResult = Prisma.PaymentGetPayload<{
  include: {
    colleague: true;
    restaurant: true;
    applications: true;
  };
}>;

/**
 * Result type for a payment application with its associated expense and restaurant.
 * Derived from Prisma's generated types to match the exact include pattern.
 */
export type PaymentApplicationWithExpense = Prisma.PaymentApplicationGetPayload<{
  include: {
    expense: {
      include: {
        restaurant: true;
      };
    };
  };
}>;

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Creates a payment and automatically applies it to expenses.
 *
 * This is the core business logic extracted from createPaymentWithPaymentProof.
 * It handles two modes:
 * 1. Expense payment mode: Apply to specific expenses with smart distribution
 * 2. Prepayment mode: Auto-apply to pending expenses
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Payment creation parameters
 * @returns Created payment with application details
 */
export async function createPaymentWorkflow(
  tx: Prisma.TransactionClient,
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  // All balance reads/writes run under the colleague row-lock so the
  // smart-distribution and prepayment auto-apply cannot double-apply under
  // concurrency. The helpers below (handleExpensePaymentMode /
  // handlePrepaymentMode / distributePaymentSmartly) MUST stay inside this
  // lock — withColleagueLock makes that structural.
  return withColleagueLock(tx, input.colleagueId, async (lockedTx) => {
    const isExpensePayment = input.selectedExpenseIds.length > 0;

    // Create the payment record
    const payment = await lockedTx.payment.create({
      data: {
        colleagueId: input.colleagueId,
        amount: input.amount,
        date: new Date(input.date),
        paymentType: input.paymentType,
        restaurantId: input.restaurantId ?? null,
        paymentProofBucket: input.paymentProofBucket,
        paymentProofObjectKey: input.paymentProofObjectKey,
        isApproved: true, // Admin-created payments are auto-approved
        submittedAt: new Date(),
        createdBy: 'ADMIN',
      },
    });

    let paymentApplications: PaymentApplicationResult[] = [];
    let totalAppliedAmount = 0;
    let autoPayments: PaymentApplicationWithExpense[] = [];

    if (isExpensePayment) {
      // Expense payment mode - apply to specific expenses
      const result = await handleExpensePaymentMode(
        lockedTx,
        payment.id,
        input.colleagueId,
        input.selectedExpenseIds
      );
      paymentApplications = result.applications;
      totalAppliedAmount = minorToNumber(result.totalApplied);
    } else {
      // Prepayment mode - auto-apply to pending expenses (exact minor budget)
      const result = await handlePrepaymentMode(
        lockedTx,
        payment.id,
        input.colleagueId,
        toMinor(input.amount)
      );
      paymentApplications = result.applications;
      totalAppliedAmount = minorToNumber(result.totalApplied);
      autoPayments = result.autoPayments;
    }

    const remainingAmount = minorToNumber(toMinor(input.amount)) - totalAppliedAmount;

    // Fetch colleague and restaurant for serialization compatibility
    const [colleague, restaurant] = await Promise.all([
      lockedTx.colleague.findUnique({ where: { id: input.colleagueId } }),
      input.restaurantId
        ? lockedTx.restaurant.findUnique({ where: { id: input.restaurantId } })
        : Promise.resolve(null),
    ]);

    if (!colleague) {
      throw new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'Colleague not found');
    }

    return {
      payment: {
        ...payment,
        applications: paymentApplications,
        colleague,
        restaurant,
      },
      totalAppliedAmount,
      remainingAmount,
      autoPayments,
    };
  });
}

// =============================================================================
// HELPER FUNCTIONS (also extracted for testability)
// =============================================================================

interface ExpensePaymentResult {
  applications: PaymentApplicationResult[];
  totalApplied: bigint;
}

/**
 * Handles expense payment mode - applies payment to specific expenses
 * with smart distribution for overpayments.
 *
 * CONTRACT: must be called inside the colleague row-lock acquired by
 * createPaymentWorkflow (via withColleagueLock). It reads balance rows and
 * writes payment applications that are only safe under that lock.
 */
async function handleExpensePaymentMode(
  tx: Prisma.TransactionClient,
  paymentId: number,
  colleagueId: number,
  selectedExpenseIds: number[]
): Promise<ExpensePaymentResult> {
  const applications: PaymentApplicationResult[] = [];
  let totalApplied = 0n;

  // Start with the first selected expense
  const primaryExpenseId = selectedExpenseIds[0];
  if (primaryExpenseId === undefined) {
    return { applications, totalApplied };
  }
  const primaryParticipant = await tx.expenseParticipant.findFirst({
    where: {
      expenseId: primaryExpenseId,
      colleagueId,
    },
  });

  if (primaryParticipant) {
    // Use smart distribution to handle overpayments
    const distributedApps = await distributePaymentSmartly(
      tx,
      paymentId,
      colleagueId,
      primaryExpenseId,
      primaryParticipant.id
    );

    for (const app of distributedApps) {
      applications.push(app);
      totalApplied += toMinor(app.amount);
    }
  }

  return { applications, totalApplied };
}

interface PrepaymentResult {
  applications: PaymentApplicationResult[];
  /** Exact minor units (cents) */
  totalApplied: bigint;
  autoPayments: PaymentApplicationWithExpense[];
}

/**
 * Handles prepayment mode - auto-applies payment to pending expenses.
 * Applies to oldest expenses first.
 *
 * CONTRACT: must be called inside the colleague row-lock acquired by
 * createPaymentWorkflow (via withColleagueLock). It reads balances and writes
 * payment applications that are only safe under that lock.
 */
async function handlePrepaymentMode(
  tx: Prisma.TransactionClient,
  paymentId: number,
  colleagueId: number,
  amountMinor: bigint
): Promise<PrepaymentResult> {
  const applications: PaymentApplicationResult[] = [];
  const autoPayments: PaymentApplicationWithExpense[] = [];
  let totalApplied = 0n;
  let remainingAmount = amountMinor;

  // Get all unpaid expenses for this colleague (oldest first)
  const unpaidExpenses = await tx.expenseParticipant.findMany({
    where: {
      colleagueId,
    },
    include: {
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
    orderBy: {
      expense: {
        date: 'asc',
      },
    },
  });

  for (const participant of unpaidExpenses) {
    if (remainingAmount <= 0n) break;

    // Calculate how much this participant still owes
    const totalPaid = participant.paymentApplications
      .filter((app) => app.payment?.isApproved)
      .reduce((sum, app) => sum + toMinor(app.amount), 0n);

    const participantAmount = toMinor(participant.amount);
    const remainingOwed = participantAmount - totalPaid;

    if (remainingOwed > 0n) {
      const applicationAmount = remainingOwed < remainingAmount ? remainingOwed : remainingAmount;

      const application = await tx.paymentApplication.create({
        data: {
          paymentId,
          expenseId: participant.expenseId,
          participantId: participant.id,
          amount: minorToDecimal(applicationAmount),
        },
        include: {
          expense: {
            include: {
              restaurant: true,
            },
          },
        },
      });

      applications.push(application);
      autoPayments.push(application);
      remainingAmount -= applicationAmount;
      totalApplied += applicationAmount;
    }
  }

  return { applications, totalApplied, autoPayments };
}

// =============================================================================
// DISTRIBUTION LOGIC (moved from mutations.ts)
// =============================================================================

/**
 * Smart distribution of payment across multiple expenses.
 * Applies to initial expense first, then distributes remainder to other unpaid expenses.
 *
 * CONTRACT: must be called inside the colleague row-lock acquired by
 * createPaymentWorkflow (via withColleagueLock). It reads already-applied
 * amounts and writes new payment applications that are only safe under that lock.
 */
async function distributePaymentSmartly(
  tx: Prisma.TransactionClient,
  paymentId: number,
  colleagueId: number,
  initialExpenseId: number,
  initialParticipantId: number
): Promise<PaymentApplicationResult[]> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found');
  }

  let remainingPaymentAmount: bigint = toMinor(payment.amount);
  const applications: PaymentApplicationResult[] = [];

  // Step 1: Apply to the initial expense first
  const initialParticipant = await tx.expenseParticipant.findUnique({
    where: { id: initialParticipantId },
  });

  if (initialParticipant) {
    const existingApplications = await tx.paymentApplication.findMany({
      where: {
        expenseId: initialExpenseId,
        participantId: initialParticipantId,
      },
    });

    const alreadyApplied = existingApplications.reduce((sum, app) => sum + toMinor(app.amount), 0n);

    const participantOwed = toMinor(initialParticipant.amount);
    const remainingOwed = participantOwed - alreadyApplied;

    if (remainingOwed > 0n) {
      const applicationAmount =
        remainingPaymentAmount < remainingOwed ? remainingPaymentAmount : remainingOwed;

      const application = await tx.paymentApplication.create({
        data: {
          paymentId,
          expenseId: initialExpenseId,
          participantId: initialParticipantId,
          amount: minorToDecimal(applicationAmount),
          appliedAt: new Date(),
        },
      });

      applications.push(application);
      remainingPaymentAmount -= applicationAmount;
    }
  }

  // Step 2: If there's still payment amount left, apply to other unpaid expenses
  if (remainingPaymentAmount > 0n) {
    const unpaidParticipants = await tx.expenseParticipant.findMany({
      where: {
        colleagueId,
        NOT: {
          id: initialParticipantId,
        },
      },
      include: {
        expense: true,
        paymentApplications: true,
      },
      orderBy: {
        expense: {
          date: 'asc',
        },
      },
    });

    for (const participant of unpaidParticipants) {
      if (remainingPaymentAmount <= 0n) break;

      const totalApplied = participant.paymentApplications.reduce(
        (sum, app) => sum + toMinor(app.amount),
        0n
      );

      const participantOwed = toMinor(participant.amount);
      const stillOwed = participantOwed - totalApplied;

      if (stillOwed > 0n) {
        const applicationAmount =
          remainingPaymentAmount < stillOwed ? remainingPaymentAmount : stillOwed;

        const application = await tx.paymentApplication.create({
          data: {
            paymentId,
            expenseId: participant.expenseId,
            participantId: participant.id,
            amount: minorToDecimal(applicationAmount),
            appliedAt: new Date(),
          },
        });

        applications.push(application);
        remainingPaymentAmount -= applicationAmount;
      }
    }
  }

  return applications;
}
