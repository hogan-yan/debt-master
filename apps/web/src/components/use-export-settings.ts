export interface ExportSettingsState {
  format: 'pdf' | 'csv' | 'excel' | 'json';
  timeRange: {
    start: string;
    end: string;
    preset: '7d' | '30d' | '90d' | '1y' | 'custom';
  };
  filters: {
    colleagues: string[];
    categories: string[];
    amountRange: { min: number; max: number };
    status: ('paid' | 'pending' | 'overdue')[];
  };
  options: {
    includeCharts: boolean;
    includeDetails: boolean;
    includeSummary: boolean;
    groupByCategory: boolean;
    groupByColleague: boolean;
    showZeroBalances: boolean;
    currency: 'USD' | 'EUR' | 'GBP' | 'CAD';
    numberFormat: 'standard' | 'compact' | 'accounting';
  };
  delivery: {
    method: 'download' | 'email' | 'share_link';
    recipients: string[];
    includePassword: boolean;
    expirationDays: number;
  };
  // UI state
  activeTab: 'reports' | 'settings' | 'history';
  // biome-ignore lint/suspicious/noExplicitAny: ExportReport type in export-tools.tsx, circular dep
  selectedReport: any;
}

type TabId = ExportSettingsState['activeTab'];

type Action =
  | { type: 'UPDATE_SETTINGS'; updates: Partial<ExportSettingsState> }
  | { type: 'SET_TAB'; tab: TabId }
  // biome-ignore lint/suspicious/noExplicitAny: ExportReport type in export-tools.tsx, circular dep
  | { type: 'SELECT_REPORT'; report: any }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_OPTION'; key: keyof ExportSettingsState['options'] }
  | { type: 'SET_CUSTOM_DATES'; start: string | null; end: string | null }
  | { type: 'SET_DELIVERY_RECIPIENTS'; recipients: string }
  | { type: 'RESET_SETTINGS' }
  | { type: 'NOOP' };

export function exportSettingsReducer(
  state: ExportSettingsState,
  action: Action
): ExportSettingsState {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      return { ...state, ...action.updates };

    case 'SET_TAB':
      return { ...state, activeTab: action.tab };

    case 'SELECT_REPORT':
      return { ...state, selectedReport: action.report };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedReport: null,
        activeTab: 'reports',
      };

    case 'TOGGLE_OPTION': {
      const current = state.options[action.key] as boolean;
      return {
        ...state,
        options: { ...state.options, [action.key]: !current },
      };
    }

    case 'SET_CUSTOM_DATES':
      return {
        ...state,
        timeRange: {
          ...state.timeRange,
          start: action.start ?? '',
          end: action.end ?? '',
        },
      };

    case 'SET_DELIVERY_RECIPIENTS':
      return {
        ...state,
        delivery: {
          ...state.delivery,
          recipients: action.recipients
            .split('\n')
            .map((e) => e.trim())
            .filter(Boolean),
        },
      };

    case 'RESET_SETTINGS':
      return { ...defaultExportSettings };

    default:
      return state;
  }
}

export const defaultExportSettings: ExportSettingsState = {
  format: 'pdf',
  timeRange: {
    start: '',
    end: '',
    preset: '30d',
  },
  filters: {
    colleagues: [],
    categories: [],
    amountRange: { min: 0, max: 10000 },
    status: ['paid', 'pending', 'overdue'],
  },
  options: {
    includeCharts: true,
    includeDetails: true,
    includeSummary: true,
    groupByCategory: false,
    groupByColleague: false,
    showZeroBalances: false,
    currency: 'USD',
    numberFormat: 'standard',
  },
  delivery: {
    method: 'download',
    recipients: [],
    includePassword: false,
    expirationDays: 7,
  },
  activeTab: 'reports',
  selectedReport: null,
};
