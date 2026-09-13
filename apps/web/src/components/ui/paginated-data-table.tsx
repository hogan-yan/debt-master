/**
 * Enhanced DataTable component with server-side pagination support - NO AUTOMATIC EFFECTS
 */

import type { Column, ColumnDef, SortingState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LoaderIcon,
  SearchIcon,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { m } from '@/paraglide/messages';
import { Button } from './button';
import { Input } from './input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

type ColumnDefWithSize = { size?: number | undefined };

export function getColStyle(col: ColumnDefWithSize) {
  return col.size ? { width: col.size, maxWidth: col.size } : undefined;
}

export function hasAnySize(columns: ColumnDefWithSize[]) {
  return columns.some((col) => col.size != null);
}

export function clearDebounceTimer(timerId: ReturnType<typeof setTimeout> | null): void {
  if (timerId != null) {
    globalThis.clearTimeout(timerId);
  }
}

export function headerCellContent(
  isPlaceholder: boolean,
  content: React.ReactNode
): React.ReactNode {
  return isPlaceholder ? null : content;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pagination: PaginationInfo;
  onPaginationChange: (page: number, pageSize: number) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  searchPlaceholder?: string | undefined;
  isLoading?: boolean | undefined;
  allowedPageSizes?: number[] | undefined;
  searchUiVariant?: 'default' | 'expense' | undefined;
  mobileCardView?: boolean | undefined;
  renderMobileCard?: ((item: TData, index: number) => React.ReactNode) | undefined;
  onRowClick?: ((row: TData) => void) | undefined;
  searchInputTestId?: string | undefined;
  searchBtnTestId?: string | undefined;
  rowTestId?: string | undefined;
}

export function PaginatedDataTable<TData, TValue>({
  columns,
  data,
  pagination,
  onPaginationChange,
  onSearchChange,
  onSortChange,
  searchPlaceholder = m.table_search(),
  isLoading = false,
  allowedPageSizes = [10, 20, 50, 100],
  searchUiVariant = 'default',
  mobileCardView = false,
  renderMobileCard,
  onRowClick,
  searchInputTestId,
  searchBtnTestId,
  rowTestId,
}: PaginatedDataTableProps<TData, TValue>) {
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isLoadingVisible, setIsLoadingVisible] = useState(false);

  // Manual search handler - NO AUTOMATIC EFFECTS
  const handleSearchSubmit = () => {
    onSearchChange(search);
  };

  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const hasMountedRef = useRef(false);
  const lastFiredSearchRef = useRef<string>('');

  // Expense-like search: submit as the user types (debounced). The last-fired
  // guard matters: parents recreate onSearchChange each render, so without it
  // every re-render (e.g. pagination change) would re-fire the search and
  // reset the list to page 1.
  useEffect(() => {
    if (searchUiVariant !== 'expense') return;

    // Skip firing on initial mount — parent already loaded data with empty search
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      lastFiredSearchRef.current = search;
      return;
    }

    if (search === lastFiredSearchRef.current) return;

    clearDebounceTimer(debounceTimerRef.current);

    debounceTimerRef.current = globalThis.setTimeout(() => {
      lastFiredSearchRef.current = search;
      onSearchChange(search);
    }, 300);

    return () => {
      clearDebounceTimer(debounceTimerRef.current);
      debounceTimerRef.current = null;
    };
  }, [search, searchUiVariant, onSearchChange]);

  // Manual sort handler - NO AUTOMATIC EFFECTS
  const handleSortClick = (column: Column<TData, unknown>) => {
    if (column.getCanSort()) {
      const isCurrentlyDesc = sorting.find((s) => s.id === column.id)?.desc;
      const newSortOrder = isCurrentlyDesc ? 'asc' : 'desc';
      setSorting([{ id: column.id, desc: !isCurrentlyDesc }]);
      onSortChange(column.id, newSortOrder);
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: pagination.totalPages,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  const handlePageChange = (newPage: number) => {
    onPaginationChange(newPage, pagination.pageSize);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    onPaginationChange(1, newPageSize); // Reset to page 1 when changing page size
  };

  const pageNumbers = useMemo(() => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, pagination.page - delta);
      i <= Math.min(pagination.totalPages - 1, pagination.page + delta);
      i++
    ) {
      range.push(i);
    }

    if (pagination.page - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (pagination.page + delta < pagination.totalPages - 1) {
      rangeWithDots.push('...', pagination.totalPages);
    } else if (pagination.totalPages > 1) {
      rangeWithDots.push(pagination.totalPages);
    }

    return rangeWithDots;
  }, [pagination.page, pagination.totalPages]);

  const shouldShowSearchButton = searchUiVariant === 'default';
  const shouldShowInlineLoadingStatus = searchUiVariant === 'default';

  // Avoid loading flicker near the search input by delaying visibility.
  useEffect(() => {
    if (!isLoading) {
      setIsLoadingVisible(false);
      return;
    }

    const timer = globalThis.setTimeout(() => {
      setIsLoadingVisible(true);
    }, 250);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [isLoading]);

  return (
    <div className="space-y-4">
      {/* Manual Search - NO AUTO EFFECTS */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
            className={`pl-10 ${search ? 'pr-9' : ''}`}
            data-testid={searchInputTestId}
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                if (debounceTimerRef.current != null) {
                  globalThis.clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                onSearchChange('');
              }}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              aria-label={m.table_clearSearch()}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {shouldShowSearchButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearchSubmit}
            disabled={isLoading}
            data-testid={searchBtnTestId}
          >
            {m.table_search()}
          </Button>
        )}
        {shouldShowInlineLoadingStatus && isLoadingVisible && (
          <div
            className="flex items-center space-x-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{m.common_loading()}</span>
          </div>
        )}
      </div>

      {/* Responsive Content: Mobile Cards or Desktop Table */}
      {mobileCardView && renderMobileCard ? (
        <>
          {/* Mobile Card View */}
          <div className="block lg:hidden">
            <div className="space-y-3">
              {data.length ? (
                data.map((item, index) => {
                  const id = (item as Record<string, unknown>).id;
                  const key =
                    typeof id === 'string' || typeof id === 'number' ? String(id) : `row-${index}`;
                  return <div key={key}>{renderMobileCard(item, index)}</div>;
                })
              ) : (
                <div className="text-center py-8 px-4">
                  <p className="text-muted-foreground">
                    {isLoading ? m.common_loading() : m.table_noResults()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <div className="rounded-md border overflow-hidden">
              <Table className={hasAnySize(columns) ? 'table-fixed' : ''}>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const currentSort = sorting.find((s) => s.id === header.column.id);
                        const ariaSort = currentSort
                          ? currentSort.desc
                            ? 'descending'
                            : ('ascending' as const)
                          : ('none' as const);
                        return (
                          <TableHead
                            key={header.id}
                            className={
                              header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                            }
                            style={getColStyle(header.column.columnDef)}
                            onClick={() => handleSortClick(header.column)}
                            aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                          >
                            {headerCellContent(
                              header.isPlaceholder,
                              flexRender(header.column.columnDef.header, header.getContext())
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-testid={rowTestId}
                        className={onRowClick ? 'cursor-pointer' : ''}
                        onClick={() => onRowClick?.(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} style={getColStyle(cell.column.columnDef)}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        {isLoading ? m.common_loading() : m.table_noResults()}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : (
        /* Standard Table View Only */
        <div className="rounded-md border overflow-hidden">
          <Table className={hasAnySize(columns) ? 'table-fixed' : ''}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const currentSort = sorting.find((s) => s.id === header.column.id);
                    const ariaSort = currentSort
                      ? currentSort.desc
                        ? 'descending'
                        : ('ascending' as const)
                      : ('none' as const);
                    return (
                      <TableHead
                        key={header.id}
                        className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        style={getColStyle(header.column.columnDef)}
                        onClick={() => handleSortClick(header.column)}
                        aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                      >
                        {headerCellContent(
                          header.isPlaceholder,
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid={rowTestId}
                    className={onRowClick ? 'cursor-pointer' : ''}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={getColStyle(cell.column.columnDef)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {isLoading ? m.common_loading() : m.table_noResults()}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        {/* Page Size Selector */}
        <div className="flex items-center justify-center space-x-2 lg:justify-start">
          <p className="text-sm font-medium">{m.table_rowsPerPage()}</p>
          <select
            value={pagination.pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="h-8 w-[70px] rounded border border-input text-sm"
            aria-label={m.table_rowsPerPage()}
            disabled={isLoading}
          >
            {allowedPageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-center lg:order-last lg:justify-end">
          <p className="text-sm text-muted-foreground text-center lg:text-right">
            <span className="block sm:inline">
              {m.table_showing({
                from: String(
                  Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)
                ),
                to: String(Math.min(pagination.page * pagination.pageSize, pagination.totalCount)),
              })}
            </span>
            <span className="block sm:inline">
              {' '}
              {m.table_ofResults({ total: String(pagination.totalCount) })}
            </span>
          </p>
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center justify-center space-x-1 lg:order-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={!pagination.hasPreviousPage || isLoading}
            className="hidden sm:flex"
            aria-label={m.table_first()}
          >
            <ChevronsLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPreviousPage || isLoading}
            aria-label={m.table_previous()}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>

          <div className="flex items-center space-x-1 max-w-full overflow-x-auto">
            <div className="flex items-center space-x-1 min-w-0">
              {pageNumbers.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={pageNumber === pagination.page ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => typeof pageNumber === 'number' && handlePageChange(pageNumber)}
                  disabled={typeof pageNumber !== 'number' || isLoading}
                >
                  {pageNumber}
                </Button>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNextPage || isLoading}
            aria-label={m.table_next()}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={!pagination.hasNextPage || isLoading}
            className="hidden sm:flex"
            aria-label={m.table_last()}
          >
            <ChevronsRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
