/**
 * usePaymentSubmission — wires useFormSubmission and owns the validateAndSubmit callback.
 * Keeps all validation logic and form-data assembly in one place.
 */

import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { useFormSubmission } from '@/hooks';
import type { CreatePaymentSchema } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { formatCurrency } from '@/utils/formatters';
import type { PaymentFormState } from './use-payment-form';

export interface UsePaymentSubmissionParams {
  formState: PaymentFormState;
  selectedExpenseIds: number[];
  expenseAmounts: Record<number, string>;
  totalAmount: number;
  paymentId: number | undefined;
  onSubmit: (data: CreatePaymentSchema) => Promise<void>;
  onSuccess: () => void;
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
  paymentId,
  onSubmit,
  onSuccess,
}: UsePaymentSubmissionParams): UsePaymentSubmissionReturn {
  const { isSubmitting, handleSubmit } = useFormSubmission({
    onSuccess,
    successTitle: m.payment_form_successTitle(),
    successMessage:
      formState.paymentMode === 'PREPAYMENT'
        ? m.payment_form_prepaymentSuccess()
        : m.payment_form_expensePaymentSuccess(),
    errorTitle: m.payment_form_errorTitle(),
  });

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

      if (paymentId) {
        const formData = new FormData();
        formData.append('colleagueId', colleagueId);
        formData.append('amount', editableAmount);
        formData.append('date', date);
        formData.append('paymentType', paymentType);
        formData.append('id', paymentId.toString());
        if (proofFile) formData.append('paymentProofFile', proofFile);
        formData.append('keepExistingProof', keepFlag.toString());
        formData.append('removeExistingProof', removeFlag.toString());
        if (paymentMode === 'EXPENSE_PAYMENT') {
          formData.append('expenseSelection.selectedIds', JSON.stringify(selectedExpenseIds));
          formData.append('expenseSelection.amounts', JSON.stringify(expenseAmounts));
        }
      }

      await handleSubmit(
        () =>
          onSubmit({
            colleagueId,
            amount: editableAmount,
            date,
            paymentType,
            paymentProofFile: proofFile ?? undefined,
            keepExistingProof: !!keepFlag,
            removeExistingProof: !!removeFlag,
            selectedExpenseIds,
            expenseAmounts,
          }),
        m.payment_form_processedSuccess({ amount: formatCurrency(amountNum) })
      );
    },
    [formState, selectedExpenseIds, expenseAmounts, totalAmount, paymentId, handleSubmit, onSubmit]
  );

  return { isSubmitting, validateAndSubmit };
}
