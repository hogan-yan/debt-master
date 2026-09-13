import { describe, expect, it } from 'vitest';
import { colleagueSortName, unappliedCreditAmount } from '../expense-participants';

describe('expense-participants helpers', () => {
  it('unappliedCreditAmount covers missing colleague and missing funds', () => {
    expect(unappliedCreditAmount({ 1: 12 }, 1)).toBe(12);
    expect(unappliedCreditAmount({ 1: 12 }, undefined)).toBe(0);
    expect(unappliedCreditAmount({}, 0)).toBe(0);
    expect(unappliedCreditAmount({ 0: 0 }, undefined)).toBe(0);
  });

  it('colleagueSortName covers missing names', () => {
    expect(colleagueSortName({ name: 'Ada' })).toBe('Ada');
    expect(colleagueSortName({ name: '' })).toBe('');
    expect(colleagueSortName({})).toBe('');
    expect(colleagueSortName(null)).toBe('');
    expect(colleagueSortName(undefined)).toBe('');
  });
});
