import { serializeDecimal } from '@/server/utils/decimal';
import type { ExpenseItem, ExpenseParticipant, ExpenseWithRelations } from './types';
/**
 * Shared Prisma include pattern used across query and mutation handlers
 */
export const EXPENSE_INCLUDE = {
  restaurant: true,
  participants: {
    include: {
      colleague: true,
      paymentApplications: {
        include: {
          payment: true,
        },
      },
    },
  },
  items: {
    include: {
      colleague: true,
    },
  },
} as const;

/**
 * Helper function to serialize Decimal to number and determine payment status
 */
export const serializeExpense = (expense: ExpenseWithRelations) => {
  return {
    ...expense,
    amount: serializeDecimal(expense.amount),
    participants: expense.participants.map((participant: ExpenseParticipant) => {
      // Calculate payment status from payment applications (approved payments only)
      const totalPaid =
        participant.paymentApplications
          ?.filter((app) => app.payment?.isApproved) // Only count approved payments
          ?.reduce((sum, app) => sum + serializeDecimal(app.amount), 0) || 0;

      const participantAmount = serializeDecimal(participant.amount);

      const isPaid = totalPaid >= participantAmount;
      const hasPartialPayment = totalPaid > 0 && totalPaid < participantAmount;

      // isPending should indicate if there are partial payments (not pending claims)
      // Pending claims will be determined on the frontend by checking actual pending payments
      const isPending = hasPartialPayment;

      // Get submitted date from most recent application
      let submittedAt: Date | null = null;
      if (participant.paymentApplications && participant.paymentApplications.length > 0) {
        submittedAt =
          participant.paymentApplications.toSorted(
            (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
          )[0]?.appliedAt ?? null;
      }

      return {
        ...participant,
        amount: participantAmount,
        // Calculate payment status from applications
        isPaid,
        isPending,
        hasPartialPayment, // Indicates partial payment, not pending claims
        totalPaid,
        remainingOwed: Math.max(0, participantAmount - totalPaid),
        submittedAt,
        paymentApplications:
          participant.paymentApplications?.map((app) => ({
            ...app,
            amount: serializeDecimal(app.amount),
            payment: app.payment
              ? {
                  ...app.payment,
                  amount: serializeDecimal(app.payment.amount),
                }
              : undefined,
          })) || [],
        colleague: participant.colleague
          ? {
              ...participant.colleague,
            }
          : undefined,
      };
    }),
    items: expense.items.map((item: ExpenseItem) => ({
      ...item,
      price: serializeDecimal(item.price),
      colleague: item.colleague
        ? {
            ...item.colleague,
          }
        : undefined,
    })),
    restaurant: expense.restaurant ? expense.restaurant : undefined,
  };
};
