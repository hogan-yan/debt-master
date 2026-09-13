import { createServerFn } from '@tanstack/react-start';

/**
 * Public analytics configuration for the browser. The Umami endpoint and
 * website id ship in the page HTML by design (every Umami deployment exposes
 * them client-side), so this server function needs no auth — it exists only
 * to keep runtime env access server-side (same pattern as turnstile.ts) and
 * to keep the values out of the client bundle.
 */
export const getPublicAnalyticsConfig = createServerFn({ method: 'GET' }).handler(() => ({
  umamiUrl: process.env.UMAMI_URL || null,
  umamiWebsiteId: process.env.UMAMI_WEBSITE_ID || null,
}));
