/**
 * Edge-case tests for ExpenseForm that require mocked hooks
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPENSE_FORM } from '@/test/test-ids';
import { ExpenseForm } from '../expense-form';

const mockColleagues = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

const mockRestaurants = [
  { id: 10, name: 'Pizza Place' },
  { id: 20, name: 'Sushi Bar' },
];

const defaultProps = {
  colleagues: mockColleagues,
  restaurants: mockRestaurants,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

const mockCheckPendingClaims = vi.fn().mockReturnValue(false);
const mockHandleWarningConfirm = vi.fn().mockResolvedValue(undefined);
const mockSetShowWarningModal = vi.fn();
const mockSetPendingClaimsChoice = vi.fn();

vi.mock('../use-pending-claims', () => ({
  usePendingClaims: vi.fn().mockImplementation(({ isEditing, expenseId }) => ({
    pendingClaims: [],
    pendingSubmissionData: null,
    showWarningModal: false,
    pendingClaimsChoice: 'keep',
    checkPendingClaims: mockCheckPendingClaims,
    handleWarningConfirm: mockHandleWarningConfirm,
    setShowWarningModal: mockSetShowWarningModal,
    setPendingClaimsChoice: mockSetPendingClaimsChoice,
    isEditing,
    expenseId,
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ExpenseForm edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPendingClaims.mockReturnValue(false);
  });

  it('shows error when EQUAL split has no participants selected', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-15');

    const selects = screen.queryAllByRole('combobox', { hidden: true });
    const hiddenSelect = selects.find((el) => el.tagName.toLowerCase() === 'select');
    if (!hiddenSelect) throw new Error('Hidden native select not found');
    await user.selectOptions(hiddenSelect, '10');

    const amountInput = screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
    await user.type(amountInput, '100');

    await user.click(screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Please select at least one participant for equal split.'
      );
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('shows error when ITEMIZED split has no items', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-15');

    const selects = screen.queryAllByRole('combobox', { hidden: true });
    const hiddenSelect = selects.find((el) => el.tagName.toLowerCase() === 'select');
    if (!hiddenSelect) throw new Error('Hidden native select not found');
    await user.selectOptions(hiddenSelect, '10');

    // Ensure no item price is entered and submit
    await user.click(screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Please add at least one item with a price for itemized split.'
      );
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when amount is zero or negative', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    const amountInput = screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
    await user.clear(amountInput);
    await user.type(amountInput, '0');

    await user.click(screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('shows error when editing expense with existing payments and no confirmation', async () => {
    const user = userEvent.setup();
    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 75,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
      participants: [
        {
          id: 101,
          amount: 75,
          colleagueId: 1,
          paymentApplications: [
            {
              amount: 50,
              payment: {
                id: 1,
                amount: 50,
                date: '2024-05-02',
                paymentType: 'PAYME',
                isApproved: true,
              },
            },
          ],
        },
      ],
    };

    render(<ExpenseForm {...defaultProps} initialData={initialData} />);

    const amountInput = screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
    await user.clear(amountInput);
    await user.type(amountInput, '80');

    await user.click(screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Please confirm that you understand the impact of editing this expense with existing payments.'
      );
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('submits after confirming edit impact for expense with existing payments', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 75,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
      participants: [
        {
          id: 101,
          amount: 75,
          colleagueId: 1,
          paymentApplications: [
            {
              amount: 50,
              payment: {
                id: 1,
                amount: 50,
                date: '2024-05-02',
                paymentType: 'PAYME',
                isApproved: true,
              },
            },
          ],
        },
      ],
    };

    render(<ExpenseForm {...defaultProps} initialData={initialData} onSubmit={onSubmit} />);

    // Confirm edit impact
    const confirmCheckbox = screen.getByRole('checkbox', { name: /understand/i });
    await user.click(confirmCheckbox);

    await user.click(screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('stops submission when pending claims check returns true', async () => {
    const user = userEvent.setup();
    mockCheckPendingClaims.mockReturnValue(true);

    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 75,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
    };

    render(<ExpenseForm {...defaultProps} initialData={initialData} />);

    await user.click(screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(mockCheckPendingClaims).toHaveBeenCalled();
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('renders pending claims warning modal and calls handlers', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const { usePendingClaims } = await import('../use-pending-claims');
    (usePendingClaims as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      pendingClaims: [
        {
          id: 1,
          amount: 25,
          colleagueName: 'Alice',
          submittedAt: new Date(),
          hasPaymentProof: false,
        },
      ],
      pendingSubmissionData: {
        date: '2024-05-01',
        restaurantId: 10,
        amount: 80,
        splitType: 'EQUAL' as const,
        participantIds: [1],
      },
      showWarningModal: true,
      pendingClaimsChoice: 'keep',
      checkPendingClaims: mockCheckPendingClaims,
      handleWarningConfirm: mockHandleWarningConfirm,
      setShowWarningModal: mockSetShowWarningModal,
      setPendingClaimsChoice: mockSetPendingClaimsChoice,
    }));

    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 75,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
    };

    render(<ExpenseForm {...defaultProps} initialData={initialData} onSubmit={onSubmit} />);

    expect(screen.getByText('Continue with Edit')).toBeInTheDocument();

    await user.click(screen.getByText('Continue with Edit'));
    await waitFor(() => {
      expect(mockHandleWarningConfirm).toHaveBeenCalled();
    });

    // Re-render with modal open to test close button
    await user.click(screen.getByText('Cancel Edit'));
    await waitFor(() => {
      expect(mockSetShowWarningModal).toHaveBeenCalledWith(false);
    });
  });
});
