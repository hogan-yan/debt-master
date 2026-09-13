import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { ExpenseParticipantWithColleague } from '@/types';

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  'zh-tw': 'zh-TW',
  ja: 'ja-JP',
};

const localeToIntl = (locale: string): string => LOCALE_MAP[locale] ?? locale;

// Status pills are the deliberate badge treatment app-wide, mirroring
// BADGE_* in styles/class-constants.ts. unslop-ignore
const PILL_LEADING = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full'; // unslop-ignore
const PILL_INLINE = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium'; // unslop-ignore

const intlLocale = (): string => localeToIntl(getLocale());

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatterCache.set(key, formatter);
  }
  return formatter;
}

const formatRelativeTime = (
  locale: string,
  diff: number,
  unit: Intl.RelativeTimeFormatUnit
): string => {
  // `diff` is expected to be a positive integer representing time in the past.
  if (unit === 'day') {
    if (diff === 0) return m.date_today();
    if (diff === 1) return m.date_yesterday();
  }

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  return formatter.format(-diff, unit);
};

const formatCompactMonthDay = (locale: string, date: Date, includeYear: boolean): string => {
  if (includeYear) {
    return getDateFormatter(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      date
    );
  }
  return getDateFormatter(locale, { month: 'short', day: 'numeric' }).format(date);
};

const formatShortWeekday = (locale: string, date: Date): string =>
  getDateFormatter(locale, { weekday: 'short' }).format(date);

/**
 * Formatting utilities for the debt-master application
 */

/**
 * Formats a number as currency.
 *
 * Locale (how we format) and currency (what unit) are intentionally decoupled.
 * For now we force a single display style for currency across the app to keep UI consistent.
 * In the future this can be driven by user/org settings by passing overrides.
 */
type CurrencyFormatOverrides = Readonly<{
  locale?: string;
  currencyCode?: string;
  currencyDisplay?: Intl.NumberFormatOptions['currencyDisplay'];
}>;

const DEFAULT_CURRENCY_CODE = 'USD' as const;
const DEFAULT_CURRENCY_LOCALE = 'en-US' as const;
const DEFAULT_CURRENCY_DISPLAY: Intl.NumberFormatOptions['currencyDisplay'] = 'symbol';

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(
  locale: string,
  currencyCode: string,
  currencyDisplay: Intl.NumberFormatOptions['currencyDisplay']
): Intl.NumberFormat {
  const key = `${locale}|${currencyCode}|${currencyDisplay}`;
  let formatter = currencyFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay,
    });
    currencyFormatterCache.set(key, formatter);
  }
  return formatter;
}

export const formatCurrency = (amount: number, overrides?: CurrencyFormatOverrides): string => {
  const locale = overrides?.locale ?? DEFAULT_CURRENCY_LOCALE;
  const currencyCode = overrides?.currencyCode ?? DEFAULT_CURRENCY_CODE;
  const currencyDisplay = overrides?.currencyDisplay ?? DEFAULT_CURRENCY_DISPLAY;

  return getCurrencyFormatter(locale, currencyCode, currencyDisplay).format(amount);
};

/**
 * Formats a date string for display
 */
export const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return getDateFormatter(intlLocale(), { year: 'numeric', month: 'short', day: 'numeric' }).format(
    date
  );
};

/**
 * Returns structured date information for use with DateBadge component
 * Provides relative text, actual date, and visual styling information
 */
