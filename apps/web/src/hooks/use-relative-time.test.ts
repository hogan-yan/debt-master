import { describe, expect, it, vi } from 'vitest';

vi.mock('@/paraglide/runtime', () => ({
  getLocale: vi.fn(),
}));

import { getLocale } from '@/paraglide/runtime';
import { useRelativeTime } from './use-relative-time';

describe('useRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats past time in en', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    const twoDaysAgo = new Date('2026-04-21T12:00:00Z');
    expect(useRelativeTime(twoDaysAgo)).toBe('2 days ago');
  });

  it('formats future time in en', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    const tomorrow = new Date('2026-04-24T12:00:00Z');
    expect(useRelativeTime(tomorrow)).toBe('tomorrow');
  });

  it('formats past time in ja', () => {
    vi.mocked(getLocale).mockReturnValue('ja');
    const twoDaysAgo = new Date('2026-04-21T12:00:00Z');
    expect(useRelativeTime(twoDaysAgo)).toBe('一昨日');
  });

  it('formats past time in zh-tw', () => {
    vi.mocked(getLocale).mockReturnValue('zh-tw');
    const twoDaysAgo = new Date('2026-04-21T12:00:00Z');
    expect(useRelativeTime(twoDaysAgo)).toBe('前天');
  });

  it('accepts ISO string input', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    expect(useRelativeTime('2026-04-21T12:00:00Z')).toBe('2 days ago');
  });

  it('formats the current time as now', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    expect(useRelativeTime(new Date('2026-04-23T12:00:00Z'))).toBe('now');
  });
});
