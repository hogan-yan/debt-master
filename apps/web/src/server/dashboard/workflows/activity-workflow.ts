import type { RecentActivity } from '../types';

export interface RawExpense {
  id: number;
  amount: number;
  date: Date;
  restaurant?: { name: string | null } | null;
}

export interface RawPayment {
  id: number;
  amount: number;
  date: Date;
  colleague?: { name: string | null } | null;
  restaurant?: { name: string | null } | null;
}

function toDateString(date: Date): string {
  return date.toISOString().replace(/T.*/, '');
}

export function transformExpensesToActivities(expenses: RawExpense[]): RecentActivity[] {
  return expenses.map((expense) => ({
    id: expense.id,
    type: 'expense' as const,
    description: `Expense at ${expense.restaurant?.name || 'Unknown Restaurant'}`,
    amount: expense.amount,
    date: toDateString(expense.date),
    restaurant: expense.restaurant?.name ?? undefined,
  }));
}

export function transformPaymentsToActivities(payments: RawPayment[]): RecentActivity[] {
  return payments.map((payment) => ({
    id: payment.id,
    type: 'payment' as const,
    description: `${payment.colleague?.name ?? 'Unknown'} paid`,
    amount: payment.amount,
    date: toDateString(payment.date),
    colleague: payment.colleague?.name ?? undefined,
    ...(payment.restaurant?.name ? { restaurant: payment.restaurant.name } : {}),
  }));
}

export function mergeAndSortActivities(
  expenses: RecentActivity[],
  payments: RecentActivity[],
  limit: number
): RecentActivity[] {
  const all = [...expenses, ...payments];
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all.slice(0, limit);
}
