/**
 * Apply Unused Funds Workflow
 *
 * Extracted business logic for applying a colleague's unapplied funds to a
 * specific expense participant debt. This is the testable core of the
 * applyUnusedFundsToExpense handler.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - All side effects (cache, external services) are injected as dependencies
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { minorToDecimal, toMinor } from '@/server/money/edge';
import { withColleagueLock } from '@/server/utils/tx-locks';
import { AppError, ErrorCode } from '@/utils/errors';

// =============================================================================
// TYPES
// =============================================================================

export interface ApplyUnusedFundsInput {
  participantId: number;
}

export interface PaymentApplicationResult {
  id: number;
  paymentId: number;
  expenseId: number;
  participantId: number;
  amount: Prisma.Decimal;
  appliedAt: Date;
}

export interface UnappliedPayment {
  id: number;
  unappliedAmount: bigint;
}

export interface ApplyUnusedFundsResult {
  success: boolean;
  /** Exact minor units (cents) */
  appliedAmount: bigint;
  colleagueName: string;
  applications: PaymentApplicationResult[];
  /** Exact minor units (cents) */
  remainingOwed: bigint;
  /** Exact minor units (cents) */
  totalUnapplied: bigint;
}

/**
 * Result type for fetching a participant with colleague and payment applications.
 * Derived from Prisma's generated types to match the exact include pattern.
 */
export type ParticipantWithDetails = Prisma.ExpenseParticipantGetPayload<{
  include: {
    colleague: true;
    paymentApplications: true;
  };
}>;

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Applies a colleague's unapplied funds to a specific expense participant debt.
 *
 * This is the core business logic extracted from applyUnusedFundsToExpense.
 * It:
 * 1. Gets participant details and calculates remaining owed amount
 * 2. Finds colleague payments with unapplied funds (oldest first)
 * 3. Creates payment applications to settle the debt
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - Unused funds application parameters
 * @returns Result with applied amount and application details
 * @throws Error if participant not found, already paid, or no unapplied funds
 */
export async function applyUnusedFundsWorkflow(
  tx: Prisma.TransactionClient,
  input: ApplyUnusedFundsInput
): Promise<ApplyUnusedFundsResult> {
  // Resolve the colleague and serialize all of their money flows BEFORE reading
  // any balance — otherwise a concurrent apply could commit between this read
  // and our writes (double-spend). See lockColleagueForUpdate.
  const participantRef = await tx.expenseParticipant.findUnique({
    where: { id: input.participantId },
    select: { colleagueId: true },
  });
  if (!participantRef) {
    throw new AppError(
      ErrorCode.NOT_FOUND_PARTICIPANT,
      'Participant or associated colleague not found.'
    );
  }
  return withColleagueLock(tx, participantRef.colleagueId, async (lockedTx) => {
    // 1. Get participant details (read fresh, now that the colleague is locked)
    const participant = await getParticipantWithDetails(lockedTx, input.participantId);

    if (!participant?.colleague) {
      throw new AppError(
        ErrorCode.NOT_FOUND_PARTICIPANT,
        'Participant or associated colleague not found.'
      );
    }

    const remainingOwed = calculateRemainingOwed(participant);

    if (remainingOwed <= 0n) {
      throw new AppError(
        ErrorCode.BUSINESS_ALREADY_PAID,
        'This expense is already considered fully paid for this participant.'
      );
    }

    // 2. Find all of the colleague's approved payments that have unapplied funds
    const unappliedPayments = await getUnappliedPayments(lockedTx, participant.colleagueId);
    const totalUnapplied = unappliedPayments.reduce((sum, p) => sum + p.unappliedAmount, 0n);

    if (totalUnapplied <= 0n) {
      throw new AppError(
        ErrorCode.BUSINESS_NO_UNAPPLIED_FUNDS,
        `${participant.colleague.name} has no unapplied funds available.`
      );
    }

    // 3. Apply the unapplied funds to the participant's debt
    const amountToApply = remainingOwed < totalUnapplied ? remainingOwed : totalUnapplied;
    const { applications, amountSuccessfullyApplied } = await applyFunds(
      lockedTx,
      unappliedPayments,
      amountToApply,
      participant.expenseId,
      participant.id
    );

    return {
      success: true,
      appliedAmount: amountSuccessfullyApplied,
      colleagueName: participant.colleague.name,
      applications,
      remainingOwed,
      totalUnapplied,
    };
  });
}

// =============================================================================
// HELPER FUNCTIONS (also extracted for testability)
// =============================================================================

/**
 * Retrieves participant details including colleague info and existing payments.
 */
async function getParticipantWithDetails(
  tx: Prisma.TransactionClient,
  participantId: number
): Promise<ParticipantWithDetails | null> {
  const participant = await tx.expenseParticipant.findUnique({
    where: { id: participantId },
    include: {
      colleague: true,
      paymentApplications: true,
    },
  });

  if (!participant) return null;

  return participant;
}

/**
 * Calculates the remaining amount owed by a participant.
 */
export function calculateRemainingOwed(participant: ParticipantWithDetails): bigint {
  const totalApplied = participant.paymentApplications.reduce(
    (sum, app) => sum + toMinor(app.amount),
    0n
  );
  return toMinor(participant.amount) - totalApplied;
}

/**
 * Finds all approved payments for a colleague that have unapplied funds.
 * Returns payments sorted by creation time (oldest first) for FIFO application.
 */
async function getUnappliedPayments(
  tx: Prisma.TransactionClient,
  colleagueId: number
): Promise<UnappliedPayment[]> {
  const colleaguePayments = await tx.payment.findMany({
    where: { colleagueId, isApproved: true },
    include: { applications: true },
    orderBy: { createdAt: 'asc' },
  });

  return colleaguePayments
    .map((p) => {
      const applied = p.applications.reduce((sum, app) => sum + toMinor(app.amount), 0n);
      return { id: p.id, unappliedAmount: toMinor(p.amount) - applied };
    })
    .filter((p) => p.unappliedAmount > 0n);
}

interface ApplyFundsResult {
  applications: PaymentApplicationResult[];
  amountSuccessfullyApplied: bigint;
}

/**
 * Creates payment applications by applying funds from unapplied payments.
 * Applies from oldest payments first (FIFO) until the amount is fully applied.
 */
async function applyFunds(
  tx: Prisma.TransactionClient,
  unappliedPayments: UnappliedPayment[],
  amountToApply: bigint,
  expenseId: number,
  participantId: number
): Promise<ApplyFundsResult> {
  const applications: PaymentApplicationResult[] = [];
  let remaining: bigint = amountToApply;
  let amountSuccessfullyApplied: bigint = 0n;

  for (const payment of unappliedPayments) {
    if (remaining <= 0n) break;

    const applyFromThisPayment: bigint =
      remaining < payment.unappliedAmount ? remaining : payment.unappliedAmount;

    const application = await tx.paymentApplication.create({
      data: {
        paymentId: payment.id,
        expenseId,
        participantId,
        amount: minorToDecimal(applyFromThisPayment),
        appliedAt: new Date(),
      },
    });

    applications.push(application);
    remaining -= applyFromThisPayment;
    amountSuccessfullyApplied += applyFromThisPayment;
  }

  return { applications, amountSuccessfullyApplied };
}
