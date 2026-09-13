/**
 * Shared rate-limit store.
 *
 * The previous limiter was a per-pod in-memory Map: every replica enforced its
 * own budget (2 pods = 2× the attempts) and a restart wiped every block.
 * This store puts the buckets in Valkey when the deploy selects the valkey
 * cache provider (same VALKEY_* env as the cache adapter), using atomic
 * INCR/PEXPIRE windows so the budget is cluster-wide, and falls back to the
 * in-memory limiter when Valkey is not configured — or errors at runtime — so
 * a cache outage degrades to the old per-pod behavior instead of breaking
 * login.
 *
 * Server-only: dynamically imports ioredis. Never re-export from
 * client-reachable modules.
 */

import { checkRateLimit, type RateLimitConfig, type RateLimitResult } from './auth-server-utils';

type RedisClient = {
  set: (
    key: string,
    value: string,
    mode: 'PX',
    ttl: number,
    condition: 'NX'
  ) => Promise<string | null>;
  incr: (key: string) => Promise<number>;
  pttl: (key: string) => Promise<number>;
  del: (key: string) => Promise<number>;
};

let clientPromise: Promise<RedisClient> | null = null;

function shouldUseValkey(): boolean {
  return (
    Boolean(process.env.VALKEY_URL || process.env.VALKEY_HOST) ||
    process.env.CACHE_PROVIDER === 'valkey'
  );
}

async function getValkeyClient(): Promise<RedisClient> {
  if (!clientPromise) {
    clientPromise = import('ioredis').then((mod) => {
      const Redis = mod.default;
      const url = process.env.VALKEY_URL;
      const client = url
        ? new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1 })
        : new Redis({
            host: process.env.VALKEY_HOST || 'localhost',
            port: Number.parseInt(process.env.VALKEY_PORT || '6379', 10),
            ...(process.env.VALKEY_PASSWORD ? { password: process.env.VALKEY_PASSWORD } : {}),
            lazyConnect: false,
            maxRetriesPerRequest: 1,
          });
      // Swallow connection errors here — the limiter falls back to memory
      // per call; an unhandled 'error' event would crash the process.
      client.on('error', () => {});
      return client;
    });
  }
  return clientPromise;
}

/**
 * Atomic Valkey window: SET NX PX pins the window start, INCR counts within
 * it, and the block key carries the block duration as its TTL.
 */
async function checkValkeyRateLimit(
  client: RedisClient,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowKey = `rl:win:${key}`;
  const blockKey = `rl:block:${key}`;

  const blockTtl = await client.pttl(blockKey);
  if (blockTtl > 0) {
    return { allowed: false, remainingAttempts: 0, blockedForMs: blockTtl };
  }

  // Pins the window expiry on first attempt; a no-op while the window lives.
  await client.set(windowKey, '0', 'PX', config.windowMs, 'NX');
  const count = await client.incr(windowKey);

  if (count > config.maxAttempts) {
    await client.set(blockKey, '1', 'PX', config.blockDurationMs, 'NX');
    await client.del(windowKey);
    return { allowed: false, remainingAttempts: 0, blockedForMs: config.blockDurationMs };
  }

  return { allowed: true, remainingAttempts: config.maxAttempts - count };
}

/**
 * Rate-limit check against the shared store. Result shape matches the
 * in-memory {@link checkRateLimit}.
 */
export async function checkSharedRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (shouldUseValkey()) {
    try {
      const client = await getValkeyClient();
      return await checkValkeyRateLimit(client, key, config);
    } catch {
      // Valkey unreachable — degrade to the per-pod memory limiter.
    }
  }
  return checkRateLimit(key, config);
}
