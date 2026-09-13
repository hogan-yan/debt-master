import { Inbox } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { formatCurrency, formatMonthYear } from '@/utils/formatters';

interface TrendDataPoint {
  date: string;
  balance: number;
}

interface BalanceTrendTabProps {
  data: TrendDataPoint[];
}

export function BalanceTrendTab({ data }: BalanceTrendTabProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
          <Inbox className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">{m.colleague_detail_noBalanceHistory()}</p>
      </div>
    );
  }

  const minBalance = Math.min(...data.map((d) => d.balance));
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const range = maxBalance - minBalance || 1;

  return (
    <div className="space-y-4">
      <div
        role="img"
        aria-label={m.colleague_detail_balanceTrendChart()}
        className="relative border border-border rounded-lg p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {m.colleague_detail_balance()}
          </span>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {m.colleague_detail_date()}
          </span>
        </div>

        <div className="flex items-end gap-2 h-40">
          {data.map((point) => {
            const height = Math.max(4, ((point.balance - minBalance) / range) * 100);
            const isNegative = point.balance < 0;
            return (
              <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {formatCurrency(point.balance)}
                </span>
                <div
                  className={`w-full rounded-sm ${
                    isNegative ? 'bg-destructive/60' : 'bg-success/60'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatMonthYear(point.date)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
