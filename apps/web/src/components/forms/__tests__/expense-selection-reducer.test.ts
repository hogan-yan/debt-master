import { describe, expect, it } from 'vitest';
import {
  deselectExpense,
  type ExpenseSelectionState,
  expenseSelectionReducer,
  selectExpense,
  selectedExpenseCount,
  totalSelectedAmount,
  updateExpenseAmount,
} from '../expense-selection-reducer';

describe('expenseSelectionReducer', () => {
  it('initializes with empty selection via INIT action', () => {
    const state: ExpenseSelectionState = { selectedIds: [99], amounts: { 99: '100' } };
    const result = expenseSelectionReducer(state, { type: 'INIT' });
    expect(result).toEqual({ selectedIds: [], amounts: {} });
  });

  it('keeps the empty state reference via INIT action', () => {
    const state: ExpenseSelectionState = { selectedIds: [], amounts: {} };
    const result = expenseSelectionReducer(state, { type: 'INIT' });
    expect(result).toBe(state);
  });

  it('selects an expense with default amount', () => {
    const state: ExpenseSelectionState = { selectedIds: [], amounts: {} };
    const result = expenseSelectionReducer(state, {
      type: 'SELECT_EXPENSE',
      expenseId: 1,
      defaultAmount: 50,
    });
    expect(result.selectedIds).toEqual([1]);
    expect(result.amounts[1]).toBe('50');
  });

  it('does not duplicate an already selected expense', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1],
      amounts: { 1: '30' },
    };
    const result = expenseSelectionReducer(state, {
      type: 'SELECT_EXPENSE',
      expenseId: 1,
      defaultAmount: 50,
    });
    expect(result).toBe(state);
  });

  it('deselects an expense and removes its amount', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1, 2],
      amounts: { 1: '30', 2: '50' },
    };
    const result = expenseSelectionReducer(state, {
      type: 'DESELECT_EXPENSE',
      expenseId: 1,
    });
    expect(result.selectedIds).toEqual([2]);
    expect(result.amounts[1]).toBeUndefined();
    expect(result.amounts[2]).toBe('50');
  });

  it('toggles expense via SET_SELECTED', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1],
      amounts: { 1: '30' },
    };
    // Deselect existing
    const afterDeselect = expenseSelectionReducer(state, {
      type: 'SET_SELECTED',
      expenseId: 1,
      selected: false,
      defaultAmount: 50,
    });
    expect(afterDeselect.selectedIds).toEqual([]);

    // Select new
    const afterSelect = expenseSelectionReducer(state, {
      type: 'SET_SELECTED',
      expenseId: 2,
      selected: true,
      defaultAmount: 75,
    });
    expect(afterSelect.selectedIds).toEqual([1, 2]);
    expect(afterSelect.amounts[2]).toBe('75');
  });

  it('updates expense amount', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1],
      amounts: { 1: '30' },
    };
    const result = expenseSelectionReducer(state, {
      type: 'UPDATE_AMOUNT',
      expenseId: 1,
      amount: '45.50',
    });
    expect(result.amounts[1]).toBe('45.50');
  });

  it('replaces entire selection via RESTORE', () => {
    const oldState: ExpenseSelectionState = {
      selectedIds: [1, 2],
      amounts: { 1: '30', 2: '50' },
    };
    const newState: ExpenseSelectionState = {
      selectedIds: [3],
      amounts: { 3: '100' },
    };
    const result = expenseSelectionReducer(oldState, { type: 'RESTORE', state: newState });
    expect(result).toEqual(newState);
  });

  it('returns same state for unknown action', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1],
      amounts: { 1: '30' },
    };
    const unknownAction = { type: 'UNKNOWN' } as unknown as Parameters<
      typeof expenseSelectionReducer
    >[1];
    const result = expenseSelectionReducer(state, unknownAction);
    expect(result).toBe(state);
  });
});

describe('selectExpense helper', () => {
  it('adds expense with default amount', () => {
    const state: ExpenseSelectionState = { selectedIds: [], amounts: {} };
    const result = selectExpense(state, 5, 100);
    expect(result.selectedIds).toEqual([5]);
    expect(result.amounts[5]).toBe('100');
  });
});

describe('deselectExpense helper', () => {
  it('removes expense and its amount', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1, 2, 3],
      amounts: { 1: '10', 2: '20', 3: '30' },
    };
    const result = deselectExpense(state, 2);
    expect(result.selectedIds).toEqual([1, 3]);
    expect(result.amounts[2]).toBeUndefined();
  });
});

describe('updateExpenseAmount helper', () => {
  it('updates the amount for an expense', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1],
      amounts: { 1: '10' },
    };
    const result = updateExpenseAmount(state, 1, '99.99');
    expect(result.amounts[1]).toBe('99.99');
  });
});

describe('totalSelectedAmount', () => {
  it('sums all selected expense amounts', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1, 2, 3],
      amounts: { 1: '10', 2: '25.50', 3: '64.50' },
    };
    expect(totalSelectedAmount(state)).toBe(100);
  });

  it('returns 0 for empty state', () => {
    expect(totalSelectedAmount({ selectedIds: [], amounts: {} })).toBe(0);
  });

  it('treats missing amount entries as zero', () => {
    const state: ExpenseSelectionState = { selectedIds: [1, 2], amounts: { 1: '10' } };
    expect(totalSelectedAmount(state)).toBe(10);
  });

  it('ignores non-numeric amounts', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1],
      amounts: { 1: 'abc' },
    };
    expect(totalSelectedAmount(state)).toBe(0);
  });
});

describe('selectedExpenseCount', () => {
  it('returns the number of selected expenses', () => {
    const state: ExpenseSelectionState = {
      selectedIds: [1, 2, 3],
      amounts: {},
    };
    expect(selectedExpenseCount(state)).toBe(3);
  });

  it('returns 0 for empty state', () => {
    expect(selectedExpenseCount({ selectedIds: [], amounts: {} })).toBe(0);
  });
});
