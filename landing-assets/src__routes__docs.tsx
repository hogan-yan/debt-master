/**
 * Public docs route (/docs) — user guide for using and self-hosting Debt
 * Master. Static SSR like the landing routes; indexable, no auth, no loader.
 */

import { createFileRoute } from '@tanstack/react-router';
import { APP_URL } from '@/utils/app-url';
import { DocsPage } from './-docs-page';

export const Route = createFileRoute('/docs')({
  component: DocsPage,
  head: () => {
    const title = 'Debt Master — Docs';
    const description =
      'How to use Debt Master: roles, the daily expense loop, and how to self-host it with Docker Compose.';
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Debt Master' },
        { property: 'og:url', content: `${APP_URL}/docs` },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [{ rel: 'canonical', href: `${APP_URL}/docs` }],
    };
  },
});

export default DocsPage;
