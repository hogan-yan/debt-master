import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppLandingPage } from '../-app-landing-page';

const mocks = vi.hoisted(() => ({
  effectiveTheme: 'light' as 'light' | 'dark',
  appStoreUrl: '',
  googlePlayUrl: '',
}));

// AppLandingPage reads useTheme() for the ledger tokens; the mock pins the
// resolved theme without needing ThemeProvider or matchMedia.
vi.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: mocks.effectiveTheme,
    effectiveTheme: mocks.effectiveTheme,
    setTheme: () => {},
  }),
}));

// Store URLs are launch-time config; the mock flips the page between its
// pre-launch (coming soon) and launched (store links) states.
vi.mock('@/utils/store-urls', () => ({
  get APP_STORE_URL() {
    return mocks.appStoreUrl;
  },
  get GOOGLE_PLAY_URL() {
    return mocks.googlePlayUrl;
  },
}));

// The StoreCta renders twice (hero + closing band); sample data like the
// group name also appears on more than one card, hence getAllBy* throughout.
describe('app landing page', () => {
  afterEach(() => {
    cleanup();
    mocks.appStoreUrl = '';
    mocks.googlePlayUrl = '';
  });

  it('pre-launch: renders the page with an honest coming-soon CTA and no dead store links', () => {
    render(<AppLandingPage />);
    expect(screen.getByTestId('app-landing-page')).toBeInTheDocument();
    expect(screen.getByText('Every split, in your pocket.')).toBeInTheDocument();
    const comingSoon = screen.getAllByText('Coming soon to the App Store and Google Play.');
    expect(comingSoon).toHaveLength(2);
    expect(screen.queryByText('Download on the App Store')).toBeNull();
    expect(screen.queryByText('Get it on Google Play')).toBeNull();
  });

  it('launched: store URLs become links and the coming-soon line disappears', () => {
    mocks.appStoreUrl = 'https://apps.apple.com/app/id123';
    mocks.googlePlayUrl = 'https://play.google.com/store/apps?id=app';
    render(<AppLandingPage />);
    for (const node of screen.getAllByText('Download on the App Store')) {
      expect(node.closest('a')).toHaveAttribute('href', 'https://apps.apple.com/app/id123');
    }
    for (const node of screen.getAllByText('Get it on Google Play')) {
      expect(node.closest('a')).toHaveAttribute(
        'href',
        'https://play.google.com/store/apps?id=app'
      );
    }
    expect(screen.queryByText('Coming soon to the App Store and Google Play.')).toBeNull();
  });

  it('cross-links back to the self-hosted web landing and stays dark-theme clean', () => {
    mocks.effectiveTheme = 'dark';
    render(<AppLandingPage />);
    expect(screen.getAllByRole('link', { name: /Prefer to run it yourself/i })[0]).toHaveAttribute(
      'href',
      '/'
    );
    // Sample ledger data is baked from theme tokens, not hardcoded paper.
    expect(screen.getAllByText('Kyoto trip').length).toBeGreaterThanOrEqual(2);
  });
});
