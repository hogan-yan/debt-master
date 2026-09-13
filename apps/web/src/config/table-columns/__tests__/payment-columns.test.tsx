import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Payment } from '@/types';
import { createPaymentColumns } from '../payment-columns';

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
}));

vi.mock('@/styles/class-constants', () => ({
  BADGE_CLASSES: {
    BADGE_BASE: 'badge-base',
    PAYMENT_CASH: 'badge-cash',
    PAYMENT_BANK: 'badge-bank',
    PAYMENT_DIGITAL: 'badge-digital',
  },
}));

vi.mock('@/components/ui/avatar', () => ({
  EnhancedAvatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/date-badge', () => ({
  CompactDateWithBadge: ({ dateString }: { dateString: string }) => (
    <span data-testid="date-badge">{dateString}</span>
  ),
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

const basePayment: Payment = {
  id: 1,
  colleagueId: 1,
  amount: 200,
  date: '2024-06-15',
  paymentType: 'CASH',
  isApproved: true,
  createdAt: '2024-06-15',
  updatedAt: '2024-06-15',
  colleague: { id: 1, name: 'Alice' },
  restaurant: null,
  applications: [],
};

interface TestTableProps {
  data: Payment[];
  actions?: Parameters<typeof createPaymentColumns>[0];
}

function TestTable({ data, actions }: TestTableProps) {
  const columns = createPaymentColumns(
    actions ?? {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
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

describe('payment columns', () => {
  it('renders date column', () => {
    render(<TestTable data={[basePayment]} />);
    expect(screen.getByTestId('date-badge')).toHaveTextContent('2024-06-15');
  });

  it('renders colleague name with avatar', () => {
    render(<TestTable data={[basePayment]} />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('Alice');
  });

  it('falls back to Unknown colleague', () => {
    render(<TestTable data={[{ ...basePayment, colleague: undefined }]} />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('Unknown');
  });

  it('renders amount with unused credit badge', () => {
    const { container } = render(
      <TestTable
        data={[
          {
            ...basePayment,
            applications: [{ id: 1, amount: 50, appliedAt: '2024-06-15', expense: undefined }],
          },
        ]}
      />
    );
    expect(container.textContent).toContain('$200.00');
    expect(container.textContent).toContain('payment_badge_credit');
  });

  it('renders each payment type badge', () => {
    const types: Payment['paymentType'][] = ['CASH', 'FPS', 'PAYME', 'OTHER'];
    const { container } = render(
      <TestTable
        data={types.map((paymentType, index) => ({
          ...basePayment,
          id: index,
          paymentType,
        }))}
      />
    );

    expect(container.querySelector('.badge-cash')).toBeInTheDocument();
    expect(container.querySelector('.badge-bank')).toBeInTheDocument();
    expect(container.querySelector('.badge-digital')).toBeInTheDocument();
    expect(screen.getByText('payment_type_other')).toBeInTheDocument();
  });

  it('renders unknown payment type fallback', () => {
    render(
      <TestTable data={[{ ...basePayment, paymentType: 'WIRE' as Payment['paymentType'] }]} />
    );
    expect(screen.getByText('WIRE')).toBeInTheDocument();
  });

  it('renders approved status', () => {
    render(<TestTable data={[basePayment]} />);
    expect(screen.getByText('payment_status_approved')).toBeInTheDocument();
  });

  it('renders pending status', () => {
    render(<TestTable data={[{ ...basePayment, isApproved: false }]} />);
    expect(screen.getByText('payment_status_pending')).toBeInTheDocument();
  });

  it('renders pure prepayment when no applications or expense', () => {
    render(<TestTable data={[basePayment]} />);
    expect(screen.getByText('payment_applications_availableAsCredit')).toBeInTheDocument();
  });

  it('renders legacy single expense link', () => {
    const onGoToSpecificExpense = vi.fn();
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            applications: [],
            expense: {
              id: 10,
              date: '2024-06-10',
              amount: 100,
              restaurant: { id: 2, name: 'Lunch' },
            },
          },
        ]}
        actions={{
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          onGoToSpecificExpense,
          isAdmin: false,
        }}
      />
    );
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    screen.getByText('Lunch').click();
    expect(onGoToSpecificExpense).toHaveBeenCalledWith(10);
  });

  it('renders single application expense', () => {
    const onGoToSpecificExpense = vi.fn();
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            applications: [
              {
                id: 1,
                amount: 75,
                appliedAt: '2024-06-15',
                expense: { id: 20, date: '2024-06-12', restaurant: { id: 3, name: 'Dinner' } },
              },
            ],
          },
        ]}
        actions={{
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          onGoToSpecificExpense,
          isAdmin: false,
        }}
      />
    );
    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    screen.getByText('Dinner').click();
    expect(onGoToSpecificExpense).toHaveBeenCalledWith(20);
  });

  it('renders multiple applications and expands list', async () => {
    const user = userEvent.setup();
    const onGoToSpecificExpense = vi.fn();
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            amount: 300,
            applications: [
              {
                id: 1,
                amount: 50,
                appliedAt: '2024-06-15',
                expense: { id: 1, date: '2024-06-12', restaurant: { id: 1, name: 'A' } },
              },
              {
                id: 2,
                amount: 80,
                appliedAt: '2024-06-15',
                expense: { id: 2, date: '2024-06-13', restaurant: { id: 2, name: 'B' } },
              },
            ],
          },
        ]}
        actions={{
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          onGoToSpecificExpense,
          isAdmin: false,
        }}
      />
    );

    expect(
      screen.getByText('payment_applications_expenseCount_other-{"count":"2"}')
    ).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: '' });
    await user.click(toggle);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('payment_applications_remainingCreditLabel')).toBeInTheDocument();
    await user.click(screen.getByText('A'));
    await user.click(screen.getByText('B'));
    expect(onGoToSpecificExpense).toHaveBeenNthCalledWith(1, 1);
    expect(onGoToSpecificExpense).toHaveBeenNthCalledWith(2, 2);
  });

  it('shows admin actions and separators', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TestTable
        data={[basePayment]}
        actions={{
          onEdit,
          onDelete,
          isAdmin: true,
          onViewPaymentProof: vi.fn(),
          onGoToExpense: vi.fn(),
        }}
      />
    );

    await user.click(screen.getByTestId('row-actions-btn'));
    expect(screen.getByText('payment_actions_edit')).toBeInTheDocument();
    expect(screen.getByText('payment_actions_delete')).toBeInTheDocument();
    await user.click(screen.getByText('payment_actions_edit'));
    await user.click(screen.getByText('payment_actions_delete'));
    expect(onEdit).toHaveBeenCalledWith(basePayment);
    expect(onDelete).toHaveBeenCalledWith(basePayment);
  });

  it('shows view proof and related expense items when handlers present', async () => {
    const user = userEvent.setup();
    const onViewPaymentProof = vi.fn();
    const onGoToExpense = vi.fn();
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            paymentProofBucket: 'proofs',
            paymentProofObjectKey: 'proof.jpg',
            expense: { id: 5, date: '2024-06-10', amount: 100, restaurant: { id: 1, name: 'R' } },
          },
        ]}
        actions={{
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          isAdmin: false,
          onViewPaymentProof,
          onGoToExpense,
        }}
      />
    );

    await user.click(screen.getByTestId('row-actions-btn'));
    expect(screen.getByText('payment_actions_viewPaymentProof')).toBeInTheDocument();
    expect(screen.getByText('payment_actions_viewRelatedExpense')).toBeInTheDocument();
    expect(screen.queryByText('payment_actions_edit')).not.toBeInTheDocument();
    await user.click(screen.getByText('payment_actions_viewPaymentProof'));
    await user.click(screen.getByText('payment_actions_viewRelatedExpense'));
    expect(onViewPaymentProof).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(onGoToExpense).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('renders action headers', () => {
    render(<TestTable data={[basePayment]} />);
    expect(screen.getByRole('columnheader', { name: /payment_col_date/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /payment_col_colleague/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /payment_col_amount/ })).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /payment_col_paymentMethod/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /payment_col_appliedToExpenses/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /payment_col_status/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /payment_col_actions/ })).toBeInTheDocument();
  });

  it('renders amount without unused credit badge when fully applied', () => {
    const { container } = render(
      <TestTable
        data={[
          {
            ...basePayment,
            amount: 100,
            applications: [{ id: 1, amount: 100, appliedAt: '2024-06-15', expense: undefined }],
          },
        ]}
      />
    );
    expect(container.textContent).toContain('$100.00');
    expect(container.textContent).not.toContain('payment_badge_credit');
  });

  it('treats missing applications as an empty list when calculating unused credit', () => {
    const { container } = render(
      <TestTable data={[{ ...basePayment, applications: undefined }]} />
    );

    expect(container.textContent).toContain('$200.00');
    expect(container.textContent).toContain('payment_badge_credit');
  });

  it('renders single application fallback when application has no expense', () => {
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            applications: [{ id: 1, amount: 75, appliedAt: '2024-06-15', expense: undefined }],
          },
        ]}
        actions={{ onEdit: vi.fn(), onDelete: vi.fn(), isAdmin: false }}
      />
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
  });

  it('uses the Unknown fallback for a clickable legacy expense without a restaurant', async () => {
    const onGoToSpecificExpense = vi.fn();
    const user = userEvent.setup();
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            expense: { id: 10, date: '2024-06-10', amount: 100, restaurant: undefined },
          },
        ]}
        actions={{ onEdit: vi.fn(), onDelete: vi.fn(), onGoToSpecificExpense, isAdmin: false }}
      />
    );

    await user.click(screen.getByText('Unknown'));

    expect(onGoToSpecificExpense).toHaveBeenCalledWith(10);
  });

  it('treats a legacy expense with ID zero as an unavailable link', () => {
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            expense: {
              id: 0,
              date: '2024-06-10',
              amount: 100,
              restaurant: { id: 1, name: 'Legacy' },
            },
          },
        ]}
        actions={{
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          onGoToSpecificExpense: vi.fn(),
          isAdmin: false,
        }}
      />
    );

    expect(screen.getByText('Legacy').closest('button')).toBeNull();
  });

  it('renders the unknown application fallback for a sparse applications array', () => {
    const applications: NonNullable<Payment['applications']> = new Array(1);
    render(<TestTable data={[{ ...basePayment, applications }]} />);
    expect(screen.getByText('payment_applications_unknown')).toBeInTheDocument();
  });

  it('renders expanded applications without expense links', async () => {
    const user = userEvent.setup();
    render(
      <TestTable
        data={[
          {
            ...basePayment,
            applications: [
              {
                id: 1,
                amount: 75,
                appliedAt: '2024-06-15',
                expense: { id: 10, date: '2024-06-10', restaurant: { id: 1, name: 'Known' } },
              },
              { id: 2, amount: 25, appliedAt: '2024-06-15', expense: undefined },
            ],
          },
        ]}
        actions={{ onEdit: vi.fn(), onDelete: vi.fn(), isAdmin: false }}
      />
    );

    await user.click(screen.getByRole('button', { name: '' }));

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders no action items when no proof, no expense and not admin', async () => {
    const user = userEvent.setup();
    render(
      <TestTable
        data={[basePayment]}
        actions={{ onEdit: vi.fn(), onDelete: vi.fn(), isAdmin: false }}
      />
    );

    await user.click(screen.getByTestId('row-actions-btn'));
    expect(screen.queryByText('payment_actions_viewPaymentProof')).not.toBeInTheDocument();
    expect(screen.queryByText('payment_actions_viewRelatedExpense')).not.toBeInTheDocument();
    expect(screen.queryByText('payment_actions_edit')).not.toBeInTheDocument();
  });

  it('renders an admin separator after payment proof actions', () => {
    const { container } = render(
      <TestTable
        data={[
          {
            ...basePayment,
            paymentProofBucket: 'proofs',
            paymentProofObjectKey: 'proof.jpg',
          },
        ]}
        actions={{
          onEdit: vi.fn(),
          onDelete: vi.fn(),
          onViewPaymentProof: vi.fn(),
          isAdmin: true,
        }}
      />
    );

    expect(container.querySelector('[data-testid="dropdown-separator"]')).toBeInTheDocument();
  });

  it('renders date cell when value is a Date object', () => {
    render(<TestTable data={[{ ...basePayment, date: new Date('2024-06-15T00:00:00.000Z') }]} />);
    expect(screen.getByTestId('date-badge')).toHaveTextContent('2024-06-15');
  });
});
