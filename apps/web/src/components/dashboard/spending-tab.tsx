/**
 * Dashboard spending tab component
 * Displays comprehensive spending analytics and insights
 */

import { Award, DollarSign, TrendingUp, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartColors } from '@/lib/chart-colors';
import { m } from '@/paraglide/messages';
import { formatCurrency } from '@/utils/formatters';

interface SpendingData {
  overview: {
    totalColleagues: number;
    activeColleagues: number;
    totalExpenses: number;
    totalSpending: number;
    averageSpendingPerPerson: number;
  };
}

interface SpendingTrend {
  period: string;
  totalSpending: number;
  expenseCount: number;
  averageExpenseAmount: number;
  uniqueParticipants: number;
}

interface SpendingInsights {
  summary: {
    totalSpending: number;
    averageExpenseAmount: number;
    averageParticipantsPerExpense: number;
    mostExpensiveAmount: number;
    mostExpensiveRestaurant: string;
  };
  restaurantStats: Array<{
    name: string;
    total: number;
    count: number;
  }>;
  dayOfWeekStats: Array<{
    day: string;
    total: number;
    count: number;
  }>;
}

interface SpendingTabProps {
  spendingData: SpendingData;
  spendingTrends: SpendingTrend[];
  spendingInsights: SpendingInsights;
}

/**
 * Truncate text to specified length with ellipsis
 */
const truncateText = (text: string, maxLength = 15): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

/**
 * Dashboard spending tab
 */
export function SpendingTab({ spendingData, spendingTrends, spendingInsights }: SpendingTabProps) {
  const { overview } = spendingData;
  const chartColors = getChartColors();

  // Process restaurant data with truncated names for display
  const restaurantDataWithDisplayNames = spendingInsights.restaurantStats.map((restaurant) => ({
    ...restaurant,
    displayName: truncateText(restaurant.name),
    fullName: restaurant.name,
  }));

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_spending_totalSpending()}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview.totalSpending)}</div>
            <p className="text-xs text-muted-foreground">
              {m.dashboard_spending_acrossExpenses({ count: overview.totalExpenses })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_spending_activeMembers()}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeColleagues}</div>
            <p className="text-xs text-muted-foreground">
              {m.dashboard_spending_ofTotalMembers({ count: overview.totalColleagues })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_spending_avgLunchBill()}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(spendingInsights.summary.averageExpenseAmount)}
            </div>
            <p className="text-xs text-muted-foreground">{m.dashboard_spending_perLunchOuting()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_spending_biggestExpense()}
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(spendingInsights.summary.mostExpensiveAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {spendingInsights.summary.mostExpensiveRestaurant}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spending Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{m.dashboard_spending_trendsTitle()}</CardTitle>
            <CardDescription>{m.dashboard_spending_trendsDesc()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={spendingTrends}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: chartColors.foreground, fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: chartColors.foreground, fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.card,
                      border: `1px solid ${chartColors.border}`,
                      borderRadius: '8px',
                      color: chartColors.foreground,
                      minWidth: '180px',
                      maxWidth: '300px',
                      padding: '12px',
                      wordWrap: 'break-word',
                      whiteSpace: 'normal',
                      lineHeight: '1.4',
                      boxShadow: chartColors.tooltipShadow,
                    }}
                    cursor={{ fill: chartColors.cursorFill }}
                    formatter={(value, name) => [
                      name === 'totalSpending' ? formatCurrency(Number(value)) : value,
                      name === 'totalSpending'
                        ? m.dashboard_spending_totalSpending()
                        : m.dashboard_spending_tooltipExpenseCount(),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalSpending"
                    stroke={chartColors.primary}
                    fill={chartColors.primary}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{m.dashboard_spending_distributionTitle()}</CardTitle>
            <CardDescription>{m.dashboard_spending_distributionDesc()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={restaurantDataWithDisplayNames}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="displayName"
                    tick={{ fill: chartColors.foreground, fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: chartColors.foreground, fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.card,
                      border: `1px solid ${chartColors.border}`,
                      borderRadius: '8px',
                      color: chartColors.foreground,
                      minWidth: '180px',
                      maxWidth: '300px',
                      padding: '12px',
                      wordWrap: 'break-word',
                      whiteSpace: 'normal',
                      lineHeight: '1.4',
                      boxShadow: chartColors.tooltipShadow,
                    }}
                    cursor={{ fill: chartColors.cursorFill }}
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      m.dashboard_spending_totalSpending(),
                    ]}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullName || label;
                    }}
                  />
                  <Bar dataKey="total" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SpendingTab;
