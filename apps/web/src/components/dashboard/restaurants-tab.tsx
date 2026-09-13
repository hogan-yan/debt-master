/**
 * Dashboard restaurants tab component
 * Shows restaurant analytics, popularity and pricing data
 */

import { RestaurantCharts } from './restaurant-charts';
import { SummaryCards } from './summary-cards';

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
   * Average cost per person (total spent divided by total participants)
   */
  averageCostPerPerson: number;
}

interface RestaurantChartData {
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
}

interface RestaurantsTabProps {
  debtOverview: DebtOverview;
  validDebtorsCount: number;
  restaurantChartData: RestaurantChartData;
}

/**
 * Dashboard restaurants tab
 */
export function RestaurantsTab({
  debtOverview,
  validDebtorsCount,
  restaurantChartData,
}: RestaurantsTabProps) {
  return (
    <div className="space-y-6">
      {/* Restaurant Overview Cards */}
      <SummaryCards
        debtOverview={debtOverview}
        validDebtorsCount={validDebtorsCount}
        variant="restaurants"
      />

      {/* Restaurant Charts */}
      <RestaurantCharts debtOverview={debtOverview} restaurantChartData={restaurantChartData} />
    </div>
  );
}

export default RestaurantsTab;
