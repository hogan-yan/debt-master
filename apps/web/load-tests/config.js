// Shared config for all load tests. Targets the Debt Master web app
// (TanStack Start SSR pages + cheap /health probe).
//
// Env vars (all optional):
//   BASE_URL        — target origin, default http://localhost:3000
//   SESSION_COOKIE  — raw Cookie header from an authenticated browser tab
//                     (e.g. "better-auth.session_token=..."). When set, the
//                     journey test also hits authed SSR pages. We do NOT
//                     script the login POST: Turnstile protects it, and a
//                     replayed login at load would only measure the captcha.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Raw cookie header forwarded verbatim on authed requests. Empty string when
// unset so headers stay a plain string map.
export const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';

export function authedHeaders() {
  return SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {};
}

// SSR pages exercised by the tests. Public = no session needed.
export const PUBLIC_PAGES = [
  { path: '/', name: 'landing' },
  { path: '/app', name: 'app-landing' },
  { path: '/login', name: 'login' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
];

// Authed pages render the app shell + DB-backed lists.
export const AUTHED_PAGES = [
  { path: '/expenses', name: 'expenses' },
  { path: '/payments', name: 'payments' },
  { path: '/restaurants', name: 'restaurants' },
  { path: '/colleagues', name: 'colleagues' },
];

// Baseline thresholds for a single small self-hosted pod. Tune after the
// first baseline run — record numbers in README.md > Baseline.
export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<800', 'p(99)<1500'],
  http_req_failed: ['rate<0.01'],
};

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Realistic think time: 1–4s between page views.
export function thinkTime() {
  return Math.random() * 3 + 1;
}
