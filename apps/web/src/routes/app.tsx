/**
 * Public landing page for the Debt Master mobile app (/app). Static and
 * indexable like / — crawlers get SSR content, no auth, no loader. The
 * meta/hreflang cluster mirrors the landing route: every locale URL is a
 * real page (paraglide URL strategy), so the reciprocal cluster is valid.
 */

import { createFileRoute } from '@tanstack/react-router';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import { APP_URL } from '@/utils/app-url';
import { AppLandingPage } from './-app-landing-page';

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

export const Route = createFileRoute('/app')({
  component: AppLandingPage,
  head: () => {
    const title = m.app_landing_meta_title();
    const description = m.app_landing_meta_description();
    const selfUrl = `${APP_URL}${localePathPrefix()}/app`;
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
      links: [
        { rel: 'canonical', href: selfUrl },
        ...LOCALES.map((locale) => ({
          rel: 'alternate',
          hrefLang: locale,
          href: `${APP_URL}${locale === BASE_LOCALE ? '' : `/${locale}`}/app`,
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: `${APP_URL}/app` },
      ],
    };
  },
});

export default AppLandingPage;
