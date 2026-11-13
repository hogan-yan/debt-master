import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseInfoCard } from '../expense-info-card';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
  getSettlementStatusBadge: vi.fn(),
}));

vi.mock('@/components/ui/date-badge', () => ({
  DateWithBadge: ({ dateString }: { dateString: string }) => <div>{dateString}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { getSettlementStatusBadge } from '@/utils/formatters';

const mockedGetBadge = vi.mocked(getSettlementStatusBadge);

describe('ExpenseInfoCard', () => {
  const defaultProps = {
    amount: 42.5,
    date: '2024-06-15T00:00:00Z',
    restaurant: { name: 'Pizza Place' } as const,
  };

  beforeEach(() => {
    mockedGetBadge.mockReturnValue({
      text: 'No participants',
      className: 'text-muted',
      icon: 'Users',
    });
  });

  it('renders restaurant name and amount', () => {
    render(<ExpenseInfoCard {...defaultProps} />);
    expect(screen.getByText('Pizza Place')).toBeInTheDocument();
    expect(screen.getByText('$42.50')).toBeInTheDocument();
  });

  it('shows unknown restaurant when null', () => {
    render(<ExpenseInfoCard {...defaultProps} restaurant={null} />);
    expect(screen.getByText('expense_detail_unknownRestaurant')).toBeInTheDocument();
  });

  it('serializes Date instances for the date badge', () => {
    render(<ExpenseInfoCard {...defaultProps} date={new Date('2024-06-15T00:00:00Z')} />);

    expect(screen.getByText('2024-06-15T00:00:00.000Z')).toBeInTheDocument();
  });

  it('shows restaurant address when present', () => {
    render(
      <ExpenseInfoCard
        {...defaultProps}
        restaurant={{ name: 'Pizza Place', address: '123 Main St' }}
      />
    );
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('hides address when null', () => {
    render(
      <ExpenseInfoCard {...defaultProps} restaurant={{ name: 'Pizza Place', address: null }} />
    );
    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
  });

  it('shows notes when provided', () => {
    render(<ExpenseInfoCard {...defaultProps} notes="Team lunch" />);
    expect(screen.getByText('Team lunch')).toBeInTheDocument();
  });

  it('hides notes when null', () => {
    render(<ExpenseInfoCard {...defaultProps} notes={null} />);
    expect(screen.queryByText('Team lunch')).not.toBeInTheDocument();
  });

  it('shows settlement status (all paid = CheckCircle)', () => {
    mockedGetBadge.mockReturnValue({
      text: 'Paid',
      className: 'text-success',
      icon: 'CheckCircle',
    });
    render(<ExpenseInfoCard {...defaultProps} />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows settlement status (none paid = Clock)', () => {
    mockedGetBadge.mockReturnValue({
      text: 'Unpaid',
      className: 'text-destructive-text',
      icon: 'Clock',
    });
    render(<ExpenseInfoCard {...defaultProps} />);
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
  });

  it('shows settlement status (no participants = Users)', () => {
    mockedGetBadge.mockReturnValue({
      text: 'No participants',
      className: 'text-muted',
      icon: 'Users',
    });
    render(<ExpenseInfoCard {...defaultProps} />);
    expect(screen.getByText('No participants')).toBeInTheDocument();
  });

  it('shows date', () => {
    render(<ExpenseInfoCard {...defaultProps} />);
    expect(screen.getByText('2024-06-15T00:00:00Z')).toBeInTheDocument();
  });
});
