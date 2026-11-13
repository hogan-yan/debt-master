/**
 * Infrastructure configuration — parsed once from environment, validated with zod.
 *
 * Three swappable provider knobs, each resolved through the matching adapter
 * factory (`auth/`, `storage/`, `cache/`):
 *   - `authProvider`     selects the admin-login mechanism (DEBTCOM-1).
 *       - `better-auth` (default) email/password admin login via `better-auth` (DEBTCOM-2).
 *       - `authentik`   OAuth via a self-hosted Authentik instance.
 *   - `storageProvider` selects the object-storage backend (DEBTCOM-3).
 *       - `minio` (default) S3-compatible object storage via the `minio` client.
 *       - `localfs`     local filesystem — files under `rootDir`, served by the
 *         cookie-gated `/api/storage/` route (DEBTCOM-4). Needs no MinIO.
 *   - `cacheProvider`   selects the cache backend (DEBTCOM-5/-6). Resolved with a
 *       backward-compatible heuristic in {@link readConfig} (production or any
 *       `VALKEY_*` env → `valkey`; otherwise `inmemory`) so existing deploys keep
 *       their auto-selected backend without setting `CACHE_PROVIDER`. The Valkey
 *       connection params themselves are still read inline by `ValkeyCache`.
 *       - `inmemory` Map-backed fallback (`InMemoryCache`).
 *       - `valkey`   Redis-compatible cache via `ioredis`.
 *
 * Colleague access-code login is always available regardless of provider; the
 * auth provider only selects how an *admin* signs in.
 */
import { z } from 'zod';

const authProviderSchema = z.enum(['authentik', 'better-auth']).default('better-auth');
const storageProviderSchema = z.enum(['minio', 'localfs']).default('minio');
// No static `.default()` — resolved in readConfig() via the heuristic below.
const cacheProviderSchema = z.enum(['inmemory', 'valkey']);

const infraConfigSchema = z.object({
  nodeEnv: z.string().default('development'),
  authProvider: authProviderSchema,
  authentik: z.object({
    baseUrl: z.string().url().default('http://auth.mew'),
    clientId: z.string().default(''),
    clientSecret: z.string().default(''),
    redirectUri: z.string().url().default('http://localhost:3000/auth/callback'),
    scope: z.string().default('openid profile email'),
  }),
  betterAuth: z.object({
    secret: z.string().min(32).optional(),
    baseUrl: z.string().url().optional(),
  }),
  storageProvider: storageProviderSchema,
  minio: z.object({
    endpoint: z.string().default('localhost'),
    port: z.number().default(9000),
    useSsl: z.boolean().default(false),
    // Empty by default — the adapter throws when first used (lazy validation) so
    // dev environments without MinIO configured still boot.
    accessKey: z.string().default(''),
    secretKey: z.string().default(''),
    bucket: z.string().default('debt-master'),
  }),
  localfs: z.object({
    // Filesystem root under which all uploads are written as
    // `<rootDir>/<bucket>/<objectKey>`. The serve route reads from the same path.
    rootDir: z.string().default('./storage'),
    bucket: z.string().default('debt-master'),
    // Optional absolute base URL prefixed onto serve URLs. Empty (default) →
    // relative `/api/storage/...` URLs, correct for same-origin fetches.
    publicBaseUrl: z.string().default(''),
  }),
  cacheProvider: cacheProviderSchema,
});

export type InfraConfig = z.infer<typeof infraConfigSchema>;
export type AuthProvider = z.infer<typeof authProviderSchema>;
export type StorageProvider = z.infer<typeof storageProviderSchema>;
export type CacheProvider = z.infer<typeof cacheProviderSchema>;

/**
 * Resolve the cache provider with a backward-compatible heuristic:
 * an explicit `CACHE_PROVIDER` wins; otherwise `valkey` when running in
 * production or when any Valkey env var is set, else `inmemory`. Mirrors the
 * previous `createCache()` selection so existing deploys keep their backend.
 */
function resolveCacheProvider(): 'inmemory' | 'valkey' {
  const explicit = process.env.CACHE_PROVIDER;
  if (explicit === 'valkey' || explicit === 'inmemory') {
    return explicit;
  }
  const useValkey =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VALKEY_URL) ||
    Boolean(process.env.VALKEY_HOST);
  return useValkey ? 'valkey' : 'inmemory';
}

/**
 * Parse the infrastructure config from the current process environment.
 * Empty env strings are coerced to `undefined` so zod defaults apply.
 *
 * Boot-time fail-fast: a better-auth deploy without BETTER_AUTH_SECRET used to
 * surface only when better-auth first needed it (deep inside a request). In
 * production that is a broken deploy we want to know about at startup.
 */
function readConfig(): InfraConfig {
  const parsed = infraConfigSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    authProvider: process.env.AUTH_PROVIDER || undefined,
    authentik: {
      baseUrl: process.env.AUTHENTIK_BASE_URL || undefined,
      clientId: process.env.AUTHENTIK_CLIENT_ID || undefined,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET || undefined,
      redirectUri: process.env.AUTHENTIK_REDIRECT_URI || undefined,
      scope: process.env.AUTHENTIK_SCOPE || undefined,
    },
    betterAuth: {
      secret: process.env.BETTER_AUTH_SECRET || undefined,
      baseUrl: process.env.BETTER_AUTH_URL || undefined,
    },
    storageProvider: process.env.STORAGE_PROVIDER || undefined,
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || undefined,
      port: process.env.MINIO_PORT ? Number(process.env.MINIO_PORT) : undefined,
      useSsl: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || undefined,
      secretKey: process.env.MINIO_SECRET_KEY || undefined,
      bucket: process.env.MINIO_BUCKET || undefined,
    },
    localfs: {
      rootDir: process.env.LOCALFS_ROOT_DIR || undefined,
      bucket: process.env.LOCALFS_BUCKET || undefined,
      publicBaseUrl: process.env.LOCALFS_PUBLIC_BASE_URL || undefined,
    },
    cacheProvider: resolveCacheProvider(),
  });
  if (!parsed.success) {
    throw new Error(`FATAL: invalid infrastructure configuration: ${parsed.error.message}`);
  }
  const config = parsed.data;
  if (
    config.authProvider === 'better-auth' &&
    config.nodeEnv === 'production' &&
    !config.betterAuth.secret
  ) {
    throw new Error(
      'FATAL: BETTER_AUTH_SECRET is required when AUTH_PROVIDER=better-auth in production. Set it (min 32 chars) before starting the server.'
    );
  }
  return config;
}

export const infraConfig: InfraConfig = readConfig();
