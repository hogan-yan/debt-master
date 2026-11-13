import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * infraConfig is parsed from process.env at module load, so each case re-imports
 * the module after mutating the environment + clearing the module cache.
 */
describe('infraConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  async function loadConfig(): Promise<{
    authProvider: string;
    authentik: { baseUrl: string; scope: string };
    storageProvider: string;
    cacheProvider: string;
    minio: { accessKey: string; bucket: string; port: number };
    localfs: { rootDir: string; bucket: string; publicBaseUrl: string };
  }> {
    const mod = await import('./config');
    return mod.infraConfig;
  }

  it('defaults to the better-auth provider when AUTH_PROVIDER is unset', async () => {
    delete process.env.AUTH_PROVIDER;
    const config = await loadConfig();
    expect(config.authProvider).toBe('better-auth');
  });

  it('honours AUTH_PROVIDER=better-auth', async () => {
    process.env.AUTH_PROVIDER = 'better-auth';
    const config = await loadConfig();
    expect(config.authProvider).toBe('better-auth');
  });

  it('applies authentik field defaults when env vars are absent', async () => {
    delete process.env.AUTHENTIK_BASE_URL;
    delete process.env.AUTHENTIK_SCOPE;
    const config = await loadConfig();
    expect(config.authentik.baseUrl).toBe('http://auth.mew');
    expect(config.authentik.scope).toBe('openid profile email');
  });

  it('coerces an empty AUTHENTIK_BASE_URL to the default', async () => {
    process.env.AUTHENTIK_BASE_URL = '';
    const config = await loadConfig();
    expect(config.authentik.baseUrl).toBe('http://auth.mew');
  });

  it('rejects an unsupported AUTH_PROVIDER', async () => {
    process.env.AUTH_PROVIDER = 'magic';
    await expect(loadConfig()).rejects.toThrow();
  });

  it('rejects a malformed AUTHENTIK_BASE_URL', async () => {
    process.env.AUTH_PROVIDER = 'authentik';
    process.env.AUTHENTIK_BASE_URL = 'not-a-url';
    await expect(loadConfig()).rejects.toThrow();
  });

  it('enforces the 32-char minimum on BETTER_AUTH_SECRET when set', async () => {
    process.env.AUTH_PROVIDER = 'better-auth';
    process.env.BETTER_AUTH_SECRET = 'too-short';
    await expect(loadConfig()).rejects.toThrow();
  });

  // --- storage provider (DEBTCOM-3) ---

  it('defaults to the minio storage provider when STORAGE_PROVIDER is unset', async () => {
    delete process.env.STORAGE_PROVIDER;
    const config = await loadConfig();
    expect(config.storageProvider).toBe('minio');
  });

  it('honours an explicit STORAGE_PROVIDER', async () => {
    process.env.STORAGE_PROVIDER = 'localfs';
    const config = await loadConfig();
    expect(config.storageProvider).toBe('localfs');
  });

  it('coerces an empty STORAGE_PROVIDER to the default', async () => {
    process.env.STORAGE_PROVIDER = '';
    const config = await loadConfig();
    expect(config.storageProvider).toBe('minio');
  });

  it('rejects an unsupported STORAGE_PROVIDER', async () => {
    process.env.STORAGE_PROVIDER = 's3-magic';
    await expect(loadConfig()).rejects.toThrow();
  });

  it('defaults minio accessKey to empty and applies field defaults', async () => {
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_BUCKET;
    const config = await loadConfig();
    expect(config.minio.accessKey).toBe('');
    expect(config.minio.bucket).toBe('debt-master');
  });

  it('parses an explicit MinIO port', async () => {
    process.env.MINIO_PORT = '9443';
    const config = await loadConfig();
    expect(config.minio.port).toBe(9443);
  });

  it('applies localfs field defaults when LOCALFS_* env vars are absent', async () => {
    delete process.env.LOCALFS_ROOT_DIR;
    delete process.env.LOCALFS_BUCKET;
    delete process.env.LOCALFS_PUBLIC_BASE_URL;
    const config = await loadConfig();
    expect(config.localfs.rootDir).toBe('./storage');
    expect(config.localfs.bucket).toBe('debt-master');
    expect(config.localfs.publicBaseUrl).toBe('');
  });

  it('honours explicit LOCALFS_* overrides', async () => {
    process.env.LOCALFS_ROOT_DIR = '/var/debt-master/files';
    process.env.LOCALFS_BUCKET = 'receipts';
    process.env.LOCALFS_PUBLIC_BASE_URL = 'https://cdn.example.com';
    const config = await loadConfig();
    expect(config.localfs.rootDir).toBe('/var/debt-master/files');
    expect(config.localfs.bucket).toBe('receipts');
    expect(config.localfs.publicBaseUrl).toBe('https://cdn.example.com');
  });

  // --- cache provider (DEBTCOM-5/-6) ---

  it('defaults to inmemory cache when no cache/valkey env is set', async () => {
    delete process.env.CACHE_PROVIDER;
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_HOST;
    process.env.NODE_ENV = 'development';
    const config = await loadConfig();
    expect(config.cacheProvider).toBe('inmemory');
  });

  it('selects valkey cache when VALKEY_HOST is set', async () => {
    delete process.env.CACHE_PROVIDER;
    process.env.NODE_ENV = 'development';
    process.env.VALKEY_HOST = 'localhost';
    const config = await loadConfig();
    expect(config.cacheProvider).toBe('valkey');
  });

  it('selects valkey cache in production even without VALKEY_* env', async () => {
    delete process.env.CACHE_PROVIDER;
    delete process.env.VALKEY_HOST;
    delete process.env.VALKEY_URL;
    process.env.NODE_ENV = 'production';
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
    const config = await loadConfig();
    expect(config.cacheProvider).toBe('valkey');
  });

  it('honours an explicit CACHE_PROVIDER over the heuristic', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VALKEY_HOST = 'localhost';
    process.env.CACHE_PROVIDER = 'inmemory';
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
    const config = await loadConfig();
    expect(config.cacheProvider).toBe('inmemory');
  });
});

describe('infraConfig boot-time secret gate', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('fails boot when AUTH_PROVIDER=better-auth in production without BETTER_AUTH_SECRET', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_PROVIDER = 'better-auth';
    delete process.env.BETTER_AUTH_SECRET;
    await expect(import('./config')).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it('allows better-auth in production when BETTER_AUTH_SECRET is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_PROVIDER = 'better-auth';
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
    const mod = await import('./config');
    expect(mod.infraConfig.betterAuth.secret).toBe('x'.repeat(32));
  });

  it('does not require BETTER_AUTH_SECRET outside production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_PROVIDER = 'better-auth';
    delete process.env.BETTER_AUTH_SECRET;
    const mod = await import('./config');
    expect(mod.infraConfig.betterAuth.secret).toBeUndefined();
  });

  it('does not require BETTER_AUTH_SECRET for authentik deploys in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_PROVIDER = 'authentik';
    delete process.env.BETTER_AUTH_SECRET;
    const mod = await import('./config');
    expect(mod.infraConfig.authProvider).toBe('authentik');
  });
});
