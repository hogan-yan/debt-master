/**
 * Ledger date helpers.
 *
 * Expense/payment dates are date-only values (Prisma @db.Date). They arrive
 * serialized either as "YYYY-MM-DD" or as a UTC-midnight ISO string, and
 * `new Date(...)` parses both to a UTC instant — which shifts the calendar day
 * for anyone outside UTC and made today's rows render as "in 1 day". These
 * helpers normalize date-only values to the viewer's local calendar before
 * any comparison or formatting.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Parse a ledger date string ("YYYY-MM-DD" or ISO instant) as a local
 * calendar date. The y-m-d prefix wins over any time/offset suffix, so a
 * stored UTC midnight renders as the same calendar day worldwide.
 */
export function parseLedgerDate(value: string): Date {
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value
      .slice(0, 10)
      .split('-')
      .map((part) => Number.parseInt(part, 10));
    if (year === undefined || month === undefined || day === undefined) {
      return new Date(value);
    }
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

/** Local midnight of the given date. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole calendar days between a date and today in the viewer's timezone.
 * Today → 0, yesterday → 1, tomorrow → -1.
 */
export function calendarDaysFromToday(date: Date): number {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  return Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Today's date as a local "YYYY-MM-DD" string — the value an
 * `<input type="date">` expects and the user actually means by "today".
 */
export function todayLocalDateOnly(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
