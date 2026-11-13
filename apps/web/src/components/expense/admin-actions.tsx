import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { m } from '@/paraglide/messages';
import { EXPENSE } from '@/test/test-ids';
import { AdminOnly } from '@/utils/auth-context';

interface AdminActionsProps {
  /** Expense ID for edit/delete operations */
  expenseId: number;
  /** Handler for edit action */
  onEdit?: () => void;
  /** Handler for delete action */
  onDelete?: () => void;
  /** Handler for duplicate action */
  onDuplicate?: () => void;
}

/**
 * Admin actions component for expense detail page
 * Provides administrative operations like edit and delete
 */
export const AdminActions = ({
  expenseId: _expenseId,
  onEdit,
  onDelete,
  onDuplicate,
}: AdminActionsProps) => {
  return (
    <AdminOnly>
      <Card className="border-warning/20 bg-warning/10">
        <CardHeader>
          <CardTitle className="text-warning">{m.expense_detail_adminActions()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            {onEdit && (
              <Button
                variant="outline"
                onClick={onEdit}
                className="w-full sm:w-auto"
                data-testid={EXPENSE.EDIT_EXPENSE_BTN}
              >
                {m.expense_detail_editExpense()}
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                onClick={onDuplicate}
                className="w-full sm:w-auto"
                data-testid={EXPENSE.DUPLICATE_EXPENSE_BTN}
              >
                {m.expense_detail_duplicateExpense()}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                onClick={onDelete}
                className="w-full sm:w-auto"
                data-testid={EXPENSE.DELETE_EXPENSE_BTN}
              >
                {m.expense_detail_deleteExpense()}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </AdminOnly>
  );
};
