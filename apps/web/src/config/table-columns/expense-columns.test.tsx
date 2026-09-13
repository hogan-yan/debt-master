import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Expense } from '@/types';
import { createExpenseColumns } from './expense-columns';

interface MockLinkProps {
  to?: string;
  params?: Record<string, string>;
  children?: React.ReactNode;
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to = '', params = {}, children }: MockLinkProps) => (
    <a href={to.replace('$id', params.id ?? '')}>{children}</a>
  ),
}));

function createExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    date: '2024-01-15',
    amount: 100,
    splitType: 'EQUAL',
    ...overrides,
  };
}

function findColumn<TData>(
  columns: ColumnDef<TData>[],
  key: string
): ColumnDef<TData> & { accessorKey?: string; id?: string } {
  const col = columns.find((c) => {
    if ('accessorKey' in c && c.accessorKey === key) return true;
    if ('id' in c && c.id === key) return true;
    return false;
  });
  if (!col) throw new Error(`Column not found: ${key}`);
  return col as ColumnDef<TData> & { accessorKey?: string; id?: string };
}

function invokeCell<TData>(
  column: ColumnDef<TData>,
  row: TData,
  getValue: (key: string) => unknown
): React.ReactNode {
  const cellFn = column.cell;
  if (typeof cellFn !== 'function') throw new Error('cell is not a function');

  const ctx = {
    row: {
      getValue,
      original: row,
    },
    column: {},
    cell: {},
    table: {},
    renderValue: () => undefined,
  } as unknown as CellContext<TData, unknown>;

  return cellFn(ctx);
}

