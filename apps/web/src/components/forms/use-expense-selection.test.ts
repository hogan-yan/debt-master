import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useExpenseSelection } from './use-expense-selection';

describe('useExpenseSelection', () => {
  it('initializes with empty selection when no initial state', () => {
    const { result } = renderHook(() => useExpenseSelection());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.amounts).toEqual({});
    expect(result.current.count).toBe(0);
    expect(result.current.totalAmount).toBe(0);
  });

  it('initializes with provided initial state', () => {
    const initialState = {
      selectedIds: [1, 2],
      amounts: { 1: '50', 2: '30' },
    };
    const { result } = renderHook(() => useExpenseSelection(initialState));
    expect(result.current.selectedIds).toEqual([1, 2]);
    expect(result.current.amounts).toEqual({ 1: '50', 2: '30' });
    expect(result.current.count).toBe(2);
    expect(result.current.totalAmount).toBe(80);
  });

  it('selects an expense', () => {
    const { result } = renderHook(() => useExpenseSelection());
    act(() => result.current.selectExpense(1, 100));
    expect(result.current.selectedIds).toContain(1);
    expect(result.current.amounts[1]).toBe('100');
    expect(result.current.count).toBe(1);
    expect(result.current.totalAmount).toBe(100);
  });

  it('deselects an expense', () => {
    const { result } = renderHook(() =>
      useExpenseSelection({ selectedIds: [1, 2], amounts: { 1: '50', 2: '30' } })
    );
    act(() => result.current.deselectExpense(1));
    expect(result.current.selectedIds).not.toContain(1);
    expect(result.current.count).toBe(1);
    expect(result.current.totalAmount).toBe(30);
  });

  it('toggles expense selection on', () => {
    const { result } = renderHook(() => useExpenseSelection());
    act(() => result.current.toggleExpense(1, true, 75));
    expect(result.current.selectedIds).toContain(1);
    expect(result.current.amounts[1]).toBe('75');
  });

  it('toggles expense selection off', () => {
    const { result } = renderHook(() =>
      useExpenseSelection({ selectedIds: [1], amounts: { 1: '75' } })
    );
    act(() => result.current.toggleExpense(1, false, 75));
    expect(result.current.selectedIds).not.toContain(1);
  });

  it('updates amount for selected expense', () => {
    const { result } = renderHook(() =>
      useExpenseSelection({ selectedIds: [1], amounts: { 1: '50' } })
    );
    act(() => result.current.updateAmount(1, '99.50'));
    expect(result.current.amounts[1]).toBe('99.50');
    expect(result.current.totalAmount).toBe(99.5);
  });

  it('resets to empty state', () => {
    const { result } = renderHook(() =>
      useExpenseSelection({ selectedIds: [1, 2], amounts: { 1: '50', 2: '30' } })
    );
    act(() => result.current.reset());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.amounts).toEqual({});
    expect(result.current.count).toBe(0);
    expect(result.current.totalAmount).toBe(0);
  });

  it('restores state from external source', () => {
    const { result } = renderHook(() => useExpenseSelection());
    const newState = { selectedIds: [3, 4], amounts: { 3: '10', 4: '20' } };
    act(() => result.current.restore(newState));
    expect(result.current.selectedIds).toEqual([3, 4]);
    expect(result.current.amounts).toEqual({ 3: '10', 4: '20' });
    expect(result.current.count).toBe(2);
    expect(result.current.totalAmount).toBe(30);
  });

  it('handles multiple select/deselect operations', () => {
    const { result } = renderHook(() => useExpenseSelection());
    act(() => result.current.selectExpense(1, 100));
    act(() => result.current.selectExpense(2, 200));
    act(() => result.current.deselectExpense(1));
    act(() => result.current.selectExpense(3, 50));

    expect(result.current.selectedIds).toEqual([2, 3]);
    expect(result.current.count).toBe(2);
    expect(result.current.totalAmount).toBe(250);
  });

  it('reset on empty state is a no-op', () => {
    const { result } = renderHook(() => useExpenseSelection());
    act(() => result.current.reset());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.amounts).toEqual({});
  });

  it('selecting already selected expense is a no-op', () => {
    const { result } = renderHook(() =>
      useExpenseSelection({ selectedIds: [1], amounts: { 1: '50' } })
    );
    act(() => result.current.selectExpense(1, 999));
    expect(result.current.amounts[1]).toBe('50');
  });

  it('handles NaN amount in total calculation', () => {
    const { result } = renderHook(() => useExpenseSelection());
    act(() => result.current.restore({ selectedIds: [1], amounts: { 1: 'not-a-number' } }));
    expect(result.current.totalAmount).toBe(0);
  });
});
