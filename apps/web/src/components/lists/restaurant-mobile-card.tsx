import { Link } from '@tanstack/react-router';
import { MoreHorizontal } from 'lucide-react';
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
import { getCuisineLabel } from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { CONTAINER_CLASSES, SIZE_CLASSES } from '@/styles/class-constants';
import type { Restaurant } from '@/types';
import { formatCurrency } from '@/utils/formatters';

// Cuisine pill. unslop-ignore
const CUISINE_PILL_CLASS_SM =
  'inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'; // unslop-ignore

export function restaurantStatOrZero(value: number | null | undefined): number {
  return value ?? 0;
}

type RestaurantAction = 'view' | 'edit' | 'delete';

interface RestaurantMobileCardProps {
  restaurant: Restaurant;
  isAdmin: boolean;
  onAction: (action: RestaurantAction, restaurant: Restaurant) => void;
}

export function RestaurantMobileCard({ restaurant, isAdmin, onAction }: RestaurantMobileCardProps) {
  const cuisine = restaurant.cuisine;
  const totalExpenses = restaurantStatOrZero(restaurant.totalExpenses);
  const totalAmount = restaurantStatOrZero(restaurant.totalAmount);

  return (
    <Card className={CONTAINER_CLASSES.CARD_BASE}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <Link
              to="/restaurants/$id/"
              params={{ id: restaurant.id.toString() }}
              className="text-base font-medium text-foreground block leading-snug"
            >
              {restaurant.name}
            </Link>

            {restaurant.address && (
              <p className="text-sm text-muted-foreground mt-1 truncate">{restaurant.address}</p>
            )}

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {cuisine && <span className={CUISINE_PILL_CLASS_SM}>{getCuisineLabel(cuisine)}</span>}
              <span className="text-sm text-muted-foreground">
                {totalExpenses}{' '}
                {totalExpenses === 1
                  ? m.restaurant_detail_expense()
                  : m.restaurant_detail_expenses()}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={SIZE_CLASSES.BUTTON_TOUCH}
                  aria-label={m.restaurant_actions_openMenu()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{m.restaurant_actions_label()}</DropdownMenuLabel>
                <DropdownMenuItem
                  className="min-h-[44px]"
                  onClick={() => onAction('view', restaurant)}
                >
                  {m.restaurant_actions_viewDetails()}
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="min-h-[44px]"
                      onClick={() => onAction('edit', restaurant)}
                    >
                      {m.restaurant_actions_edit()}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-[44px] text-destructive-text focus:text-destructive-text"
                      onClick={() => onAction('delete', restaurant)}
                    >
                      {m.restaurant_actions_delete()}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
