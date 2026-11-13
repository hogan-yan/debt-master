/**
 * Auto Apply Prepayment Workflow
 *
 * Extracted business logic for automatically applying available prepayments to
 * unpaid expenses. Uses FIFO ordering (oldest payments first, oldest expenses first)
 * and handles partial applications across multiple payments per expense.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { minorToDecimal, toMinor } from '@/server/money/edge';
import { withColleagueLock } from '@/server/utils/tx-locks';
// =============================================================================
// TYPES
// =============================================================================

export interface AutoApplyPrepaymentInput {
  colleagueId: number;
  maxAmount?: number | undefined;
}

export interface PaymentWithBalance {
  payment: Prisma.PaymentGetPayload<{
    include: {
      applications: true;
    };
  }>;
  /** Exact minor units (cents) */
  availableBalance: bigint;
}

export interface AutoApplyPrepaymentResult {
  applications: Prisma.PaymentApplicationGetPayload<object>[];
  /** Exact minor units (cents) */
  totalApplied: bigint;
  /** Exact minor units (cents) */
  remainingBalance: bigint;
}

/** Indexed access helper — keeps noUncheckedIndexedAccess happy without sparse-array silence. */
export function requirePaymentBalance(
  balances: PaymentWithBalance[],
  index: number
): PaymentWithBalance {
  const balance = balances[index];
  if (balance === undefined) {
    throw new Error(`Missing payment balance at index ${index}`);
  }
  return balance;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function autoApplyPrepaymentWorkflow(
  tx: Prisma.TransactionClient,
  input: AutoApplyPrepaymentInput
): Promise<AutoApplyPrepaymentResult> {
  // All balance reads/writes run under the colleague row-lock so a concurrent
  // prepayment/apply cannot interleave a stale read+write.
  return withColleagueLock(tx, input.colleagueId, async (lockedTx) => {
    // Get all payments with available balance, ordered by FIFO (oldest first)
    const paymentsWithBalance = await lockedTx.payment.findMany({
      where: {
        colleagueId: input.colleagueId,
        isApproved: true,
      },
      include: {
        applications: true,
      },
      orderBy: {
        createdAt: 'asc', // FIFO: Use oldest payments first
      },
    });

    // Calculate available balance for each payment
    const paymentBalances: PaymentWithBalance[] = paymentsWithBalance
      .map((payment) => {
        const paymentAmount = toMinor(payment.amount);
        const appliedAmount = payment.applications.reduce(
          (sum, app) => sum + toMinor(app.amount),
          0n
        );
        const availableBalance = paymentAmount - appliedAmount;

        return {
          payment,
          availableBalance,
        };
      })
      .filter((pb) => pb.availableBalance > 0n); // Only payments with available balance

    // Calculate total available balance
    const totalAvailableBalance = paymentBalances.reduce(
      (sum, pb) => sum + pb.availableBalance,
      0n
    );

    // Apply maxAmount limit if specified (maxAmount arrives as a major-unit number)
    const maxBudget =
      input.maxAmount != null
        ? toMinor(input.maxAmount) < totalAvailableBalance
          ? toMinor(input.maxAmount)
          : totalAvailableBalance
        : totalAvailableBalance;
    let remainingBudget = maxBudget;

    if (remainingBudget <= 0n) {
      return {
        applications: [],
        totalApplied: 0n,
        remainingBalance: totalAvailableBalance,
      };
    }

    // Get unpaid or partially paid expenses for this colleague
    const expenseParticipants = await lockedTx.expenseParticipant.findMany({
      where: {
        colleagueId: input.colleagueId,
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
          date: 'asc', // Process older expenses first
        },
      },
    });

    // Filter to only participants with remaining balance owed
    const participantsWithBalance = expenseParticipants.filter((participant) => {
      const participantAmount = toMinor(participant.amount);
      const totalApplied = participant.paymentApplications
        .filter((app) => app.payment.isApproved)
        .reduce((sum, app) => sum + toMinor(app.amount), 0n);
      const remainingOwed = participantAmount - totalApplied;
      return remainingOwed > 0n;
    });

    const applications: Prisma.PaymentApplicationGetPayload<object>[] = [];
    let totalApplied = 0n;
    let currentPaymentIndex = 0;

    // Process each expense participant
    for (const participant of participantsWithBalance) {
      if (remainingBudget <= 0n || currentPaymentIndex >= paymentBalances.length) {
        break;
      }

      const participantAmount = toMinor(participant.amount);
      const alreadyApplied = participant.paymentApplications
        .filter((app) => app.payment.isApproved)
        .reduce((sum, app) => sum + toMinor(app.amount), 0n);

      let remainingNeeded = participantAmount - alreadyApplied;
      if (remainingNeeded > remainingBudget) remainingNeeded = remainingBudget;

      // Apply payments to this expense (may need multiple payments)
      while (remainingNeeded > 0n && currentPaymentIndex < paymentBalances.length) {
        const paymentBalance = requirePaymentBalance(paymentBalances, currentPaymentIndex);

        // Calculate how much to apply from this payment
        const applicationAmount =
          remainingNeeded < paymentBalance.availableBalance
            ? remainingNeeded
            : paymentBalance.availableBalance;

        // Create the payment application
        const application = await lockedTx.paymentApplication.create({
          data: {
            paymentId: paymentBalance.payment.id,
            expenseId: participant.expenseId,
            participantId: participant.id,
            amount: minorToDecimal(applicationAmount),
          },
        });

        applications.push(application);

        // Update tracking variables
        paymentBalance.availableBalance -= applicationAmount;
        remainingNeeded -= applicationAmount;
        totalApplied += applicationAmount;
        remainingBudget -= applicationAmount;

        // Move to next payment if current one is exhausted
        if (paymentBalance.availableBalance <= 0n) {
          currentPaymentIndex++;
        }
      }
    }

    return {
      applications,
      totalApplied,
      remainingBalance: remainingBudget,
    };
  });
}
