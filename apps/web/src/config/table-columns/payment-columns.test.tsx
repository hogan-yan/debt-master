import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Payment } from '@/types';
import { createPaymentColumns } from './payment-columns';

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

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    colleagueId: 1,
    amount: 100,
    date: '2024-01-15',
    paymentType: 'CASH',
    isApproved: true,
    createdAt: '2024-01-15',
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

describe('createPaymentColumns', () => {
  describe('date column', () => {
    it('renders date with CompactDateWithBadge for string date', () => {
      const payment = createPayment({ date: '2024-01-15' });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'date');
      const result = invokeCell(col, payment, (key) => (key === 'date' ? payment.date : undefined));
      render(result);
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    });

    it('renders date with CompactDateWithBadge for Date object', () => {
      const payment = createPayment({ date: new Date('2024-06-20') });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'date');
      const result = invokeCell(col, payment, (key) => (key === 'date' ? payment.date : undefined));
      render(result);
      expect(screen.getByText('Jun 20, 2024')).toBeInTheDocument();
    });
  });

  describe('colleagueName column', () => {
    it('renders colleague name and avatar when colleague exists', () => {
      const payment = createPayment({
        colleague: { id: 1, name: 'Alice Smith' },
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'colleagueName');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('renders Unknown when colleague is missing', () => {
      const payment = createPayment({ colleague: undefined });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'colleagueName');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('amount column', () => {
    it('renders formatted amount', () => {
      const payment = createPayment({ amount: 250.5 });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'amount');
      const result = invokeCell(col, payment, (key) =>
        key === 'amount' ? payment.amount : undefined
      );
      render(result);
      expect(screen.getByText('$250.50')).toBeInTheDocument();
    });

    it('shows credit badge when payment has unused credit', () => {
      const payment = createPayment({
        amount: 300,
        applications: [{ id: 1, amount: 100, appliedAt: '2024-01-15' }],
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'amount');
      const result = invokeCell(col, payment, (key) =>
        key === 'amount' ? payment.amount : undefined
      );
      render(result);
      expect(screen.getByText('$300.00')).toBeInTheDocument();
      expect(screen.getByText(/\$200\.00\s+credit/)).toBeInTheDocument();
    });

    it('does not show credit badge when fully applied', () => {
      const payment = createPayment({
        amount: 100,
        applications: [{ id: 1, amount: 100, appliedAt: '2024-01-15' }],
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'amount');
      const result = invokeCell(col, payment, (key) =>
        key === 'amount' ? payment.amount : undefined
      );
      render(result);
      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.queryByText(/credit/)).not.toBeInTheDocument();
    });

    it('shows credit badge for empty applications array (full amount unused)', () => {
      const payment = createPayment({ amount: 100, applications: [] });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'amount');
      const result = invokeCell(col, payment, (key) =>
        key === 'amount' ? payment.amount : undefined
      );
      render(result);
      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByText(/\$100\.00\s+credit/)).toBeInTheDocument();
    });
  });

  describe('paymentType column', () => {
    it('renders CASH badge with correct text', () => {
      const payment = createPayment({ paymentType: 'CASH' });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'paymentType');
      const result = invokeCell(col, payment, (key) =>
        key === 'paymentType' ? payment.paymentType : undefined
      );
      render(result);
      expect(screen.getByText('Cash')).toBeInTheDocument();
    });

    it('renders FPS badge with correct text', () => {
      const payment = createPayment({ paymentType: 'FPS' });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'paymentType');
      const result = invokeCell(col, payment, (key) =>
        key === 'paymentType' ? payment.paymentType : undefined
      );
      render(result);
      expect(screen.getByText('FPS')).toBeInTheDocument();
    });

    it('renders PAYME badge with correct text', () => {
      const payment = createPayment({ paymentType: 'PAYME' });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'paymentType');
      const result = invokeCell(col, payment, (key) =>
        key === 'paymentType' ? payment.paymentType : undefined
      );
      render(result);
      expect(screen.getByText('PayMe')).toBeInTheDocument();
    });

    it('renders OTHER badge with fallback text', () => {
      const payment = createPayment({ paymentType: 'OTHER' });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'paymentType');
      const result = invokeCell(col, payment, (key) =>
        key === 'paymentType' ? payment.paymentType : undefined
      );
      render(result);
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('renders unknown type with raw value fallback', () => {
      const payment = createPayment({ paymentType: 'UNKNOWN_TYPE' as 'CASH' });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'paymentType');
      const result = invokeCell(col, payment, (key) =>
        key === 'paymentType' ? payment.paymentType : undefined
      );
      render(result);
      expect(screen.getByText('UNKNOWN_TYPE')).toBeInTheDocument();
    });
  });

  describe('applications column', () => {
    it('renders pure prepayment message when no applications and no expense', () => {
      const payment = createPayment({ applications: [], expense: null });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'applications');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('Available as credit')).toBeInTheDocument();
    });

    it('renders legacy single expense link when no applications but has expense', () => {
      const payment = createPayment({
        applications: [],
        expense: {
          id: 5,
          date: '2024-01-10',
          amount: 100,
          restaurant: { id: 1, name: 'Burger King' },
        },
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onGoToSpecificExpense: vi.fn(),
      });
      const col = findColumn(columns, 'applications');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('Burger King')).toBeInTheDocument();
    });

    it('renders single application with expense name and amount', () => {
      const payment = createPayment({
        applications: [
          {
            id: 1,
            amount: 75,
            appliedAt: '2024-01-15',
            expense: {
              id: 3,
              date: '2024-01-10',
              restaurant: { id: 1, name: 'Pizza Hut' },
            },
          },
        ],
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'applications');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('Pizza Hut')).toBeInTheDocument();
      expect(screen.getByText('$75.00')).toBeInTheDocument();
    });

    it('renders unknown when single application has no expense', () => {
      const payment = createPayment({
        applications: [
          {
            id: 1,
            amount: 75,
            appliedAt: '2024-01-15',
            expense: null,
          },
        ],
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'applications');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders multiple applications with expand toggle', () => {
      const payment = createPayment({
        amount: 300,
        applications: [
          {
            id: 1,
            amount: 100,
            appliedAt: '2024-01-15',
            expense: {
              id: 2,
              date: '2024-01-10',
              restaurant: { id: 1, name: 'KFC' },
            },
          },
          {
            id: 2,
            amount: 50,
            appliedAt: '2024-01-16',
            expense: {
              id: 3,
              date: '2024-01-11',
              restaurant: { id: 2, name: 'McDonald' },
            },
          },
        ],
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'applications');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('2 expenses')).toBeInTheDocument();
      expect(screen.getByText(/\$150\.00 applied/)).toBeInTheDocument();
    });

    it('shows remaining credit for single application', () => {
      const payment = createPayment({
        amount: 300,
        applications: [
          {
            id: 1,
            amount: 100,
            appliedAt: '2024-01-15',
            expense: {
              id: 2,
              date: '2024-01-10',
              restaurant: { id: 1, name: 'KFC' },
            },
          },
        ],
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'applications');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByText('KFC')).toBeInTheDocument();
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });

    it('expands to show application details when toggle clicked', async () => {
      const payment = createPayment({
        amount: 300,
        applications: [
          {
            id: 1,
            amount: 100,
            appliedAt: '2024-01-15',
            expense: {
              id: 2,
              date: '2024-01-10',
              restaurant: { id: 1, name: 'KFC' },
            },
          },
          {
            id: 2,
            amount: 50,
            appliedAt: '2024-01-16',
            expense: {
              id: 3,
              date: '2024-01-11',
              restaurant: { id: 2, name: 'McDonald' },
            },
          },
        ],
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'applications');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      const toggleBtn = screen.getByRole('button');
      await userEvent.click(toggleBtn);

      expect(screen.getByText('KFC')).toBeInTheDocument();
      expect(screen.getByText('McDonald')).toBeInTheDocument();
      expect(screen.getByText('Remaining Credit:')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });
  });

  describe('isApproved column', () => {
    it('renders approved status with CheckCircle icon', () => {
      const payment = createPayment({ isApproved: true });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'isApproved');
      const result = invokeCell(col, payment, (key) =>
        key === 'isApproved' ? payment.isApproved : undefined
      );
      render(result);
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('renders pending status with Clock icon', () => {
      const payment = createPayment({ isApproved: false });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'isApproved');
      const result = invokeCell(col, payment, (key) =>
        key === 'isApproved' ? payment.isApproved : undefined
      );
      render(result);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('actions column', () => {
    it('renders actions dropdown menu trigger', () => {
      const payment = createPayment();
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);
      expect(screen.getByTestId('row-actions-btn')).toBeInTheDocument();
    });

    it('shows view payment proof option when proof exists and handler provided', async () => {
      const onViewPaymentProof = vi.fn();
      const payment = createPayment({
        paymentProofBucket: 'proofs',
        paymentProofObjectKey: 'proof-1.jpg',
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onViewPaymentProof,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      expect(screen.getByText('View Payment Proof')).toBeInTheDocument();
    });

    it('does not show view payment proof when proof missing', async () => {
      const onViewPaymentProof = vi.fn();
      const payment = createPayment({
        paymentProofBucket: null,
        paymentProofObjectKey: null,
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onViewPaymentProof,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      expect(screen.queryByText('View Payment Proof')).not.toBeInTheDocument();
    });

    it('shows view related expense option when expense exists and handler provided', async () => {
      const onGoToExpense = vi.fn();
      const payment = createPayment({
        expense: {
          id: 5,
          date: '2024-01-10',
          amount: 100,
          restaurant: { id: 1, name: 'Burger King' },
        },
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onGoToExpense,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      expect(screen.getByText('View Related Expense')).toBeInTheDocument();
    });

    it('shows admin edit and delete options when isAdmin is true', async () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      const payment = createPayment();
      const columns = createPaymentColumns({
        onEdit,
        onDelete,
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      expect(screen.getByText('Edit payment')).toBeInTheDocument();
      expect(screen.getByText('Delete payment')).toBeInTheDocument();
    });

    it('does not show admin options when isAdmin is false', async () => {
      const payment = createPayment();
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        isAdmin: false,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      expect(screen.queryByText('Edit payment')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete payment')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit menu item clicked', async () => {
      const onEdit = vi.fn();
      const payment = createPayment({ id: 42 });
      const columns = createPaymentColumns({
        onEdit,
        onDelete: vi.fn(),
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      await userEvent.click(screen.getByText('Edit payment'));
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onEdit).toHaveBeenCalledWith(payment);
    });

    it('calls onDelete when delete menu item clicked', async () => {
      const onDelete = vi.fn();
      const payment = createPayment({ id: 42 });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete,
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      await userEvent.click(screen.getByText('Delete payment'));
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(payment);
    });

    it('calls onViewPaymentProof when view proof clicked', async () => {
      const onViewPaymentProof = vi.fn();
      const payment = createPayment({
        id: 42,
        paymentProofBucket: 'proofs',
        paymentProofObjectKey: 'proof-1.jpg',
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onViewPaymentProof,
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      await userEvent.click(screen.getByText('View Payment Proof'));
      expect(onViewPaymentProof).toHaveBeenCalledTimes(1);
      expect(onViewPaymentProof).toHaveBeenCalledWith(payment);
    });

    it('calls onGoToExpense when view related expense clicked', async () => {
      const onGoToExpense = vi.fn();
      const payment = createPayment({
        id: 42,
        expense: {
          id: 5,
          date: '2024-01-10',
          amount: 100,
          restaurant: { id: 1, name: 'Burger King' },
        },
      });
      const columns = createPaymentColumns({
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onGoToExpense,
        isAdmin: true,
      });
      const col = findColumn(columns, 'actions');
      const result = invokeCell(col, payment, () => undefined);
      render(result);

      await userEvent.click(screen.getByTestId('row-actions-btn'));
      await userEvent.click(screen.getByText('View Related Expense'));
      expect(onGoToExpense).toHaveBeenCalledTimes(1);
      expect(onGoToExpense).toHaveBeenCalledWith(payment);
    });
  });

  it('renders every functional column header', () => {
    const columns = createPaymentColumns({
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });

    for (const column of columns) {
      if (typeof column.header === 'function') {
        render(column.header({} as never));
      }
    }

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Colleague')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
    expect(screen.getByText('Applied to Expenses')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('navigates from an expanded payment application', async () => {
    const onGoToSpecificExpense = vi.fn();
    const payment = createPayment({
      amount: 100,
      applications: [
        {
          id: 1,
          amount: 50,
          appliedAt: '2024-01-15',
          expense: { id: 7, date: '2024-01-15', restaurant: { id: 1, name: 'Cafe' } },
        },
        {
          id: 2,
          amount: 50,
          appliedAt: '2024-01-15',
          expense: { id: 8, date: '2024-01-15', restaurant: { id: 2, name: 'Diner' } },
        },
      ],
    });
    const column = findColumn(
      createPaymentColumns({ onEdit: vi.fn(), onDelete: vi.fn(), onGoToSpecificExpense }),
      'applications'
    );

    render(invokeCell(column, payment, () => undefined));
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Cafe'));

    expect(onGoToSpecificExpense).toHaveBeenCalledWith(7);
  });
});
