import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DebtDistributionChart } from '../debt-distribution-chart';

vi.mock('@/paraglide/messages', () => ({
  m: {
    dashboard_debtDistribution: () => 'Debt Distribution',
  },
}));

describe('DebtDistributionChart', () => {
  it('renders empty state when no debtors', () => {
    render(<DebtDistributionChart validDebtors={[]} totalDebtOutstanding={0} />);
    expect(screen.getByText('Debt Distribution')).toBeInTheDocument();
  });

  it('renders debtor entries with amounts and percentages', () => {
    const debtors = [
      { id: 1, name: 'Alice', currentBalance: -100 },
      { id: 2, name: 'Bob', currentBalance: -200 },
    ];
    render(<DebtDistributionChart validDebtors={debtors} totalDebtOutstanding={300} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('$100.00 (33%)')).toBeInTheDocument();
    expect(screen.getByText('$200.00 (67%)')).toBeInTheDocument();
  });

  it('shows crown icon for most indebted debtor', () => {
    const debtors = [
      { id: 1, name: 'Alice', currentBalance: -100 },
      { id: 2, name: 'Bob', currentBalance: -500 },
    ];
    render(<DebtDistributionChart validDebtors={debtors} totalDebtOutstanding={600} />);

    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('keeps the first debtor as most indebted when balances tie', () => {
    const debtors = [
      { id: 1, name: 'Alice', currentBalance: -100 },
      { id: 2, name: 'Bob', currentBalance: 100 },
    ];
    const { container } = render(
      <DebtDistributionChart validDebtors={debtors} totalDebtOutstanding={200} />
    );

    expect(container.querySelectorAll('svg').length).toBeGreaterThan(1);
  });

  it('handles zero total debt outstanding', () => {
    const debtors = [{ id: 1, name: 'Alice', currentBalance: -50 }];
    render(<DebtDistributionChart validDebtors={debtors} totalDebtOutstanding={0} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('$50.00 (0%)')).toBeInTheDocument();
  });

  it('limits displayed debtors to top 5', () => {
    const debtors = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Person ${i + 1}`,
      currentBalance: -(i + 1) * 10,
    }));
    render(<DebtDistributionChart validDebtors={debtors} totalDebtOutstanding={550} />);

    const entries = screen.getAllByText(/Person \d/);
    expect(entries.length).toBeLessThanOrEqual(5);
  });
});