export const getDateBadgeInfo = (
  dateString: string
): {
  relativeText: string;
  actualDate: string;
  variant: 'today' | 'yesterday' | 'thisWeek' | 'recent' | 'old';
  icon?: string;
} => {
  const date = new Date(dateString);
  const now = new Date();
  const locale = intlLocale();

  // Calculate days difference
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const currentYear = now.getFullYear();
  const dateYear = date.getFullYear();
  const needsYear = dateYear !== currentYear;

  // Return structured data based on recency
  if (diffDays === 0) {
    return {
      relativeText: formatRelativeTime(locale, 0, 'day'),
      actualDate: formatCompactMonthDay(locale, date, false),
      variant: 'today',
      icon: 'Calendar',
    };
  }
  if (diffDays === 1) {
    return {
      relativeText: formatRelativeTime(locale, 1, 'day'),
      actualDate: formatCompactMonthDay(locale, date, false),
      variant: 'yesterday',
      icon: 'Clock',
    };
  }
  if (diffDays <= 6) {
    return {
      relativeText: formatShortWeekday(locale, date),
      actualDate: formatRelativeTime(locale, diffDays, 'day'),
      variant: 'thisWeek',
      icon: 'Calendar',
    };
  }
  if (diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7);
    return {
      relativeText: formatRelativeTime(locale, weeks, 'week'),
      actualDate: formatCompactMonthDay(locale, date, false),
      variant: 'recent',
      icon: 'Clock',
    };
  }
  return {
    relativeText: formatCompactMonthDay(locale, date, needsYear),
    actualDate:
      diffDays <= 120 ? formatRelativeTime(locale, Math.floor(diffDays / 30), 'month') : '',
    variant: 'old',
    icon: 'Calendar',
  };
};

/**
 * Formats a date with both relative time and actual date for optimal UX
 * Shows relative time for context + actual date for precision
 * Examples: "Today (May 30)", "3 days ago (May 27)", "Dec 18"
 */
export const formatDateWithRelative = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const locale = intlLocale();

  // Calculate days difference
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const currentYear = now.getFullYear();
  const dateYear = date.getFullYear();
  const needsYear = dateYear !== currentYear;

  // Format based on recency
  if (diffDays === 0) {
    return `${formatRelativeTime(locale, 0, 'day')} (${formatCompactMonthDay(locale, date, false)})`;
  }
  if (diffDays === 1) {
    return `${formatRelativeTime(locale, 1, 'day')} (${formatCompactMonthDay(locale, date, false)})`;
  }
  if (diffDays <= 6) {
    return `${formatShortWeekday(locale, date)} (${formatRelativeTime(locale, diffDays, 'day')})`;
  }
  if (diffDays <= 13) {
    const weeks = Math.floor(diffDays / 7);
    const weeksText = formatRelativeTime(locale, weeks, 'week');
    return `${weeksText} (${formatCompactMonthDay(locale, date, false)})`;
  }
  if (diffDays <= 45) {
    const weeks = Math.floor(diffDays / 7);
    const weeksText = formatRelativeTime(locale, weeks, 'week');
    return `${weeksText} (${formatCompactMonthDay(locale, date, false)})`;
  }
  if (diffDays <= 120) {
    const months = Math.floor(diffDays / 30);
    const monthsText = formatRelativeTime(locale, months, 'month');
    return `${monthsText} (${formatCompactMonthDay(locale, date, needsYear)})`;
  }
  // For older dates, just show the date (with year if different)
  return formatCompactMonthDay(locale, date, needsYear);
};

/**
 * Formats a date string or "YYYY-MM" string as month + year (e.g. "Jan 2026")
 */
export const formatMonthYear = (input: string): string => {
  const isYearMonth = /^\d{4}-\d{2}$/.test(input);
  const date = isYearMonth ? new Date(`${input}-01`) : new Date(input);
  return getDateFormatter(intlLocale(), { month: 'short', year: 'numeric' }).format(date);
};

/**
 * Gets the appropriate color class for balance display
 */
export const getBalanceColor = (balance: number): string => {
  if (balance < 0) return 'text-destructive-text';
  if (balance > 0) return 'text-success';
  return 'text-muted-foreground';
};

/**
 * Gets the status badge configuration for a balance
 */
