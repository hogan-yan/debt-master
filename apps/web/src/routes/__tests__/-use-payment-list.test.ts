import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaginatedPayments } from '@/types';
import { usePaymentList } from '../-use-payment-list';

vi.mock('@/server/payments', () => ({
  // echo the requested params so key-change refetches are observable
  getPaymentsPaginated: vi
    .fn()
    .mockImplementation(async ({ data }: { data: { page: number; pageSize: number } }) => ({
      data: [],
      pagination: { page: data.page, pageSize: data.pageSize, total: 0, totalPages: 0 },
    })),
  getPaymentStats: vi.fn().mockResolvedValue({
    totalPayments: 0,
    totalAmount: 0,
    averageAmount: 0,
  }),
}));

const initialData = {
  data: [{ id: 1, amount: 100 }],
  pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
} as unknown as PaginatedPayments;
const initialStats = { totalPayments: 1, totalAmount: 100, averageAmount: 100 };

let testClient: QueryClient;

function renderPaymentList() {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: testClient }, children);
  return renderHook(() => usePaymentList({ paginatedPayments: initialData, stats: initialStats }), {
    wrapper,
  });
}

describe('usePaymentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('initializes with loader data', async () => {
    const { result } = renderPaymentList();
    expect(result.current.params).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: 'date',
      sortOrder: 'desc',
      search: '',
    });
    expect(result.current.stats).toEqual(initialStats);
    // the page-1 refetch settles on the mocked response
    await waitFor(() => expect(result.current.paginatedData.pagination.page).toBe(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('updates params on pagination change; the query refetches page 2', async () => {
    const { result } = renderPaymentList();
    await act(async () => {
      await result.current.handlePaginationChange(2, 20);
    });
    expect(result.current.params.page).toBe(2);
    expect(result.current.params.pageSize).toBe(20);
    // the refetch echoes the requested page back
    await waitFor(() => expect(result.current.paginatedData.pagination.page).toBe(2));
  });

  it('resets to page 1 and updates search on search change', async () => {
    const { result } = renderPaymentList();
    await act(async () => {
      await result.current.handleSearchChange('test');
    });
    expect(result.current.params.page).toBe(1);
    expect(result.current.params.search).toBe('test');
  });

  it('updates sort field and order', async () => {
    const { result } = renderPaymentList();
    await act(async () => {
      await result.current.handleSortChange('amount', 'asc');
    });
    expect(result.current.params.sortBy).toBe('amount');
    expect(result.current.params.sortOrder).toBe('asc');
  });

  it('defaults to date for invalid sort fields', async () => {
    const { result } = renderPaymentList();
    await act(async () => {
      await result.current.handleSortChange('invalidField', 'desc');
    });
    expect(result.current.params.sortBy).toBe('date');
  });

  it('refresh invalidates the payments queries', async () => {
    const invalidateSpy = vi.spyOn(testClient, 'invalidateQueries');
    const { result } = renderPaymentList();
    await act(async () => {
      result.current.refresh();
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['payments'] });
  });
});
