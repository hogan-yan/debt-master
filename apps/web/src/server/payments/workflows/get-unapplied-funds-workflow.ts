/**
 * Get Unapplied Funds Workflow
 *
 * Computes unapplied funds for all colleagues by comparing total approved
 * payments against total payment applications.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { toMinor } from '@/server/money/edge';

// =============================================================================
// TYPES
// =============================================================================

export interface GetUnappliedFundsInput {
  colleagueIds?: number[];
}

export interface GetUnappliedFundsResult {
  unappliedFunds: Record<number, number>;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function getUnappliedFundsWorkflow(
  tx: Prisma.TransactionClient,
  input: GetUnappliedFundsInput = {}
): Promise<GetUnappliedFundsResult> {
  const paymentWhere: Prisma.PaymentWhereInput = { isApproved: true };
  if (input.colleagueIds) {
    paymentWhere.colleagueId = { in: input.colleagueIds };
  }

  const [payments, applications] = await Promise.all([
    tx.payment.groupBy({
      by: ['colleagueId'],
      where: paymentWhere,
      _sum: { amount: true },
    }),
    tx.paymentApplication.groupBy({
      by: ['participantId'],
      _sum: { amount: true },
    }),
  ]);

  const allParticipants = await tx.expenseParticipant.findMany({
    select: { id: true, colleagueId: true },
    ...(input.colleagueIds ? { where: { colleagueId: { in: input.colleagueIds } } } : {}),
  });
  const participantToColleagueMap = new Map<number, number>();
  for (const p of allParticipants) {
    participantToColleagueMap.set(p.id, p.colleagueId);
  }

  // Exact minor-unit aggregation: paid and applied sums never accumulate
  // float error; the threshold compare is exact (no epsilon).
  const paidMap = new Map<number, bigint>();
  for (const p of payments) {
    paidMap.set(p.colleagueId, toMinor(p._sum.amount ?? 0));
  }

  const appliedMap = new Map<number, bigint>();
  for (const app of applications) {
    const colleagueId = participantToColleagueMap.get(app.participantId);
    if (colleagueId) {
      appliedMap.set(
        colleagueId,
        (appliedMap.get(colleagueId) ?? 0n) + toMinor(app._sum.amount ?? 0)
      );
    }
  }

  const unappliedFunds: Record<number, number> = {};
  const allColleagueIds = new Set([...paidMap.keys(), ...appliedMap.keys()]);

  for (const colleagueId of allColleagueIds) {
    const unapplied = (paidMap.get(colleagueId) ?? 0n) - (appliedMap.get(colleagueId) ?? 0n);
    if (unapplied > 0n) {
      unappliedFunds[colleagueId] = Number(unapplied) / 100;
    }
  }

  return { unappliedFunds };
}
