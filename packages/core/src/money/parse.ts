import { type CurrencyCode, currencyDecimals, type MoneyMinor } from './types';

/**
 * The single sanctioned cast boundary for MoneyMinor. Per the AGENTS.md
 * brand-type pattern, brand construction is the endorsed exception to the
 * no-cast rule — all MoneyMinor values originate here.
 */
export function asMoneyMinor(value: bigint): MoneyMinor {
  return value as MoneyMinor;
}

const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;

/** Parse a decimal string ("100.00") into minor units for the given currency. */
export function fromDecimal(decimal: string, currency: CurrencyCode): MoneyMinor {
  const normalized = decimal.trim();
  if (!DECIMAL_RE.test(normalized)) {
    throw new RangeError(`Invalid decimal money value: ${decimal}`);
  }
  const decimals = currencyDecimals(currency);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = '0', frac = ''] = unsigned.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const minor = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
  return asMoneyMinor(negative ? -minor : minor);
}

/** Format minor units as a decimal string ("100.00") for the given currency. */
export function toDecimalString(minor: MoneyMinor, currency: CurrencyCode): string {
  const decimals = currencyDecimals(currency);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const sign = negative ? '-' : '';

  if (decimals === 0) {
    return `${sign}${abs.toString()}`;
  }
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const frac = (abs % divisor).toString().padStart(decimals, '0');
  return `${sign}${whole.toString()}.${frac}`;
}
