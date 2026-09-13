import type { Prisma } from '@prisma/client';
import { type ColleagueDebtTransaction, calculateDebtAge } from './debt-age-workflow';

export interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
}

export interface ColleagueDetailMetrics {
  totalOwed: number;
  totalPaid: number;
  currentBalance: number;
  debtAgeDays: number | null;
  lastActivityDate: Date | null;
  expenseCount: number;
  paymentCount: number;
  agingBuckets: AgingBuckets;
}

export interface DetailMetricsInput {
  totalOwed: number;
  totalPaid: number;
  expenseCount: number;
  paymentCount: number;
  transactions: ColleagueDebtTransaction[];
  lastExpenseDate: Date | null;
  lastPaymentDate: Date | null;
}

function computeAgingBuckets(transactions: ColleagueDebtTransaction[]): AgingBuckets {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const buckets: AgingBuckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  };

  for (const t of transactions) {
    if (t.type !== 'expense') continue;

    const expenseDate = new Date(t.date);
    expenseDate.setHours(12, 0, 0, 0);
    const ageDays = Math.floor((today.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24));

    if (ageDays <= 0) {
      buckets.current += t.amount;
    } else if (ageDays <= 30) {
      buckets.days1to30 += t.amount;
    } else if (ageDays <= 60) {
      buckets.days31to60 += t.amount;
    } else if (ageDays <= 90) {
      buckets.days61to90 += t.amount;
    } else {
      buckets.days90plus += t.amount;
    }
  }

  return buckets;
}

export function computeDetailMetrics(input: DetailMetricsInput): ColleagueDetailMetrics {
  const currentBalance = input.totalPaid - input.totalOwed;
  const { debtAgeDays } = calculateDebtAge(input.transactions);

  let lastActivityDate: Date | null = null;
  if (input.lastExpenseDate && input.lastPaymentDate) {
    lastActivityDate =
      input.lastExpenseDate > input.lastPaymentDate ? input.lastExpenseDate : input.lastPaymentDate;
  } else if (input.lastExpenseDate) {
    lastActivityDate = input.lastExpenseDate;
  } else if (input.lastPaymentDate) {
    lastActivityDate = input.lastPaymentDate;
  }

  return {
    totalOwed: input.totalOwed,
    totalPaid: input.totalPaid,
    currentBalance,
    debtAgeDays,
    lastActivityDate,
    expenseCount: input.expenseCount,
    paymentCount: input.paymentCount,
    agingBuckets: computeAgingBuckets(input.transactions),
  };
}

export interface ColleagueDetailMetricsWorkflowInput {
  colleagueId: number;
}

export async function colleagueDetailMetricsWorkflow(
  tx: Prisma.TransactionClient,
  _deps: Record<string, never>,
  input: ColleagueDetailMetricsWorkflowInput
): Promise<ColleagueDetailMetrics> {
  const [expenseAgg, paymentAgg, allExpenses, allPayments] = await Promise.all([
    tx.expenseParticipant.aggregate({
      where: { colleagueId: input.colleagueId },
      _sum: { amount: true },
      _count: true,
    }),
    tx.payment.aggregate({
      where: { colleagueId: input.colleagueId, isApproved: true },
      _sum: { amount: true },
      _count: true,
    }),
    tx.expenseParticipant.findMany({
      where: { colleagueId: input.colleagueId },
      select: { amount: true, expense: { select: { date: true } } },
      orderBy: { expense: { date: 'desc' } },
    }),
    tx.payment.findMany({
      where: { colleagueId: input.colleagueId, isApproved: true },
      select: { amount: true, date: true },
      orderBy: { date: 'desc' },
    }),
  ]);

  const totalOwed = expenseAgg._sum.amount ? Number(expenseAgg._sum.amount) : 0;
  const totalPaid = paymentAgg._sum.amount ? Number(paymentAgg._sum.amount) : 0;
  const expenseCount = expenseAgg._count;
  const paymentCount = paymentAgg._count;

  const transactions: ColleagueDebtTransaction[] = [
    ...allExpenses.map((e) => ({
      type: 'expense' as const,
      amount: Number(e.amount),
      date: e.expense.date,
    })),
    ...allPayments.map((p) => ({
      type: 'payment' as const,
      amount: Number(p.amount),
      date: p.date,
    })),
  ];

  const lastExpenseDate = allExpenses[0]?.expense?.date ?? null;
  const lastPaymentDate = allPayments[0]?.date ?? null;

  return computeDetailMetrics({
    totalOwed,
    totalPaid,
    expenseCount,
    paymentCount,
    transactions,
    lastExpenseDate,
    lastPaymentDate,
  });
}
