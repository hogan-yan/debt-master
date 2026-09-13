import { describe, expect, it } from 'vitest';
import {
  formatAmountOnly,
  formatCurrency,
  formatMajorCurrency,
  getCurrencyFormatter,
  normalizeUsdSymbol,
} from './format';
import { asMoneyMinor, fromDecimal } from './parse';

describe('formatCurrency', () => {
  it('formats USD with plain $ (not US$)', () => {
    expect(formatCurrency(fromDecimal('24.99', 'USD'), 'USD')).toBe('$24.99');
    expect(formatCurrency(fromDecimal('1000.00', 'USD'), 'USD')).toBe('$1,000.00');
  });

  it('formats negative USD', () => {
    expect(formatCurrency(fromDecimal('-12.50', 'USD'), 'USD')).toBe('-$12.50');
  });

  it('formats zero-decimal JPY', () => {
    expect(formatCurrency(fromDecimal('1500', 'JPY'), 'JPY')).toBe('¥1,500');
  });

  it('formats EUR with symbol', () => {
    const out = formatCurrency(fromDecimal('10.00', 'EUR'), 'EUR');
    expect(out).toContain('10.00');
    expect(out).toMatch(/€/);
  });

  it('adds + when signed and positive', () => {
    expect(formatCurrency(fromDecimal('5.00', 'USD'), 'USD', { signed: true })).toBe('+$5.00');
    expect(formatCurrency(fromDecimal('-5.00', 'USD'), 'USD', { signed: true })).toBe('-$5.00');
    expect(formatCurrency(asMoneyMinor(0n), 'USD', { signed: true })).toBe('$0.00');
  });

  it('is case-insensitive on currency code', () => {
    expect(formatCurrency(fromDecimal('1.00', 'usd'), 'usd')).toBe('$1.00');
  });
});

describe('formatMajorCurrency', () => {
  it('formats paywall-style majors as USD $', () => {
    expect(formatMajorCurrency(24.99, 'USD')).toBe('$24.99');
    expect(formatMajorCurrency(4.99, 'USD')).toBe('$4.99');
  });

  it('formats non-USD majors without USD-symbol rewrite', () => {
    const out = formatMajorCurrency(10, 'EUR');
    expect(out).toContain('10.00');
    expect(out).toMatch(/€/);
  });
});

describe('formatAmountOnly', () => {
  it('returns decimal without symbol', () => {
    expect(formatAmountOnly(fromDecimal('12.34', 'USD'), 'USD')).toBe('12.34');
  });
});

describe('normalizeUsdSymbol', () => {
  // The en-US test runtime already emits `$`, so formatCurrency/formatMajorCurrency
  // can never exercise this rewrite. Test the seam directly to lock the guard.
  it('rewrites a leading US$ to $ for USD', () => {
    expect(normalizeUsdSymbol('US$24.99', 'USD')).toBe('$24.99');
  });

  it('preserves a leading minus when rewriting', () => {
    expect(normalizeUsdSymbol('-US$5.00', 'USD')).toBe('-$5.00');
  });

  it('leaves non-USD output untouched', () => {
    expect(normalizeUsdSymbol('US$24.99', 'EUR')).toBe('US$24.99');
  });

  it('only rewrites a LEADING US$ (anchors at start), not mid-string', () => {
    expect(normalizeUsdSymbol('foo US$ bar', 'USD')).toBe('foo US$ bar');
  });

  it('passes already-$ output through unchanged', () => {
    expect(normalizeUsdSymbol('$24.99', 'USD')).toBe('$24.99');
  });
});

describe('getCurrencyFormatter', () => {
  it('returns the cached instance for the same key (referential identity)', () => {
    // The cache is a perf contract — a repeat call must return the *same*
    // formatter, not a fresh one. Output equality can't distinguish those, so
    // this is what kills a "skip the cache" mutation.
    const first = getCurrencyFormatter('en-US', 'USD', 2);
    const second = getCurrencyFormatter('en-US', 'USD', 2);
    expect(first).toBe(second);
  });

  it('caches per locale|code|decimals (distinct keys are distinct instances)', () => {
    const usd = getCurrencyFormatter('en-US', 'USD', 2);
    const jpy = getCurrencyFormatter('en-US', 'JPY', 0);
    expect(usd).not.toBe(jpy);
  });
});
