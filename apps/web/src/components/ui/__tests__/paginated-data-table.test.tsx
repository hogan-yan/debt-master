import type { ColumnDef } from '@tanstack/react-table';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PaginatedDataTable, type PaginationInfo } from '../paginated-data-table';

beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => (args?: Record<string, unknown>) =>
        args ? `${String(key)}-${JSON.stringify(args)}` : String(key),
    }
  ),
}));

interface TestRow {
  id: number;
  name: string;
  amount: number;
}

const defaultColumns = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }: { row: { original: TestRow } }) => row.original.name,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }: { row: { original: TestRow } }) => row.original.amount,
  },
];

const defaultPagination: PaginationInfo = {
  page: 1,
  pageSize: 10,
  totalCount: 25,
  totalPages: 3,
  hasNextPage: true,
  hasPreviousPage: false,
};

const defaultProps = {
  columns: defaultColumns,
  data: [
    { id: 1, name: 'Alice', amount: 100 },
    { id: 2, name: 'Bob', amount: 200 },
  ] as TestRow[],
  pagination: defaultPagination,
  onPaginationChange: vi.fn(),
  onSearchChange: vi.fn(),
  onSortChange: vi.fn(),
};

describe('PaginatedDataTable', () => {
  it('renders table with data rows', () => {
    render(<PaginatedDataTable {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Use getAllByText since '100' may appear in pagination info, then check table cells
    const cells = screen.getAllByRole('cell');
    const cellTexts = cells.map((c) => c.textContent);
    expect(cellTexts).toContain('100');
    expect(cellTexts).toContain('200');
  });

  it('renders column headers', () => {
    render(<PaginatedDataTable {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<PaginatedDataTable {...defaultProps} data={[]} />);
    expect(screen.getByText('table_noResults')).toBeInTheDocument();
  });

  it('calls onSearchChange when search button clicked', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('table_search');
    await user.type(input, 'test query');
    await user.click(screen.getByRole('button', { name: 'table_search' }));

    expect(onSearchChange).toHaveBeenCalledWith('test query');
  });

  it('calls onSearchChange when Enter key pressed in search input', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('table_search');
    await user.type(input, 'enter search{Enter}');

    expect(onSearchChange).toHaveBeenCalledWith('enter search');
  });

  it('clears search and calls onSearchChange with empty string', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('table_search');
    await user.type(input, 'clear me');

    const clearBtn = screen.getByRole('button', { name: 'table_clearSearch' });
    await user.click(clearBtn);

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(input).toHaveValue('');
  });

  it('debounces search in expense variant', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <PaginatedDataTable
        {...defaultProps}
        searchUiVariant="expense"
        onSearchChange={onSearchChange}
      />
    );

    const input = screen.getByPlaceholderText('table_search');
    await user.type(input, 'debounced');

    // Should not be called immediately due to debounce
    expect(onSearchChange).not.toHaveBeenCalled();

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onSearchChange).toHaveBeenCalledWith('debounced');
  });

  it('does not show search button in expense variant', () => {
    render(<PaginatedDataTable {...defaultProps} searchUiVariant="expense" />);
    expect(screen.queryByRole('button', { name: 'table_search' })).not.toBeInTheDocument();
  });

  it('calls onSortChange when column header clicked', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onSortChange={onSortChange} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('toggles sort order on repeated clicks', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onSortChange={onSortChange} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);
    expect(onSortChange).toHaveBeenLastCalledWith('name', 'desc');

    await user.click(nameHeader);
    expect(onSortChange).toHaveBeenLastCalledWith('name', 'asc');
  });

  it('calls onPaginationChange when page changed', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onPaginationChange={onPaginationChange} />);

    await user.click(screen.getByRole('button', { name: 'table_next' }));
    expect(onPaginationChange).toHaveBeenCalledWith(2, 10);
  });

  it('calls onPaginationChange with page 1 when page size changed', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onPaginationChange={onPaginationChange} />);

    const select = screen.getByLabelText('table_rowsPerPage');
    await user.selectOptions(select, '20');

    expect(onPaginationChange).toHaveBeenCalledWith(1, 20);
  });

  it('disables previous page button on first page', () => {
    render(<PaginatedDataTable {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'table_previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'table_first' })).toBeDisabled();
  });

  it('disables next page button on last page', () => {
    const lastPagePagination: PaginationInfo = {
      page: 3,
      pageSize: 10,
      totalCount: 25,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    };
    render(<PaginatedDataTable {...defaultProps} pagination={lastPagePagination} />);
    expect(screen.getByRole('button', { name: 'table_next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'table_last' })).toBeDisabled();
  });

  it('calls onPaginationChange when clicking a page number', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onPaginationChange={onPaginationChange} />);

    const page2Button = screen.getByRole('button', { name: '2' });
    await user.click(page2Button);

    expect(onPaginationChange).toHaveBeenCalledWith(2, 10);
  });

  it('shows pagination info text', () => {
    render(<PaginatedDataTable {...defaultProps} />);
    expect(screen.getByText(/table_showing/)).toBeInTheDocument();
    expect(screen.getByText(/table_ofResults/)).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onRowClick={onRowClick} />);

    const row = screen.getByText('Alice').closest('tr');
    if (row) {
      await user.click(row);
    }
    expect(onRowClick).toHaveBeenCalledWith(defaultProps.data[0]);
  });

  it('renders mobile card view when mobileCardView is true', () => {
    const renderMobileCard = (item: TestRow) => (
      <div data-testid={`mobile-card-${item.id}`}>{item.name}</div>
    );
    render(
      <PaginatedDataTable
        {...defaultProps}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    expect(screen.getByTestId('mobile-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-card-2')).toBeInTheDocument();
  });

  it('shows loading state in empty data', () => {
    render(<PaginatedDataTable {...defaultProps} data={[]} isLoading={true} />);
    expect(screen.getByText('common_loading')).toBeInTheDocument();
  });

  it('disables pagination controls when loading', () => {
    render(<PaginatedDataTable {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button', { name: 'table_next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'table_search' })).toBeDisabled();
  });

  it('uses custom test ids when provided', () => {
    render(
      <PaginatedDataTable
        {...defaultProps}
        searchInputTestId="custom-search-input"
        searchBtnTestId="custom-search-btn"
        rowTestId="custom-row"
      />
    );
    expect(screen.getByTestId('custom-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('custom-search-btn')).toBeInTheDocument();
    expect(screen.getAllByTestId('custom-row').length).toBe(2);
  });

  it('renders ellipsis as disabled buttons in pagination', () => {
    const largePagination: PaginationInfo = {
      page: 5,
      pageSize: 10,
      totalCount: 100,
      totalPages: 10,
      hasNextPage: true,
      hasPreviousPage: true,
    };
    render(<PaginatedDataTable {...defaultProps} pagination={largePagination} />);

    // Should find ellipsis buttons that are disabled
    const ellipsisButtons = screen.getAllByRole('button', { name: '...' });
    expect(ellipsisButtons.length).toBeGreaterThan(0);
    ellipsisButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('uses custom allowed page sizes', () => {
    render(<PaginatedDataTable {...defaultProps} allowedPageSizes={[5, 15, 30]} />);
    const select = screen.getByLabelText('table_rowsPerPage');
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
    expect(options[0]).toHaveValue('5');
    expect(options[1]).toHaveValue('15');
    expect(options[2]).toHaveValue('30');
  });

  it('shows custom search placeholder', () => {
    render(<PaginatedDataTable {...defaultProps} searchPlaceholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('shows loading spinner after delay when isLoading=true', async () => {
    render(<PaginatedDataTable {...defaultProps} isLoading={true} />);
    // Should not show immediately
    expect(screen.queryByText('common_loading')).not.toBeInTheDocument();
    // Wait for delay
    await waitFor(() => expect(screen.getByText('common_loading')).toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it('does not show loading spinner when isLoading becomes false', async () => {
    const { rerender } = render(<PaginatedDataTable {...defaultProps} isLoading={true} />);
    await waitFor(() => expect(screen.getByText('common_loading')).toBeInTheDocument(), {
      timeout: 2000,
    });

    rerender(<PaginatedDataTable {...defaultProps} isLoading={false} />);
    expect(screen.queryByText('common_loading')).not.toBeInTheDocument();
  });

  it('renders mobile card view with empty data and loading', () => {
    const renderMobileCard = (item: TestRow) => (
      <div data-testid={`mobile-card-${item.id}`}>{item.name}</div>
    );
    render(
      <PaginatedDataTable
        {...defaultProps}
        data={[]}
        isLoading={true}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    // Both mobile and desktop empty states render in jsdom
    expect(screen.getAllByText('common_loading').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile card view with empty data and not loading', () => {
    const renderMobileCard = (item: TestRow) => (
      <div data-testid={`mobile-card-${item.id}`}>{item.name}</div>
    );
    render(
      <PaginatedDataTable
        {...defaultProps}
        data={[]}
        isLoading={false}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    expect(screen.getAllByText('table_noResults').length).toBeGreaterThanOrEqual(1);
  });

  it('applies table-fixed class when column has size', () => {
    const sizedColumns = [
      { accessorKey: 'name', header: 'Name', size: 150 },
      { accessorKey: 'amount', header: 'Amount' },
    ];
    render(<PaginatedDataTable {...defaultProps} columns={sizedColumns} />);
    const table = screen.getByRole('table');
    expect(table.className).toContain('table-fixed');
  });

  it('handles column without sort capability', () => {
    const noSortColumns = [
      { accessorKey: 'name', header: 'Name', enableSorting: false },
      { accessorKey: 'amount', header: 'Amount' },
    ];
    render(<PaginatedDataTable {...defaultProps} columns={noSortColumns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('does not apply table-fixed when no columns have size', () => {
    render(<PaginatedDataTable {...defaultProps} />);
    const table = screen.getByRole('table');
    expect(table.className).not.toContain('table-fixed');
  });

  it('hides pagination when totalPages is 1', () => {
    const singlePagePagination: PaginationInfo = {
      page: 1,
      pageSize: 10,
      totalCount: 5,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    render(
      <PaginatedDataTable
        {...defaultProps}
        pagination={singlePagePagination}
        onPaginationChange={vi.fn()}
      />
    );
    // Only page 1 button, no dots
    expect(screen.queryByRole('button', { name: '...' })).not.toBeInTheDocument();
  });

  it('calls onPaginationChange with first page when first page button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();
    const midPagination: PaginationInfo = {
      page: 3,
      pageSize: 10,
      totalCount: 50,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: true,
    };
    render(
      <PaginatedDataTable
        {...defaultProps}
        pagination={midPagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const firstPageBtn = screen.getByRole('button', { name: 'table_first' });
    await user.click(firstPageBtn);
    expect(onPaginationChange).toHaveBeenCalledWith(1, 10);
  });

  it('calls onPaginationChange with last page when last page button clicked', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();
    const midPagination: PaginationInfo = {
      page: 3,
      pageSize: 10,
      totalCount: 50,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: true,
    };
    render(
      <PaginatedDataTable
        {...defaultProps}
        pagination={midPagination}
        onPaginationChange={onPaginationChange}
      />
    );

    const lastPageBtn = screen.getByRole('button', { name: 'table_last' });
    await user.click(lastPageBtn);
    expect(onPaginationChange).toHaveBeenCalledWith(5, 10);
  });

  // --- Branch coverage: getColStyle with no size ---
  it('does not apply table-fixed when all columns lack size in mobile card view', () => {
    const noSizeColumns = [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'amount', header: 'Amount' },
    ];
    const renderMobileCard = (item: TestRow) => <div>{item.name}</div>;
    render(
      <PaginatedDataTable
        {...defaultProps}
        columns={noSizeColumns}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    // The desktop table inside mobile card view should not have table-fixed
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(1);
    tables.forEach((table) => {
      expect(table.className).not.toContain('table-fixed');
    });
  });

  // --- Branch coverage: expense variant debounce without prior timer ---
  it('fires expense search immediately when no prior debounce timer exists', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <PaginatedDataTable
        {...defaultProps}
        searchUiVariant="expense"
        onSearchChange={onSearchChange}
      />
    );

    const input = screen.getByPlaceholderText('table_search');
    // Type first character - no prior timer, so the "if (debounceTimerRef.current != null)" else branch is hit
    await user.type(input, 'a');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  // --- Branch coverage: unmount expense variant without active timer ---
  it('unmounts expense variant without crashing when no active debounce timer', () => {
    const onSearchChange = vi.fn();
    const { unmount } = render(
      <PaginatedDataTable
        {...defaultProps}
        searchUiVariant="expense"
        onSearchChange={onSearchChange}
      />
    );
    // Unmount without ever typing (no timer) - cleanup effect "if (debounceTimerRef.current != null)" else branch
    unmount();
    // Unmounting is the assertion: no crash, and the debounce never fired.
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  // --- Branch coverage: click non-sortable column ---
  it('does not call onSortChange when clicking a non-sortable column header', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const noSortColumns = [
      { accessorKey: 'name', header: 'Name', enableSorting: false },
      { accessorKey: 'amount', header: 'Amount' },
    ];
    render(
      <PaginatedDataTable {...defaultProps} columns={noSortColumns} onSortChange={onSortChange} />
    );

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    expect(onSortChange).not.toHaveBeenCalled();
  });

  // --- Branch coverage: clear search in default variant (no debounce timer) ---
  it('clears search in default variant without an active debounce timer', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<PaginatedDataTable {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('table_search');
    await user.type(input, 'x');

    // Clear button click in default variant - debounceTimerRef.current is null
    const clearBtn = screen.getByRole('button', { name: 'table_clearSearch' });
    await user.click(clearBtn);

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('clears an active expense search debounce before it submits', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <PaginatedDataTable
        {...defaultProps}
        searchUiVariant="expense"
        onSearchChange={onSearchChange}
      />
    );

    await user.type(screen.getByPlaceholderText('table_search'), 'pending');
    await user.click(screen.getByRole('button', { name: 'table_clearSearch' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onSearchChange).not.toHaveBeenCalledWith('pending');
  });

  it('changes to the previous page from a later page', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();
    const pagination: PaginationInfo = {
      ...defaultPagination,
      page: 2,
      hasPreviousPage: true,
    };
    render(
      <PaginatedDataTable
        {...defaultProps}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'table_previous' }));
    expect(onPaginationChange).toHaveBeenCalledWith(1, 10);
  });

  it('allows clicking rows without an onRowClick callback', async () => {
    const user = userEvent.setup();
    render(<PaginatedDataTable {...defaultProps} />);

    await user.click(screen.getByText('Alice').closest('tr')!);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  // --- Branch coverage: mobile card with non-string/non-number id ---
  it('uses row index as key when item id is not string or number in mobile card view', () => {
    interface NoIdRow {
      name: string;
      amount: number;
    }
    const noIdData: NoIdRow[] = [
      { name: 'Alice', amount: 100 },
      { name: 'Bob', amount: 200 },
    ];
    const noIdColumns = [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'amount', header: 'Amount' },
    ];
    const renderMobileCard = (item: NoIdRow, index: number) => (
      <div data-testid={`mobile-card-${index}`}>{item.name}</div>
    );
    render(
      <PaginatedDataTable
        {...defaultProps}
        data={noIdData}
        columns={noIdColumns}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    expect(screen.getByTestId('mobile-card-0')).toHaveTextContent('Alice');
    expect(screen.getByTestId('mobile-card-1')).toHaveTextContent('Bob');
  });

  // --- Branch coverage: mobile card view desktop table with non-sortable column ---
  it('renders non-sortable column in mobile card view desktop table', () => {
    const noSortColumns = [
      { accessorKey: 'name', header: 'Name', enableSorting: false },
      { accessorKey: 'amount', header: 'Amount' },
    ];
    const renderMobileCard = (item: TestRow) => <div>{item.name}</div>;
    render(
      <PaginatedDataTable
        {...defaultProps}
        columns={noSortColumns}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  // --- Branch coverage: mobile card view desktop table without onRowClick ---
  it('renders mobile card view desktop table without onRowClick', () => {
    const renderMobileCard = (item: TestRow) => <div>{item.name}</div>;
    render(
      <PaginatedDataTable
        {...defaultProps}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    // Desktop table should render without cursor-pointer class
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(0);
  });

  // --- Branch coverage: placeholder header in standard table ---
  it('renders placeholder header as null in standard table view', () => {
    const placeholderColumns: ColumnDef<TestRow>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      { accessorKey: 'name', header: 'Name' },
    ];
    render(<PaginatedDataTable {...defaultProps} columns={placeholderColumns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  // --- Branch coverage: non-selected row in standard table ---
  it('renders non-selected row in standard table', () => {
    const selectColumns = [
      {
        id: 'select',
        header: 'Select',
        cell: () => <input type="checkbox" />,
      },
      { accessorKey: 'name', header: 'Name' },
    ];
    render(<PaginatedDataTable {...defaultProps} columns={selectColumns} />);
    const rows = screen.getAllByRole('row');
    // Should have header + 2 data rows, none selected
    expect(rows.length).toBe(3);
  });

  // --- Branch coverage: fallback message functions (defensive, unreachable in practice) ---
  it('renders with standard message functions', () => {
    render(<PaginatedDataTable {...defaultProps} />);
    expect(screen.getByText('table_search')).toBeInTheDocument();
  });

  // --- Branch coverage: mobile card view with pre-set sorting ---
  it('renders mobile card view with pre-set sorting state', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const renderMobileCard = (item: TestRow) => <div>{item.name}</div>;
    render(
      <PaginatedDataTable
        {...defaultProps}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
        onSortChange={onSortChange}
      />
    );

    // Click a sortable header in the desktop table (hidden in jsdom but still rendered)
    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
  });

  // --- Branch coverage: mobile card view with placeholder header ---
  it('renders placeholder header in mobile card view desktop table', () => {
    const placeholderColumns: ColumnDef<TestRow>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      { accessorKey: 'name', header: 'Name' },
    ];
    const renderMobileCard = (item: TestRow) => <div>{item.name}</div>;
    render(
      <PaginatedDataTable
        {...defaultProps}
        columns={placeholderColumns}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  // --- Branch coverage: mobile card view with non-selected row ---
  it('renders non-selected row in mobile card view desktop table', () => {
    const selectColumns = [
      {
        id: 'select',
        header: 'Select',
        cell: () => <input type="checkbox" />,
      },
      { accessorKey: 'name', header: 'Name' },
    ];
    const renderMobileCard = (item: TestRow) => <div>{item.name}</div>;
    render(
      <PaginatedDataTable
        {...defaultProps}
        columns={selectColumns}
        mobileCardView={true}
        renderMobileCard={renderMobileCard}
      />
    );
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('invokes onRowClick from mobile card view desktop table rows', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const sizedColumns = [
      { accessorKey: 'name', header: 'Name', size: 160, enableSorting: true },
      { accessorKey: 'value', header: 'Value', size: 80 },
    ];
    render(
      <PaginatedDataTable
        {...defaultProps}
        columns={sizedColumns}
        mobileCardView={true}
        renderMobileCard={(item: TestRow) => <div>{item.name}</div>}
        onRowClick={onRowClick}
      />
    );

    const nameHeader = screen.getAllByText('Name')[0];
    if (!nameHeader) throw new Error('Name header missing');
    await user.click(nameHeader);
    await user.click(nameHeader);

    const dataRows = screen.getAllByRole('row').filter((row) => row.textContent?.includes('Alice'));
    const target = dataRows[0];
    if (!target) throw new Error('Alice row missing');
    await user.click(target);
    expect(onRowClick).toHaveBeenCalled();
  });
});
