import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PersonItems } from './use-person-items';
import { usePersonItems } from './use-person-items';

describe('usePersonItems', () => {
  it('initializes with empty array when no initialItems', () => {
    const { result } = renderHook(() => usePersonItems());
    expect(result.current.personItems).toEqual([]);
  });

  it('initializes with initialItems', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    expect(result.current.personItems).toEqual(initial);
  });

  it('initializes with empty array when initialItems is empty', () => {
    const { result } = renderHook(() => usePersonItems([]));
    expect(result.current.personItems).toEqual([]);
  });

  it('toggles person on (ADD_PERSON)', () => {
    const { result } = renderHook(() => usePersonItems());
    act(() => result.current.togglePerson(1));
    expect(result.current.personItems.length).toBe(1);
    expect(result.current.personItems[0]!.colleagueId).toBe(1);
    expect(result.current.personItems[0]!.items.length).toBe(1);
  });

  it('toggles person off (REMOVE_PERSON)', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    act(() => result.current.togglePerson(1));
    expect(result.current.personItems.length).toBe(0);
  });

  it('adds item to person', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    act(() => result.current.addItem(0));
    expect(result.current.personItems[0]!.items.length).toBe(2);
  });

  it('removes item from person', () => {
    const initial: PersonItems[] = [
      {
        colleagueId: 1,
        items: [
          { id: 'i1', name: 'Food', price: 10 },
          { id: 'i2', name: 'Drink', price: 5 },
        ],
      },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    act(() => result.current.removeItem(0, 1));
    expect(result.current.personItems[0]!.items.length).toBe(1);
    expect(result.current.personItems[0]!.items[0]!.name).toBe('Food');
  });

  it('updates item name', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    act(() => result.current.updateItem(0, 0, 'name', 'Burger'));
    expect(result.current.personItems[0]!.items[0]!.name).toBe('Burger');
    expect(result.current.personItems[0]!.items[0]!.price).toBe(10);
  });

  it('updates item price with number', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    act(() => result.current.updateItem(0, 0, 'price', 25));
    expect(result.current.personItems[0]!.items[0]!.price).toBe(25);
  });

  it('updates item price with string', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    act(() => result.current.updateItem(0, 0, 'price', '30.5'));
    expect(result.current.personItems[0]!.items[0]!.price).toBe(30.5);
  });

  it('calculates total for person', () => {
    const initial: PersonItems[] = [
      {
        colleagueId: 1,
        items: [
          { id: 'i1', name: 'Food', price: 10 },
          { id: 'i2', name: 'Drink', price: 5 },
        ],
      },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    expect(result.current.totalForPerson(0)).toBe(15);
  });

  it('calculates grand total', () => {
    const initial: PersonItems[] = [
      {
        colleagueId: 1,
        items: [
          { id: 'i1', name: 'Food', price: 10 },
          { id: 'i2', name: 'Drink', price: 5 },
        ],
      },
      {
        colleagueId: 2,
        items: [{ id: 'i3', name: 'Snack', price: 3 }],
      },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    expect(result.current.grandTotal()).toBe(18);
  });

  it('returns participant ids', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
      { colleagueId: 2, items: [{ id: 'i2', name: 'Drink', price: 5 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    expect(result.current.participantIds()).toEqual([1, 2]);
  });

  it('resets to initial items', () => {
    const initial: PersonItems[] = [
      { colleagueId: 1, items: [{ id: 'i1', name: 'Food', price: 10 }] },
    ];
    const { result } = renderHook(() => usePersonItems(initial));
    act(() => result.current.addItem(0));
    expect(result.current.personItems[0]!.items.length).toBe(2);
    act(() => result.current.reset());
    expect(result.current.personItems[0]!.items.length).toBe(1);
  });

  it('reset uses empty array when no initialItems', () => {
    const { result } = renderHook(() => usePersonItems());
    act(() => result.current.togglePerson(1));
    expect(result.current.personItems.length).toBe(1);
    act(() => result.current.reset());
    expect(result.current.personItems.length).toBe(0);
  });
});
