import { List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { activityTabId } from '@/test/test-ids';

export type ColleagueDetailTab = 'activity';

interface ColleagueDetailTabsProps {
  activeTab: ColleagueDetailTab;
  onTabChange: (tab: ColleagueDetailTab) => void;
}

const tabs = [{ id: 'activity' as const, label: m.colleague_detail_tabActivity, icon: List }];

export function ColleagueDetailTabs({ activeTab, onTabChange }: ColleagueDetailTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={m.colleague_detail_tabAria()}
      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        return (
          <Button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            data-testid={activityTabId(tab.id)}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
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
