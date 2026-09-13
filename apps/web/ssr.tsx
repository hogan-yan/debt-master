/**
 * Custom SSR entry — wires paraglide's server middleware so `getLocale()`
 * resolves from the request URL (AsyncLocalStorage) during SSR. Without it,
 * `/ja/` and `/zh-tw/` delocalize to `/` in the router and get rewritten
 * back (307) instead of serving localized content.
 *
 * The router (src/router.tsx) owns URL localization via `rewrite`, so the
 * ORIGINAL request is passed through — per paraglide's docs, when the
 * framework localizes URLs itself, the middleware should only establish the
 * locale context; handing it the delocalized request would cause redirect
 * loops.
 */
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { paraglideMiddleware } from '@/paraglide/server';

const fetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => fetch(request));
  },
};
