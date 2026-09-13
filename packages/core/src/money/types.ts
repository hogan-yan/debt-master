/**
 * Branded minor-unit money. All monetary math is integer bigint in the smallest
 * currency unit (cents for USD, whole yen for JPY, etc.). No floats in the write
 * path — the only float boundary is the frozen exchange rate, captured as an
 * integer-scaled bigint (see convert.ts).
 */

/** ISO 4217 currency code, e.g. "USD". */
export type CurrencyCode = string;

/** Minor units of money, branded so it cannot be confused with a scaled rate. */
export type MoneyMinor = bigint & { readonly __brand: 'MoneyMinor' };

/**
 * Decimal places per currency (minor-unit exponent). Unknown → DEFAULT_DECIMALS.
 *
 * Keep in lockstep with `public.currency_minor_scale` (Supabase migration
 * 20260802180000 / 0021). SQL returns 10^decimals (1 / 100 / 1000); this map
 * stores the exponent. Parity is asserted in money.test.ts.
 */
export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  // 2-decimal (default for most ISO 4217)
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  NZD: 2,
  HKD: 2,
  SGD: 2,
  CHF: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  PLN: 2,
  CNY: 2,
  INR: 2,
  BRL: 2,
  MXN: 2,
  ZAR: 2,
  // 0-decimal
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  // 3-decimal
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export const DEFAULT_DECIMALS = 2;

/**
 * Anything ≤ this (minor units) is treated as zero. Matches web's
 * MONETARY_THRESHOLD (0.01 → 1 minor unit for a 2-decimal currency).
 */
export const MONEY_THRESHOLD_MINOR = 1n;

export interface Money {
  readonly amountMinor: MoneyMinor;
  readonly currency: CurrencyCode;
}

/** Decimal places for a currency code; falls back to DEFAULT_DECIMALS. */
export function currencyDecimals(currency: CurrencyCode): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? DEFAULT_DECIMALS;
}

/**
 * Expected `public.currency_minor_scale` return value (10^decimals).
 * Used by the SQL↔TS parity test so a drift fails CI.
 */
export function currencyMinorScale(currency: CurrencyCode): number {
  return 10 ** currencyDecimals(currency);
}
