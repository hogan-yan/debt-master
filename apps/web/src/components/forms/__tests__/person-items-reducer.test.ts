import { describe, expect, it } from 'vitest';
import {
  addItemToPerson,
  grandTotal,
  type PersonItems,
  participantIdsFromPersonItems,
  personItemsReducer,
  removeItemFromPerson,
  setPersonItems,
  totalForPerson,
  updatePersonItem,
} from '../person-items-reducer';

describe('personItemsReducer', () => {
  it('defaults to same state for unknown action type', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const unknownAction = { type: 'UNKNOWN' } as unknown as Parameters<
      typeof personItemsReducer
    >[1];
    const result = personItemsReducer(state, unknownAction);
    expect(result).toBe(state);
  });

  it('replaces entire items list with SET_ITEMS', () => {
    const original: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'A', price: 1 }] },
    ];
    const replacement: PersonItems[] = [
      { colleagueId: 2, items: [{ id: 'item-2', name: 'B', price: 2 }] },
    ];
    const result = personItemsReducer(original, { type: 'SET_ITEMS', items: replacement });
    expect(result).not.toBe(original);
    expect(result).toEqual(replacement);
  });
});

describe('setPersonItems (toggle add/remove)', () => {
  it('adds a new person with one empty item', () => {
    const result = setPersonItems([], 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.colleagueId).toBe(1);
    expect(result[0]?.items[0]).toEqual(expect.objectContaining({ name: '', price: 0 }));
    expect(result[0]?.items[0]?.id).toEqual(expect.any(String));
  });

  it('removes person when toggled and already present', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: '', price: 0 }] },
    ];
    const result = setPersonItems(state, 1);
    expect(result).toEqual([]);
  });

  it('adds person at front when toggled and not present', () => {
    const state: PersonItems[] = [
      { colleagueId: 2, items: [{ id: 'item-1', name: '', price: 0 }] },
    ];
    const result = setPersonItems(state, 1);
    expect(result).toHaveLength(2);
    expect(result[0]?.colleagueId).toBe(2); // existing first
    expect(result[1]?.colleagueId).toBe(1); // new at end
  });

  it('adds via reducer ADD_PERSON without duplicating', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: '', price: 0 }] },
    ];
    const result = personItemsReducer(state, { type: 'ADD_PERSON', colleagueId: 1 });
    expect(result).toBe(state); // same reference, not duplicated
  });

  it('removes a person by colleagueId', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
      { colleagueId: 2, items: [{ id: 'item-2', name: 'Fries', price: 5 }] },
    ];
    const result = setPersonItems(state, 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.colleagueId).toBe(2);
  });

  it('round-trips: add then remove returns empty', () => {
    const afterAdd = setPersonItems([], 5);
    expect(afterAdd).toHaveLength(1);
    expect(afterAdd[0]?.colleagueId).toBe(5);

    const afterRemove = setPersonItems(afterAdd, 5);
    expect(afterRemove).toHaveLength(0);
  });
});

describe('addItemToPerson', () => {
  it('adds a blank item to the person', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = addItemToPerson(state, 0);
    expect(result[0]?.items).toHaveLength(2);
    expect(result[0]?.items[1]).toEqual(expect.objectContaining({ name: '', price: 0 }));
    expect(result[0]?.items[1]?.id).toEqual(expect.any(String));
  });

  it('leaves state unchanged for invalid index', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = addItemToPerson(state, 99);
    expect(result).toBe(state);
  });
});

describe('removeItemFromPerson', () => {
  it('removes the specified item', () => {
    const state: PersonItems[] = [
      {
        colleagueId: 1,
        items: [
          { id: 'item-1', name: 'Burger', price: 10 },
          { id: 'item-2', name: 'Fries', price: 5 },
        ],
      },
    ];
    const result = removeItemFromPerson(state, 0, 0);
    expect(result[0]?.items).toHaveLength(1);
    expect(result[0]?.items[0]).toEqual({ id: 'item-2', name: 'Fries', price: 5 });
  });

  it('does not remove the last item', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = removeItemFromPerson(state, 0, 0);
    expect(result).toBe(state);
  });

  it('leaves state unchanged for invalid person index', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = removeItemFromPerson(state, 99, 0);
    expect(result).toBe(state);
  });
});

describe('updatePersonItem', () => {
  it('updates item name', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = updatePersonItem(state, 0, 0, 'name', 'Cheeseburger');
    expect(result[0]?.items[0]?.name).toBe('Cheeseburger');
    expect(result[0]?.items[0]?.price).toBe(10); // price unchanged
    expect(result[0]?.items[0]?.id).toBe('item-1'); // id unchanged
  });

  it('preserves non-target items while updating the selected item', () => {
    const state: PersonItems[] = [
      {
        colleagueId: 1,
        items: [
          { id: 'item-1', name: 'Burger', price: 10 },
          { id: 'item-2', name: 'Fries', price: 5 },
        ],
      },
    ];
    const result = updatePersonItem(state, 0, 1, 'name', 'Salad');

    expect(result[0]?.items).toEqual([
      { id: 'item-1', name: 'Burger', price: 10 },
      { id: 'item-2', name: 'Salad', price: 5 },
    ]);
  });

  it('updates item price as number', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = updatePersonItem(state, 0, 0, 'price', 12.5);
    expect(result[0]?.items[0]?.price).toBe(12.5);
  });

  it('updates item price as string (parsed)', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = updatePersonItem(state, 0, 0, 'price', '9.99');
    expect(result[0]?.items[0]?.price).toBe(9.99);
  });

  it('coerces non-numeric string price to zero', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = updatePersonItem(state, 0, 0, 'price', 'abc');
    expect(result[0]?.items[0]?.price).toBe(0);
  });

  it('leaves state unchanged for invalid person index', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
    ];
    const result = updatePersonItem(state, 99, 0, 'name', 'X');
    expect(result).toBe(state);
  });
});

describe('totals', () => {
  it('totalForPerson sums a persons items', () => {
    const state: PersonItems[] = [
      {
        colleagueId: 1,
        items: [
          { id: 'item-1', name: 'Burger', price: 10 },
          { id: 'item-2', name: 'Fries', price: 5 },
        ],
      },
    ];
    expect(totalForPerson(state, 0)).toBe(15);
  });

  it('totalForPerson returns 0 for missing person', () => {
    expect(totalForPerson([], 0)).toBe(0);
  });

  it('grandTotal sums all items across all people', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
      {
        colleagueId: 2,
        items: [
          { id: 'item-2', name: 'Fries', price: 5 },
          { id: 'item-3', name: 'Soda', price: 3 },
        ],
      },
    ];
    expect(grandTotal(state)).toBe(18);
  });

  it('grandTotal returns 0 for empty state', () => {
    expect(grandTotal([])).toBe(0);
  });
});

describe('participantIdsFromPersonItems', () => {
  it('extracts unique colleagueIds in order of first appearance', () => {
    const state: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'item-1', name: 'Burger', price: 10 }] },
      { colleagueId: 2, items: [{ id: 'item-2', name: 'Fries', price: 5 }] },
      { colleagueId: 1, items: [{ id: 'item-3', name: 'Soda', price: 3 }] },
    ];
    expect(participantIdsFromPersonItems(state)).toEqual([1, 2]);
  });

  it('returns empty array for empty state', () => {
    expect(participantIdsFromPersonItems([])).toEqual([]);
  });
});
