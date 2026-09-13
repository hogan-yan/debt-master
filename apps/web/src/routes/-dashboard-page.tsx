/**
 * Dashboard page component - extracted for code-splitting optimization.
 * This file is imported by the route file (index.tsx) to avoid the
 * TanStack Router code-split warning where Dashboard exports from
 * route files get inlined into the initial bundle.
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { type DashboardTab, DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { DebtorsTab } from '@/components/dashboard/debtors-tab';
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { OverviewTab } from '@/components/dashboard/overview-tab';
import { m } from '@/paraglide/messages';
import { DASHBOARD } from '@/test/test-ids';
import { isAuthError, logout } from '@/utils/auth-client';

// Debtor type from debt-analytics
interface Debtor {
  id: number;
  name: string;
  currentBalance: number;
  totalOwed: number;
  totalPaid: number;
  lastActivity: string;
  daysSinceLastPayment: number;
  paymentCount: number;
  expenseCount: number;
  isSerialDebtor: boolean;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  unpaidExpenses: Array<{
    id: number;
    date: string | Date;
    restaurantName: string;
    restaurantId?: number | null;
    totalAmount: number;
    colleagueAmount: number;
    participantId: number;
    notes?: string | null;
    participantCount: number;
    splitType: string;
    remainingOwed: number;
    totalApprovedPaid: number;
  }>;
}

// Lazy-load chart-heavy tabs to keep initial bundle small
const RestaurantsTab = lazy(() => import('@/components/dashboard/restaurants-tab'));
const SpendingTab = lazy(() => import('@/components/dashboard/spending-tab'));

// Type definitions for dashboard data
interface RestaurantPopularityData {
  name: string;
  fullName: string;
  visits: number;
  percentage: string;
}

interface RestaurantPriceData {
  name: string;
  fullName: string;
  avgCost: number;
  avgCostPerPerson: number;
  visits: number;
  totalSpent: number;
}

interface RestaurantChartData {
  popularityData: RestaurantPopularityData[];
  priceData: RestaurantPriceData[];
  totalRestaurants: number;
  totalExpenses: number;
}

interface SpendingTrend {
  period: string;
  totalSpending: number;
  expenseCount: number;
  averageExpenseAmount: number;
  uniqueParticipants: number;
  averageParticipantsPerExpense: number;
}

interface SpendingInsights {
  summary: {
    totalSpending: number;
    averageExpenseAmount: number;
    averageParticipantsPerExpense: number;
    mostExpensiveAmount: number;
    mostExpensiveRestaurant: string;
  };
  restaurantStats: Array<{ name: string; total: number; count: number }>;
  dayOfWeekStats: Array<{ day: string; total: number; count: number }>;
}

interface SpendingAnalytics {
  topSpenders: Array<{
    id: number;
    name: string;
    totalSpent: number;
    expenseCount: number;
    averageSpent: number;
    participationRate: number;
    lastExpenseDate: string | null;
    daysSinceLastExpense: number;
  }>;
  lowSpenders: Array<{
    id: number;
    name: string;
    totalSpent: number;
    expenseCount: number;
    averageSpent: number;
    participationRate: number;
    lastExpenseDate: string | null;
    daysSinceLastExpense: number;
  }>;
  inactiveMembers: Array<{
    id: number;
    name: string;
    totalSpent: number;
    expenseCount: number;
    averageSpent: number;
    participationRate: number;
    lastExpenseDate: string | null;
    daysSinceLastExpense: number;
  }>;
  frequentParticipants: Array<{
    id: number;
    name: string;
    totalSpent: number;
    expenseCount: number;
    averageSpent: number;
    participationRate: number;
    lastExpenseDate: string | null;
    daysSinceLastExpense: number;
  }>;
  overview: {
    totalColleagues: number;
    activeColleagues: number;
    totalExpenses: number;
    totalSpending: number;
    averageSpendingPerPerson: number;
  };
}

interface SpendingData {
  analytics: SpendingAnalytics;
  trends: SpendingTrend[];
  insights: SpendingInsights;
}

export interface DashboardPageProps {
  debtLeaderboard: { debtors: Debtor[]; maxDebtAmount: number };
  debtOverview: {
    totalDebtOutstanding: number;
    totalLunches: number;
    averageLunchCost: number;
    favoriteSpot: { name: string; visits: number };
    totalLunchMoneySpent: number;
    lunchParticipationRate: number;
    daysSinceLastPayment: number;
    debtTrend: 'stable' | 'increasing' | 'decreasing';
    urgentDebtCount: number;
    teamSize: number;
    restaurantCount: number;
    averageCostPerPerson: number;
  };
}

export function DashboardPage({ debtLeaderboard, debtOverview }: DashboardPageProps) {
  const router = useRouter();
  const navigate = useNavigate();

  // If SSR returned empty data (cookie wasn't available during SSR),
  // refetch now that the client-side auth cookie is available.
  const hasRequestedRefetch = useRef(false);
  useEffect(() => {
    if (hasRequestedRefetch.current) return;
    if (debtLeaderboard.debtors.length === 0 && debtOverview.totalLunches === 0) {
      hasRequestedRefetch.current = true;
      router.invalidate();
    }
  }, [debtLeaderboard.debtors.length, debtOverview.totalLunches, router]);

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // Tab data lives in react-query, fetched lazily per tab. staleTime keeps
  // tab switches instant while queries stay invalidated via the colleagues
  // domain on mutations.
  const restaurantsQuery = useQuery({
    queryKey: ['dashboard', 'restaurants'],
    queryFn: async (): Promise<RestaurantChartData> => {
      const { getRestaurantChartData } = await import('@/server/debt-analytics');
      return getRestaurantChartData();
    },
    enabled: activeTab === 'restaurants',
    staleTime: Number.POSITIVE_INFINITY,
  });

  const spendingQuery = useQuery({
    queryKey: ['dashboard', 'spending'],
    queryFn: async (): Promise<SpendingData> => {
      const { getSpendingAnalytics, getSpendingTrends, getSpendingInsights } = await import(
        '@/server/spending-analytics'
      );
      const [analytics, trends, insights] = await Promise.all([
        getSpendingAnalytics(),
        getSpendingTrends(),
        getSpendingInsights(),
      ]);
      return { analytics, trends, insights };
    },
    enabled: activeTab === 'spending',
    staleTime: Number.POSITIVE_INFINITY,
  });

  const restaurantData = restaurantsQuery.data ?? null;
  const spendingData = spendingQuery.data ?? null;
  const loadingStates: Record<DashboardTab, boolean> = {
    overview: false,
    debtors: false,
    restaurants: activeTab === 'restaurants' && restaurantsQuery.isFetching,
    spending: activeTab === 'spending' && spendingQuery.isFetching,
  };

  // Auth failures during tab loads still route to login
  useEffect(() => {
    const authFail = [restaurantsQuery.error, spendingQuery.error].find((e) => e && isAuthError(e));
    if (authFail) {
      logout();
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
    }
  }, [restaurantsQuery.error, spendingQuery.error]);

  // Handle tab change
  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
  };

  // Filter out debtors without actual debt
  const validDebtors = debtLeaderboard.debtors.filter((debtor) => debtor.currentBalance < -0.001);

  return (
    <div className="flex-1 space-y-6 bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2
            className="text-3xl font-display font-semibold tracking-tight"
            data-testid={DASHBOARD.HEADING}
          >
            {m.dashboard_pageTitle()}
          </h2>
          <p className="text-lg text-muted-foreground mt-2">{m.dashboard_pageSubtitle()}</p>
        </div>
      </div>

      {/* Dashboard Navigation Tabs */}
      <DashboardTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Onboarding checklist for brand-new accounts (no lunches logged yet) */}
      {debtOverview.totalLunches === 0 && (
        <OnboardingChecklist
          steps={[
            {
              id: 'restaurants',
              label: m.dashboard_onboarding_step1_label(),
              description: m.dashboard_onboarding_step1_desc(),
              done: debtOverview.restaurantCount > 0,
              actionLabel: m.dashboard_onboarding_addRestaurant(),
              onAction: () => navigate({ to: '/restaurants/' }),
            },
            {
              id: 'colleagues',
              label: m.dashboard_onboarding_step2_label(),
              description: m.dashboard_onboarding_step2_desc(),
              done: debtOverview.teamSize > 0,
              actionLabel: m.dashboard_empty_addColleague(),
              onAction: () => navigate({ to: '/colleagues/' }),
            },
            {
              id: 'lunch',
              label: m.dashboard_onboarding_step3_label(),
              description: m.dashboard_onboarding_step3_desc(),
              done: debtOverview.totalLunches > 0,
              actionLabel: m.dashboard_empty_logLunch(),
              onAction: () => navigate({ to: '/expenses/' }),
            },
          ]}
        />
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab debtOverview={debtOverview} validDebtors={validDebtors} />
      )}

      {activeTab === 'debtors' && <DebtorsTab validDebtors={validDebtors} />}

      {activeTab === 'restaurants' &&
        (loadingStates.restaurants ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="text-lg text-muted-foreground">
                {m.dashboard_loading_restaurantData()}
              </p>
            </div>
          </div>
        ) : restaurantData ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                  <p className="text-lg text-muted-foreground">
                    {m.dashboard_loading_restaurantCharts()}
                  </p>
                </div>
              </div>
            }
          >
            <RestaurantsTab
              debtOverview={debtOverview}
              validDebtorsCount={validDebtors.length}
              restaurantChartData={restaurantData}
            />
          </Suspense>
        ) : null)}

      {activeTab === 'spending' &&
        (loadingStates.spending ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="text-lg text-muted-foreground">
                {m.dashboard_loading_spendingAnalytics()}
              </p>
            </div>
          </div>
        ) : spendingData ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                  <p className="text-lg text-muted-foreground">
                    {m.dashboard_loading_spendingCharts()}
                  </p>
                </div>
              </div>
            }
          >
            <SpendingTab
              spendingData={spendingData.analytics}
              spendingTrends={spendingData.trends}
              spendingInsights={spendingData.insights}
            />
          </Suspense>
        ) : null)}
    </div>
  );
}
