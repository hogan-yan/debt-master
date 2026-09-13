import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseEditWarningModal } from './expense-edit-warning-modal';

vi.mock('@/paraglide/messages', () => ({
  m: {
    expense_edit_warning_title: () => 'Warning: Pending Claims',
    expense_edit_warning_currentExpense: () => 'Current',
    expense_edit_warning_newExpense: () => 'New',
    expense_edit_warning_increase: () => 'Increase',
    expense_edit_warning_decrease: () => 'Decrease',
    expense_edit_warning_pendingClaims: ({ count }: { count: number }) => `${count} pending claims`,
    expense_edit_warning_claimed: () => 'Claimed',
    expense_edit_warning_proofAttached: () => 'Proof attached',
    expense_edit_warning_totalClaimed: () => 'Total Claimed',
    expense_edit_warning_howToHandle: () => 'How to handle',
    expense_edit_warning_keepPartial: () => 'Keep as partial',
    expense_edit_warning_keepOverpayment: () => 'Keep overpayment',
    expense_edit_warning_keepDescIncrease: ({ amount }: { amount: string }) =>
      `Keep increase of ${amount}`,
    expense_edit_warning_keepDescDecrease: ({ amount }: { amount: string }) =>
      `Keep decrease of ${amount}`,
    expense_edit_warning_cancelAll: () => 'Cancel all',
    expense_edit_warning_cancelDesc: () => 'Cancel all claims',
    expense_edit_warning_autoAdjust: () => 'Auto adjust',
    expense_edit_warning_adjustDescIncrease: () => 'Adjust for increase',
    expense_edit_warning_adjustDescDecrease: () => 'Adjust for decrease',
    expense_edit_warning_cancelEdit: () => 'Cancel Edit',
    expense_edit_warning_continueEdit: () => 'Continue Edit',
    expense_edit_warning_processing: () => 'Processing...',
  },
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  formatDateWithRelative: () => '2 days ago',
}));

describe('ExpenseEditWarningModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    currentAmount: 100,
    newAmount: 150,
    pendingClaims: [
      {
        id: 1,
        amount: 50,
        colleagueName: 'Alice',
        submittedAt: new Date(),
        hasPaymentProof: true,
      },
      {
        id: 2,
        amount: 30,
        colleagueName: 'Bob',
        submittedAt: new Date(),
        hasPaymentProof: false,
      },
    ],
  };

  it('renders modal with title and summary', () => {
    render(<ExpenseEditWarningModal {...defaultProps} />);
    expect(screen.getByText('Warning: Pending Claims')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
  });

  it('shows increase label and amount when newAmount > currentAmount', () => {
    render(<ExpenseEditWarningModal {...defaultProps} />);
    expect(screen.getByText('Increase')).toBeInTheDocument();
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
  });

  it('shows decrease label when newAmount < currentAmount', () => {
    render(<ExpenseEditWarningModal {...defaultProps} newAmount={80} />);
    expect(screen.getByText('Decrease')).toBeInTheDocument();
    expect(screen.getByText('$-20.00')).toBeInTheDocument();
  });

  it('renders pending claims list', () => {
    render(<ExpenseEditWarningModal {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Proof attached')).toBeInTheDocument();
  });

  it('shows total claimed amount', () => {
    render(<ExpenseEditWarningModal {...defaultProps} />);
    expect(screen.getByText('Total Claimed')).toBeInTheDocument();
    expect(screen.getByText('$80.00')).toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseEditWarningModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText('Cancel Edit'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onConfirm with selected choice when continue clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExpenseEditWarningModal {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByText('Continue Edit'));
    expect(onConfirm).toHaveBeenCalledWith('keep');
  });

  it('confirms the adjusted-claims choice', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExpenseEditWarningModal {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByText('Auto adjust'));
    await user.click(screen.getByText('Continue Edit'));

    expect(onConfirm).toHaveBeenCalledWith('adjust');
  });

  it('shows processing state when isProcessing is true', () => {
    render(<ExpenseEditWarningModal {...defaultProps} isProcessing />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.getByText('Cancel Edit')).toBeDisabled();
  });
});
