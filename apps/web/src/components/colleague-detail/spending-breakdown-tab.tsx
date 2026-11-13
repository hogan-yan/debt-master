import { Inbox } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { formatCurrency, formatMonthYear } from '@/utils/formatters';

interface RestaurantBreakdown {
  restaurant: string;
  totalSpent: number;
  visitCount: number;
}

interface MonthlyBreakdown {
  month: string;
  totalSpent: number;
}

interface SpendingBreakdownTabProps {
  restaurantBreakdown: RestaurantBreakdown[];
  monthlyBreakdown: MonthlyBreakdown[];
}

export function SpendingBreakdownTab({
  restaurantBreakdown,
  monthlyBreakdown,
}: SpendingBreakdownTabProps) {
  if (restaurantBreakdown.length === 0 && monthlyBreakdown.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
          <Inbox className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">{m.colleague_detail_noSpendingData()}</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {m.colleague_detail_byRestaurant()}
        </h3>
        <div className="space-y-2">
          {restaurantBreakdown.map((item) => (
            <div
              key={item.restaurant}
              className="flex items-center justify-between p-3 border border-border rounded-lg"
            >
              <div>
                <p className="font-medium text-foreground">{item.restaurant}</p>
                <p className="text-sm text-muted-foreground">
                  {item.visitCount}{' '}
                  {item.visitCount !== 1 ? m.colleague_detail_visits() : m.colleague_detail_visit()}
                </p>
              </div>
              <span className="font-semibold text-destructive-text">
                {formatCurrency(item.totalSpent)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {m.colleague_detail_monthlySpending()}
        </h3>
        <div className="space-y-2">
          {monthlyBreakdown.map((item) => (
            <div
              key={item.month}
              className="flex items-center justify-between p-3 border border-border rounded-lg"
            >
              <p className="font-medium text-foreground">{formatMonthYear(item.month)}</p>
              <span className="font-semibold text-destructive-text">
                {formatCurrency(item.totalSpent)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
