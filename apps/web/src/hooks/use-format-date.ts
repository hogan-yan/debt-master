import { getLocale } from '@/paraglide/runtime';

const defaultOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

/**
 * Format a date with locale-aware display.
 *
 * Defaults to "short" month + numeric day + full year.
 * Pass custom options for time, weekday, etc.
 */
export function useFormatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = defaultOptions
): string {
  const locale = getLocale();
  const d = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, options).format(d);
}
