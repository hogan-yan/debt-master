export interface ExpenseSelectionState {
  selectedIds: number[];
  amounts: Record<number, string>;
}

type ExpenseSelectionAction =
  | { type: 'INIT' }
  | { type: 'SELECT_EXPENSE'; expenseId: number; defaultAmount: number }
  | { type: 'DESELECT_EXPENSE'; expenseId: number }
  | { type: 'SET_SELECTED'; expenseId: number; selected: boolean; defaultAmount: number }
  | { type: 'UPDATE_AMOUNT'; expenseId: number; amount: string }
  | { type: 'RESTORE'; state: ExpenseSelectionState };

export function expenseSelectionReducer(
  state: ExpenseSelectionState,
  action: ExpenseSelectionAction
): ExpenseSelectionState {
  switch (action.type) {
    case 'INIT':
      if (state.selectedIds.length === 0 && Object.keys(state.amounts).length === 0) {
        return state;
      }
      return { selectedIds: [], amounts: {} };

    case 'SELECT_EXPENSE':
      return selectExpense(state, action.expenseId, action.defaultAmount);

    case 'DESELECT_EXPENSE':
      return deselectExpense(state, action.expenseId);

    case 'SET_SELECTED':
      return action.selected
        ? selectExpense(state, action.expenseId, action.defaultAmount)
        : deselectExpense(state, action.expenseId);

    case 'UPDATE_AMOUNT':
      return updateExpenseAmount(state, action.expenseId, action.amount);

    case 'RESTORE':
      return action.state;

    default:
      return state;
  }
}

export function selectExpense(
  state: ExpenseSelectionState,
  expenseId: number,
  defaultAmount: number
): ExpenseSelectionState {
  if (state.selectedIds.includes(expenseId)) return state;
  return {
    selectedIds: [...state.selectedIds, expenseId],
    amounts: { ...state.amounts, [expenseId]: defaultAmount.toString() },
  };
}

export function deselectExpense(
  state: ExpenseSelectionState,
  expenseId: number
): ExpenseSelectionState {
  const newAmounts = { ...state.amounts };
  delete newAmounts[expenseId];
  return {
    selectedIds: state.selectedIds.filter((id) => id !== expenseId),
    amounts: newAmounts,
  };
}

export function updateExpenseAmount(
  state: ExpenseSelectionState,
  expenseId: number,
  amount: string
): ExpenseSelectionState {
  return {
    ...state,
    amounts: { ...state.amounts, [expenseId]: amount },
  };
}

export function totalSelectedAmount(state: ExpenseSelectionState): number {
  return state.selectedIds.reduce((sum, id) => {
    const amount = Number.parseFloat(state.amounts[id] || '0');
    return sum + (Number.isNaN(amount) ? 0 : amount);
  }, 0);
}

export function selectedExpenseCount(state: ExpenseSelectionState): number {
  return state.selectedIds.length;
}
