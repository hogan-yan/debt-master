import { describe, expect, it, vi } from 'vitest';

vi.mock('@/paraglide/runtime', () => ({
  getLocale: vi.fn(),
}));

import { getLocale } from '@/paraglide/runtime';
import { useFormatCurrency } from './use-format-currency';

describe('useFormatCurrency', () => {
  it('formats USD for en locale', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    expect(useFormatCurrency(1500.5, 'USD')).toBe('$1,500.50');
  });

  it('formats USD for zh-tw locale', () => {
    vi.mocked(getLocale).mockReturnValue('zh-tw');
    expect(useFormatCurrency(1500.5, 'USD')).toBe('US$1,500.50');
  });

  it('formats TWD for zh-tw locale', () => {
    vi.mocked(getLocale).mockReturnValue('zh-tw');
    expect(useFormatCurrency(1500.5, 'TWD')).toBe('$1,500.50');
  });

  it('formats JPY without decimal places', () => {
    vi.mocked(getLocale).mockReturnValue('ja');
    expect(useFormatCurrency(1500, 'JPY')).toBe('￥1,500');
  });

  it('formats JPY for zh-tw locale', () => {
    vi.mocked(getLocale).mockReturnValue('zh-tw');
    expect(useFormatCurrency(1500, 'JPY')).toBe('¥1,500');
  });
});
