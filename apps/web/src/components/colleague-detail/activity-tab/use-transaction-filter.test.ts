import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Transaction } from './use-transaction-filter';
import { useTransactionFilter } from './use-transaction-filter';

function makeTransaction(
  type: 'expense' | 'payment',
  overrides?: Partial<Transaction>
): Transaction {
  const id = Math.random();
  return {
    type,
    id,
    amount: type === 'expense' ? 25 : 50,
    date: new Date().toISOString(),
    description: type === 'expense' ? 'Test Restaurant' : 'Cash Payment',
    details: 'Jan 1, 2026',
    ...overrides,
  };
}

function makeDateTransactions(): Transaction[] {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 8);
  const old = new Date();
  old.setDate(old.getDate() - 60);

  return [
    makeTransaction('expense', { id: 1, description: 'Lunch Today', date: today.toISOString() }),
    makeTransaction('payment', { id: 2, description: 'Paid Today', date: today.toISOString() }),
    makeTransaction('expense', {
      id: 3,
      description: 'Dinner Yesterday',
      date: yesterday.toISOString(),
    }),
    makeTransaction('payment', {
      id: 4,
      description: 'Bank Transfer',
      date: lastWeek.toISOString(),
    }),
    makeTransaction('expense', { id: 5, description: 'Old Expense', date: old.toISOString() }),
  ];
}

describe('useTransactionFilter', () => {
  const sampleTransactions: Transaction[] = Array.from({ length: 30 }, (_, i) =>
    makeTransaction(i % 2 === 0 ? 'expense' : 'payment', {
      id: i,
      description: `Item ${i}`,
      amount: (i + 1) * 10,
    })
  );

  it('returns all transactions with default filter', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    expect(result.current.filteredTransactions).toHaveLength(30);
  });

  it('filters to expenses only', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    act(() => result.current.setFilterType('expense'));
    expect(result.current.filteredTransactions).toHaveLength(15);
    expect(result.current.filteredTransactions.every((t) => t.type === 'expense')).toBe(true);
  });

  it('filters to payments only', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    act(() => result.current.setFilterType('payment'));
    expect(result.current.filteredTransactions).toHaveLength(15);
    expect(result.current.filteredTransactions.every((t) => t.type === 'payment')).toBe(true);
  });

  it('filters by search query matching description', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    act(() => result.current.setSearchQuery('Item 5'));
    expect(result.current.filteredTransactions).toHaveLength(1);
    expect(result.current.filteredTransactions[0]?.description).toBe('Item 5');
  });

  it('returns empty when search matches nothing', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    act(() => result.current.setSearchQuery('nonexistent'));
    expect(result.current.filteredTransactions).toHaveLength(0);
  });

  it('paginates to correct page size (default 25)', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    expect(result.current.paginatedTransactions).toHaveLength(25);
    expect(result.current.totalPages).toBe(2);
  });

  it('updates page when setCurrentPage called', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    act(() => result.current.setCurrentPage(2));
    expect(result.current.paginatedTransactions).toHaveLength(5);
    expect(result.current.currentPage).toBe(2);
  });

  it('resets to page 1 when filter changes', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    act(() => result.current.setCurrentPage(2));
    expect(result.current.currentPage).toBe(2);
    act(() => result.current.setFilterType('expense'));
    expect(result.current.currentPage).toBe(1);
  });

  it('resets to page 1 when search changes', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    act(() => result.current.setCurrentPage(2));
    act(() => result.current.setSearchQuery('Item'));
    expect(result.current.currentPage).toBe(1);
  });

  it('groups transactions by date label', () => {
    const dateTxns = makeDateTransactions();
    const { result } = renderHook(() => useTransactionFilter(dateTxns));
    const groups = result.current.groupedTransactions;
    expect(groups.length).toBeGreaterThanOrEqual(3);
    const labels = groups.map((g) => g.label);
    expect(labels).toContain('Today');
    expect(labels).toContain('Yesterday');
  });

  it('calculates totalCount from filtered results', () => {
    const { result } = renderHook(() => useTransactionFilter(sampleTransactions));
    expect(result.current.totalCount).toBe(30);
    act(() => result.current.setFilterType('expense'));
    expect(result.current.totalCount).toBe(15);
  });

  it('handles empty transactions', () => {
    const { result } = renderHook(() => useTransactionFilter([]));
    expect(result.current.filteredTransactions).toHaveLength(0);
    expect(result.current.paginatedTransactions).toHaveLength(0);
    expect(result.current.groupedTransactions).toHaveLength(0);
    expect(result.current.totalPages).toBe(0);
  });
});
