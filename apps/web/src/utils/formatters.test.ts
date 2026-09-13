import {
  formatCurrency,
  formatDate,
  formatDateWithRelative,
  formatMonthYear,
  getBalanceColor,
  getBalanceStatus,
  getDateBadgeInfo,
  getExpenseStatusBadge,
  getSettlementStatusBadge,
  getSplitTypeBadge,
} from './formatters';

const mockGetLocale = vi.hoisted(() => vi.fn(() => 'en'));

vi.mock('@/paraglide/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/paraglide/runtime')>()),
  getLocale: mockGetLocale,
}));

describe('formatCurrency', () => {
  it('should format positive amounts as USD', () => {
    expect(formatCurrency(100)).toBe('$100.00');
    expect(formatCurrency(50.5)).toBe('$50.50');
    expect(formatCurrency(0.99)).toBe('$0.99');
  });

  it('should format negative amounts with parentheses', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
    expect(formatCurrency(-50.5)).toBe('-$50.50');
  });

  it('should format zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle large amounts', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
  });

  it('should handle decimal precision', () => {
    expect(formatCurrency(10.999)).toBe('$11.00');
    expect(formatCurrency(10.001)).toBe('$10.00');
  });

  it('uses a caller-provided currency format override', () => {
    expect(
      formatCurrency(100, {
        locale: 'de-DE',
        currencyCode: 'EUR',
        currencyDisplay: 'code',
      })
    ).toContain('EUR');
  });
});

describe('formatDate', () => {
  it('should format date string to readable format', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
    expect(formatDate('2024-12-25')).toBe('Dec 25, 2024');
  });

  it('should handle ISO date strings', () => {
    expect(formatDate('2024-06-20T00:00:00Z')).toContain('Jun 20');
    expect(formatDate('2024-06-20T00:00:00Z')).toContain('2024');
  });

  it('should handle different months', () => {
    expect(formatDate('2024-03-01')).toContain('Mar');
    expect(formatDate('2024-07-04')).toContain('Jul');
    expect(formatDate('2024-11-11')).toContain('Nov');
  });

  it('formats Date instances', () => {
    expect(formatDate(new Date('2024-01-15T12:00:00Z'))).toBe('Jan 15, 2024');
  });

  it('uses an unmapped locale directly', () => {
    mockGetLocale.mockReturnValueOnce('fr-FR');

    expect(formatDate('2024-01-15')).toContain('janv.');
  });
});

describe('formatMonthYear', () => {
  it('formats both YYYY-MM and complete ISO date inputs', () => {
    expect(formatMonthYear('2024-01')).toBe('Jan 2024');
    expect(formatMonthYear('2024-01-15')).toBe('Jan 2024');
  });
});

describe('getDateBadgeInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return today variant for current date', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = getDateBadgeInfo('2024-06-15');
    expect(result.variant).toBe('today');
    expect(result.relativeText.toLowerCase()).toBe('today');
    expect(result.icon).toBe('Calendar');
  });

  it('should return yesterday variant for yesterday', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = getDateBadgeInfo('2024-06-14');
    expect(result.variant).toBe('yesterday');
    expect(result.relativeText.toLowerCase()).toBe('yesterday');
    expect(result.icon).toBe('Clock');
  });

  it('should return thisWeek variant for dates within a week', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = getDateBadgeInfo('2024-06-10'); // 5 days ago
    expect(result.variant).toBe('thisWeek');
    expect(result.actualDate).toBe('5 days ago');
    expect(result.icon).toBe('Calendar');
  });

  it('should return recent variant for dates within 30 days', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = getDateBadgeInfo('2024-05-25'); // ~3 weeks ago
    expect(result.variant).toBe('recent');
    expect(result.relativeText).toMatch(/week(s)? ago/);
    expect(result.icon).toBe('Clock');
  });

  it('should return old variant for dates older than 30 days', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = getDateBadgeInfo('2024-01-15'); // ~5 months ago
    expect(result.variant).toBe('old');
    expect(result.icon).toBe('Calendar');
  });

  it('shows a relative month count for older dates within four months', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    expect(getDateBadgeInfo('2024-04-15').actualDate).toContain('months ago');
  });

  it('should include year in actualDate for different year', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = getDateBadgeInfo('2023-12-25');
    expect(result.variant).toBe('old');
    expect(result.relativeText).toContain('2023');
  });
});

