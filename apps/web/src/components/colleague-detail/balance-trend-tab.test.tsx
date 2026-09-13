import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BalanceTrendTab } from './balance-trend-tab';

const mockTrendData = [
  { date: '2025-01-01', balance: -100 },
  { date: '2025-02-01', balance: -50 },
  { date: '2025-03-01', balance: -75 },
  { date: '2025-04-01', balance: 0 },
];

describe('BalanceTrendTab', () => {
  it('renders a chart container with accessible label', () => {
    render(<BalanceTrendTab data={mockTrendData} />);
    expect(screen.getByRole('img', { name: /balance trend chart/i })).toBeInTheDocument();
  });

  it('renders data points for each month in the trend data', () => {
    render(<BalanceTrendTab data={mockTrendData} />);
    // Chart should display all 4 data points
    const chart = screen.getByRole('img', { name: /balance trend chart/i });
    expect(chart).toBeInTheDocument();
    // Verify data is rendered as visible text labels for accessibility
    expect(screen.getByText(/Jan 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/Apr 2025/i)).toBeInTheDocument();
  });

  it('renders empty state when no data provided', () => {
    render(<BalanceTrendTab data={[]} />);
    expect(screen.getByText(/no balance history/i)).toBeInTheDocument();
  });

  it('renders x-axis and y-axis labels', () => {
    render(<BalanceTrendTab data={mockTrendData} />);
    expect(screen.getByText(/date/i)).toBeInTheDocument();
    expect(screen.getByText(/balance/i)).toBeInTheDocument();
  });

  it('renders tooltip or data labels showing currency values', () => {
    render(<BalanceTrendTab data={mockTrendData} />);
    // At minimum, the first and last data point values should be visible
    expect(screen.getByText(/-\$100/)).toBeInTheDocument();
    expect(screen.getByText(/\$0/)).toBeInTheDocument();
  });

  it('renders flat trend data without dividing by zero', () => {
    render(
      <BalanceTrendTab
        data={[
          { date: '2025-01-01', balance: 25 },
          { date: '2025-02-01', balance: 25 },
        ]}
      />
    );

    expect(screen.getAllByText(/\$25/)).toHaveLength(2);
  });
});
