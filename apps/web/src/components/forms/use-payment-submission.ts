/**
 * usePaymentSubmission — wires validation and the validateAndSubmit callback.
 * Keeps all validation logic and form-data assembly in one place.
 *
 * Ownership note: the CALLER (page) owns the actual submission via `onSubmit`
 * — it wraps the server call in its own useFormSubmission, which toasts
 * success/error and refreshes data. This hook deliberately does NOT wrap
 * `onSubmit` in a second useFormSubmission: a nested wrapper would show a
 * success toast even when the page handler swallowed a server error (the
 * handler reports failures itself and returns normally), closing the dialog
 * over a failed payment.
 */

import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { CreatePaymentSchema } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { formatCurrency } from '@/utils/formatters';
import type { PaymentFormState } from './use-payment-form';

export interface UsePaymentSubmissionParams {
  formState: PaymentFormState;
  selectedExpenseIds: number[];
  expenseAmounts: Record<number, string>;
  totalAmount: number;
  onSubmit: (data: CreatePaymentSchema) => Promise<void>;
}

interface UsePaymentSubmissionReturn {
  isSubmitting: boolean;
  validateAndSubmit: (e: React.FormEvent) => Promise<void>;
}

export function usePaymentSubmission({
  formState,
  selectedExpenseIds,
  expenseAmounts,
  totalAmount,
  onSubmit,
}: UsePaymentSubmissionParams): UsePaymentSubmissionReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateAndSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();

      const {
        currentColleagueId: colleagueId,
        editableAmount,
        date,
        paymentType,
        paymentMode,
      } = formState;

      if (!colleagueId || !editableAmount || !date || !paymentType) {
        toast.error(m.payment_form_missingFields());
        return;
      }
      if (paymentMode === 'EXPENSE_PAYMENT' && selectedExpenseIds.length === 0) {
        toast.error(m.payment_form_selectExpense());
        return;
      }
      const amountNum = Number.parseFloat(editableAmount);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        toast.error(m.payment_form_validAmount());
        return;
      }
      if (paymentMode === 'EXPENSE_PAYMENT' && amountNum < totalAmount - 0.001) {
        toast.error(
          m.payment_form_amountLessThanApplied({
            paymentAmount: formatCurrency(amountNum),
            appliedAmount: formatCurrency(totalAmount),
          })
        );
        return;
      }
      const idNum = Number.parseInt(colleagueId, 10);
      if (Number.isNaN(idNum) || idNum <= 0) {
        toast.error(m.payment_form_validColleague());
        return;
      }

      const proofFile = formState.paymentProofFile;
      const keepFlag = formState.keepExistingProof && !proofFile;
      const removeFlag = !formState.keepExistingProof && !proofFile && formState.hadExistingProof;

      setIsSubmitting(true);
      try {
        await onSubmit({
          colleagueId,
          amount: editableAmount,
          date,
          paymentType,
          paymentProofFile: proofFile ?? undefined,
          keepExistingProof: !!keepFlag,
          removeExistingProof: !!removeFlag,
          selectedExpenseIds,
          expenseAmounts,
        });
      } catch (error) {
        // Callers that own the full submission flow (useFormSubmission)
        // report their own errors; this catch is for callers that let the
        // server error propagate. Either way the dialog stays open.
        toast.error(m.payment_form_errorTitle(), {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formState, selectedExpenseIds, expenseAmounts, totalAmount, onSubmit]
  );

  return { isSubmitting, validateAndSubmit };
}
