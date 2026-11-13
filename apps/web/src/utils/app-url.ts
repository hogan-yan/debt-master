/**
 * Canonical public origin of this deployment.
 *
 * Resolution order:
 *  1. `process.env.PUBLIC_APP_URL` — runtime env on the server (SSR head
 *     tags, robots/sitemap generation). This is the only way a single built
 *     image can serve the right URLs per environment (dev vs prod domains).
 *  2. `import.meta.env.PUBLIC_APP_URL` — build-time inline, used on the
 *     client where `process` does not exist. Cosmetic there (head tags were
 *     already rendered server-side); set it in CI to keep client-side head
 *     updates consistent after hydration.
 *  3. Local development fallback.
 *
 * Keep in sync with `scripts/generate-sitemap.mjs`, which reads the env var
 * directly at build time.
 */
export const APP_URL: string =
  (typeof process !== 'undefined' && process.env?.PUBLIC_APP_URL) ||
  import.meta.env.PUBLIC_APP_URL ||
  'http://localhost:3000';
