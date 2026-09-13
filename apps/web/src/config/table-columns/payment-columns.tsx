/**
 * Payment table column definitions
 */

import { ColumnDef } from '@tanstack/react-table';
import {
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CompactDateWithBadge } from '@/components/ui/date-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { m } from '@/paraglide/messages';
import { BADGE_CLASSES } from '@/styles/class-constants';
import { PAYMENT, TABLE_COL } from '@/test/test-ids';
import { Payment } from '@/types';
import { formatCurrency } from '@/utils/formatters';

interface PaymentTableActionsProps {
  onEdit: (_payment: Payment) => void;
  onDelete: (_payment: Payment) => void;
  onViewPaymentProof?: (_payment: Payment) => void;
  onGoToExpense?: (_payment: Payment) => void;
  onGoToSpecificExpense?: (expenseId: number) => void;
  isAdmin?: boolean;
}

/**
 * Renders a clickable restaurant name with Building2 icon, truncated to fit.
 * Falls back to "Unknown" if no expense/restaurant is provided.
 */
const ExpenseNameLink = ({
  name,
  onClick,
  className,
}: {
  name: string | undefined;
  onClick?: () => void;
  className: string;
}) => {
  if (onClick) {
    return (
      <Button
        variant="link"
        size="sm"
        onClick={onClick}
        className={`h-auto p-0 text-left min-w-0 ${className}`}
      >
        <div className="flex items-center space-x-1 min-w-0">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{name || 'Unknown'}</span>
        </div>
      </Button>
    );
  }
  return (
    <div className="flex items-center space-x-1 text-muted-foreground min-w-0">
      <Building2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{name || 'Unknown'}</span>
    </div>
  );
};

/**
 * Expandable Payment Applications Cell Component
 */
