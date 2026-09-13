import { describe, expect, it } from 'vitest';

import { getStatusColorClasses } from '@/styles/class-constants';

describe('class-constants', () => {
  describe('getStatusColorClasses', () => {
    it('returns color classes for each status', () => {
      const success = getStatusColorClasses('success');
      const error = getStatusColorClasses('error');
      const warning = getStatusColorClasses('warning');
      const info = getStatusColorClasses('info');

      expect(success.bg).toContain('bg-success');
      expect(success.text).toBe('text-success');
      expect(success.border).toBe('border-success');

      expect(error.bg).toContain('bg-destructive');
      expect(error.text).toBe('text-destructive-text');
      expect(error.border).toBe('border-destructive');

      expect(warning.bg).toContain('bg-warning');
      expect(warning.text).toBe('text-warning');
      expect(warning.border).toBe('border-warning/20');

      expect(info.bg).toContain('bg-info');
      expect(info.text).toBe('text-info');
      expect(info.border).toBe('border-info/20');
    });
  });
});
