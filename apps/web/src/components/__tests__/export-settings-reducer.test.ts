import { describe, expect, it } from 'vitest';
import {
  defaultExportSettings,
  type ExportSettingsState,
  exportSettingsReducer,
} from '../use-export-settings';

describe('exportSettingsReducer', () => {
  function update(state: Partial<ExportSettingsState>): ExportSettingsState {
    return exportSettingsReducer(
      { ...defaultExportSettings, ...state },
      {
        type: 'NOOP',
      }
    );
  }

  describe('defaultExportSettings', () => {
    it('returns settings with pdf format and 30d preset', () => {
      expect(defaultExportSettings.format).toBe('pdf');
      expect(defaultExportSettings.timeRange.preset).toBe('30d');
      expect(defaultExportSettings.delivery.method).toBe('download');
      expect(defaultExportSettings.options.includeCharts).toBe(true);
    });
  });

  describe('UPDATE_SETTINGS', () => {
    it('updates format', () => {
      const s = exportSettingsReducer(defaultExportSettings, {
        type: 'UPDATE_SETTINGS',
        updates: { format: 'csv' as const },
      });
      expect(s.format).toBe('csv');
    });

    it('merges nested timeRange', () => {
      const s = exportSettingsReducer(defaultExportSettings, {
        type: 'UPDATE_SETTINGS',
        updates: { timeRange: { ...defaultExportSettings.timeRange, preset: '90d' as const } },
      });
      expect(s.timeRange.preset).toBe('90d');
    });

    it('merges nested delivery', () => {
      const s = exportSettingsReducer(defaultExportSettings, {
        type: 'UPDATE_SETTINGS',
        updates: { delivery: { ...defaultExportSettings.delivery, method: 'email' as const } },
      });
      expect(s.delivery.method).toBe('email');
    });
  });

  describe('SET_TAB', () => {
    it.each([
      ['reports', 'reports'],
      ['settings', 'settings'],
      ['history', 'history'],
    ])('switches to %s', (_, tab) => {
      const s = exportSettingsReducer(
        update({ activeTab: 'reports' as 'reports' | 'settings' | 'history' }),
        {
          type: 'SET_TAB',
          tab: tab as 'reports' | 'settings' | 'history',
        }
      );
      expect(s.activeTab).toBe(tab);
    });
  });

  describe('SELECT_REPORT / CLEAR_SELECTION', () => {
    const report = { id: 'fin-1', name: 'Financial Summary' };

    it('selects a report', () => {
      const s = exportSettingsReducer(update({}), { type: 'SELECT_REPORT', report });
      expect(s.selectedReport).toEqual(report);
      expect(s.activeTab).toBe('reports');
    });

    it('stays on current tab for settings/history', () => {
      const s = exportSettingsReducer(update({ activeTab: 'settings' as const }), {
        type: 'SELECT_REPORT',
        report,
      });
      expect(s.activeTab).toBe('settings');
    });

    it('clears the selected report', () => {
      const s = exportSettingsReducer(update({ selectedReport: report }), {
        type: 'CLEAR_SELECTION',
      });
      expect(s.selectedReport).toBeNull();
      expect(s.activeTab).toBe('reports');
    });
  });

  describe('TOGGLE_OPTION', () => {
    it('toggles includeCharts from true to false', () => {
      const s = exportSettingsReducer(defaultExportSettings, {
        type: 'TOGGLE_OPTION',
        key: 'includeCharts',
      });
      expect(s.options.includeCharts).toBe(false);
    });

    it('toggles includeCharts back to true', () => {
      const s = exportSettingsReducer(
        {
          ...defaultExportSettings,
          options: { ...defaultExportSettings.options, includeCharts: false },
        },
        { type: 'TOGGLE_OPTION', key: 'includeCharts' }
      );
      expect(s.options.includeCharts).toBe(true);
    });
  });

  describe('SET_CUSTOM_DATES', () => {
    it('sets start date', () => {
      const s = exportSettingsReducer(defaultExportSettings, {
        type: 'SET_CUSTOM_DATES',
        start: '2025-01-01',
        end: null,
      });
      expect(s.timeRange.start).toBe('2025-01-01');
      expect(s.timeRange.end).toBe('');
    });

    it('clears both dates when neither boundary is supplied', () => {
      const s = exportSettingsReducer(defaultExportSettings, {
        type: 'SET_CUSTOM_DATES',
        start: null,
        end: null,
      });

      expect(s.timeRange).toMatchObject({ start: '', end: '' });
    });
  });

  describe('SET_DELIVERY_RECIPIENTS', () => {
    it('parses newline-separated emails', () => {
      const s = exportSettingsReducer(defaultExportSettings, {
        type: 'SET_DELIVERY_RECIPIENTS',
        recipients: 'a@b.com\n\nc@d.com\n',
      });
      expect(s.delivery.recipients).toEqual(['a@b.com', 'c@d.com']);
    });
  });

  describe('RESET_SETTINGS', () => {
    it('restores all defaults', () => {
      const modified = {
        ...defaultExportSettings,
        format: 'excel' as const,
        timeRange: { ...defaultExportSettings.timeRange, preset: '1y' as const },
        options: { ...defaultExportSettings.options, includeCharts: false },
      };
      const s = exportSettingsReducer(modified, { type: 'RESET_SETTINGS' });
      expect(s.format).toBe('pdf');
      expect(s.timeRange.preset).toBe('30d');
      expect(s.options.includeCharts).toBe(true);
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = { ...defaultExportSettings, format: 'json' as const };
      expect(
        exportSettingsReducer(state, {
          type: 'UNKNOWN',
        } as unknown as Parameters<typeof exportSettingsReducer>[1])
      ).toBe(state);
    });
  });
});
