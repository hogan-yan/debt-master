/**
 * Tests for ExpenseForm component
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getExpenseReceiptUrl, getPendingClaimsForExpense } from '@/server/expenses';
import { EXPENSE_FORM, participantCheckboxId } from '@/test/test-ids';
import { ExpenseForm } from '../expense-form';

vi.mock('@/server/expenses', () => ({
  getPendingClaimsForExpense: vi.fn(),
  getExpenseReceiptUrl: vi.fn(),
}));

const mockColleagues = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
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

describe('ExpenseForm', () => {
  it('renders core form fields in create mode', () => {
    render(<ExpenseForm {...defaultProps} />);

    // Date input
    expect(screen.getByTestId(EXPENSE_FORM.DATE_INPUT)).toBeInTheDocument();

    // Restaurant select
    expect(screen.getByTestId(EXPENSE_FORM.RESTAURANT_SELECT_BTN)).toBeInTheDocument();

    // Split type selector (default is ITEMIZED, so amount input is hidden)
    expect(screen.getByTestId(EXPENSE_FORM.ITEMIZED_RADIO)).toBeInTheDocument();
    expect(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO)).toBeInTheDocument();

    // Participant checkboxes (ITEMIZED mode shows them)
    for (const colleague of mockColleagues) {
      expect(screen.getByTestId(participantCheckboxId(colleague.id))).toBeInTheDocument();
    }

    // Cancel and Create buttons
    expect(screen.getByTestId(EXPENSE_FORM.CANCEL_BTN)).toBeInTheDocument();
    expect(screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN)).toBeInTheDocument();
  });

  it('shows amount input when EQUAL split type is selected', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    // Switch to EQUAL split type
    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    expect(screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT)).toBeInTheDocument();
  });

  it('shows validation errors when required fields are empty and form is submitted', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    // Switch to EQUAL split type to expose amount and participant validation
    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    // Clear the default date first
    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);

    const submitBtn = screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN);
    await user.click(submitBtn);

    // Wait for validation errors to appear
    await waitFor(() => {
      // Date field error
      expect(screen.getByText('Date is required')).toBeInTheDocument();
      // Participant validation (EQUAL mode shows UI text when none selected)
      expect(screen.getByText('At least one participant is required')).toBeInTheDocument();
    });

    // Verify the form prevents submission since required fields are empty.
    // Restaurant validation also prevents submission but its error is not
    // surfaced on the Radix Select trigger until interaction.
    await waitFor(() => {
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  it('calls onSubmit with correct data when EQUAL form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} />);

    // Switch to EQUAL split type
    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    // Fill date
    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-15');

    // Select restaurant using the hidden native select
    // Radix Select renders a hidden <select> for form submission.
    // In jsdom it has an implicit combobox role, so we query all and pick the <select>.
    const selects = screen.queryAllByRole('combobox', { hidden: true });
    const hiddenSelect = selects.find((el) => el.tagName.toLowerCase() === 'select');
    if (!hiddenSelect) throw new Error('Hidden native select not found');
    await user.selectOptions(hiddenSelect, '10');

    // Fill amount
    const amountInput = screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
    await user.type(amountInput, '100.50');

    // Select participants
    await user.click(screen.getByTestId(participantCheckboxId(1)));
    await user.click(screen.getByTestId(participantCheckboxId(2)));

    // Submit form
    const submitBtn = screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.date).toBe('2024-06-15');
    expect(submittedData?.restaurantId).toBe(10);
    expect(submittedData?.amount).toBe(100.5);
    expect(submittedData?.splitType).toBe('EQUAL');
    expect(submittedData?.participantIds).toEqual([1, 2]);
  });

  it('calls onSubmit with correct data when ITEMIZED form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} />);

    // Fill date
    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-20');

    // Select restaurant using the hidden native select
    const selects = screen.queryAllByRole('combobox', { hidden: true });
    const hiddenSelect = selects.find((el) => el.tagName.toLowerCase() === 'select');
    if (!hiddenSelect) throw new Error('Hidden native select not found');
    await user.selectOptions(hiddenSelect, '20');

    // Select participant for itemized mode
    await user.click(screen.getByTestId(participantCheckboxId(1)));

    // Add item price
    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '45.00');

    // Submit form
    const submitBtn = screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.date).toBe('2024-06-20');
    expect(submittedData?.restaurantId).toBe(20);
    expect(submittedData?.amount).toBe(45);
    expect(submittedData?.splitType).toBe('ITEMIZED');
    expect(submittedData?.participantIds).toEqual([1]);
    expect(submittedData?.items).toEqual([{ price: 45, colleagueId: 1 }]);
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseForm {...defaultProps} onClose={onClose} />);

    const cancelBtn = screen.getByTestId(EXPENSE_FORM.CANCEL_BTN);
    await user.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders in edit mode with initial data', () => {
    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 75,
      splitType: 'EQUAL' as const,
      participantIds: [1, 3],
      notes: 'Team lunch',
    };

    render(<ExpenseForm {...defaultProps} initialData={initialData} />);

    // Should show update button
    expect(screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN)).toBeInTheDocument();

    // Date should be pre-filled
    expect(screen.getByTestId(EXPENSE_FORM.DATE_INPUT)).toHaveValue('2024-05-01');

    // Amount should be visible and pre-filled (EQUAL mode)
    expect(screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT)).toHaveValue(75);

    // Participants should be pre-selected
    expect(screen.getByTestId(participantCheckboxId(1))).toBeChecked();
    expect(screen.getByTestId(participantCheckboxId(3))).toBeChecked();
    expect(screen.getByTestId(participantCheckboxId(2))).not.toBeChecked();
  });

  it('calls onSubmit with notes when provided', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} />);

    // Switch to EQUAL split type
    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    // Fill date
    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-15');

    // Select restaurant using the hidden native select
    const selects = screen.queryAllByRole('combobox', { hidden: true });
    const hiddenSelect = selects.find((el) => el.tagName.toLowerCase() === 'select');
    if (!hiddenSelect) throw new Error('Hidden native select not found');
    await user.selectOptions(hiddenSelect, '10');

    // Fill amount
    const amountInput = screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
    await user.type(amountInput, '50');

    // Select participant
    await user.click(screen.getByTestId(participantCheckboxId(1)));

    // Fill notes
    const notesInput = screen.getByLabelText(/Notes/i);
    await user.type(notesInput, 'Business lunch meeting');

    // Submit form
    const submitBtn = screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.notes).toBe('Business lunch meeting');
  });

  it('shows payment warning banner when editing an expense with approved payments', async () => {
    vi.mocked(getPendingClaimsForExpense).mockResolvedValue([]);
    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 100,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
      participants: [
        {
          id: 1,
          amount: 100,
          colleague: { id: 1, name: 'Alice' },
          paymentApplications: [
            {
              amount: 50,
              payment: {
                id: 1,
                amount: 50,
                date: '2024-05-02',
                paymentType: 'cash',
                isApproved: true,
              },
            },
          ],
        },
      ],
    };

    render(<ExpenseForm {...defaultProps} initialData={initialData} />);

    const confirmCheckbox = screen.getByLabelText(/I understand/i);
    expect(confirmCheckbox).toBeInTheDocument();

    await userEvent.setup().click(confirmCheckbox);
    expect(confirmCheckbox).toBeChecked();
  });

  it('shows pending claims warning modal and submits with chosen action', async () => {
    const user = userEvent.setup();
    vi.mocked(getPendingClaimsForExpense).mockResolvedValue([
      {
        id: 1,
        amount: 50,
        colleagueId: 1,
        submittedAt: new Date(),
        colleagueName: 'Alice',
        hasPaymentProof: false,
      },
    ]);

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 100,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
    };

    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} initialData={initialData} />);

    await waitFor(() => {
      expect(getPendingClaimsForExpense).toHaveBeenCalledWith({ data: { expenseId: 5 } });
    });

    // Change amount to trigger pending-claims check
    const amountInput = screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
    await user.clear(amountInput);
    await user.type(amountInput, '120');

    const submitBtn = screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue with Edit/i })).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('blocks edit submission when payment warning is not confirmed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getPendingClaimsForExpense).mockResolvedValue([]);

    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 100,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
      participants: [
        {
          id: 1,
          amount: 100,
          colleague: { id: 1, name: 'Alice' },
          paymentApplications: [
            {
              amount: 50,
              payment: {
                id: 1,
                amount: 50,
                date: '2024-05-02',
                paymentType: 'cash',
                isApproved: true,
              },
            },
          ],
        },
      ],
    };

    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} initialData={initialData} />);

    const updateBtn = screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN);
    await user.click(updateBtn);

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('closes pending claims modal without submitting when cancelled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getPendingClaimsForExpense).mockResolvedValue([
      {
        id: 1,
        amount: 50,
        colleagueId: 1,
        submittedAt: new Date(),
        colleagueName: 'Alice',
        hasPaymentProof: false,
      },
    ]);

    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 100,
      splitType: 'EQUAL' as const,
      participantIds: [1],
      notes: '',
    };

    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} initialData={initialData} />);

    await waitFor(() => {
      expect(getPendingClaimsForExpense).toHaveBeenCalledWith({ data: { expenseId: 5 } });
    });

    const amountInput = screen.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
    await user.clear(amountInput);
    await user.type(amountInput, '120');

    const updateBtn = screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN);
    await user.click(updateBtn);

    const cancelBtn = await screen.findByRole('button', { name: /Cancel Edit/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Cancel Edit/i })).not.toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission in EQUAL mode when no participants are selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} />);

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
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('blocks submission in ITEMIZED mode when no items have a price', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} />);

    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-15');

    const selects = screen.queryAllByRole('combobox', { hidden: true });
    const hiddenSelect = selects.find((el) => el.tagName.toLowerCase() === 'select');
    if (!hiddenSelect) throw new Error('Hidden native select not found');
    await user.selectOptions(hiddenSelect, '10');

    await user.click(screen.getByTestId(participantCheckboxId(1)));

    await user.click(screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('submits ITEMIZED item with name and price', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} />);

    const dateInput = screen.getByTestId(EXPENSE_FORM.DATE_INPUT);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-06-15');

    const selects = screen.queryAllByRole('combobox', { hidden: true });
    const hiddenSelect = selects.find((el) => el.tagName.toLowerCase() === 'select');
    if (!hiddenSelect) throw new Error('Hidden native select not found');
    await user.selectOptions(hiddenSelect, '10');

    await user.click(screen.getByTestId(participantCheckboxId(1)));

    const nameInput = screen.getByTestId(EXPENSE_FORM.ITEM_NAME_INPUT);
    await user.type(nameInput, 'Burger');

    const priceInput = screen.getByTestId(EXPENSE_FORM.ITEM_PRICE_INPUT);
    await user.type(priceInput, '12.50');

    await user.click(screen.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.items).toEqual([{ name: 'Burger', price: 12.5, colleagueId: 1 }]);
  });

  it('submits edit in ITEMIZED mode with initial items and removes existing receipt', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getPendingClaimsForExpense).mockResolvedValue([]);
    vi.mocked(getExpenseReceiptUrl).mockResolvedValue({ url: 'http://example.com/receipt.png' });

    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 25,
      splitType: 'ITEMIZED' as const,
      participantIds: [1],
      notes: '',
      items: [
        { name: 'Salad', price: 15, colleagueId: 1 },
        { name: 'Drink', price: 10, colleagueId: 1 },
      ],
      existingReceiptBucket: 'receipts',
      existingReceiptObjectKey: 'old-receipt.png',
    };

    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} initialData={initialData} />);

    await waitFor(() => {
      expect(getExpenseReceiptUrl).toHaveBeenCalledWith({ data: { expenseId: 5 } });
    });

    const removeBtn = screen.getByLabelText(/Remove existing receipt/i);
    await user.click(removeBtn);

    const updateBtn = screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN);
    await user.click(updateBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.items).toEqual([
      { name: 'Salad', price: 15, colleagueId: 1 },
      { name: 'Drink', price: 10, colleagueId: 1 },
    ]);
    expect(submittedData?.removeExistingReceipt).toBe(true);
  });

  it('submits edit in ITEMIZED mode and drops empty item names', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getPendingClaimsForExpense).mockResolvedValue([]);

    const initialData = {
      id: 5,
      date: '2024-05-01',
      restaurantId: 10,
      amount: 10,
      splitType: 'ITEMIZED' as const,
      participantIds: [1],
      notes: '',
      items: [{ name: '', price: 10, colleagueId: 1 }],
    };

    render(<ExpenseForm {...defaultProps} onSubmit={onSubmit} initialData={initialData} />);

    const updateBtn = screen.getByTestId(EXPENSE_FORM.UPDATE_EXPENSE_BTN);
    await user.click(updateBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData?.items).toEqual([{ price: 10, colleagueId: 1 }]);
  });

  it('unchecks a participant in EQUAL mode', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm {...defaultProps} />);

    await user.click(screen.getByTestId(EXPENSE_FORM.EQUAL_RADIO));

    const checkbox = screen.getByTestId(participantCheckboxId(1));
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
