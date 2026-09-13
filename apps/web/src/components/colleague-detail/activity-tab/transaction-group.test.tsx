import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionGroup } from './transaction-group';
import type { Transaction } from './use-transaction-filter';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('TransactionGroup', () => {
  const transactions: Transaction[] = [
    {
      type: 'expense',
      id: 1,
      amount: 25,
      date: new Date().toISOString(),
      description: 'Lunch',
      details: 'Jan 15, 2026',
    },
    {
      type: 'payment',
      id: 2,
      amount: 50,
      date: new Date().toISOString(),
      description: 'Cash',
      details: 'Jan 15, 2026',
    },
  ];

  it('renders date label as header', () => {
    render(<TransactionGroup label="Today" transactions={transactions} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders all transactions in group', () => {
    render(<TransactionGroup label="Today" transactions={transactions} />);
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
  });

  it('renders empty group with header only', () => {
    const { container } = render(<TransactionGroup label="Yesterday" transactions={[]} />);
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(container.querySelectorAll('li, [data-transaction]')).toHaveLength(0);
  });
});
