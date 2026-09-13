import { asMoneyMinor } from './parse';
import { type CurrencyCode, currencyDecimals, type MoneyMinor } from './types';

/** Scale for integer exchange rates: rate = rateScaled / RATE_SCALE. */
export const RATE_SCALE = 1_000_000n;

/** A frozen exchange rate, integer-scaled by RATE_SCALE. */
export type RateScaled = bigint;

/**
 * Convert a float rate (e.g. 1.0834) to a scaled bigint (1_083_400). Rounds to
 * the nearest whole minor unit at scale 1e6. Rejects non-finite / non-positive
 * rates — a rate must always be a positive multiplier.
 */
export function rateToScaled(rate: number): RateScaled {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`Invalid exchange rate: ${rate}`);
  }
  return BigInt(Math.round(rate * 1e6));
}

/**
 * Convert an amount from one currency into another using a frozen scaled rate.
 *
 * `rate` is a MAJOR-unit ratio (base-major per from-major) scaled by RATE_SCALE,
 * and `amount`/the result are MINOR units. Minor-unit counts differ per currency
 * (USD = 2 decimals → cents, JPY = 0 → whole yen, BHD = 3 → fils), so the decimal
 * shift `10^(decimals(to) − decimals(from))` MUST be folded in — otherwise a
 * JPY→USD conversion lands 100× too small (a ¥15000 dinner as ~$1.50).
 *
 * base_minor = (amount_minor × rate × 10^decimals(to)) / (10^decimals(from) × RATE_SCALE)
 *
 * Split by sign of the shift to keep every intermediate an integer (no float) and
 * bounded well within bigint range for realistic amounts. BigInt `/` truncates
 * toward zero; amounts are non-negative so that is floor. The sub-minar remainder
 * is dropped (settlement rolls these up across the group).
 */
export function convertToBase(
  amount: MoneyMinor,
  rate: RateScaled,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): MoneyMinor {
  const shift = BigInt(currencyDecimals(toCurrency) - currencyDecimals(fromCurrency));
  if (shift >= 0n) {
    return asMoneyMinor((amount * rate * 10n ** shift) / RATE_SCALE);
  }
  return asMoneyMinor((amount * rate) / (RATE_SCALE * 10n ** -shift));
}
