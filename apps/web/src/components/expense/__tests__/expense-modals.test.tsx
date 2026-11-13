import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseModals } from '../expense-modals';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock('@/components/ui/crud-modal-container', () => ({
  CRUDModalContainer: ({
    children,
    isOpen,
    title,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
    title?: string;
  }) => (
    <div data-testid="crud-modal-container" data-open={isOpen} data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: string;
      children: React.ReactNode;
    }
  ) => (
    <button {...props} data-variant={props.variant}>
      {props.children}
    </button>
  ),
}));

vi.mock('@/components/forms/expense-form', () => ({
  ExpenseForm: (props: Record<string, unknown>) => (
    <form data-testid="expense-form" data-props={JSON.stringify(props)}>
      {typeof props.onClose === 'function' && (
        <button
          type="button"
          data-testid="expense-form-close"
          onClick={props.onClose as () => void}
        >
          Close form
        </button>
      )}
    </form>
  ),
}));

vi.mock('@/components/ui/expense-delete-dialog', () => ({
  ExpenseDeleteDialog: (props: Record<string, unknown>) => (
    <div data-testid="expense-delete-dialog" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock('@/utils/auth-context', () => ({
  AdminOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, key: string) => () => key,
    }
  ),
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

const defaultProps = {
  isAddModalOpen: false,
  isEditModalOpen: false,
  isDeleteDialogOpen: false,
  isReceiptModalOpen: false,
  isClaimModalOpen: false,
  setIsAddModalOpen: vi.fn(),
  setIsEditModalOpen: vi.fn(),
  setIsDeleteDialogOpen: vi.fn(),
  setIsReceiptModalOpen: vi.fn(),
  setIsClaimModalOpen: vi.fn(),
  selectedExpense: null,
  expenseToDelete: null,
  selectedParticipant: null,
  receiptUrl: null,
  colleagues: [{ id: 1, name: 'Alice' }],
  restaurants: [{ id: 1, name: 'Bistro' }],
  onCreateExpense: vi.fn(),
  onEditExpense: vi.fn(),
  onDeleteConfirm: vi.fn(),
  onClaimPaymentWithProof: vi.fn(),
  isProcessingPaymentClaim: {},
  hasRelatedPayments: false,
  isDeleting: false,
};

describe('ExpenseModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders add expense modal when isAddModalOpen=true', () => {
    render(<ExpenseModals {...defaultProps} isAddModalOpen={true} />);
    const containers = screen.getAllByTestId('crud-modal-container');
    expect(containers[0]).toHaveAttribute('data-open', 'true');
    expect(containers[0]).toHaveAttribute('data-title', 'expense_form_addNewExpense');
    expect(screen.getByTestId('expense-form')).toBeInTheDocument();
  });

  it('renders edit expense modal when isEditModalOpen=true and selectedExpense provided', () => {
    const selectedExpense = {
      id: 1,
      date: '2024-01-15',
      restaurantId: 1,
      amount: 100,
      splitType: 'EQUAL' as const,
      participants: [{ colleagueId: 1 }],
      items: [],
      notes: 'Dinner',
      receiptBucket: 'receipts',
      receiptObjectKey: 'key-1',
    } as unknown as import('@/types').Expense;
    render(
      <ExpenseModals {...defaultProps} isEditModalOpen={true} selectedExpense={selectedExpense} />
    );
    const containers = screen.getAllByTestId('crud-modal-container');
    expect(containers[1]).toHaveAttribute('data-open', 'true');
    expect(containers[1]).toHaveAttribute('data-title', 'expense_detail_editExpense');
    const forms = screen.getAllByTestId('expense-form');
    expect(forms.length).toBe(2);
    expect(forms[1]).toHaveAttribute('data-props', expect.stringContaining('"initialData"'));
  });

  it('does NOT render expense form in edit modal when selectedExpense is null', () => {
    render(<ExpenseModals {...defaultProps} isEditModalOpen={true} />);
    const containers = screen.getAllByTestId('crud-modal-container');
    expect(containers[1]).toHaveAttribute('data-open', 'true');
    const forms = screen.getAllByTestId('expense-form');
    expect(forms.length).toBe(1);
  });

  it('renders receipt modal when isReceiptModalOpen=true and receiptUrl provided', () => {
    render(
      <ExpenseModals
        {...defaultProps}
        isReceiptModalOpen={true}
        receiptUrl="https://example.com/receipt.jpg"
      />
    );
    const dialogs = screen.getAllByTestId('dialog');
    const receiptDialog = dialogs.find((d) => d.getAttribute('data-open') === 'true');
    expect(receiptDialog).toBeInTheDocument();
    expect(screen.getByAltText('expense_detail_receiptImageAlt')).toHaveAttribute(
      'src',
      'https://example.com/receipt.jpg'
    );
  });

  it('does NOT render receipt image when receiptUrl is null', () => {
    render(<ExpenseModals {...defaultProps} isReceiptModalOpen={true} />);
    expect(screen.queryByAltText('expense_detail_receiptImageAlt')).not.toBeInTheDocument();
  });

  it('renders delete dialog when isDeleteDialogOpen=true', () => {
    render(<ExpenseModals {...defaultProps} isDeleteDialogOpen={true} />);
    expect(screen.getByTestId('expense-delete-dialog')).toBeInTheDocument();
  });

  it('renders claim modal when isClaimModalOpen=true and selectedParticipant provided', () => {
    const selectedParticipant = {
      id: 42,
      amount: 150.5,
      colleague: { id: 1, name: 'Bob' },
    };
    render(
      <ExpenseModals
        {...defaultProps}
        isClaimModalOpen={true}
        selectedParticipant={selectedParticipant}
      />
    );
    const dialogs = screen.getAllByTestId('dialog');
    const claimDialog = dialogs.find((d) => d.getAttribute('data-open') === 'true');
    expect(claimDialog).toBeInTheDocument();
    expect(screen.getByText(/\$150\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment_modal_paymentMethod/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expense_modal_paymentProofOptional/i)).toBeInTheDocument();
  });

  it('does NOT render claim content when selectedParticipant is null', () => {
    render(<ExpenseModals {...defaultProps} isClaimModalOpen={true} />);
    expect(screen.queryByText(/Amount:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/payment_modal_paymentMethod/i)).not.toBeInTheDocument();
  });

  it('shows submitting state in claim button when isProcessingPaymentClaim[participant.id]=true', () => {
    const selectedParticipant = {
      id: 42,
      amount: 100,
      colleague: { id: 1, name: 'Alice' },
    };
    render(
      <ExpenseModals
        {...defaultProps}
        isClaimModalOpen={true}
        selectedParticipant={selectedParticipant}
        isProcessingPaymentClaim={{ 42: true }}
      />
    );
    const buttons = screen.getAllByRole('button');
    const confirmButton = buttons[buttons.length - 1];
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent('payment_modal_submitting');
  });

  it('shows mark as paid text when not processing', () => {
    const selectedParticipant = {
      id: 42,
      amount: 100,
      colleague: { id: 1, name: 'Alice' },
    };
    render(
      <ExpenseModals
        {...defaultProps}
        isClaimModalOpen={true}
        selectedParticipant={selectedParticipant}
        isProcessingPaymentClaim={{ 42: false }}
      />
    );
    const buttons = screen.getAllByRole('button');
    const confirmButton = buttons[buttons.length - 1];
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton).toHaveTextContent('payment_modal_markAsPaid');
  });

  it('claim modal cancel button calls setIsClaimModalOpen(false)', async () => {
    const user = userEvent.setup();
    const setIsClaimModalOpen = vi.fn();
    const selectedParticipant = {
      id: 42,
      amount: 100,
      colleague: { id: 1, name: 'Alice' },
    };
    render(
      <ExpenseModals
        {...defaultProps}
        isClaimModalOpen={true}
        selectedParticipant={selectedParticipant}
        setIsClaimModalOpen={setIsClaimModalOpen}
      />
    );
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton as HTMLElement);
    expect(setIsClaimModalOpen).toHaveBeenCalledWith(false);
  });

  it('claim modal confirm button reads paymentMethod select and calls onClaimPaymentWithProof with correct args', async () => {
    const user = userEvent.setup();
    const onClaimPaymentWithProof = vi.fn();
    const selectedParticipant = {
      id: 42,
      amount: 100,
      colleague: { id: 1, name: 'Alice' },
    };
    render(
      <ExpenseModals
        {...defaultProps}
        isClaimModalOpen={true}
        selectedParticipant={selectedParticipant}
        onClaimPaymentWithProof={onClaimPaymentWithProof}
      />
    );
    const buttons = screen.getAllByRole('button');
    const confirmButton = buttons[buttons.length - 1]!;
    await user.click(confirmButton);
    expect(onClaimPaymentWithProof).toHaveBeenCalledWith(42, undefined, 'PAYME');
  });

  it('openInNewTab button rendered when receiptUrl provided', async () => {
    const user = userEvent.setup();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <ExpenseModals
        {...defaultProps}
        isReceiptModalOpen={true}
        receiptUrl="https://example.com/receipt.jpg"
      />
    );
    const openButton = screen.getByRole('button', { name: /expense_detail_openInNewTab/i });
    expect(openButton).toBeInTheDocument();
    await user.click(openButton);
    expect(windowOpen).toHaveBeenCalledWith('https://example.com/receipt.jpg', '_blank');
    windowOpen.mockRestore();
  });

  it('handles selectedExpense with Date object date', () => {
    const selectedExpense = {
      id: 1,
      date: new Date('2024-01-15'),
      restaurantId: 1,
      amount: 100,
      splitType: 'EQUAL' as const,
      participants: [{ colleagueId: 1 }],
      items: [],
      notes: null,
      receiptBucket: null,
      receiptObjectKey: null,
    } as unknown as import('@/types').Expense;
    render(
      <ExpenseModals {...defaultProps} isEditModalOpen={true} selectedExpense={selectedExpense} />
    );
    const forms = screen.getAllByTestId('expense-form');
    expect(forms.length).toBe(2);
  });

  it('handles selectedParticipant without colleague name', () => {
    const selectedParticipant = {
      id: 42,
      amount: 150.5,
      colleague: undefined,
    };
    render(
      <ExpenseModals
        {...defaultProps}
        isClaimModalOpen={true}
        selectedParticipant={selectedParticipant}
      />
    );
    expect(screen.getByText(/common_unknown/)).toBeInTheDocument();
  });

  it('calls add modal onClose callback', async () => {
    const user = userEvent.setup();
    const setIsAddModalOpen = vi.fn();
    render(
      <ExpenseModals
        {...defaultProps}
        isAddModalOpen={true}
        setIsAddModalOpen={setIsAddModalOpen}
      />
    );
    await user.click(screen.getByTestId('expense-form-close'));
    expect(setIsAddModalOpen).toHaveBeenCalledWith(false);
  });

  it('calls edit modal onClose callback and maps expense items', async () => {
    const user = userEvent.setup();
    const setIsEditModalOpen = vi.fn();
    const selectedExpense = {
      id: 1,
      date: '2024-01-15',
      restaurantId: 1,
      amount: 100,
      splitType: 'EQUAL' as const,
      participants: [{ colleagueId: 1 }],
      items: [{ name: 'Burger', price: 50, colleagueId: 1 }],
      notes: 'Dinner',
      receiptBucket: null,
      receiptObjectKey: null,
    } as unknown as import('@/types').Expense;
    render(
      <ExpenseModals
        {...defaultProps}
        isEditModalOpen={true}
        selectedExpense={selectedExpense}
        setIsEditModalOpen={setIsEditModalOpen}
      />
    );
    const forms = screen.getAllByTestId('expense-form');
    const editForm = forms[forms.length - 1]!;
    const props = JSON.parse(editForm.getAttribute('data-props') ?? '{}') as Record<
      string,
      unknown
    >;
    await user.click(screen.getAllByTestId('expense-form-close')[1]!);
    expect(setIsEditModalOpen).toHaveBeenCalledWith(false);
    expect(props.initialData).toEqual(
      expect.objectContaining({ items: [{ name: 'Burger', price: 50, colleagueId: 1 }] })
    );
  });
});