export const getBalanceStatus = (
  balance: number
): {
  text: string;
  className: string;
} => {
  if (balance < 0) {
    return {
      text: m.colleague_status_owes(),
      className: `${PILL_LEADING} bg-destructive/10 text-destructive-text`,
    };
  }
  if (balance > 0) {
    return {
      text: m.colleague_status_credit(),
      className: `${PILL_LEADING} bg-success/10 text-success`,
    };
  }
  return {
    text: m.colleague_status_balanced(),
    className: `${PILL_LEADING} bg-muted text-muted-foreground`,
  };
};

/**
 * Gets badge configuration for split type
 */
export const getSplitTypeBadge = (
  splitType: string
): {
  text: string;
  className: string;
  icon: string; // Icon name for the badge
} => {
  if (splitType === 'EQUAL') {
    return {
      text: m.split_badge_equal(),
      className: `${PILL_INLINE} bg-info/10 text-info`,
      icon: 'Users',
    };
  }
  return {
    text: m.split_badge_itemized(),
    className: `${PILL_INLINE} bg-muted text-muted-foreground`,
    icon: 'List',
  };
};

/**
 * Gets settlement status badge configuration for an expense
 */
export const getSettlementStatusBadge = (
  participants: Array<
    ExpenseParticipantWithColleague | { expenseId?: number; [key: string]: unknown }
  >
): {
  text: string;
  className: string;
  icon: string;
} => {
  if (!participants || participants.length === 0) {
    return {
      text: m.expense_settlement_noParticipants(),
      className: `${PILL_INLINE} bg-muted text-muted-foreground`,
      icon: 'Users',
    };
  }

  const totalParticipants = participants.length;
  const paidParticipants = participants.filter((p) => p.isPaid).length;

  if (paidParticipants === totalParticipants) {
    return {
      text: m.expense_status_paid(),
      className: `${PILL_INLINE} bg-success/10 text-success`,
      icon: 'CheckCircle',
    };
  }

  if (paidParticipants === 0) {
    return {
      text: m.expense_status_unpaid(),
      className: `${PILL_INLINE} bg-destructive/10 text-destructive-text`,
      icon: 'Clock',
    };
  }

  return {
    text: m.expense_status_partial({
      paid: String(paidParticipants),
      total: String(totalParticipants),
    }),
    className: `${PILL_INLINE} bg-warning/10 text-warning`,
    icon: 'Clock',
  };
};

type ExpenseStatusInput = {
  participants?: Array<{
    isPaid: boolean;
    isPending: boolean;
    submittedAt?: Date | string | null;
  }> | null;
};

/**
 * Get expense-level payment status badge with pending claim awareness
 */
export const getExpenseStatusBadge = (
  expense: ExpenseStatusInput
): {
  text: string;
  className: string;
  icon: string;
} => {
  const participants = expense.participants;

  if (!participants || participants.length === 0) {
    return {
      text: m.expense_settlement_noParticipants(),
      className: `${PILL_INLINE} bg-muted text-muted-foreground`,
      icon: 'Users',
    };
  }

  const paidCount = participants.filter((p) => p.isPaid).length;
  const pendingCount = participants.filter(
    (p) => p.isPending || (!p.isPaid && p.submittedAt)
  ).length;
  const totalCount = participants.length;

  if (paidCount === totalCount) {
    return {
      text: m.expense_status_paid(),
      className: `${PILL_INLINE} bg-success/15 text-success border-success/20`,
      icon: 'CheckCircle',
    };
  }

  if (paidCount > 0 || pendingCount > 0) {
    return {
      text: m.expense_status_partial({ paid: String(paidCount), total: String(totalCount) }),
      className: `${PILL_INLINE} bg-warning/15 text-warning border-warning/20`,
      icon: 'Clock',
    };
  }

  return {
    text: m.expense_status_unpaid(),
    className: `${PILL_INLINE} bg-destructive/15 text-destructive-text border-destructive/20`,
    icon: 'AlertCircle',
  };
};
