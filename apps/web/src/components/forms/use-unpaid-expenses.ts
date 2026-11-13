/**
 * useUnpaidExpenses — fetches and merges unpaid expenses for a colleague.
 * Handles the case where initialData.applications contains expenses not yet
 * returned by the server (e.g. partially-applied expenses in edit mode).
 */

import { useEffect, useState } from 'react';
import { m } from '@/paraglide/messages';
import { getExpenseById, getUnpaidExpensesForColleague } from '@/server/expenses';
import type { UnpaidExpense } from './unpaid-expense-list';

type ApplicationEntry = Readonly<{
  id: number;
  amount: number;
  expense?: { id: number } | undefined;
}>;

interface UseUnpaidExpensesParams {
  colleagueId: string;
  paymentMode: string;
  applications: readonly ApplicationEntry[] | undefined;
}

interface UseUnpaidExpensesReturn {
  unpaidExpenses: UnpaidExpense[];
  loadingExpenses: boolean;
}

/** Runs `apply` only when the effect has not been cancelled. */
export function applyUnlessCancelled(cancelled: boolean, apply: () => void): void {
  if (!cancelled) {
    apply();
  }
}

export function useUnpaidExpenses({
  colleagueId,
  paymentMode,
  applications,
}: UseUnpaidExpensesParams): UseUnpaidExpensesReturn {
  const [unpaidExpenses, setUnpaidExpenses] = useState<UnpaidExpense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  useEffect(() => {
    const parsedColleagueId = colleagueId ? Number.parseInt(colleagueId, 10) : null;
    if (parsedColleagueId && paymentMode === 'EXPENSE_PAYMENT') {
      let cancelled = false;

      const loadUnpaidExpenses = async (): Promise<void> => {
        setLoadingExpenses(true);
        try {
          const fetchedUnpaidExpenses = await getUnpaidExpensesForColleague({
            data: { colleagueId: parsedColleagueId },
          });
          if (cancelled) return;

          const finalExpenses = [...fetchedUnpaidExpenses];
          const fetchedExpenseIds = new Set(finalExpenses.map((e) => e.id));

          if (applications) {
            type ApplicationWithExpense = Readonly<{
              id: number;
              amount: number;
              expense: { id: number };
            }>;

            function hasMissingExpense(app: ApplicationEntry): app is ApplicationWithExpense {
              const expense = app.expense;
              if (!expense) return false;
              return !fetchedExpenseIds.has(expense.id);
            }

            const missingApps = applications.filter(hasMissingExpense);
            const results = await Promise.allSettled(
              missingApps.map((app) => getExpenseById({ data: { id: app.expense.id } }))
            );

            type ParticipantShape = Readonly<{
              id: number;
              colleagueId: number;
              amount: number;
              remainingOwed?: number;
              totalPaid?: number;
            }>;

            function isParticipantShape(value: unknown): value is ParticipantShape {
              if (!value || typeof value !== 'object') return false;
              const maybe = value as Record<string, unknown>;
              return (
                typeof maybe.id === 'number' &&
                typeof maybe.colleagueId === 'number' &&
                typeof maybe.amount === 'number'
              );
            }

            results.forEach((result, i) => {
              const app = missingApps[i];
              if (result.status === 'fulfilled' && result.value && app) {
                const fullExpenseData = result.value;
                const participant = fullExpenseData.participants
                  ?.filter(isParticipantShape)
                  .find((p) => p.colleagueId === parsedColleagueId);
                finalExpenses.push({
                  id: fullExpenseData.id,
                  date: new Date(fullExpenseData.date),
                  restaurantName: fullExpenseData.restaurant?.name || m.common_unknown(),
                  restaurantId: fullExpenseData.restaurantId,
                  totalAmount: Number(fullExpenseData.amount),
                  colleagueAmount: participant?.amount || 0,
                  participantId: participant?.id || 0,
                  notes: fullExpenseData.notes || null,
                  participantCount: fullExpenseData.participants?.length || 0,
                  splitType: fullExpenseData.splitType,
                  remainingOwed: (participant?.remainingOwed || 0) + app.amount,
                  totalApprovedPaid: Math.max(0, (participant?.totalPaid || 0) - app.amount),
                });
              }
            });
          }

          applyUnlessCancelled(cancelled, () => setUnpaidExpenses(finalExpenses));
        } catch (_error) {
          applyUnlessCancelled(cancelled, () => setUnpaidExpenses([]));
        } finally {
          applyUnlessCancelled(cancelled, () => setLoadingExpenses(false));
        }
      };

      loadUnpaidExpenses();
      return () => {
        cancelled = true;
      };
    }

    setUnpaidExpenses([]);
    return undefined;
  }, [colleagueId, paymentMode, applications]);

  return { unpaidExpenses, loadingExpenses };
}
