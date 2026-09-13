import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '@/types';
import { createRestaurantColumns } from '../restaurant-columns';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params: Record<string, string>;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to.replace('$id', params.id ?? '')} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => (args?: Record<string, unknown>) =>
        args ? `${String(key)}-${JSON.stringify(args)}` : String(key),
    }
  ),
}));

vi.mock('@/lib/schemas', () => ({
  getCuisineLabel: (cuisine: string) =>
    cuisine ? cuisine.charAt(0) + cuisine.slice(1).toLowerCase() : '',
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

const mockRestaurant: Restaurant = {
  id: 42,
  name: 'Pizza Palace',
  address: '123 Main St',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function TestTable({
  data,
  isAdmin = false,
  onView = vi.fn(),
  onEdit = vi.fn(),
  onDelete = vi.fn(),
}: {
  data: Restaurant[];
  isAdmin?: boolean;
  onView?: (restaurant: Restaurant) => void;
  onEdit?: (restaurant: Restaurant) => void;
  onDelete?: (restaurant: Restaurant) => void;
}) {
  const columns = createRestaurantColumns({
    onView,
    onEdit,
    onDelete,
    isAdmin,
  });

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

describe('restaurant columns', () => {
  it('renders restaurant name as a link to the detail page', () => {
    render(<TestTable data={[mockRestaurant]} />);

    const link = screen.getByRole('link', { name: 'Pizza Palace' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/restaurants/42/');
  });

  it('renders address fallback when address is missing', () => {
    render(<TestTable data={[{ ...mockRestaurant, address: null }]} />);
    expect(screen.getByText('restaurant_detail_noAddress')).toBeInTheDocument();
  });

  it('renders cuisine badge when cuisine provided', () => {
    render(<TestTable data={[{ ...mockRestaurant, cuisine: 'ITALIAN' }]} />);
    expect(screen.getByTestId('cuisine-badge')).toHaveTextContent('Italian');
  });

  it('renders em dash when cuisine is missing', () => {
    render(<TestTable data={[mockRestaurant]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders total expenses and total amount', () => {
    render(<TestTable data={[{ ...mockRestaurant, totalExpenses: 5, totalAmount: 250 }]} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
  });

  it('defaults missing totals to zero', () => {
    render(<TestTable data={[mockRestaurant]} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('renders admin actions', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TestTable
        data={[mockRestaurant]}
        isAdmin={true}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByTestId('row-actions-btn'));
    expect(screen.getByText('restaurant_actions_viewDetails')).toBeInTheDocument();
    expect(screen.getByText('restaurant_actions_edit')).toBeInTheDocument();
    expect(screen.getByText('restaurant_actions_delete')).toBeInTheDocument();
    await user.click(screen.getByText('restaurant_actions_viewDetails'));
    await user.click(screen.getByText('restaurant_actions_edit'));
    await user.click(screen.getByText('restaurant_actions_delete'));
    expect(onView).toHaveBeenCalledWith(mockRestaurant);
    expect(onEdit).toHaveBeenCalledWith(mockRestaurant);
    expect(onDelete).toHaveBeenCalledWith(mockRestaurant);
  });

  it('hides admin actions when not admin', () => {
    render(<TestTable data={[mockRestaurant]} isAdmin={false} />);
    expect(screen.queryByText('restaurant_actions_edit')).not.toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<TestTable data={[mockRestaurant]} />);
    expect(screen.getByTestId('cuisine-col')).toBeInTheDocument();
    expect(screen.getByText('restaurant_col_expenses')).toBeInTheDocument();
    expect(screen.getByText('restaurant_col_totalAmount')).toBeInTheDocument();
    expect(screen.getByText('restaurant_col_actions')).toBeInTheDocument();
  });
});
