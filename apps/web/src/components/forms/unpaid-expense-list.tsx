/**
 * UnpaidExpenseList — renders the list of unpaid expenses for expense-specific payments.
 * Extracted from payment-form.tsx for readability and testability.
 */

import { Building2, Clock } from 'lucide-react';
import React from 'react';

import { m } from '@/paraglide/messages';
import { formatCurrency } from '@/utils/formatters';
import { Label } from '../ui/label';

// Unpaid expense type used in the payment form expense list
interface UnpaidExpense {
  id: number;
  date: Date;
  restaurantName: string;
  restaurantId: number;
  totalAmount: number;
  colleagueAmount: number;
  participantId: number;
  notes: string | null;
  participantCount: number;
  splitType: string;
  remainingOwed: number;
  totalApprovedPaid: number;
}

interface UnpaidExpenseListProps {
  unpaidExpenses: UnpaidExpense[];
  loadingExpenses: boolean;
  selectedExpenseIds: number[];
  expenseAmounts: Record<number, string>;
  onToggleExpense: (expenseId: number, checked: boolean) => void;
  onAmountChange: (expenseId: number, amount: string) => void;
}

export type { UnpaidExpense, UnpaidExpenseListProps };

export const UnpaidExpenseList: React.FC<UnpaidExpenseListProps> = ({
  unpaidExpenses,
  loadingExpenses,
  selectedExpenseIds,
  expenseAmounts,
  onToggleExpense,
  onAmountChange,
}) => {
  return (
    <div className="space-y-3">
      <Label>{m.payment_form_selectUnpaidExpenses()}</Label>
      {loadingExpenses ? (
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Clock className="h-4 w-4 animate-spin" />
          <span>{m.payment_form_loadingExpenses()}</span>
        </div>
      ) : unpaidExpenses.length === 0 ? (
        <div className="bg-muted/50 border border-muted rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">{m.payment_form_noUnpaidExpenses()}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto border border-muted rounded-lg">
          {unpaidExpenses.map((expense) => (
            <div
              key={expense.id}
              className={`p-3 border-b border-muted/70 last:border-b-0 ${
                selectedExpenseIds.includes(expense.id) ? 'bg-muted/50' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <label htmlFor={`expense-${expense.id}`} className="mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    id={`expense-${expense.id}`}
                    checked={selectedExpenseIds.includes(expense.id)}
                    onChange={(e) => onToggleExpense(expense.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="h-4 w-4 border-2 border-input rounded bg-background peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-colors">
                    {selectedExpenseIds.includes(expense.id) && (
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <title>{m.payment_form_selected()}</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </label>
                <label htmlFor={`expense-${expense.id}`} className="flex-1 min-w-0 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{expense.restaurantName}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {expense.date.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{m.payment_form_owed()} </span>
                      <span className="font-medium text-destructive-text">
                        {formatCurrency(expense.remainingOwed)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{m.payment_form_total()} </span>
                      <span className="text-foreground">{formatCurrency(expense.totalAmount)}</span>
                    </div>
                  </div>
                  {selectedExpenseIds.includes(expense.id) && (
                    <div className="mt-2">
                      <Label htmlFor={`amount-${expense.id}`} className="text-xs">
                        {m.payment_form_paymentAmount()}
                      </Label>
                      <input
                        id={`amount-${expense.id}`}
                        type="number"
                        step="0.01"
                        max={expense.remainingOwed}
                        value={expenseAmounts[expense.id] || ''}
                        onChange={(e) => onAmountChange(expense.id, e.target.value)}
                        className="w-full mt-1 p-1 text-sm border border-input rounded focus:ring-2 focus:ring-ring focus:border-ring"
                        placeholder={m.payment_form_maxPlaceholder({
                          amount: formatCurrency(expense.remainingOwed),
                        })}
                      />
                    </div>
                  )}
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
