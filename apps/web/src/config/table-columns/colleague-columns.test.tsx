import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ColleagueWithBalance } from '@/types';
import { colleagueColumns, createColleagueColumns } from './colleague-columns';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to = '',
    params = {},
    children,
  }: {
    to?: string;
    params?: Record<string, string>;
    children?: React.ReactNode;
  }) => <a href={to.replace('$colleagueId', params?.colleagueId ?? '')}>{children}</a>,
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  getBalanceColor: (balance: number) => (balance >= 0 ? 'text-green-600' : 'text-red-600'),
  getBalanceStatus: (balance: number) =>
    balance >= 0
      ? { text: 'Credit', className: 'text-green-600' }
      : { text: 'Owes', className: 'text-red-600' },
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    colleague_col_name: () => 'Name',
    colleague_col_balance: () => 'Balance',
    colleague_col_status: () => 'Status',
    colleague_col_actions: () => 'Actions',
    colleague_actions_openMenu: () => 'Open menu',
    colleague_actions_label: () => 'Actions',
    colleague_actions_edit: () => 'Edit',
    colleague_actions_deactivate: () => 'Deactivate',
    colleague_viewDetails: () => 'View',
  },
}));

vi.mock('@/components/ui/avatar', () => ({
  EnhancedAvatar: ({ name }: { name: string }) => (
    <span data-testid="avatar">{name?.[0] ?? '?'}</span>
  ),
}));

function createColleague(overrides: Partial<ColleagueWithBalance> = {}): ColleagueWithBalance {
  return {
    id: 1,
    name: 'Alice Smith',
    currentBalance: 100,
    totalOwed: 50,
    totalPaid: 150,
    ...overrides,
  } as ColleagueWithBalance;
}

function invokeCell(
  columns: ColumnDef<ColleagueWithBalance>[],
  columnId: string,
  colleague: ColleagueWithBalance
): React.ReactNode {
  const column = columns.find((c) => {
    if ('accessorKey' in c && c.accessorKey === columnId) return true;
    if ('id' in c && c.id === columnId) return true;
    return false;
  });
  if (!column || typeof column.cell !== 'function')
    throw new Error(`Cell not found for ${columnId}`);

  const ctx = {
    row: {
      getValue: (key: string) => {
        if (key === 'currentBalance') return colleague.currentBalance;
        if (key === columnId) return (colleague as unknown as Record<string, unknown>)[columnId];
        return undefined;
      },
      original: colleague,
    },
    column: {},
    cell: {},
    table: {},
    renderValue: () =>
      columnId === 'status'
        ? colleague.currentBalance
        : (colleague as unknown as Record<string, unknown>)[columnId],
  } as unknown as CellContext<ColleagueWithBalance, unknown>;

  return column.cell(ctx);
}

function invokeActionCell(
  columns: ColumnDef<ColleagueWithBalance>[],
  colleague: ColleagueWithBalance
): React.ReactNode {
  const column = columns.find((c) => 'id' in c && c.id === 'actions');
  if (!column || typeof column.cell !== 'function') throw new Error('Actions cell not found');

  const ctx = {
    row: { getValue: () => undefined, original: colleague },
    column: {},
    cell: {},
    table: {},
    renderValue: () => undefined,
  } as unknown as CellContext<ColleagueWithBalance, unknown>;

  return column.cell(ctx);
}

describe('createColleagueColumns', () => {
  it('renders name cell with avatar and link', () => {
    const columns = createColleagueColumns({ onEdit: vi.fn(), onDelete: vi.fn() });
    const colleague = createColleague({ name: 'Bob Jones', id: 42 });
    render(invokeCell(columns, 'name', colleague));

    const link = screen.getByRole('link', { name: 'Bob Jones' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/colleagues/42/');
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
  });

  it('renders balance formatted with color class for positive balance', () => {
    const columns = createColleagueColumns({ onEdit: vi.fn(), onDelete: vi.fn() });
    const colleague = createColleague({ currentBalance: 250.5 });
    render(invokeCell(columns, 'currentBalance', colleague));

    expect(screen.getByText('$250.50')).toBeInTheDocument();
  });

  it('renders negative balance with owes color', () => {
    const columns = createColleagueColumns({ onEdit: vi.fn(), onDelete: vi.fn() });
    const colleague = createColleague({ currentBalance: -75 });
    render(invokeCell(columns, 'currentBalance', colleague));

    expect(screen.getByText('$-75.00')).toBeInTheDocument();
  });

  it('renders status badge for credit balance', () => {
    const columns = createColleagueColumns({ onEdit: vi.fn(), onDelete: vi.fn() });
    const colleague = createColleague({ currentBalance: 50 });
    render(invokeCell(columns, 'status', colleague));

    expect(screen.getByText('Credit')).toBeInTheDocument();
  });

  it('renders status badge for negative balance', () => {
    const columns = createColleagueColumns({ onEdit: vi.fn(), onDelete: vi.fn() });
    const colleague = createColleague({ currentBalance: -30 });
    render(invokeCell(columns, 'status', colleague));

    expect(screen.getByText('Owes')).toBeInTheDocument();
  });

  it('calls onEdit when edit action clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const columns = createColleagueColumns({ onEdit, onDelete: vi.fn(), isAdmin: true });
    const colleague = createColleague({ id: 5 });

    render(invokeActionCell(columns, colleague));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    await user.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it('calls onDelete when deactivate action clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const columns = createColleagueColumns({ onEdit: vi.fn(), onDelete, isAdmin: true });
    const colleague = createColleague({ id: 7 });

    render(invokeActionCell(columns, colleague));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    await user.click(screen.getByText('Deactivate'));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it('hides admin actions when not admin', async () => {
    const user = userEvent.setup();
    const columns = createColleagueColumns({ onEdit: vi.fn(), onDelete: vi.fn(), isAdmin: false });
    const colleague = createColleague();

    render(invokeActionCell(columns, colleague));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
  });
});

describe('colleagueColumns (default)', () => {
  it('renders name cell with avatar and plain text', () => {
    const colleague = createColleague({ name: 'Carol White' });
    render(
      invokeCell(
        colleagueColumns as unknown as ColumnDef<ColleagueWithBalance>[],
        'name',
        colleague as unknown as ColleagueWithBalance
      )
    );

    expect(screen.getByText('Carol White')).toBeInTheDocument();
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
  });

  it('renders balance formatted', () => {
    const colleague = createColleague({ currentBalance: 99.99 });
    render(
      invokeCell(
        colleagueColumns as unknown as ColumnDef<ColleagueWithBalance>[],
        'currentBalance',
        colleague as unknown as ColleagueWithBalance
      )
    );

    expect(screen.getByText('$99.99')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    const colleague = createColleague({ currentBalance: -10 });
    render(
      invokeCell(
        colleagueColumns as unknown as ColumnDef<ColleagueWithBalance>[],
        'status',
        colleague as unknown as ColleagueWithBalance
      )
    );

    expect(screen.getByText('Owes')).toBeInTheDocument();
  });

  it('renders view details link in actions', () => {
    const colleague = createColleague({ id: 3 });
    render(
      invokeActionCell(
        colleagueColumns as unknown as ColumnDef<ColleagueWithBalance>[],
        colleague as unknown as ColleagueWithBalance
      )
    );

    expect(screen.getByText('View')).toBeInTheDocument();
  });
});
