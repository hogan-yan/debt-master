/**
 * Dashboard overview tab component
 * Displays overview metrics, charts and key statistics
 */

import { DebtDistributionChart } from './debt-distribution-chart';
import { ParticipationChart } from './participation-chart';
import { SummaryCards } from './summary-cards';

interface Debtor {
  id: number;
  name: string;
  currentBalance: number;
  daysSinceLastPayment: number;
}

interface DebtOverview {
  totalDebtOutstanding: number;
  totalLunches: number;
  averageLunchCost: number;
  favoriteSpot: {
    name: string;
    visits: number;
  };
  lunchParticipationRate: number;
  /**
   * Average cost per person (total spent divided by total participants).
   * May be omitted when no data is available; the component computes a fallback.
   */
  averageCostPerPerson?: number;
}

interface OverviewTabProps {
  debtOverview: DebtOverview;
  validDebtors: Debtor[];
}

/**
 * Dashboard overview tab
 */
export function OverviewTab({ debtOverview, validDebtors }: OverviewTabProps) {
  // Compute averageCostPerPerson if not present
  const computedDebtOverview = {
    ...debtOverview,
    averageCostPerPerson:
      typeof debtOverview.averageCostPerPerson === 'number'
        ? debtOverview.averageCostPerPerson
        : debtOverview.totalLunches && validDebtors.length
          ? debtOverview.totalDebtOutstanding / validDebtors.length
          : 0,
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards Grid */}
      <SummaryCards
        debtOverview={computedDebtOverview}
        validDebtorsCount={validDebtors.length}
        variant="overview"
      />

      {/* Quick Overview Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Debt Distribution Chart */}
        <DebtDistributionChart
          validDebtors={validDebtors}
          totalDebtOutstanding={debtOverview.totalDebtOutstanding}
        />

        {/* Team Participation Chart */}
        <ParticipationChart lunchParticipationRate={debtOverview.lunchParticipationRate} />
      </div>
    </div>
  );
}
