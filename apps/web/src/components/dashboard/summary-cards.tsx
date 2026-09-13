/**
 * Dashboard summary cards component
 * Displays key financial metrics and statistics
 */

import { DollarSign, MapPin, Star, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { m } from '@/paraglide/messages';
import { formatCurrency } from '@/utils/formatters';

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

interface SummaryCardsProps {
  debtOverview: DebtOverview;
  validDebtorsCount: number;
  variant?: 'overview' | 'restaurants';
}

/**
 * Summary cards for dashboard overview
 */
export function SummaryCards({
  debtOverview,
  validDebtorsCount,
  variant = 'overview',
}: SummaryCardsProps) {
  if (variant === 'restaurants') {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Team Favorite */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_summary_teamFavorite()}
            </CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="text-2xl font-bold break-words leading-tight">
              {debtOverview.favoriteSpot.name}
            </div>
            <p className="text-xs text-muted-foreground">
              {m.dashboard_summary_visits({ count: debtOverview.favoriteSpot.visits })}
            </p>
          </CardContent>
        </Card>

        {/* Total Restaurant Visits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_summary_totalVisits()}
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="text-2xl font-bold">{debtOverview.totalLunches}</div>
            <p className="text-xs text-muted-foreground">{m.dashboard_summary_allRestaurants()}</p>
          </CardContent>
        </Card>

        {/* Average Cost Per Person */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_summary_avgCostPerPerson()}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="text-2xl font-bold">
              {formatCurrency(debtOverview.averageCostPerPerson)}
            </div>
            <p className="text-xs text-muted-foreground">{m.dashboard_summary_perPerson()}</p>
          </CardContent>
        </Card>

        {/* Restaurant Variety */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.dashboard_summary_varietyScore()}
            </CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="text-2xl font-bold">
              {debtOverview.favoriteSpot.visits > 0
                ? Math.min(
                    10,
                    Math.round((debtOverview.totalLunches / debtOverview.favoriteSpot.visits) * 2)
                  )
                : 0}
              /10
            </div>
            <p className="text-xs text-muted-foreground">{m.dashboard_summary_diversityRating()}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Outstanding Debt */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {m.dashboard_summary_totalOutstanding()}
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="text-2xl font-bold">
            {formatCurrency(debtOverview.totalDebtOutstanding)}
          </div>
          <p className="text-xs text-muted-foreground">
            {m.dashboard_summary_peopleOweMoney({ count: validDebtorsCount })}
          </p>
        </CardContent>
      </Card>

      {/* Total Lunches */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {m.dashboard_summary_totalLunches()}
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="text-2xl font-bold">{debtOverview.totalLunches}</div>
          <p className="text-xs text-muted-foreground">{m.dashboard_summary_teamExpenses()}</p>
        </CardContent>
      </Card>

      {/* Average Cost Per Person */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {m.dashboard_summary_avgCostPerPerson()}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="text-2xl font-bold">
            {formatCurrency(debtOverview.averageCostPerPerson)}
          </div>
          <p className="text-xs text-muted-foreground">{m.dashboard_summary_perPerson()}</p>
        </CardContent>
      </Card>

      {/* Favorite Restaurant */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {m.dashboard_summary_topRestaurant()}
          </CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="text-2xl font-bold break-words leading-tight">
            {debtOverview.favoriteSpot.name}
          </div>
          <p className="text-xs text-muted-foreground">
            {m.dashboard_summary_visits({ count: debtOverview.favoriteSpot.visits })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
