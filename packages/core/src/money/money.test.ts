import { describe, expect, it } from 'vitest';
import { convertToBase, RATE_SCALE, rateToScaled } from './convert';
import { asMoneyMinor, fromDecimal, toDecimalString } from './parse';
import {
  CURRENCY_DECIMALS,
  currencyDecimals,
  currencyMinorScale,
  DEFAULT_DECIMALS,
  MONEY_THRESHOLD_MINOR,
  type MoneyMinor,
} from './types';

/**
 * Mirror of public.currency_minor_scale CASE arms (migration 20260802180000).
 * If you change either side, update both and this fixture.
 */
const SQL_CURRENCY_MINOR_SCALE: Readonly<Record<string, number>> = {
  BIF: 1,
  CLP: 1,
  DJF: 1,
  GNF: 1,
  ISK: 1,
  JPY: 1,
  KMF: 1,
  KRW: 1,
  PYG: 1,
  RWF: 1,
  UGX: 1,
  VND: 1,
  VUV: 1,
  XAF: 1,
  XOF: 1,
  XPF: 1,
  BHD: 1000,
  IQD: 1000,
  JOD: 1000,
  KWD: 1000,
  LYD: 1000,
  OMR: 1000,
  TND: 1000,
};

describe('currencyDecimals', () => {
  it('returns known 2-decimal currencies', () => {
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('EUR')).toBe(2);
    expect(currencyDecimals('HKD')).toBe(2);
  });

  it('returns 0-decimal currencies', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KRW')).toBe(0);
    expect(currencyDecimals('CLP')).toBe(0);
    expect(currencyDecimals('XOF')).toBe(0);
  });

  it('returns 3-decimal currencies', () => {
    expect(currencyDecimals('BHD')).toBe(3);
    expect(currencyDecimals('KWD')).toBe(3);
    expect(currencyDecimals('IQD')).toBe(3);
  });

  it('is case-insensitive', () => {
    expect(currencyDecimals('usd')).toBe(2);
    expect(currencyDecimals('jPy')).toBe(0);
  });

  it('falls back to default decimals for unknown currency', () => {
    expect(currencyDecimals('XYZ')).toBe(DEFAULT_DECIMALS);
  });

  it('CURRENCY_DECIMALS map is populated', () => {
    expect(CURRENCY_DECIMALS.USD).toBe(2);
    expect(MONEY_THRESHOLD_MINOR).toBe(1n);
  });
});

describe('currencyMinorScale SQL↔TS parity', () => {
  it('every SQL CASE arm matches currencyMinorScale()', () => {
    for (const [code, scale] of Object.entries(SQL_CURRENCY_MINOR_SCALE)) {
      expect(currencyMinorScale(code)).toBe(scale);
    }
  });

  it('every non-default CURRENCY_DECIMALS entry has a SQL CASE arm', () => {
    for (const [code, decimals] of Object.entries(CURRENCY_DECIMALS)) {
      if (decimals === DEFAULT_DECIMALS) continue;
      expect(SQL_CURRENCY_MINOR_SCALE[code]).toBe(10 ** decimals);
    }
  });

  it('defaults to 100 (2-decimal) for unknown codes', () => {
    expect(currencyMinorScale('USD')).toBe(100);
    expect(currencyMinorScale('XYZ')).toBe(100);
  });
});

describe('asMoneyMinor', () => {
  it('brands a bigint', () => {
    const m: MoneyMinor = asMoneyMinor(100n);
    expect(BigInt(m)).toBe(100n);
  });
});

describe('fromDecimal', () => {
  it('parses a 2-decimal value', () => {
    expect(BigInt(fromDecimal('100.00', 'USD'))).toBe(10_000n);
    expect(BigInt(fromDecimal('0.01', 'USD'))).toBe(1n);
  });

  it('parses whole number with no decimal point', () => {
    expect(BigInt(fromDecimal('50', 'USD'))).toBe(5_000n);
  });

  it('pads short fractions', () => {
    expect(BigInt(fromDecimal('1.5', 'USD'))).toBe(150n);
    expect(BigInt(fromDecimal('1.5', 'BHD'))).toBe(1_500n);
  });

  it('truncates over-long fractions (floor)', () => {
    expect(BigInt(fromDecimal('1.999', 'USD'))).toBe(199n);
  });

  it('parses negative values', () => {
    expect(BigInt(fromDecimal('-10.00', 'USD'))).toBe(-1_000n);
    expect(BigInt(fromDecimal('-0.50', 'USD'))).toBe(-50n);
  });

  it('handles 0-decimal currency (JPY)', () => {
    expect(BigInt(fromDecimal('1500', 'JPY'))).toBe(1_500n);
    expect(BigInt(fromDecimal('1500.99', 'JPY'))).toBe(1_500n);
  });

  it('handles 3-decimal currency (BHD)', () => {
    expect(BigInt(fromDecimal('12.345', 'BHD'))).toBe(12_345n);
  });

  it('trims surrounding whitespace', () => {
    expect(BigInt(fromDecimal('  10.00  ', 'USD'))).toBe(1_000n);
  });

  it('rejects invalid input', () => {
    expect(() => fromDecimal('abc', 'USD')).toThrow(RangeError);
    expect(() => fromDecimal('', 'USD')).toThrow(RangeError);
    expect(() => fromDecimal('1.2.3', 'USD')).toThrow(RangeError);
    expect(() => fromDecimal('--5', 'USD')).toThrow(RangeError);
  });
});

