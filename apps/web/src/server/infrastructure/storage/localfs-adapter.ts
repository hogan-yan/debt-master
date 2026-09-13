/**
 * Local-filesystem storage adapter (DEBTCOM-4).
 *
 * Object-literal singleton implementing {@link StorageAdapter}, the zero-dependency
 * counterpart to {@link minioAdapter}: uploads land as plain files under
 * `<rootDir>/<bucket>/<objectKey>` and are served by the cookie-gated
 * `/api/storage/` route (see `localfs-serve.ts`). A self-host deploy selects this
 * backend with `STORAGE_PROVIDER=localfs` and needs no MinIO at all.
 *
 * MIME type is re-detected from magic bytes at serve time (see `localfs-serve.ts`),
 * so nothing is persisted alongside the file — the buffer is the single source.
 */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServerLogger } from '@/server/infrastructure/logger';
import { infraConfig } from '../config';
import { generateObjectKey } from './keys';
import type { StorageAdapter } from './storage-adapter';
import { signStoragePath } from './storage-signing';

const logger = createServerLogger('localfs', process.env.NODE_ENV === 'development');

/**
 * Resolve an object key to an absolute on-disk path, refusing anything that
 * escapes `<rootDir>/<bucket>`. Object keys originate server-side (our own
 * `generateObjectKey`, sanitized) but the serve route also feeds request-derived
 * input here, so the guard is enforced once at the boundary.
 */
export function resolveLocalPath(bucket: string, objectKey: string): string {
  const base = path.resolve(infraConfig.localfs.rootDir, bucket);
  const full = path.resolve(base, objectKey);
  if (full !== base && !full.startsWith(`${base}${path.sep}`)) {
    throw new Error(`Refusing object key outside its bucket: "${objectKey}"`);
  }
  return full;
}

export const localfsAdapter: StorageAdapter = {
  async upload({ buffer, fileName }) {
    try {
      const bucket = infraConfig.localfs.bucket;
      const objectKey = generateObjectKey(fileName, Date.now());
      const fullPath = resolveLocalPath(bucket, objectKey);

      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, buffer);

      return { bucket, objectKey };
    } catch (error) {
      logger.error('Failed to upload file to local filesystem', error);
      throw new Error('Failed to upload file');
    }
  },

  async getUrl(bucket, objectKey, expirySeconds) {
    // LocalFS files are served by our own route. Each URL is HMAC-signed with
    // an expiry (verified by localfs-serve) so a leaked path alone is useless;
    // the serve route still requires a valid session on top.
    const base = infraConfig.localfs.publicBaseUrl;
    const pathSegment = `/api/storage/${bucket}/${objectKey}`;
    const query = signStoragePath(
      bucket,
      objectKey,
      expirySeconds && expirySeconds > 0 ? expirySeconds : undefined
    );
    return `${base}${pathSegment}?${query}`;
  },

  async delete(bucket, objectKey) {
    try {
      await unlink(resolveLocalPath(bucket, objectKey));
    } catch (error) {
      // A missing file on delete is a no-op, not a failure (it may already have
      // been removed). Re-throw anything else.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to delete file from local filesystem', error);
        throw new Error('Failed to delete file');
      }
    }
  },
};

/**
 * Read a stored file's bytes for the serve route. Centralized so the
 * path-traversal guard in {@link resolveLocalPath} always applies.
 */
export async function readLocalFile(bucket: string, objectKey: string): Promise<Buffer> {
  return readFile(resolveLocalPath(bucket, objectKey));
}
