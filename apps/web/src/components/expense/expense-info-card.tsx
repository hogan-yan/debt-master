import { Calendar, CheckCircle, Clock, CreditCard, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateWithBadge } from '@/components/ui/date-badge';
import { m } from '@/paraglide/messages';
import { formatCurrency, getSettlementStatusBadge } from '@/utils/formatters';

// Date / split / settlement detail row. unslop-ignore: dashboard layout
const DETAIL_GRID_3_GAP6 = 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'; // unslop-ignore

interface ExpenseInfoCardProps {
  /** Expense amount */
  amount: number;
  /** Expense date */
  date: string | Date;
  /** Restaurant information */
  restaurant?:
    | {
        name: string;
        address?: string | null;
      }
    | null
    | undefined;
  /** Expense notes */
  notes?: string | null | undefined;
  /** Expense participants for settlement status */
  participants?:
    | Array<{
        id: number;
        expenseId?: number;
        isPaid: boolean;
        amount: number;
        colleagueId?: number;
        isPending?: boolean;
        hasPartialPayment?: boolean;
        submittedAt?: Date | string | null;
      }>
    | undefined;
}

/**
 * Main expense information card component
 * Displays expense details, restaurant info, and settlement status
 */
export const ExpenseInfoCard = ({
  amount,
  date,
  restaurant,
  notes,
  participants = [],
}: ExpenseInfoCardProps) => {
  const settlementBadge = getSettlementStatusBadge(participants);

  const IconComponent =
    settlementBadge.icon === 'CheckCircle'
      ? CheckCircle
      : settlementBadge.icon === 'Clock'
        ? Clock
        : Users;

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-muted rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl text-foreground">
              {m.expense_detail_lunchExpenseDetails()}
            </CardTitle>
            <p className="text-muted-foreground mt-1">
              {m.expense_detail_sharedMealAt({
                restaurant: restaurant?.name || m.expense_detail_unknownRestaurant(),
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground/80">{formatCurrency(amount)}</div>
            <p className="text-sm text-muted-foreground">{m.expense_form_label_amount()}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className={DETAIL_GRID_3_GAP6}>
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{m.expense_form_label_date()}</p>
              <div className="mt-1">
                <DateWithBadge dateString={typeof date === 'string' ? date : date.toISOString()} />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {m.expense_form_label_restaurant()}
              </p>
              <p className="text-foreground">
                {restaurant?.name || m.expense_detail_unknownRestaurant()}
              </p>
              {restaurant?.address && (
                <p className="text-sm text-muted-foreground">{restaurant.address}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {m.expense_detail_settlementStatus()}
              </p>
              <div className="flex items-center">
                <span className={settlementBadge.className}>
                  <IconComponent className="h-3 w-3 mr-1" />
                  {settlementBadge.text}
                </span>
              </div>
            </div>
          </div>
        </div>

        {notes && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-2">
              {m.expense_form_label_notes()}
            </h3>
            <p className="text-foreground bg-muted/50 p-3 rounded-lg">{notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
