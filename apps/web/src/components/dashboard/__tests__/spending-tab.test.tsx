import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpendingTab } from '../spending-tab';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => () => String(key),
    }
  ),
}));

vi.mock('@/lib/chart-colors', () => ({
  getChartColors: () => ({
    foreground: '#111',
    card: '#fff',
    border: '#ddd',
    tooltipShadow: 'none',
    cursorFill: '#eee',
    primary: '#09f',
  }),
}));

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({
    formatter,
    labelFormatter,
  }: {
    formatter?: (value: unknown, name: string) => unknown;
    labelFormatter?: (
      label: string,
      payload?: Array<{ payload?: { fullName?: string } }>
    ) => unknown;
  }) => {
    formatter?.(100, 'totalSpending');
    formatter?.(2, 'expenseCount');
    labelFormatter?.('Short', [{ payload: { fullName: 'Full restaurant name' } }]);
    labelFormatter?.('Fallback');
    return null;
  },
  XAxis: () => null,
  YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => {
    tickFormatter?.(100);
    return null;
  },
}));

describe('SpendingTab', () => {
  it('renders overview values and chart data', () => {
    render(
      <SpendingTab
        spendingData={{
          overview: {
            totalColleagues: 4,
            activeColleagues: 3,
            totalExpenses: 2,
            totalSpending: 100,
            averageSpendingPerPerson: 25,
          },
        }}
        spendingTrends={[
          {
            period: 'Jan',
            totalSpending: 100,
            expenseCount: 2,
            averageExpenseAmount: 50,
            uniqueParticipants: 3,
          },
        ]}
        spendingInsights={{
          summary: {
            totalSpending: 100,
            averageExpenseAmount: 50,
            averageParticipantsPerExpense: 2,
            mostExpensiveAmount: 75,
            mostExpensiveRestaurant: 'Very Long Restaurant Name',
          },
          restaurantStats: [
            { name: 'Very Long Restaurant Name', total: 100, count: 2 },
            { name: 'Cafe', total: 50, count: 1 },
          ],
          dayOfWeekStats: [],
        }}
      />
    );

    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    expect(screen.getByText('Very Long Restaurant Name')).toBeInTheDocument();
  });
});
