import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatChartCurrencyTick,
  popularityTooltipFormatter,
  priceTooltipFormatter,
  RestaurantCharts,
  tooltipLabelFormatter,
  truncateText,
} from '../restaurant-charts';

const mockChartColors = {
  foreground: 'hsl(0 0% 10%)',
  mutedForeground: 'hsl(0 0% 40%)',
  border: 'hsl(0 0% 80%)',
  card: 'hsl(0 0% 100%)',
  primary: 'hsl(220 90% 56%)',
  gridStroke: 'hsl(0 0% 80%)',
  tooltipShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  cursorFill: 'hsl(0 0% 28% / 0.08)',
};

vi.mock('@/lib/chart-colors', () => ({
  getChartColors: () => mockChartColors,
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    dashboard_restaurant_popularity: () => 'Restaurant Popularity',
    dashboard_restaurant_costPerPerson: () => 'Cost Per Person',
    dashboard_restaurant_visitsTooltip: (p: { value: string; percentage: string }) =>
      `${p.value} visits (${p.percentage}%)`,
    dashboard_restaurant_visitsLabel: () => 'Visits',
    dashboard_restaurant_costTooltip: (p: { value: string; visits: string }) =>
      `$${p.value} avg (${p.visits} visits)`,
    dashboard_summary_avgCostPerPerson: () => 'Avg Cost/Person',
  },
}));

function makeProps(overrides?: {
  debtOverview?: Partial<{
    totalLunches: number;
    averageLunchCost: number;
    favoriteSpot: { name: string; visits: number };
    averageCostPerPerson: number;
  }>;
  restaurantChartData?: Partial<{
    popularityData: Array<{
      name: string;
      fullName: string;
      visits: number;
      percentage: string;
    }>;
    priceData: Array<{
      name: string;
      fullName: string;
      avgCost: number;
      avgCostPerPerson: number;
      visits: number;
      totalSpent: number;
    }>;
    totalRestaurants: number;
    totalExpenses: number;
  }>;
}) {
  return {
    debtOverview: {
      totalLunches: 50,
      averageLunchCost: 25,
      favoriteSpot: { name: 'Pizza Place', visits: 15 },
      averageCostPerPerson: 12.5,
      ...overrides?.debtOverview,
    },
    restaurantChartData: {
      popularityData: [],
      priceData: [],
      totalRestaurants: 0,
      totalExpenses: 0,
      ...overrides?.restaurantChartData,
    },
  };
}

describe('RestaurantCharts', () => {
  it('renders both chart card titles', () => {
    render(<RestaurantCharts {...makeProps()} />);

    expect(screen.getByText('Restaurant Popularity')).toBeInTheDocument();
    expect(screen.getByText('Cost Per Person')).toBeInTheDocument();
  });

  it('renders without errors with empty data', () => {
    const { container } = render(<RestaurantCharts {...makeProps()} />);

    // Two recharts responsive containers (one per chart)
    const charts = container.querySelectorAll('.recharts-responsive-container');
    expect(charts).toHaveLength(2);
  });

  it('renders without errors with populated data', () => {
    const props = makeProps({
      restaurantChartData: {
        popularityData: [
          {
            name: 'Italian Bistro',
            fullName: 'Italian Bistro Downtown',
            visits: 10,
            percentage: '40',
          },
          { name: 'Sushi Bar', fullName: 'Sushi Bar Central', visits: 8, percentage: '32' },
        ],
        priceData: [
          {
            name: 'Italian Bistro',
            fullName: 'Italian Bistro Downtown',
            avgCost: 30,
            avgCostPerPerson: 15,
            visits: 10,
            totalSpent: 300,
          },
          {
            name: 'Sushi Bar',
            fullName: 'Sushi Bar Central',
            avgCost: 25,
            avgCostPerPerson: 12,
            visits: 8,
            totalSpent: 200,
          },
        ],
        totalRestaurants: 2,
        totalExpenses: 18,
      },
    });

    const { container } = render(<RestaurantCharts {...props} />);

    // Titles still rendered
    expect(screen.getByText('Restaurant Popularity')).toBeInTheDocument();
    expect(screen.getByText('Cost Per Person')).toBeInTheDocument();

    // Two responsive containers present
    const charts = container.querySelectorAll('.recharts-responsive-container');
    expect(charts).toHaveLength(2);
  });

  it('renders two Card components in a grid layout', () => {
    const { container } = render(<RestaurantCharts {...makeProps()} />);

    const grid = container.querySelector('.grid.lg\\:grid-cols-2');
    expect(grid).toBeInTheDocument();

    const cards = container.querySelectorAll('.rounded-lg.border.bg-card');
    expect(cards).toHaveLength(2);
  });

  describe('truncateText', () => {
    it('returns short text unchanged', () => {
      expect(truncateText('Short')).toBe('Short');
    });

    it('truncates long text with ellipsis', () => {
      const long = 'A very long restaurant name';
      expect(truncateText(long, 10)).toBe('A very lon...');
    });

    it('uses default max length of 15', () => {
      const text = '1234567890123456';
      expect(truncateText(text)).toBe('123456789012345...');
    });
  });

  describe('tooltip formatters', () => {
    it('formats popularity tooltip', () => {
      const [label, name] = popularityTooltipFormatter(10, 'visits', {
        payload: { percentage: '40' },
        graphicalItemId: '1',
      });
      expect(label).toContain('10');
      expect(label).toContain('40');
      expect(name).toBe('Visits');
    });

    it('falls back to zero percentage when payload missing', () => {
      const [label] = popularityTooltipFormatter(5, 'visits', {
        graphicalItemId: '1',
      });
      expect(label).toContain('0');
    });

    it('falls back to zero when tooltip values are omitted', () => {
      const [popularityLabel] = popularityTooltipFormatter(undefined, undefined, {
        graphicalItemId: '1',
      });
      const [priceLabel] = priceTooltipFormatter(undefined, undefined, {
        graphicalItemId: '1',
      });

      expect(popularityLabel).toContain('0');
      expect(priceLabel).toContain('0.00');
    });

    it('formats price tooltip', () => {
      const [label, name] = priceTooltipFormatter(25.5, 'avgCostPerPerson', {
        payload: { visits: 8 },
        graphicalItemId: '1',
      });
      expect(label).toContain('25.50');
      expect(label).toContain('8');
      expect(name).toBe('Avg Cost/Person');
    });

    it('falls back to zero visits when payload missing', () => {
      const [label] = priceTooltipFormatter(10, 'avgCostPerPerson', {
        graphicalItemId: '1',
      });
      expect(label).toContain('0');
    });

    it('uses fullName for label when available', () => {
      expect(
        tooltipLabelFormatter('Short', [
          { payload: { fullName: 'Full Restaurant Name' }, graphicalItemId: '1' },
        ])
      ).toBe('Full Restaurant Name');
    });

    it('uses label when fullName missing', () => {
      expect(tooltipLabelFormatter('Short', [])).toBe('Short');
    });

    it('formats currency ticks', () => {
      expect(formatChartCurrencyTick(42)).toBe('$42');
      expect(formatChartCurrencyTick('9.5')).toBe('$9.5');
    });
  });
});
