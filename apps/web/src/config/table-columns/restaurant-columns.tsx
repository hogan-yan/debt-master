/**
 * Restaurant table column definitions
 */

import { Link } from '@tanstack/react-router';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { RESTAURANT, TABLE_COL } from '@/test/test-ids';
import { Restaurant } from '@/types';
import { formatCurrency } from '@/utils/formatters';

// Cuisine pill in the table cell. unslop-ignore
const CUISINE_PILL_CLASS_SM =
  'inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'; // unslop-ignore

interface RestaurantTableActionsProps {
  onView: (restaurant: Restaurant) => void;
  onEdit: (restaurant: Restaurant) => void;
  onDelete: (restaurant: Restaurant) => void;
  isAdmin?: boolean;
}

export const createRestaurantColumns = (
  actions: RestaurantTableActionsProps
): ColumnDef<Restaurant>[] => [
  {
    accessorKey: 'name',
    size: 200,
    header: () => m.restaurant_detail_label_name(),
    cell: ({ row }) => {
      const restaurant = row.original;
      return (
        <Link
          to="/restaurants/$id/"
          params={{ id: restaurant.id.toString() }}
          className="font-medium hover:underline"
        >
          {row.getValue('name')}
        </Link>
      );
    },
  },
  {
    accessorKey: 'address',
    size: 280,
    header: () => m.restaurant_detail_label_address(),
    cell: ({ row }) => {
      const address = row.original.address;
      return <div className="truncate">{address || m.restaurant_detail_noAddress()}</div>;
    },
  },
  {
    accessorKey: 'cuisine',
    size: 120,
    header: () => (
      <span data-testid={RESTAURANT.CUISINE_COL}>{m.restaurant_detail_label_cuisine()}</span>
    ),
    cell: ({ row }) => {
      const cuisine = row.original.cuisine;
      if (!cuisine) return <span className="text-muted-foreground">&mdash;</span>;
      return (
        <span className={CUISINE_PILL_CLASS_SM} data-testid={RESTAURANT.CUISINE_BADGE}>
          {getCuisineLabel(cuisine)}
        </span>
      );
    },
  },
  {
    accessorKey: 'totalExpenses',
    size: 100,
    header: () => <div className="text-right">{m.restaurant_col_expenses()}</div>,
    enableSorting: false,
    cell: ({ row }) => {
      const totalExpenses = row.original.totalExpenses || 0;
      return <div className="text-right">{totalExpenses}</div>;
    },
  },
  {
    accessorKey: 'totalAmount',
    size: 120,
    header: () => <div className="text-right">{m.restaurant_col_totalAmount()}</div>,
    enableSorting: false,
    cell: ({ row }) => {
      const totalAmount = row.original.totalAmount || 0;
      return <div className="text-right">{formatCurrency(totalAmount)}</div>;
    },
  },
  {
    id: 'actions',
    size: 60,
    header: () => m.restaurant_col_actions(),
    enableHiding: false,
    cell: ({ row }) => {
      const restaurant = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 cursor-default hover:bg-accent"
              data-testid={TABLE_COL.ROW_ACTIONS_BTN}
            >
              <span className="sr-only">{m.restaurant_actions_openMenu()}</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{m.restaurant_actions_label()}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => actions.onView(restaurant)}
              data-testid={RESTAURANT.VIEW_DETAILS_MENUITEM}
            >
              {m.restaurant_actions_viewDetails()}
            </DropdownMenuItem>
            {actions.isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => actions.onEdit(restaurant)}
                  data-testid={RESTAURANT.EDIT_RESTAURANT_MENUITEM}
                >
                  {m.restaurant_actions_edit()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => actions.onDelete(restaurant)}
                  className="text-destructive-text focus:text-destructive-text"
                >
                  {m.restaurant_actions_delete()}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
