import { describe, expect, it } from 'vitest';
import { calendarDaysFromToday, parseLedgerDate, todayLocalDateOnly } from '../ledger-date';

describe('parseLedgerDate', () => {
  it('parses date-only strings as a local calendar date', () => {
    const d = parseLedgerDate('2026-09-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
  });

  it('keeps the calendar day for UTC-midnight ISO strings in any local timezone', () => {
    // Same instant regardless of where the test runs; the y-m-d prefix wins.
    const d = parseLedgerDate('2026-09-14T00:00:00.000Z');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(14);
  });

  it('keeps the calendar day for offset-suffixed ISO strings', () => {
    const d = parseLedgerDate('2026-09-14T00:00:00+12:00');
    expect(d.getDate()).toBe(14);
  });

  it('treats date-only-prefix strings by their calendar day, not their UTC instant', () => {
    // Even with a time suffix (serialized UTC midnight), the y-m-d prefix
    // wins so the ledger day is stable across timezones.
    const d = parseLedgerDate('2026-09-14T10:30:00.000Z');
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(14);
  });

  it('falls back to instant parsing for non-date strings (Invalid Date in, Invalid Date out)', () => {
    expect(Number.isNaN(parseLedgerDate('not-a-date').getTime())).toBe(true);
  });
});

describe('calendarDaysFromToday', () => {
  it('returns 0 for today regardless of the time of day', () => {
    const now = new Date();
    const laterToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
    const earlierToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
    expect(calendarDaysFromToday(laterToday)).toBe(0);
    expect(calendarDaysFromToday(earlierToday)).toBe(0);
  });

  it('returns 1 for yesterday and -1 for tomorrow across midnight boundaries', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    expect(calendarDaysFromToday(yesterday)).toBe(1);
    expect(calendarDaysFromToday(tomorrow)).toBe(-1);
  });

  it('is stable for a parsed ledger date near midnight', () => {
    // A UTC-midnight stored date for "today" must read as today, not
    // "in 1 day" or "yesterday", whichever side of UTC the viewer sits.
    const today = todayLocalDateOnly();
    expect(calendarDaysFromToday(parseLedgerDate(`${today}T00:00:00.000Z`))).toBe(0);
  });
});

describe('todayLocalDateOnly', () => {
  it('matches the local calendar day, not the UTC day', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    expect(todayLocalDateOnly()).toBe(expected);
    expect(todayLocalDateOnly()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
