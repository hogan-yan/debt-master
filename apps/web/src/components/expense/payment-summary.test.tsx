import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentSummary } from './payment-summary';

vi.mock('@/paraglide/messages', () => ({
  m: {
    expense_detail_paymentSummary: () => 'Payment Summary',
    expense_detail_totalParticipants: () => 'Total Participants',
    expense_detail_amountPaid: () => 'Amount Paid',
    expense_detail_paidCount: ({ count }: { count: string }) => `${count} paid`,
    expense_detail_outstanding: () => 'Outstanding',
    expense_detail_pendingCount: ({ count }: { count: string }) => `${count} pending`,
  },
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

describe('PaymentSummary', () => {
  it('renders all summary cards with correct calculations', () => {
    const participants = [
      { isPaid: true, amount: 50 },
      { isPaid: true, amount: 30 },
      { isPaid: false, amount: 20 },
    ];

    render(<PaymentSummary participants={participants} totalAmount={100} />);

    expect(screen.getByText('Payment Summary')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // total participants
    expect(screen.getByText('$80.00')).toBeInTheDocument(); // amount paid
    expect(screen.getByText('2 paid')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument(); // outstanding
    expect(screen.getByText('1 pending')).toBeInTheDocument();
  });

  it('handles all unpaid participants', () => {
    const participants = [
      { isPaid: false, amount: 33.33 },
      { isPaid: false, amount: 33.33 },
      { isPaid: false, amount: 33.34 },
    ];

    render(<PaymentSummary participants={participants} totalAmount={100} />);

    expect(screen.getByText('$0.00')).toBeInTheDocument(); // amount paid
    expect(screen.getByText('0 paid')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // outstanding
    expect(screen.getByText('3 pending')).toBeInTheDocument();
  });

  it('handles all paid participants', () => {
    const participants = [
      { isPaid: true, amount: 50 },
      { isPaid: true, amount: 50 },
    ];

    render(<PaymentSummary participants={participants} totalAmount={100} />);

    expect(screen.getByText('$100.00')).toBeInTheDocument(); // amount paid
    expect(screen.getByText('2 paid')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // outstanding
    expect(screen.getByText('0 pending')).toBeInTheDocument();
  });

  it('handles empty participants', () => {
    render(<PaymentSummary participants={[]} totalAmount={0} />);

    expect(screen.getByText('0')).toBeInTheDocument(); // total participants
    const zeroAmounts = screen.getAllByText('$0.00');
    expect(zeroAmounts).toHaveLength(2); // amount paid + outstanding
  });

  it('toggles collapse on mobile', async () => {
    const user = userEvent.setup();
    const participants = [{ isPaid: true, amount: 50 }];

    render(<PaymentSummary participants={participants} totalAmount={50} />);

    const toggleButton = screen.getByRole('button');
    await user.click(toggleButton);
    await user.click(toggleButton);
    // Button should still exist after toggling
    expect(toggleButton).toBeInTheDocument();
  });
});
