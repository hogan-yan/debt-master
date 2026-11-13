import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RestaurantsTab } from '../restaurants-tab';

vi.mock('../summary-cards', () => ({
  SummaryCards: ({ variant }: { variant: string }) => <div>summary-{variant}</div>,
}));

vi.mock('../restaurant-charts', () => ({
  RestaurantCharts: ({
    restaurantChartData,
  }: {
    restaurantChartData: { totalRestaurants: number };
  }) => <div>restaurants-{restaurantChartData.totalRestaurants}</div>,
}));

describe('RestaurantsTab', () => {
  it('composes restaurant summary and chart sections', () => {
    render(
      <RestaurantsTab
        debtOverview={{
          totalDebtOutstanding: 0,
          totalLunches: 1,
          averageLunchCost: 10,
          favoriteSpot: { name: 'Cafe', visits: 1 },
          lunchParticipationRate: 1,
          averageCostPerPerson: 10,
        }}
        validDebtorsCount={0}
        restaurantChartData={{
          popularityData: [],
          priceData: [],
          totalRestaurants: 1,
          totalExpenses: 1,
        }}
      />
    );

    expect(screen.getByText('summary-restaurants')).toBeInTheDocument();
    expect(screen.getByText('restaurants-1')).toBeInTheDocument();
  });
});
