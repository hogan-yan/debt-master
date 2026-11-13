/**
 * Table column definitions for colleagues
 */

import { Link } from '@tanstack/react-router';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { m } from '@/paraglide/messages';
import { Colleague, ColleagueWithBalance } from '@/types';
import { formatCurrency, getBalanceColor, getBalanceStatus } from '@/utils/formatters';

interface ColleagueTableActionsProps {
  colleague: ColleagueWithBalance;
  onEdit: (colleague: ColleagueWithBalance) => void;
  onDelete: (colleague: ColleagueWithBalance) => void;
  isAdmin?: boolean;
}

export const createColleagueColumns = (
  actions: Omit<ColleagueTableActionsProps, 'colleague'> & { isAdmin?: boolean }
): ColumnDef<ColleagueWithBalance>[] => [
  {
    accessorKey: 'name',
    size: 280,
    header: () => m.colleague_col_name(),
    cell: ({ row }) => {
      const name = row.original.name;
      return (
        <div className="flex items-center space-x-3 whitespace-nowrap min-w-0">
          <EnhancedAvatar name={name} size="sm" />
          <Link
            to="/colleagues/$colleagueId/"
            params={{ colleagueId: row.original.id.toString() }}
            className="font-medium hover:underline truncate"
          >
            {name}
          </Link>
        </div>
      );
    },
  },
  {
    accessorKey: 'currentBalance',
    size: 120,
    header: () => <div className="text-right">{m.colleague_col_balance()}</div>,
    enableSorting: false,
    cell: ({ row }) => {
      const balance = Number.parseFloat(row.getValue('currentBalance'));
      return (
        <div className={`text-right font-medium ${getBalanceColor(balance)}`}>
          {formatCurrency(balance)}
        </div>
      );
    },
  },
  {
    accessorKey: 'currentBalance',
    id: 'status',
    size: 110,
    header: () => m.colleague_col_status(),
    enableSorting: false,
    cell: ({ row }) => {
      const balance = Number.parseFloat(row.getValue('currentBalance'));
      const status = getBalanceStatus(balance);

      return <span className={status.className}>{status.text}</span>;
    },
  },
  {
    id: 'actions',
    size: 60,
    header: () => m.colleague_col_actions(),
    enableHiding: false,
    cell: ({ row }) => {
      const colleague = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-accent">
              <span className="sr-only">{m.colleague_actions_openMenu()}</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{m.colleague_actions_label()}</DropdownMenuLabel>
            {actions.isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => actions.onEdit?.(colleague)}>
                  {m.colleague_actions_edit()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => actions.onDelete?.(colleague)}
                  className="text-destructive-text focus:text-destructive-text"
                >
                  {m.colleague_actions_deactivate()}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// Default columns for backward compatibility
export const colleagueColumns: ColumnDef<Colleague>[] = [
  {
    accessorKey: 'name',
    size: 280,
    header: () => m.colleague_col_name(),
    cell: ({ row }) => {
      const name = row.original.name;
      return (
        <div className="flex items-center space-x-3 whitespace-nowrap min-w-0">
          <EnhancedAvatar name={name} size="sm" />
          <span className="font-medium truncate">{name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'currentBalance',
    size: 120,
    header: () => m.colleague_col_balance(),
    enableSorting: false,
    cell: ({ row }) => {
      const balance = Number.parseFloat(row.getValue('currentBalance'));
      return (
        <div className={`text-right font-medium ${getBalanceColor(balance)}`}>
          {formatCurrency(balance)}
        </div>
      );
    },
  },
  {
    accessorKey: 'currentBalance',
    id: 'status',
    size: 110,
    header: () => m.colleague_col_status(),
    enableSorting: false,
    cell: ({ row }) => {
      const balance = Number.parseFloat(row.getValue('currentBalance'));
      const status = getBalanceStatus(balance);

      return <span className={status.className}>{status.text}</span>;
    },
  },
  {
    id: 'actions',
    size: 60,
    header: () => m.colleague_col_actions(),
    cell: ({ row }) => {
      const colleague = row.original;

      return (
        <div className="text-right space-x-2">
          <Link
            to="/colleagues/$colleagueId/"
            params={{ colleagueId: colleague.id.toString() }}
            className="text-foreground hover:text-muted-foreground text-sm"
          >
            {m.colleague_viewDetails()}
          </Link>
        </div>
      );
    },
  },
];
