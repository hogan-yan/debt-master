import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UnpaidExpenseList } from '../unpaid-expense-list';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => () => String(key),
    }
  ),
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

const mockExpenses = [
  {
    id: 1,
    date: new Date('2026-01-15'),
    restaurantName: 'Pizza Place',
    restaurantId: 10,
    totalAmount: 100,
    colleagueAmount: 50,
    participantId: 1,
    notes: null,
    participantCount: 2,
    splitType: 'EQUAL',
    remainingOwed: 50,
    totalApprovedPaid: 0,
  },
  {
    id: 2,
    date: new Date('2026-02-20'),
    restaurantName: 'Sushi Bar',
    restaurantId: 11,
    totalAmount: 200,
    colleagueAmount: 80,
    participantId: 2,
    notes: 'dinner',
    participantCount: 3,
    splitType: 'ITEMIZED',
    remainingOwed: 80,
    totalApprovedPaid: 0,
  },
];

describe('UnpaidExpenseList', () => {
  it('shows loading state', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={[]}
        loadingExpenses={true}
        selectedExpenseIds={[]}
        expenseAmounts={{}}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    expect(screen.getByText('payment_form_loadingExpenses')).toBeInTheDocument();
  });

  it('shows empty state when no unpaid expenses', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={[]}
        loadingExpenses={false}
        selectedExpenseIds={[]}
        expenseAmounts={{}}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    expect(screen.getByText('payment_form_noUnpaidExpenses')).toBeInTheDocument();
  });

  it('renders list of expenses with restaurant names and amounts', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[]}
        expenseAmounts={{}}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    expect(screen.getByText('Pizza Place')).toBeInTheDocument();
    expect(screen.getByText('Sushi Bar')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('calls onToggleExpense when checkbox clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[]}
        expenseAmounts={{}}
        onToggleExpense={onToggle}
        onAmountChange={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /pizza place/i });
    await user.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith(1, true);
  });

  it('shows amount input when expense is selected', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[1]}
        expenseAmounts={{ 1: '25' }}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    const amountInput = screen.getByDisplayValue('25');
    expect(amountInput).toBeInTheDocument();
    expect(amountInput).toHaveAttribute('type', 'number');
  });

  it('hides amount input when expense is not selected', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[]}
        expenseAmounts={{}}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('calls onAmountChange when amount input changes', async () => {
    const user = userEvent.setup();
    const onAmountChange = vi.fn();

    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[1]}
        expenseAmounts={{ 1: '' }}
        onToggleExpense={vi.fn()}
        onAmountChange={onAmountChange}
      />
    );

    const amountInput = screen.getByPlaceholderText('payment_form_maxPlaceholder');
    await user.type(amountInput, '3');
    expect(onAmountChange).toHaveBeenCalled();
  });

  it('sets max and step attributes on amount input', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[1]}
        expenseAmounts={{}}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    const amountInput = screen.getByPlaceholderText('payment_form_maxPlaceholder');
    expect(amountInput).toHaveAttribute('max', '50');
    expect(amountInput).toHaveAttribute('step', '0.01');
  });

  it('renders amount inputs only for selected expenses', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[1]}
        expenseAmounts={{}}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    expect(screen.getAllByPlaceholderText('payment_form_maxPlaceholder').length).toBe(1);
  });

  it('handles multiple selected expenses', () => {
    render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses}
        loadingExpenses={false}
        selectedExpenseIds={[1, 2]}
        expenseAmounts={{ 1: '25', 2: '80' }}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
  });

  it('shows custom checkmark for selected expense', () => {
    const { container } = render(
      <UnpaidExpenseList
        unpaidExpenses={mockExpenses.slice(0, 1)}
        loadingExpenses={false}
        selectedExpenseIds={[1]}
        expenseAmounts={{}}
        onToggleExpense={vi.fn()}
        onAmountChange={vi.fn()}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
