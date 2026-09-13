import type { ColumnDef } from '@tanstack/react-table';
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedDataTable, PaginationInfo } from '@/components/ui/paginated-data-table';

type SearchUiVariant = 'default' | 'expense';

interface DataTableWithActionsProps<TData, TValue = unknown> {
  title: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pagination: PaginationInfo;
  // sync or async — callers with query-key state updates are sync
  onPaginationChange: (page: number, pageSize: number) => void | Promise<void>;
  onSearchChange: (search: string) => void | Promise<void>;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void | Promise<void>;
  searchPlaceholder: string;
  isLoading: boolean;
  searchUiVariant?: SearchUiVariant | undefined;
  mobileCardView?: boolean | undefined;
  renderMobileCard?: ((item: TData, index: number) => ReactNode) | undefined;
  emptyStateComponent?: ReactNode | undefined;
  className?: string | undefined;
  onRowClick?: ((row: TData) => void) | undefined;
  searchInputTestId?: string | undefined;
  searchBtnTestId?: string | undefined;
  tableTestId?: string | undefined;
  rowTestId?: string | undefined;
}

export function DataTableWithActions<TData, TValue = unknown>({
  title,
  columns,
  data,
  pagination,
  onPaginationChange,
  onSearchChange,
  onSortChange,
  searchPlaceholder,
  isLoading,
  searchUiVariant = 'default',
  mobileCardView,
  renderMobileCard,
  emptyStateComponent,
  className = '',
  onRowClick,
  searchInputTestId,
  searchBtnTestId,
  tableTestId,
  rowTestId,
}: DataTableWithActionsProps<TData, TValue>) {
  return (
    <Card className={className} data-testid={tableTestId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <PaginatedDataTable<TData, TValue>
          columns={columns}
          data={data}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          searchPlaceholder={searchPlaceholder}
          isLoading={isLoading}
          searchUiVariant={searchUiVariant}
          mobileCardView={mobileCardView}
          renderMobileCard={renderMobileCard}
          onRowClick={onRowClick}
          searchInputTestId={searchInputTestId}
          searchBtnTestId={searchBtnTestId}
          rowTestId={rowTestId}
        />
        {emptyStateComponent}
      </CardContent>
    </Card>
  );
}