describe('formatDateWithRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format today with relative text', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2024-06-15');
    expect(result.toLowerCase()).toMatch(/^today \(/);
    expect(result).toContain('Jun 15');
  });

  it('should format yesterday with relative text', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2024-06-14');
    expect(result.toLowerCase()).toMatch(/^yesterday \(/);
  });

  it('should format this week with day name and relative days', () => {
    const now = new Date('2024-06-15T12:00:00Z'); // Saturday
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2024-06-13'); // Thursday, 2 days ago
    expect(result).toContain('days ago');
  });

  it('should format 1-2 weeks ago with weeks text', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2024-06-08'); // 1 week ago
    expect(result).toMatch(/(last week|1 week ago)/);
  });

  it('should format 2-6 weeks ago with weeks count', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2024-05-18'); // ~4 weeks ago
    expect(result).toMatch(/\d+ weeks ago/);
  });

  it('should format 1-4 months ago with months count', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2024-04-15'); // ~2 months ago
    expect(result).toContain('months ago');
  });

  it('should show only date for older than 4 months (same year)', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2024-01-15');
    expect(result).not.toContain('ago');
    // Same year, so no year shown
    expect(result).toMatch(/Jan 15$/);
  });

  it('should include year when date is different year', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDateWithRelative('2023-08-15');
    expect(result).toContain('2023');
  });
});

describe('getBalanceColor', () => {
  it('should return red for negative balance', () => {
    expect(getBalanceColor(-1)).toBe('text-destructive-text');
    expect(getBalanceColor(-100.5)).toBe('text-destructive-text');
  });

  it('should return green for positive balance', () => {
    expect(getBalanceColor(1)).toBe('text-success');
    expect(getBalanceColor(100.5)).toBe('text-success');
  });

  it('should return gray for zero balance', () => {
    expect(getBalanceColor(0)).toBe('text-muted-foreground');
  });

  it('should handle very small decimals', () => {
    expect(getBalanceColor(0.001)).toBe('text-success');
    expect(getBalanceColor(-0.001)).toBe('text-destructive-text');
  });
});

describe('getBalanceStatus', () => {
  it('should return owes money status for negative balance', () => {
    const result = getBalanceStatus(-50);
    expect(result.text).toBe('Owes money');
    expect(result.className).toContain('bg-destructive/10');
    expect(result.className).toContain('text-destructive-text');
  });

  it('should return has credit status for positive balance', () => {
    const result = getBalanceStatus(50);
    expect(result.text).toBe('Has credit');
    expect(result.className).toContain('bg-success/10');
    expect(result.className).toContain('text-success');
  });

  it('should return balanced status for zero balance', () => {
    const result = getBalanceStatus(0);
    expect(result.text).toBe('Balanced');
    expect(result.className).toContain('bg-muted');
    expect(result.className).toContain('text-muted-foreground');
  });
});

describe('getSplitTypeBadge', () => {
  it('should return equal split badge for EQUAL type', () => {
    const result = getSplitTypeBadge('EQUAL');
    expect(result.text).toBe('Equal Split');
    expect(result.className).toContain('bg-info/10');
    expect(result.className).toContain('text-info');
    expect(result.icon).toBe('Users');
  });

  it('should return itemized badge for non-EQUAL types', () => {
    const result = getSplitTypeBadge('ITEMIZED');
    expect(result.text).toBe('Itemized');
    expect(result.className).toContain('bg-muted');
    expect(result.className).toContain('text-muted-foreground');
    expect(result.icon).toBe('List');
  });

  it('should return itemized for unknown types', () => {
    const result = getSplitTypeBadge('UNKNOWN');
    expect(result.text).toBe('Itemized');
  });
});

