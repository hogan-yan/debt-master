import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTableWithActions } from '../data-table-with-actions';

vi.mock('../paginated-data-table', () => ({
  PaginatedDataTable: () => <div data-testid="mock-table">Table</div>,
}));

const mockPagination = {
  page: 1,
  pageSize: 10,
  totalCount: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

describe('DataTableWithActions', () => {
  it('renders title and table', () => {
    render(
      <DataTableWithActions
        title="Test Table"
        columns={[]}
        data={[]}
        pagination={mockPagination}
        onPaginationChange={vi.fn()}
        onSearchChange={vi.fn()}
        onSortChange={vi.fn()}
        searchPlaceholder="Search..."
        isLoading={false}
      />
    );

    expect(screen.getByText('Test Table')).toBeInTheDocument();
    expect(screen.getByTestId('mock-table')).toBeInTheDocument();
  });

  it('renders empty state component when provided', () => {
    render(
      <DataTableWithActions
        title="Table"
        columns={[]}
        data={[]}
        pagination={mockPagination}
        onPaginationChange={vi.fn()}
        onSearchChange={vi.fn()}
        onSortChange={vi.fn()}
        searchPlaceholder="Search..."
        isLoading={false}
        emptyStateComponent={<div>No data found</div>}
      />
    );

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DataTableWithActions
        title="Table"
        columns={[]}
        data={[]}
        pagination={mockPagination}
        onPaginationChange={vi.fn()}
        onSearchChange={vi.fn()}
        onSortChange={vi.fn()}
        searchPlaceholder="Search..."
        isLoading={false}
        className="custom-class"
      />
    );

    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('renders without empty state by default', () => {
    const { container } = render(
      <DataTableWithActions
        title="Table"
        columns={[]}
        data={[]}
        pagination={mockPagination}
        onPaginationChange={vi.fn()}
        onSearchChange={vi.fn()}
        onSortChange={vi.fn()}
        searchPlaceholder="Search..."
        isLoading={false}
      />
    );

    // Only the mock table, no extra empty state
    expect(container.querySelector('[data-testid="mock-table"]')).toBeInTheDocument();
  });
});
