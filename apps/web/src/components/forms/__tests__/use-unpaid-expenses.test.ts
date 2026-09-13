/**
 * Tests for useUnpaidExpenses hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnpaidExpense } from '../unpaid-expense-list';
import { useUnpaidExpenses } from '../use-unpaid-expenses';

const mockGetUnpaidExpensesForColleague = vi.hoisted(() => vi.fn());
const mockGetExpenseById = vi.hoisted(() => vi.fn());

vi.mock('@/server/expenses', () => ({
  getUnpaidExpensesForColleague: mockGetUnpaidExpensesForColleague,
  getExpenseById: mockGetExpenseById,
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => () => String(key),
    }
  ),
}));

const baseUnpaidExpense: UnpaidExpense = {
  id: 1,
  date: new Date('2024-01-10'),
  restaurantName: 'Pizza Place',
  restaurantId: 10,
  totalAmount: 100,
  colleagueAmount: 50,
  participantId: 101,
  notes: null,
  participantCount: 2,
  splitType: 'equal',
  remainingOwed: 50,
  totalApprovedPaid: 0,
};

const emptyApplications: [] = [];
const missingExpenseApplications = [{ id: 1, amount: 30, expense: { id: 2 } }];
const existingExpenseApplications = [{ id: 1, amount: 25, expense: { id: 1 } }];
const missingParticipantApplications = [{ id: 1, amount: 20, expense: { id: 2 } }];
const rejectedExpenseApplications = [{ id: 1, amount: 20, expense: { id: 99 } }];

describe('useUnpaidExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty list when payment mode is not EXPENSE_PAYMENT', () => {
    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'PREPAYMENT',
        applications: emptyApplications,
      })
    );

    expect(result.current.unpaidExpenses).toEqual([]);
    expect(result.current.loadingExpenses).toBe(false);
    expect(mockGetUnpaidExpensesForColleague).not.toHaveBeenCalled();
  });

  it('returns empty list when colleagueId is empty', () => {
    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: emptyApplications,
      })
    );

    expect(result.current.unpaidExpenses).toEqual([]);
    expect(mockGetUnpaidExpensesForColleague).not.toHaveBeenCalled();
  });

  it('fetches unpaid expenses for colleague', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([baseUnpaidExpense]);
    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: emptyApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingExpenses).toBe(false);
    });

    expect(mockGetUnpaidExpensesForColleague).toHaveBeenCalledWith({
      data: { colleagueId: 1 },
    });
    expect(result.current.unpaidExpenses).toHaveLength(1);
  });

  it('merges missing application expenses', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockResolvedValue({
      id: 2,
      date: '2024-01-12',
      restaurant: { name: 'Burger Joint' },
      restaurantId: 20,
      amount: '120',
      notes: 'lunch',
      splitType: 'equal',
      participants: [
        {
          id: 201,
          colleagueId: 1,
          amount: 60,
          remainingOwed: 30,
          totalPaid: 10,
        },
      ],
    });

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: missingExpenseApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.unpaidExpenses).toHaveLength(1);
    });

    expect(mockGetExpenseById).toHaveBeenCalledWith({ data: { id: 2 } });
    expect(result.current.unpaidExpenses[0]?.restaurantName).toBe('Burger Joint');
    expect(result.current.unpaidExpenses[0]?.remainingOwed).toBe(60);
    expect(result.current.unpaidExpenses[0]?.totalApprovedPaid).toBe(0);
  });

  it('skips getExpenseById for expenses already returned', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([baseUnpaidExpense]);

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: existingExpenseApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.unpaidExpenses).toHaveLength(1);
    });

    expect(mockGetExpenseById).not.toHaveBeenCalled();
  });

  it('ignores rejected getExpenseById results', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: rejectedExpenseApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingExpenses).toBe(false);
    });

    expect(result.current.unpaidExpenses).toEqual([]);
  });

  it('falls back when participant is not found', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockResolvedValue({
      id: 2,
      date: '2024-01-12',
      restaurant: { name: 'Burger Joint' },
      restaurantId: 20,
      amount: '120',
      notes: null,
      splitType: 'equal',
      participants: [
        {
          id: 201,
          colleagueId: 2,
          amount: 60,
          remainingOwed: 30,
          totalPaid: 10,
        },
      ],
    });

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: missingParticipantApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.unpaidExpenses).toHaveLength(1);
    });

    const expense = result.current.unpaidExpenses[0];
    expect(expense?.colleagueAmount).toBe(0);
    expect(expense?.participantId).toBe(0);
    expect(expense?.remainingOwed).toBe(20);
  });

  it('handles fetch error by returning empty list', async () => {
    mockGetUnpaidExpensesForColleague.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: emptyApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingExpenses).toBe(false);
    });

    expect(result.current.unpaidExpenses).toEqual([]);
  });

  it('does not update state after unmount', async () => {
    mockGetUnpaidExpensesForColleague.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([baseUnpaidExpense]), 50);
        })
    );

    const { result, unmount } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: emptyApplications,
      })
    );

    unmount();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.unpaidExpenses).toEqual([]);
  });

  it('ignores applications without an expense and fulfilled empty expense responses', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: [
          { id: 1, amount: 20 },
          { id: 2, amount: 30, expense: { id: 2 } },
        ],
      })
    );

    await waitFor(() => {
      expect(result.current.loadingExpenses).toBe(false);
    });

    expect(mockGetExpenseById).toHaveBeenCalledWith({ data: { id: 2 } });
    expect(result.current.unpaidExpenses).toEqual([]);
  });

  it('normalizes a missing optional expense data', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockResolvedValue({
      id: 2,
      date: '2024-01-12',
      restaurant: null,
      restaurantId: 20,
      amount: '120',
      notes: '',
      splitType: 'equal',
      participants: [{ id: 'invalid', colleagueId: 1, amount: 60 }],
    });

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: missingExpenseApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.unpaidExpenses).toHaveLength(1);
    });

    expect(result.current.unpaidExpenses[0]).toMatchObject({
      restaurantName: 'common_unknown',
      colleagueAmount: 0,
      participantId: 0,
      notes: null,
      participantCount: 1,
      remainingOwed: 30,
      totalApprovedPaid: 0,
    });
  });

  it('retains approved payments above the application amount', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockResolvedValue({
      id: 2,
      date: '2024-01-12',
      restaurant: { name: 'Burger Joint' },
      restaurantId: 20,
      amount: '120',
      notes: null,
      splitType: 'equal',
      participants: [{ id: 201, colleagueId: 1, amount: 60, remainingOwed: 30, totalPaid: 50 }],
    });

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: missingExpenseApplications,
      })
    );

    await waitFor(() => {
      expect(result.current.unpaidExpenses[0]?.totalApprovedPaid).toBe(20);
    });
  });

  it('ignores null participant entries while merging a missing expense', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockResolvedValue({
      id: 2,
      date: '2024-01-12',
      restaurant: { name: 'Burger Joint' },
      restaurantId: 20,
      amount: '120',
      notes: null,
      splitType: 'equal',
      participants: [null],
    });

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: missingExpenseApplications,
      })
    );

    await waitFor(() => expect(result.current.unpaidExpenses).toHaveLength(1));
    expect(result.current.unpaidExpenses[0]?.participantCount).toBe(1);
    expect(result.current.unpaidExpenses[0]?.participantId).toBe(0);
  });

  it('uses zero participants when the fetched expense has none', async () => {
    mockGetUnpaidExpensesForColleague.mockResolvedValue([]);
    mockGetExpenseById.mockResolvedValue({
      id: 2,
      date: '2024-01-12',
      restaurant: { name: 'Burger Joint' },
      restaurantId: 20,
      amount: '120',
      notes: null,
      splitType: 'equal',
    });

    const { result } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: missingExpenseApplications,
      })
    );

    await waitFor(() => expect(result.current.unpaidExpenses).toHaveLength(1));
    expect(result.current.unpaidExpenses[0]?.participantCount).toBe(0);
  });

  it('ignores updates after unmount during fetch', async () => {
    let resolveFetch: (value: UnpaidExpense[]) => void = () => {};
    mockGetUnpaidExpensesForColleague.mockImplementation(
      () =>
        new Promise<UnpaidExpense[]>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { unmount } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: emptyApplications,
      })
    );

    unmount();
    resolveFetch([baseUnpaidExpense]);
    await Promise.resolve();
  });

  it('ignores errors after unmount during fetch', async () => {
    let rejectFetch: (reason?: unknown) => void = () => {};
    mockGetUnpaidExpensesForColleague.mockImplementation(
      () =>
        new Promise<UnpaidExpense[]>((_, reject) => {
          rejectFetch = reject;
        })
    );

    const { unmount } = renderHook(() =>
      useUnpaidExpenses({
        colleagueId: '1',
        paymentMode: 'EXPENSE_PAYMENT',
        applications: emptyApplications,
      })
    );

    unmount();
    rejectFetch(new Error('network'));
    await Promise.resolve();
  });
});

describe('remainingOwedOrZero', () => {
  it('returns remaining owed or zero', async () => {
    const { remainingOwedOrZero } = await import('../payment-form');
    expect(remainingOwedOrZero({ remainingOwed: 12 })).toBe(12);
    expect(remainingOwedOrZero(undefined)).toBe(0);
  });
});

describe('applyUnlessCancelled', () => {
  it('skips work when cancelled', async () => {
    const { applyUnlessCancelled } = await import('../use-unpaid-expenses');
    const apply = vi.fn();
    applyUnlessCancelled(true, apply);
    expect(apply).not.toHaveBeenCalled();
    applyUnlessCancelled(false, apply);
    expect(apply).toHaveBeenCalledOnce();
  });
});
