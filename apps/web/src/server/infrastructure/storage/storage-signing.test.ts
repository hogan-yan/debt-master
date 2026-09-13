import { describe, expect, it, vi } from 'vitest';
import { signStoragePath, verifyStorageSignature } from './storage-signing';

// auth-server-utils captures JWT_SECRET at import time; vi.hoisted runs
// before static imports, so set it here.
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-for-storage-signing-0123456789';
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
