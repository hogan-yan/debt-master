import { getLocale } from '@/paraglide/runtime';

/**
 * Format a monetary amount with locale-aware currency display.
 *
 * Currency code is stored per-expense in the database (USD, TWD, JPY)
 * and passed explicitly — never inferred from the user's locale.
 */
export function useFormatCurrency(amount: number, currencyCode: string): string {
  const locale = getLocale();

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}
