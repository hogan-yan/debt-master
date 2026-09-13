import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Search,
} from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { Button } from './button';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  className?: string;
  pagination?: boolean;
  pageSize?: number;
  filtering?: boolean;
  sorting?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = m.table_search(),
  className,
  pagination = true,
  pageSize = 10,
  filtering = true,
  sorting: sortingEnabled = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    ...(pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(sortingEnabled ? { getSortedRowModel: getSortedRowModel() } : {}),
    ...(filtering ? { getFilteredRowModel: getFilteredRowModel() } : {}),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = pageIndex + 1;

  const pageNumbers = React.useMemo(() => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(pageCount - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < pageCount - 1) {
      rangeWithDots.push('...', pageCount);
    } else if (pageCount > 1) {
      rangeWithDots.push(pageCount);
    }

    return rangeWithDots;
  }, [currentPage, pageCount]);

  const pageSizeOptions = React.useMemo(() => {
    const defaults = [10, 20, 30, 40, 50];
    return Array.from(new Set([pageSize, ...defaults])).sort((a, b) => a - b);
  }, [pageSize]);

  return (
    <div className={cn('w-full', className)}>
      {/* Search Controls */}
      {filtering && (
        <div className="flex items-center py-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-8 max-w-sm"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Sort by ${header.column.id}`}
                          className="flex items-center space-x-2 cursor-pointer select-none"
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              header.column.getToggleSortingHandler()?.(e);
                            }
                          }}
                        >
                          <div>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                          {sortingEnabled && (
                            <div>
                              {header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <div className="h-4 w-4 opacity-50">
                                  <ChevronUp className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                        </div>
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
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {m.table_noResults()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="border-t mt-4 pt-4">
          {/* Mobile pagination */}
          <div className="flex sm:hidden items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {currentPage}/{pageCount}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 p-0"
                aria-label={m.table_previous()}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">{m.table_previous()}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 p-0"
                aria-label={m.table_next()}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">{m.table_next()}</span>
              </Button>
            </div>

            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-12 text-xs" aria-label={m.table_rowsPerPage()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop pagination */}
          <div className="hidden sm:flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{m.table_rowsPerPage()}</p>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-[70px]" aria-label={m.table_rowsPerPage()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {pageSizeOptions.map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 p-0"
                aria-label={m.table_first()}
              >
                <ChevronsLeft className="h-4 w-4" />
                <span className="sr-only">{m.table_first()}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 p-0"
                aria-label={m.table_previous()}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">{m.table_previous()}</span>
              </Button>

              {pageNumbers.map((pageNumber, index) => {
                const currentIndex = pageNumbers.indexOf(currentPage);
                return pageNumber === '...' ? (
                  <Button
                    key={index < currentIndex ? 'ellipsis-left' : 'ellipsis-right'}
                    variant="outline"
                    size="sm"
                    disabled
                    className="h-8 w-8 p-0"
                  >
                    ...
                  </Button>
                ) : (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => table.setPageIndex(Number(pageNumber) - 1)}
                    className="h-8 w-8 p-0"
                  >
                    {pageNumber}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 p-0"
                aria-label={m.table_next()}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">{m.table_next()}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 p-0"
                aria-label={m.table_last()}
              >
                <ChevronsRight className="h-4 w-4" />
                <span className="sr-only">{m.table_last()}</span>
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              {m.table_page({
                current: String(currentPage),
                total: String(pageCount),
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
