import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Expense } from '@/types';
import { createExpenseColumns, expenseColumns } from '../expense-columns';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => (args?: Record<string, unknown>) =>
        args ? `${String(key)}-${JSON.stringify(args)}` : String(key),
    }
  ),
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
  getSettlementStatusBadge: (
    participants: {
      isPaid?: boolean;
      isPending?: boolean;
      paymentProofBucket?: string | null;
      paymentProofObjectKey?: string | null;
    }[]
  ) => {
    const total = participants?.length ?? 0;
    const paid = participants?.filter((p) => p.isPaid).length ?? 0;
    if (total === 0) return { text: 'no-participants', className: 'badge-users', icon: 'Users' };
    if (paid === total) return { text: 'paid', className: 'badge-success', icon: 'CheckCircle' };
    if (paid === 0) return { text: 'unpaid', className: 'badge-danger', icon: 'Clock' };
    return { text: 'partial', className: 'badge-warning', icon: 'Clock' };
  },
}));

vi.mock('@/components/ui/avatar', () => ({
  EnhancedAvatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/date-badge', () => ({
  CompactDateWithBadge: ({ dateString }: { dateString: string }) => (
    <span data-testid="date-badge">{dateString}</span>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
  DropdownMenuItem: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to.replace('$id', params?.id ?? '')} {...props}>
      {children}
    </a>
  ),
}));

const baseExpense: Expense = {
  id: 1,
  date: '2024-06-15',
  amount: 100,
  restaurant: { id: 1, name: 'Bistro' },
  restaurantId: 1,
  splitType: 'EQUAL',
  participants: [],
  createdAt: '2024-06-15',
  updatedAt: '2024-06-15',
};

