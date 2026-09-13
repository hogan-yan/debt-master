import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../use-theme';

const mockMatchMedia = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
let mockLocalStorage: Record<string, string> = {};

function getChangeListener(): () => void {
  const listener = mockAddEventListener.mock.calls.at(-1)?.[1];
  if (typeof listener !== 'function') {
    throw new Error('Expected system theme change listener');
  }
  return listener;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: mockMatchMedia(query),
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  }),
});

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockLocalStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockLocalStorage[key];
    },
    clear: () => {
      mockLocalStorage = {};
    },
  },
});

function TestComponent() {
  const { theme, effectiveTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="effective">{effectiveTheme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Set Light
      </button>
      <button type="button" onClick={() => setTheme('system')}>
        Set System
      </button>
    </div>
  );
}

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('debt-master-theme');
    document.documentElement.className = '';
  });

  it('throws when used outside ThemeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useTheme must be used within a ThemeProvider');
    spy.mockRestore();
  });

  it('defaults to system theme during server rendering without window', async () => {
    vi.resetModules();
    vi.stubGlobal('window', undefined);

    try {
      const { ThemeProvider: ServerThemeProvider } = await import('../use-theme');
      const markup = renderToString(
        <ServerThemeProvider>
          <span>server content</span>
        </ServerThemeProvider>
      );

      expect(markup).toContain('server content');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('defaults to system theme', () => {
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('effective')).toHaveTextContent('light');
  });

  it('reads stored theme from localStorage', () => {
    mockLocalStorage['debt-master-theme'] = 'dark';
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('effective')).toHaveTextContent('dark');
  });

  it('falls back to the system theme for an invalid stored value', () => {
    mockLocalStorage['debt-master-theme'] = 'invalid';
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
  });

  it('detects dark system preference', () => {
    mockMatchMedia.mockReturnValue(true);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('effective')).toHaveTextContent('dark');
  });

  it('changes theme and persists to localStorage', async () => {
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText('Set Dark').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });
    expect(localStorage.getItem('debt-master-theme')).toBe('dark');
  });

  it('adds dark class to document when dark', () => {
    mockMatchMedia.mockReturnValue(true);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('adds light class when explicitly light', async () => {
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText('Set Light').click();
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });
  });

  it('listens to system preference changes', () => {
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates the effective theme after a system preference change', () => {
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    mockMatchMedia.mockReturnValue(true);
    act(() => {
      getChangeListener()();
    });

    expect(screen.getByTestId('effective')).toHaveTextContent('dark');
  });

  it('ignores system preference changes when an explicit theme is selected', () => {
    mockMatchMedia.mockReturnValue(false);
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText('Set Dark').click();
    });
    mockMatchMedia.mockReturnValue(false);
    act(() => {
      getChangeListener()();
    });

    expect(screen.getByTestId('effective')).toHaveTextContent('dark');
  });
});
