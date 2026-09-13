import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPENSE, expenseDetailLinkId, TABLE_COL } from '@/test/test-ids';
import type { Expense } from '@/types';
import { useAuth } from '@/utils/auth-context';
import { ExpenseList } from './expense-list';

beforeAll(() => {
  // Mock pointer capture for Radix Select in jsdom
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/utils/auth-context', () => ({
  useAuth: vi.fn(() => ({ isAdmin: true })),
  AdminOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockExpense = (overrides?: Partial<Expense>): Expense => ({
  id: 1,
  date: '2024-03-15',
  amount: 125.5,
  splitType: 'EQUAL',
  restaurant: { id: 1, name: 'Test Restaurant', address: '123 Main St' },
  participants: [
    {
      id: 1,
      amount: 62.75,
      colleague: { id: 1, name: 'Alice' },
      expenseId: 1,
      colleagueId: 1,
      isPaid: true,
      isPending: false,
      hasPartialPayment: false,
      submittedAt: null,
    },
    {
      id: 2,
      amount: 62.75,
      colleague: { id: 2, name: 'Bob' },
      expenseId: 1,
      colleagueId: 2,
      isPaid: false,
      isPending: false,
      hasPartialPayment: false,
      submittedAt: null,
    },
  ],
  ...overrides,
});

const mockParticipants = (count: number, paidCount = 0): Expense['participants'] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    amount: 100 / count,
    colleague: { id: i + 1, name: `Person ${i + 1}` },
    expenseId: 1,
    colleagueId: i + 1,
    isPaid: i < paidCount,
    isPending: false,
    hasPartialPayment: false,
    submittedAt: null,
  }));

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockAuthValue(isAdmin: boolean) {
  return {
    user: null,
    isAuthenticated: false,
    isAdmin,
    isLoading: false,
    logout: vi.fn(),
    hasPermission: vi.fn(),
  };
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(true));
  setMatchMedia(false);
});

const defaultProps = {
  expenses: [] as Expense[],
  isLoading: false,
  onSearchChange: vi.fn(),
  onColleagueChange: vi.fn(),
  onPaymentStatusChange: vi.fn(),
  colleagues: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
  selectedColleagueIds: [] as number[],
  selectedPaymentStatus: 'all' as const,
};

describe('ExpenseList payment status filter', () => {
  it('renders payment status filter select', () => {
    render(<ExpenseList {...defaultProps} />);
    expect(screen.getByLabelText(/payment status/i)).toBeInTheDocument();
  });

  it('calls onPaymentStatusChange when status is changed', async () => {
    const user = userEvent.setup();
    const onPaymentStatusChange = vi.fn();

    render(<ExpenseList {...defaultProps} onPaymentStatusChange={onPaymentStatusChange} />);

    const select = screen.getByLabelText(/payment status/i);
    await user.click(select);

    const paidOption = await screen.findByText(/Fully Paid/i);
    await user.click(paidOption);

    expect(onPaymentStatusChange).toHaveBeenCalledWith('paid');
  });

  it('shows current payment status as selected value', () => {
    render(<ExpenseList {...defaultProps} selectedPaymentStatus="unpaid" />);

    const select = screen.getByLabelText(/payment status/i);
    expect(select).toHaveTextContent(/unpaid/i);
  });
});

describe('ExpenseList rendering', () => {
  it('renders expense rows with correct data (restaurant, amount, date, status)', () => {
    const expenses = [mockExpense()];

    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    // Restaurant name should be visible
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();

    // Amount should be formatted as currency
    expect(screen.getByText('$125.50')).toBeInTheDocument();

    // Status badge should be rendered (partial since 1 of 2 paid)
    expect(screen.getByText(/Partial/i)).toBeInTheDocument();

    // Table row should be present
    expect(screen.getAllByTestId(EXPENSE.EXPENSE_TABLE_ROW)).toHaveLength(1);

    // Detail link should have correct testid and be an anchor
    expect(screen.getByTestId(expenseDetailLinkId(1))).toBeInTheDocument();
  });

  it('renders multiple expense rows', () => {
    const expenses = [
      mockExpense(),
      mockExpense({ id: 2, amount: 89.0, restaurant: { id: 2, name: 'Another Place' } }),
    ];

    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Another Place')).toBeInTheDocument();
    expect(screen.getByText('$125.50')).toBeInTheDocument();
    expect(screen.getByText('$89.00')).toBeInTheDocument();
    expect(screen.getAllByTestId(EXPENSE.EXPENSE_TABLE_ROW)).toHaveLength(2);
  });
});