function TestTable({
  data,
  actions,
}: {
  data: Expense[];
  actions?: Parameters<typeof createExpenseColumns>[0];
}) {
  const columns = createExpenseColumns(
    actions ?? {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      isAdmin: false,
    }
  );

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} data-column={cell.column.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('expense columns', () => {
  it('renders date, restaurant and amount cells', () => {
    render(<TestTable data={[baseExpense]} />);
    expect(screen.getByTestId('date-badge')).toHaveTextContent('2024-06-15');
    expect(screen.getByText('Bistro')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('shows unknown restaurant fallback', () => {
    render(<TestTable data={[{ ...baseExpense, restaurant: null }]} />);
    expect(screen.getByText('expense_detail_unknownRestaurant')).toBeInTheDocument();
  });

  it('renders up to three participant avatars', () => {
    render(
      <TestTable
        data={[
          {
            ...baseExpense,
            participants: [
              {
                id: 1,
                amount: 50,
                colleagueId: 1,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 1, name: 'A' },
              },
              {
                id: 2,
                amount: 50,
                colleagueId: 2,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 2, name: 'B' },
              },
              {
                id: 3,
                amount: 50,
                colleagueId: 3,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 3, name: 'C' },
              },
            ],
          },
        ]}
      />
    );
    expect(screen.getAllByTestId('avatar')).toHaveLength(3);
  });

  it('treats missing participants as an empty list', () => {
    render(<TestTable data={[{ ...baseExpense, participants: undefined }]} />);

    expect(screen.queryByTestId('avatar')).not.toBeInTheDocument();
    expect(screen.getByText('no-participants')).toBeInTheDocument();
  });

  it('shows overflow count for more than three participants', () => {
    render(
      <TestTable
        data={[
          {
            ...baseExpense,
            participants: [
              {
                id: 1,
                amount: 25,
                colleagueId: 1,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 1, name: 'A' },
              },
              {
                id: 2,
                amount: 25,
                colleagueId: 2,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 2, name: 'B' },
              },
              {
                id: 3,
                amount: 25,
                colleagueId: 3,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 3, name: 'C' },
              },
              {
                id: 4,
                amount: 25,
                colleagueId: 4,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 4, name: 'D' },
              },
            ],
          },
        ]}
      />
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders each settlement status', () => {
    const { container } = render(
      <TestTable
        data={[
          {
            ...baseExpense,
            id: 1,
            participants: [
              {
                id: 1,
                amount: 100,
                colleagueId: 1,
                expenseId: 1,
                isPaid: true,
                isPending: false,
                hasPartialPayment: false,
                submittedAt: null,
              },
            ],
          },
          {
            ...baseExpense,
            id: 2,
            participants: [
              {
                id: 2,
                amount: 100,
                colleagueId: 1,
                expenseId: 2,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
              },
            ],
          },
          { ...baseExpense, id: 3, participants: [] },
        ]}
      />
    );
    expect(container.textContent).toContain('paid');
    expect(container.textContent).toContain('unpaid');
    expect(container.textContent).toContain('no-participants');
  });

  it('exercises pending participant payment proof branch', () => {
    const { container } = render(
      <TestTable
        data={[
          {
            ...baseExpense,
            participants: [
              {
                id: 1,
                amount: 100,
                colleagueId: 1,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                paymentProofBucket: 'proofs',
                paymentProofObjectKey: 'proof.jpg',
              },
            ],
          },
        ]}
      />
    );
    expect(container.textContent).toContain('unpaid');
  });

  it('renders receipt view button when receipt and handler exist', async () => {
    const user = userEvent.setup();
    const onViewReceipt = vi.fn();
    render(
      <TestTable
        data={[
          {
            ...baseExpense,
            receiptBucket: 'receipts',
            receiptObjectKey: 'r.jpg',
          },
        ]}
        actions={{
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          onDuplicate: vi.fn(),
          onViewReceipt,
          isAdmin: false,
        }}
      />
    );

    await user.click(screen.getByText('expense_action_viewReceipt'));
    expect(onViewReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('shows no receipt text when receipt is missing', () => {
    render(<TestTable data={[baseExpense]} />);
    expect(screen.getByText('expense_detail_noReceipt')).toBeInTheDocument();
  });

  it('renders admin action items', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    render(
      <TestTable
        data={[baseExpense]}
        actions={{
          onEdit,
          onDelete,
          onDuplicate,
          isAdmin: true,
        }}
      />
    );

    expect(screen.getByText('expense_action_view')).toBeInTheDocument();
    expect(screen.getByText('expense_action_edit')).toBeInTheDocument();
    expect(screen.getByText('expense_action_duplicate')).toBeInTheDocument();
    expect(screen.getByText('expense_action_delete')).toBeInTheDocument();
    await user.click(screen.getByText('expense_action_edit'));
    await user.click(screen.getByText('expense_action_duplicate'));
    await user.click(screen.getByText('expense_action_delete'));
    expect(onEdit).toHaveBeenCalledWith(baseExpense);
    expect(onDuplicate).toHaveBeenCalledWith(baseExpense);
    expect(onDelete).toHaveBeenCalledWith(baseExpense);
  });

  it('renders default expense columns action buttons', () => {
    function DefaultTable({ data }: { data: Expense[] }) {
      const table = useReactTable({
        columns: expenseColumns,
        data,
        getCoreRowModel: getCoreRowModel(),
      });

      return (
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    render(<DefaultTable data={[baseExpense]} />);

    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders default columns with unknown restaurant and participant fallbacks', () => {
    function DefaultTable({ data }: { data: Expense[] }) {
      const table = useReactTable({
        columns: expenseColumns,
        data,
        getCoreRowModel: getCoreRowModel(),
      });

      return (
        <table>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    render(
      <DefaultTable
        data={[
          {
            ...baseExpense,
            restaurant: null,
            participants: [
              {
                id: 1,
                amount: 100,
                colleagueId: 1,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                // no colleague object
              },
            ],
          },
          {
            ...baseExpense,
            id: 2,
            restaurant: null,
            participants: undefined,
          },
        ]}
      />
    );

    expect(screen.getAllByText('expense_detail_unknownRestaurant')).toHaveLength(2);
    expect(screen.getAllByText('common_unknown').length).toBeGreaterThanOrEqual(2);
  });

  it('renders default columns overflow and payment proof badge', () => {
    function DefaultTable({ data }: { data: Expense[] }) {
      const table = useReactTable({
        columns: expenseColumns,
        data,
        getCoreRowModel: getCoreRowModel(),
      });

      return (
        <table>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    const { container } = render(
      <DefaultTable
        data={[
          {
            ...baseExpense,
            participants: [
              {
                id: 1,
                amount: 25,
                colleagueId: 1,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 1, name: 'A' },
              },
              {
                id: 2,
                amount: 25,
                colleagueId: 2,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 2, name: 'B' },
              },
              {
                id: 3,
                amount: 25,
                colleagueId: 3,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 3, name: 'C' },
              },
              {
                id: 4,
                amount: 25,
                colleagueId: 4,
                expenseId: 1,
                isPaid: false,
                isPending: true,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 4, name: 'D' },
                paymentProofBucket: 'proofs',
                paymentProofObjectKey: 'p.jpg',
              },
            ],
          },
          {
            ...baseExpense,
            id: 2,
            participants: [
              {
                id: 5,
                amount: 100,
                colleagueId: 1,
                expenseId: 2,
                isPaid: true,
                isPending: false,
                hasPartialPayment: false,
                submittedAt: null,
                colleague: { id: 1, name: 'A' },
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(container.querySelector('[title="Payment proof available"]')).toBeInTheDocument();
    expect(container.querySelector('.lucide-circle-check-big')).toBeInTheDocument();
  });
});
