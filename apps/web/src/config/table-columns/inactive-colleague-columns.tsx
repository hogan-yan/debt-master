import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { COLLEAGUE_DETAIL, INACTIVE_COLLEAGUE, TABLE_COL } from '@/test/test-ids';
import { InactiveColleagueWithBalance } from '@/types/colleague';
import { formatCurrency, formatDate, getBalanceColor } from '@/utils/formatters';

interface InactiveColleagueTableActionsProps {
  onRestore: (colleague: InactiveColleagueWithBalance) => void;
  onPermanentDelete: (colleague: InactiveColleagueWithBalance) => void;
}

export const createInactiveColleagueColumns = (
  actions: InactiveColleagueTableActionsProps
): ColumnDef<InactiveColleagueWithBalance>[] => [
  {
    accessorKey: 'name',
    size: 280,
    header: () => m.colleague_col_name(),
    cell: ({ row }) => {
      const name = row.original.name;
      return (
        <div className="flex items-center space-x-3 whitespace-nowrap min-w-0">
          <EnhancedAvatar name={name} size="sm" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-muted-foreground line-through truncate">{name}</span>
            <Badge
              variant="secondary"
              className="text-xs shrink-0"
              data-testid={COLLEAGUE_DETAIL.INACTIVE_BADGE}
            >
              {m.colleague_badge_inactive()}
            </Badge>
          </div>
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
      const balance = row.original.currentBalance;
      return (
        <div className={`text-right font-medium ${getBalanceColor(balance)}`}>
          {formatCurrency(balance)}
        </div>
      );
    },
  },
  {
    accessorKey: 'deletedAt',
    size: 140,
    header: () => m.colleague_col_deactivatedOn(),
    cell: ({ row }) => {
      const date = row.original.deletedAt;
      if (!date) return <span className="text-muted-foreground">—</span>;
      return <span>{formatDate(date)}</span>;
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
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-accent"
              data-testid={TABLE_COL.ROW_ACTIONS_BTN}
            >
              <span className="sr-only">{m.colleague_actions_openMenu()}</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{m.colleague_actions_label()}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => actions.onRestore(colleague)}
              data-testid={INACTIVE_COLLEAGUE.RESTORE_COLLEAGUE_MENUITEM}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {m.colleague_actions_restore()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => actions.onPermanentDelete(colleague)}
              className="text-destructive-text focus:text-destructive-text"
              data-testid={INACTIVE_COLLEAGUE.DELETE_PERMANENTLY_MENUITEM}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {m.colleague_actions_deletePermanent()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
