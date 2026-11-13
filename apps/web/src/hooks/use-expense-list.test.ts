import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense } from '@/types';
import { useExpenseList } from './use-expense-list';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    expense_toast_paymentClaimed: () => 'Payment claimed',
    expense_toast_paymentClaimFailed: () => 'Claim failed',
    expense_toast_noReceipt: () => 'No receipt found',
    expense_toast_receiptLoadFailed: () => 'Failed to load receipt',
  },
}));

const mockClaimPayment = vi.fn();
const mockGetExpenseReceiptUrl = vi.fn();

vi.mock('@/server/expenses', () => ({
  claimPayment: (ctx: { data: FormData }) => mockClaimPayment(ctx),
  getExpenseReceiptUrl: (ctx: { data: { expenseId: number } }) => mockGetExpenseReceiptUrl(ctx),
}));

vi.mock('@/lib/expense-filters', () => ({
  filterExpensesByColleagues: (expenses: Expense[], ids: number[]) =>
    expenses.filter((e) =>
      e.participants?.some((p) => ids.includes(p.colleagueId ?? p.colleague?.id ?? 0))
    ),
  getColleaguesFromExpenses: (expenses: Expense[]) => {
    const map = new Map<number, string>();
    for (const e of expenses) {
      for (const p of e.participants ?? []) {
        const id = p.colleague?.id ?? p.colleagueId;
        const name = p.colleague?.name;
        if (id !== undefined && name !== undefined && !map.has(id)) {
          map.set(id, name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    date: '2024-01-15',
    amount: 100,
    splitType: 'EQUAL',
    restaurant: { id: 1, name: 'Test Restaurant' },
    participants: [
      {
        id: 1,
        amount: 50,
        colleagueId: 1,
        expenseId: 1,
        isPaid: false,
        isPending: false,
        hasPartialPayment: false,
        submittedAt: null,
        colleague: { id: 1, name: 'Alice' },
      },
      {
        id: 2,
        amount: 50,
        colleagueId: 2,
        expenseId: 1,
        isPaid: true,
        isPending: false,
        hasPartialPayment: false,
        submittedAt: null,
        colleague: { id: 2, name: 'Bob' },
      },
    ],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useExpenseList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial State ──────────────────────────────────────────────────────────

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useExpenseList());

    expect(result.current.isProcessingClaim).toEqual({});
    expect(result.current.receiptUrls).toEqual({});
    expect(result.current.isReceiptModalOpen).toBe(false);
    expect(result.current.currentReceiptUrl).toBeNull();
    expect(result.current.currentReceiptTitle).toBe('');
    expect(result.current.searchTerm).toBe('');
    expect(result.current.selectedStatus).toBe('all');
    expect(result.current.selectedColleagueIds).toEqual([]);
    expect(result.current.sortBy).toBe('date');
    expect(result.current.sortOrder).toBe('desc');
  });

  // ── filterAndSortExpenses: Search ──────────────────────────────────────────

  it('should filter expenses by search term (restaurant name)', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSearchTerm('test');
    });

    const expenses = [
      createExpense({ id: 1, restaurant: { id: 1, name: 'Test Restaurant' } }),
      createExpense({ id: 2, restaurant: { id: 2, name: 'Other Place' } }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  it('should filter expenses by search term (notes)', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSearchTerm('lunch');
    });

    const expenses = [
      createExpense({ id: 1, notes: 'Business lunch' }),
      createExpense({ id: 2, notes: 'Dinner' }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  it('should be case-insensitive for search', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSearchTerm('TEST');
    });

    const expenses = [createExpense({ id: 1, restaurant: { id: 1, name: 'test restaurant' } })];
    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(1);
  });

  // ── filterAndSortExpenses: Status ──────────────────────────────────────────

  it('should filter by paid status', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSelectedStatus('paid');
    });

    const expenses = [
      createExpense({
        id: 1,
        participants: [
          { ...createExpense().participants![0], isPaid: true } as never,
          { ...createExpense().participants![1], isPaid: true } as never,
        ],
      }),
      createExpense({
        id: 2,
        participants: [
          { ...createExpense().participants![0], isPaid: false } as never,
          { ...createExpense().participants![1], isPaid: true } as never,
        ],
      }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  it('should filter by unpaid status', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSelectedStatus('unpaid');
    });

    const expenses = [
      createExpense({
        id: 1,
        participants: [
          { ...createExpense().participants![0], isPaid: false } as never,
          { ...createExpense().participants![1], isPaid: false } as never,
        ],
      }),
      createExpense({
        id: 2,
        participants: [
          { ...createExpense().participants![0], isPaid: true } as never,
          { ...createExpense().participants![1], isPaid: true } as never,
        ],
      }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  it('should filter by pending status', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSelectedStatus('pending');
    });

    const expenses = [
      createExpense({
        id: 1,
        participants: [
          { ...createExpense().participants![0], isPaid: true } as never,
          { ...createExpense().participants![1], isPaid: false } as never,
        ],
      }),
      createExpense({
        id: 2,
        participants: [
          { ...createExpense().participants![0], isPaid: true } as never,
          { ...createExpense().participants![1], isPaid: true } as never,
        ],
      }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  it('should not filter when status is all', () => {
    const { result } = renderHook(() => useExpenseList());

    const expenses = [createExpense({ id: 1 }), createExpense({ id: 2 })];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(2);
  });

  it('keeps expenses visible for an unknown persisted status value', () => {
    const { result } = renderHook(() => useExpenseList());
    act(() => {
      Reflect.apply(result.current.setSelectedStatus, undefined, ['unknown']);
    });

    const filtered = result.current.filterAndSortExpenses([createExpense({ id: 1 })]);

    expect(filtered).toHaveLength(1);
  });

  it('should handle empty participants for status filter', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSelectedStatus('paid');
    });

    const expenses = [createExpense({ id: 1, participants: [] }), createExpense({ id: 2 })];

    const filtered = result.current.filterAndSortExpenses(expenses);
    // Expense with no participants: paidCount=0, totalCount=0, but totalCount > 0 check excludes it
    expect(filtered).toHaveLength(0);
  });

  it('should treat missing participants as an empty list for status filtering', () => {
    const { result } = renderHook(() => useExpenseList());
    act(() => {
      result.current.setSelectedStatus('unpaid');
    });

    const filtered = result.current.filterAndSortExpenses([
      createExpense({ id: 1, participants: undefined }),
    ]);

    expect(filtered).toHaveLength(1);
  });

  // ── filterAndSortExpenses: Colleague ───────────────────────────────────────

  it('should filter by selected colleagues', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSelectedColleagueIds([1]);
    });

    const expenses = [
      createExpense({ id: 1, participants: createExpense().participants }),
      createExpense({
        id: 2,
        participants: [
          {
            ...createExpense().participants![0],
            colleagueId: 3,
            colleague: { id: 3, name: 'Charlie' },
          } as never,
        ],
      }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  // ── filterAndSortExpenses: Sorting ─────────────────────────────────────────

  it('should sort by date descending', () => {
    const { result } = renderHook(() => useExpenseList());

    const expenses = [
      createExpense({ id: 1, date: '2024-01-01' }),
      createExpense({ id: 2, date: '2024-01-15' }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered[0]?.id).toBe(2);
    expect(filtered[1]?.id).toBe(1);
  });

  it('should sort by date ascending', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSortOrder('asc');
    });

    const expenses = [
      createExpense({ id: 1, date: '2024-01-15' }),
      createExpense({ id: 2, date: '2024-01-01' }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered[0]?.id).toBe(2);
    expect(filtered[1]?.id).toBe(1);
  });

  it('should sort by amount', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSortBy('amount');
    });

    const expenses = [createExpense({ id: 1, amount: 200 }), createExpense({ id: 2, amount: 50 })];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered[0]?.id).toBe(1);
    expect(filtered[1]?.id).toBe(2);
  });

  it('should sort by restaurant name', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSortBy('restaurant');
      result.current.setSortOrder('asc');
    });

    const expenses = [
      createExpense({ id: 1, restaurant: { id: 1, name: 'Zebra' } }),
      createExpense({ id: 2, restaurant: { id: 2, name: 'Apple' } }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered[0]?.id).toBe(2);
    expect(filtered[1]?.id).toBe(1);
  });

  it('should handle missing restaurant name in sort', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSortBy('restaurant');
      result.current.setSortOrder('asc');
    });

    const expenses = [
      createExpense({ id: 1, restaurant: null }),
      createExpense({ id: 2, restaurant: { id: 2, name: 'Apple' } }),
    ];

    const filtered = result.current.filterAndSortExpenses(expenses);
    expect(filtered[0]?.id).toBe(1);
    expect(filtered[1]?.id).toBe(2);
  });

  it('should sort an empty restaurant name', () => {
    const { result } = renderHook(() => useExpenseList());
    act(() => {
      result.current.setSortBy('restaurant');
      result.current.setSortOrder('asc');
    });

    const filtered = result.current.filterAndSortExpenses([
      createExpense({ id: 1, restaurant: { id: 1, name: '' } }),
      createExpense({ id: 2, restaurant: { id: 2, name: 'Apple' } }),
    ]);

    expect(filtered[0]?.id).toBe(1);
  });

  it('should sort a missing restaurant name as an empty string', () => {
    const { result } = renderHook(() => useExpenseList());
    act(() => {
      result.current.setSortBy('restaurant');
      result.current.setSortOrder('asc');
    });

    const filtered = result.current.filterAndSortExpenses([
      createExpense({ id: 1, restaurant: { id: 1, name: 'Apple' } }),
      createExpense({ id: 2, restaurant: null }),
    ]);

    expect(filtered[0]?.id).toBe(2);
  });

  // ── handlePaymentClaim ─────────────────────────────────────────────────────

  it('should handle payment claim successfully', async () => {
    const { toast } = await import('sonner');
    mockClaimPayment.mockResolvedValue(undefined);

    const { result } = renderHook(() => useExpenseList());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePaymentClaim(1);
    });

    expect(success).toBe(true);
    expect(mockClaimPayment).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Payment claimed');
    expect(result.current.isProcessingClaim[1]).toBe(false);
  });

  it('should handle payment claim failure', async () => {
    const { toast } = await import('sonner');
    mockClaimPayment.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useExpenseList());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePaymentClaim(1);
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Network error');
    expect(result.current.isProcessingClaim[1]).toBe(false);
  });

  it('should handle payment claim failure with non-Error', async () => {
    const { toast } = await import('sonner');
    mockClaimPayment.mockRejectedValue('string error');

    const { result } = renderHook(() => useExpenseList());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePaymentClaim(1);
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Claim failed');
  });

  it('should set processing state during claim', async () => {
    mockClaimPayment.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.handlePaymentClaim(1);
    });

    expect(result.current.isProcessingClaim[1]).toBe(true);
  });

  // ── handleViewReceipt ──────────────────────────────────────────────────────

  it('should open receipt modal with cached URL', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.handleViewReceipt(1, 'Test Restaurant');
    });
  });

  it('should fetch and cache receipt URL', async () => {
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });

    const { result } = renderHook(() => useExpenseList());

    await act(async () => {
      await result.current.handleViewReceipt(1, 'Test Restaurant');
    });

    expect(result.current.isReceiptModalOpen).toBe(true);
    expect(result.current.currentReceiptUrl).toBe('https://example.com/receipt.jpg');
    expect(result.current.currentReceiptTitle).toBe('Test Restaurant');
    expect(result.current.receiptUrls[1]).toBe('https://example.com/receipt.jpg');
  });

  it('should use cached receipt URL on second view', async () => {
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });

    const { result } = renderHook(() => useExpenseList());

    await act(async () => {
      await result.current.handleViewReceipt(1, 'First');
    });

    mockGetExpenseReceiptUrl.mockClear();

    await act(async () => {
      await result.current.handleViewReceipt(1, 'Second');
    });

    expect(mockGetExpenseReceiptUrl).not.toHaveBeenCalled();
    expect(result.current.currentReceiptTitle).toBe('Second');
  });

  it('should show error when receipt has no URL', async () => {
    const { toast } = await import('sonner');
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: null });

    const { result } = renderHook(() => useExpenseList());

    await act(async () => {
      await result.current.handleViewReceipt(1);
    });

    expect(toast.error).toHaveBeenCalledWith('No receipt found');
    expect(result.current.isReceiptModalOpen).toBe(false);
  });

  it('should show error when receipt fetch fails', async () => {
    const { toast } = await import('sonner');
    mockGetExpenseReceiptUrl.mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => useExpenseList());

    await act(async () => {
      await result.current.handleViewReceipt(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to load receipt');
  });

  it('should use default title when restaurant name is not provided', async () => {
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });

    const { result } = renderHook(() => useExpenseList());

    await act(async () => {
      await result.current.handleViewReceipt(1);
    });

    expect(result.current.currentReceiptTitle).toBe('Receipt');
  });

  it('should use the default receipt title for an empty restaurant name', async () => {
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });

    const { result } = renderHook(() => useExpenseList());

    await act(async () => {
      await result.current.handleViewReceipt(1, 'Restaurant');
    });

    await act(async () => {
      await result.current.handleViewReceipt(1, '');
    });

    expect(result.current.currentReceiptTitle).toBe('Receipt');
  });

  // ── closeReceiptModal ──────────────────────────────────────────────────────

  it('should close receipt modal and clear state', async () => {
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });

    const { result } = renderHook(() => useExpenseList());

    await act(async () => {
      await result.current.handleViewReceipt(1, 'Test');
    });

    act(() => {
      result.current.closeReceiptModal();
    });

    expect(result.current.isReceiptModalOpen).toBe(false);
    expect(result.current.currentReceiptUrl).toBeNull();
    expect(result.current.currentReceiptTitle).toBe('');
  });

  // ── resetFilters ───────────────────────────────────────────────────────────

  it('should reset all filters', () => {
    const { result } = renderHook(() => useExpenseList());

    act(() => {
      result.current.setSearchTerm('test');
      result.current.setSelectedStatus('paid');
      result.current.setSelectedColleagueIds([1, 2]);
      result.current.setSortBy('amount');
      result.current.setSortOrder('asc');
    });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.selectedStatus).toBe('all');
    expect(result.current.selectedColleagueIds).toEqual([]);
    expect(result.current.sortBy).toBe('date');
    expect(result.current.sortOrder).toBe('desc');
  });

  // ── getExpenseSummary ──────────────────────────────────────────────────────

  it('should calculate expense summary', () => {
    const { result } = renderHook(() => useExpenseList());

    const expenses = [createExpense({ id: 1, amount: 100 }), createExpense({ id: 2, amount: 200 })];

    const summary = result.current.getExpenseSummary(expenses);

    expect(summary.totalExpenses).toBe(2);
    expect(summary.totalAmount).toBe(300);
    expect(summary.averageExpense).toBe(150);
  });

  it('should calculate summary with zero expenses', () => {
    const { result } = renderHook(() => useExpenseList());

    const summary = result.current.getExpenseSummary([]);

    expect(summary.totalExpenses).toBe(0);
    expect(summary.totalAmount).toBe(0);
    expect(summary.averageExpense).toBe(0);
  });

  it('should calculate paid and outstanding amounts', () => {
    const { result } = renderHook(() => useExpenseList());

    const expenses = [
      createExpense({
        id: 1,
        amount: 100,
        participants: [
          { ...createExpense().participants![0], amount: 50, isPaid: true } as never,
          { ...createExpense().participants![1], amount: 50, isPaid: false } as never,
        ],
      }),
    ];

    const summary = result.current.getExpenseSummary(expenses);

    expect(summary.totalPaid).toBe(50);
    expect(summary.totalOutstanding).toBe(50);
  });

  it('should handle expenses without participants in summary', () => {
    const { result } = renderHook(() => useExpenseList());

    const expenses = [createExpense({ id: 1, amount: 100, participants: [] })];

    const summary = result.current.getExpenseSummary(expenses);

    expect(summary.totalPaid).toBe(0);
    expect(summary.totalOutstanding).toBe(100);
  });

  // ── getColleaguesFromExpenses ──────────────────────────────────────────────

  it('should expose getColleaguesFromExpenses', () => {
    const { result } = renderHook(() => useExpenseList());

    const expenses = [
      createExpense({
        id: 1,
        participants: [
          {
            ...createExpense().participants![0],
            colleagueId: 1,
            colleague: { id: 1, name: 'Alice' },
          } as never,
          {
            ...createExpense().participants![1],
            colleagueId: 2,
            colleague: { id: 2, name: 'Bob' },
          } as never,
        ],
      }),
    ];

    const colleagues = result.current.getColleaguesFromExpenses(expenses);
    expect(colleagues).toHaveLength(2);
    expect(colleagues[0]?.name).toBe('Alice');
    expect(colleagues[1]?.name).toBe('Bob');
  });
});
