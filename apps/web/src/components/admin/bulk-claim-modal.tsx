/**
 * Bulk Claim Modal Component
 * Admin confirmation modal for bulk claiming all unpaid expenses for a colleague
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';
import { BULK_CLAIM, bulkClaimExpenseId, COMMON } from '@/test/test-ids';
import { formatCurrency } from '@/utils/formatters';

interface UnpaidExpense {
  id: number;
  date: string | Date;
  restaurantName: string;
  totalAmount: number;
  colleagueAmount: number;
  remainingOwed: number;
}

interface Debtor {
  id: number;
  name: string;
  currentBalance: number;
  unpaidExpenses: UnpaidExpense[];
}

interface BulkClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtor: Debtor | null;
  onConfirm: (paymentType: string) => Promise<void>;
  isSubmitting: boolean;
}

export function BulkClaimModal({
  open,
  onOpenChange,
  debtor,
  onConfirm,
  isSubmitting,
}: BulkClaimModalProps) {
  const [paymentType, setPaymentType] = useState('PAYME');

  if (!debtor) return null;

  const totalAmount = Math.abs(debtor.currentBalance);
  const expenseCount = debtor.unpaidExpenses.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={BULK_CLAIM.DIALOG}>
        <DialogHeader>
          <DialogTitle>{m.dashboard_bulkClaim_title()}</DialogTitle>
          <DialogDescription data-testid={BULK_CLAIM.DESCRIPTION}>
            {expenseCount === 1
              ? m.dashboard_bulkClaim_descriptionSingle({
                  amount: formatCurrency(totalAmount),
                  name: debtor.name,
                  count: expenseCount,
                })
              : m.dashboard_bulkClaim_description({
                  amount: formatCurrency(totalAmount),
                  name: debtor.name,
                  count: expenseCount,
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label htmlFor="paymentType" className="block text-sm font-medium mb-2">
            {m.dashboard_bulkClaim_paymentType()}
          </label>
          <select
            id="paymentType"
            data-testid={BULK_CLAIM.PAYMENT_TYPE_INPUT}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="PAYME">PayMe</option>
            <option value="FPS">FPS</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {expenseCount > 0 && (
          <div
            className="border rounded-md max-h-40 overflow-y-auto"
            data-testid={BULK_CLAIM.EXPENSES_LIST}
          >
            <div className="p-3 bg-muted/50 border-b font-medium text-sm">
              {m.dashboard_bulkClaim_expensesToCover()}
            </div>
            <div className="divide-y">
              {debtor.unpaidExpenses.slice(0, 5).map((expense) => (
                <div
                  key={expense.id}
                  data-testid={bulkClaimExpenseId(expense.id)}
                  className="flex justify-between items-center px-3 py-2 text-sm"
                >
                  <span className="truncate flex-1">{expense.restaurantName}</span>
                  <span className="font-medium ml-2">{formatCurrency(expense.remainingOwed)}</span>
                </div>
              ))}
              {expenseCount > 5 && (
                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                  {expenseCount - 5 === 1
                    ? m.dashboard_bulkClaim_moreExpense({ count: expenseCount - 5 })
                    : m.dashboard_bulkClaim_moreExpenses({ count: expenseCount - 5 })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid={COMMON.CANCEL_BTN}
          >
            {m.common_cancel()}
          </Button>
          <Button
            onClick={() => onConfirm(paymentType)}
            disabled={isSubmitting}
            data-testid={BULK_CLAIM.CONFIRM_BTN}
          >
            {isSubmitting
              ? m.dashboard_bulkClaim_processing()
              : m.dashboard_bulkClaim_confirmClaim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
