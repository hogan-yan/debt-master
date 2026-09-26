import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { LandingPage } from '../-landing-page';

// LandingPage no longer reads useTheme(): scene tokens are CSS custom
// properties (`hsl(var(--…))`) that resolve against the theme class the
// pre-paint script sets on <html> — so there is no bake-light-then-flip and
// no refresh flash for dark-theme visitors. No theme mock needed.

// Remotion players are irrelevant to the token assertions and heavy in jsdom.
vi.mock('@/components/landing/ledger-hero', () => ({ default: () => null }));
vi.mock('@/components/landing/ledger-scenes', () => ({ default: () => null }));

// TornEdge renders the only aria-hidden divs on the page: hero card, 3 step
// cards, 2 on the CTA band (top + flipped bottom) — 6 total.
function tornEdgesFrom(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('div[aria-hidden="true"]'));
}

describe('landing page theme-neutral scene tokens', () => {
  afterEach(cleanup);

  it('canvas carries no background texture (ruled paper removed by owner call)', () => {
    render(<LandingPage />);
    const canvas = screen.getByTestId('landing-page');
    expect(canvas.classList.contains('ruled-paper')).toBe(false);
    expect(canvas.style.backgroundImage).toBe('');
  });

  it('the 4 card teeth tear in the themed surface via var(), CTA band teeth stay ink', () => {
    render(<LandingPage />);
    const edges = tornEdgesFrom(screen.getByTestId('landing-page'));
    expect(edges).toHaveLength(6);
    const themed = edges.filter((el) => el.style.background.includes('hsl(var(--background))'));
    // jsdom's CSSOM normalizes the authored ink literal (hsl(0 0% 8%)) to rgb.
    const ink = edges.filter((el) => el.style.background.includes('rgb(20, 20, 20)'));
    expect(themed).toHaveLength(4);
    expect(ink).toHaveLength(2);
  });

  it('ssr bake carries var() tokens — identical HTML for every theme, no light literals', () => {
    const html = renderToString(<LandingPage />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const edges = tornEdgesFrom(doc);
    expect(edges).toHaveLength(6);
    // A light-only bake would carry the literal white surface into the SSR
    // HTML and flash dark-theme visitors on refresh; the themed value must
    // be the var() reference instead.
    expect(
      edges.filter((el) => el.style.background.includes('hsl(var(--background))'))
    ).toHaveLength(4);
    expect(html).not.toContain('hsl(0 0% 100%)');
    expect(html).not.toContain('hsl(222.2 84% 4.9%)');
    expect(html).not.toContain('#ffffff');
  });
});
