import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCardsGrid } from '../summary-cards-grid';

vi.mock('@/components/ui/statistic-card', () => ({
  StatisticCard: ({
    title,
    value,
    icon,
  }: {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
  }) => (
    <div data-testid="statistic-card">
      <span data-testid="card-title">{title}</span>
      <span data-testid="card-value">{value}</span>
      {icon && <span data-testid="card-icon">{icon}</span>}
    </div>
  ),
}));

describe('SummaryCardsGrid', () => {
  it('renders empty grid when no cards provided', () => {
    render(<SummaryCardsGrid cards={[]} />);
    expect(screen.queryByTestId('statistic-card')).not.toBeInTheDocument();
  });

  it('renders cards with correct data', () => {
    const cards = [
      { title: 'Total', value: 100 },
      { title: 'Count', value: '5 items' },
    ];
    render(<SummaryCardsGrid cards={cards} />);

    expect(screen.getAllByTestId('statistic-card')).toHaveLength(2);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('5 items')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<SummaryCardsGrid cards={[{ title: 'A', value: 1 }]} className="custom-grid" />);
    const grid = screen.getByTestId('statistic-card').parentElement;
    expect(grid).toHaveClass('custom-grid');
  });

  it('passes description when provided', () => {
    render(
      <SummaryCardsGrid cards={[{ title: 'Revenue', value: '$500', description: 'Monthly' }]} />
    );
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
  });

  it('passes icon when provided', () => {
    render(<SummaryCardsGrid cards={[{ title: 'Users', value: 10, icon: <span>icon</span> }]} />);
    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('passes valueClassName when provided', () => {
    render(
      <SummaryCardsGrid cards={[{ title: 'Score', value: 95, valueClassName: 'text-green' }]} />
    );
    expect(screen.getByText('Score')).toBeInTheDocument();
  });
});
