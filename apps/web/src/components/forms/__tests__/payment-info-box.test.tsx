/**
 * Tests for PaymentInfoBox component
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentInfoBox } from '../payment-info-box';

describe('PaymentInfoBox', () => {
  it('renders prepayment info when mode is PREPAYMENT', () => {
    render(<PaymentInfoBox mode="PREPAYMENT" />);
    expect(screen.getByText('About Prepayments')).toBeInTheDocument();
    expect(screen.getByText(/This payment will be added as credit/)).toBeInTheDocument();
  });

  it('renders expense payment info when mode is EXPENSE_PAYMENT', () => {
    render(<PaymentInfoBox mode="EXPENSE_PAYMENT" />);
    expect(screen.getByText('About Expense Payments')).toBeInTheDocument();
    expect(screen.getByText(/This payment will be applied directly/)).toBeInTheDocument();
  });
});
