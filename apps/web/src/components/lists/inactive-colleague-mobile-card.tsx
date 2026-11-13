import { MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { EnhancedAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { m } from '@/paraglide/messages';
import { CONTAINER_CLASSES, SIZE_CLASSES } from '@/styles/class-constants';
import type { InactiveColleagueWithBalance } from '@/types/colleague';
import { formatCurrency, formatDate, getBalanceColor } from '@/utils/formatters';

interface InactiveColleagueMobileCardProps {
  colleague: InactiveColleagueWithBalance;
  onRestore: (colleague: InactiveColleagueWithBalance) => void;
  onPermanentDelete: (colleague: InactiveColleagueWithBalance) => void;
}

export function InactiveColleagueMobileCard({
  colleague,
  onRestore,
  onPermanentDelete,
}: InactiveColleagueMobileCardProps) {
  return (
    <Card className={`${CONTAINER_CLASSES.CARD_BASE} opacity-80`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <EnhancedAvatar name={colleague.name} size="sm" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-medium text-muted-foreground line-through">
                {colleague.name}
              </span>
              <Badge variant="secondary" className="text-xs shrink-0">
                {m.colleague_badge_inactive()}
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span
                className={`text-sm font-semibold ${getBalanceColor(colleague.currentBalance)}`}
              >
                {formatCurrency(colleague.currentBalance)}
              </span>
              {colleague.deletedAt && (
                <span className="text-xs text-muted-foreground">
                  {m.colleague_col_deactivatedOn()}: {formatDate(colleague.deletedAt)}
                </span>
              )}
            </div>
          </div>

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
                <DropdownMenuSeparator />
                <DropdownMenuItem className="min-h-[44px]" onClick={() => onRestore(colleague)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {m.colleague_actions_restore()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-[44px] text-destructive-text focus:text-destructive-text"
                  onClick={() => onPermanentDelete(colleague)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {m.colleague_actions_deletePermanent()}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
