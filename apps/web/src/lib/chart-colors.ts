/* global getComputedStyle */

/** Read a CSS custom property value from the computed styles of :root */
function getCSSVariable(name: string): string {
  if (typeof window === 'undefined') return '#000';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  const hsl = value.trim();
  if (!hsl) return '#000';
  return hsl.startsWith('hsl') ? hsl : `hsl(${hsl})`;
}

/** Check if the current theme is dark mode */
function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/** Get chart colors that work in both light and dark modes */
export function getChartColors() {
  const dark = isDarkMode();

  return {
    foreground: getCSSVariable('--foreground'),
    mutedForeground: getCSSVariable('--muted-foreground'),
    border: getCSSVariable('--border'),
    card: getCSSVariable('--card'),
    primary: getCSSVariable('--primary'),
    gridStroke: dark
      ? getCSSVariable('--border').replace(')', ' / 0.4)')
      : getCSSVariable('--border'),
    /** Tooltip shadow — soft glow in dark, subtle in light */
    tooltipShadow: dark
      ? '0 0 0 1px hsl(0 0% 19% / 0.8), 0 8px 24px -4px hsl(0 0% 3% / 0.5)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    /** Cursor fill — subtle in both modes */
    cursorFill: dark ? 'hsl(0 0% 28% / 0.4)' : 'hsl(0 0% 28% / 0.08)',
  };
}
