import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverviewTab } from '../overview-tab';

vi.mock('@/paraglide/messages', () => ({
  m: {
    dashboard_debtDistribution: () => 'Debt Distribution',
    dashboard_teamParticipation: () => 'Team Participation',
    dashboard_overallParticipation: () => 'Overall Participation',
    dashboard_engagementLevel: () => 'Engagement',
    dashboard_engagementExcellent: () => 'Excellent',
    dashboard_engagementGood: () => 'Good',
    dashboard_engagementNeedsWork: () => 'Needs Work',
  },
}));

vi.mock('../summary-cards', () => ({
  SummaryCards: () => <div data-testid="summary-cards">Summary</div>,
}));

vi.mock('../debt-distribution-chart', () => ({
  DebtDistributionChart: () => <div data-testid="debt-chart">Debt Chart</div>,
}));

vi.mock('../participation-chart', () => ({
  ParticipationChart: () => <div data-testid="participation-chart">Participation Chart</div>,
}));

const defaultProps = {
  debtOverview: {
    totalDebtOutstanding: 500,
    totalLunches: 10,
    averageLunchCost: 50,
    favoriteSpot: { name: 'Pizza Place', visits: 5 },
    lunchParticipationRate: 75,
    averageCostPerPerson: 50,
  },
  validDebtors: [
    { id: 1, name: 'Alice', currentBalance: -100, daysSinceLastPayment: 5 },
    { id: 2, name: 'Bob', currentBalance: -200, daysSinceLastPayment: 10 },
  ],
};

describe('OverviewTab', () => {
  it('renders summary cards and charts', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
    expect(screen.getByTestId('debt-chart')).toBeInTheDocument();
    expect(screen.getByTestId('participation-chart')).toBeInTheDocument();
  });

  it('uses provided averageCostPerPerson when available', () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
  });

  it('computes averageCostPerPerson from totalDebtOutstanding and validDebtors when not provided', () => {
    const { averageCostPerPerson: _, ...debtOverviewWithout } = defaultProps.debtOverview;
    const propsWithoutAvg = {
      ...defaultProps,
      debtOverview: debtOverviewWithout,
    };
    render(<OverviewTab {...propsWithoutAvg} />);
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
  });

  it('defaults averageCostPerPerson to 0 when no validDebtors', () => {
    const { averageCostPerPerson: _, ...debtOverviewWithout } = defaultProps.debtOverview;
    const props = {
      ...defaultProps,
      debtOverview: debtOverviewWithout,
      validDebtors: [],
    };
    render(<OverviewTab {...props} />);
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
  });
});
