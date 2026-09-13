import type { ColleagueWithBalance, PendingPayment } from '../types';

function toDateString(date: Date): string {
  return date.toISOString().replace(/T.*/, '');
}

export function buildColleagueWithBalance(
  colleague: { id: number; name: string; createdAt: Date },
  balance: { currentBalance: number; totalOwed: number; totalPaid: number } | undefined,
  lastExpenseDate: Date | null | undefined,
  lastPaymentDate: Date | null | undefined,
  formatDaysAgo: (date: Date | string) => string
): ColleagueWithBalance {
  const latestDate =
    lastExpenseDate && lastPaymentDate
      ? lastExpenseDate > lastPaymentDate
        ? lastExpenseDate
        : lastPaymentDate
      : (lastExpenseDate ?? lastPaymentDate);

  return {
    id: colleague.id,
    name: colleague.name,
    currentBalance: balance?.currentBalance ?? 0,
    totalOwed: balance?.totalOwed ?? 0,
    totalPaid: balance?.totalPaid ?? 0,
    lastActivity: latestDate ? formatDaysAgo(latestDate) : 'No recent activity',
  };
}

export function filterOwingColleagues(colleagues: ColleagueWithBalance[]): ColleagueWithBalance[] {
  return colleagues
    .filter((c) => c.currentBalance < 0)
    .sort((a, b) => a.currentBalance - b.currentBalance);
}

export interface RawPendingPayment {
  id: number;
  amount: number;
  date: Date;
  colleague?: { name: string | null } | null;
  restaurant?: { name: string | null } | null;
  submittedAt?: Date | null;
  paymentType: string;
}

export function transformPendingPayments(payments: RawPendingPayment[]): PendingPayment[] {
  return payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    date: toDateString(payment.date),
    colleague: payment.colleague?.name || 'Unknown',
    ...(payment.restaurant?.name ? { restaurant: payment.restaurant.name } : {}),
    ...(payment.submittedAt ? { submittedAt: payment.submittedAt.toISOString() } : {}),
    paymentType: payment.paymentType,
  }));
}
