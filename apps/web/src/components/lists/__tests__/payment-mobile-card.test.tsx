/**
 * Tests for PaymentMobileCard component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentMobileCard, type PaymentMobileCardData } from '../payment-mobile-card';

function createPayment(overrides?: Partial<PaymentMobileCardData>): PaymentMobileCardData {
  return {
    id: 1,
    colleagueName: 'Jane Smith',
    amount: 25.0,
    paymentType: 'PAYME',
    date: '2024-06-15T00:00:00Z',
    isApproved: true,
    expenseName: null,
    expenseId: null,
    restaurantName: null,
    hasProof: false,
    applications: [],
    createdBy: 'ADMIN',
    ...overrides,
  };
}

describe('PaymentMobileCard', () => {
  it('renders payment amount and colleague name', () => {
    render(<PaymentMobileCard payment={createPayment()} onAction={() => {}} />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    // Pure prepayment: amount appears in primary line + "Available as Credit" section
    const amounts = screen.getAllByText('$25.00');
    expect(amounts.length).toBeGreaterThanOrEqual(2);
  });

  it('shows prepayment badge when no expense', () => {
    render(<PaymentMobileCard payment={createPayment()} onAction={() => {}} />);
    expect(screen.getByText('Prepayment')).toBeInTheDocument();
  });

  it('shows expense payment badge when expense exists', () => {
    render(
      <PaymentMobileCard
        payment={createPayment({ expenseName: 'Lunch Place', applications: [{ amount: 25 }] })}
        onAction={() => {}}
      />
    );
    expect(screen.getByText('Expense Payment')).toBeInTheDocument();
  });

  it('shows credit indicator when amount exceeds applied', () => {
    render(
      <PaymentMobileCard
        payment={createPayment({ amount: 50, applications: [{ amount: 20 }] })}
        onAction={() => {}}
      />
    );
    expect(screen.getByText('$30.00 credit')).toBeInTheDocument();
  });

  it('shows full credit for pure prepayment', () => {
    render(<PaymentMobileCard payment={createPayment({ amount: 30 })} onAction={() => {}} />);
    expect(screen.getByText('Full credit')).toBeInTheDocument();
  });

  it('treats omitted applications as a prepayment', () => {
    render(
      <PaymentMobileCard
        payment={createPayment({ applications: undefined, restaurantName: 'Cafe' })}
        onAction={() => {}}
      />
    );

    expect(screen.getByText('Prepayment')).toBeInTheDocument();
    expect(screen.getByText('Cafe')).toBeInTheDocument();
  });

  it('calls onAction with the right menu action', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <PaymentMobileCard
        payment={createPayment({ expenseName: 'Lunch Place', expenseId: 5, hasProof: true })}
        onAction={onAction}
      />
    );

    const actionsButton = screen.getByLabelText('More actions');
    await user.click(actionsButton);

    await user.click(screen.getByText('View Payment Proof'));
    expect(onAction).toHaveBeenCalledWith('viewProof', expect.objectContaining({ hasProof: true }));

    await user.click(actionsButton);
    await user.click(screen.getByText('View Related Expense'));
    expect(onAction).toHaveBeenCalledWith('goToExpense', expect.objectContaining({ expenseId: 5 }));

    await user.click(actionsButton);
    await user.click(screen.getByText('Edit'));
    expect(onAction).toHaveBeenCalledWith('edit', expect.objectContaining({}));

    await user.click(actionsButton);
    await user.click(screen.getByText('Delete'));
    expect(onAction).toHaveBeenCalledWith('delete', expect.objectContaining({}));
  });

  it('shows applications summary line when applications exist', () => {
    render(
      <PaymentMobileCard
        payment={createPayment({
          amount: 100,
          applications: [
            { amount: 30, expenseName: 'Place A', expenseId: 1 },
            { amount: 20, expenseName: 'Place B', expenseId: 2 },
          ],
        })}
        onAction={() => {}}
      />
    );
    expect(screen.getByText(/2 expenses/)).toBeInTheDocument();
    expect(screen.getByText(/\$50\.00 applied/)).toBeInTheDocument();
  });

  it('expands applications on click', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PaymentMobileCard
        payment={createPayment({
          amount: 100,
          applications: [
            { amount: 30, expenseName: 'Place A', expenseId: 1 },
            { amount: 20, expenseName: 'Place B', expenseId: 2 },
          ],
        })}
        onAction={() => {}}
      />
    );

    // Application details are in DOM but visually collapsed (max-h-0 opacity-0)
    const expandContainer = container.querySelector('[class*="max-h-0"]');
    expect(expandContainer).toBeInTheDocument();

    // Click expand toggle
    await user.click(screen.getByText(/2 expenses/));

    // Container should now be expanded (max-h-96)
    const expandedContainer = container.querySelector('[class*="max-h-96"]');
    expect(expandedContainer).toBeInTheDocument();

    // Details are now visible
    expect(screen.getByText('Place A')).toBeInTheDocument();
    expect(screen.getByText('Place B')).toBeInTheDocument();
    expect(screen.getByText('Total Applied:')).toBeInTheDocument();
  });

  it('does not navigate when an application has a name but no expense id', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <PaymentMobileCard
        payment={createPayment({
          applications: [{ amount: 30, expenseName: 'Unlinked expense' }],
        })}
        onAction={onAction}
      />
    );

    await user.click(screen.getByText(/1 expense/));
    await user.click(screen.getByText('Unlinked expense'));

    expect(onAction).not.toHaveBeenCalled();
  });

  it('navigates to a specific expense from an application', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const payment = createPayment({
      applications: [{ amount: 30, expenseName: 'Linked expense', expenseId: 99 }],
    });
    render(<PaymentMobileCard payment={payment} onAction={onAction} />);

    await user.click(screen.getByText(/1 expense/));
    await user.click(screen.getByText('Linked expense'));

    expect(onAction).toHaveBeenCalledWith('goToSpecificExpense', payment, { expenseId: 99 });
  });

  it('shows status dot for approved payment', () => {
    render(<PaymentMobileCard payment={createPayment({ isApproved: true })} onAction={() => {}} />);
    const dot = screen.getByLabelText('Approved');
    expect(dot).toBeInTheDocument();
    expect(dot.className).toContain('bg-success');
  });

  it('shows status dot for pending payment', () => {
    render(
      <PaymentMobileCard payment={createPayment({ isApproved: false })} onAction={() => {}} />
    );
    const dot = screen.getByLabelText('Pending');
    expect(dot).toBeInTheDocument();
    expect(dot.className).toContain('bg-warning');
  });

  it('renders card with shadow styling', () => {
    const { container } = render(
      <PaymentMobileCard payment={createPayment({ paymentType: 'CASH' })} onAction={() => {}} />
    );
    const card = container.querySelector('[class*="shadow-sm"]');
    expect(card).toBeInTheDocument();
  });

  it('renders pending status dot with warning color', () => {
    render(
      <PaymentMobileCard payment={createPayment({ isApproved: false })} onAction={() => {}} />
    );
    const dot = screen.getByLabelText('Pending');
    expect(dot.className).toContain('bg-warning');
  });

  it('shows admin indicator in secondary details', () => {
    render(
      <PaymentMobileCard payment={createPayment({ createdBy: 'ADMIN' })} onAction={() => {}} />
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows auto indicator for system auto payments', () => {
    render(
      <PaymentMobileCard
        payment={createPayment({ createdBy: 'SYSTEM_AUTO_PAYMENT' })}
        onAction={() => {}}
      />
    );
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('renders plain date without tooltip components', () => {
    render(<PaymentMobileCard payment={createPayment()} onAction={() => {}} />);
    expect(screen.getByText('Jun 15, 2024')).toBeInTheDocument();
  });

  it('shows proof icon when hasProof is true', () => {
    const { container } = render(
      <PaymentMobileCard payment={createPayment({ hasProof: true })} onAction={() => {}} />
    );
    const proofIcon = container.querySelector('svg.h-3.w-3');
    expect(proofIcon).toBeInTheDocument();
  });
});