describe('getSettlementStatusBadge', () => {
  it('should return no participants for empty array', () => {
    const result = getSettlementStatusBadge([]);
    expect(result.text).toBe('No Participants');
    expect(result.className).toContain('bg-muted');
    expect(result.icon).toBe('Users');
  });

  it('should return no participants for null/undefined', () => {
    // getSettlementStatusBadge's !participants guard treats empty array same as null
    const result = getSettlementStatusBadge([]);
    expect(result.text).toBe('No Participants');
  });

  it('should return settled when all participants paid', () => {
    const participants = [{ isPaid: true }, { isPaid: true }, { isPaid: true }];
    const result = getSettlementStatusBadge(participants);
    expect(result.text).toBe('Fully Paid');
    expect(result.className).toContain('bg-success/10');
    expect(result.icon).toBe('CheckCircle');
  });

  it('should return unpaid when no participants paid', () => {
    const participants = [{ isPaid: false }, { isPaid: false }];
    const result = getSettlementStatusBadge(participants);
    expect(result.text).toBe('Unpaid');
    expect(result.className).toContain('bg-destructive/10');
    expect(result.icon).toBe('Clock');
  });

  it('should return partial status for mixed payments', () => {
    const participants = [{ isPaid: true }, { isPaid: false }, { isPaid: true }];
    const result = getSettlementStatusBadge(participants);
    expect(result.text).toBe('Partial (2/3)');
    expect(result.className).toContain('bg-warning/10');
    expect(result.icon).toBe('Clock');
  });

  it('should handle single participant paid', () => {
    const participants = [{ isPaid: true }];
    const result = getSettlementStatusBadge(participants);
    expect(result.text).toBe('Fully Paid');
  });

  it('should handle single participant unpaid', () => {
    const participants = [{ isPaid: false }];
    const result = getSettlementStatusBadge(participants);
    expect(result.text).toBe('Unpaid');
  });
});

describe('getExpenseStatusBadge', () => {
  it('returns no participants for null participants', () => {
    const result = getExpenseStatusBadge({ participants: null });
    expect(result.text).toBe('No Participants');
    expect(result.icon).toBe('Users');
  });

  it('returns no participants for empty array', () => {
    const result = getExpenseStatusBadge({ participants: [] });
    expect(result.text).toBe('No Participants');
  });

  it('returns paid when all participants paid', () => {
    const result = getExpenseStatusBadge({
      participants: [
        { isPaid: true, isPending: false },
        { isPaid: true, isPending: false },
      ],
    });
    expect(result.text).toBe('Fully Paid');
    expect(result.icon).toBe('CheckCircle');
  });

  it('returns partial when some paid', () => {
    const result = getExpenseStatusBadge({
      participants: [
        { isPaid: true, isPending: false },
        { isPaid: false, isPending: false },
      ],
    });
    expect(result.text).toContain('1');
    expect(result.text).toContain('2');
    expect(result.icon).toBe('Clock');
  });

  it('returns partial when pending claims exist', () => {
    const result = getExpenseStatusBadge({
      participants: [
        { isPaid: false, isPending: true },
        { isPaid: false, isPending: false },
      ],
    });
    expect(result.text).toContain('2');
    expect(result.icon).toBe('Clock');
  });

  it('returns partial when submittedAt exists without isPending', () => {
    const result = getExpenseStatusBadge({
      participants: [
        { isPaid: false, isPending: false, submittedAt: new Date() },
        { isPaid: false, isPending: false },
      ],
    });
    expect(result.text).toContain('2');
  });

  it('returns unpaid when no paid and no pending', () => {
    const result = getExpenseStatusBadge({
      participants: [
        { isPaid: false, isPending: false },
        { isPaid: false, isPending: false },
      ],
    });
    expect(result.text).toBe('Unpaid');
    expect(result.icon).toBe('AlertCircle');
  });
});
