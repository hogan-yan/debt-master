import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseDeleteDialog } from '../expense-delete-dialog';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid="checkbox"
    />
  ),
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    expense_delete_title: () => 'Delete Expense',
    expense_delete_details: () => 'Expense Details',
    expense_delete_amount: () => 'Amount:',
    expense_delete_restaurant: () => 'Restaurant:',
    expense_delete_date: () => 'Date:',
    expense_delete_warning: () => 'Are you sure you want to delete this expense?',
    expense_delete_irreversible: () => 'This action cannot be undone.',
    expense_delete_paymentsFound: () => 'Related Payments Found',
    expense_delete_paymentsDesc: () => 'This expense has payments associated with it.',
    expense_delete_paymentsCheckbox: () => 'Also delete related payments',
    expense_delete_paymentsWillDelete: () => 'Payments will be deleted',
    expense_delete_paymentsWillKeep: () => 'Payments will be kept',
    common_unknown: () => 'Unknown',
    common_cancel: () => 'Cancel',
    common_delete: () => 'Delete',
    expense_delete_deleting: () => 'Deleting...',
  },
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

describe('ExpenseDeleteDialog', () => {
  const mockExpense = {
    id: 1,
    amount: 100,
    restaurant: { id: 1, name: 'Test Restaurant', address: '123 Main St' },
    date: '2024-01-15',
  };

  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  const renderDialog = (props: Partial<Parameters<typeof ExpenseDeleteDialog>[0]> = {}) =>
    render(
      <ExpenseDeleteDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        expense={mockExpense}
        onConfirm={mockOnConfirm}
        isLoading={false}
        hasRelatedPayments={false}
        {...props}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when expense is null', () => {
    renderDialog({ expense: null });
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog content when expense provided', () => {
    renderDialog();
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    expect(screen.getByText('Delete Expense')).toBeInTheDocument();
  });

  it('shows amount formatted', () => {
    renderDialog();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('shows restaurant name or unknown fallback', () => {
    renderDialog();
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('shows unknown fallback when restaurant is null', () => {
    renderDialog({ expense: { ...mockExpense, restaurant: null } });
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows unknown fallback when restaurant is undefined', () => {
    renderDialog({ expense: { ...mockExpense, restaurant: undefined } });
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows string date directly', () => {
    renderDialog();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  it('shows Date object toLocaleDateString', () => {
    const date = new Date('2024-06-20');
    renderDialog({ expense: { ...mockExpense, date } });
    expect(screen.getByText(date.toLocaleDateString())).toBeInTheDocument();
  });

  it('shows related payments section when hasRelatedPayments=true', () => {
    renderDialog({ hasRelatedPayments: true });
    expect(screen.getByText('Related Payments Found')).toBeInTheDocument();
    expect(screen.getByText('This expense has payments associated with it.')).toBeInTheDocument();
  });

  it('hides related payments section when hasRelatedPayments=false', () => {
    renderDialog({ hasRelatedPayments: false });
    expect(screen.queryByText('Related Payments Found')).not.toBeInTheDocument();
  });

  it('calls onConfirm with deletePayments=false when confirmed without checkbox', async () => {
    const user = userEvent.setup();
    renderDialog({ hasRelatedPayments: true });

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(mockOnConfirm).toHaveBeenCalledWith(false);
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with deletePayments=true when checkbox checked and confirmed', async () => {
    const user = userEvent.setup();
    renderDialog({ hasRelatedPayments: true });

    const checkbox = screen.getByTestId('checkbox');
    await user.click(checkbox);

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(mockOnConfirm).toHaveBeenCalledWith(true);
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when cancel clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockOnOpenChange).toHaveBeenCalledTimes(1);
  });

  it('shows deleting text when isLoading=true', () => {
    renderDialog({ isLoading: true });
    expect(screen.getByText('Deleting...')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows delete text when isLoading=false', () => {
    renderDialog({ isLoading: false });
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Deleting...')).not.toBeInTheDocument();
  });
});
