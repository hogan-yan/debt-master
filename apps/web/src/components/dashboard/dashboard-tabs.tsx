/**
 * Dashboard navigation tabs component
 * Provides tab navigation for the dashboard interface
 */

import { BarChart3, Crown, MapPin, TrendingUp } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

export type DashboardTab = 'overview' | 'debtors' | 'restaurants' | 'spending';

interface DashboardTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

const dashboardTabs = [
  {
    id: 'overview' as const,
    label: m.dashboard_tab_overview,
    icon: BarChart3,
    testid: 'overview-tab',
  },
  { id: 'debtors' as const, label: m.dashboard_tab_debtors, icon: Crown, testid: 'who-owes-tab' },
  {
    id: 'restaurants' as const,
    label: m.dashboard_tab_restaurants,
    icon: MapPin,
    testid: 'restaurants-tab',
  },
  {
    id: 'spending' as const,
    label: m.dashboard_tab_spending,
    icon: TrendingUp,
    testid: 'spending-tab',
  },
];

const nextTabByCurrentTab: Record<DashboardTab, DashboardTab> = {
  overview: 'debtors',
  debtors: 'restaurants',
  restaurants: 'spending',
  spending: 'overview',
};

const previousTabByCurrentTab: Record<DashboardTab, DashboardTab> = {
  overview: 'spending',
  debtors: 'overview',
  restaurants: 'debtors',
  spending: 'restaurants',
};

/**
 * Dashboard tabs navigation component
 */
export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        onTabChange(nextTabByCurrentTab[activeTab]);
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        onTabChange(previousTabByCurrentTab[activeTab]);
        break;
      }
      case 'Home': {
        e.preventDefault();
        onTabChange('overview');
        break;
      }
      case 'End': {
        e.preventDefault();
        onTabChange('spending');
        break;
      }
    }
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={m.dashboard_aria_label()}
      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-1 border-b border-border"
      onKeyDown={handleKeyDown}
    >
      {dashboardTabs.map((tab) => {
        const TabIcon = tab.icon;
        return (
          <Button
            key={tab.id}
            data-testid={tab.testid}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={`w-full sm:w-auto justify-start sm:justify-center mb-2 ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                : 'text-foreground hover:bg-accent'
            }`}
          >
            <TabIcon className="h-3 w-3 mr-1 flex-shrink-0" />
            <span>{tab.label()}</span>
          </Button>
        );
      })}
    </div>
  );
}