describe('toDecimalString', () => {
  it('formats a 2-decimal value', () => {
    expect(toDecimalString(asMoneyMinor(10_000n), 'USD')).toBe('100.00');
    expect(toDecimalString(asMoneyMinor(1n), 'USD')).toBe('0.01');
  });

  it('formats round numbers with trailing zeros', () => {
    expect(toDecimalString(asMoneyMinor(5_000n), 'USD')).toBe('50.00');
  });

  it('formats negative values', () => {
    expect(toDecimalString(asMoneyMinor(-1_000n), 'USD')).toBe('-10.00');
    expect(toDecimalString(asMoneyMinor(-1n), 'USD')).toBe('-0.01');
  });

  it('formats 0-decimal currency', () => {
    expect(toDecimalString(asMoneyMinor(1_500n), 'JPY')).toBe('1500');
  });

  it('formats 3-decimal currency', () => {
    expect(toDecimalString(asMoneyMinor(12_345n), 'BHD')).toBe('12.345');
  });

  it('round-trips with fromDecimal', () => {
    for (const [str, currency] of [
      ['100.00', 'USD'],
      ['0.99', 'EUR'],
      ['1500', 'JPY'],
      ['12.345', 'BHD'],
      ['-42.10', 'GBP'],
    ] as const) {
      const minor = fromDecimal(str, currency);
      expect(toDecimalString(minor, currency)).toBe(str);
    }
  });
});

describe('rateToScaled', () => {
  it('scales a finite positive rate by 1e6', () => {
    expect(rateToScaled(1.5)).toBe(1_500_000n);
    expect(rateToScaled(1)).toBe(RATE_SCALE);
    expect(rateToScaled(0.5)).toBe(500_000n);
  });

  it('rounds to nearest scaled integer', () => {
    expect(rateToScaled(1.0000004)).toBe(1_000_000n);
    expect(rateToScaled(1.0000006)).toBe(1_000_001n);
  });

  it('rejects NaN', () => {
    expect(() => rateToScaled(Number.NaN)).toThrow(RangeError);
  });

  it('rejects Infinity', () => {
    expect(() => rateToScaled(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('rejects zero and negative rates', () => {
    expect(() => rateToScaled(0)).toThrow(RangeError);
    expect(() => rateToScaled(-1.5)).toThrow(RangeError);
  });
});

describe('convertToBase', () => {
  it('multiplies by scaled rate and floors (same-decimal)', () => {
    // 100.00 USD @ 1.5 → 150.00 = 15000 minor
    expect(BigInt(convertToBase(asMoneyMinor(10_000n), rateToScaled(1.5), 'USD', 'USD'))).toBe(
      15_000n
    );
  });

  it('floors fractional minor units (same-decimal)', () => {
    // 0.03 USD (3 minor) @ 1.5 → 4.5 → floor 4
    expect(BigInt(convertToBase(asMoneyMinor(3n), rateToScaled(1.5), 'USD', 'USD'))).toBe(4n);
  });

  it('identity rate returns same amount (same-decimal)', () => {
    expect(BigInt(convertToBase(asMoneyMinor(7_777n), RATE_SCALE, 'USD', 'USD'))).toBe(7_777n);
  });

  it('M1: applies the decimal shift for a 0-decimal → 2-decimal pair (JPY→USD)', () => {
    // 1 USD = 100 JPY → 1 JPY = 0.01 USD → rate = 0.01 → scaled 10_000.
    // ¥15000 must convert to $150.00 = 15000 USD minor, NOT 150 (100× too small).
    expect(BigInt(convertToBase(asMoneyMinor(15_000n), 10_000n, 'JPY', 'USD'))).toBe(15_000n);
    // ¥7500 → $75.00 = 7500 minor.
    expect(BigInt(convertToBase(asMoneyMinor(7_500n), 10_000n, 'JPY', 'USD'))).toBe(7_500n);
  });

  it('M1: applies the decimal shift for a 3-decimal → 2-decimal pair (BHD→USD)', () => {
    // 1 BHD = 2.65 USD → 1 BHD-fil = ... rate major = 2.65 → scaled 2_650_000.
    // 10.000 BHD (10000 fils) = $26.50 = 2650 USD minor, NOT 26500 (10× too big).
    expect(BigInt(convertToBase(asMoneyMinor(10_000n), 2_650_000n, 'BHD', 'USD'))).toBe(2_650n);
  });
});
