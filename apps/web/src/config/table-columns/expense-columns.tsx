/**
 * Table column definitions for expenses
 */

import { Link } from '@tanstack/react-router';
import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, Clock, MoreHorizontal, Receipt, Users } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { m } from '@/paraglide/messages';
import { Expense } from '@/types';
import { formatCurrency, getSettlementStatusBadge } from '@/utils/formatters';

interface ExpenseTableActionsProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onDuplicate: (expense: Expense) => void;
  onViewReceipt?: (expense: Expense) => void;
  isAdmin?: boolean;
}

export const createExpenseColumns = (
  actions: Omit<ExpenseTableActionsProps, 'expense'> & { isAdmin?: boolean }
): ColumnDef<Expense>[] => [
  {
    accessorKey: 'date',
    header: m.expense_form_label_date(),
    cell: ({ row }) => {
      return <CompactDateWithBadge dateString={row.getValue('date')} />;
    },
  },
  {
    accessorKey: 'restaurant',
    header: m.expense_form_label_restaurant(),
    cell: ({ row }) => {
      const expense = row.original;
      const restaurantName = expense.restaurant?.name || m.expense_detail_unknownRestaurant();
      return <div>{restaurantName}</div>;
    },
  },
  {
    accessorKey: 'amount',
    header: () => {
      return <div className="text-right">{m.expense_col_amount()}</div>;
    },
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue('amount'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'participants',
    header: m.expense_col_participants(),
    enableSorting: false,
    cell: ({ row }) => {
      const expense = row.original;
      const participants = expense.participants || [];
      return (
        <TooltipProvider>
          <div className="flex items-center space-x-1 max-w-48">
            {participants.slice(0, 3).map((participant) => (
              <Tooltip key={participant.colleague?.id || participant.colleague?.name}>
                <TooltipTrigger asChild>
                  <div>
                    <EnhancedAvatar
                      name={participant.colleague?.name || m.common_unknown()}
                      size="sm"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{participant.colleague?.name || m.common_unknown()}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {participants.length > 3 && (
              <span className="text-xs text-muted-foreground ml-1">+{participants.length - 3}</span>
            )}
          </div>
        </TooltipProvider>
      );
    },
  },
  {
    id: 'settlementStatus',
    header: () => {
      return <div className="text-center">{m.expense_col_status()}</div>;
    },
    enableSorting: false,
    cell: ({ row }) => {
      const expense = row.original;
      const participants = expense.participants || [];
      const statusBadge = getSettlementStatusBadge(participants);

      const IconComponent =
        statusBadge.icon === 'CheckCircle'
          ? CheckCircle
          : statusBadge.icon === 'Clock'
            ? Clock
            : Users;

      // Check if any pending participants have payment proof
      participants.some((p) => p.isPending && p.paymentProofBucket && p.paymentProofObjectKey);

      return (
        <div className="text-center">
          <span className={statusBadge.className}>
            <IconComponent className="h-3 w-3 mr-1" />
            {statusBadge.text}
            {/* {hasPaymentProof && (
              <span title="Payment proof available">
                <Receipt className="h-3 w-3 ml-1 text-info" />
              </span>
            )} */}
          </span>
        </div>
      );
    },
  },
  {
    id: 'receipt',
    header: m.expense_detail_receipt(),
    enableSorting: false,
    cell: ({ row }) => {
      const expense = row.original;
      const hasReceipt = Boolean(expense.receiptBucket && expense.receiptObjectKey);

      if (hasReceipt && actions.onViewReceipt) {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.onViewReceipt?.(expense)}
            className="pl-0 text-muted-foreground hover:text-foreground"
          >
            {m.expense_action_viewReceipt()}
          </Button>
        );
      }

      return <span className="text-muted-foreground text-sm">{m.expense_detail_noReceipt()}</span>;
    },
  },
  {
    id: 'actions',
    header: () => {
      return <div className="text-center">{m.expense_col_actions()}</div>;
    },
    enableHiding: false,
    cell: ({ row }) => {
      const expense = row.original;

      return (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 cursor-default hover:bg-accent">
                <span className="sr-only">{m.common_openMenu()}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{m.expense_col_actions()}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/expense/$id/" params={{ id: expense.id.toString() }}>
                  {m.expense_action_view()}
                </Link>
              </DropdownMenuItem>
              {actions.isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => actions.onEdit(expense)}>
                    {m.expense_action_edit()}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => actions.onDuplicate(expense)}>
                    {m.expense_action_duplicate()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => actions.onDelete(expense)}
                    className="text-destructive-text focus:text-destructive-text"
                  >
                    {m.expense_action_delete()}
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

// Default columns for backward compatibility
export const expenseColumns: ColumnDef<Expense>[] = [
  {
    accessorKey: 'date',
    header: m.expense_form_label_date(),
    cell: ({ row }) => {
      return <CompactDateWithBadge dateString={row.getValue('date')} />;
    },
  },
  {
    accessorKey: 'restaurant',
    header: m.expense_form_label_restaurant(),
    cell: ({ row }) => {
      const expense = row.original;
      const restaurantName = expense.restaurant?.name || m.expense_detail_unknownRestaurant();
      return <div>{restaurantName}</div>;
    },
  },
  {
    accessorKey: 'amount',
    header: () => {
      return <div className="text-right">{m.expense_col_amount()}</div>;
    },
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue('amount'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'participants',
    header: m.expense_col_participants(),
    enableSorting: false,
    cell: ({ row }) => {
      const expense = row.original;
      const participants = expense.participants || [];
      return (
        <TooltipProvider>
          <div className="flex items-center space-x-1 max-w-48">
            {participants.slice(0, 3).map((participant) => (
              <Tooltip key={participant.colleague?.id || participant.colleague?.name}>
                <TooltipTrigger asChild>
                  <div>
                    <EnhancedAvatar
                      name={participant.colleague?.name || m.common_unknown()}
                      size="sm"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{participant.colleague?.name || m.common_unknown()}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {participants.length > 3 && (
              <span className="text-xs text-muted-foreground ml-1">+{participants.length - 3}</span>
            )}
          </div>
        </TooltipProvider>
      );
    },
  },
  {
    id: 'settlementStatus',
    header: () => {
      return <div className="text-center">{m.expense_col_status()}</div>;
    },
    enableSorting: false,
    cell: ({ row }) => {
      const expense = row.original;
      const participants = expense.participants || [];
      const statusBadge = getSettlementStatusBadge(participants);

      const IconComponent =
        statusBadge.icon === 'CheckCircle'
          ? CheckCircle
          : statusBadge.icon === 'Clock'
            ? Clock
            : Users;

      // Check if any pending participants have payment proof
      const hasPaymentProof = participants.some(
        (p) => p.isPending && p.paymentProofBucket && p.paymentProofObjectKey
      );

      return (
        <div className="text-center">
          <span className={statusBadge.className}>
            <IconComponent className="h-3 w-3 mr-1" />
            {statusBadge.text}
            {hasPaymentProof && (
              <span title="Payment proof available">
                <Receipt className="h-3 w-3 ml-1 text-info" />
              </span>
            )}
          </span>
        </div>
      );
    },
  },
  {
    id: 'actions',
    header: () => {
      return <div className="text-right">{m.expense_col_actions()}</div>;
    },
    cell: () => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground hover:text-muted-foreground mr-2"
          >
            View
          </Button>
          <Button variant="ghost" size="sm" className="text-warning hover:text-warning/80 mr-2">
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive-text hover:text-destructive-text/80"
          >
            Delete
          </Button>
        </div>
      );
    },
  },
];
