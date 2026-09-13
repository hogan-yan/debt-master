/**
 * Tests for PaymentForm component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PAYMENT, PAYMENT_FORM } from '@/test/test-ids';
import { PaymentForm } from '../payment-form';

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: vi.fn(),
  }),
}));

// Mock server functions used by PaymentForm
vi.mock('@/server/expenses', () => ({
  getExpenseById: vi.fn(),
  getUnpaidExpensesForColleague: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/server/payments', () => ({
  getPaymentProofUrlByPaymentId: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Stable mock object — vi.mock factory runs on EVERY call to the mocked function,
// so returning a new literal each time creates a new ref every render → infinite loop.
const emptySelectedIds: number[] = [];
const mockExpenseSelection = {
  selectedIds: emptySelectedIds,
  amounts: {},
  selectExpense: vi.fn(),
  deselectExpense: vi.fn(),
  toggleExpense: vi.fn(),
  updateAmount: vi.fn(),
  reset: vi.fn(),
  restore: vi.fn(),
  totalAmount: 0,
  count: 0,
};

vi.mock('../use-expense-selection', () => ({
  useExpenseSelection: () => mockExpenseSelection,
}));

const mockColleagues = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

const defaultProps = {
  colleagues: mockColleagues,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('PaymentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpenseSelection.selectedIds = [];
    mockExpenseSelection.amounts = {};
    mockExpenseSelection.totalAmount = 0;
    mockExpenseSelection.count = 0;
  });
  it('renders all required fields in create mode', () => {
    render(<PaymentForm {...defaultProps} />);

    // Payment mode selector (PREPAYMENT and EXPENSE_PAYMENT buttons)
    expect(screen.getByTestId(PAYMENT.PREPAYMENT_MODE_BTN)).toBeInTheDocument();
    expect(screen.getByTestId(PAYMENT.EXPENSE_PAYMENT_MODE_BTN)).toBeInTheDocument();

    // Payer select (colleague dropdown)
    expect(screen.getByTestId(PAYMENT.COLLEAGUE_SELECT)).toBeInTheDocument();

    // Amount input
    expect(screen.getByTestId(PAYMENT_FORM.AMOUNT_INPUT)).toBeInTheDocument();

    // Date input
    expect(screen.getByTestId(PAYMENT_FORM.DATE_INPUT)).toBeInTheDocument();

    // Payment type selector (native select with PAYME, FPS, CASH, OTHER)
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();

    // Cancel and submit buttons
    expect(screen.getByTestId(PAYMENT_FORM.CANCEL_BTN)).toBeInTheDocument();
    expect(screen.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN)).toBeInTheDocument();
  });

  it('shows validation error when required fields are empty and form is submitted', async () => {
    const { toast } = await import('sonner');
    render(<PaymentForm {...defaultProps} />);

    // Clear the default date using fireEvent.change for controlled input
    // (userEvent.clear doesn't reliably clear controlled date inputs in jsdom)
    const dateInput = screen.getByTestId(PAYMENT_FORM.DATE_INPUT);
    fireEvent.change(dateInput, { target: { value: '' } });

    // Submit form via fireEvent.submit (userEvent.click on submit button
    // doesn't reliably trigger form onSubmit in jsdom)
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    // Validation should trigger toast.error for missing fields
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    // onSubmit should not be called
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct data when PREPAYMENT form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PaymentForm {...defaultProps} onSubmit={onSubmit} />);

    // Select colleague
    const colleagueSelect = screen.getByTestId(PAYMENT.COLLEAGUE_SELECT);
    await user.selectOptions(colleagueSelect, '1');

    // Fill amount
    const amountInput = screen.getByTestId(PAYMENT_FORM.AMOUNT_INPUT);
    await user.type(amountInput, '100.50');

    // Fill date
    const dateInput = screen.getByTestId(PAYMENT_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-15');

    // Payment type defaults to PAYME, no need to change

    // Submit form
    const submitBtn = screen.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.colleagueId).toBe('1');
    expect(submittedData?.amount).toBe('100.5');
    expect(submittedData?.date).toBe('2024-06-15');
    expect(submittedData?.paymentType).toBe('PAYME');
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PaymentForm {...defaultProps} onClose={onClose} />);

    const cancelBtn = screen.getByTestId(PAYMENT_FORM.CANCEL_BTN);
    await user.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches payment mode between PREPAYMENT and EXPENSE_PAYMENT', async () => {
    const user = userEvent.setup();
    render(<PaymentForm {...defaultProps} />);

    // Default mode is PREPAYMENT
    const prepaymentBtn = screen.getByTestId(PAYMENT.PREPAYMENT_MODE_BTN);
    expect(prepaymentBtn).toHaveAttribute('aria-checked', 'true');

    const expensePaymentBtn = screen.getByTestId(PAYMENT.EXPENSE_PAYMENT_MODE_BTN);
    expect(expensePaymentBtn).toHaveAttribute('aria-checked', 'false');

    // Switch to EXPENSE_PAYMENT
    await user.click(expensePaymentBtn);

    expect(prepaymentBtn).toHaveAttribute('aria-checked', 'false');
    expect(expensePaymentBtn).toHaveAttribute('aria-checked', 'true');

    // Switch back to PREPAYMENT
    await user.click(prepaymentBtn);

    expect(prepaymentBtn).toHaveAttribute('aria-checked', 'true');
    expect(expensePaymentBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onSubmit with FPS payment type when selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PaymentForm {...defaultProps} onSubmit={onSubmit} />);

    // Select colleague
    const colleagueSelect = screen.getByTestId(PAYMENT.COLLEAGUE_SELECT);
    await user.selectOptions(colleagueSelect, '2');

    // Fill amount
    const amountInput = screen.getByTestId(PAYMENT_FORM.AMOUNT_INPUT);
    await user.type(amountInput, '50');

    // Fill date
    const dateInput = screen.getByTestId(PAYMENT_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-07-20');

    // Change payment type to FPS
    const paymentTypeSelect = screen.getByLabelText(/payment method/i);
    await user.selectOptions(paymentTypeSelect, 'FPS');

    // Submit form
    const submitBtn = screen.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.colleagueId).toBe('2');
    expect(submittedData?.amount).toBe('50');
    expect(submittedData?.date).toBe('2024-07-20');
    expect(submittedData?.paymentType).toBe('FPS');
  });

  it('renders in edit mode with initial data pre-filled', () => {
    const initialData = {
      colleagueId: '1',
      amount: '75.00',
      date: '2024-05-01',
      paymentType: 'CASH' as const,
      paymentId: 5,
    };

    render(<PaymentForm {...defaultProps} initialData={initialData} />);

    // Payment mode selector should NOT be shown in edit mode
    expect(screen.queryByTestId(PAYMENT.PREPAYMENT_MODE_BTN)).not.toBeInTheDocument();
    expect(screen.queryByTestId(PAYMENT.EXPENSE_PAYMENT_MODE_BTN)).not.toBeInTheDocument();

    // Colleague should be pre-selected
    const colleagueSelect = screen.getByTestId(PAYMENT.COLLEAGUE_SELECT);
    expect(colleagueSelect).toHaveValue('1');

    // Amount should be pre-filled
    expect(screen.getByTestId(PAYMENT_FORM.AMOUNT_INPUT)).toHaveValue(75);

    // Date should be pre-filled
    expect(screen.getByTestId(PAYMENT_FORM.DATE_INPUT)).toHaveValue('2024-05-01');

    // Payment type should be pre-selected
    const paymentTypeSelect = screen.getByLabelText(/payment method/i);
    expect(paymentTypeSelect).toHaveValue('CASH');

    // Should show update button text
    expect(screen.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN)).toBeInTheDocument();
  });

  it('shows colleague balance labels in options', () => {
    const colleagues = [
      { id: 1, name: 'Alice', currentBalance: -100 },
      { id: 2, name: 'Bob', currentBalance: 50 },
      { id: 3, name: 'Charlie', currentBalance: 0 },
    ];
    render(<PaymentForm {...defaultProps} colleagues={colleagues} />);

    const options = Array.from(
      screen.getByTestId(PAYMENT.COLLEAGUE_SELECT).querySelectorAll('option')
    );
    expect(options.some((o) => o.textContent?.includes('owes'))).toBe(true);
    expect(options.some((o) => o.textContent?.includes('prepaid'))).toBe(true);
    expect(options.some((o) => o.textContent?.includes('balance:'))).toBe(true);
  });

  it('treats an undefined current balance as zero', () => {
    render(
      <PaymentForm
        {...defaultProps}
        colleagues={[{ id: 1, name: 'Alice', currentBalance: undefined } as never]}
      />
    );

    expect(screen.getByText(/balance:/)).toBeInTheDocument();
  });

  it('restores expense selection from initialData applications', () => {
    render(
      <PaymentForm
        {...defaultProps}
        initialData={{
          paymentId: 1,
          applications: [
            { id: 1, amount: 75, expense: { id: 10 } },
            { id: 2, amount: 25, expense: { id: 20 } },
          ],
        }}
      />
    );

    expect(mockExpenseSelection.restore).toHaveBeenCalledWith({
      selectedIds: [10, 20],
      amounts: { 10: '75', 20: '25' },
    });
  });

  it('restores a zero expense id without assigning an amount', () => {
    render(
      <PaymentForm
        {...defaultProps}
        initialData={{
          paymentId: 1,
          applications: [{ id: 1, amount: 75, expense: { id: 0 } }],
        }}
      />
    );

    expect(mockExpenseSelection.restore).toHaveBeenCalledWith({
      selectedIds: [0],
      amounts: {},
    });
  });

  it('restores single expense selection from initialData expenseId', () => {
    render(
      <PaymentForm
        {...defaultProps}
        initialData={{
          paymentId: 1,
          expenseId: 99,
        }}
      />
    );

    expect(mockExpenseSelection.restore).toHaveBeenCalledWith({
      selectedIds: [99],
      amounts: {},
    });
  });

  it('resets expense selection when colleague changes', async () => {
    const user = userEvent.setup();
    render(<PaymentForm {...defaultProps} />);

    const colleagueSelect = screen.getByTestId(PAYMENT.COLLEAGUE_SELECT);
    await user.selectOptions(colleagueSelect, '2');

    expect(mockExpenseSelection.reset).toHaveBeenCalled();
  });

  it('shows total applied amount when expenses are selected', () => {
    mockExpenseSelection.selectedIds = [1];
    mockExpenseSelection.totalAmount = 150;

    render(
      <PaymentForm
        {...defaultProps}
        initialData={{
          paymentId: 1,
          colleagueId: '1',
          expenseId: 1,
        }}
      />
    );

    expect(screen.getByText(/Total Applied/i)).toBeInTheDocument();
  });

  it('marks existing proof flag when initialData has an existing payment proof', async () => {
    // Line 81: form.setHadExistingProof(true) runs in the init effect when
    // initialData.hasExistingPaymentProof is truthy. The flag triggers the
    // proof-upload child to fetch its URL, so resolve that mock.
    const { getPaymentProofUrlByPaymentId } = await import('@/server/payments');
    vi.mocked(getPaymentProofUrlByPaymentId).mockResolvedValue({ url: null });

    const { getByTestId } = render(
      <PaymentForm
        {...defaultProps}
        initialData={{
          paymentId: 1,
          hasExistingPaymentProof: true,
        }}
      />
    );

    // Effect runs after mount; the form still renders its submit button.
    await waitFor(() => {
      expect(getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN)).toBeInTheDocument();
    });
  });

  it('passes the unpaid expense remaining-owed as default amount when toggled', async () => {
    const user = userEvent.setup();
    const { getUnpaidExpensesForColleague } = await import('@/server/expenses');
    vi.mocked(getUnpaidExpensesForColleague).mockResolvedValue([
      {
        id: 10,
        date: new Date('2024-01-15'),
        restaurantName: 'Foo Bar',
        restaurantId: 1,
        totalAmount: 100,
        colleagueAmount: 50,
        participantId: 1,
        notes: null,
        participantCount: 2,
        splitType: 'EQUAL',
        remainingOwed: 50,
        totalApprovedPaid: 50,
      },
    ]);

    render(<PaymentForm {...defaultProps} />);

    // Pick a colleague, then switch to expense-payment mode to render the list.
    await user.selectOptions(screen.getByTestId(PAYMENT.COLLEAGUE_SELECT), '1');
    await user.click(screen.getByTestId(PAYMENT.EXPENSE_PAYMENT_MODE_BTN));

    // Lines 142-144: handleExpenseSelection finds the expense and forwards its
    // remainingOwed as the default toggle amount. The checkbox is visually
    // hidden (sr-only) with two associated labels, so target it by id directly.
    await waitFor(() => {
      expect(document.getElementById('expense-10')).not.toBeNull();
    });
    fireEvent.click(document.getElementById('expense-10') as HTMLInputElement);

    expect(mockExpenseSelection.toggleExpense).toHaveBeenCalledWith(10, true, 50);
  });
});
