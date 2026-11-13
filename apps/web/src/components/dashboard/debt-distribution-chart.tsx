/**
 * Debt distribution chart component
 * Shows debt breakdown across team members
 */

import { Crown, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { m } from '@/paraglide/messages';
import { formatCurrency } from '@/utils/formatters';

interface Debtor {
  id: number;
  name: string;
  currentBalance: number;
}

interface DebtDistributionChartProps {
  validDebtors: Debtor[];
  totalDebtOutstanding: number;
}

/**
 * Debt distribution chart component
 */
export function DebtDistributionChart({
  validDebtors,
  totalDebtOutstanding,
}: DebtDistributionChartProps) {
  const mostIndebted =
    validDebtors.length > 0
      ? validDebtors.reduce((prev, current) =>
          Math.abs(current.currentBalance) > Math.abs(prev.currentBalance) ? current : prev
        )
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-foreground">
          <PieChart className="h-5 w-5" />
          <span>{m.dashboard_debtDistribution()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {validDebtors.slice(0, 5).map((debtor) => {
            const debtAmount = Math.abs(debtor.currentBalance);
            const percentage =
              totalDebtOutstanding > 0 ? (debtAmount / totalDebtOutstanding) * 100 : 0;
            return (
              <div key={debtor.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center font-medium text-foreground">
                    {mostIndebted?.id === debtor.id && (
                      <Crown className="mr-2 h-4 w-4 text-warning" />
                    )}
                    {debtor.name}
                  </span>
                  <span className="text-muted-foreground">
                    {formatCurrency(debtAmount)} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary/70 h-2 rounded-full transition-[width]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
