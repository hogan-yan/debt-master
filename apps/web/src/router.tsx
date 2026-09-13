import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import {
  baseLocale,
  deLocalizeUrl,
  getLocale,
  type Locale,
  localizeUrl,
} from '@/paraglide/runtime';
import { routeTree } from './routeTree.gen';

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    trailingSlash: 'always',
    rewrite: {
      input: ({ url }) => {
        return deLocalizeUrl(url);
      },
      output: ({ url }) => {
        const hadTrailingSlash = url.pathname.endsWith('/');
        let locale: Locale = baseLocale;
        try {
          locale = getLocale();
        } catch {
          // ALS context unavailable (e.g. during router.update() init)
        }
        const result = localizeUrl(url, { locale });
        if (hadTrailingSlash && !result.pathname.endsWith('/')) {
          result.pathname += '/';
        }
        return result;
      },
    },
  });

  return router;
}

let clientRouterInstance: ReturnType<typeof createRouter> | undefined;

export function getRouter() {
  if (typeof window === 'undefined') {
    // SSR: fresh router per request avoids stale redirect state
    return createRouter();
  }
  if (!clientRouterInstance) {
    clientRouterInstance = createRouter();
  }
  return clientRouterInstance;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
