import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionItem } from './transaction-item';
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

describe('TransactionItem', () => {
  const expenseTransaction: Transaction = {
    type: 'expense',
    id: 1,
    amount: 25.5,
    date: new Date().toISOString(),
    description: 'Test Restaurant',
    details: 'Jan 1, 2026',
  };

  const paymentTransaction: Transaction = {
    type: 'payment',
    id: 2,
    amount: 50,
    date: new Date().toISOString(),
    description: 'Cash Payment',
    details: 'Jan 2, 2026',
    notes: 'Weekly settle-up',
  };

  it('renders expense with negative amount', () => {
    render(<TransactionItem transaction={expenseTransaction} />);
    expect(screen.getByText('-$25.50')).toBeInTheDocument();
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('renders payment with positive amount', () => {
    render(<TransactionItem transaction={paymentTransaction} />);
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.getByText('Cash Payment')).toBeInTheDocument();
  });

  it('shows details text', () => {
    render(<TransactionItem transaction={expenseTransaction} />);
    expect(screen.getByText('Jan 1, 2026')).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    render(<TransactionItem transaction={paymentTransaction} />);
    expect(screen.getByText(/Weekly settle-up/)).toBeInTheDocument();
  });

  it('hides notes when absent', () => {
    const { container } = render(<TransactionItem transaction={expenseTransaction} />);
    const notesElements = container.querySelectorAll('em, i, [class*="italic"]');
    expect(notesElements).toHaveLength(0);
  });

  it('renders expense as a link to expense detail page', () => {
    render(<TransactionItem transaction={expenseTransaction} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/expenses/1');
  });

  it('renders payment as a link to payment detail page', () => {
    render(<TransactionItem transaction={paymentTransaction} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/payments/2');
  });

  it('wraps entire transaction content in the link for full-row clickability', () => {
    const { container } = render(<TransactionItem transaction={expenseTransaction} />);
    const link = container.querySelector('a');
    // The link should contain the transaction amount and description
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Test Restaurant');
    expect(link?.textContent).toContain('25.50');
  });

  it('has focus-visible styles for keyboard navigation', () => {
    render(<TransactionItem transaction={expenseTransaction} />);
    const link = screen.getByRole('link');
    expect(link.className).toMatch(/focus-visible:/);
    expect(link.className).toMatch(/focus-visible:ring/);
  });
});
