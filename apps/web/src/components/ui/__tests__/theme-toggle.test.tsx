import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '../theme-toggle';

const mockSetTheme = vi.fn();
let mockEffectiveTheme: 'light' | 'dark' = 'light';

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    effectiveTheme: mockEffectiveTheme,
    setTheme: mockSetTheme,
  }),
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    theme_switchTo: () => 'Switch theme',
    theme_dark: () => 'dark',
    theme_light: () => 'light',
    theme_toggle: () => 'Toggle theme',
  },
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEffectiveTheme = 'light';
  });

  it('renders toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('switches to dark when current theme is light', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('switches to light when current theme is dark', async () => {
    mockEffectiveTheme = 'dark';
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});
