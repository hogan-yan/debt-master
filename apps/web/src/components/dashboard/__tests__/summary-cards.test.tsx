import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCards } from '../summary-cards';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => (args?: Record<string, unknown>) =>
        args ? `${String(key)}-${JSON.stringify(args)}` : String(key),
    }
  ),
}));

const defaultDebtOverview = {
  totalDebtOutstanding: 1234.56,
  totalLunches: 42,
  averageLunchCost: 25.5,
  favoriteSpot: { name: 'Pizza Place', visits: 10 },
  lunchParticipationRate: 0.85,
  averageCostPerPerson: 12.75,
};

describe('SummaryCards', () => {
  describe('overview variant (default)', () => {
    it('renders all 4 cards', () => {
      render(<SummaryCards debtOverview={defaultDebtOverview} validDebtorsCount={3} />);

      expect(screen.getByText('dashboard_summary_totalOutstanding')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_totalLunches')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_avgCostPerPerson')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_topRestaurant')).toBeInTheDocument();
    });

    it('shows total outstanding debt formatted', () => {
      render(<SummaryCards debtOverview={defaultDebtOverview} validDebtorsCount={3} />);

      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    });

    it('shows valid debtors count', () => {
      render(<SummaryCards debtOverview={defaultDebtOverview} validDebtorsCount={5} />);

      expect(screen.getByText('dashboard_summary_peopleOweMoney-{"count":5}')).toBeInTheDocument();
    });

    it('shows total lunches count', () => {
      render(<SummaryCards debtOverview={defaultDebtOverview} validDebtorsCount={3} />);

      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('shows average cost per person formatted', () => {
      render(<SummaryCards debtOverview={defaultDebtOverview} validDebtorsCount={3} />);

      expect(screen.getByText('$12.75')).toBeInTheDocument();
    });

    it('shows favorite restaurant name and visits', () => {
      render(<SummaryCards debtOverview={defaultDebtOverview} validDebtorsCount={3} />);

      expect(screen.getByText('Pizza Place')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_visits-{"count":10}')).toBeInTheDocument();
    });
  });

  describe('restaurants variant', () => {
    it('renders restaurants variant cards', () => {
      render(
        <SummaryCards
          debtOverview={defaultDebtOverview}
          validDebtorsCount={3}
          variant="restaurants"
        />
      );

      expect(screen.getByText('dashboard_summary_teamFavorite')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_totalVisits')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_avgCostPerPerson')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_varietyScore')).toBeInTheDocument();
    });

    it('shows team favorite name and visits', () => {
      render(
        <SummaryCards
          debtOverview={defaultDebtOverview}
          validDebtorsCount={3}
          variant="restaurants"
        />
      );

      expect(screen.getByText('Pizza Place')).toBeInTheDocument();
      expect(screen.getByText('dashboard_summary_visits-{"count":10}')).toBeInTheDocument();
    });

    it('shows variety score', () => {
      render(
        <SummaryCards
          debtOverview={defaultDebtOverview}
          validDebtorsCount={3}
          variant="restaurants"
        />
      );

      // variety = min(10, round((42 / 10) * 2)) = min(10, round(8.4)) = min(10, 8) = 8
      expect(screen.getByText('8/10')).toBeInTheDocument();
    });

    it('computes variety score correctly', () => {
      const overview = {
        ...defaultDebtOverview,
        totalLunches: 10,
        favoriteSpot: { name: 'Test Spot', visits: 5 },
      };

      render(<SummaryCards debtOverview={overview} validDebtorsCount={3} variant="restaurants" />);

      // variety = min(10, round((10 / 5) * 2)) = min(10, round(4)) = min(10, 4) = 4
      expect(screen.getByText('4/10')).toBeInTheDocument();
    });

    it('shows zero variety when the favorite spot has no visits', () => {
      const overview = {
        ...defaultDebtOverview,
        favoriteSpot: { name: 'No Visits', visits: 0 },
      };

      render(<SummaryCards debtOverview={overview} validDebtorsCount={3} variant="restaurants" />);

      expect(screen.getByText('0/10')).toBeInTheDocument();
    });
  });
});
