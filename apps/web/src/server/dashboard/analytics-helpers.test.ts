import { describe, expect, it, vi } from 'vitest';
import { daysSince, formatDaysAgo } from './analytics-helpers';

describe('analytics-helpers', () => {
  describe('formatDaysAgo', () => {
    it('returns Today for same day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
      expect(formatDaysAgo('2026-05-15T10:00:00Z')).toBe('Today');
      vi.useRealTimers();
    });

    it('returns 1 day ago for yesterday', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
      expect(formatDaysAgo('2026-05-14T10:00:00Z')).toBe('1 day ago');
      vi.useRealTimers();
    });

    it('returns N days ago for older dates', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
      expect(formatDaysAgo('2026-05-10T10:00:00Z')).toBe('5 days ago');
      vi.useRealTimers();
    });
  });

  describe('daysSince', () => {
    it('returns whole days since a date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
      expect(daysSince('2026-05-10T10:00:00Z')).toBe(5);
      vi.useRealTimers();
    });

    it('accepts a Date instance', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
      expect(daysSince(new Date('2026-05-10T10:00:00Z'))).toBe(5);
      vi.useRealTimers();
    });
  });
});
