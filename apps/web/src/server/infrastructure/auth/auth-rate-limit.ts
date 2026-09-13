/**
 * Server-only rate limiting for access-code validation.
 *
 * Split out of `auth-server-utils.ts` because it depends on TanStack Start's
 * `getRequestIP`, which transitively pulls `@tanstack/start-server-core` and its
 * top-level `new AsyncLocalStorage()` (node:async_hooks). `auth-server-utils.ts`
 * exports JWT helpers (`verifyToken`) that are reachable from the CLIENT bundle
 * via plain re-exports in `@/server/auth`; keeping `getRequestIP` there crashed
 * the browser with "node:async_hooks has been externalized". This file is
 * `.server.ts` and is only imported via a dynamic `import()` inside server-fn
 * handlers, so it never enters the client graph.
 */

import { hashIdentifier, RATE_LIMIT } from './auth-server-utils';
import { checkSharedRateLimit } from './rate-limit-store';

/**
 * Get client IP from request context using TanStack Start's getRequestIP.
 * Falls back to 'unknown' if IP cannot be determined.
 */
export async function getClientIdentifier(): Promise<string> {
  try {
    // Server-only primitive (node:async_hooks) — lazy import keeps this module
    // safe to dynamic-import anywhere on the server.
    const { getRequestIP } = await import('@tanstack/start-server-core');
    const ip = await getRequestIP();
    return ip ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Rate limit check for access code validation.
 *
 * Two buckets must BOTH allow the attempt:
 *  - per-IP: caps how many distinct codes one client may try per window, so
 *    an attacker cannot rotate codes to escape a per-code limit (code
 *    enumeration);
 *  - per code+IP: caps guesses against any single code.
 */
export async function checkAccessCodeRateLimit(code: string): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  blockedForMs?: number;
}> {
  if (process.env.TEST_SKIP_RATE_LIMIT === '1') {
    return { allowed: true, remainingAttempts: 999 };
  }
  const hashedCode = hashIdentifier(code);
  const clientId = await getClientIdentifier();

  const ipResult = await checkSharedRateLimit(
    `access_code_ip:${clientId}`,
    RATE_LIMIT.ACCESS_CODE_IP
  );
  if (!ipResult.allowed) return ipResult;

  return await checkSharedRateLimit(
    `access_code:${hashedCode}:${clientId}`,
    RATE_LIMIT.ACCESS_CODE
  );
}
