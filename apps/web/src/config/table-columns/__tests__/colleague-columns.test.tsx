import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Colleague, ColleagueWithBalance } from '@/types';
import { colleagueColumns, createColleagueColumns } from '../colleague-columns';

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
  getBalanceColor: (value: number) =>
    value < 0 ? 'text-red-500' : value > 0 ? 'text-green-500' : 'text-gray-500',
  getBalanceStatus: (value: number) => {
    if (value < 0) return { text: 'owes', className: 'badge-danger' };
    if (value > 0) return { text: 'prepaid', className: 'badge-success' };
    return { text: 'settled', className: 'badge-neutral' };
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
    <a href={to.replace('$colleagueId', params?.colleagueId ?? '')} {...props}>
      {children}
    </a>
  ),
}));

const baseColleague: ColleagueWithBalance = {
  id: 1,
  name: 'Alice',
  currentBalance: -50,
};

function TestTable({
  data,
  actions,
}: {
  data: ColleagueWithBalance[];
  actions?: Parameters<typeof createColleagueColumns>[0];
}) {
  const columns = createColleagueColumns(
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

describe('colleague columns', () => {
  it('renders name with avatar and link', () => {
    render(<TestTable data={[baseColleague]} />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('Alice');
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/colleagues/1/');
  });

  it('renders formatted balance with color', () => {
    const { container } = render(<TestTable data={[baseColleague]} />);
    expect(container.querySelector('.text-red-500')).toHaveTextContent('$-50.00');
  });

  it('renders each balance status', () => {
    const { container } = render(
      <TestTable
        data={[
          { id: 1, name: 'A', currentBalance: -10 },
          { id: 2, name: 'B', currentBalance: 20 },
          { id: 3, name: 'C', currentBalance: 0 },
        ]}
      />
    );
    expect(container.textContent).toContain('owes');
    expect(container.textContent).toContain('prepaid');
    expect(container.textContent).toContain('settled');
  });

  it('renders admin actions and triggers handlers', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<TestTable data={[baseColleague]} actions={{ onEdit, onDelete, isAdmin: true }} />);

    await user.click(screen.getByText('colleague_actions_edit'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));

    await user.click(screen.getByText('colleague_actions_deactivate'));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('hides admin actions when not admin', () => {
    render(<TestTable data={[baseColleague]} />);
    expect(screen.queryByText('colleague_actions_edit')).not.toBeInTheDocument();
  });

  it('renders default colleague columns', () => {
    function DefaultTable() {
      const table = useReactTable({
        columns: colleagueColumns,
        data: [{ id: 1, name: 'Alice', currentBalance: 0 } as Colleague],
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

    render(<DefaultTable />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('Alice');
    expect(screen.getByText('colleague_viewDetails')).toBeInTheDocument();
  });
});