const PaymentApplicationsCell = ({
  payment,
  onGoToSpecificExpense,
}: {
  payment: Payment;
  onGoToSpecificExpense?: (expenseId: number) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const applications = payment.applications || [];

  // Only called from renderMultipleApplications (length > 1), so plural form only.
  function getExpenseCountLabel(count: number): string {
    return m.payment_applications_expenseCount_other({ count: String(count) });
  }

  function getLegacyExpenseLinkClickHandler(): (() => void) | undefined {
    const legacyExpenseId = payment.expense?.id;
    if (!legacyExpenseId) return undefined;
    if (!onGoToSpecificExpense) return undefined;
    return () => onGoToSpecificExpense(legacyExpenseId);
  }

  function renderPurePrepayment() {
    return (
      <div className="text-sm text-muted-foreground italic">
        {m.payment_applications_availableAsCredit()}
      </div>
    );
  }

  function renderLegacySingleExpensePayment() {
    return (
      <div className="max-w-64">
        <ExpenseNameLink
          name={payment.expense?.restaurant?.name}
          onClick={getLegacyExpenseLinkClickHandler()}
          className="text-info hover:text-info/80"
        />
      </div>
    );
  }

  function renderSingleApplication() {
    const application = applications[0];
    if (!application) {
      return (
        <div className="max-w-64 text-sm text-muted-foreground italic">
          {m.payment_applications_unknown()}
        </div>
      );
    }

    const expenseId = application.expense?.id;
    const handleClick =
      expenseId && onGoToSpecificExpense ? () => onGoToSpecificExpense(expenseId) : undefined;

    return (
      <div className="max-w-64">
        <ExpenseNameLink
          name={application.expense?.restaurant?.name}
          onClick={handleClick}
          className="text-foreground/80 hover:text-foreground/70"
        />
        <div className="text-xs text-muted-foreground">{formatCurrency(application.amount)}</div>
      </div>
    );
  }

  function renderMultipleApplications() {
    const totalApplied = applications.reduce((sum, application) => sum + application.amount, 0);
    const remainingCredit = payment.amount - totalApplied;

    return (
      <div className="max-w-64">
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-auto p-1 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{getExpenseCountLabel(applications.length)}</div>
            <div className="text-xs text-muted-foreground">
              {m.payment_applications_applied({ amount: formatCurrency(totalApplied) })}
              {remainingCredit > 0 && (
                <span className="text-muted-foreground ml-1">
                  • {m.payment_applications_credit({ amount: formatCurrency(remainingCredit) })}
                </span>
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 pl-6 space-y-1 border-l-2 border-border max-h-64 overflow-y-auto">
            {applications.map((application) => {
              const expenseId = application.expense?.id;
              const handleClick =
                expenseId && onGoToSpecificExpense
                  ? () => onGoToSpecificExpense(expenseId)
                  : undefined;

              return (
                <div
                  key={application.id}
                  className="flex items-center justify-between text-sm gap-2"
                >
                  <div className="flex items-center space-x-1 flex-1 min-w-0">
                    <ExpenseNameLink
                      name={application.expense?.restaurant?.name}
                      onClick={handleClick}
                      className="text-foreground/80 hover:text-foreground/70"
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground shrink-0">
                    {formatCurrency(application.amount)}
                  </span>
                </div>
              );
            })}

            {remainingCredit > 0 && (
              <div className="pt-1 mt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {m.payment_applications_remainingCreditLabel()}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(remainingCredit)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Handle no applications (pure prepayment)
  if (applications.length === 0) {
    if (payment.expense) return renderLegacySingleExpensePayment();
    return renderPurePrepayment();
  }

  if (applications.length === 1) return renderSingleApplication();
  return renderMultipleApplications();
};

/**
 * Creates payment table columns with customizable actions
 * @param actions - Action handlers for payment operations
 * @returns Array of column definitions for the payment table
 */
export const createPaymentColumns = (
  actions: Omit<PaymentTableActionsProps, 'payment'> & { isAdmin?: boolean }
): ColumnDef<Payment>[] => [
  {
    accessorKey: 'date',
    size: 120,
    header: () => m.payment_col_date(),
    cell: ({ row }) => {
      const dateValue = row.getValue('date') as string | Date;
      const dateString = typeof dateValue === 'string' ? dateValue : dateValue.toISOString();
      return <CompactDateWithBadge dateString={dateString} />;
    },
  },
  {
    accessorKey: 'colleagueName',
    size: 180,
    header: () => m.payment_col_colleague(),
    cell: ({ row }) => {
      const payment = row.original;
      const colleague = payment.colleague;
      const colleagueName = colleague?.name || 'Unknown';
      return (
        <div className="flex items-center space-x-3 whitespace-nowrap">
          <EnhancedAvatar name={colleagueName} size="sm" />
          <span className="truncate">{colleagueName}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'amount',
    size: 240,
    header: () => {
      return <div className="text-right">{m.payment_col_amount()}</div>;
    },
    cell: ({ row }) => {
      const payment = row.original;
      const amount = Number.parseFloat(row.getValue('amount'));

      // Calculate remaining credit
      const applications = payment.applications || [];
      const totalApplied = applications.reduce((sum, app) => sum + app.amount, 0);
      const remainingCredit = amount - totalApplied;
      const hasUnusedCredit = remainingCredit > 0;

      return (
        <div className="text-right whitespace-nowrap">
          <div className="flex items-center justify-end space-x-2">
            <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
            {hasUnusedCredit && (
              <div className="flex items-center space-x-1">
                <CreditCard className="h-3 w-3 text-info" />
                <span className="text-xs font-medium text-info bg-info/10 px-1.5 py-0.5 rounded">
                  {formatCurrency(remainingCredit)} {m.payment_badge_credit()}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'paymentType',
    size: 90,
    header: () => m.payment_col_paymentMethod(),
    cell: ({ row }) => {
      const paymentType = row.getValue('paymentType') as string;
      const badgeClassMap: Record<string, string> = {
        CASH: BADGE_CLASSES.PAYMENT_CASH,
        FPS: BADGE_CLASSES.PAYMENT_BANK,
        PAYME: BADGE_CLASSES.PAYMENT_DIGITAL,
      };

      const displayNames: Record<string, string> = {
        PAYME: m.payment_type_payme(),
        FPS: m.payment_type_fps(),
        CASH: m.payment_type_cash(),
        OTHER: m.payment_type_other(),
      };

      return (
        <span
          className={`${BADGE_CLASSES.BADGE_BASE} ${
            badgeClassMap[paymentType] ?? 'bg-muted text-muted-foreground'
          }`}
        >
          {displayNames[paymentType] ?? paymentType}
        </span>
      );
    },
  },
  {
    id: 'applications',
    size: 280,
    header: () => m.payment_col_appliedToExpenses(),
    enableSorting: false,
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <PaymentApplicationsCell
          payment={payment}
          {...(actions.onGoToSpecificExpense
            ? { onGoToSpecificExpense: actions.onGoToSpecificExpense }
            : {})}
        />
      );
    },
  },
  {
    accessorKey: 'isApproved',
    size: 90,
    header: () => m.payment_col_status(),
    cell: ({ row }) => {
      const payment = row.original;
      const isApproved = payment.isApproved;

      if (isApproved) {
        return (
          <div className="flex items-center space-x-1 text-success">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{m.payment_status_approved()}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center space-x-1 text-warning">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">{m.payment_status_pending()}</span>
        </div>
      );
    },
  },
  {
    id: 'actions',
    size: 60,
    header: () => {
      return <div className="text-center">{m.payment_col_actions()}</div>;
    },
    cell: ({ row }) => {
      const payment = row.original;

      return (
        <div className="text-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 cursor-default hover:bg-accent"
                data-testid={TABLE_COL.ROW_ACTIONS_BTN}
              >
                <span className="sr-only">{m.payment_actions_openMenu()}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{m.payment_col_actions()}</DropdownMenuLabel>

              {/* View payment proof if available */}
              {payment.paymentProofBucket &&
                payment.paymentProofObjectKey &&
                actions.onViewPaymentProof && (
                  <DropdownMenuItem onClick={() => actions.onViewPaymentProof?.(payment)}>
                    <Eye className="h-4 w-4 mr-2" />
                    {m.payment_actions_viewPaymentProof()}
                  </DropdownMenuItem>
                )}

              {/* Go to related expense if available */}
              {payment.expense && actions.onGoToExpense && (
                <DropdownMenuItem onClick={() => actions.onGoToExpense?.(payment)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {m.payment_actions_viewRelatedExpense()}
                </DropdownMenuItem>
              )}

              {(payment.paymentProofBucket || payment.expense) && actions.isAdmin && (
                <DropdownMenuSeparator />
              )}

              {/* Admin actions */}
              {actions.isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => actions.onEdit(payment)}>
                    {m.payment_actions_edit()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => actions.onDelete(payment)}
                    className="text-destructive-text focus:text-destructive-text"
                    data-testid={PAYMENT.DELETE_PAYMENT_MENUITEM}
                  >
                    {m.payment_actions_delete()}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