describe('ExpenseList search', () => {
  it('calls onSearchChange with input value when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(<ExpenseList {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    await user.type(searchInput, 'pizza');
    await user.keyboard('{Enter}');

    expect(onSearchChange).toHaveBeenCalledWith('pizza');
  });

  it('does not call onSearchChange without Enter key', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(<ExpenseList {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    await user.type(searchInput, 'pizza');

    expect(onSearchChange).not.toHaveBeenCalled();
  });
});

describe('ExpenseList debounced auto-search', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the search input when no onSearchChange is provided', () => {
    render(<ExpenseList {...defaultProps} onSearchChange={undefined} />);

    expect(screen.queryByTestId(EXPENSE.SEARCH_EXPENSES_INPUT)).not.toBeInTheDocument();
  });

  it('fires the debounced search once the settle delay elapses', async () => {
    vi.useFakeTimers();
    const onSearchChange = vi.fn();
    render(<ExpenseList {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    fireEvent.change(searchInput, { target: { value: 'ramen' } });
    expect(onSearchChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('ramen');
  });

  it('debounces rapid typing so only the last query fires', async () => {
    vi.useFakeTimers();
    const onSearchChange = vi.fn();
    render(<ExpenseList {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    fireEvent.change(searchInput, { target: { value: 'ra' } });
    await vi.advanceTimersByTimeAsync(200);
    fireEvent.change(searchInput, { target: { value: 'ramen' } });
    await vi.advanceTimersByTimeAsync(299);
    expect(onSearchChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('ramen');
  });

  it('does not refire when parents recreate onSearchChange without a query change', async () => {
    vi.useFakeTimers();
    const onSearchChange = vi.fn();
    const { rerender } = render(<ExpenseList {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    fireEvent.change(searchInput, { target: { value: 'ramen' } });
    await vi.advanceTimersByTimeAsync(300);
    expect(onSearchChange).toHaveBeenCalledTimes(1);

    // Pagination changes recreate the parent's callback identity; the identical
    // query must not re-trigger the server refetch (it would reset to page 1).
    rerender(<ExpenseList {...defaultProps} onSearchChange={vi.fn()} />);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
  });

  it('fires Enter search immediately when no debounce timer is pending', () => {
    const onSearchChange = vi.fn();
    render(<ExpenseList {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});

describe('ExpenseList row actions', () => {
  it('opens action menu and triggers edit callback', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const expenses = [mockExpense()];

    render(<ExpenseList {...defaultProps} expenses={expenses} onEdit={onEdit} />);

    // Click the row actions button to open dropdown
    const actionsBtn = screen.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
    await user.click(actionsBtn);

    // Click edit menu item
    const editItem = await screen.findByTestId(EXPENSE.EDIT_EXPENSE_MENUITEM);
    await user.click(editItem);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('opens action menu and triggers delete callback', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const expenses = [mockExpense()];

    render(<ExpenseList {...defaultProps} expenses={expenses} onDelete={onDelete} />);

    const actionsBtn = screen.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
    await user.click(actionsBtn);

    const deleteItem = await screen.findByTestId(EXPENSE.DELETE_EXPENSE_MENUITEM);
    await user.click(deleteItem);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('opens action menu and triggers duplicate callback', async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const expenses = [mockExpense()];

    render(<ExpenseList {...defaultProps} expenses={expenses} onDuplicate={onDuplicate} />);

    const actionsBtn = screen.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
    await user.click(actionsBtn);

    const duplicateItem = await screen.findByTestId(EXPENSE.DUPLICATE_EXPENSE_MENUITEM);
    await user.click(duplicateItem);

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe('ExpenseList empty state', () => {
  it('renders empty state with default title and description when no expenses', () => {
    render(<ExpenseList {...defaultProps} expenses={[]} />);

    expect(screen.getByText('No expenses found')).toBeInTheDocument();
    expect(screen.getByText('Get started by adding your first expense')).toBeInTheDocument();
  });

  it('renders empty state with custom title and description', () => {
    render(
      <ExpenseList
        {...defaultProps}
        expenses={[]}
        emptyTitle="Custom Empty"
        emptyDescription="Custom description text"
      />
    );

    expect(screen.getByText('Custom Empty')).toBeInTheDocument();
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('does not render empty state when expenses exist', () => {
    const expenses = [mockExpense()];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.queryByText('No expenses found')).not.toBeInTheDocument();
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });
});

describe('ExpenseList pagination', () => {
  const pagination = {
    page: 2,
    pageSize: 10,
    totalCount: 35,
    totalPages: 4,
    hasNextPage: true,
    hasPreviousPage: true,
  };

  it('renders pagination controls when pagination is provided', () => {
    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={vi.fn()}
      />
    );

    // Results count text appears twice (above table and in pagination footer)
    expect(screen.getAllByText(/Showing 11 to 20 of 35/i)).toHaveLength(2);

    // Page size selector label
    expect(screen.getByText(/Rows per page/i)).toBeInTheDocument();

    // Current page button should be active (variant default) - look for button specifically
    const pageTwoBtn = screen.getAllByRole('button').find((btn) => btn.textContent === '2');
    expect(pageTwoBtn).toBeInTheDocument();
  });

  it('calls onPaginationChange with next page when next button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    // Find and click the next page button (ChevronRight icon button)
    const allButtons = screen.getAllByRole('button');
    // The ChevronRight button is the one just before the last (ChevronsRight)
    const chevronRightBtn = allButtons[allButtons.length - 2];
    if (!chevronRightBtn) throw new Error('Next page button not found');
    await user.click(chevronRightBtn);

    expect(onPaginationChange).toHaveBeenCalledWith(3, 10);
  });

  it('calls onPaginationChange with previous page when prev button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    // Find the previous page button (ChevronLeft icon button)
    const allButtons = screen.getAllByRole('button');
    // ChevronLeft is the second button (after ChevronsLeft)
    const chevronLeftBtn = allButtons[1];
    if (!chevronLeftBtn) throw new Error('Previous page button not found');
    await user.click(chevronLeftBtn);

    expect(onPaginationChange).toHaveBeenCalledWith(1, 10);
  });

  it('disables previous button on first page', () => {
    const firstPagePagination = { ...pagination, page: 1, hasPreviousPage: false };

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={firstPagePagination}
        onPaginationChange={vi.fn()}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const chevronLeftBtn = allButtons[1];
    expect(chevronLeftBtn).toBeDisabled();
  });

  it('disables next button on last page', () => {
    const lastPagePagination = { ...pagination, page: 4, hasNextPage: false };

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={lastPagePagination}
        onPaginationChange={vi.fn()}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const chevronRightBtn = allButtons[allButtons.length - 2];
    expect(chevronRightBtn).toBeDisabled();
  });

  it('does not render pagination when totalCount is 0', () => {
    render(
      <ExpenseList
        {...defaultProps}
        expenses={[]}
        pagination={{ ...pagination, totalCount: 0 }}
        onPaginationChange={vi.fn()}
      />
    );

    expect(screen.queryByText(/Rows per page/i)).not.toBeInTheDocument();
  });
});

describe('ExpenseList loading state', () => {
  it('renders skeleton loaders when isLoading=true', () => {
    render(<ExpenseList {...defaultProps} expenses={[mockExpense()]} isLoading={true} />);
    // Skeleton placeholders should be in the DOM
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('hides table content when isLoading=true with existing expenses', () => {
    render(<ExpenseList {...defaultProps} expenses={[mockExpense()]} isLoading={true} />);
    // The table wrapper should have 'hidden' class
    const table = screen.queryByTestId(EXPENSE.EXPENSE_TABLE);
    if (table) {
      expect(table.parentElement?.parentElement?.className).toContain('hidden');
    }
  });
});

describe('ExpenseList colleague filter chips', () => {
  it('renders colleague filter chip when colleague selected', () => {
    render(
      <ExpenseList {...defaultProps} selectedColleagueIds={[1]} onColleagueChange={vi.fn()} />
    );
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onColleagueChange when removing a chip', async () => {
    const user = userEvent.setup();
    const onColleagueChange = vi.fn();
    render(
      <ExpenseList
        {...defaultProps}
        selectedColleagueIds={[1, 2]}
        onColleagueChange={onColleagueChange}
      />
    );

    const removeBtns = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeBtns[0]!);

    expect(onColleagueChange).toHaveBeenCalledWith([2]);
  });
});

describe('ExpenseList empty state variations', () => {
  it('renders simple empty state when showEmptyAddButton=false', () => {
    render(
      <ExpenseList
        {...defaultProps}
        expenses={[]}
        showEmptyAddButton={false}
        emptyTitle="No Data"
        emptyDescription="Nothing here"
      />
    );
    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    // AdminOnly wrapper should not render the action button
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
  });
});

describe('ExpenseList expense variations', () => {
  it('renders expense with receipt and notes', () => {
    const expenses = [
      mockExpense({
        receiptBucket: 'receipts',
        receiptObjectKey: 'key-1',
        notes: 'Team lunch notes',
      }),
    ];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('renders expense with all participants paid', () => {
    const expenses = [
      mockExpense({
        participants: [
          {
            id: 1,
            amount: 62.75,
            colleague: { id: 1, name: 'Alice' },
            expenseId: 1,
            colleagueId: 1,
            isPaid: true,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
          {
            id: 2,
            amount: 62.75,
            colleague: { id: 2, name: 'Bob' },
            expenseId: 1,
            colleagueId: 2,
            isPaid: true,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      }),
    ];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('renders expense with no participants', () => {
    const expenses = [mockExpense({ participants: [] })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);
    const elements = screen.getAllByText('No Participants');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onViewReceipt when receipt button clicked', async () => {
    const user = userEvent.setup();
    const onViewReceipt = vi.fn();
    const expenses = [
      mockExpense({
        receiptBucket: 'receipts',
        receiptObjectKey: 'key-1',
      }),
    ];
    render(<ExpenseList {...defaultProps} expenses={expenses} onViewReceipt={onViewReceipt} />);

    const receiptBtn = screen.getByTitle(/view receipt/i);
    await user.click(receiptBtn);
    expect(onViewReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe('ExpenseList mobile viewport', () => {
  it('renders mobile cards when viewport matches mobile', () => {
    setMatchMedia(true);
    render(<ExpenseList {...defaultProps} expenses={[mockExpense()]} />);

    expect(screen.getByTestId(EXPENSE.EXPENSE_MOBILE_LIST)).toBeInTheDocument();
    expect(screen.queryByTestId(EXPENSE.EXPENSE_TABLE)).not.toBeInTheDocument();
  });

  it('passes receipt click handler to mobile cards', async () => {
    setMatchMedia(true);
    const user = userEvent.setup();
    const onViewReceipt = vi.fn();
    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense({ receiptBucket: 'receipts', receiptObjectKey: 'key-1' })]}
        onViewReceipt={onViewReceipt}
      />
    );

    expect(screen.getByTestId(EXPENSE.EXPENSE_MOBILE_LIST)).toBeInTheDocument();

    const receiptBtn = screen.getByRole('button', { name: /receipt/i });
    await user.click(receiptBtn);

    expect(onViewReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe('ExpenseList participants display', () => {
  it('opens participants dropdown and shows unpaid participants', async () => {
    const user = userEvent.setup();
    const expenses = [
      mockExpense({
        participants: [
          {
            id: 1,
            amount: 62.75,
            colleague: { id: 1, name: 'Alice' },
            expenseId: 1,
            colleagueId: 1,
            isPaid: true,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
          {
            id: 2,
            amount: 62.75,
            colleague: null,
            expenseId: 1,
            colleagueId: 2,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      }),
    ];

    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    const row = screen.getByTestId(EXPENSE.EXPENSE_TABLE_ROW);
    const trigger = row.querySelector('.cursor-pointer');
    expect(trigger).toBeTruthy();
    await user.click(trigger!);

    expect(await screen.findByText(/Unpaid Participants \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows remaining participant count when more than four participants', () => {
    const expenses = [mockExpense({ participants: mockParticipants(6, 0) })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders all participants paid without dropdown', () => {
    const expenses = [mockExpense({ participants: mockParticipants(3, 3) })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText(/Unpaid Participants/i)).not.toBeInTheDocument();
  });
});

describe('ExpenseList action menu view receipt', () => {
  it('opens action menu and triggers view receipt callback', async () => {
    const user = userEvent.setup();
    const onViewReceipt = vi.fn();
    const expenses = [
      mockExpense({
        receiptBucket: 'receipts',
        receiptObjectKey: 'key-1',
      }),
    ];

    render(<ExpenseList {...defaultProps} expenses={expenses} onViewReceipt={onViewReceipt} />);

    const actionsBtn = screen.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
    await user.click(actionsBtn);

    const viewReceiptItem = await screen.findByText(/View Receipt/i);
    await user.click(viewReceiptItem);

    expect(onViewReceipt).toHaveBeenCalledTimes(1);
    expect(onViewReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('does not show view receipt when only bucket is present', () => {
    const expenses = [mockExpense({ receiptBucket: 'receipts' })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.queryByTitle(/view receipt/i)).not.toBeInTheDocument();
  });
});

describe('ExpenseList pagination interactions', () => {
  const pagination = {
    page: 2,
    pageSize: 10,
    totalCount: 35,
    totalPages: 4,
    hasNextPage: true,
    hasPreviousPage: true,
  };

  it('calls onPaginationChange with first page when first button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const firstBtn = screen.getByRole('button', { name: /first/i });
    await user.click(firstBtn);

    expect(onPaginationChange).toHaveBeenCalledWith(1, 10);
  });

  it('calls onPaginationChange with previous page when previous button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const prevBtn = screen.getByRole('button', { name: /previous/i });
    await user.click(prevBtn);

    expect(onPaginationChange).toHaveBeenCalledWith(1, 10);
  });

  it('calls onPaginationChange when a page number is clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const pageThreeBtn = screen.getByRole('button', { name: '3' });
    await user.click(pageThreeBtn);

    expect(onPaginationChange).toHaveBeenCalledWith(3, 10);
  });

  it('calls onPaginationChange with next page when next button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);

    expect(onPaginationChange).toHaveBeenCalledWith(3, 10);
  });

  it('calls onPaginationChange with last page when last button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const lastBtn = screen.getByRole('button', { name: /last/i });
    await user.click(lastBtn);

    expect(onPaginationChange).toHaveBeenCalledWith(4, 10);
  });

  it('calls onPaginationChange with new page size when page size changes', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const pageSizeSelect = screen.getByLabelText(/rows per page/i);
    await user.selectOptions(pageSizeSelect, '20');

    expect(onPaginationChange).toHaveBeenCalledWith(1, 20);
  });

  it('renders ellipsis buttons for large page ranges', () => {
    const widePagination = {
      page: 5,
      pageSize: 10,
      totalCount: 95,
      totalPages: 10,
      hasNextPage: true,
      hasPreviousPage: true,
    };

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={widePagination}
        onPaginationChange={vi.fn()}
      />
    );

    const ellipsisButtons = screen.getAllByText('...');
    expect(ellipsisButtons.length).toBeGreaterThanOrEqual(1);
    ellipsisButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('renders pagination with a single page', () => {
    const singlePagePagination = {
      page: 1,
      pageSize: 10,
      totalCount: 5,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    render(
      <ExpenseList
        {...defaultProps}
        expenses={[mockExpense()]}
        pagination={singlePagePagination}
        onPaginationChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });
});

describe('ExpenseList colleague filter', () => {
  it('calls onColleagueChange with selected colleague id', async () => {
    const user = userEvent.setup();
    const onColleagueChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        onColleagueChange={onColleagueChange}
        colleagues={defaultProps.colleagues}
      />
    );

    const select = screen.getByLabelText(/colleague filter/i);
    await user.click(select);

    const option = await screen.findByText('Alice');
    await user.click(option);

    expect(onColleagueChange).toHaveBeenCalledWith([1]);
  });

  it('calls onColleagueChange with empty array when selecting all colleagues', async () => {
    const user = userEvent.setup();
    const onColleagueChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        onColleagueChange={onColleagueChange}
        selectedColleagueIds={[1]}
        colleagues={defaultProps.colleagues}
      />
    );

    const select = screen.getByLabelText(/colleague filter/i);
    await user.click(select);

    const allOption = await screen.findByText(/all colleagues/i);
    await user.click(allOption);

    expect(onColleagueChange).toHaveBeenCalledWith([]);
  });

  it('skips rendering chip for a missing colleague', () => {
    render(
      <ExpenseList
        {...defaultProps}
        selectedColleagueIds={[1, 999]}
        colleagues={defaultProps.colleagues}
        onColleagueChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Remove Alice filter/i)).toBeInTheDocument();
  });
});

describe('ExpenseList payment status filter coverage', () => {
  it('calls onPaymentStatusChange for unpaid status', async () => {
    const user = userEvent.setup();
    const onPaymentStatusChange = vi.fn();

    render(<ExpenseList {...defaultProps} onPaymentStatusChange={onPaymentStatusChange} />);

    const select = screen.getByLabelText(/payment status/i);
    await user.click(select);

    const option = await screen.findByText(/Unpaid/i);
    await user.click(option);

    expect(onPaymentStatusChange).toHaveBeenCalledWith('unpaid');
  });

  it('calls onPaymentStatusChange for partial status', async () => {
    const user = userEvent.setup();
    const onPaymentStatusChange = vi.fn();

    render(<ExpenseList {...defaultProps} onPaymentStatusChange={onPaymentStatusChange} />);

    const select = screen.getByLabelText(/payment status/i);
    await user.click(select);

    const option = await screen.findByText(/Partial/i);
    await user.click(option);

    expect(onPaymentStatusChange).toHaveBeenCalledWith('partial');
  });

  it('calls onPaymentStatusChange for all status', async () => {
    const user = userEvent.setup();
    const onPaymentStatusChange = vi.fn();

    render(
      <ExpenseList
        {...defaultProps}
        onPaymentStatusChange={onPaymentStatusChange}
        selectedPaymentStatus="paid"
      />
    );

    const select = screen.getByLabelText(/payment status/i);
    await user.click(select);

    const option = await screen.findByText(/All Status/i);
    await user.click(option);

    expect(onPaymentStatusChange).toHaveBeenCalledWith('all');
  });
});

describe('ExpenseList edge cases', () => {
  it('renders unpaid status badge when all participants are unpaid', () => {
    const expenses = [mockExpense({ participants: mockParticipants(2, 0) })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText(/Unpaid/i)).toBeInTheDocument();
  });

  it('renders unknown restaurant name when restaurant is missing', () => {
    const expenses = [mockExpense({ restaurant: null })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText(/Unknown Restaurant/i)).toBeInTheDocument();
  });

  it('does not render address when restaurant address is missing', () => {
    const expenses = [mockExpense({ restaurant: { id: 1, name: 'No Address Place' } })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText('No Address Place')).toBeInTheDocument();
    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
  });

  it('renders expense with date as Date object', () => {
    const expenses = [mockExpense({ date: new Date('2024-03-15') })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('renders notes icon when expense has notes', () => {
    const expenses = [mockExpense({ notes: 'Team lunch notes' })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByTitle('Team lunch notes')).toBeInTheDocument();
  });

  it('renders expense without participants property', () => {
    const expenses = [mockExpense({ participants: undefined })];
    render(<ExpenseList {...defaultProps} expenses={expenses} />);

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('handles empty state add action when onAddExpense is not provided', async () => {
    const user = userEvent.setup();
    render(<ExpenseList {...defaultProps} expenses={[]} showEmptyAddButton />);

    const addBtn = screen.getByRole('button', { name: /add first expense/i });
    await user.click(addBtn);

    expect(addBtn).toBeInTheDocument();
  });
});

describe('ExpenseList server rendering', () => {
  it('uses server snapshot for useSyncExternalStore during SSR', () => {
    const { renderToString } = require('react-dom/server');
    const html = renderToString(<ExpenseList {...defaultProps} expenses={[mockExpense()]} />);
    expect(html).toContain('Test Restaurant');
  });
});

describe('ExpenseList admin variations', () => {
  it('does not show admin actions when user is not admin', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue(mockAuthValue(false));

    render(<ExpenseList {...defaultProps} expenses={[mockExpense()]} />);

    const actionsBtn = screen.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
    await user.click(actionsBtn);

    expect(screen.queryByTestId(EXPENSE.EDIT_EXPENSE_MENUITEM)).not.toBeInTheDocument();
    expect(screen.queryByTestId(EXPENSE.DELETE_EXPENSE_MENUITEM)).not.toBeInTheDocument();
    expect(screen.queryByTestId(EXPENSE.DUPLICATE_EXPENSE_MENUITEM)).not.toBeInTheDocument();
  });
});
