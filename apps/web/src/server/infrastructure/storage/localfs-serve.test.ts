import { beforeEach, describe, expect, it, vi } from 'vitest';

const { config, verifyToken, detectMimeType, readLocalFile, getSession } = vi.hoisted(() => ({
  config: { storageProvider: 'localfs' as string, authProvider: 'authentik' as string },
  verifyToken: vi.fn(),
  detectMimeType: vi.fn(),
  readLocalFile: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../config', () => ({ infraConfig: config }));
vi.mock('@/server/infrastructure/auth/auth-server-utils', () => ({
  verifyToken,
  getJwtSecret: () => 'test-secret-for-storage-signing-0123456789',
}));
vi.mock('@/server/utils/file-validation', () => ({ detectMimeType }));
vi.mock('./localfs-adapter', () => ({ readLocalFile }));
vi.mock('@/server/infrastructure/auth/better-auth-instance', () => {
  const instance = { api: { getSession } };
  return { getAuth: () => instance };
});

// storage-signing captures JWT_SECRET at import time; vi.hoisted runs before
// static imports, so set it here.
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-for-storage-signing-0123456789';
});

import { serveStoredObject } from './localfs-serve';
import { signStoragePath } from './storage-signing';

function storageRequest(pathSuffix: string, cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new Request(`http://localhost/api/storage/${pathSuffix}`, { headers });
}

/** A storage path with a fresh, valid signature. Signs the DECODED bucket and
 * key, mirroring how the serve route parses the pathname before verifying. */
function signedPath(bucketAndKey: string): string {
  const slashIdx = bucketAndKey.indexOf('/');
  const bucket = decodeURIComponent(bucketAndKey.slice(0, slashIdx));
  const objectKey = decodeURIComponent(bucketAndKey.slice(slashIdx + 1));
  return `${bucketAndKey}?${signStoragePath(bucket, objectKey)}`;
}

describe('serveStoredObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.storageProvider = 'localfs';
    config.authProvider = 'authentik';
    verifyToken.mockResolvedValue(null);
    detectMimeType.mockReturnValue('image/png');
    readLocalFile.mockResolvedValue(Buffer.from('img-bytes'));
    getSession.mockResolvedValue(null);
  });

  it('returns 404 when the provider is not localfs', async () => {
    config.storageProvider = 'minio';
    const res = await serveStoredObject(
      storageRequest(signedPath('debt-master/receipts/x.png'), 'debt-master-auth=t')
    );
    expect(res.status).toBe(404);
    expect(readLocalFile).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed path with no object key', async () => {
    const res = await serveStoredObject(storageRequest('debt-master'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for an empty object key', async () => {
    const res = await serveStoredObject(storageRequest('debt-master/'));
    expect(res.status).toBe(404);
  });

  it('returns 404 outside the storage route', async () => {
    const res = await serveStoredObject(new Request('http://localhost/api/other/debt-master/file'));
    expect(res.status).toBe(404);
  });

  it('returns 401 when no valid session is present', async () => {
    config.authProvider = 'authentik';
    const res = await serveStoredObject(storageRequest(signedPath('debt-master/receipts/x.png')));
    expect(res.status).toBe(401);
    expect(readLocalFile).not.toHaveBeenCalled();
  });

  it('returns 403 for a valid session without a signature', async () => {
    verifyToken.mockResolvedValue({ isAdmin: false, permissions: ['view'] });
    const res = await serveStoredObject(
      storageRequest('debt-master/receipts/x.png', 'debt-master-auth=some.jwt.token')
    );
    expect(res.status).toBe(403);
    expect(readLocalFile).not.toHaveBeenCalled();
  });

  it('returns 403 for a tampered signature', async () => {
    verifyToken.mockResolvedValue({ isAdmin: false, permissions: ['view'] });
    const res = await serveStoredObject(
      storageRequest(
        'debt-master/receipts/x.png?expires=9999999999&signature=deadbeef'.repeat(4),
        'debt-master-auth=some.jwt.token'
      )
    );
    expect(res.status).toBe(403);
    expect(readLocalFile).not.toHaveBeenCalled();
  });

  it('returns 403 for an expired signature', async () => {
    verifyToken.mockResolvedValue({ isAdmin: false, permissions: ['view'] });
    const expired = Date.now() / 1000 - 10;
    const res = await serveStoredObject(
      storageRequest(
        `debt-master/receipts/x.png?expires=${expired}&signature=${'0'.repeat(64)}`,
        'debt-master-auth=some.jwt.token'
      )
    );
    expect(res.status).toBe(403);
    expect(readLocalFile).not.toHaveBeenCalled();
  });

  it('falls through to unauthenticated when a JWT cookie is invalid', async () => {
    const res = await serveStoredObject(
      storageRequest(signedPath('debt-master/receipts/x.png'), 'debt-master-auth=invalid-token')
    );

    expect(verifyToken).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toBe(401);
  });

  it('serves the file with a detected Content-Type for a valid session and signature', async () => {
    verifyToken.mockResolvedValue({ isAdmin: false, permissions: ['view'] });
    const res = await serveStoredObject(
      storageRequest(signedPath('debt-master/receipts/x.png'), 'debt-master-auth=some.jwt.token')
    );

    expect(verifyToken).toHaveBeenCalledWith('some.jwt.token');
    expect(readLocalFile).toHaveBeenCalledWith('debt-master', 'receipts/x.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400');
    expect(await res.text()).toBe('img-bytes');
  });

  it('falls back to a Better Auth session when no JWT cookie is present', async () => {
    config.authProvider = 'better-auth';
    getSession.mockResolvedValue({ session: { id: 's1' }, user: { id: 'u1' } });

    const res = await serveStoredObject(storageRequest(signedPath('debt-master/receipts/x.png')));

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(readLocalFile).toHaveBeenCalledWith('debt-master', 'receipts/x.png');
    expect(res.status).toBe(200);
  });

  it('returns 401 when the BA session fallback is also absent', async () => {
    config.authProvider = 'better-auth';
    const res = await serveStoredObject(storageRequest(signedPath('debt-master/receipts/x.png')));
    expect(res.status).toBe(401);
    expect(readLocalFile).not.toHaveBeenCalled();
  });

  it('returns 404 when the file is missing on disk', async () => {
    verifyToken.mockResolvedValue({ isAdmin: false, permissions: ['view'] });
    readLocalFile.mockRejectedValue(new Error('ENOENT'));

    const res = await serveStoredObject(
      storageRequest(signedPath('debt-master/receipts/x.png'), 'debt-master-auth=t')
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for a path-traversal object key', async () => {
    verifyToken.mockResolvedValue({ isAdmin: false, permissions: ['view'] });
    readLocalFile.mockRejectedValue(new Error('Refusing object key outside its bucket'));

    const res = await serveStoredObject(
      storageRequest(signedPath('debt-master/..%2Fescape'), 'debt-master-auth=t')
    );
    expect(res.status).toBe(404);
  });

  it('falls back to octet-stream when MIME cannot be detected', async () => {
    verifyToken.mockResolvedValue({ isAdmin: false, permissions: ['view'] });
    detectMimeType.mockReturnValue(null);

    const res = await serveStoredObject(
      storageRequest(signedPath('debt-master/receipts/x.bin'), 'debt-master-auth=t')
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
  });
});
