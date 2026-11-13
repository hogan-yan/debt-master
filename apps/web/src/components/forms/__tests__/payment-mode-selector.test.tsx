/**
 * Tests for PaymentModeSelector component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentModeSelector } from '../payment-mode-selector';

describe('PaymentModeSelector', () => {
  it('renders both prepayment and expense payment options', () => {
    render(<PaymentModeSelector selected="PREPAYMENT" onChange={() => {}} />);
    expect(screen.getByText('Prepayment')).toBeInTheDocument();
    expect(screen.getByText('Expense Payment')).toBeInTheDocument();
  });

  it('highlights the selected mode', () => {
    render(<PaymentModeSelector selected="PREPAYMENT" onChange={() => {}} />);
    const prepaymentButton = screen.getByText('Prepayment').closest('button');
    expect(prepaymentButton).toHaveAttribute('aria-checked', 'true');
    expect(prepaymentButton).toHaveClass('border-primary');
  });

  it('calls onChange with the correct mode when clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PaymentModeSelector selected="PREPAYMENT" onChange={onChange} />);

    await user.click(screen.getByText('Expense Payment'));
    expect(onChange).toHaveBeenCalledWith('EXPENSE_PAYMENT');
  });

  it('shows expense payment as selected when passed', () => {
    render(<PaymentModeSelector selected="EXPENSE_PAYMENT" onChange={() => {}} />);
    const expensePaymentButton = screen.getByText('Expense Payment').closest('button');
    expect(expensePaymentButton).toHaveAttribute('aria-checked', 'true');
    expect(expensePaymentButton).toHaveClass('border-primary');
  });
});
