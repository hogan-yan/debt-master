import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { getPaymentStats, getPaymentsPaginated } from '@/server/payments';
import { PaginatedPayments } from '@/types';

interface ListParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search: string;
}

interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  averageAmount: number;
  uniquePayers?: number;
}

interface LoaderData {
  paginatedPayments: PaginatedPayments;
  stats: PaymentStats;
}

const DEFAULT_PARAMS: ListParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'date',
  sortOrder: 'desc',
  search: '',
};

/**
 * Payments list state + data seam. Params are the single source of truth for
 * the query key; mutations call invalidateQueries, so a refetch never resets
 * the page/search/sort the user is on.
 */
export function usePaymentList(initial: LoaderData) {
  const queryClient = useQueryClient();

  const [params, setParams] = useState<ListParams>(DEFAULT_PARAMS);

  // The loader type is the JSON-widened shape; pin TData to it so the
  // narrower server-fn return stays assignable.
  const listQuery = useQuery<PaginatedPayments>({
    queryKey: ['payments', 'list', { ...params }],
    queryFn: async () => getPaymentsPaginated({ data: { ...params } }),
    placeholderData: keepPreviousData,
    initialData: initial.paginatedPayments,
  });

  const statsQuery = useQuery<PaymentStats>({
    queryKey: ['payments', 'stats'],
    queryFn: () => getPaymentStats(),
    initialData: initial.stats,
  });

  const paginatedData = listQuery.data ?? initial.paginatedPayments;
  const stats = statsQuery.data ?? initial.stats;
  const isLoading = listQuery.isFetching;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  }, [queryClient]);

  const handlePaginationChange = useCallback((page: number, pageSize: number) => {
    setParams((prev) => ({ ...prev, page, pageSize }));
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setParams((prev) => (prev.search === search ? prev : { ...prev, search, page: 1 }));
  }, []);

  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    const validSortFields = ['date', 'amount', 'paymentType', 'colleagueName'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'date';
    setParams((prev) => ({ ...prev, sortBy: field, sortOrder }));
  }, []);

  return useMemo(
    () => ({
      paginatedData,
      stats,
      params,
      isLoading,
      handlePaginationChange,
      handleSearchChange,
      handleSortChange,
      refresh,
    }),
    [
      paginatedData,
      stats,
      params,
      isLoading,
      refresh,
      handlePaginationChange,
      handleSearchChange,
      handleSortChange,
    ]
  );
}
