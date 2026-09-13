import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InactiveColleagueWithBalance } from '@/types/colleague';
import { createInactiveColleagueColumns } from './inactive-colleague-columns';

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  formatDate: (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  getBalanceColor: (balance: number) => (balance < 0 ? 'text-destructive-text' : 'text-success'),
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    colleague_col_name: () => 'Name',
    colleague_col_balance: () => 'Balance',
    colleague_col_deactivatedOn: () => 'Deactivated',
    colleague_col_actions: () => 'Actions',
    colleague_badge_inactive: () => 'Inactive',
    colleague_actions_openMenu: () => 'Open menu',
    colleague_actions_label: () => 'Actions',
    colleague_actions_restore: () => 'Restore',
    colleague_actions_deletePermanent: () => 'Delete Permanent',
  },
}));

function createInactiveColleague(
  overrides: Partial<InactiveColleagueWithBalance> = {}
): InactiveColleagueWithBalance {
  return {
    id: 1,
    name: 'Alice Smith',
    currentBalance: -50,
    deletedAt: new Date('2024-06-01'),
    deletedBy: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function invokeCell(
  columns: ColumnDef<InactiveColleagueWithBalance>[],
  columnId: string,
  colleague: InactiveColleagueWithBalance
): React.ReactNode {
  const column = columns.find(
    (c): c is ColumnDef<InactiveColleagueWithBalance> & { accessorKey: string } =>
      'accessorKey' in c && c.accessorKey === columnId
  );
  if (!column || typeof column.cell !== 'function')
    throw new Error(`Cell not found for ${columnId}`);

  const ctx = {
    row: {
      getValue: (key: string) =>
        key === columnId ? (colleague as unknown as Record<string, unknown>)[columnId] : undefined,
      original: colleague,
    },
    column: {},
    cell: {},
    table: {},
    renderValue: () => (colleague as unknown as Record<string, unknown>)[columnId],
  } as unknown as CellContext<InactiveColleagueWithBalance, unknown>;

  return column.cell(ctx);
}

function invokeActionCell(
  columns: ColumnDef<InactiveColleagueWithBalance>[],
  colleague: InactiveColleagueWithBalance
): React.ReactNode {
  const column = columns.find((c) => 'id' in c && c.id === 'actions');
  if (!column || typeof column.cell !== 'function') throw new Error('Actions cell not found');

  const ctx = {
    row: { getValue: () => undefined, original: colleague },
    column: {},
    cell: {},
    table: {},
    renderValue: () => undefined,
  } as unknown as CellContext<InactiveColleagueWithBalance, unknown>;

  return column.cell(ctx);
}

describe('createInactiveColleagueColumns', () => {
  it('renders name cell with strikethrough and inactive badge', () => {
    const columns = createInactiveColleagueColumns({
      onRestore: vi.fn(),
      onPermanentDelete: vi.fn(),
    });
    const colleague = createInactiveColleague({ name: 'Bob Jones' });
    render(invokeCell(columns, 'name', colleague));

    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders balance with correct color class', () => {
    const columns = createInactiveColleagueColumns({
      onRestore: vi.fn(),
      onPermanentDelete: vi.fn(),
    });
    const colleague = createInactiveColleague({ currentBalance: -75.5 });
    render(invokeCell(columns, 'currentBalance', colleague));

    expect(screen.getByText('$-75.50')).toBeInTheDocument();
  });

  it('renders positive balance with success color', () => {
    const columns = createInactiveColleagueColumns({
      onRestore: vi.fn(),
      onPermanentDelete: vi.fn(),
    });
    const colleague = createInactiveColleague({ currentBalance: 25 });
    render(invokeCell(columns, 'currentBalance', colleague));

    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });

  it('renders deletedAt date', () => {
    const columns = createInactiveColleagueColumns({
      onRestore: vi.fn(),
      onPermanentDelete: vi.fn(),
    });
    const colleague = createInactiveColleague({ deletedAt: new Date('2024-03-15') });
    render(invokeCell(columns, 'deletedAt', colleague));

    expect(screen.getByText('Mar 15, 2024')).toBeInTheDocument();
  });

  it('renders em dash when deletedAt is null', () => {
    const columns = createInactiveColleagueColumns({
      onRestore: vi.fn(),
      onPermanentDelete: vi.fn(),
    });
    const colleague = createInactiveColleague({ deletedAt: null });
    render(invokeCell(columns, 'deletedAt', colleague));

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls onRestore when restore action clicked', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const columns = createInactiveColleagueColumns({ onRestore, onPermanentDelete: vi.fn() });
    const colleague = createInactiveColleague({ id: 5 });

    render(invokeActionCell(columns, colleague));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    const restoreItem = screen.getByText('Restore');
    await user.click(restoreItem);

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it('calls onPermanentDelete when delete action clicked', async () => {
    const user = userEvent.setup();
    const onPermanentDelete = vi.fn();
    const columns = createInactiveColleagueColumns({ onRestore: vi.fn(), onPermanentDelete });
    const colleague = createInactiveColleague({ id: 7 });

    render(invokeActionCell(columns, colleague));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    const deleteItem = screen.getByText('Delete Permanent');
    await user.click(deleteItem);

    expect(onPermanentDelete).toHaveBeenCalledTimes(1);
    expect(onPermanentDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});
