import { afterAll, describe, expect, it, vi } from 'vitest';
import { signStoragePath, verifyStorageSignature } from './storage-signing';

// auth-server-utils captures JWT_SECRET at import time; vi.hoisted runs
// before static imports, so set it here.
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-for-storage-signing-0123456789';
});

// STORAGE_URL_TTL_SECONDS is computed at module-evaluation time, so the env
// variants below need a fresh module: reset the registry and re-import.
describe('STORAGE_URL_TTL_SECONDS (module-evaluated env override)', () => {
  const originalTtlEnv = process.env.STORAGE_URL_TTL_SECONDS;

  afterAll(() => {
    if (originalTtlEnv === undefined) {
      delete process.env.STORAGE_URL_TTL_SECONDS;
    } else {
      process.env.STORAGE_URL_TTL_SECONDS = originalTtlEnv;
    }
  });

  /** Reset the module registry and re-import so the constant re-evaluates. */
  const loadStorageSigning = async (): Promise<typeof import('./storage-signing')> => {
    vi.resetModules();
    return import('./storage-signing');
  };

  it('defaults to 900 (15 min) when the env var is unset', async () => {
    delete process.env.STORAGE_URL_TTL_SECONDS;
    const mod = await loadStorageSigning();
    expect(mod.STORAGE_URL_TTL_SECONDS).toBe(900);
  });

  it('honours a positive STORAGE_URL_TTL_SECONDS override', async () => {
    process.env.STORAGE_URL_TTL_SECONDS = '3600';
    const mod = await loadStorageSigning();
    expect(mod.STORAGE_URL_TTL_SECONDS).toBe(3600);
  });

  it.each(['0', '-5', 'abc', ''])(
    'falls back to 900 for a non-positive or non-numeric value (%s)',
    async (raw) => {
      process.env.STORAGE_URL_TTL_SECONDS = raw;
      const mod = await loadStorageSigning();
      expect(mod.STORAGE_URL_TTL_SECONDS).toBe(900);
    }
  );

  it('signStoragePath defaults to an expiry ≈ now + 900', async () => {
    delete process.env.STORAGE_URL_TTL_SECONDS;
    const mod = await loadStorageSigning();
    const query = mod.signStoragePath('debt-master', 'k');
    const expires = Number(new URLSearchParams(query).get('expires'));
    const now = Math.floor(Date.now() / 1000);
    expect(expires).toBeGreaterThanOrEqual(now + 890);
    expect(expires).toBeLessThanOrEqual(now + 910);
  });
});

describe('signStoragePath / verifyStorageSignature', () => {
  it('round-trips a signed path', () => {
    const query = signStoragePath('debt-master', 'receipts/123-x.png');
    const expires = new URLSearchParams(query).get('expires');
    const signature = new URLSearchParams(query).get('signature');

    expect(expires).not.toBeNull();
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyStorageSignature('debt-master', 'receipts/123-x.png', expires, signature)).toBe(
      true
    );
  });

  it('rejects a signature computed for a different key', () => {
    const query = signStoragePath('debt-master', 'receipts/123-x.png');
    const expires = new URLSearchParams(query).get('expires');
    const signature = new URLSearchParams(query).get('signature');

    expect(verifyStorageSignature('debt-master', 'receipts/other.png', expires, signature)).toBe(
      false
    );
  });

  it('rejects an expired signature', () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 10;
    const query = `expires=${expiresAt}&signature=${'0'.repeat(64)}`;
    const signature = new URLSearchParams(query).get('signature');

    expect(
      verifyStorageSignature('debt-master', 'receipts/123-x.png', String(expiresAt), signature)
    ).toBe(false);
  });

  it('rejects missing or malformed params', () => {
    expect(verifyStorageSignature('b', 'k', null, null)).toBe(false);
    expect(verifyStorageSignature('b', 'k', 'not-a-number', 'ff')).toBe(false);
    expect(
      verifyStorageSignature('b', 'k', String(Math.floor(Date.now() / 1000) + 60), 'short')
    ).toBe(false);
  });

  it('honours a custom TTL', () => {
    const query = signStoragePath('debt-master', 'k', 60);
    const expires = Number(new URLSearchParams(query).get('expires'));
    const now = Math.floor(Date.now() / 1000);
    expect(expires).toBeGreaterThanOrEqual(now + 55);
    expect(expires).toBeLessThanOrEqual(now + 65);
  });
});
