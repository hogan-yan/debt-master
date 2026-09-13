import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityTab } from './activity-tab';
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

function makeTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) => ({
    type: (i % 2 === 0 ? 'expense' : 'payment') as 'expense' | 'payment',
    id: i,
    amount: (i + 1) * 10,
    date: new Date().toISOString(),
    description: `Item ${i}`,
    details: 'Jan 15, 2026',
  }));
}

describe('ActivityTab', () => {
  it('renders filter pills (All, Expenses, Payments)', () => {
    render(<ActivityTab transactions={makeTransactions(5)} />);
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expenses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /payments/i })).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<ActivityTab transactions={makeTransactions(5)} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('renders transaction groups', () => {
    render(<ActivityTab transactions={makeTransactions(3)} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows empty state when no transactions', () => {
    render(<ActivityTab transactions={[]} />);
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });

  it('shows Record Payment CTA in empty state when onRecordPayment provided', () => {
    const onRecordPayment = vi.fn();
    render(<ActivityTab transactions={[]} onRecordPayment={onRecordPayment} />);
    expect(screen.getByRole('button', { name: /record payment/i })).toBeInTheDocument();
  });

  it('calls onRecordPayment when CTA clicked', async () => {
    const onRecordPayment = vi.fn();
    render(<ActivityTab transactions={[]} onRecordPayment={onRecordPayment} />);
    const button = screen.getByRole('button', { name: /record payment/i });
    await userEvent.click(button);
    expect(onRecordPayment).toHaveBeenCalledTimes(1);
  });

  it('does not show CTA when onRecordPayment is not provided', () => {
    render(<ActivityTab transactions={[]} />);
    expect(screen.queryByRole('button', { name: /record payment/i })).not.toBeInTheDocument();
  });

  it('shows filtered count in pills', () => {
    render(<ActivityTab transactions={makeTransactions(6)} />);
    expect(screen.getByText(/all.*6/i)).toBeInTheDocument();
  });

  it('filters to expenses only when expense pill clicked', async () => {
    const user = userEvent.setup();
    render(<ActivityTab transactions={makeTransactions(4)} />);
    const expenseBtn = screen.getByRole('button', { name: /expenses/i });
    await user.click(expenseBtn);
    expect(expenseBtn).toHaveClass('bg-primary');
  });

  it('filters to payments only when payment pill clicked', async () => {
    const user = userEvent.setup();
    render(<ActivityTab transactions={makeTransactions(4)} />);
    const paymentBtn = screen.getByRole('button', { name: /payments/i });
    await user.click(paymentBtn);
    expect(paymentBtn).toHaveClass('bg-primary');
  });

  it('returns to all transactions when all pill clicked', async () => {
    const user = userEvent.setup();
    render(<ActivityTab transactions={makeTransactions(4)} />);
    await user.click(screen.getByRole('button', { name: /expenses/i }));

    const allButton = screen.getByRole('button', { name: /all/i });
    await user.click(allButton);

    expect(allButton).toHaveClass('bg-primary');
  });

  it('shows no match description when search yields no results', async () => {
    const user = userEvent.setup();
    render(<ActivityTab transactions={makeTransactions(4)} />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'zzzzzzzz');
    expect(screen.getByText(/No transactions found/i)).toBeInTheDocument();
  });

  it('shows pagination when many transactions', () => {
    render(<ActivityTab transactions={makeTransactions(30)} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('navigates to next page when next button clicked', async () => {
    const user = userEvent.setup();
    render(<ActivityTab transactions={makeTransactions(30)} />);
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);
    expect(screen.getByText(/page 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(/page 1/i)).toBeInTheDocument();
  });
});
