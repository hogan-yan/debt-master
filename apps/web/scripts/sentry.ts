/**
 * Sentry error reporting for the production server (Bun runtime).
 *
 * Init is gated on `SENTRY_DSN` — without a DSN the SDK stays completely
 * inert, mirroring the mobile app's `src/lib/observability/sentry.ts`
 * philosophy (dev/preview crash silently to the console). The DSN itself is
 * provisioned by the infrastructure repo: k3s-terraform manages a GlitchTip
 * (Sentry-compatible) project per app and injects the public DSN as the
 * `SENTRY_DSN` env var on the deployment.
 *
 * `initSentry()` must be the first statement `scripts/server.ts` runs — the
 * SDK is then live before any request or process-level error can happen.
 * (Import-time failures of the built SSR bundle stay uncapturable by design:
 * a broken build artifact is not a runtime error to report.)
 *
 * No PII: `sendDefaultPii` stays false (the default) and no request bodies
 * are captured — server errors carry stacks and route context only.
 *
 * Best-effort: capture failures never change crash semantics — the process
 * still exits after a bounded flush window (crash-only model, orchestrator
 * restarts a clean process).
 */
import * as Sentry from '@sentry/bun';

/** True when a DSN is wired; used to keep un-wired exits fast. */
function dsn(): string | undefined {
  return process.env.SENTRY_DSN;
}

/** Initialize the SDK. Inert without SENTRY_DSN. Call once, first thing. */
export function initSentry(): void {
  Sentry.init({
    dsn: dsn(),
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  });
}

/**
 * Capture a request-scoped error without changing control flow (used by the
 * Bun.serve error handler, which still returns the 500 response itself).
 */
export function captureError(error: unknown): void {
  // The 500 must also reach stdout — Sentry capture alone is silent when no
  // DSN is wired (this exact silence hid a prod outage for hours).
  // biome-ignore lint/suspicious/noConsole: deliberate server-side error log.
  console.error('[server error]', error);
  Sentry.captureException(error);
}

/**
 * Capture a process-fatal error and exit. Keeps the crash-only contract of
 * scripts/server.ts (the orchestrator restarts a clean process) while giving
 * the SDK a bounded window to deliver the event before the process dies.
 */
export function captureFatalAndExit(error: unknown): void {
  if (!dsn()) {
    process.exit(1);
  }
  Sentry.captureException(error);
  void Sentry.flush(2000).finally(() => process.exit(1));
}
