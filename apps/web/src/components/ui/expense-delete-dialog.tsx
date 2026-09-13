import { AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';
import { COMMON } from '@/test/test-ids';
import { formatCurrency } from '@/utils/formatters';

interface ExpenseDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  expense: {
    id: number;
    amount: number;
    restaurant?: { id: number; name: string; address?: string | null } | null | undefined;
    date: string | Date;
  } | null;
  onConfirm: (deletePayments: boolean) => void;
  isLoading?: boolean | undefined;
  hasRelatedPayments?: boolean | undefined;
}

/**
 * Specialized delete confirmation dialog for expenses
 * Includes option to delete related payments
 */
export function ExpenseDeleteDialog({
  isOpen,
  onOpenChange,
  expense,
  onConfirm,
  isLoading = false,
  hasRelatedPayments = false,
}: ExpenseDeleteDialogProps) {
  const [deletePayments, setDeletePayments] = useState(false);

  const handleConfirm = () => {
    onConfirm(deletePayments);
  };

  const handleCancel = () => {
    setDeletePayments(false);
    onOpenChange(false);
  };

  if (!expense) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive-text" />
            {m.expense_delete_title()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Expense details */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">{m.expense_delete_details()}</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>{m.expense_delete_amount()}</strong> {formatCurrency(expense.amount)}
              </p>
              <p>
                <strong>{m.expense_delete_restaurant()}</strong>{' '}
                {expense.restaurant?.name || m.common_unknown()}
              </p>
              <p>
                <strong>{m.expense_delete_date()}</strong>{' '}
                {typeof expense.date === 'string'
                  ? expense.date
                  : expense.date.toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Warning message */}
          <div className="text-foreground">
            <p>{m.expense_delete_warning()}</p>
            <p className="text-sm text-destructive-text mt-1">{m.expense_delete_irreversible()}</p>
          </div>

          {/* Payment deletion option */}
          {hasRelatedPayments && (
            <div className="border border-warning/20 bg-warning/10 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-warning">{m.expense_delete_paymentsFound()}</h4>
                    <p className="text-sm text-warning mt-1">{m.expense_delete_paymentsDesc()}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="delete-payments"
                      checked={deletePayments}
                      onCheckedChange={(checked) => setDeletePayments(checked === true)}
                    />
                    <label
                      htmlFor="delete-payments"
                      className="text-sm font-medium text-warning cursor-pointer"
                    >
                      {m.expense_delete_paymentsCheckbox()}
                    </label>
                  </div>

                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    {deletePayments ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    <span>
                      {deletePayments
                        ? m.expense_delete_paymentsWillDelete()
                        : m.expense_delete_paymentsWillKeep()}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              data-testid={COMMON.CANCEL_BTN}
            >
              {m.common_cancel()}
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? m.expense_delete_deleting() : m.common_delete()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
