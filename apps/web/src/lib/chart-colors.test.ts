import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChartColors } from './chart-colors';

describe('getChartColors', () => {
  const mockGetComputedStyle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetComputedStyle.mockReturnValue({
      getPropertyValue: (name: string) => {
        const vars: Record<string, string> = {
          '--foreground': 'hsl(0 0% 10%)',
          '--muted-foreground': 'hsl(0 0% 40%)',
          '--border': 'hsl(0 0% 80%)',
          '--card': 'hsl(0 0% 100%)',
          '--primary': 'hsl(220 90% 56%)',
        };
        return vars[name] ?? '';
      },
    });
    // jsdom provides document.documentElement
    vi.spyOn(window, 'getComputedStyle').mockImplementation(mockGetComputedStyle);
  });

  it('returns chart color object with all expected keys', () => {
    document.documentElement.classList.remove('dark');
    const colors = getChartColors();

    expect(colors).toHaveProperty('foreground');
    expect(colors).toHaveProperty('mutedForeground');
    expect(colors).toHaveProperty('border');
    expect(colors).toHaveProperty('card');
    expect(colors).toHaveProperty('primary');
    expect(colors).toHaveProperty('gridStroke');
    expect(colors).toHaveProperty('tooltipShadow');
    expect(colors).toHaveProperty('cursorFill');
  });

  it('reads CSS variables via getComputedStyle', () => {
    document.documentElement.classList.remove('dark');
    getChartColors();

    expect(mockGetComputedStyle).toHaveBeenCalledWith(document.documentElement);
  });

  it('returns light-mode gridStroke without opacity modifier in light mode', () => {
    document.documentElement.classList.remove('dark');
    const colors = getChartColors();

    // In light mode, gridStroke = border value directly (no replace)
    expect(colors.gridStroke).toBe('hsl(0 0% 80%)');
  });

  it('applies opacity modifier to gridStroke in dark mode', () => {
    document.documentElement.classList.add('dark');
    const colors = getChartColors();

    // In dark mode, gridStroke = border value with " / 0.4)" appended
    expect(colors.gridStroke).toContain('/ 0.4)');
  });

  it('returns dark-mode cursorFill in dark mode', () => {
    document.documentElement.classList.add('dark');
    const colors = getChartColors();

    expect(colors.cursorFill).toBe('hsl(0 0% 28% / 0.4)');
  });

  it('returns light-mode cursorFill in light mode', () => {
    document.documentElement.classList.remove('dark');
    const colors = getChartColors();

    expect(colors.cursorFill).toBe('hsl(0 0% 28% / 0.08)');
  });

  it('returns #000 fallback for missing CSS variables', () => {
    mockGetComputedStyle.mockReturnValue({
      getPropertyValue: () => '',
    });
    const colors = getChartColors();

    expect(colors.foreground).toBe('#000');
    expect(colors.mutedForeground).toBe('#000');
  });

  it('wraps non-hsl values in hsl()', () => {
    mockGetComputedStyle.mockReturnValue({
      getPropertyValue: (name: string) => {
        if (name === '--foreground') return '220 90% 56%';
        return '';
      },
    });
    const colors = getChartColors();

    expect(colors.foreground).toBe('hsl(220 90% 56%)');
  });

  it('returns #000 fallbacks and light-mode values when window is undefined (SSR)', () => {
    // SSR / non-browser: typeof window === 'undefined' short-circuits both
    // getCSSVariable (line 5) and isDarkMode (line 14) before touching document.
    vi.stubGlobal('window', undefined);

    const colors = getChartColors();

    // getCSSVariable returns '#000' for every variable
    expect(colors.foreground).toBe('#000');
    expect(colors.mutedForeground).toBe('#000');
    expect(colors.border).toBe('#000');
    expect(colors.card).toBe('#000');
    expect(colors.primary).toBe('#000');

    // isDarkMode returns false → light-mode branches
    expect(colors.gridStroke).toBe('#000');
    expect(colors.cursorFill).toBe('hsl(0 0% 28% / 0.08)');

    vi.unstubAllGlobals();
  });
});
