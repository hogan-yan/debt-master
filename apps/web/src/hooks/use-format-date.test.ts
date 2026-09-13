import { describe, expect, it, vi } from 'vitest';

vi.mock('@/paraglide/runtime', () => ({
  getLocale: vi.fn(),
}));

import { getLocale } from '@/paraglide/runtime';
import { useFormatDate } from './use-format-date';

describe('useFormatDate', () => {
  const testDate = new Date('2026-04-23T12:00:00Z');

  it('formats date for en locale', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    expect(useFormatDate(testDate)).toBe('Apr 23, 2026');
  });

  it('formats date for zh-tw locale', () => {
    vi.mocked(getLocale).mockReturnValue('zh-tw');
    expect(useFormatDate(testDate)).toBe('2026年4月23日');
  });

  it('formats date for ja locale', () => {
    vi.mocked(getLocale).mockReturnValue('ja');
    expect(useFormatDate(testDate)).toBe('2026年4月23日');
  });

  it('accepts ISO string input', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    expect(useFormatDate('2026-04-23T12:00:00Z')).toBe('Apr 23, 2026');
  });

  it('accepts custom options', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    expect(useFormatDate(testDate, { month: 'long', day: 'numeric' })).toBe('April 23');
  });
});
