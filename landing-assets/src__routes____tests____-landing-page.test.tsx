import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../-landing-page';

vi.mock('@/hooks', () => ({
  useTheme: () => ({ theme: 'light', effectiveTheme: 'light', setTheme: () => {} }),
}));
vi.mock('@/components/landing/ledger-hero', () => ({ default: () => null }));
vi.mock('@/components/landing/ledger-scenes', () => ({ default: () => null }));

describe('landing page structure', () => {
  afterEach(cleanup);

  it('renders hero, strip, how-it-works, faq, and cta — nothing else', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.getByText('Every lunch, on the record.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument();
    expect(screen.getByText('Questions, answered')).toBeInTheDocument();
    // The cut sections stay cut.
    expect(screen.queryByText('Payments on the record.')).toBeNull();
    expect(screen.queryByText('The tab, ranked.')).toBeNull();
    expect(screen.queryByText("Know the team's favorite.")).toBeNull();
  });

  it('faq carries exactly three questions', () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll('details')).toHaveLength(3);
  });

  it('figures are straight — no tilt classes survive the de-kitsch pass', () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector('[class*="rotate-"]')).toBeNull();
  });

  it('primary actions are Get started links pointing at the docs', () => {
    render(<LandingPage />);
    const started = screen.getAllByRole('link', { name: 'Get started' });
    expect(started.length).toBeGreaterThanOrEqual(2);
    for (const link of started) {
      expect(link.getAttribute('href')).toMatch(/^\/docs/);
    }
  });
});
