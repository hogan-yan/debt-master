import { useCallback, useReducer } from 'react';
import {
  grandTotal as calcGrandTotal,
  totalForPerson as calcTotalForPerson,
  type PersonItems,
  participantIdsFromPersonItems,
  personItemsReducer,
} from './person-items-reducer';

export type { PersonItem, PersonItems } from './person-items-reducer';

interface UsePersonItemsReturn {
  personItems: PersonItems[];
  togglePerson: (colleagueId: number) => void;
  addItem: (personIndex: number) => void;
  removeItem: (personIndex: number, itemIndex: number) => void;
  updateItem: (
    personIndex: number,
    itemIndex: number,
    field: 'name' | 'price',
    value: string | number
  ) => void;
  totalForPerson: (personIndex: number) => number;
  grandTotal: () => number;
  participantIds: () => number[];
  reset: () => void;
}

export function usePersonItems(initialItems?: PersonItems[]): UsePersonItemsReturn {
  const [personItems, dispatch] = useReducer(
    personItemsReducer,
    initialItems && initialItems.length > 0 ? initialItems : []
  );

  const togglePerson = useCallback(
    (colleagueId: number) => {
      const exists = personItems.some((p) => p.colleagueId === colleagueId);
      dispatch({
        type: exists ? 'REMOVE_PERSON' : 'ADD_PERSON',
        colleagueId,
      });
    },
    [personItems]
  );

  const addItem = useCallback(
    (personIndex: number) => dispatch({ type: 'ADD_ITEM', personIndex }),
    []
  );

  const removeItem = useCallback(
    (personIndex: number, itemIndex: number) =>
      dispatch({ type: 'REMOVE_ITEM', personIndex, itemIndex }),
    []
  );

  const updateItem = useCallback(
    (personIndex: number, itemIndex: number, field: 'name' | 'price', value: string | number) =>
      dispatch({ type: 'UPDATE_ITEM', personIndex, itemIndex, field, value }),
    []
  );

  const totalForPerson = useCallback(
    (personIndex: number) => calcTotalForPerson(personItems, personIndex),
    [personItems]
  );

  const grandTotal = useCallback(() => calcGrandTotal(personItems), [personItems]);

  const participantIds = useCallback(
    () => participantIdsFromPersonItems(personItems),
    [personItems]
  );

  const reset = useCallback(() => {
    dispatch({ type: 'SET_ITEMS', items: initialItems || [] });
  }, [initialItems]);

  return {
    personItems,
    togglePerson,
    addItem,
    removeItem,
    updateItem,
    totalForPerson,
    grandTotal,
    participantIds,
    reset,
  };
}
