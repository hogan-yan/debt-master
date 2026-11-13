import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { ColleagueBalance } from '@/server/balance-calculator';
import { calculateInactiveColleagueBalances } from '@/server/balance-calculator';
import { getInactiveColleaguesPaginated } from '@/server/colleagues/handlers';
import type { PaginatedInactiveColleagues } from '@/types';

type InactiveListParams = {
  page: number;
  pageSize: number;
  sortBy: 'deletedAt' | 'name';
  sortOrder: 'asc' | 'desc';
  search: string;
};

export interface UseInactiveColleagueListResult {
  inactiveData: PaginatedInactiveColleagues;
  isInactiveLoading: boolean;
  inactiveListParams: InactiveListParams;
  fetchInactiveColleagues: (params: InactiveListParams) => Promise<void>;
  handleInactivePaginationChange: (page: number, pageSize: number) => Promise<void>;
  handleInactiveSearchChange: (search: string) => Promise<void>;
  handleInactiveSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => Promise<void>;
}

function mergeWithBalances<T extends { id: number }>(
  items: T[],
  balances: ColleagueBalance[]
): (T & { currentBalance: number })[] {
  const balanceMap = new Map(balances.map((b) => [b.colleagueId, b.currentBalance]));
  return items.map((item) => ({
    ...item,
    currentBalance: balanceMap.get(item.id) ?? 0,
  }));
}

const EMPTY_PAGE: PaginatedInactiveColleagues = {
  data: [],
  pagination: {
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

/**
 * Inactive-tab list. `enabled` gates the fetch so the query runs only while
 * the tab is visible; invalidated with the colleagues domain on CRUD.
 */
export function useInactiveColleagueList(enabled: boolean): UseInactiveColleagueListResult {
  const [inactiveListParams, setInactiveListParams] = useState<InactiveListParams>({
    page: 1,
    pageSize: 10,
    sortBy: 'deletedAt',
    sortOrder: 'desc',
    search: '',
  });

  const inactiveQuery = useQuery({
    queryKey: ['colleagues', 'inactive', { ...inactiveListParams }],
    queryFn: async () => {
      const [updatedData, balances] = await Promise.all([
        getInactiveColleaguesPaginated({ data: { ...inactiveListParams } }),
        calculateInactiveColleagueBalances({ data: undefined }),
      ]);
      return {
        ...updatedData,
        data: mergeWithBalances(updatedData.data, balances),
      };
    },
    placeholderData: keepPreviousData,
    enabled,
  });

  const inactiveData: PaginatedInactiveColleagues = enabled
    ? (inactiveQuery.data ?? EMPTY_PAGE)
    : EMPTY_PAGE;
  const isInactiveLoading = enabled && inactiveQuery.isFetching;

  const fetchInactiveColleagues = useCallback(async (params: InactiveListParams): Promise<void> => {
    setInactiveListParams(params);
  }, []);

  const handleInactivePaginationChange = useCallback(
    async (page: number, pageSize: number): Promise<void> => {
      setInactiveListParams((prev) => ({ ...prev, page, pageSize }));
    },
    []
  );

  const handleInactiveSearchChange = useCallback(async (search: string): Promise<void> => {
    setInactiveListParams((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const handleInactiveSortChange = useCallback(
    async (sortBy: string, sortOrder: 'asc' | 'desc'): Promise<void> => {
      const effectiveSortBy = sortBy === 'deletedAt' || sortBy === 'name' ? sortBy : 'deletedAt';
      setInactiveListParams((prev) => ({ ...prev, sortBy: effectiveSortBy, sortOrder }));
    },
    []
  );

  return {
    inactiveData,
    isInactiveLoading,
    inactiveListParams,
    fetchInactiveColleagues,
    handleInactivePaginationChange,
    handleInactiveSearchChange,
    handleInactiveSortChange,
  };
}
