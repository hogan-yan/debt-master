/**
 * PaymentForm component for recording new payments
 * Supports both prepayments and expense-specific payments
 */

import React, { useEffect } from 'react';
import type { CreatePaymentSchema } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { PAYMENT, PAYMENT_FORM } from '@/test/test-ids';
import { type Colleague, PaymentType } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { Button } from '../ui/button';
import { DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { PaymentInfoBox } from './payment-info-box';
import { PaymentModeSelector } from './payment-mode-selector';
import { PaymentProofUpload } from './payment-proof-upload';
import { UnpaidExpenseList } from './unpaid-expense-list';
import { useExpenseSelection } from './use-expense-selection';
import { type PaymentFormState, PaymentMode } from './use-payment-form';
import { usePaymentForm } from './use-payment-form-hook';
import { usePaymentSubmission } from './use-payment-submission';
import { useUnpaidExpenses } from './use-unpaid-expenses';

export function remainingOwedOrZero(expense: { remainingOwed: number } | undefined): number {
  return expense ? expense.remainingOwed : 0;
}

interface PaymentFormProps {
  colleagues: Colleague[];
  onClose: () => void;
  onSubmit: (data: CreatePaymentSchema) => Promise<void>;
  initialData?:
    | {
        colleagueId?: string | undefined;
        amount?: string | undefined;
        date?: string | undefined;
        paymentType?: PaymentType | undefined;
        paymentId?: number | undefined;
        hasExistingPaymentProof?: boolean | undefined;
        expenseId?: number | undefined;
        applications?:
          | {
              id: number;
              amount: number;
              expense?: { id: number } | undefined;
            }[]
          | undefined;
      }
    | undefined;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  colleagues,
  onClose,
  onSubmit,
  initialData,
}) => {
  // Determine initial payment mode
  const initialPaymentMode: PaymentMode =
    initialData?.expenseId || (initialData?.applications && initialData.applications.length > 0)
      ? 'EXPENSE_PAYMENT'
      : 'PREPAYMENT';

  // Form state managed by reducer
  const form = usePaymentForm({
    paymentMode: initialPaymentMode,
    editableAmount: initialData?.amount ?? '',
    paymentType: (initialData?.paymentType as PaymentFormState['paymentType']) ?? 'PAYME',
    currentColleagueId: initialData?.colleagueId ?? '',
    ...(initialData?.date ? { date: new Date(initialData.date).toISOString().split('T')[0] } : {}),
  });

  // Expense selection managed by reducer + hook
  const expenseSelection = useExpenseSelection();

  // Track image processing state from the PaymentProofUpload child component
  const [isProofProcessing, setIsProofProcessing] = React.useState(false);

  // Initialize form state from initialData (run once)
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialData is the only changing dependency, form methods and expenseSelection are stable
  useEffect(() => {
    if (initialData) {
      if (initialData.hasExistingPaymentProof) {
        form.setHadExistingProof(true);
      }

      if (initialData.applications && initialData.applications.length > 0) {
        const initialExpenseIds = initialData.applications
          .map((app) => app.expense?.id)
          .filter((id): id is number => id !== undefined);
        const initialExpenseAmounts = initialData.applications.reduce(
          (acc, app) => {
            if (app.expense?.id) acc[app.expense.id] = app.amount.toString();
            return acc;
          },
          {} as Record<number, string>
        );
        expenseSelection.restore({
          selectedIds: initialExpenseIds,
          amounts: initialExpenseAmounts,
        });
      } else if (initialData.expenseId) {
        expenseSelection.restore({ selectedIds: [initialData.expenseId], amounts: {} });
      }
    }
  }, [initialData]);

  // Unpaid expenses fetched and merged for expense payment mode
  const { unpaidExpenses, loadingExpenses } = useUnpaidExpenses({
    colleagueId: form.state.currentColleagueId,
    paymentMode: form.state.paymentMode,
    applications: initialData?.applications,
  });

  // Reset expense selection when expenses are reloaded
  // biome-ignore lint/correctness/useExhaustiveDependencies: expenseSelection is stable
  useEffect(() => {
    if (form.state.paymentMode !== 'EXPENSE_PAYMENT') {
      expenseSelection.reset();
    }
  }, [form.state.currentColleagueId, form.state.paymentMode]);

  // Submission handler with validation
  const { isSubmitting, validateAndSubmit } = usePaymentSubmission({
    formState: form.state,
    selectedExpenseIds: expenseSelection.selectedIds,
    expenseAmounts: expenseSelection.amounts,
    totalAmount: expenseSelection.totalAmount,
    paymentId: initialData?.paymentId,
    onSubmit,
    onSuccess: onClose,
  });

  const handleColleagueChange = (colleagueId: string): void => {
    form.setColleague(colleagueId);
    expenseSelection.reset();
  };

  const handlePaymentModeChange = (mode: PaymentMode): void => {
    form.setMode(mode);
    expenseSelection.reset();
  };

  const handleExpenseSelection = (expenseId: number, selected: boolean): void => {
    const expense = unpaidExpenses.find((e) => e.id === expenseId);
    expenseSelection.toggleExpense(expenseId, selected, remainingOwedOrZero(expense));
  };

  const colleagueOptions = colleagues.map((colleague) => {
    const hasBalance = 'currentBalance' in colleague;
    if (!hasBalance) {
      return { value: colleague.id.toString(), label: colleague.name };
    }
    const colleagueWithBalance = colleague as Colleague & { currentBalance?: number };
    const currentBalance = colleagueWithBalance.currentBalance ?? 0;
    const owesAmount = Math.abs(currentBalance);
    const balanceText =
      currentBalance < 0
        ? m.payment_form_owes({ amount: formatCurrency(owesAmount) })
        : currentBalance > 0
          ? m.payment_form_prepaid({ amount: formatCurrency(currentBalance) })
          : m.payment_form_balanceZero({ amount: formatCurrency(0) });
    return { value: colleague.id.toString(), label: `${colleague.name} (${balanceText})` };
  });

  const paymentTypeOptions = [
    { value: 'PAYME', label: m.payment_modal_payme() },
    { value: 'FPS', label: m.payment_modal_fps() },
    { value: 'CASH', label: m.payment_modal_cash() },
    { value: 'OTHER', label: m.payment_modal_other() },
  ];

  return (
    <form onSubmit={validateAndSubmit}>
      <div className="grid gap-4 py-4">
        {!initialData?.paymentId && (
          <Label>
            {m.payment_form_paymentTypeLabel()}
            <div className="mt-2">
              <PaymentModeSelector
                selected={form.state.paymentMode}
                onChange={handlePaymentModeChange}
              />
            </div>
          </Label>
        )}

        <PaymentInfoBox mode={form.state.paymentMode} />

        <div className="space-y-2">
          <Label htmlFor="colleagueId">{m.payment_form_colleagueLabel()}</Label>
          <select
            id="colleagueId"
            name="colleagueId"
            value={form.state.currentColleagueId}
            onChange={(e) => handleColleagueChange(e.target.value)}
            className="w-full p-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring"
            data-testid={PAYMENT.COLLEAGUE_SELECT}
            required
          >
            <option value="">{m.payment_form_selectColleague()}</option>
            {colleagueOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {form.state.paymentMode === 'EXPENSE_PAYMENT' && form.state.currentColleagueId && (
          <UnpaidExpenseList
            unpaidExpenses={unpaidExpenses}
            loadingExpenses={loadingExpenses}
            selectedExpenseIds={expenseSelection.selectedIds}
            expenseAmounts={expenseSelection.amounts}
            onToggleExpense={handleExpenseSelection}
            onAmountChange={expenseSelection.updateAmount}
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="amount">
            {m.payment_form_amountLabel()}
            {form.state.paymentMode === 'EXPENSE_PAYMENT' && expenseSelection.totalAmount > 0 && (
              <span className="text-sm text-muted-foreground ml-2">
                {m.payment_form_totalApplied({
                  amount: formatCurrency(expenseSelection.totalAmount),
                })}
              </span>
            )}
          </Label>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.state.editableAmount}
            onChange={(e) => form.setAmount(e.target.value)}
            className="w-full p-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring"
            data-testid={PAYMENT_FORM.AMOUNT_INPUT}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">{m.payment_form_dateLabel()}</Label>
          <input
            id="date"
            name="date"
            type="date"
            value={form.state.date}
            onChange={(e) => form.setDate(e.target.value)}
            className="w-full p-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring"
            data-testid={PAYMENT_FORM.DATE_INPUT}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentType">{m.payment_modal_paymentMethod()}</Label>
          <select
            id="paymentType"
            name="paymentType"
            value={form.state.paymentType}
            onChange={(e) => form.setPaymentType(e.target.value as PaymentFormState['paymentType'])}
            className="w-full p-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring"
            required
          >
            {paymentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <PaymentProofUpload
          paymentId={initialData?.paymentId}
          hasExistingPaymentProof={initialData?.hasExistingPaymentProof}
          proofFile={form.state.paymentProofFile}
          existingProofUrl={form.state.existingPaymentProofUrl}
          keepExistingProof={form.state.keepExistingProof}
          showExistingProof={form.state.showExistingProof}
          onProofFileChange={form.setPaymentProofFile}
          onExistingProofUrlChange={form.setPaymentProofUrl}
          onKeepExistingProofChange={form.setKeepExistingProof}
          onHadExistingProofChange={form.setHadExistingProof}
          onShowExistingProofChange={form.setShowExistingProof}
          onProcessingChange={setIsProofProcessing}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          data-testid={PAYMENT_FORM.CANCEL_BTN}
        >
          {m.common_cancel()}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isProofProcessing}
          data-testid={PAYMENT.SUBMIT_PAYMENT_BTN}
        >
          {isSubmitting || isProofProcessing
            ? m.payment_form_processing()
            : initialData?.paymentId
              ? m.payment_form_updatePayment()
              : m.colleague_detail_recordPayment()}
        </Button>
      </DialogFooter>
    </form>
  );
};
