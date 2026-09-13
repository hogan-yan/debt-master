export interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'analytics' | 'activity' | 'management';
  icon: import('lucide-react').LucideIcon;
  isEnabled: boolean;
  position: { row: number; column: number; width: number; height: number };
  settings: Record<string, unknown>;
  isResizable: boolean;
  isMovable: boolean;
}

export interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  gridColumns: 1 | 2 | 3 | 4;
  preset: 'compact' | 'standard' | 'expanded' | 'analytics' | 'mobile' | 'custom';
  widgets: DashboardWidget[];
}

export interface DashboardTheme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  preview: string;
}

export interface DashboardPreferences {
  theme: string;
  layout: string;
  autoRefresh: boolean;
  refreshInterval: number;
  defaultTimeRange: '7d' | '30d' | '90d' | '1y';
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD';
  numberFormat: 'standard' | 'compact' | 'accounting';
  animations: boolean;
  condensedMode: boolean;
  mobileOptimized: boolean;
  showWelcomeMessage: boolean;
  quickActions: string[];
}

export type TabId = 'layout' | 'widgets' | 'theme' | 'preferences';

export interface DashboardSettingsState {
  preferences: DashboardPreferences;
  selectedLayout: DashboardLayout | null;
  activeTab: TabId;
  previewMode: boolean;
  hasUnsavedChanges: boolean;
}

type DashboardSettingsAction =
  | { type: 'UPDATE_PREFERENCES'; updates: Partial<DashboardPreferences> }
  | { type: 'SET_LAYOUT'; layout: DashboardLayout }
  | { type: 'TOGGLE_PREVIEW' }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SAVE' }
  | { type: 'RESET'; preferences: DashboardPreferences; layouts: DashboardLayout[] }
  | { type: 'UPDATE_WIDGETS'; widgets: DashboardWidget[] };

export function initDashboardSettings(
  currentPreferences: DashboardPreferences,
  availableLayouts: DashboardLayout[]
): DashboardSettingsState {
  return {
    preferences: currentPreferences,
    selectedLayout: availableLayouts.find((l) => l.id === currentPreferences.layout) || null,
    activeTab: 'layout',
    previewMode: false,
    hasUnsavedChanges: false,
  };
}

export function dashboardSettingsReducer(
  state: DashboardSettingsState,
  action: DashboardSettingsAction
): DashboardSettingsState {
  switch (action.type) {
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.updates },
        hasUnsavedChanges: true,
      };

    case 'SET_LAYOUT':
      return {
        ...state,
        selectedLayout: action.layout,
        preferences: { ...state.preferences, layout: action.layout.id },
      };

    case 'TOGGLE_PREVIEW':
      return {
        ...state,
        previewMode: !state.previewMode,
      };

    case 'SET_TAB':
      return {
        ...state,
        activeTab: action.tab,
      };

    case 'SAVE':
      return {
        ...state,
        hasUnsavedChanges: false,
      };

    case 'UPDATE_WIDGETS': {
      if (!state.selectedLayout) return state;
      return {
        ...state,
        selectedLayout: { ...state.selectedLayout, widgets: action.widgets },
        hasUnsavedChanges: true,
      };
    }
    case 'RESET':
      return {
        ...initDashboardSettings(action.preferences, action.layouts),
      };
  }
}