describe('createExpenseColumns', () => {
  describe('date column', () => {
    it('renders date with CompactDateWithBadge', () => {
      const expense = createExpense({ date: '2024-01-15' });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'date');
      const result = invokeCell(col, expense, (key) => (key === 'date' ? expense.date : undefined));
      render(result);
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    });
  });

  describe('restaurant column', () => {
    it('renders restaurant name when present', () => {
      const expense = createExpense({
        restaurant: { id: 1, name: 'Pizza Hut' },
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'restaurant');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('Pizza Hut')).toBeInTheDocument();
    });

    it('renders Unknown Restaurant when restaurant is null', () => {
      const expense = createExpense({ restaurant: null });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'restaurant');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('Unknown Restaurant')).toBeInTheDocument();
    });

    it('renders Unknown Restaurant when restaurant is undefined', () => {
      const expense = createExpense({ restaurant: undefined });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'restaurant');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('Unknown Restaurant')).toBeInTheDocument();
    });
  });

  describe('amount column', () => {
    it('renders formatted amount right-aligned', () => {
      const expense = createExpense({ amount: 250.5 });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'amount');
      const result = invokeCell(col, expense, (key) =>
        key === 'amount' ? expense.amount : undefined
      );
      render(result);
      expect(screen.getByText('$250.50')).toBeInTheDocument();
    });
  });

  describe('participants column', () => {
    it('renders up to 3 participant avatars', () => {
      const expense = createExpense({
        participants: [
          {
            id: 1,
            amount: 50,
            colleague: { id: 1, name: 'Alice' },
            expenseId: 1,
            colleagueId: 1,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
          {
            id: 2,
            amount: 50,
            colleague: { id: 2, name: 'Bob' },
            expenseId: 1,
            colleagueId: 2,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'participants');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('shows overflow count when more than 3 participants', () => {
      const expense = createExpense({
        participants: [
          {
            id: 1,
            amount: 25,
            colleague: { id: 1, name: 'Alice' },
            expenseId: 1,
            colleagueId: 1,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
          {
            id: 2,
            amount: 25,
            colleague: { id: 2, name: 'Bob' },
            expenseId: 1,
            colleagueId: 2,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
          {
            id: 3,
            amount: 25,
            colleague: { id: 3, name: 'Carol' },
            expenseId: 1,
            colleagueId: 3,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
          {
            id: 4,
            amount: 25,
            colleague: { id: 4, name: 'David' },
            expenseId: 1,
            colleagueId: 4,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'participants');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('renders nothing when participants is empty array', () => {
      const expense = createExpense({ participants: [] });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'participants');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });

    it('renders nothing when participants is undefined', () => {
      const expense = createExpense({ participants: undefined });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'participants');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });

    it('handles participant with missing colleague', () => {
      const expense = createExpense({
        participants: [
          {
            id: 1,
            amount: 50,
            colleague: null,
            expenseId: 1,
            colleagueId: 1,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'participants');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      // The avatar shows "U" for "Unknown" when colleague name is missing
      expect(screen.getByText('U')).toBeInTheDocument();
    });
  });

  describe('settlementStatus column', () => {
    it('renders fully paid status when all participants paid', () => {
      const expense = createExpense({
        participants: [
          {
            id: 1,
            amount: 50,
            colleague: { id: 1, name: 'Alice' },
            expenseId: 1,
            colleagueId: 1,
            isPaid: true,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'settlementStatus');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('Fully Paid')).toBeInTheDocument();
    });

    it('renders unpaid status when no participants paid', () => {
      const expense = createExpense({
        participants: [
          {
            id: 1,
            amount: 50,
            colleague: { id: 1, name: 'Alice' },
            expenseId: 1,
            colleagueId: 1,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'settlementStatus');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('Unpaid')).toBeInTheDocument();
    });

    it('renders partial status when some participants paid', () => {
      const expense = createExpense({
        participants: [
          {
            id: 1,
            amount: 50,
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
            amount: 50,
            colleague: { id: 2, name: 'Bob' },
            expenseId: 1,
            colleagueId: 2,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ],
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'settlementStatus');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('Partial (1/2)')).toBeInTheDocument();
    });

    it('renders no participants status when participants array is empty', () => {
      const expense = createExpense({ participants: [] });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'settlementStatus');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('No Participants')).toBeInTheDocument();
    });
  });

  describe('receipt column', () => {
    it('renders View Receipt button when receipt exists and handler provided', () => {
      const onViewReceipt = vi.fn();
      const expense = createExpense({
        receiptBucket: 'receipts',
        receiptObjectKey: 'receipt-1.jpg',
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
        onViewReceipt,
      });
      const col = findColumn(columns, 'receipt');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('View Receipt')).toBeInTheDocument();
    });

    it('calls onViewReceipt when View Receipt button clicked', async () => {
      const onViewReceipt = vi.fn();
      const expense = createExpense({
        id: 42,
        receiptBucket: 'receipts',
        receiptObjectKey: 'receipt-1.jpg',
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
        onViewReceipt,
      });
      const col = findColumn(columns, 'receipt');
      const result = invokeCell(col, expense, () => undefined);
      render(result);

      await userEvent.click(screen.getByText('View Receipt'));
      expect(onViewReceipt).toHaveBeenCalledTimes(1);
      expect(onViewReceipt).toHaveBeenCalledWith(expense);
    });

    it('renders No receipt when receipt is missing', () => {
      const expense = createExpense({
        receiptBucket: null,
        receiptObjectKey: null,
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
        onViewReceipt: vi.fn(),
      });
      const col = findColumn(columns, 'receipt');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('No receipt')).toBeInTheDocument();
    });

    it('renders No receipt when onViewReceipt handler is not provided', () => {
      const expense = createExpense({
        receiptBucket: 'receipts',
        receiptObjectKey: 'receipt-1.jpg',
      });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'receipt');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByText('No receipt')).toBeInTheDocument();
    });
  });

  describe('actions column', () => {
    it('renders actions dropdown menu trigger', () => {
      const expense = createExpense();
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, expense, () => undefined);
      render(result);
      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    it('shows admin edit, duplicate, and delete options when isAdmin is true', async () => {
      const expense = createExpense();
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, expense, () => undefined);
      render(result);

      await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('does not show admin options when isAdmin is false', async () => {
      const expense = createExpense();
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
        isAdmin: false,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, expense, () => undefined);
      render(result);

      await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit menu item clicked', async () => {
      const onEdit = vi.fn();
      const expense = createExpense({ id: 42 });
      const columns = createExpenseColumns({
        onEdit,
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, expense, () => undefined);
      render(result);

      await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
      await userEvent.click(screen.getByText('Edit'));
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onEdit).toHaveBeenCalledWith(expense);
    });

    it('calls onDelete when delete menu item clicked', async () => {
      const onDelete = vi.fn();
      const expense = createExpense({ id: 42 });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete,
        onDuplicate: vi.fn(),
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, expense, () => undefined);
      render(result);

      await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
      await userEvent.click(screen.getByText('Delete'));
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(expense);
    });

    it('calls onDuplicate when duplicate menu item clicked', async () => {
      const onDuplicate = vi.fn();
      const expense = createExpense({ id: 42 });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate,
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, expense, () => undefined);
      render(result);

      await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
      await userEvent.click(screen.getByText('Duplicate'));
      expect(onDuplicate).toHaveBeenCalledTimes(1);
      expect(onDuplicate).toHaveBeenCalledWith(expense);
    });

    it('renders view details link', async () => {
      const expense = createExpense({ id: 42 });
      const columns = createExpenseColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, expense, () => undefined);
      render(result);

      await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
      const link = screen.getByRole('link', { name: 'View Details' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/expense/42/');
    });
  });
});
