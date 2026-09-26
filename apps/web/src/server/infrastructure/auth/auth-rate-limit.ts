/**
 * Server-only rate limiting for access-code validation.
 *
 * Split out of `auth-server-utils.ts` because it depends on request-context
 * primitives (`@tanstack/start-server-core`), which transitively pull in a
 * top-level `new AsyncLocalStorage()` (node:async_hooks). `auth-server-utils.ts`
 * exports JWT helpers (`verifyToken`) that are reachable from the CLIENT bundle
 * via plain re-exports in `@/server/auth`; keeping request access there crashed
 * the browser with "node:async_hooks has been externalized". This file is only
 * imported via a dynamic `import()` inside server-fn handlers, so it never
 * enters the client graph.
 */

import { getRequestClientIp } from '../network';
import { hashIdentifier, RATE_LIMIT } from './auth-server-utils';
import { checkSharedRateLimit } from './rate-limit-store';

/**
 * Identify the rate-limit subject for the current request.
 *
 * Uses the rightmost-trusted-XFF resolver (`getRequestClientIp`) rather than
 * the raw socket peer: behind the k8s ingress every request shares one peer
 * address, so a socket-IP key collapses the per-IP buckets into a single
 * cluster-wide bucket (one attacker can lock out every user's login).
 * Falls back to 'unknown' when no IP can be resolved.
 */
export async function getClientIdentifier(): Promise<string> {
  try {
    return (await getRequestClientIp()) ?? 'unknown';
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
