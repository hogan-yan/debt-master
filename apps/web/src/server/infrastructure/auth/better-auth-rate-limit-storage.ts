/**
 * Better Auth rate-limit storage backed by the shared Valkey client.
 *
 * better-auth's own limiter defaults to a per-pod in-memory Map: with 2
 * replicas the budget doubles and every restart wipes blocks. Wiring this as
 * `rateLimit.customStorage` (NOT `secondaryStorage` — providing that also
 * reroutes session storage out of Postgres and changes revocation semantics)
 * plugs the shared store into the `/api/auth/*` mount. `consume` is an atomic
 * SET NX PX + INCR window, the same shape as `checkValkeyRateLimit`.
 *
 * Failure mode is FAIL-OPEN: a Valkey outage returns "allowed" instead of
 * taking login down with the cache — login availability beats limiter
 * precision, matching `rate-limit-store.ts`'s degrade-to-memory philosophy
 * (better-auth offers no per-request fallback, so fail-open is the equivalent).
 *
 * Server-only: loads ioredis lazily via rate-limit-store's client. Never
 * re-export from client-reachable modules.
 */

import { getValkeyClient, shouldUseValkey } from './rate-limit-store';

/**
 * Shape better-auth's rate limiter reads via `get` — its `RateLimit` type
 * (`@better-auth/core/dist/db/schema/rate-limit`), `key` included.
 */
export interface BetterAuthRateLimitRecord {
  readonly key: string;
  readonly count: number;
  readonly lastRequest: number;
}

/**
 * Structurally matches better-auth 1.6.23's `BetterAuthRateLimitStorage`
 * (`@better-auth/core/dist/types/init-options.d.mts`). `window`/`rule.window`
 * are in SECONDS; Valkey TTLs below are milliseconds.
 */
export interface BetterAuthRateLimitStorage {
  get: (key: string) => Promise<BetterAuthRateLimitRecord | null | undefined>;
  set: (key: string, value: BetterAuthRateLimitRecord, update?: boolean) => Promise<void>;
  consume: (
    key: string,
    rule: { window: number; max: number }
  ) => Promise<{ allowed: boolean; retryAfter: number | null }>;
}

const WINDOW_KEY_PREFIX = 'rl:ba:';
const ROW_KEY_PREFIX = 'rl:ba-row:';
const ROW_TTL_MS = 24 * 60 * 60 * 1000;

function isRateLimitRecord(value: unknown): value is BetterAuthRateLimitRecord {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'key' in value &&
    typeof value.key === 'string' &&
    'count' in value &&
    typeof value.count === 'number' &&
    'lastRequest' in value &&
    typeof value.lastRequest === 'number'
  );
}

/**
 * Build the storage when the deploy has Valkey configured; `null` keeps
 * better-auth's built-in per-pod memory limiter (single-replica deploys).
 */
export function buildBetterAuthRateLimitStorage(): BetterAuthRateLimitStorage | null {
  if (!shouldUseValkey()) return null;

  return {
    consume: async (key, rule) => {
      try {
        const client = await getValkeyClient();
        const windowKey = `${WINDOW_KEY_PREFIX}${key}`;
        // Pins the window expiry on the first attempt; a no-op while it lives.
        await client.set(windowKey, '0', 'PX', rule.window * 1000, 'NX');
        const count = await client.incr(windowKey);
        return count > rule.max
          ? { allowed: false, retryAfter: rule.window }
          : { allowed: true, retryAfter: null };
      } catch {
        return { allowed: true, retryAfter: null };
      }
    },
    get: async (key) => {
      try {
        const client = await getValkeyClient();
        const raw = await client.get(`${ROW_KEY_PREFIX}${key}`);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isRateLimitRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    set: async (key, value) => {
      try {
        const client = await getValkeyClient();
        await client.set(`${ROW_KEY_PREFIX}${key}`, JSON.stringify(value), 'PX', ROW_TTL_MS, 'NX');
      } catch {
        // The authoritative path is `consume`; `set` is best-effort compat.
      }
    },
  };
}
