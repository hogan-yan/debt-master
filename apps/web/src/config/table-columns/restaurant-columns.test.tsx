import type { CellContext, ColumnDef, HeaderContext } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '@/types';
import { createRestaurantColumns } from './restaurant-columns';

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

vi.mock('@/lib/schemas', () => ({
  getCuisineLabel: (cuisine: string) => cuisine.charAt(0).toUpperCase() + cuisine.slice(1),
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    restaurant_detail_label_name: () => 'Name',
    restaurant_detail_label_address: () => 'Address',
    restaurant_detail_label_cuisine: () => 'Cuisine',
    restaurant_detail_noAddress: () => 'No address',
    restaurant_col_expenses: () => 'Expenses',
    restaurant_col_totalAmount: () => 'Total Amount',
    restaurant_col_actions: () => 'Actions',
    restaurant_actions_openMenu: () => 'Open menu',
    restaurant_actions_label: () => 'Actions',
    restaurant_actions_viewDetails: () => 'View',
    restaurant_actions_edit: () => 'Edit',
    restaurant_actions_delete: () => 'Delete',
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to = '',
    params = {},
    children,
  }: {
    to?: string;
    params?: Record<string, string>;
    children?: React.ReactNode;
  }) => <a href={to.replace('$id', params?.id ?? '')}>{children}</a>,
}));

function createRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 1,
    name: 'Pizza Place',
    address: '123 Main St',
    cuisine: 'italian',
    totalExpenses: 5,
    totalAmount: 500,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function invokeHeader(columns: ColumnDef<Restaurant>[], columnId: string): React.ReactNode {
  const column = columns.find(
    (c): c is ColumnDef<Restaurant> & { accessorKey: string } =>
      'accessorKey' in c && c.accessorKey === columnId
  );
  if (!column || typeof column.header !== 'function')
    throw new Error(`Header not found for ${columnId}`);

  const ctx = {
    column: {},
    header: {},
    table: {},
  } as unknown as HeaderContext<Restaurant, unknown>;

  return column.header(ctx);
}

function invokeActionHeader(columns: ColumnDef<Restaurant>[]): React.ReactNode {
  const column = columns.find((c) => 'id' in c && c.id === 'actions');
  if (!column || typeof column.header !== 'function') throw new Error('Actions header not found');

  const ctx = {
    column: {},
    header: {},
    table: {},
  } as unknown as HeaderContext<Restaurant, unknown>;

  return column.header(ctx);
}
function invokeCell(
  columns: ColumnDef<Restaurant>[],
  columnId: string,
  restaurant: Restaurant
): React.ReactNode {
  const column = columns.find(
    (c): c is ColumnDef<Restaurant> & { accessorKey: string } =>
      'accessorKey' in c && c.accessorKey === columnId
  );
  if (!column || typeof column.cell !== 'function')
    throw new Error(`Cell not found for ${columnId}`);

  const ctx = {
    row: {
      getValue: (key: string) =>
        key === columnId ? (restaurant as unknown as Record<string, unknown>)[columnId] : undefined,
      original: restaurant,
    },
    column: {},
    cell: {},
    table: {},
    renderValue: () => (restaurant as unknown as Record<string, unknown>)[columnId],
  } as unknown as CellContext<Restaurant, unknown>;

  return column.cell(ctx);
}

function invokeActionCell(
  columns: ColumnDef<Restaurant>[],
  restaurant: Restaurant
): React.ReactNode {
  const column = columns.find((c) => 'id' in c && c.id === 'actions');
  if (!column || typeof column.cell !== 'function') throw new Error('Actions cell not found');

  const ctx = {
    row: { getValue: () => undefined, original: restaurant },
    column: {},
    cell: {},
    table: {},
    renderValue: () => undefined,
  } as unknown as CellContext<Restaurant, unknown>;

  return column.cell(ctx);
}

describe('createRestaurantColumns', () => {
  it('renders name cell with link', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ name: 'Sushi Bar' });
    render(invokeCell(columns, 'name', restaurant));

    expect(screen.getByText('Sushi Bar')).toBeInTheDocument();
  });

  it('renders address when present', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ address: '456 Oak Ave' });
    render(invokeCell(columns, 'address', restaurant));

    expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
  });

  it('renders fallback when address is missing', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ address: null });
    render(invokeCell(columns, 'address', restaurant));

    expect(screen.getByText('No address')).toBeInTheDocument();
  });

  it('renders cuisine badge when cuisine exists', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ cuisine: 'japanese' });
    render(invokeCell(columns, 'cuisine', restaurant));

    expect(screen.getByText('Japanese')).toBeInTheDocument();
  });

  it('renders em dash when cuisine is missing', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ cuisine: null });
    render(invokeCell(columns, 'cuisine', restaurant));

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders total expenses count', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ totalExpenses: 12 });
    render(invokeCell(columns, 'totalExpenses', restaurant));

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders total amount formatted', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ totalAmount: 1250.5 });
    render(invokeCell(columns, 'totalAmount', restaurant));

    expect(screen.getByText('$1250.50')).toBeInTheDocument();
  });

  it('calls onView when view action clicked', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const columns = createRestaurantColumns({ onView, onEdit: vi.fn(), onDelete: vi.fn() });
    const restaurant = createRestaurant({ id: 3 });

    render(invokeActionCell(columns, restaurant));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    await user.click(screen.getByText('View'));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('calls onEdit when edit action clicked as admin', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit,
      onDelete: vi.fn(),
      isAdmin: true,
    });
    const restaurant = createRestaurant({ id: 5 });

    render(invokeActionCell(columns, restaurant));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    await user.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it('calls onDelete when delete action clicked as admin', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete,
      isAdmin: true,
    });
    const restaurant = createRestaurant({ id: 5 });

    render(invokeActionCell(columns, restaurant));

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuBtn);

    await user.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it('renders name header', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    render(invokeHeader(columns, 'name'));

    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders address header', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    render(invokeHeader(columns, 'address'));

    expect(screen.getByText('Address')).toBeInTheDocument();
  });

  it('renders cuisine header', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const { container } = render(invokeHeader(columns, 'cuisine'));

    expect(container.querySelector('[data-testid="cuisine-col"]')).toBeInTheDocument();
    expect(screen.getByText('Cuisine')).toBeInTheDocument();
  });

  it('renders total expenses header aligned right', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const { container } = render(invokeHeader(columns, 'totalExpenses'));

    expect(container.querySelector('.text-right')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
  });

  it('renders total amount header aligned right', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const { container } = render(invokeHeader(columns, 'totalAmount'));

    expect(container.querySelector('.text-right')).toBeInTheDocument();
    expect(screen.getByText('Total Amount')).toBeInTheDocument();
  });

  it('renders actions header', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    render(invokeActionHeader(columns));

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('defaults total expenses to 0 when missing', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ totalExpenses: undefined });
    render(invokeCell(columns, 'totalExpenses', restaurant));

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('defaults total amount to 0 when missing', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ totalAmount: undefined });
    render(invokeCell(columns, 'totalAmount', restaurant));

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('renders name link with correct href', () => {
    const columns = createRestaurantColumns({
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const restaurant = createRestaurant({ id: 7, name: 'Taco Spot' });
    render(invokeCell(columns, 'name', restaurant));

    const link = screen.getByRole('link', { name: 'Taco Spot' });
    expect(link).toHaveAttribute('href', '/restaurants/7/');
  });
});
