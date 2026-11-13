/**
 * Display formatting for money. Locale (how digits/grouping look) and currency
 * (which unit) stay decoupled — see AGENTS.md. USD always renders as plain `$`
 * (never locale-prefixed `US$`).
 *
 * All monetary math stays in MoneyMinor; this is the read-only display boundary.
 */
import { toDecimalString } from './parse';
import { type CurrencyCode, currencyDecimals, type MoneyMinor } from './types';

/** Fixed display locale so currency symbols stay consistent across device locales. */
const DISPLAY_LOCALE = 'en-US';

/**
 * Intl.NumberFormat construction is the hot path (called once per FlashList
 * row); cache by `locale|code|decimals`. Locale is in the key so a future
 * per-user locale won't serve stale formatters — today locale is fixed, but
 * keying on it costs nothing and removes the footgun.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

export function getCurrencyFormatter(
  locale: string,
  code: string,
  decimals: number
): Intl.NumberFormat {
  const cacheKey = `${locale}|${code}|${decimals}`;
  const cached = formatterCache.get(cacheKey);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    currencyDisplay: 'symbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

/**
 * Some runtimes emit `US$` for USD; AGENTS.md wants plain `$`. Pure + exported so
 * the rewrite is directly testable — the en-US test runtime already emits `$`,
 * so without this seam the guard's branch + regex could never be exercised and
 * every mutation to it would survive. Only a LEADING `US$` (optionally after a
 * minus) is rewritten; the symbol can't appear mid-string in Intl output.
 */
export function normalizeUsdSymbol(formatted: string, code: string): string {
  return code === 'USD' ? formatted.replace(/^(-?)US\$/, '$1$') : formatted;
}

export interface FormatCurrencyOptions {
  /**
   * When true, positive amounts get a leading `+` (group nets). Negatives keep
   * the minus from the formatter. Zero is unsigned.
   */
  signed?: boolean;
}

/**
 * Format minor units for UI. Prefer this over composing `toDecimalString` +
 * currency code ad-hoc — keeps `$` vs `US$` and symbol placement consistent.
 */
export function formatCurrency(
  minor: MoneyMinor,
  currency: CurrencyCode,
  options: FormatCurrencyOptions = {}
): string {
  // Stryker disable next-line MethodExpression: toUpperCase is defensive
  // normalization — output-equivalent here because Node's Intl accepts lowercase
  // currency codes and currencyDecimals() uppercases internally, so behavior is
  // identical with/without it. Kept for stricter runtimes that reject lowercase.
  const code = currency.toUpperCase();
  const decimals = currencyDecimals(code);
  const asNumber = Number(minor) / 10 ** decimals;

  const normalized = normalizeUsdSymbol(
    getCurrencyFormatter(DISPLAY_LOCALE, code, decimals).format(asNumber),
    code
  );

  if (options.signed && minor > 0n) {
    return `+${normalized}`;
  }
  return normalized;
}

/**
 * Format a major-unit decimal (e.g. paywall list prices) without going through
 * MoneyMinor. Prefer `formatCurrency` for DB/balance amounts.
 */
export function formatMajorCurrency(amount: number, currency: CurrencyCode): string {
  // Stryker disable next-line MethodExpression: toUpperCase is defensive
  // normalization — output-equivalent here because Node's Intl accepts lowercase
  // currency codes and currencyDecimals() uppercases internally, so behavior is
  // identical with/without it. Kept for stricter runtimes that reject lowercase.
  const code = currency.toUpperCase();
  const decimals = currencyDecimals(code);
  return normalizeUsdSymbol(
    getCurrencyFormatter(DISPLAY_LOCALE, code, decimals).format(amount),
    code
  );
}

/**
 * Absolute amount string without currency identity — use only when the currency
 * is already shown nearby (e.g. "Your balance · USD" header). Prefer
 * `formatCurrency` when the amount must stand alone.
 */
export function formatAmountOnly(minor: MoneyMinor, currency: CurrencyCode): string {
  return toDecimalString(minor, currency);
}
