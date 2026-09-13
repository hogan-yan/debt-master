import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { m } from '@/paraglide/messages';
import type { ColleagueBalance } from '@/server/balance-calculator';
import {
  calculateAllColleagueBalances,
  getColleagueStatsFromCalculatedBalances,
} from '@/server/balance-calculator';
import { getColleaguesPaginated } from '@/server/colleagues/handlers';
import type { PaginatedColleagues } from '@/types/colleague';
import { formatCurrency } from '@/utils/formatters';

type SummaryCard = {
  title: string;
  value: string | number;
  valueClassName?: string;
};

type ActiveListParams = {
  page: number;
  pageSize: number;
  sortBy: 'name';
  sortOrder: 'asc' | 'desc';
  search: string;
};

type ColleagueStats = {
  totalColleagues: number;
  totalOutstanding: number;
  totalCredit: number;
  totalPayments: number;
};

export interface UseActiveColleagueListResult {
  paginatedData: PaginatedColleagues;
  stats: ColleagueStats;
  summaryCards: SummaryCard[];
  isLoading: boolean;
  listParams: ActiveListParams;
  refreshColleagues: () => Promise<void>;
  handlePaginationChange: (page: number, pageSize: number) => Promise<void>;
  handleSearchChange: (search: string) => Promise<void>;
  handleSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => Promise<void>;
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

const DEFAULT_PARAMS: ActiveListParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'name',
  sortOrder: 'asc',
  search: '',
};

export function useActiveColleagueList(
  initialData: PaginatedColleagues & { stats?: ColleagueStats },
  initialStats: ColleagueStats
): UseActiveColleagueListResult {
  const queryClient = useQueryClient();

  const [listParams, setListParams] = useState<ActiveListParams>(DEFAULT_PARAMS);

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      { title: m.colleague_summary_total(), value: initialStats.totalColleagues },
      {
        title: m.colleague_summary_outstanding(),
        value: formatCurrency(initialStats.totalOutstanding),
        valueClassName: 'text-foreground',
      },
      {
        title: m.colleague_summary_credit(),
        value: formatCurrency(initialStats.totalCredit),
        valueClassName: 'text-foreground',
      },
      { title: m.colleague_summary_payments(), value: initialStats.totalPayments },
    ],
    [
      initialStats.totalColleagues,
      initialStats.totalOutstanding,
      initialStats.totalCredit,
      initialStats.totalPayments,
    ]
  );

  // Params are the query key; mutations invalidate, so the user's view survives.
  const listQuery = useQuery({
    queryKey: ['colleagues', 'active', { ...listParams }],
    queryFn: async () => {
      const [updatedData, balances] = await Promise.all([
        getColleaguesPaginated({ data: { ...listParams } }),
        calculateAllColleagueBalances({ data: undefined }),
      ]);
      return {
        ...updatedData,
        data: mergeWithBalances(updatedData.data, balances),
      };
    },
    placeholderData: keepPreviousData,
    initialData: initialData,
  });

  const statsQuery = useQuery({
    queryKey: ['colleagues', 'stats'],
    queryFn: () => getColleagueStatsFromCalculatedBalances(),
    initialData: initialStats,
  });

  const paginatedData = listQuery.data ?? initialData;
  const stats = statsQuery.data ?? initialStats;
  const isLoading = listQuery.isFetching;

  const refreshColleagues = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['colleagues'] });
  }, [queryClient]);

  const handlePaginationChange = useCallback(
    async (page: number, pageSize: number): Promise<void> => {
      setListParams((prev) => ({ ...prev, page, pageSize }));
    },
    []
  );

  const handleSearchChange = useCallback(async (search: string): Promise<void> => {
    setListParams((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const handleSortChange = useCallback(
    async (sortBy: string, sortOrder: 'asc' | 'desc'): Promise<void> => {
      const effectiveSortBy = sortBy !== 'name' ? 'name' : sortBy;
      setListParams((prev) => ({ ...prev, sortBy: effectiveSortBy as 'name', sortOrder }));
    },
    []
  );

  return {
    paginatedData,
    stats,
    summaryCards,
    isLoading,
    listParams,
    refreshColleagues,
    handlePaginationChange,
    handleSearchChange,
    handleSortChange,
  };
}
