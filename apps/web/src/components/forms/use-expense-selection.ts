import { useCallback, useMemo, useReducer } from 'react';
import {
  type ExpenseSelectionState,
  expenseSelectionReducer,
  selectedExpenseCount,
  totalSelectedAmount,
} from './expense-selection-reducer';

export function useExpenseSelection(initialState?: ExpenseSelectionState) {
  const initialStateValue: ExpenseSelectionState = initialState || {
    selectedIds: [],
    amounts: {},
  };

  const [state, dispatch] = useReducer(expenseSelectionReducer, initialStateValue);

  const selectExpense = useCallback((expenseId: number, defaultAmount: number) => {
    dispatch({ type: 'SELECT_EXPENSE', expenseId, defaultAmount });
  }, []);

  const deselectExpense = useCallback((expenseId: number) => {
    dispatch({ type: 'DESELECT_EXPENSE', expenseId });
  }, []);

  const toggleExpense = useCallback(
    (expenseId: number, selected: boolean, defaultAmount: number) => {
      dispatch({ type: 'SET_SELECTED', expenseId, selected, defaultAmount });
    },
    []
  );

  const updateAmount = useCallback((expenseId: number, amount: string) => {
    dispatch({ type: 'UPDATE_AMOUNT', expenseId, amount });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'INIT' });
  }, []);

  const restore = useCallback((newState: ExpenseSelectionState) => {
    dispatch({ type: 'RESTORE', state: newState });
  }, []);

  return useMemo(
    () => ({
      selectedIds: state.selectedIds,
      amounts: state.amounts,
      selectExpense,
      deselectExpense,
      toggleExpense,
      updateAmount,
      reset,
      restore,
      totalAmount: totalSelectedAmount(state),
      count: selectedExpenseCount(state),
    }),
    [state, selectExpense, deselectExpense, toggleExpense, updateAmount, reset, restore]
  );
}
