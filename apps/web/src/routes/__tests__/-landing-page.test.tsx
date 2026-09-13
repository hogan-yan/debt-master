import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../-landing-page';

const mocks = vi.hoisted(() => ({
  effectiveTheme: 'light' as 'light' | 'dark',
}));

// LandingPage reads useTheme() for scene tokens + torn-edge paper color; the
// mock pins the resolved theme without needing ThemeProvider or matchMedia.
vi.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: mocks.effectiveTheme,
    effectiveTheme: mocks.effectiveTheme,
    setTheme: () => {},
  }),
}));

// Remotion players are irrelevant to the texture assertions and heavy in jsdom.
vi.mock('@/components/landing/ledger-hero', () => ({ default: () => null }));
vi.mock('@/components/landing/ledger-scenes', () => ({ default: () => null }));

// TornEdge renders the only aria-hidden divs on the page: hero card, 3 step
// cards, 2 on the CTA band (top + flipped bottom) — 6 total.

// jsdom's CSSOM normalizes the authored tokens, so teeth are matched by their
// resolved rgb values: hsl(0 0% 100%) -> rgb(255, 255, 255) (white paper),
// hsl(0 0% 8%) -> rgb(20, 20, 20) (ink band / dark paper).
const WHITE_PAPER = 'rgb(255, 255, 255)';
const DARK_PAPER = 'rgb(20, 20, 20)';

// LandingPage mounts light and flips to the real theme after mount (hydration
// keeps SSR-baked inline styles, so the flip is what patches them). RTL's
// render() flushes effects inside act, so a render()'d tree is the SETTLED
// state; the pre-flip bake is observable via renderToString (no effects).
function tornEdgesFrom(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('div[aria-hidden="true"]'));
}

describe('landing page theme-aware textures', () => {
  afterEach(cleanup);

  it('canvas carries no background texture (ruled paper removed by owner call)', () => {
    render(<LandingPage />);
    const canvas = screen.getByTestId('landing-page');
    expect(canvas.classList.contains('ruled-paper')).toBe(false);
    expect(canvas.style.backgroundImage).toBe('');
  });

  it('light mode: exactly the 4 card teeth are white paper (CTA band teeth stay ink)', () => {
    render(<LandingPage />);
    const white = tornEdgesFrom(screen.getByTestId('landing-page')).filter((el) =>
      el.style.background.includes(WHITE_PAPER)
    );
    expect(white).toHaveLength(4);
  });

  it('dark mode (settled): no white teeth anywhere, card teeth match the dark paper', async () => {
    mocks.effectiveTheme = 'dark';
    render(<LandingPage />);
    // render() flushes the mount flip inside act, but waitFor keeps this
    // robust if effect flushing is ever async in a future React version.
    const edges = await waitFor(() => {
      const found = tornEdgesFrom(screen.getByTestId('landing-page'));
      expect(found).toHaveLength(6);
      return found;
    });
    const white = edges.filter((el) => el.style.background.includes(WHITE_PAPER));
    expect(white).toHaveLength(0);
    const darkPaper = edges.filter((el) => el.style.background.includes(DARK_PAPER));
    expect(darkPaper.length).toBeGreaterThanOrEqual(5);
  });

  it('ssr bake (and first client render) is light tokens even for dark-theme visitors', () => {
    mocks.effectiveTheme = 'dark';
    const html = renderToString(<LandingPage />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const edges = tornEdgesFrom(doc);
    expect(edges).toHaveLength(6);
    // Pre-mount, the 4 card teeth bake white (matching SSR); the 2 CTA-band
    // teeth stay ink — theme-invariant by design.
    const white = edges.filter((el) => el.style.background.includes(WHITE_PAPER));
    expect(white).toHaveLength(4);
    const darkPaper = edges.filter((el) => el.style.background.includes(DARK_PAPER));
    expect(darkPaper).toHaveLength(2);
  });
});
