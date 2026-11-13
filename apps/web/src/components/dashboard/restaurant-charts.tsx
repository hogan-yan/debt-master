/**
 * Restaurant charts component
 * Displays restaurant popularity and price analysis charts
 */

import { BarChart3, DollarSign } from 'lucide-react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartColors } from '@/lib/chart-colors';
import { m } from '@/paraglide/messages';

export function formatChartCurrencyTick(value: number | string): string {
  return `$${value}`;
}

interface DebtOverview {
  totalLunches: number;
  averageLunchCost: number;
  favoriteSpot: {
    name: string;
    visits: number;
  };
  /**
   * Average cost per person (total spent divided by total participants)
   */
  averageCostPerPerson: number;
}

interface RestaurantChartData {
  popularityData: Array<{
    name: string;
    fullName: string;
    visits: number;
    percentage: string;
  }>;
  priceData: Array<{
    name: string;
    fullName: string;
    avgCost: number;
    avgCostPerPerson: number;
    visits: number;
    totalSpent: number;
  }>;
  totalRestaurants: number;
  totalExpenses: number;
}

interface RestaurantChartsProps {
  debtOverview: DebtOverview;
  restaurantChartData: RestaurantChartData;
}

/**
 * Truncate text to specified length with ellipsis
 */
export const truncateText = (text: string, maxLength = 15): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

export const popularityTooltipFormatter = (
  value: ValueType | undefined,
  _name: NameType | undefined,
  item: Payload
): [ReactNode, ReactNode] => [
  m.dashboard_restaurant_visitsTooltip({
    value: String(value ?? 0),
    percentage: String(item.payload?.percentage || '0'),
  }),
  m.dashboard_restaurant_visitsLabel(),
];

export const priceTooltipFormatter = (
  value: ValueType | undefined,
  _name: NameType | undefined,
  item: Payload
): [ReactNode, ReactNode] => [
  m.dashboard_restaurant_costTooltip({
    value: Number(value ?? 0).toFixed(2),
    visits: String(item.payload?.visits || 0),
  }),
  m.dashboard_summary_avgCostPerPerson(),
];

export const tooltipLabelFormatter = (
  label: ReactNode,
  payload: ReadonlyArray<Payload>
): ReactNode => {
  const data = payload[0]?.payload;
  return data?.fullName || label;
};

/**
 * Restaurant charts component
 */
export function RestaurantCharts({
  debtOverview: _debtOverview,
  restaurantChartData,
}: RestaurantChartsProps) {
  const chartColors = getChartColors();
  // Use real restaurant data instead of dummy data
  const popularityData =
    restaurantChartData.popularityData.length > 0
      ? restaurantChartData.popularityData.map((item) => ({
          ...item,
          displayName: truncateText(item.name),
        }))
      : [
          {
            name: 'No Data',
            fullName: 'No restaurant data available',
            visits: 0,
            percentage: '0',
            displayName: 'No Data',
          },
        ];

  const priceData =
    restaurantChartData.priceData.length > 0
      ? restaurantChartData.priceData.map((item) => ({
          ...item,
          displayName: truncateText(item.name),
        }))
      : [
          {
            name: 'No Data',
            fullName: 'No restaurant data available',
            avgCost: 0,
            avgCostPerPerson: 0,
            visits: 0,
            totalSpent: 0,
            displayName: 'No Data',
          },
        ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Restaurant Popularity Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <BarChart3 className="h-5 w-5" />
            <span>{m.dashboard_restaurant_popularity()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={popularityData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis
                dataKey="displayName"
                tick={{ fill: chartColors.foreground, fontSize: 11 }}
                axisLine={{ stroke: chartColors.foreground }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis
                tick={{ fill: chartColors.foreground, fontSize: 12 }}
                axisLine={{ stroke: chartColors.foreground }}
              />
              <Tooltip
                allowEscapeViewBox={{ x: false, y: false }}
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
                wrapperStyle={{
                  outline: 'none',
                  zIndex: 1000,
                  pointerEvents: 'none',
                }}
                cursor={{ fill: chartColors.cursorFill }}
                formatter={popularityTooltipFormatter}
                labelFormatter={tooltipLabelFormatter}
              />
              <Bar dataKey="visits" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Restaurant Price Analysis Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <DollarSign className="h-5 w-5" />
            <span>{m.dashboard_restaurant_costPerPerson()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={priceData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} />
              <XAxis
                dataKey="displayName"
                tick={{ fill: chartColors.foreground, fontSize: 11 }}
                axisLine={{ stroke: chartColors.foreground }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis
                tick={{ fill: chartColors.foreground, fontSize: 12 }}
                axisLine={{ stroke: chartColors.foreground }}
                tickFormatter={formatChartCurrencyTick}
              />
              <Tooltip
                allowEscapeViewBox={{ x: false, y: false }}
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
                wrapperStyle={{
                  outline: 'none',
                  zIndex: 1000,
                  pointerEvents: 'none',
                }}
                cursor={{ fill: chartColors.cursorFill }}
                formatter={priceTooltipFormatter}
                labelFormatter={tooltipLabelFormatter}
              />
              <Bar
                dataKey="avgCostPerPerson"
                fill={chartColors.mutedForeground}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
