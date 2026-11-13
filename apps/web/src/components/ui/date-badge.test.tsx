import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompactDateBadge, CompactDateWithBadge, DateBadge, DateWithBadge } from './date-badge';

const mockGetDateBadgeInfo = vi.hoisted(() => vi.fn());

vi.mock('@/utils/formatters', () => ({
  getDateBadgeInfo: mockGetDateBadgeInfo,
}));

beforeEach(() => {
  mockGetDateBadgeInfo.mockImplementation((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return {
        relativeText: 'Today',
        actualDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        variant: 'today' as const,
        icon: 'Clock' as const,
      };
    }
    if (diffDays === 1) {
      return {
        relativeText: 'Yesterday',
        actualDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        variant: 'recent' as const,
        icon: 'Clock' as const,
      };
    }
    if (diffDays < 7) {
      return {
        relativeText: `${diffDays} days ago`,
        actualDate: date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        }),
        variant: 'thisWeek' as const,
        icon: 'Calendar' as const,
      };
    }
    return {
      relativeText: `${diffDays} days ago`,
      actualDate: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      variant: 'older' as const,
      icon: 'Calendar' as const,
    };
  });
});

describe('DateWithBadge', () => {
  it('renders dash when dateString is undefined', () => {
    render(<DateWithBadge dateString={undefined} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders date for today', () => {
    const today = new Date();
    render(<DateWithBadge dateString={today.toISOString()} />);
    const mainDate = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(today);
    expect(screen.getByText(mainDate)).toBeInTheDocument();
  });

  it('uses the actual date as the this-week badge', () => {
    mockGetDateBadgeInfo.mockReturnValue({
      relativeText: '3 days ago',
      actualDate: 'Tuesday',
      variant: 'thisWeek',
      icon: 'Calendar',
    });
    render(<DateWithBadge dateString="2026-07-15T12:00:00.000Z" />);
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
  });

  it('hides a badge that duplicates the formatted date', () => {
    mockGetDateBadgeInfo.mockReturnValue({
      relativeText: 'Jan 1',
      actualDate: 'Jan 1',
      variant: 'older',
      icon: 'Calendar',
    });
    render(<DateWithBadge dateString="2026-01-01T12:00:00.000Z" />);
    expect(screen.getAllByText('Jan 1')).toHaveLength(1);
  });
});

describe('CompactDateWithBadge', () => {
  it('renders dash when dateString is undefined', () => {
    render(<CompactDateWithBadge dateString={undefined} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders compact date for older date', () => {
    const date = new Date();
    date.setDate(date.getDate() - 10);
    render(<CompactDateWithBadge dateString={date.toISOString()} />);
    expect(screen.getByText('10 days ago')).toBeInTheDocument();
  });

  it('uses the actual date badge for this-week dates', () => {
    mockGetDateBadgeInfo.mockReturnValue({
      relativeText: '3 days ago',
      actualDate: 'Tuesday',
      variant: 'thisWeek',
      icon: 'Calendar',
    });
    render(<CompactDateWithBadge dateString="2026-07-15T12:00:00.000Z" />);
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
  });
});

describe('DateBadge', () => {
  it('renders dash when dateString is undefined', () => {
    render(<DateBadge dateString={undefined} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders badge with relative time for today', () => {
    const today = new Date();
    render(<DateBadge dateString={today.toISOString()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders calendar icon for older dates', () => {
    const date = new Date();
    date.setDate(date.getDate() - 10);
    const { container } = render(<DateBadge dateString={date.toISOString()} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('CompactDateBadge', () => {
  it('renders dash when dateString is undefined', () => {
    render(<CompactDateBadge dateString={undefined} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders compact relative time', () => {
    const today = new Date();
    render(<CompactDateBadge dateString={today.toISOString()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
