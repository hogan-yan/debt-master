/**
 * Tests for PaymentWarningBanner component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentWarningBanner } from '../payment-warning-banner';

describe('PaymentWarningBanner', () => {
  it('renders warning with payment impact info', () => {
    const impacts = [{ name: 'Jane Smith', currentAmount: 25, paidAmount: 20, currentOwed: 5 }];
    render(
      <PaymentWarningBanner
        paymentImpacts={impacts}
        confirmEdit={false}
        onConfirmChange={() => {}}
      />
    );
    expect(screen.getByText(/Warning: Editing Expense/)).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByLabelText(/I understand/)).toBeInTheDocument();
  });

  it('calls onConfirmChange when checkbox is checked', async () => {
    const onConfirmChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PaymentWarningBanner
        paymentImpacts={null}
        confirmEdit={false}
        onConfirmChange={onConfirmChange}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(onConfirmChange).toHaveBeenCalledWith(true);
  });

  it('renders without payment impacts when none exist', () => {
    const { container } = render(
      <PaymentWarningBanner paymentImpacts={null} confirmEdit={false} onConfirmChange={() => {}} />
    );
    // Should not render impact details section
    expect(container.textContent).not.contains('Owes');
    expect(container.textContent).not.contains('Paid');
  });
});
