/**
 * Per-request access-code status check — session revocation.
 *
 * Auth JWTs are verified by signature only, so a token issued for a code that
 * was later deactivated or soft-deleted used to stay valid until expiry — and
 * the cookie path re-signed a fresh expiry on every request, making a used
 * session effectively immortal. This lookup makes every cookie-authenticated
 * request re-check the code row, so revocation takes effect within
 * STATUS_CACHE_TTL_SECONDS (bounded per-pod in the in-memory cache backend,
 * effectively immediate cluster-wide via Valkey).
 *
 * Server-only: imports prisma. Never re-export from client-reachable modules.
 */
import { getCacheAdapter } from '@/server/infrastructure/cache';
import { prisma } from '@/server/infrastructure/prisma';

const STATUS_CACHE_TTL_SECONDS = 30;

const statusCacheKey = (id: number): string => `access-code-status:${id}`;

/**
 * Whether the access code backing a session is still active (exists, active,
 * not soft-deleted). Cached briefly so the common path costs no DB round-trip.
 */
export async function isAccessCodeActive(id: number): Promise<boolean> {
  const cache = await getCacheAdapter();
  const cached = await cache.get<boolean>(statusCacheKey(id));
  if (cached !== null) return cached;

  const code = await prisma.accessCode.findUnique({
    where: { id },
    select: { isActive: true, deletedAt: true },
  });
  const active = Boolean(code?.isActive) && code?.deletedAt == null;
  await cache.set(statusCacheKey(id), active, STATUS_CACHE_TTL_SECONDS);
  return active;
}

/**
 * Evict the cached status after a code is deactivated, reactivated, or
 * soft-deleted, so revocation lands immediately (shared-cache backends evict
 * across pods; in-memory backends fall back to the TTL).
 */
export async function invalidateAccessCodeStatus(id: number): Promise<void> {
  const cache = await getCacheAdapter();
  await cache.delete(statusCacheKey(id));
}
