import { beforeEach, describe, expect, it } from 'vitest';
import type {
  DashboardLayout,
  DashboardPreferences,
  DashboardWidget,
} from '../use-dashboard-settings';
import { dashboardSettingsReducer, initDashboardSettings } from '../use-dashboard-settings';

const mockPreferences: DashboardPreferences = {
  theme: 'light',
  layout: 'standard',
  autoRefresh: true,
  refreshInterval: 60,
  defaultTimeRange: '30d',
  currency: 'USD',
  numberFormat: 'standard',
  animations: true,
  condensedMode: false,
  mobileOptimized: false,
  showWelcomeMessage: true,
  quickActions: ['add-expense', 'record-payment'],
};

const mockLayouts: DashboardLayout[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: '',
    gridColumns: 3,
    preset: 'standard',
    widgets: [],
  },
];

describe('useDashboardSettings', () => {
  describe('initDashboardSettings', () => {
    it('returns initialized state from current prefs', () => {
      const state = initDashboardSettings(mockPreferences, mockLayouts);
      expect(state.preferences).toEqual(mockPreferences);
      expect(state.selectedLayout).toEqual(mockLayouts[0]);
      expect(state.activeTab).toBe('layout');
      expect(state.previewMode).toBe(false);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('returns null layout when not found', () => {
      const state = initDashboardSettings({ ...mockPreferences, layout: 'nonexistent' }, []);
      expect(state.selectedLayout).toBeNull();
    });
  });

  describe('dashboardSettingsReducer', () => {
    let state: ReturnType<typeof initDashboardSettings>;

    beforeEach(() => {
      state = initDashboardSettings(mockPreferences, mockLayouts);
    });

    it('updates preferences and sets hasUnsavedChanges', () => {
      const result = dashboardSettingsReducer(state, {
        type: 'UPDATE_PREFERENCES',
        updates: { currency: 'EUR' },
      });
      expect(result.preferences.currency).toBe('EUR');
      expect(result.hasUnsavedChanges).toBe(true);
    });

    it('sets selected layout', () => {
      const newLayout: DashboardLayout = {
        id: 'lay-2',
        name: '',
        description: '',
        gridColumns: 2,
        preset: 'compact',
        widgets: [],
      };
      const result = dashboardSettingsReducer(state, {
        type: 'SET_LAYOUT',
        layout: newLayout,
      });
      expect(result.selectedLayout).toEqual(newLayout);
      expect(result.preferences.layout).toBe('lay-2');
    });

    it('toggles preview mode', () => {
      const result = dashboardSettingsReducer(state, { type: 'TOGGLE_PREVIEW' });
      expect(result.previewMode).toBe(true);
    });

    it('sets active tab', () => {
      const result = dashboardSettingsReducer(state, { type: 'SET_TAB', tab: 'widgets' });
      expect(result.activeTab).toBe('widgets');
    });

    it('marks as saved via SAVE', () => {
      const dirtyState = { ...state, hasUnsavedChanges: true };
      const result = dashboardSettingsReducer(dirtyState, { type: 'SAVE' });
      expect(result.hasUnsavedChanges).toBe(false);
    });

    it('resets to initial prefs via RESET', () => {
      const dirty = dashboardSettingsReducer(state, {
        type: 'UPDATE_PREFERENCES',
        updates: { currency: 'EUR' },
      });
      const result = dashboardSettingsReducer(dirty, {
        type: 'RESET',
        preferences: mockPreferences,
        layouts: mockLayouts,
      });
      expect(result.preferences).toEqual(mockPreferences);
      expect(result.hasUnsavedChanges).toBe(false);
    });

    it('updates widgets when layout selected', () => {
      const widget: DashboardWidget = {
        id: 'w1',
        name: 'Widget',
        description: '',
        category: 'financial',
        icon: (() => null) as unknown as import('lucide-react').LucideIcon,
        isEnabled: true,
        position: { row: 0, column: 0, width: 1, height: 1 },
        settings: {},
        isResizable: false,
        isMovable: false,
      };
      const result = dashboardSettingsReducer(state, {
        type: 'UPDATE_WIDGETS',
        widgets: [widget],
      });
      expect(result.selectedLayout?.widgets).toEqual([widget]);
      expect(result.hasUnsavedChanges).toBe(true);
    });

    it('ignores UPDATE_WIDGETS when no layout selected', () => {
      const noLayoutState = initDashboardSettings({ ...mockPreferences, layout: 'missing' }, []);
      const result = dashboardSettingsReducer(noLayoutState, {
        type: 'UPDATE_WIDGETS',
        widgets: [],
      });
      expect(result.selectedLayout).toBeNull();
    });
  });
});
