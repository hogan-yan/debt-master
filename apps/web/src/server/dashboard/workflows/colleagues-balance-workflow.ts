import type { Prisma } from '@prisma/client';
import { buildAmountMap, mapsToNumberMaps } from '../../balance-calculator';
import { formatDaysAgo } from '../analytics-helpers';
import type { ColleagueWithBalance } from '../types';
import { buildColleagueWithBalance } from './colleagues-workflow';

export type ColleaguesBalanceWorkflowInput = Record<string, never>;

export async function colleaguesBalanceWorkflow(
  tx: Prisma.TransactionClient,
  _deps: Record<string, never>,
  _input: ColleaguesBalanceWorkflowInput
): Promise<ColleagueWithBalance[]> {
  const [colleagues, expenseParticipants, payments] = await Promise.all([
    tx.colleague.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, createdAt: true },
      orderBy: { name: 'asc' },
    }),
    tx.expenseParticipant.groupBy({
      by: ['colleagueId'],
      _sum: { amount: true },
    }),
    tx.payment.groupBy({
      by: ['colleagueId'],
      where: { isApproved: true },
      _sum: { amount: true },
    }),
  ]);

  if (colleagues.length === 0) return [];

  const colleagueIds = colleagues.map((c) => c.id);

  // Converged onto the exact money seam (balance-calculator over core minor units)
  const expenseMap = buildAmountMap(
    expenseParticipants.map((ep) => ({ id: ep.colleagueId, amount: ep._sum.amount }))
  );
  const paymentMap = buildAmountMap(
    payments.map((p) => ({ id: p.colleagueId, amount: p._sum.amount }))
  );
  // downstream consumes numeric major units; serialize once at the seam
  const expenseNum = mapsToNumberMaps(expenseMap);
  const paymentNum = mapsToNumberMaps(paymentMap);

  const [lastExpenseDates, lastPaymentDates] = await Promise.all([
    tx.expenseParticipant.findMany({
      where: { colleagueId: { in: colleagueIds } },
      select: { colleagueId: true, expense: { select: { date: true } } },
      orderBy: { expense: { date: 'desc' } },
      distinct: ['colleagueId'],
    }),
    tx.payment.groupBy({
      by: ['colleagueId'],
      where: { colleagueId: { in: colleagueIds } },
      _max: { date: true },
    }),
  ]);

  const lastExpenseMap = new Map(lastExpenseDates.map((e) => [e.colleagueId, e.expense.date]));
  const lastPaymentMap = new Map(
    lastPaymentDates.filter((p) => p._max.date !== null).map((p) => [p.colleagueId, p._max.date])
  );

  return colleagues.map((colleague) =>
    buildColleagueWithBalance(
      colleague,
      {
        currentBalance: (paymentNum.get(colleague.id) || 0) - (expenseNum.get(colleague.id) || 0),
        totalOwed: expenseNum.get(colleague.id) || 0,
        totalPaid: paymentNum.get(colleague.id) || 0,
      },
      lastExpenseMap.get(colleague.id),
      lastPaymentMap.get(colleague.id),
      formatDaysAgo
    )
  );
}
