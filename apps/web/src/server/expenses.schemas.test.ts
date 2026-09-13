import { describe, expect, it } from 'vitest';
import { expenseSchema, paginationSchema } from './expenses';

describe('expenseSchema', () => {
  const validExpense = {
    date: '2024-01-15',
    restaurantId: 1,
    amount: 100.5,
    splitType: 'EQUAL' as const,
    participantIds: [1, 2, 3],
  };

  it('accepts valid equal split expense', () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it('accepts valid itemized split expense', () => {
    const itemizedExpense = {
      ...validExpense,
      splitType: 'ITEMIZED' as const,
      items: [
        { name: 'Burger', price: 15.99, colleagueId: 1 },
        { name: 'Fries', price: 5.99, colleagueId: 2 },
      ],
    };

    const result = expenseSchema.safeParse(itemizedExpense);
    expect(result.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const invalidExpense = {
      ...validExpense,
      amount: -50,
    };

    const result = expenseSchema.safeParse(invalidExpense);
    expect(result.success).toBe(false);
  });

  it('rejects zero amount', () => {
    const invalidExpense = {
      ...validExpense,
      amount: 0,
    };

    const result = expenseSchema.safeParse(invalidExpense);
    expect(result.success).toBe(false);
  });

  it('rejects empty participant list', () => {
    const invalidExpense = {
      ...validExpense,
      participantIds: [],
    };

    const result = expenseSchema.safeParse(invalidExpense);
    expect(result.success).toBe(false);
  });

  it('rejects invalid split type', () => {
    const invalidExpense = {
      ...validExpense,
      splitType: 'INVALID',
    };

    const result = expenseSchema.safeParse(invalidExpense);
    expect(result.success).toBe(false);
  });

  it('accepts optional notes', () => {
    const expenseWithNotes = {
      ...validExpense,
      notes: 'Team lunch for project kickoff',
    };

    const result = expenseSchema.safeParse(expenseWithNotes);
    expect(result.success).toBe(true);
  });

  it('accepts expense without items for equal split', () => {
    const expenseWithoutItems = {
      ...validExpense,
      splitType: 'EQUAL',
      // No items property
    };

    const result = expenseSchema.safeParse(expenseWithoutItems);
    expect(result.success).toBe(true);
  });
});

describe('paginationSchema', () => {
  it('accepts empty object with defaults', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
      expect(result.data.sortBy).toBe('date');
      expect(result.data.sortOrder).toBe('desc');
    }
  });

  it('accepts valid pagination params', () => {
    const params = {
      page: 2,
      pageSize: 25,
      search: 'restaurant name',
      sortBy: 'amount' as const,
      sortOrder: 'asc' as const,
    };

    const result = paginationSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('rejects zero page number', () => {
    const result = paginationSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative page size', () => {
    const result = paginationSchema.safeParse({ pageSize: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sortBy field', () => {
    const result = paginationSchema.safeParse({ sortBy: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sortOrder', () => {
    const result = paginationSchema.safeParse({ sortOrder: 'up' });
    expect(result.success).toBe(false);
  });
});
