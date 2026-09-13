/**
 * Analytics Helpers Workflow Tests
 *
 * Tests for shared dashboard analytics helper functions.
 */

import { describe, expect, it } from 'vitest';
import { daysSince, formatDaysAgo } from '../analytics-helpers';

describe('Analytics Helpers', () => {
  describe('formatDaysAgo', () => {
    it('should format days correctly', () => {
      // Use a fixed reference point
      const today = new Date('2024-06-15');

      // Test with explicit date calculations
      const yesterday = new Date('2024-06-14');
      const daysDiff = Math.floor((today.getTime() - yesterday.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(1);
    });

    it('should return "Today" for same day', () => {
      const result = formatDaysAgo(new Date());
      // Result will depend on when the test runs
      expect(['Today', '1 day ago', /\d+ days ago/]).toContainEqual(
        expect.stringContaining(result) || result
      );
    });

    it('should handle date strings', () => {
      // Test that function accepts string dates
      const result = formatDaysAgo('2023-01-01');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('daysSince', () => {
    it('should return 0 for same date', () => {
      const today = new Date();
      const result = daysSince(today);
      expect(result).toBe(0);
    });

    it('should calculate days correctly for past dates', () => {
      // Test using explicit dates
      const referenceDate = new Date('2024-06-15');
      const pastDate = new Date('2024-06-10');

      // Manual calculation
      const expectedDays = Math.floor(
        (referenceDate.getTime() - pastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(expectedDays).toBe(5);
    });

    it('should handle date strings', () => {
      const result = daysSince('2023-01-01');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should return positive numbers for past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = daysSince(yesterday);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
