import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpendingBreakdownTab } from './spending-breakdown-tab';

const mockRestaurantBreakdown = [
  { restaurant: 'Pizza Palace', totalSpent: 150, visitCount: 5 },
  { restaurant: 'Sushi Bar', totalSpent: 80, visitCount: 2 },
];

const mockMonthlyBreakdown = [
  { month: '2025-01', totalSpent: 100 },
  { month: '2025-02', totalSpent: 130 },
];

describe('SpendingBreakdownTab', () => {
  it('renders restaurant breakdown section with heading', () => {
    render(
      <SpendingBreakdownTab
        restaurantBreakdown={mockRestaurantBreakdown}
        monthlyBreakdown={mockMonthlyBreakdown}
      />
    );
    expect(screen.getByText(/by restaurant/i)).toBeInTheDocument();
  });

  it('renders monthly spending section with heading', () => {
    render(
      <SpendingBreakdownTab
        restaurantBreakdown={mockRestaurantBreakdown}
        monthlyBreakdown={mockMonthlyBreakdown}
      />
    );
    expect(screen.getByText(/monthly/i)).toBeInTheDocument();
  });

  it('renders each restaurant with name, total spent, and visit count', () => {
    render(
      <SpendingBreakdownTab
        restaurantBreakdown={mockRestaurantBreakdown}
        monthlyBreakdown={mockMonthlyBreakdown}
      />
    );
    expect(screen.getByText('Pizza Palace')).toBeInTheDocument();
    expect(screen.getByText(/\$150/)).toBeInTheDocument();
    expect(screen.getByText(/5 visits/)).toBeInTheDocument();
  });

  it('uses singular visit copy for one visit', () => {
    render(
      <SpendingBreakdownTab
        restaurantBreakdown={[{ restaurant: 'Solo Cafe', totalSpent: 20, visitCount: 1 }]}
        monthlyBreakdown={[]}
      />
    );

    expect(screen.getByText('1 visit')).toBeInTheDocument();
  });

  it('renders each month with total spent', () => {
    render(
      <SpendingBreakdownTab
        restaurantBreakdown={mockRestaurantBreakdown}
        monthlyBreakdown={mockMonthlyBreakdown}
      />
    );
    expect(screen.getByText(/Jan 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/Feb 2025/i)).toBeInTheDocument();
  });

  it('renders empty state when no data provided', () => {
    render(<SpendingBreakdownTab restaurantBreakdown={[]} monthlyBreakdown={[]} />);
    expect(screen.getByText(/no spending data/i)).toBeInTheDocument();
  });
});
