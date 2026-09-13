/**
 * Root route — two faces:
 *  - Logged-out visitors get the public landing page (SSR-rendered so
 *    crawlers see full content; this is the only indexable surface).
 *  - Signed-in users get the dashboard, unchanged.
 *
 * The DashboardPage component is imported from a separate file (prefixed with
 * "-") so that TanStack Router can code-split it properly instead of inlining
 * all 1,300+ lines of dashboard component code into the initial bundle. The
 * landing page follows the same pattern.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import { APP_URL } from '@/utils/app-url';
import { useAuth } from '@/utils/auth-context';
import { DashboardPage } from './-dashboard-page';
import { LandingPage } from './-landing-page';

// Mirrors project.inlang/settings.json locales; base locale has no URL
// prefix (paraglide URL strategy), the others are served under their prefix.
const BASE_LOCALE = 'en';
const LOCALES = ['en', 'ja', 'zh-tw'] as const;

function localePathPrefix(): string {
  try {
    const locale = getLocale();
    return locale === BASE_LOCALE ? '' : `/${locale}`;
  } catch {
    // Outside a request/render context (e.g. unit tests): base locale.
    return '';
  }
}

function debtorCount(loaderData: unknown): number {
  if (typeof loaderData !== 'object' || loaderData === null || !('debtLeaderboard' in loaderData)) {
    return 0;
  }
  const leaderboard: unknown = loaderData.debtLeaderboard;
  if (typeof leaderboard !== 'object' || leaderboard === null || !('debtors' in leaderboard)) {
    return 0;
  }
  const debtors: unknown = leaderboard.debtors;
  return Array.isArray(debtors) ? debtors.length : 0;
}

const EMPTY_DASHBOARD = {
  debtLeaderboard: { debtors: [], maxDebtAmount: 0 },
  debtOverview: {
    totalDebtOutstanding: 0,
    totalLunches: 0,
    averageLunchCost: 0,
    favoriteSpot: { name: m.dashboard_noData(), visits: 0 },
    totalLunchMoneySpent: 0,
    lunchParticipationRate: 0,
    daysSinceLastPayment: 0,
    debtTrend: 'stable' as const,
    urgentDebtCount: 0,
    teamSize: 0,
    restaurantCount: 0,
    averageCostPerPerson: 0,
  },
};

export const Route = createFileRoute('/')({
  component: () => {
    const { debtLeaderboard, debtOverview } = Route.useLoaderData();
    return <HomeGate debtLeaderboard={debtLeaderboard} debtOverview={debtOverview} />;
  },
  head: (ctx) => {
    // With SSR dashboard data the visitor is signed in — keep the dashboard
    // title. Everyone else (including crawlers) gets the landing meta.
    if (debtorCount(ctx.loaderData) > 0) {
      return { meta: [{ title: 'Dashboard — Debt Master' }] };
    }

    const title = m.landing_meta_title();
    const description = m.landing_meta_description();
    const selfUrl = `${APP_URL}${localePathPrefix()}/`;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Debt Master' },
        { property: 'og:url', content: selfUrl },
        { property: 'og:image', content: `${APP_URL}/og-image.png` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: `${APP_URL}/og-image.png` },
      ],
      // Hreflang is reciprocal and every entry returns 200 with real
      // localized content (ssr.tsx wires paraglide's URL strategy), so the
      // cluster is valid — self-referencing canonical included.
      links: [
        { rel: 'canonical', href: selfUrl },
        ...LOCALES.map((locale) => ({
          rel: 'alternate',
          // TanStack's head serializer renders props verbatim (no React
          // attr-casing map); hreflang is case-insensitive in HTML.
          hrefLang: locale,
          href: `${APP_URL}${locale === BASE_LOCALE ? '' : `/${locale}`}/`,
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: `${APP_URL}/` },
      ],
    };
  },
  loader: async () => {
    try {
      const debtAnalytics = await import('@/server/debt-analytics');

      const [debtLeaderboard, debtOverview] = await Promise.all([
        debtAnalytics.getDebtLeaderboard(),
        debtAnalytics.getDebtOverviewMetrics(),
      ]);

      return { debtLeaderboard, debtOverview };
    } catch {
      return EMPTY_DASHBOARD;
    }
  },
});

function HomeGate(props: {
  debtLeaderboard: ReturnType<typeof Route.useLoaderData>['debtLeaderboard'];
  debtOverview: ReturnType<typeof Route.useLoaderData>['debtOverview'];
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // SSR data proves a signed-in session — skip the landing entirely.
  if (props.debtLeaderboard.debtors.length > 0) {
    return (
      <DashboardPage debtLeaderboard={props.debtLeaderboard} debtOverview={props.debtOverview} />
    );
  }

  // Hydrated or not, while auth is still resolving keep showing the landing:
  // this is the public indexable surface, and swapping it for a spinner made
  // EVERY visitor flash landing → spinner → landing (it also restarted the
  // hero animation mid-play for anonymous users). The resolved states below
  // are the only ones allowed to swap the view.
  if (!isHydrated || isLoading) {
    return <LandingPage />;
  }

  if (isAuthenticated) {
    return (
      <DashboardPage debtLeaderboard={props.debtLeaderboard} debtOverview={props.debtOverview} />
    );
  }

  return <LandingPage />;
}

export default DashboardPage;
