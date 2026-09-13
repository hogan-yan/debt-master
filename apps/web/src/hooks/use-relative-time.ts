import { getLocale } from '@/paraglide/runtime';

const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
  { unit: 'day', ms: 1000 * 60 * 60 * 24 },
  { unit: 'hour', ms: 1000 * 60 * 60 },
  { unit: 'minute', ms: 1000 * 60 },
  { unit: 'second', ms: 1000 },
];

/**
 * Format a date as relative time from now (e.g. "2 days ago").
 */
export function useRelativeTime(date: Date | string): string {
  const locale = getLocale();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  const absDiff = Math.abs(diff);

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const { unit, ms } of units) {
    const value = Math.round(absDiff / ms);
    if (value >= 1) {
      return formatter.format(diff < 0 ? -value : value, unit);
    }
  }

  return formatter.format(0, 'second');
}
