import { describe, expect, it } from 'vitest';
import { mapExpenseParticipantIds, mapExpenseParticipants } from '../expense-modals';

describe('expense-modals helpers', () => {
  it('mapExpenseParticipantIds covers missing participants', () => {
    expect(mapExpenseParticipantIds([{ colleagueId: 1 }, { colleagueId: 2 }])).toEqual([1, 2]);
    expect(mapExpenseParticipantIds(undefined)).toEqual([]);
    expect(mapExpenseParticipantIds(null)).toEqual([]);
  });

  it('mapExpenseParticipants covers missing participants', () => {
    const participants = [{ id: 1 }];
    expect(mapExpenseParticipants(participants)).toBe(participants);
    expect(mapExpenseParticipants(undefined)).toEqual([]);
    expect(mapExpenseParticipants(null)).toEqual([]);
  });
});
