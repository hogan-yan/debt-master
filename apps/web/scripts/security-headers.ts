/**
 * Baseline security headers applied by `scripts/server.ts` to every response
 * it emits (static, SSR, health). The reverse proxy is owned by an external
 * repo, so the app cannot assume it sets anything — these ship regardless.
 *
 * CSP is deliberately absent: a correct policy needs a live inventory of
 * third-party script sources (Umami, Turnstile, webfonts). Add it only with
 * that inventory; a guessed CSP breaks the app in prod.
 */

const BASE_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Copy the response with the baseline headers added. The baseline wins over
 * same-name headers on the incoming response; all other existing headers are
 * preserved untouched.
 */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_HEADERS)) {
    headers.set(name, value);
  }
  // HSTS is opt-in: only correct when TLS terminates in front of this
  // process, and it pins for months — never safe to guess.
  if (process.env.ENABLE_HSTS === 'true') {
    headers.set('Strict-Transport-Security', 'max-age=15552000');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
