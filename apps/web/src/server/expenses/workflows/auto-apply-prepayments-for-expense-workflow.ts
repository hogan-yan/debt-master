/**
 * Auto Apply Prepayments for Expense Workflow
 *
 * Orchestrates auto-applying available prepayments across all participants
 * of an expense. Wraps the per-participant autoApplyPrepaymentWorkflow.
 *
 * Design principles:
 * - All database operations use the injected transaction client
 * - Pure business logic - no framework dependencies
 */

import { Prisma } from '@prisma/client';
import { createServerLogger } from '@/server/infrastructure/logger';
import { minorToNumber } from '@/server/money/edge';
import { serializeDecimal } from '@/server/utils/decimal';
import { autoApplyPrepaymentWorkflow } from '../../payments/workflows/auto-apply-prepayment-workflow';

const logger = createServerLogger('auto-apply', process.env.NODE_ENV === 'development');

// =============================================================================
// TYPES
// =============================================================================

interface Participant {
  colleagueId: number;
  amount: Prisma.Decimal;
}

export interface AutoApplyPrepaymentsInput {
  participants: Participant[];
}

export interface AutoApplyPrepaymentsResult {
  autoApplications: Array<{ colleagueId: number; appliedAmount: number }>;
  totalAutoApplied: number;
}

// =============================================================================
// WORKFLOW
// =============================================================================

export async function autoApplyPrepaymentsForExpenseWorkflow(
  tx: Prisma.TransactionClient,
  input: AutoApplyPrepaymentsInput
): Promise<AutoApplyPrepaymentsResult | undefined> {
  const autoApplicationResults: Array<{ colleagueId: number; appliedAmount: number }> = [];

  for (const participant of input.participants) {
    try {
      const autoApplyResult = await autoApplyPrepaymentWorkflow(tx, {
        colleagueId: participant.colleagueId,
        maxAmount: Number(serializeDecimal(participant.amount)),
      });

      if (autoApplyResult.totalApplied > 0) {
        autoApplicationResults.push({
          colleagueId: participant.colleagueId,
          appliedAmount: minorToNumber(autoApplyResult.totalApplied),
        });
      }
    } catch (autoApplyError) {
      // Intentional best-effort: a failure for one participant must not
      // roll back auto-applies that already succeeded for other participants.
      // Log so the failure isn't silent.
      logger.error('Auto-apply prepayment failed', {
        colleagueId: participant.colleagueId,
        error: autoApplyError,
      });
    }
  }

  if (autoApplicationResults.length > 0) {
    return {
      autoApplications: autoApplicationResults,
      totalAutoApplied: autoApplicationResults.reduce((sum, app) => sum + app.appliedAmount, 0),
    };
  }

  return undefined;
}
