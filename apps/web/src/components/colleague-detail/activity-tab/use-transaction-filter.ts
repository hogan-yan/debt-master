import { useMemo, useState } from 'react';
import { getDateBadgeInfo } from '@/utils/formatters';

export interface Transaction {
  type: 'expense' | 'payment';
  id: number;
  amount: number;
  date: string;
  description: string;
  details: string;
  notes?: string;
}

interface TransactionGroup {
  label: string;
  transactions: Transaction[];
}

interface UseTransactionFilterReturn {
  filteredTransactions: Transaction[];
  paginatedTransactions: Transaction[];
  groupedTransactions: TransactionGroup[];
  filterType: 'all' | 'expense' | 'payment';
  searchQuery: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  setFilterType: (type: 'all' | 'expense' | 'payment') => void;
  setSearchQuery: (query: string) => void;
  setCurrentPage: (page: number) => void;
}

const DEFAULT_PAGE_SIZE = 25;

export function useTransactionFilter(
  transactions: Transaction[],
  pageSize: number = DEFAULT_PAGE_SIZE
): UseTransactionFilterReturn {
  const [filterType, setFilterTypeRaw] = useState<'all' | 'expense' | 'payment'>('all');
  const [searchQuery, setSearchQueryRaw] = useState('');
  const [currentPage, setCurrentPageRaw] = useState(1);

  const setFilterType = (type: 'all' | 'expense' | 'payment') => {
    setFilterTypeRaw(type);
    setCurrentPageRaw(1);
  };

  const setSearchQuery = (query: string) => {
    setSearchQueryRaw(query);
    setCurrentPageRaw(1);
  };

  const setCurrentPage = (page: number) => {
    setCurrentPageRaw(page);
  };

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (filterType !== 'all') {
      result = result.filter((t) => t.type === filterType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) => t.description.toLowerCase().includes(query) || t.notes?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [transactions, filterType, searchQuery]);

  const totalCount = filteredTransactions.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 0;

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const groupedTransactions = useMemo(() => {
    const groupMap = new Map<string, Transaction[]>();

    for (const t of paginatedTransactions) {
      const badge = getDateBadgeInfo(t.date);
      const existing = groupMap.get(badge.relativeText);
      if (existing) {
        existing.push(t);
      } else {
        groupMap.set(badge.relativeText, [t]);
      }
    }

    return Array.from(groupMap.entries()).map(([label, txns]) => ({
      label,
      transactions: txns,
    }));
  }, [paginatedTransactions]);

  return {
    filteredTransactions,
    paginatedTransactions,
    groupedTransactions,
    filterType,
    searchQuery,
    currentPage,
    totalPages,
    totalCount,
    setFilterType,
    setSearchQuery,
    setCurrentPage,
  };
}
