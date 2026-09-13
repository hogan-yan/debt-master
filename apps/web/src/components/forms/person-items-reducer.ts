export interface PersonItem {
  id: string;
  name: string;
  price: number;
}

let itemIdCounter = 0;
function generateItemId(): string {
  return `item-${++itemIdCounter}`;
}

export interface PersonItems {
  colleagueId: number;
  items: PersonItem[];
}

export type PersonItemsAction =
  | { type: 'ADD_PERSON'; colleagueId: number }
  | { type: 'REMOVE_PERSON'; colleagueId: number }
  | { type: 'ADD_ITEM'; personIndex: number }
  | { type: 'REMOVE_ITEM'; personIndex: number; itemIndex: number }
  | {
      type: 'UPDATE_ITEM';
      personIndex: number;
      itemIndex: number;
      field: 'name' | 'price';
      value: string | number;
    }
  | { type: 'SET_ITEMS'; items: PersonItems[] };

export function personItemsReducer(state: PersonItems[], action: PersonItemsAction): PersonItems[] {
  switch (action.type) {
    case 'ADD_PERSON':
      return addPerson(state, action.colleagueId);
    case 'REMOVE_PERSON':
      return removePerson(state, action.colleagueId);
    case 'ADD_ITEM':
      return addItemToPerson(state, action.personIndex);
    case 'REMOVE_ITEM':
      return removeItemFromPerson(state, action.personIndex, action.itemIndex);
    case 'UPDATE_ITEM':
      return updateItem(state, action.personIndex, action.itemIndex, action.field, action.value);
    case 'SET_ITEMS':
      return action.items;
    default:
      return state;
  }
}

function addPerson(state: PersonItems[], colleagueId: number): PersonItems[] {
  if (state.some((p) => p.colleagueId === colleagueId)) return state;
  return [...state, { colleagueId, items: [{ id: generateItemId(), name: '', price: 0 }] }];
}

function removePerson(state: PersonItems[], colleagueId: number): PersonItems[] {
  return state.filter((p) => p.colleagueId !== colleagueId);
}

/** Toggle: adds if not present, removes if present */
export function setPersonItems(state: PersonItems[], colleagueId: number): PersonItems[] {
  return state.some((p) => p.colleagueId === colleagueId)
    ? removePerson(state, colleagueId)
    : addPerson(state, colleagueId);
}

export function addItemToPerson(state: PersonItems[], personIndex: number): PersonItems[] {
  const person = state[personIndex];
  if (!person) return state;
  return [
    ...state.slice(0, personIndex),
    { ...person, items: [...person.items, { id: generateItemId(), name: '', price: 0 }] },
    ...state.slice(personIndex + 1),
  ];
}

export function removeItemFromPerson(
  state: PersonItems[],
  personIndex: number,
  itemIndex: number
): PersonItems[] {
  const person = state[personIndex];
  if (!person || person.items.length <= 1) return state;
  return [
    ...state.slice(0, personIndex),
    { ...person, items: person.items.filter((_, i) => i !== itemIndex) },
    ...state.slice(personIndex + 1),
  ];
}

function updateItem(
  state: PersonItems[],
  personIndex: number,
  itemIndex: number,
  field: 'name' | 'price',
  value: string | number
): PersonItems[] {
  const person = state[personIndex];
  const item = person?.items[itemIndex];
  if (!person || !item) return state;
  const newPrice =
    field === 'price'
      ? typeof value === 'number'
        ? value
        : Number.parseFloat(value) || 0
      : item.price;
  const newName = field === 'name' ? String(value) : item.name;
  const newItems = person.items.map((it, i) =>
    i === itemIndex ? { ...it, price: newPrice, name: newName } : it
  );
  return [
    ...state.slice(0, personIndex),
    { ...person, items: newItems },
    ...state.slice(personIndex + 1),
  ];
}

export function updatePersonItem(
  state: PersonItems[],
  personIndex: number,
  itemIndex: number,
  field: 'name' | 'price',
  value: string | number
): PersonItems[] {
  return updateItem(state, personIndex, itemIndex, field, value);
}

export function totalForPerson(state: PersonItems[], personIndex: number): number {
  return state[personIndex]?.items.reduce((sum, i) => sum + i.price, 0) ?? 0;
}

export function grandTotal(state: PersonItems[]): number {
  return state.reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.price, 0), 0);
}

export function participantIdsFromPersonItems(state: PersonItems[]): number[] {
  return [...new Set(state.map((p) => p.colleagueId))];
}
