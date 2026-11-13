import { describe, expect, it } from 'vitest';
import type { Expense, ExpenseParticipantWithColleague } from '@/types';
import { filterExpensesByColleagues, getColleaguesFromExpenses } from './expense-filters';

function makeParticipant(
  partial: Partial<ExpenseParticipantWithColleague> & {
    colleagueId?: number;
    colleague?: ExpenseParticipantWithColleague['colleague'];
  } = {}
): ExpenseParticipantWithColleague {
  return {
    id: 1,
    amount: 50,
    colleague: null,
    expenseId: 1,
    colleagueId: 1,
    isPaid: false,
    isPending: false,
    hasPartialPayment: false,
    submittedAt: null,
    ...partial,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    date: '2024-01-01',
    restaurantId: 1,
    amount: 100,
    splitType: 'EQUAL',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Expense;
}

describe('filterExpensesByColleagues', () => {
  it('returns all expenses when no colleagues selected', () => {
    const expenses = [makeExpense({ id: 1 }), makeExpense({ id: 2 })];
    expect(filterExpensesByColleagues(expenses, [])).toEqual(expenses);
  });

  it('filters by colleagueId', () => {
    const expenses = [
      makeExpense({
        id: 1,
        participants: [makeParticipant({ colleagueId: 1, amount: 50 })],
      }),
      makeExpense({
        id: 2,
        participants: [makeParticipant({ colleagueId: 2, amount: 50 })],
      }),
    ];
    const result = filterExpensesByColleagues(expenses, [1]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  it('filters using colleague.id fallback', () => {
    const expenses = [
      makeExpense({
        id: 1,
        participants: [
          makeParticipant({
            colleague: { id: 1, name: 'Alice' },
            colleagueId: undefined,
            amount: 50,
          }),
        ],
      }),
      makeExpense({
        id: 2,
        participants: [
          makeParticipant({
            colleague: { id: 2, name: 'Bob' },
            colleagueId: undefined,
            amount: 50,
          }),
        ],
      }),
    ];
    const result = filterExpensesByColleagues(expenses, [1]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  it('handles expenses without participants', () => {
    const expenses = [
      makeExpense({ id: 1, participants: undefined }),
      makeExpense({ id: 2, participants: [makeParticipant({ colleagueId: 1, amount: 50 })] }),
    ];
    const result = filterExpensesByColleagues(expenses, [1]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });

  it('excludes participant with undefined colleagueId', () => {
    const expenses = [
      makeExpense({
        id: 1,
        participants: [makeParticipant({ colleagueId: undefined, amount: 50 })],
      }),
    ];
    const result = filterExpensesByColleagues(expenses, [1]);
    expect(result).toHaveLength(0);
  });
});

describe('getColleaguesFromExpenses', () => {
  it('returns empty array for empty expenses', () => {
    expect(getColleaguesFromExpenses([])).toEqual([]);
  });

  it('extracts unique colleagues from expenses', () => {
    const expenses = [
      makeExpense({
        id: 1,
        participants: [
          makeParticipant({ colleague: { id: 1, name: 'Bob' }, amount: 50 }),
          makeParticipant({ colleague: { id: 2, name: 'Alice' }, amount: 50 }),
        ],
      }),
      makeExpense({
        id: 2,
        participants: [makeParticipant({ colleague: { id: 1, name: 'Bob' }, amount: 50 })],
      }),
    ];
    const result = getColleaguesFromExpenses(expenses);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 2, name: 'Alice' }); // sorted
    expect(result[1]).toEqual({ id: 1, name: 'Bob' });
  });

  it('handles expenses without participants', () => {
    const expenses = [
      makeExpense({ id: 1, participants: undefined }),
      makeExpense({
        id: 2,
        participants: [makeParticipant({ colleague: { id: 1, name: 'Alice' }, amount: 50 })],
      }),
    ];
    const result = getColleaguesFromExpenses(expenses);
    expect(result).toHaveLength(1);
  });

  it('uses colleagueId fallback when colleague.id is undefined', () => {
    const expenses = [
      makeExpense({
        id: 1,
        participants: [
          makeParticipant({
            // Intentionally invalid colleague.id to test colleagueId fallback path
            colleague: {
              id: undefined,
              name: 'Alice',
            } as unknown as ExpenseParticipantWithColleague['colleague'],
            colleagueId: 1,
            amount: 50,
          }),
        ],
      }),
    ];
    const result = getColleaguesFromExpenses(expenses);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: 'Alice' });
  });

  it('skips participant without colleague info', () => {
    const expenses = [
      makeExpense({
        id: 1,
        participants: [makeParticipant({ colleague: null, amount: 50 })],
      }),
    ];
    const result = getColleaguesFromExpenses(expenses);
    expect(result).toEqual([]);
  });
});
