import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InactiveColleagueWithBalance } from '@/types/colleague';
import { createInactiveColleagueColumns } from '../inactive-colleague-columns';

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
  formatDate: (value: string | Date) =>
    typeof value === 'string' ? value : value.toISOString().split('T')[0],
  getBalanceColor: (value: number) =>
    value < 0 ? 'text-red-500' : value > 0 ? 'text-green-500' : 'text-gray-500',
}));

vi.mock('@/components/ui/avatar', () => ({
  EnhancedAvatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
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

const baseColleague: InactiveColleagueWithBalance = {
  id: 1,
  name: 'Alice',
  currentBalance: -25,
  deletedAt: new Date('2024-06-15'),
  deletedBy: null,
};

function TestTable({
  data,
  onRestore = vi.fn(),
  onPermanentDelete = vi.fn(),
}: {
  data: InactiveColleagueWithBalance[];
  onRestore?: (colleague: InactiveColleagueWithBalance) => void;
  onPermanentDelete?: (colleague: InactiveColleagueWithBalance) => void;
}) {
  const columns = createInactiveColleagueColumns({ onRestore, onPermanentDelete });

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

describe('inactive colleague columns', () => {
  it('renders name with inactive badge', () => {
    render(<TestTable data={[baseColleague]} />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('Alice');
    expect(screen.getByText('colleague_badge_inactive')).toBeInTheDocument();
  });

  it('renders formatted balance with color', () => {
    const { container } = render(<TestTable data={[baseColleague]} />);
    expect(container.querySelector('.text-red-500')).toHaveTextContent('$-25.00');
  });

  it('renders deactivated date', () => {
    render(<TestTable data={[baseColleague]} />);
    expect(screen.getByText('2024-06-15')).toBeInTheDocument();
  });

  it('renders em dash when deactivated date is missing', () => {
    render(<TestTable data={[{ ...baseColleague, deletedAt: null }]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders action menu items', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onPermanentDelete = vi.fn();
    render(
      <TestTable
        data={[baseColleague]}
        onRestore={onRestore}
        onPermanentDelete={onPermanentDelete}
      />
    );

    await user.click(screen.getByTestId('row-actions-btn'));
    expect(screen.getByText('colleague_actions_restore')).toBeInTheDocument();
    expect(screen.getByText('colleague_actions_deletePermanent')).toBeInTheDocument();
    await user.click(screen.getByText('colleague_actions_restore'));
    await user.click(screen.getByText('colleague_actions_deletePermanent'));
    expect(onRestore).toHaveBeenCalledWith(baseColleague);
    expect(onPermanentDelete).toHaveBeenCalledWith(baseColleague);
  });

  it('renders column headers', () => {
    render(<TestTable data={[baseColleague]} />);
    expect(screen.getByText('colleague_col_name')).toBeInTheDocument();
    expect(screen.getByText('colleague_col_balance')).toBeInTheDocument();
    expect(screen.getByText('colleague_col_deactivatedOn')).toBeInTheDocument();
    expect(screen.getByText('colleague_col_actions')).toBeInTheDocument();
  });
});
