import { Link } from '@tanstack/react-router';
import { MoreHorizontal } from 'lucide-react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { m } from '@/paraglide/messages';
import { CONTAINER_CLASSES, SIZE_CLASSES } from '@/styles/class-constants';
import type { ColleagueWithBalance } from '@/types';
import { formatCurrency, getBalanceColor, getBalanceStatus } from '@/utils/formatters';

type ColleagueAction = 'edit' | 'delete';

interface ColleagueMobileCardProps {
  colleague: ColleagueWithBalance;
  isAdmin: boolean;
  onAction: (action: ColleagueAction, colleague: ColleagueWithBalance) => void;
}

export function ColleagueMobileCard({ colleague, isAdmin, onAction }: ColleagueMobileCardProps) {
  const status = getBalanceStatus(colleague.currentBalance);

  return (
    <Card className={CONTAINER_CLASSES.CARD_BASE}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <EnhancedAvatar name={colleague.name} size="sm" />
          </div>

          <div className="flex-1 min-w-0">
            <Link
              to="/colleagues/$colleagueId/"
              params={{ colleagueId: colleague.id.toString() }}
              className="text-base font-medium text-foreground block leading-snug"
            >
              {colleague.name}
            </Link>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={`text-sm font-semibold ${getBalanceColor(colleague.currentBalance)}`}
              >
                {formatCurrency(colleague.currentBalance)}
              </span>
              <span className={status.className}>{status.text}</span>
            </div>
          </div>

          {isAdmin && (
            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={SIZE_CLASSES.BUTTON_TOUCH}
                    aria-label={m.colleague_actions_openMenu()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{m.colleague_actions_label()}</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="min-h-[44px]"
                    onClick={() => onAction('edit', colleague)}
                  >
                    {m.colleague_actions_edit()}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-[44px] text-destructive-text focus:text-destructive-text"
                    onClick={() => onAction('delete', colleague)}
                  >
                    {m.colleague_actions_deactivate()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
